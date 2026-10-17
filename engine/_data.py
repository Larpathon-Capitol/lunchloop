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
