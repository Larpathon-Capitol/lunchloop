"""FastAPI routes for LunchLoop health, voting, guessing, and engine calls."""

import os
import sqlite3
import csv
import hmac
import re
import threading
import time
import random
import secrets
from typing import Any
from datetime import datetime, timezone
from pathlib import Path
from contextlib import asynccontextmanager, closing

import engine
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictFloat
from starlette.exceptions import HTTPException as StarletteHTTPException

from .db import connect, init_db, load_taken
from .auth import configured_passwords, make_token, read_token, verify_password, sign_device, verify_device
from .game import (
    DEVICE_PATTERN,
    correct_guess_count,
    device,
    ensure_player,
    next_day,
    parse_date,
    score_guess,
    stats,
    today,
    valid_num,
)
from .events import EventStore
from .limits import LimitsMiddleware, SecurityHeadersMiddleware
from .trace import trace_forecast

MAX_RATIO = 99
MAX_MULTIPLIER = 10
SCHOOL_PATTERN = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


def not_found_errors():
    # The engine stubs don't define these, so look them up when needed.
    names = ("UnknownDateError", "UnknownItemError")
    return tuple(getattr(engine, name) for name in names if hasattr(engine, name))


class VoteBody(BaseModel):
    model_config = ConfigDict(strict=True)

    device: Any = None
    item_id: str
    school: str | None = None


class GuessBody(BaseModel):
    model_config = ConfigDict(strict=True)

    device: Any = None
    item_id: str
    school: str | None = None


class TrayBody(BaseModel):
    model_config = ConfigDict(strict=True)

    device: Any = None
    picks: Any = None
    school: str | None = None


class SimulateBody(BaseModel):
    model_config = ConfigDict(strict=True)

    date: str | None = None
    attendance_multiplier: StrictFloat = 1.0
    price_multiplier: StrictFloat = 1.0
    ratio: StrictFloat = 3.0


class CrowdBody(BaseModel):
    model_config = ConfigDict(strict=True)
    school: str = "demo"
    count: Any = None


class ServedBody(BaseModel):
    model_config = ConfigDict(strict=True)

    device: Any = None
    school: str | None = None
    got: Any = None


class FreeBody(BaseModel):
    model_config = ConfigDict(strict=True)

    item_id: Any = None
    free: Any = None


class LoginBody(BaseModel):
    model_config = ConfigDict(strict=True)

    school_id: str = Field(max_length=64)
    password: str = Field(max_length=1024)


class DeviceBody(BaseModel):
    model_config = ConfigDict(strict=True)
    legacy: str | None = None


def env_limit(name, default):
    """A positive whole-number limit from the environment, or the default when unset."""
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    try:
        number = int(value)
    except ValueError:
        raise ValueError(f"{name} must be a whole number") from None
    if number < 1:
        raise ValueError(f"{name} must be at least 1")
    return number


FAILURE_WINDOW = 600
MAX_FAILURES = 5


