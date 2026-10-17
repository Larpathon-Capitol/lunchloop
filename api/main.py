"""FastAPI routes for LunchLoop health, voting, guessing, and engine calls."""

import os
import sqlite3
import csv
import hmac
import re
import threading
import time
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
from .auth import configured_passwords, make_token, read_token, verify_password
from .game import (
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

    device: str
    item_id: str
    school: str | None = None


class GuessBody(BaseModel):
    model_config = ConfigDict(strict=True)

    device: str
    item_id: str
    school: str | None = None


class SimulateBody(BaseModel):
    model_config = ConfigDict(strict=True)

    date: str | None = None
    attendance_multiplier: StrictFloat = 1.0
    price_multiplier: StrictFloat = 1.0
    ratio: StrictFloat = 3.0


class LoginBody(BaseModel):
    model_config = ConfigDict(strict=True)

    school_id: str = Field(max_length=64)
    password: str = Field(max_length=1024)


FAILURE_WINDOW = 600
MAX_FAILURES = 5


def create_app(max_requests=3000, max_actions=300, body_limit=16 * 1024, request_limit=None, vote_limit=None):
    if request_limit is not None:
        max_requests = request_limit
    if vote_limit is not None:
        max_actions = vote_limit
    settings = {
        "data": os.getenv("LUNCHLOOP_DATA_DIR", "data"),
        "db": os.getenv("LUNCHLOOP_DB", "lunchloop.db"),
        "today": os.getenv("LUNCHLOOP_TODAY", "2026-10-19"),
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
        event_store=lambda: application.state.events,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
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
                ids = [option[f"option_{n}"] for n in (1, 2, 3)]
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
        return {"school": school, "today": current_date, "vote": vote, "recent_votes": recent, "past_winners": past, "guesses": guesses, "players": {"total": player_total, "voted_today": voted_today, "voted_last_5_days": voted_last}, "simulated": True}

    @application.get("/api/health")
    def health(request: Request):
        _, current_date = request_context(request)
        return {"ok": True, "today": current_date, "simulated": True}

    @application.get("/api/spin")
    def spin(request: Request, device_id: str | None = Query(None, alias="device"), school: str | None = None):
        selected_school = school_id(request, school)
        request_settings, current_date = request_context(request, selected_school)
        player_device = device(device_id, required=False)
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
            for option_number in (1, 2, 3):
                item_id = option_row[f"option_{option_number}"]
                item = connection.execute(
                    "SELECT item_id, name, allergens FROM items WHERE item_id=?",
                    (item_id,),
                ).fetchone()
                options.append(
                    {
                        "item_id": item["item_id"],
                        "name": item["name"],
                        "allergens": [
                            allergen
                            for allergen in (item["allergens"] or "").split(";")
                            if allergen
                        ],
                    }
                )
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
            "already_voted": already_voted,
            "simulated": True,
        }

    @application.get("/api/events")
    def events(request: Request, after: str = "0", limit: str = "50"):
        try:
            after_number = int(after)
            limit_number = int(limit)
        except (TypeError, ValueError):
            raise HTTPException(400, "bad input")
        if after_number < 0 or limit_number < 1 or limit_number > 100:
            raise HTTPException(400, "bad input")
        rows, latest = request.app.state.events.after(after_number, limit_number)
        return {"events": rows, "latest_id": latest, "simulated": True}

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
        player_device = device(body.device)
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
            option_ids = [option_row[f"option_{number}"] for number in (1, 2, 3)]
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
        player_device = device(device_id)
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
        return {
            "device": player_device,
            "streak": streak,
            "xp": xp,
            "badges": badges,
            "last_guess": last_guess,
            "simulated": True,
        }

    @application.post("/api/guess")
    def guess(request: Request, body: GuessBody):
        selected_school = school_id(request, body.school)
        request_settings, current_date = request_context(request, selected_school)
        player_device = device(body.device)
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
