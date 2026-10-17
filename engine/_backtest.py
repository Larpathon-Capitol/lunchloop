"""Held-out evaluation and the school waste meter."""

import copy
import statistics
from datetime import timedelta

from ._data import UnknownDateError, load, parse_date, today, validate_ratio
from ._forecast import core


_CACHE = {}


def _metric(rows, prep_key):
    if not rows:
        return {"avg_miss": 0.0, "leftover_servings": 0, "dollars_wasted": 0.0, "servings_short": 0}
    misses = [abs(row[prep_key] - row["taken"]) for row in rows]
    leftover = sum(max(0, row[prep_key] - row["taken"]) for row in rows)
    wasted = sum(max(0, row[prep_key] - row["taken"]) * row["cost"] for row in rows)
    short = sum(max(0, row["taken"] - row[prep_key]) for row in rows)
    return {
        "avg_miss": round(statistics.mean(misses), 2),
        "leftover_servings": int(leftover),
        "dollars_wasted": round(wasted, 2),
        "servings_short": int(short),
    }


def backtest(weeks=4, ratio=3.0, data_dir=None):
    if isinstance(weeks, bool) or not isinstance(weeks, int) or weeks < 1:
        raise ValueError("weeks must be an integer >= 1")
    ratio = validate_ratio(ratio)
    data = load(data_dir)
    cache_key = (data["key"], weeks, ratio)
    if cache_key in _CACHE:
        return copy.deepcopy(_CACHE[cache_key])
    if not data["meals"]:
        raise ValueError("no meal history")
    last = max(row["date"] for row in data["meals"])
    start = last - timedelta(days=last.weekday() + 7 * (weeks - 1))
    held = sorted((row for row in data["meals"] if row["date"] >= start), key=lambda row: (row["date"], row["item_id"]))
    evaluated = []
    series = []
    for row in held:
        history = [r for r in data["meals"] if r["item_id"] == row["item_id"] and r["date"] < row["date"]]
        if not history:
            continue
        forecast_result = core(row["item_id"], row["date"], None, ratio, row["date"], data_dir)
        evaluated.append({
            "lunchloop": forecast_result["prep"],
            "usual": row["servings_prepared"],
            "taken": row["servings_taken"],
            "cost": row["cost_per_serving"],
        })
        series.append({
            "date": row["date"].isoformat(),
            "item_id": row["item_id"],
            "prep_lunchloop": forecast_result["prep"],
            "prep_usual": row["servings_prepared"],
            "taken": row["servings_taken"],
        })
    lunchloop = _metric(evaluated, "lunchloop")
    usual = _metric(evaluated, "usual")
    if usual["leftover_servings"] == 0:
        leftover_cut = 0.0
    else:
        leftover_cut = round(100 * (usual["leftover_servings"] - lunchloop["leftover_servings"]) / usual["leftover_servings"], 1)
    result = {
        "simulated": True,
        "weeks": weeks,
        "ratio": ratio,
        "lunchloop": lunchloop,
        "usual": usual,
        "leftover_cut_pct": leftover_cut,
        "series": series,
    }
    _CACHE[cache_key] = copy.deepcopy(result)
    return result


def meter(date=None, data_dir=None):
    target = parse_date(today() if date is None else date)
    data = load(data_dir)
    result = backtest(data_dir=data_dir)
    rows = [row for row in result["series"] if parse_date(row["date"]) <= target]
    if not rows:
        raise UnknownDateError(f"unknown date: {target.isoformat()}")
    latest = max(parse_date(row["date"]) for row in rows)
    week_start = latest - timedelta(days=latest.weekday())
    rows = [row for row in rows if week_start <= parse_date(row["date"]) <= target]
    costs = {(row["date"].isoformat(), row["item_id"]): row["cost_per_serving"] for row in data["meals"]}
    saved = 0
    dollars = 0.0
    for row in rows:
        difference = max(0, row["prep_usual"] - row["taken"]) - max(0, row["prep_lunchloop"] - row["taken"])
        saved += difference
        dollars += difference * costs[(row["date"], row["item_id"])]
    return {
        "simulated": True,
        "week_start": week_start.isoformat(),
        "servings_saved": int(saved),
        "dollars_saved": round(dollars, 2),
    }