def create_app(max_requests=None, max_actions=None, body_limit=16 * 1024, request_limit=None, vote_limit=None,
               device_request_limit=None, device_action_limit=None, mint_limit=None):
    max_requests = env_limit("LUNCHLOOP_IP_REQUESTS", 1200) if max_requests is None else max_requests
    max_actions = env_limit("LUNCHLOOP_IP_ACTIONS", 300) if max_actions is None else max_actions
    device_request_limit = env_limit("LUNCHLOOP_DEVICE_REQUESTS", 60) if device_request_limit is None else device_request_limit
    device_action_limit = env_limit("LUNCHLOOP_DEVICE_ACTIONS", 12) if device_action_limit is None else device_action_limit
    mint_limit = env_limit("LUNCHLOOP_DEVICE_MINTS", 120) if mint_limit is None else mint_limit
    if request_limit is not None:
        max_requests = request_limit
    if vote_limit is not None:
        max_actions = vote_limit
    settings = {
        "data": os.getenv("LUNCHLOOP_DATA_DIR", "data"),
        "db": os.getenv("LUNCHLOOP_DB", "lunchloop.db"),
        "today": os.getenv("LUNCHLOOP_TODAY", "2026-10-19"),
        "signed_devices": os.getenv("LUNCHLOOP_SIGNED_DEVICES") == "1",
    }
    failures = {}
    failures_lock = threading.Lock()

    @asynccontextmanager
    async def lifespan(application):
        init_db(settings["db"], settings["data"])
        application.state.taken = load_taken(settings["data"])
        schools_path = Path(settings["data"]) / "schools.csv"
        schools = {}
        if schools_path.exists():
            with schools_path.open(newline="") as handle:
                for row in csv.DictReader(handle):
                    if SCHOOL_PATTERN.fullmatch(row.get("school_id", "")):
                        students = row.get("students") or None
                        schools[row["school_id"]] = {"school_id": row["school_id"], "name": row.get("name", ""), "students": int(students) if students and students.isdigit() else None}
        if not schools:
            schools["demo"] = {"school_id": "demo", "name": "Simulated high school", "students": None}
        application.state.schools = schools
        application.state.passwords = configured_passwords()
        application.state.settings = settings
        application.state.signed_devices = settings["signed_devices"]
        # Warm the engine's caches so the first visitor doesn't wait for the backtest.
        try:
            engine.meter(date=settings["today"], data_dir=settings["data"])
        except Exception:
            pass
        application.state.events = EventStore()
        yield

    docs_enabled = os.getenv("LUNCHLOOP_DOCS") == "1"
    application = FastAPI(
        lifespan=lifespan,
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        openapi_url="/openapi.json" if docs_enabled else None,
    )
    origins = [
        origin.strip()
        for origin in os.getenv("LUNCHLOOP_CORS_ORIGIN", "*").split(",")
        if origin.strip()
    ]
    # Added innermost first: limits, then CORS (so limit errors still carry CORS headers), then headers.
    application.add_middleware(
        LimitsMiddleware,
        max_requests=max_requests,
        max_actions=max_actions,
        body_limit=body_limit,
        device_requests=device_request_limit,
        device_actions=device_action_limit,
        max_mints=mint_limit,
        event_store=lambda: application.state.events,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*", "X-Demo-Date"],
        allow_credentials=False,
    )
    application.add_middleware(SecurityHeadersMiddleware)

    async def http_error(request, exception):
        detail = getattr(exception, "detail", "error")
        return JSONResponse({"error": str(detail)}, status_code=exception.status_code)

    async def validation_error(request, exception):
        return JSONResponse({"error": "bad input"}, status_code=400)

    async def unexpected_error(request, exception):
        return JSONResponse({"error": "something went wrong"}, status_code=500)

    application.add_exception_handler(StarletteHTTPException, http_error)
    application.add_exception_handler(RequestValidationError, validation_error)
    application.add_exception_handler(Exception, unexpected_error)

    def request_context(request, selected_school=None):
        request_settings = request.app.state.settings
        if selected_school == "live":
            return request_settings, request_settings["today"]
        return request_settings, today(request, request_settings)

    def parse_player(request, value, required=True):
        return device(value, required=required, signed_enforced=request.app.state.signed_devices)

    def record(request, kind, school_id=None, device_id=None, summary="", detail=None, started=None):
        elapsed = (time.perf_counter() - started) * 1000 if started is not None else None
        request.app.state.events.add(kind, school_id, device_id, summary, detail, elapsed)

    def school_id(request, value):
        selected = value or "demo"
        if not isinstance(selected, str) or not SCHOOL_PATTERN.fullmatch(selected) or selected not in request.app.state.schools:
            raise HTTPException(404, "unknown school")
        return selected

    def admin_school(request):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            raise HTTPException(401, "sign in again")
        payload = read_token(header[7:])
        if not payload or not isinstance(payload.get("s"), str) or payload["s"] not in request.app.state.schools:
            raise HTTPException(401, "sign in again")
        return payload["s"]

    components = ("meat_alternate", "grain", "vegetable", "fruit", "milk")
    diet_order = ("vegetarian", "vegan", "contains_pork", "contains_beef", "spicy")

    def item_payload(item):
        allergens = [value for value in (item["allergens"] or "").split(";") if value]
        diet = [value for value in diet_order if value in (item["diet"] or "").split(";")]
        return {"item_id": item["item_id"], "name": item["name"], "allergens": allergens,
                "diet": diet, "gluten_free": "wheat" not in allergens,
                "dairy_free": "milk" not in allergens}

    def tray_groups(connection, target_date):
        rows_for_day = connection.execute(
            """SELECT menu.item_id, items.name, items.component, items.allergens, items.diet
               FROM menu JOIN items ON items.item_id=menu.item_id
               WHERE menu.date=? ORDER BY menu.rowid""",
            (target_date,),
        ).fetchall()
        grouped = {component: [] for component in components}
        for row in rows_for_day:
            grouped[row["component"]].append(item_payload(row))
        return [
            {"component": component, "items": grouped[component]}
            for component in components if grouped[component]
        ]

    def tray_tally(connection, selected_school, current_date, target_date, groups):
        total = connection.execute(
            "SELECT COUNT(DISTINCT device) FROM trays WHERE school_id=? AND date=? AND target_date=?",
            (selected_school, current_date, target_date),
        ).fetchone()[0]
        output_groups = []
        for group in groups:
            component = group["component"]
            skips = connection.execute(
                "SELECT COUNT(*) FROM trays WHERE school_id=? AND date=? AND target_date=? AND component=? AND item_id IS NULL",
                (selected_school, current_date, target_date, component),
            ).fetchone()[0]
            items = []
            for item in group["items"]:
                picks = connection.execute(
                    "SELECT COUNT(*) FROM trays WHERE school_id=? AND date=? AND target_date=? AND component=? AND item_id=?",
                    (selected_school, current_date, target_date, component, item["item_id"]),
                ).fetchone()[0]
                items.append({"item_id": item["item_id"], "name": item["name"], "picks": picks, "share": picks / total if total else 0})
            output_groups.append({"component": component, "skips": skips, "items": items})
        return {"target_date": target_date, "total": total, "groups": output_groups}

    def free_items(connection, selected_school, current_date, include_component=False):
        rows = connection.execute(
            """SELECT freebies.item_id, items.name, items.component, freebies.created_at
               FROM freebies JOIN items ON items.item_id=freebies.item_id
               WHERE freebies.school_id=? AND freebies.date=? ORDER BY freebies.created_at, freebies.item_id""",
            (selected_school, current_date),
        ).fetchall()
        if include_component:
            return [{"item_id": row["item_id"], "name": row["name"], "component": row["component"], "since": row["created_at"]} for row in rows]
        return [{"item_id": row["item_id"], "name": row["name"], "since": row["created_at"]} for row in rows]

    def today_lunch(connection, selected_school, player_device, current_date):
        if not player_device:
            return None
        tray_rows = connection.execute(
            """SELECT date, component, item_id FROM trays
               WHERE school_id=? AND device=? AND target_date=?
               ORDER BY date DESC, rowid""",
            (selected_school, player_device, current_date),
        ).fetchall()
        if not tray_rows:
            return None
        packed_date = tray_rows[0]["date"]
        tray_rows = [row for row in tray_rows if row["date"] == packed_date]
        picks = {row["component"]: row["item_id"] for row in tray_rows}
        items = []
        for row in tray_rows:
            if row["item_id"] is None:
                continue
            item = connection.execute("SELECT name FROM items WHERE item_id=?", (row["item_id"],)).fetchone()
            if item:
                items.append({"component": row["component"], "item_id": row["item_id"], "name": item["name"]})
        checked = connection.execute(
            "SELECT got FROM served WHERE school_id=? AND device=? AND date=?",
            (selected_school, player_device, current_date),
        ).fetchone()
        return {"date": current_date, "picks": picks, "items": items, "checked_in": None if checked is None else bool(checked[0])}

    @application.get("/api/schools")
    def schools(request: Request):
        passwords = request.app.state.passwords
        return {"schools": [{"school_id": row["school_id"], "name": row["name"], "demo_password": "lunchloop" if row["school_id"] == "demo" and row["school_id"] not in passwords else None} for row in request.app.state.schools.values()], "simulated": True}

    @application.post("/api/admin/login")
    def admin_login(request: Request, body: LoginBody):
        selected = body.school_id
        # An unknown school has nothing to guess, so it is never counted.
        if selected not in request.app.state.schools:
            record(request, "staff_sign_in_failed", None, summary="A staff sign-in failed", detail={"school_id": None})
            raise HTTPException(401, "wrong school or password")
        configured = request.app.state.passwords.get(selected)
        public_demo = selected == "demo" and not configured
        key = (selected, request.client.host if request.client else "unknown")
        if not public_demo:
            now = time.time()
            with failures_lock:
                for stale in [k for k, stamps in failures.items() if now - stamps[-1] >= FAILURE_WINDOW]:
                    del failures[stale]
                attempts = [stamp for stamp in failures.get(key, []) if now - stamp < FAILURE_WINDOW]
                if len(attempts) >= MAX_FAILURES:
                    raise HTTPException(429, "too many tries, wait a few minutes")
                # Count the try before checking it, so parallel guesses can't slip past the limit.
                attempts.append(now)
                failures[key] = attempts
        if configured:
            valid = verify_password(body.password, configured)
        else:
            valid = public_demo and hmac.compare_digest(body.password.encode(), b"lunchloop")
        if not valid:
            record(request, "staff_sign_in_failed", selected, summary="A staff sign-in failed", detail={"school_id": selected})
            raise HTTPException(401, "wrong school or password")
        if not public_demo:
            with failures_lock:
                failures.pop(key, None)
        token, expires = make_token(selected)
        school = request.app.state.schools[selected]
        record(request, "staff_sign_in", selected, summary="A staff member signed in")
        expires_at = datetime.fromtimestamp(expires, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        return {"token": token, "school": {"school_id": school["school_id"], "name": school["name"]}, "expires_at": expires_at, "simulated": True}

    @application.get("/api/admin/summary")
    def admin_summary(request: Request):
        selected = admin_school(request)
        settings, current_date = request_context(request, selected)
        school = request.app.state.schools[selected]
        with closing(connect(settings["db"])) as connection:
            option = connection.execute("SELECT * FROM vote_options WHERE open_date=?", (current_date,)).fetchone()
            vote = None
            if option:
                ids = [option[f"option_{n}"] for n in (1, 2, 3, 4) if option[f"option_{n}"]]
                options = []
                total = connection.execute("SELECT COUNT(*) FROM votes WHERE school_id=? AND date=?", (selected, current_date)).fetchone()[0]
                for item_id in ids:
                    item = connection.execute("SELECT name FROM items WHERE item_id=?", (item_id,)).fetchone()
                    count = connection.execute("SELECT COUNT(*) FROM votes WHERE school_id=? AND date=? AND item_id=?", (selected, current_date, item_id)).fetchone()[0]
                    options.append({"item_id": item_id, "name": item[0], "votes": count, "share": count / total if total else 0})
                vote = {"target_date": option["target_date"], "target_slot": option["target_slot"], "total": total, "options": options}
            recent = []
            dates = connection.execute("SELECT date, COUNT(*) total FROM votes WHERE school_id=? AND date<? GROUP BY date ORDER BY date DESC LIMIT 10", (selected, current_date)).fetchall()
            for row in dates:
                winner = connection.execute("SELECT item_id, COUNT(*) votes FROM votes WHERE school_id=? AND date=? GROUP BY item_id ORDER BY votes DESC, item_id LIMIT 1", (selected, row["date"])).fetchone()
                item = connection.execute("SELECT name FROM items WHERE item_id=?", (winner["item_id"],)).fetchone()
                target = connection.execute("SELECT target_date FROM vote_options WHERE open_date=?", (row["date"],)).fetchone()
                recent.append({"open_date": row["date"], "target_date": target[0] if target else row["date"], "total": row["total"], "winner": {"item_id": winner["item_id"], "name": item[0], "votes": winner["votes"]}})
            past_rows = connection.execute("SELECT date,item_id,vote_share FROM meals WHERE date<? AND vote_share IS NOT NULL ORDER BY date DESC LIMIT 10", (current_date,)).fetchall()
            past = []
            for row in past_rows:
                item = connection.execute("SELECT name FROM items WHERE item_id=?", (row["item_id"],)).fetchone()
                past.append({"date": row["date"], "item_id": row["item_id"], "name": item[0], "vote_share": row["vote_share"]})
            guess = connection.execute("SELECT target_date, COUNT(*) total FROM guesses WHERE school_id=? AND date=? GROUP BY target_date", (selected, current_date)).fetchone()
            guesses = None
            if guess:
                items = []
                for row in connection.execute("SELECT item_id, COUNT(*) guesses FROM guesses WHERE school_id=? AND date=? GROUP BY item_id ORDER BY guesses DESC, item_id", (selected, current_date)):
                    item = connection.execute("SELECT name FROM items WHERE item_id=?", (row["item_id"],)).fetchone()
                    items.append({"item_id": row["item_id"], "name": item[0], "guesses": row["guesses"]})
                guesses = {"target_date": guess["target_date"], "total": guess["total"], "items": items}
            player_total = connection.execute("SELECT COUNT(*) FROM players WHERE school_id=?", (selected,)).fetchone()[0]
            voted_today = connection.execute("SELECT COUNT(*) FROM votes WHERE school_id=? AND date=?", (selected, current_date)).fetchone()[0]
            school_dates = [row[0] for row in connection.execute("SELECT DISTINCT date FROM menu WHERE date<=? ORDER BY date DESC LIMIT 5", (current_date,))]
            placeholders = ",".join("?" for _ in school_dates)
            voted_last = connection.execute(f"SELECT COUNT(DISTINCT device) FROM votes WHERE school_id=? AND date IN ({placeholders})", (selected, *school_dates)).fetchone()[0] if school_dates else 0
            target_row = next_day(connection, current_date)
            tray = None
            if target_row:
                groups = tray_groups(connection, target_row[0])
                if connection.execute("SELECT 1 FROM trays WHERE school_id=? AND date=? LIMIT 1", (selected, current_date)).fetchone():
                    tray = tray_tally(connection, selected, current_date, target_row[0], groups)
            free = free_items(connection, selected, current_date)
            menu_rows = connection.execute(
                """SELECT menu.item_id, items.name, items.component FROM menu JOIN items ON items.item_id=menu.item_id
                   WHERE menu.date=? ORDER BY menu.rowid, items.name""", (current_date,)
            ).fetchall()
            packed_devices = connection.execute(
                "SELECT DISTINCT device FROM trays WHERE school_id=? AND target_date=?", (selected, current_date)
            ).fetchall()
            checked_rows = connection.execute(
                "SELECT device, got FROM served WHERE school_id=? AND date=?", (selected, current_date)
            ).fetchall()
            checked_devices = {row["device"] for row in checked_rows}
            got_devices = {row["device"] for row in checked_rows if row["got"]}
            missed_devices = checked_devices - got_devices
            service = None
            if packed_devices:
                service_items = []
                free_ids = {entry["item_id"] for entry in free}
                for item in menu_rows:
                    wanted_devices = {row["device"] for row in connection.execute(
                        "SELECT device FROM trays WHERE school_id=? AND target_date=? AND item_id=?",
                        (selected, current_date, item["item_id"]),
                    ).fetchall()}
                    service_items.append({
                        "item_id": item["item_id"], "name": item["name"], "component": item["component"],
                        "wanted": len(wanted_devices), "got": len(wanted_devices & got_devices),
                        "missed": len(wanted_devices & missed_devices), "waiting": len(wanted_devices - checked_devices),
                        "free": item["item_id"] in free_ids,
                    })
                service = {"date": current_date, "packed": len(packed_devices), "checked_in": len(checked_devices), "got": len(got_devices), "missed": len(missed_devices), "items": service_items}
        return {"school": school, "today": current_date, "vote": vote, "recent_votes": recent, "past_winners": past, "guesses": guesses, "tray": tray, "players": {"total": player_total, "voted_today": voted_today, "voted_last_5_days": voted_last}, "service": service, "free": free, "simulated": True}

    @application.get("/api/health")
    def health(request: Request):
        _, current_date = request_context(request)
        return {"ok": True, "today": current_date, "simulated": True}

    @application.post("/api/device")
    def issue_device(request: Request, body: DeviceBody | None = None):
        # The per-IP mint limit is applied in LimitsMiddleware before this runs.
        legacy = body.legacy if body else None
        if legacy is not None and verify_device(legacy) is not None:
            return {"device": legacy, "simulated": True}
        known = False
        if legacy is not None and DEVICE_PATTERN.fullmatch(legacy):
            with closing(connect(request.app.state.settings["db"])) as connection:
                known = connection.execute("SELECT 1 FROM players WHERE device=? LIMIT 1", (legacy,)).fetchone() is not None
        return {"device": sign_device(legacy if known else secrets.token_hex(16)), "simulated": True}

    @application.get("/api/spin")
    def spin(request: Request, device_id: str | None = Query(None, alias="device"), school: str | None = None):
        selected_school = school_id(request, school)
        request_settings, current_date = request_context(request, selected_school)
        player_device = parse_player(request, device_id, required=bool(request.app.state.signed_devices and device_id is not None))
        with closing(connect(request_settings["db"])) as connection:
            if player_device:
                ensure_player(connection, player_device, selected_school)
                connection.commit()
            option_row = connection.execute(
                "SELECT * FROM vote_options WHERE open_date=?", (current_date,)
            ).fetchone()
            if option_row is None:
                raise HTTPException(404, "no voting today")
            options = []
            for option_number in (1, 2, 3, 4):
                item_id = option_row[f"option_{option_number}"]
                if not item_id:
                    continue
                item = connection.execute(
                    "SELECT item_id, name, allergens, diet FROM items WHERE item_id=?",
                    (item_id,),
                ).fetchone()
                options.append(item_payload(item))
            pool = []
            for item in connection.execute("SELECT item_id, name, allergens, diet FROM items WHERE component='meat_alternate' ORDER BY item_id"):
                payload = item_payload(item)
                payload.pop("allergens", None)
                pool.append(payload)
            already_voted = bool(
                player_device
                and connection.execute(
                    "SELECT 1 FROM votes WHERE school_id=? AND device=? AND date=?",
                    (selected_school, player_device, current_date),
                ).fetchone()
            )
        if player_device:
            record(request, "spin", selected_school, player_device, "A player opened today's vote", {"date": current_date})
        return {
            "date": current_date,
            "target_date": option_row["target_date"],
            "target_slot": option_row["target_slot"],
            "options": options,
            "pool": pool,
            "already_voted": already_voted,
            "simulated": True,
        }

    @application.get("/api/tray")
    def get_tray(request: Request, device_id: str | None = Query(None, alias="device"), school: str | None = None):
        selected_school = school_id(request, school)
        request_settings, current_date = request_context(request, selected_school)
        player_device = parse_player(request, device_id, required=bool(request.app.state.signed_devices and device_id is not None))
        with closing(connect(request_settings["db"])) as connection:
            target_row = next_day(connection, current_date)
            if target_row is None:
                raise HTTPException(404, "no next school day")
            target_date = target_row[0]
            groups = tray_groups(connection, target_date)
            picks = None
            tally = None
            if player_device:
                packed = connection.execute(
                    "SELECT component, item_id FROM trays WHERE school_id=? AND device=? AND date=? AND target_date=?",
                    (selected_school, player_device, current_date, target_date),
                ).fetchall()
                if packed:
                    picks = {row["component"]: row["item_id"] for row in packed}
                    tally = tray_tally(connection, selected_school, current_date, target_date, groups)
            lunch = today_lunch(connection, selected_school, player_device, current_date)
            free = free_items(connection, selected_school, current_date, include_component=True)
        return {"open_date": current_date, "target_date": target_date, "groups": groups, "picks": picks, "tally": tally, "today_lunch": lunch, "free_today": free, "simulated": True}

    @application.post("/api/tray")
    def post_tray(request: Request, body: TrayBody):
        player_device = parse_player(request, body.device)
        selected_school = school_id(request, body.school)
        request_settings, current_date = request_context(request, selected_school)
        if not isinstance(body.picks, dict):
            raise HTTPException(400, "picks must be an object")
        started = time.perf_counter()
        with closing(connect(request_settings["db"])) as connection:
            target_row = next_day(connection, current_date)
            if target_row is None:
                raise HTTPException(404, "no next school day")
            target_date = target_row[0]
            groups = tray_groups(connection, target_date)
            valid_groups = {group["component"] for group in groups}
            if any(key not in valid_groups for key in body.picks):
                raise HTTPException(400, "unknown food group")
            if any(component not in body.picks for component in valid_groups):
                raise HTTPException(400, "pick or skip every food group")
            valid_items = {(group["component"], item["item_id"]) for group in groups for item in group["items"]}
            for component, item_id in body.picks.items():
                if item_id is not None and (not isinstance(item_id, str) or (component, item_id) not in valid_items):
                    raise HTTPException(400, "that food is not on this tray")
            if all(item_id is None for item_id in body.picks.values()):
                raise HTTPException(400, "pick at least one food")
            if connection.execute(
                "SELECT 1 FROM trays WHERE school_id=? AND device=? AND date=? LIMIT 1",
                (selected_school, player_device, current_date),
            ).fetchone():
                raise HTTPException(409, "already packed a tray today")
            for component in (group["component"] for group in groups):
                connection.execute(
                    "INSERT INTO trays(school_id, device, date, target_date, component, item_id) VALUES(?,?,?,?,?,?)",
                    (selected_school, player_device, current_date, target_date, component, body.picks[component]),
                )
            ensure_player(connection, player_device, selected_school)
            streak, xp, _, last_vote_date = stats(connection, player_device, current_date, request.app.state.taken, selected_school)
            connection.execute(
                "UPDATE players SET streak=?, xp=?, last_vote_date=? WHERE school_id=? AND device=?",
                (streak, xp, last_vote_date, selected_school, player_device),
            )
            connection.commit()
            tally = tray_tally(connection, selected_school, current_date, target_date, groups)
        picked = sum(item_id is not None for item_id in body.picks.values())
        record(request, "tray", selected_school, player_device, f"A player packed a tray for {target_date}", {"picked": picked, "total": tally["total"]}, started)
        return {"ok": True, "target_date": target_date, "streak": streak, "xp": xp, "tally": tally, "simulated": True}

    @application.post("/api/served")
    def served(request: Request, body: ServedBody):
        player_device = parse_player(request, body.device)
        selected_school = school_id(request, body.school)
        if not isinstance(body.got, bool):
            raise HTTPException(400, "got must be true or false")
        settings, current_date = request_context(request, selected_school)
        with closing(connect(settings["db"])) as connection:
            if not connection.execute(
                "SELECT 1 FROM trays WHERE school_id=? AND device=? AND target_date=?",
                (selected_school, player_device, current_date),
            ).fetchone():
                raise HTTPException(404, "no tray for today")
            previous = connection.execute(
                "SELECT got FROM served WHERE school_id=? AND device=? AND date=?",
                (selected_school, player_device, current_date),
            ).fetchone()
            connection.execute(
                "INSERT INTO served(school_id,device,date,got) VALUES(?,?,?,?) ON CONFLICT(school_id,device,date) DO UPDATE SET got=excluded.got",
                (selected_school, player_device, current_date, int(body.got)),
            )
            connection.commit()
        if previous is None or bool(previous[0]) != body.got:
            record(request, "served", selected_school, player_device, "A student checked in after lunch", {"got": body.got})
        return {"ok": True, "date": current_date, "got": body.got, "simulated": True}

    @application.get("/api/free")
    def get_free(request: Request, school: str | None = None):
        selected_school = school_id(request, school)
        settings, current_date = request_context(request, selected_school)
        with closing(connect(settings["db"])) as connection:
            free = free_items(connection, selected_school, current_date, include_component=True)
        return {"date": current_date, "free": free, "simulated": True}

    @application.post("/api/admin/free")
    def admin_free(request: Request, body: FreeBody):
        selected_school = admin_school(request)
        if not isinstance(body.item_id, str):
            raise HTTPException(400, "that food is not on today's menu")
        if not isinstance(body.free, bool):
            raise HTTPException(400, "free must be true or false")
        settings, current_date = request_context(request, selected_school)
        with closing(connect(settings["db"])) as connection:
            item = connection.execute(
                "SELECT items.item_id, items.name FROM menu JOIN items ON items.item_id=menu.item_id WHERE menu.date=? AND items.item_id=?",
                (current_date, body.item_id),
            ).fetchone()
            if item is None:
                raise HTTPException(400, "that food is not on today's menu")
            if body.free:
                created_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
                connection.execute("INSERT OR IGNORE INTO freebies(school_id,date,item_id,created_at) VALUES(?,?,?,?)", (selected_school, current_date, body.item_id, created_at))
                summary = f"Staff made {item['name'].lower()} leftovers free"
            else:
                connection.execute("DELETE FROM freebies WHERE school_id=? AND date=? AND item_id=?", (selected_school, current_date, body.item_id))
                summary = f"Staff ended free {item['name'].lower()}"
            connection.commit()
            free = free_items(connection, selected_school, current_date)
        record(request, "free", selected_school, summary=summary, detail={"item_id": body.item_id, "free": body.free})
        return {"ok": True, "date": current_date, "free": free, "simulated": True}

    @application.get("/api/events")
    def events(request: Request, after: str = "0", limit: str = "50"):
        try:
            after_number = int(after)
            limit_number = int(limit)
        except (TypeError, ValueError):
            raise HTTPException(400, "bad input")
        if after_number < 0 or limit_number < 1 or limit_number > 100:
            raise HTTPException(400, "bad input")
        scope = request.query_params.get("scope")
        if scope not in (None, "live", "simulated"):
            raise HTTPException(400, "bad input")
        rows, latest = request.app.state.events.after(after_number, limit_number, scope)
        return {"events": rows, "latest_id": latest, "simulated": True}

    @application.get("/api/demo/calendar")
    def demo_calendar(request: Request, school: str | None = None):
        selected = school_id(request, school)
        if selected == "live":
            raise HTTPException(400, "demo controls are for simulated schools")
        settings = request.app.state.settings
        with closing(connect(settings["db"])) as connection:
            days = [row[0] for row in connection.execute("SELECT DISTINCT date FROM menu ORDER BY date")]
        return {"today": today(request, settings), "school_days": days, "default_today": settings["today"], "simulated": True}

    @application.post("/api/demo/crowd")
    def demo_crowd(request: Request, body: CrowdBody):
        selected = school_id(request, body.school)
        if selected == "live":
            raise HTTPException(400, "demo controls are for simulated schools")
        if isinstance(body.count, bool) or not isinstance(body.count, int) or body.count < 1 or body.count > 40:
            raise HTTPException(400, "count must be 1 to 40")
        settings, current_date = request_context(request, selected)
        with closing(connect(settings["db"])) as connection:
            option = connection.execute("SELECT * FROM vote_options WHERE open_date=?", (current_date,)).fetchone()
            target = next_day(connection, current_date)
            if option is None or target is None:
                raise HTTPException(404, "no voting today")
            option_ids = [option[f"option_{n}"] for n in (1, 2, 3, 4) if option[f"option_{n}"]]
            existing = connection.execute("SELECT COUNT(*) FROM votes WHERE school_id=? AND date=? AND device LIKE 'sim-%'", (selected, current_date)).fetchone()[0]
            # Seeded by where this batch starts, so a repeat call adds different students.
            rng = random.Random(f"{selected}:{current_date}:{existing}")
            # Simulated students vote by each entree's past popularity (share of students
            # present who took it), so vegetarian options get a real share too.
            weights = []
            for item_id in option_ids:
                popularity = connection.execute("SELECT AVG(CAST(servings_taken AS REAL) / attendance) FROM meals WHERE item_id=? AND attendance > 0", (item_id,)).fetchone()[0]
                weights.append(popularity if popularity else 0.2)
            groups = tray_groups(connection, target[0])
            meat = [row["item_id"] for row in connection.execute("SELECT item_id FROM menu WHERE date=? AND item_id IN (SELECT item_id FROM items WHERE component='meat_alternate')", (target[0],))]

            def random_picks(menu_groups):
                picks = {}
                for group in menu_groups:
                    items = group["items"]
                    picks[group["component"]] = items[rng.randrange(len(items))]["item_id"] if items and rng.random() > 0.2 else None
                if menu_groups and not any(value is not None for value in picks.values()):
                    picks[menu_groups[0]["component"]] = menu_groups[0]["items"][0]["item_id"]
                return picks

            def taken(fake, day):
                return any(
                    connection.execute(query, (selected, fake, day)).fetchone()
                    for query in (
                        "SELECT 1 FROM votes WHERE school_id=? AND device=? AND date=?",
                        "SELECT 1 FROM trays WHERE school_id=? AND device=? AND date=?",
                        "SELECT 1 FROM guesses WHERE school_id=? AND device=? AND date=?",
                    )
                )

            # Today's students: vote, pack tomorrow's tray, and sometimes guess.
            added = 0
            index = existing
            while added < body.count:
                fake = f"sim-{selected}-{current_date}-{index:03d}"
                index += 1
                # A real device may already use this id; skip it rather than fail.
                if taken(fake, current_date):
                    continue
                choice = rng.choices(option_ids, weights)[0]
                connection.execute("INSERT INTO votes(school_id,device,date,item_id) VALUES(?,?,?,?)", (selected, fake, current_date, choice))
                record(request, "spin", selected, fake, "A simulated player opened today's vote", {"date": current_date})
                record(request, "vote", selected, fake, "A simulated player voted", {"item_id": choice})
                picks = random_picks(groups)
                for group in groups:
                    connection.execute("INSERT INTO trays(school_id,device,date,target_date,component,item_id) VALUES(?,?,?,?,?,?)", (selected, fake, current_date, target[0], group["component"], picks[group["component"]]))
                record(request, "tray", selected, fake, f"A simulated player packed a tray for {target[0]}", {"picked": sum(value is not None for value in picks.values())})
                if meat and rng.random() < 0.35:
                    guess_item = rng.choice(meat)
                    connection.execute("INSERT INTO guesses(school_id,device,date,target_date,item_id) VALUES(?,?,?,?,?)", (selected, fake, current_date, target[0], guess_item))
                    record(request, "guess", selected, fake, "A simulated player made a guess", {"item_id": guess_item})
                added += 1

            # Today's lunch: students who packed yesterday check in after eating. If no simulated
            # student packed a tray for today yet, make one batch from the previous school day first.
            lunch_groups = tray_groups(connection, current_date)
            previous = connection.execute("SELECT date FROM menu WHERE date < ? ORDER BY date DESC LIMIT 1", (current_date,)).fetchone()
            if lunch_groups and previous:
                eaters = connection.execute(
                    "SELECT COUNT(DISTINCT device) FROM trays WHERE school_id=? AND target_date=? AND device LIKE 'sim-%'",
                    (selected, current_date),
                ).fetchone()[0]
                if eaters == 0:
                    made = 0
                    slot = 0
                    while made < body.count:
                        fake = f"sim-{selected}-{previous[0]}-{slot:03d}"
                        slot += 1
                        if taken(fake, previous[0]):
                            continue
                        picks = random_picks(lunch_groups)
                        for group in lunch_groups:
                            connection.execute("INSERT INTO trays(school_id,device,date,target_date,component,item_id) VALUES(?,?,?,?,?,?)", (selected, fake, previous[0], current_date, group["component"], picks[group["component"]]))
                        made += 1
                waiting = [
                    row[0]
                    for row in connection.execute(
                        "SELECT DISTINCT device FROM trays WHERE school_id=? AND target_date=? AND device LIKE 'sim-%' "
                        "AND device NOT IN (SELECT device FROM served WHERE school_id=? AND date=?) ORDER BY device",
                        (selected, current_date, selected, current_date),
                    )
                ]
                for fake in waiting[: body.count]:
                    if rng.random() < 0.85:
                        got = rng.random() < 0.90
                        connection.execute("INSERT OR REPLACE INTO served(school_id,device,date,got) VALUES(?,?,?,?)", (selected, fake, current_date, int(got)))
                        record(request, "served", selected, fake, "A student checked in after lunch", {"got": got})
            connection.commit()
            votes = connection.execute("SELECT COUNT(*) FROM votes WHERE school_id=? AND date=?", (selected, current_date)).fetchone()[0]
            trays = connection.execute("SELECT COUNT(DISTINCT device) FROM trays WHERE school_id=? AND date=?", (selected, current_date)).fetchone()[0]
            checked_in = connection.execute("SELECT COUNT(*) FROM served WHERE school_id=? AND date=?", (selected, current_date)).fetchone()[0]
        return {"ok": True, "added": added, "date": current_date, "totals": {"votes": votes, "trays": trays, "checked_in": checked_in}, "simulated": True}

    @application.get("/api/trace/forecast")
    def trace(request: Request, item_id: str, date_value: str | None = Query(None, alias="date"), ratio: float = 3.0):
        settings, current_date = request_context(request)
        target_date = parse_date(date_value or current_date).isoformat()
        with closing(connect(settings["db"])) as connection:
            if connection.execute("SELECT 1 FROM menu WHERE date=?", (target_date,)).fetchone() is None:
                raise HTTPException(404, "unknown date")
        try:
            ratio_value = valid_num(ratio, 3.0, 0, MAX_RATIO)
            return trace_forecast(item_id, target_date, ratio_value, settings["data"], as_of=current_date)
        except not_found_errors() as error:
            raise HTTPException(404, str(error)) from error
        except ValueError as error:
            raise HTTPException(400, str(error)) from error

    @application.post("/api/vote")
    def vote(request: Request, body: VoteBody):
        selected_school = school_id(request, body.school)
        request_settings, current_date = request_context(request, selected_school)
        player_device = parse_player(request, body.device)
        started = time.perf_counter()
        with closing(connect(request_settings["db"])) as connection:
            option_row = connection.execute(
                "SELECT * FROM vote_options WHERE open_date=?", (current_date,)
            ).fetchone()
            if option_row is None:
                raise HTTPException(404, "no voting today")
            item_row = connection.execute(
                "SELECT name FROM items WHERE item_id=?", (body.item_id,)
            ).fetchone()
            if not item_row:
                raise HTTPException(404, "unknown item")
            option_ids = [option_row[f"option_{number}"] for number in (1, 2, 3, 4) if option_row[f"option_{number}"]]
            if body.item_id not in option_ids:
                raise HTTPException(400, "item is not an option")
            try:
                connection.execute(
                    "INSERT INTO votes(school_id, device, date, item_id) VALUES(?,?,?,?)",
                    (selected_school, player_device, current_date, body.item_id),
                )
            except sqlite3.IntegrityError as error:
                connection.rollback()
                raise HTTPException(409, "already voted today") from error
            ensure_player(connection, player_device, selected_school)
            streak, xp, _, last_vote_date = stats(
                connection, player_device, current_date, request.app.state.taken, selected_school
            )
            connection.execute(
                "UPDATE players SET streak=?, xp=?, last_vote_date=? WHERE school_id=? AND device=?",
                (streak, xp, last_vote_date, selected_school, player_device),
            )
            connection.commit()
            tally = {
                item_id: connection.execute(
                    "SELECT COUNT(*) FROM votes WHERE school_id=? AND date=? AND item_id=?",
                    (selected_school, current_date, item_id),
                ).fetchone()[0]
                for item_id in option_ids
            }
        record(request, "vote", selected_school, player_device, f"A player voted for {item_row['name']}", {"item_id": body.item_id, "name": item_row["name"], "tally": tally[body.item_id]}, started)
        return {
            "ok": True,
            "streak": streak,
            "xp": xp,
            "tally": tally,
            "simulated": True,
        }

    @application.get("/api/me")
    def me(request: Request, device_id: str | None = Query(None, alias="device"), school: str | None = None):
        selected_school = school_id(request, school)
        request_settings, current_date = request_context(request, selected_school)
        player_device = parse_player(request, device_id)
        with closing(connect(request_settings["db"])) as connection:
            ensure_player(connection, player_device, selected_school)
            streak, xp, badges, last_vote_date = stats(
                connection, player_device, current_date, request.app.state.taken, selected_school
            )
            guess = connection.execute(
                "SELECT * FROM guesses WHERE school_id=? AND device=? AND date<=? ORDER BY date DESC LIMIT 1",
                (selected_school, player_device, current_date),
            ).fetchone()
            last_guess = None
            if guess is not None:
                last_guess = {
                    "target_date": guess["target_date"],
                    "item_id": guess["item_id"],
                    "correct": score_guess(guess, current_date, request.app.state.taken),
                }
            connection.execute(
                "UPDATE players SET streak=?, xp=?, last_vote_date=? WHERE school_id=? AND device=?",
                (streak, xp, last_vote_date, selected_school, player_device),
            )
            connection.commit()
            voted_today = bool(connection.execute("SELECT 1 FROM votes WHERE school_id=? AND device=? AND date=?", (selected_school, player_device, current_date)).fetchone())
            packed_today = bool(connection.execute("SELECT 1 FROM trays WHERE school_id=? AND device=? AND date=?", (selected_school, player_device, current_date)).fetchone())
            correct_calls = correct_guess_count(connection, player_device, current_date, request.app.state.taken, selected_school)
            lunch = today_lunch(connection, selected_school, player_device, current_date)
            free = free_items(connection, selected_school, current_date, include_component=True)
        response = {
            "device": player_device,
            "streak": streak,
            "xp": xp,
            "badges": badges,
            "last_guess": last_guess,
            "voted_today": voted_today,
            "packed_today": packed_today,
            "correct_calls": correct_calls,
            "today_lunch": lunch,
            "free_today": free,
            "simulated": True,
        }
        return response

    @application.post("/api/guess")
    def guess(request: Request, body: GuessBody):
        selected_school = school_id(request, body.school)
        request_settings, current_date = request_context(request, selected_school)
        player_device = parse_player(request, body.device)
        started = time.perf_counter()
        with closing(connect(request_settings["db"])) as connection:
            ensure_player(connection, player_device, selected_school)
            connection.commit()
            if not connection.execute(
                "SELECT 1 FROM menu WHERE date=?", (current_date,)
            ).fetchone():
                raise HTTPException(404, "not a school day")
            target_row = next_day(connection, current_date)
            if target_row is None:
                raise HTTPException(404, "no next school day")
            if not connection.execute(
                "SELECT 1 FROM items WHERE item_id=?", (body.item_id,)
            ).fetchone():
                raise HTTPException(404, "unknown item")
            if not connection.execute(
                """SELECT 1 FROM menu AS menu_row
                JOIN items AS item ON item.item_id=menu_row.item_id
                WHERE menu_row.date=? AND menu_row.item_id=?
                AND item.component='meat_alternate'""",
                (target_row[0], body.item_id),
            ).fetchone():
                raise HTTPException(400, "item is not a meat alternate")
            try:
                connection.execute(
                    "INSERT INTO guesses(school_id, device, date, target_date, item_id) VALUES(?,?,?,?,?)",
                    (selected_school, player_device, current_date, target_row[0], body.item_id),
                )
            except sqlite3.IntegrityError as error:
                connection.rollback()
                raise HTTPException(409, "already guessed today") from error
            connection.commit()
        name_row = None
        with closing(connect(request_settings["db"])) as connection:
            name_row = connection.execute("SELECT name FROM items WHERE item_id=?", (body.item_id,)).fetchone()
        guess_name = name_row[0] if name_row else body.item_id
        record(request, "guess", selected_school, player_device, f"A player guessed {guess_name} will be most popular", {"item_id": body.item_id, "target_date": target_row[0]}, started)
        return {"ok": True, "target_date": target_row[0], "simulated": True}

    def engine_call(request, function_name, **arguments):
        request_settings, _ = request_context(request)
        arguments.setdefault("data_dir", request_settings["data"])
        try:
            started = time.perf_counter()
            result = getattr(engine, function_name)(**arguments)
        except NotImplementedError as error:
            raise HTTPException(501, "engine not ready") from error
        except not_found_errors() as error:
            raise HTTPException(404, str(error)) from error
        except ArithmeticError as error:
            raise HTTPException(400, "invalid number") from error
        except ValueError as error:
            raise HTTPException(400, str(error)) from error
        if not isinstance(result, dict):
            raise HTTPException(500, "engine returned an unexpected result")
        if function_name == "prep_list":
            with closing(connect(request_settings["db"])) as connection:
                for item in result.get("items", []):
                    row = connection.execute("SELECT allergens, diet FROM items WHERE item_id=?", (item.get("item_id"),)).fetchone()
                    if row:
                        item.update(item_payload({"item_id": item.get("item_id"), "name": item.get("name", ""), "allergens": row["allergens"], "diet": row["diet"]}))
        result["simulated"] = True
        kind = {"prep_list": "prep", "backtest": "savings", "simulate": "simulate", "meter": "meter"}.get(function_name)
        if kind:
            items = result.get("items", [])
            total_prep = result.get("totals", {}).get("prep_servings")
            if total_prep is None:
                total_prep = sum(item.get("prep", 0) for item in items)
            detail = {"date": arguments.get("date"), "item_count": len(items), "total_prep_servings": total_prep, "leftover_cut_pct": result.get("leftover_cut_pct")}
            summaries = {
                "prep": "The engine made a prep list",
                "savings": "The engine replayed the last few weeks",
                "simulate": "The engine ran a what-if",
                "meter": "The engine added up this week's leftovers",
            }
            record(request, kind, summary=summaries[kind], detail=detail, started=started)
        return result

    @application.get("/api/prep")
    def prep(
        request: Request,
        date_value: str | None = Query(None, alias="date"),
        ratio: float = 3.0,
    ):
        request_settings, current_date = request_context(request)
        target_date = parse_date(date_value or current_date).isoformat()
        with closing(connect(request_settings["db"])) as connection:
            known_date = connection.execute(
                "SELECT 1 FROM menu WHERE date=?", (target_date,)
            ).fetchone()
        if known_date is None:
            raise HTTPException(404, "unknown date")
        return engine_call(
            request,
            "prep_list",
            date=target_date,
            ratio=valid_num(ratio, 3.0, 0, MAX_RATIO),
        )

    @application.get("/api/savings")
    def savings(request: Request, weeks: int = 4, ratio: float = 3.0):
        return engine_call(
            request,
            "backtest",
            weeks=valid_num(weeks, 4, 0, 12, integer=True),
            ratio=valid_num(ratio, 3.0, 0, MAX_RATIO),
        )

    @application.post("/api/simulate")
    def simulate(request: Request, body: SimulateBody):
        request_settings, current_date = request_context(request)
        target_date = parse_date(body.date or current_date).isoformat()
        with closing(connect(request_settings["db"])) as connection:
            known_date = connection.execute(
                "SELECT 1 FROM menu WHERE date=?", (target_date,)
            ).fetchone()
        if known_date is None:
            raise HTTPException(404, "unknown date")
        return engine_call(
            request,
            "simulate",
            date=target_date,
            attendance_multiplier=valid_num(body.attendance_multiplier, 1.0, 0, MAX_MULTIPLIER),
            price_multiplier=valid_num(body.price_multiplier, 1.0, 0, MAX_MULTIPLIER),
            ratio=valid_num(body.ratio, 3.0, 0, MAX_RATIO),
        )

    @application.get("/api/meter")
    def meter(request: Request):
        _, current_date = request_context(request)
        return engine_call(request, "meter", date=current_date)

    return application


app = create_app()
