"""Held-out evaluation and the school waste meter."""

import copy
import statistics
from datetime import timedelta

from ._data import UnknownDateError, load, parse_date, today, validate_ratio
from ._forecast import core


_CACHE = {}


def _metric(rows, prep_key):
    if not rows:
        return {
            "avg_miss": 0.0,
            "leftover_servings": 0,
            "dollars_wasted": 0.0,
            "servings_short": 0,
            "dollars_short": 0.0,
        }
    misses = [abs(row[prep_key] - row["taken"]) for row in rows]
    leftover = sum(max(0, row[prep_key] - row["taken"]) for row in rows)
    wasted = sum(max(0, row[prep_key] - row["taken"]) * row["cost"] for row in rows)
    short = sum(max(0, row["taken"] - row[prep_key]) for row in rows)
    # Shortages are scored against servings_taken, which understates demand on sold-out days.
    short_dollars = sum(max(0, row["taken"] - row[prep_key]) * row["cost"] for row in rows)
    return {
        "avg_miss": round(statistics.mean(misses), 2),
        "leftover_servings": int(leftover),
        "dollars_wasted": round(wasted, 2),
        "servings_short": int(short),
        "dollars_short": round(short_dollars, 2),
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
    net_dollars_saved = (
        usual["dollars_wasted"]
        + ratio * usual["dollars_short"]
        - lunchloop["dollars_wasted"]
        - ratio * lunchloop["dollars_short"]
    )
    result = {
        "simulated": True,
        "weeks": weeks,
        "ratio": ratio,
        "shortage_ratio": ratio,
        "lunchloop": lunchloop,
        "usual": usual,
        "leftover_cut_pct": leftover_cut,
        "net_dollars_saved": round(net_dollars_saved, 2),
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
    waste_dollars = 0.0
    shortage_dollars = 0.0
    usual_short = 0
    lunchloop_short = 0
    ratio = result["shortage_ratio"]
    for row in rows:
        cost = costs[(row["date"], row["item_id"])]
        usual_left = max(0, row["prep_usual"] - row["taken"])
        lunchloop_left = max(0, row["prep_lunchloop"] - row["taken"])
        usual_row_short = max(0, row["taken"] - row["prep_usual"])
        lunchloop_row_short = max(0, row["taken"] - row["prep_lunchloop"])
        saved += usual_left - lunchloop_left
        waste_dollars += (usual_left - lunchloop_left) * cost
        shortage_dollars += ratio * (usual_row_short - lunchloop_row_short) * cost
        usual_short += usual_row_short
        lunchloop_short += lunchloop_row_short
    return {
        "simulated": True,
        "week_start": week_start.isoformat(),
        "servings_saved": int(saved),
        "dollars_saved": round(waste_dollars, 2),
        "net_dollars_saved": round(waste_dollars + shortage_dollars, 2),
        "extra_short_servings": int(lunchloop_short - usual_short),
    }
