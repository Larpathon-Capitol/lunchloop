"""Forecast trace endpoint implementation."""

import statistics
import math

from engine._data import get_item, load, parse_date, rows_for_item
from engine._forecast import baseline_rate, core, reason_for, school_attendance, _sigma


def trace_forecast(item_id, date, ratio, data_dir, as_of=None):
    data = load(data_dir)
    item = get_item(data, item_id)
    target = parse_date(date)
    result = core(item_id, date, ratio=ratio, as_of=as_of, data_dir=data_dir)
    history = result["history"]
    same = [row for row in history if row["date"].weekday() == target.weekday()]
    chosen = same[-4:] if same else history[-4:]
    attendance_dates = sorted({row["date"] for row in data["meals"] if row["date"] < result["cutoff"]})
    same_att = [d for d in attendance_dates if d.weekday() == target.weekday()]
    chosen_att = same_att[-4:] if same_att else attendance_dates[-4:]
    attendance_map = {row["date"]: row["attendance"] for row in data["meals"]}
    misses = []
    for row in history[-20:]:
        previous = [r for r in history if r["date"] < row["date"]]
        if len(previous) < 4 or row["attendance"] <= 0:
            continue
        try:
            base = baseline_rate(previous, row["date"].weekday())
        except ValueError:
            continue
        misses.append(row["servings_taken"] / row["attendance"] - base)
    sigma_fallback = len(misses) < 5
    service_level = ratio / (ratio + 1)
    z = statistics.NormalDist().inv_cdf(min(service_level, math.nextafter(1.0, 0.0)))
    return {
        "item_id": item_id, "name": item["name"], "date": date,
        "weekday": target.strftime("%A"), "ratio": ratio,
        "history": [{"date": r["date"].isoformat(), "attendance": r["attendance"], "taken": r["servings_taken"], "rate": r["servings_taken"] / r["attendance"]} for r in chosen],
        "mean_rate": baseline_rate(history, target.weekday()),
        "attendance": result["attendance"],
        "attendance_history": [{"date": d.isoformat(), "attendance": attendance_map[d]} for d in chosen_att],
        "predicted": result["predicted"], "misses": misses, "sigma": round(result["sigma"], 2),
        "sigma_fallback": sigma_fallback, "service_level": result["service_level"],
        "z": z, "buffer": result["buffer"], "floor": result["floor"], "prep": result["prep"],
        "reason": reason_for(result, data), "simulated": True,
    }
