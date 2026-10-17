"""Data loading and shared validation helpers."""

import csv
import math
import os
from datetime import date as Date, datetime as DateTime
from numbers import Real
from pathlib import Path


class UnknownDateError(ValueError):
    """Raised when a requested menu date is unavailable."""


class UnknownItemError(ValueError):
    """Raised when a requested item is unavailable."""


_CACHE = {}


def resolve_dir(data_dir=None):
    return Path(data_dir if data_dir is not None else os.environ.get("LUNCHLOOP_DATA_DIR", "data")).resolve()


def today():
    return parse_date(os.environ.get("LUNCHLOOP_TODAY", "2026-10-19"))


def parse_date(value):
    if isinstance(value, DateTime):
        raise ValueError("date must be an ISO date")
    if isinstance(value, Date):
        return value
    if (
        not isinstance(value, str)
        or len(value) != 10
        or value[4] != "-"
        or value[7] != "-"
        or not value[:4].isdigit()
        or not value[5:7].isdigit()
        or not value[8:].isdigit()
    ):
        raise ValueError("date must be an ISO date")
    try:
        return Date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("date must be an ISO date") from exc


def round_half_up(value):
    return math.floor(value + 0.5)


def validate_ratio(value):
    if isinstance(value, bool) or not isinstance(value, Real):
        raise ValueError("ratio must be a finite real greater than 0")
    if not math.isfinite(value) or value <= 0:
        raise ValueError("ratio must be a finite real greater than 0")
    return float(value)


def validate_attendance(value):
    if isinstance(value, bool) or not isinstance(value, Real):
        raise ValueError("attendance must be an integer >= 1")
    if not math.isfinite(value) or value < 1 or int(value) != value:
        raise ValueError("attendance must be an integer >= 1")
    return int(value)


def validate_multiplier(value, name):
    if isinstance(value, bool) or not isinstance(value, Real):
        raise ValueError(f"{name} must be a finite real greater than 0")
    if not math.isfinite(value) or value <= 0:
        raise ValueError(f"{name} must be a finite real greater than 0")
    return float(value)


def _mtime_key(folder):
    names = ("items.csv", "meals.csv", "menu.csv")
    mtimes = tuple((folder / name).stat().st_mtime_ns for name in names)
    return (str(folder), mtimes)


def _read_csv(folder, name):
    with (folder / name).open(newline="") as handle:
        return list(csv.DictReader(handle))


def load(data_dir=None):
    folder = resolve_dir(data_dir)
    key = _mtime_key(folder)
    if key in _CACHE:
        return _CACHE[key]
    items = {}
    for row in _read_csv(folder, "items.csv"):
        items[row["item_id"]] = {
            "item_id": row["item_id"],
            "name": row["name"],
            "component": row["component"],
            "cost_per_serving": float(row["cost_per_serving"]),
            "allergens": [a for a in row["allergens"].split(";") if a],
            "prep_floor": int(row["prep_floor"]),
        }
    meals = []
    for row in _read_csv(folder, "meals.csv"):
        meals.append({
            "date": parse_date(row["date"]),
            "item_id": row["item_id"],
            "component": row["component"],
            "attendance": int(row["attendance"]),
            "servings_prepared": int(row["servings_prepared"]),
            "servings_taken": int(row["servings_taken"]),
            "cost_per_serving": float(row["cost_per_serving"]),
            "allergens": row["allergens"],
        })
    menu = [{"date": parse_date(r["date"]), "item_id": r["item_id"]} for r in _read_csv(folder, "menu.csv")]
    data = {"folder": folder, "key": key, "items": items, "meals": meals, "menu": menu}
    _CACHE[key] = data
    return data


def get_item(data, item_id):
    try:
        return data["items"][item_id]
    except KeyError as exc:
        raise UnknownItemError(f"unknown item: {item_id}") from exc


def rows_for_item(data, item_id, cutoff):
    return sorted((r for r in data["meals"] if r["item_id"] == item_id and r["date"] < cutoff), key=lambda r: r["date"])


