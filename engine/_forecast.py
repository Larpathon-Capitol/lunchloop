"""Baseline forecasts and their explanations."""

import math
import statistics

from ._data import (
    get_item,
    load,
    parse_date,
    rows_for_item,
    round_half_up,
    today,
    validate_attendance,
    validate_ratio,
)


_WEEKDAYS = ("Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays")


def _cutoff(target, as_of):
    return min(parse_date(as_of) if as_of is not None else today(), target)


def _rate(rows):
    values = [r["servings_taken"] / r["attendance"] for r in rows if r["attendance"] > 0]
    if not values:
        raise ValueError("no usable attendance history")
    return statistics.mean(values)


def _attendance_by_date(data, cutoff):
    by_date = {}
    for row in data["meals"]:
        if row["date"] < cutoff:
            by_date.setdefault(row["date"], row["attendance"])
    return by_date


def baseline_rate(history, weekday):
    same = [r for r in history if r["date"].weekday() == weekday]
    chosen = same[-4:] if same else history[-4:]
    if not chosen:
        raise ValueError("no history")
    return _rate(chosen)


def school_attendance(data, target, cutoff):
    by_date = _attendance_by_date(data, cutoff)
    dates = sorted(by_date)
    same = [d for d in dates if d.weekday() == target.weekday()]
    chosen = same[-4:] if same else dates[-4:]
    if not chosen:
        raise ValueError("no school attendance history")
    return round_half_up(statistics.mean(by_date[d] for d in chosen))


def _sigma(history, attendance, predicted):
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
    if len(misses) >= 5:
        return statistics.stdev(misses) * attendance, False
    return 0.1 * predicted, True


def core(item_id, target_date, attendance=None, ratio=3.0, as_of=None, data_dir=None):
    data = load(data_dir)
    item = get_item(data, item_id)
    target = parse_date(target_date)
    ratio = validate_ratio(ratio)
    cutoff = _cutoff(target, as_of)
    history = rows_for_item(data, item_id, cutoff)
    if not history:
        raise ValueError(f"no history for {item_id}")
    actual_attendance = school_attendance(data, target, cutoff) if attendance is None else validate_attendance(attendance)
    rate = baseline_rate(history, target.weekday())
    predicted = round_half_up(rate * actual_attendance)
    sigma, fallback = _sigma(history, actual_attendance, predicted)
    service_level = ratio / (ratio + 1)
    # Keep NormalDist.inv_cdf finite when a huge ratio rounds service level to 1.
    cdf_level = min(service_level, math.nextafter(1.0, 0.0))
    z = statistics.NormalDist().inv_cdf(cdf_level)
    buffer = math.ceil(round(z * sigma, 9))
    floor = item["prep_floor"]
    prep = max(predicted + buffer, floor, 0)
    return {
        "item_id": item_id,
        "date": target.isoformat(),
        "attendance": int(actual_attendance),
        "predicted": int(predicted),
        "sigma": sigma,
        "buffer": int(buffer),
        "prep": int(prep),
        "floor": int(floor),
        "service_level": round(service_level, 4),
        "fallback": fallback,
        "history": history,
        "cutoff": cutoff,
    }


def _reason(result, data):
    history = result["history"]
    target = parse_date(result["date"])
    same = [r for r in history if r["date"].weekday() == target.weekday()]
    clauses = []
    if len(same) >= 2:
        try:
            weekday_rate = _rate(same[-4:])
            overall_rate = _rate(history[-20:])
            if overall_rate:
                pct = round_half_up((weekday_rate / overall_rate - 1) * 100)
                if abs(pct) >= 5:
                    direction = "higher" if pct > 0 else "lower"
                    clauses.append(f"{_WEEKDAYS[target.weekday()]} run {abs(pct)}% {direction}")
        except ValueError:
            pass

    by_date = _attendance_by_date(data, result["cutoff"])
    dates = sorted(by_date)[-20:]
    if dates:
        usual = statistics.mean(by_date[d] for d in dates)
        if usual:
            difference = round_half_up((result["attendance"] / usual - 1) * 100)
            if abs(difference) < 5:
                clauses.append("attendance is normal")
            elif difference > 0:
                clauses.append(f"attendance is {abs(difference)}% above usual")
            else:
                clauses.append(f"attendance is {abs(difference)}% below usual")

    if result["fallback"]:
        clauses.append(f"buffer {result['buffer']:+d} (rough, little history)")
    else:
        clauses.append(f"buffer {result['buffer']:+d}")
    if result["prep"] == result["floor"] and result["predicted"] + result["buffer"] < result["floor"] and result["floor"]:
        clauses.append(f"kept at the {result['floor']}-serving minimum")
    text = ", ".join(clauses)
    return text[:1].upper() + text[1:]


def public_result(result):
    keys = ("item_id", "date", "attendance", "predicted", "sigma", "buffer", "prep", "floor", "service_level")
    return {key: round(result[key], 2) if key == "sigma" else result[key] for key in keys}


def forecast(item_id, date, attendance=None, ratio=3.0, as_of=None, data_dir=None):
    return public_result(core(item_id, date, attendance, ratio, as_of, data_dir))


def explain(item_id, date, ratio=3.0, as_of=None, data_dir=None):
    data = load(data_dir)
    return _reason(core(item_id, date, None, ratio, as_of, data_dir), data)


def reason_for(result, data):
    return _reason(result, data)
