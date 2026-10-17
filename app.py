"""LunchLoop API: thin FastAPI wrapper around prediction.py for the React dashboard.

Run with:  uvicorn app:app --reload
Then open http://127.0.0.1:8000/docs for interactive testing.
"""
import threading
from datetime import date, timedelta
from pathlib import Path
from typing import List, Literal, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from prediction import (load_data, plan_day, plan_month, summarize_history, mae_report,
                         compute_data_driven_buffers, validate_history, evaluate_methods,
                         walk_forward_residuals, school_days, SHORTAGE_PENALTY_MULTIPLIER,
                         DEFAULT_BUFFER_RULE)
from simulation import run_simulation_study

app = FastAPI(title="LunchLoop API")

# Dev-friendly default: allow the React dev server to call this without extra config.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

df = load_data()
# Computed once at startup (each is a walk-forward backtest over the whole history):
# BUFFERS feeds /plan and /plan/month; ACCURACY and DATA_QUALITY are their own endpoints.
RESIDUALS = walk_forward_residuals(df)
BUFFERS = compute_data_driven_buffers(df, residuals=RESIDUALS)
ACCURACY = mae_report(df)
DATA_QUALITY_ISSUES = validate_history(df)
_buffer_cache = {(SHORTAGE_PENALTY_MULTIPLIER, DEFAULT_BUFFER_RULE): BUFFERS}
_eval_cache = {}
_simulation = {}
_simulation_lock = threading.Lock()


def buffers_for(m, rule=DEFAULT_BUFFER_RULE):
    """Buffers depend on the shortage multiplier and the buffer rule."""
    if (m, rule) not in _buffer_cache:
        if len(_buffer_cache) > 32:  # bounded: m is user input
            _buffer_cache.clear()
        _buffer_cache[(m, rule)] = compute_data_driven_buffers(df, m, residuals=RESIDUALS, buffer_rule=rule)
    return _buffer_cache[(m, rule)]

# A multiplier <= 0 would make shortages free or profitable; reject it at the boundary.
Multiplier = Field(SHORTAGE_PENALTY_MULTIPLIER, gt=0, le=100)
BufferRule = Literal["shortage_first", "cost_optimal"]


class MenuItem(BaseModel):
    food_item: str
    food_category: Optional[str] = None
    unit_cost: Optional[float] = None


class PlanRequest(BaseModel):
    expected_attendance: Optional[int] = None
    target_date: Optional[str] = None  # "YYYY-MM-DD"; used to estimate attendance if expected_attendance is omitted
    menu: Optional[List[MenuItem]] = None
    shortage_penalty_multiplier: float = Multiplier
    buffer_rule: BufferRule = DEFAULT_BUFFER_RULE


class MonthPlanRequest(BaseModel):
    year: int
    month: int  # 1-12
    menu: Optional[List[MenuItem]] = None
    shortage_penalty_multiplier: float = Multiplier
    buffer_rule: BufferRule = DEFAULT_BUFFER_RULE


@app.get("/health")
def health():
    return {"status": "ok", "history_rows": len(df)}


@app.get("/summary")
def summary():
    return {"days_in_history": int(df["date"].nunique()),
            "first_date": str(df["date"].min().date()), "last_date": str(df["date"].max().date()),
            "synthetic_data": True, "per_food": summarize_history(df)}


@app.get("/next-school-day")
def next_school_day():
    """Today if it is a school day, else the next one (weekdays minus the holidays in
    SCHOOL_HOLIDAYS). The dashboard plans this day by default."""
    today = date.today()
    days = school_days(today, today + timedelta(days=60))
    day = days[0] if days else pd.Timestamp(today) + pd.offsets.BDay(0)
    return {"date": day.strftime("%Y-%m-%d"), "weekday": day.strftime("%A")}


@app.get("/accuracy")
def accuracy():
    return ACCURACY


@app.get("/buffers")
def buffers():
    return BUFFERS


@app.get("/data-quality")
def data_quality():
    return {"issues": DATA_QUALITY_ISSUES, "clean": len(DATA_QUALITY_ISSUES) == 0}


@app.get("/", response_class=HTMLResponse)
def dashboard():
    return DASHBOARD_HTML


@app.post("/plan")
def plan(request: PlanRequest):
    if request.expected_attendance is None and request.target_date is None:
        raise HTTPException(status_code=400,
                             detail="Provide expected_attendance or target_date (or both).")
    menu = [item.model_dump() for item in request.menu] if request.menu else None
    return plan_day(df, expected_attendance=request.expected_attendance,
                     target_date=request.target_date, menu=menu,
                     buffers_table=buffers_for(request.shortage_penalty_multiplier, request.buffer_rule),
                     shortage_penalty_multiplier=request.shortage_penalty_multiplier,
                     buffer_rule=request.buffer_rule)


@app.post("/plan/month")
def plan_month_endpoint(request: MonthPlanRequest):
    if not 1 <= request.month <= 12:
        raise HTTPException(status_code=400, detail="month must be 1-12.")
    menu = [item.model_dump() for item in request.menu] if request.menu else None
    return plan_month(df, request.year, request.month, menu=menu,
                       buffers_table=buffers_for(request.shortage_penalty_multiplier, request.buffer_rule),
                       shortage_penalty_multiplier=request.shortage_penalty_multiplier,
                       buffer_rule=request.buffer_rule)


@app.get("/plan/sensitivity")
def plan_sensitivity(expected_attendance: int):
    """How sensitive the sample-day savings comparison is to the shortage penalty assumption
    (see calculate_costs() in prediction.py). Not a measured result -- shows the same day
    re-planned under several different, clearly-labeled assumptions side by side."""
    multipliers = [1.0, 1.5, 2.0, 3.0, 5.0]
    results = []
    for m in multipliers:
        # Each multiplier gets its own buffers too: the cost-minimizing buffer depends on it.
        plan_result = plan_day(df, expected_attendance=expected_attendance, buffers_table=buffers_for(m),
                                shortage_penalty_multiplier=m)
        results.append({"shortage_penalty_multiplier": m, "totals": plan_result["totals"]})
    return {"expected_attendance": expected_attendance, "results": results,
            "note": "shortage_penalty_multiplier is a configurable ASSUMPTION (see /plan), not a "
                    "measured cost -- this shows how much the savings conclusion depends on it."}


@app.get("/evaluate")
def evaluate(shortage_penalty_multiplier: float = Query(SHORTAGE_PENALTY_MULTIPLIER, gt=0, le=100),
             buffer_rule: BufferRule = DEFAULT_BUFFER_RULE):
    """Leak-free walk-forward evaluation of baseline vs. LunchLoop, on the same held-out
    school days (see evaluate_methods() in prediction.py for the full methodology)."""
    key = (shortage_penalty_multiplier, buffer_rule)
    if key not in _eval_cache:
        if len(_eval_cache) > 32:  # bounded: m is user input
            _eval_cache.clear()
        _eval_cache[key] = evaluate_methods(df, shortage_penalty_multiplier=key[0], buffer_rule=buffer_rule)
    return _eval_cache[key]


@app.get("/simulation")
def simulation():
    """The SYNTHETIC multi-scenario strategy study (simulation.py). Fixed settings and seeds,
    so it is computed once (about 30 s) and cached."""
    with _simulation_lock:
        if "result" not in _simulation:
            _simulation["result"] = run_simulation_study()
    return _simulation["result"]


# The dashboard is a plain HTML file next to this one; every number in it is fetched from the API.
DASHBOARD_HTML = (Path(__file__).with_name("dashboard.html")).read_text(encoding="utf-8")
