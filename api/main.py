"""FastAPI routes for LunchLoop health, voting, guessing, and engine calls."""

import os
import sqlite3
from contextlib import asynccontextmanager, closing

import engine
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, StrictFloat
from starlette.exceptions import HTTPException as StarletteHTTPException

from .db import connect, init_db, load_taken
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

MAX_RATIO = 99
MAX_MULTIPLIER = 10


def not_found_errors():
    # The engine stubs don't define these, so look them up when needed.
    names = ("UnknownDateError", "UnknownItemError")
    return tuple(getattr(engine, name) for name in names if hasattr(engine, name))


class VoteBody(BaseModel):
    model_config = ConfigDict(strict=True)

    device: str
    item_id: str


class GuessBody(BaseModel):
    model_config = ConfigDict(strict=True)

    device: str
    item_id: str


class SimulateBody(BaseModel):
    model_config = ConfigDict(strict=True)

    date: str | None = None
    attendance_multiplier: StrictFloat = 1.0
    price_multiplier: StrictFloat = 1.0
    ratio: StrictFloat = 3.0


def create_app():
    settings = {
        "data": os.getenv("LUNCHLOOP_DATA_DIR", "data"),
        "db": os.getenv("LUNCHLOOP_DB", "lunchloop.db"),
        "today": os.getenv("LUNCHLOOP_TODAY", "2026-10-19"),
    }

    @asynccontextmanager
    async def lifespan(application):
        init_db(settings["db"], settings["data"])
        application.state.taken = load_taken(settings["data"])
        application.state.settings = settings
        yield

    application = FastAPI(lifespan=lifespan)
    origins = [
        origin.strip()
        for origin in os.getenv("LUNCHLOOP_CORS_ORIGIN", "*").split(",")
        if origin.strip()
    ]
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
        allow_credentials=False,
    )

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

    def request_context(request):
        request_settings = request.app.state.settings
        return request_settings, today(request, request_settings)

    @application.get("/api/health")
    def health(request: Request):
        _, current_date = request_context(request)
        return {"ok": True, "today": current_date, "simulated": True}

    @application.get("/api/spin")
    def spin(request: Request, device_id: str | None = Query(None, alias="device")):
        request_settings, current_date = request_context(request)
        player_device = device(device_id, required=False)
        with closing(connect(request_settings["db"])) as connection:
            if player_device:
                ensure_player(connection, player_device)
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
                    "SELECT 1 FROM votes WHERE device=? AND date=?",
                    (player_device, current_date),
                ).fetchone()
            )
        return {
            "date": current_date,
            "target_date": option_row["target_date"],
            "target_slot": option_row["target_slot"],
            "options": options,
            "already_voted": already_voted,
            "simulated": True,
        }

    @application.post("/api/vote")
    def vote(request: Request, body: VoteBody):
        request_settings, current_date = request_context(request)
        player_device = device(body.device)
        with closing(connect(request_settings["db"])) as connection:
            option_row = connection.execute(
                "SELECT * FROM vote_options WHERE open_date=?", (current_date,)
            ).fetchone()
            if option_row is None:
                raise HTTPException(404, "no voting today")
            if not connection.execute(
                "SELECT 1 FROM items WHERE item_id=?", (body.item_id,)
            ).fetchone():
                raise HTTPException(404, "unknown item")
            option_ids = [option_row[f"option_{number}"] for number in (1, 2, 3)]
            if body.item_id not in option_ids:
                raise HTTPException(400, "item is not an option")
            try:
                connection.execute(
                    "INSERT INTO votes(device, date, item_id) VALUES(?,?,?)",
                    (player_device, current_date, body.item_id),
                )
            except sqlite3.IntegrityError as error:
                connection.rollback()
                raise HTTPException(409, "already voted today") from error
            ensure_player(connection, player_device)
            streak, xp, _, last_vote_date = stats(
                connection, player_device, current_date, request.app.state.taken
            )
            connection.execute(
                "UPDATE players SET streak=?, xp=?, last_vote_date=? WHERE device=?",
                (streak, xp, last_vote_date, player_device),
            )
            connection.commit()
            tally = {
                item_id: connection.execute(
                    "SELECT COUNT(*) FROM votes WHERE date=? AND item_id=?",
                    (current_date, item_id),
                ).fetchone()[0]
                for item_id in option_ids
            }
        return {
            "ok": True,
            "streak": streak,
            "xp": xp,
            "tally": tally,
            "simulated": True,
        }

    @application.get("/api/me")
    def me(request: Request, device_id: str | None = Query(None, alias="device")):
        request_settings, current_date = request_context(request)
        player_device = device(device_id)
        with closing(connect(request_settings["db"])) as connection:
            ensure_player(connection, player_device)
            streak, xp, badges, last_vote_date = stats(
                connection, player_device, current_date, request.app.state.taken
            )
            guess = connection.execute(
                "SELECT * FROM guesses WHERE device=? AND date<=? ORDER BY date DESC LIMIT 1",
                (player_device, current_date),
            ).fetchone()
            last_guess = None
            if guess is not None:
                last_guess = {
                    "target_date": guess["target_date"],
                    "item_id": guess["item_id"],
                    "correct": score_guess(guess, current_date, request.app.state.taken),
                }
            connection.execute(
                "UPDATE players SET streak=?, xp=?, last_vote_date=? WHERE device=?",
                (streak, xp, last_vote_date, player_device),
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
        request_settings, current_date = request_context(request)
        player_device = device(body.device)
        with closing(connect(request_settings["db"])) as connection:
            ensure_player(connection, player_device)
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
                    "INSERT INTO guesses(device, date, target_date, item_id) VALUES(?,?,?,?)",
                    (player_device, current_date, target_row[0], body.item_id),
                )
            except sqlite3.IntegrityError as error:
                connection.rollback()
                raise HTTPException(409, "already guessed today") from error
            connection.commit()
        return {"ok": True, "target_date": target_row[0], "simulated": True}

    def engine_call(request, function_name, **arguments):
        request_settings, _ = request_context(request)
        arguments.setdefault("data_dir", request_settings["data"])
        try:
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
            weeks=valid_num(weeks, 4, 0, 52, integer=True),
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