def menu_for_date(data, target):
    return [r for r in data["menu"] if r["date"] == target]


def validate(data_dir=None):
    """Return plain-English data warnings without raising on bad rows."""
    folder = resolve_dir(data_dir)
    warnings = []

    def read(name):
        try:
            return _read_csv(folder, name)
        except Exception as exc:
            warnings.append(f"could not read {name}: {exc}")
            return []

    def as_int(value, label, row_number):
        try:
            return int(value)
        except (TypeError, ValueError):
            warnings.append(f"{label} on row {row_number} is not an integer")
            return None

    def as_float(value, label, row_number):
        try:
            return float(value)
        except (TypeError, ValueError):
            warnings.append(f"{label} on row {row_number} is not a number")
            return None

    item_rows = read("items.csv")
    item_ids = {row.get("item_id", "") for row in item_rows}
    for row_number, row in enumerate(item_rows, 2):
        item_cost = as_float(row.get("cost_per_serving"), "item cost_per_serving", row_number)
        prep_floor = as_int(row.get("prep_floor"), "item prep_floor", row_number)
        if item_cost is not None:
            if item_cost < 0:
                warnings.append(f"item row {row_number} has a negative cost_per_serving")
            elif item_cost <= 0:
                warnings.append(f"item row {row_number} has cost_per_serving <= 0")
        if prep_floor is not None and prep_floor < 0:
            warnings.append(f"item row {row_number} has a negative prep_floor")

    meal_rows = read("meals.csv")
    seen = set()
    components_by_day = {}
    for row_number, row in enumerate(meal_rows, 2):
        item_id = row.get("item_id", "")
        if item_id not in item_ids:
            warnings.append(f"meal row {row_number} has item_id {item_id!r} not in items.csv")

        raw_date = row.get("date", "")
        try:
            meal_date = parse_date(raw_date)
        except (TypeError, ValueError):
            warnings.append(f"meal row {row_number} has an invalid date")
            meal_date = None
        if meal_date is not None:
            key = (raw_date, item_id)
            if key in seen:
                warnings.append(f"duplicate meal row for date {raw_date} and item_id {item_id}")
            seen.add(key)
            components_by_day.setdefault(meal_date, set()).add(row.get("component", ""))

        attendance = as_int(row.get("attendance"), "attendance", row_number)
        prepared = as_int(row.get("servings_prepared"), "servings_prepared", row_number)
        taken = as_int(row.get("servings_taken"), "servings_taken", row_number)
        cost = as_float(row.get("cost_per_serving"), "cost_per_serving", row_number)
        numeric = (
            ("attendance", attendance),
            ("servings_prepared", prepared),
            ("servings_taken", taken),
            ("cost_per_serving", cost),
        )
        for label, value in numeric:
            if value is not None and value < 0:
                warnings.append(f"meal row {row_number} has a negative {label}")
        if cost is not None and cost == 0:
            warnings.append(f"meal row {row_number} has cost_per_serving <= 0")
        if taken is not None and prepared is not None and taken > prepared:
            warnings.append(f"meal row {row_number} has servings_taken greater than servings_prepared")
        if taken is not None and attendance is not None and taken > attendance:
            warnings.append(f"meal row {row_number} has servings_taken greater than attendance")
        expected_sold_out = "1" if taken is not None and prepared is not None and taken == prepared else "0"
        if str(row.get("sold_out") or "").strip() != expected_sold_out:
            warnings.append(f"meal row {row_number} sold_out does not match servings_taken == servings_prepared")

    expected_components = {"meat_alternate", "grain", "vegetable", "fruit", "milk"}
    for meal_date in sorted(components_by_day):
        missing = sorted(expected_components - components_by_day[meal_date])
        for component in missing:
            warnings.append(f"history day {meal_date.isoformat()} is missing meal component {component}")

    for row_number, row in enumerate(read("menu.csv"), 2):
        item_id = row.get("item_id", "")
        if item_id not in item_ids:
            warnings.append(f"menu row {row_number} has item_id {item_id!r} not in items.csv")
    return warnings
