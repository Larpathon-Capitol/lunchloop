"""Kitchen checks, prep lists, and scenario simulation."""

import math
import statistics

from ._data import UnknownDateError, get_item, load, menu_for_date, parse_date, round_half_up, today, validate_attendance, validate_multiplier, validate_ratio
from ._forecast import core, reason_for, school_attendance


_COMPONENTS = ("meat_alternate", "grain", "vegetable", "fruit", "milk")


def meal_check(menu, prep=None, data_dir=None):
    if not isinstance(menu, (list, tuple)) or any(not isinstance(item_id, str) for item_id in menu):
        raise ValueError("menu must be a list or tuple of strings")
    if prep is not None and not isinstance(prep, dict):
        raise ValueError("prep must be a dict")
    if prep is not None:
        for servings in prep.values():
            if (
                isinstance(servings, bool)
                or not isinstance(servings, (int, float))
                or not math.isfinite(servings)
                or int(servings) != servings
                or servings < 0
            ):
                raise ValueError("prep values must be non-negative integers")
    data = load(data_dir)
    menu_ids = list(menu)
    for item_id in menu_ids:
        get_item(data, item_id)
    if prep is not None:
        for item_id in prep:
            get_item(data, item_id)
    covered = {data["items"][item_id]["component"] for item_id in menu_ids}
    missing = [component for component in _COMPONENTS if component not in covered]
    below_floor = []
    if prep is not None:
        for item_id, servings in prep.items():
            floor = data["items"][item_id]["prep_floor"]
            if servings < floor:
                below_floor.append({"item_id": item_id, "prep": servings, "floor": floor})
    return {"ok": not missing and not below_floor, "missing_components": missing, "below_floor": below_floor}


def prep_list(date=None, attendance=None, ratio=3.0, data_dir=None):
    data = load(data_dir)
    target = parse_date(today() if date is None else date)
    ratio = validate_ratio(ratio)
    rows = menu_for_date(data, target)
    if not rows:
        raise UnknownDateError(f"unknown date: {target.isoformat()}")
    cutoff = min(today(), target)
    actual_attendance = validate_attendance(attendance) if attendance is not None else school_attendance(data, target, cutoff)
    items = []
    prep_values = {}
    for row in rows:
        item_id = row["item_id"]
        item = get_item(data, item_id)
        history = [r for r in data["meals"] if r["item_id"] == item_id and r["date"] < cutoff]
        if not history:
            floor = item["prep_floor"]
            component_rates = [
                row["servings_taken"] / row["attendance"]
                for row in data["meals"]
                if row["component"] == item["component"]
                and row["date"] < cutoff
                and row["attendance"] > 0
            ]
            predicted = round_half_up(statistics.mean(component_rates) * actual_attendance) if component_rates else 0
            service_level = ratio / (ratio + 1)
            cdf_level = min(service_level, math.nextafter(1.0, 0.0))
            z = statistics.NormalDist().inv_cdf(cdf_level)
            buffer = math.ceil(z * 0.1 * predicted)
            result = {
                "item_id": item_id,
                "predicted": predicted,
                "buffer": buffer,
                "prep": max(predicted + buffer, floor),
                "floor": floor,
            }
            reason = "Rough guess, no history for this item"
            if floor and result["prep"] == floor:
                reason += f", kept at the {floor}-serving minimum"
        else:
            result = core(item_id, target, actual_attendance, ratio, cutoff, data_dir)
            reason = reason_for(result, data)
        prep_values[item_id] = result["prep"]
        items.append({
            "item_id": item_id,
            "name": item["name"],
            "component": item["component"],
            "predicted": int(result["predicted"]),
            "buffer": int(result["buffer"]),
            "prep": int(result["prep"]),
            "floor": int(result["floor"]),
            "reason": reason,
            "allergens": list(item["allergens"]),
        })
    return {
        "date": target.isoformat(),
        "attendance": int(actual_attendance),
        "ratio": ratio,
        "simulated": True,
        "items": items,
        "meal_check": meal_check([row["item_id"] for row in rows], prep_values, data_dir),
    }


def _expected_leftover(prep, predicted, sigma):
    if sigma <= 0:
        return max(0, prep - predicted)
    k = (prep - predicted) / sigma
    normal = statistics.NormalDist()
    return sigma * (k * normal.cdf(k) + normal.pdf(k))


def simulate(date=None, attendance_multiplier=1.0, price_multiplier=1.0, ratio=3.0, data_dir=None):
    target = parse_date(today() if date is None else date)
    attendance_multiplier = validate_multiplier(attendance_multiplier, "attendance_multiplier")
    price_multiplier = validate_multiplier(price_multiplier, "price_multiplier")
    ratio = validate_ratio(ratio)
    data = load(data_dir)
    cutoff = min(today(), target)
    base = school_attendance(data, target, cutoff)
    attendance = validate_attendance(round_half_up(base * attendance_multiplier))
    result = prep_list(target, attendance, ratio, data_dir)
    total_leftover = 0.0
    food_cost = 0.0
    waste_cost = 0.0
    for item_result in result["items"]:
        item = data["items"][item_result["item_id"]]
        scaled_cost = round(item["cost_per_serving"] * price_multiplier, 4)
        item_result["cost_per_serving"] = scaled_cost
        try:
            forecast_result = core(item_result["item_id"], target, attendance, ratio, cutoff, data_dir)
            sigma = forecast_result["sigma"]
        except ValueError:
            sigma = 0.0
        expected = _expected_leftover(item_result["prep"], item_result["predicted"], sigma)
        total_leftover += expected
        food_cost += item_result["prep"] * scaled_cost
        waste_cost += expected * scaled_cost
    result["attendance_multiplier"] = attendance_multiplier
    result["price_multiplier"] = price_multiplier
    result["totals"] = {
        "prep_servings": int(sum(item["prep"] for item in result["items"])),
        "expected_leftover_servings": round(total_leftover, 1),
        "food_cost": round(food_cost, 2),
        "expected_waste_cost": round(waste_cost, 2),
    }
    return result
