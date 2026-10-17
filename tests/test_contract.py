"""Checks that a data folder matches docs/backend-contract.md.

Runs on data/sample always, and on data/ once the full dataset exists.
"""

import csv
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
COMPONENTS = {"meat_alternate", "grain", "vegetable", "fruit", "milk"}
ALLERGENS = {"milk", "egg", "fish", "shellfish", "tree_nuts", "peanuts", "wheat", "soybeans", "sesame"}
MEALS_COLS = ["date", "item_id", "component", "attendance", "servings_prepared", "servings_taken",
              "cost_per_serving", "allergens", "vote_share", "sold_out", "day_note"]
HISTORY_END = "2026-10-16"

DIRS = [ROOT / "data" / "sample"]
if (ROOT / "data" / "meals.csv").exists():
    DIRS.append(ROOT / "data")


def read(d, name):
    with open(d / name, newline="") as f:
        return list(csv.DictReader(f))


@pytest.mark.parametrize("d", DIRS, ids=lambda p: p.name)
def test_items(d):
    items = read(d, "items.csv")
    ids = [r["item_id"] for r in items]
    assert len(ids) == len(set(ids))
    for r in items:
        assert r["component"] in COMPONENTS
        assert set(filter(None, r["allergens"].split(";"))) <= ALLERGENS
        assert float(r["cost_per_serving"]) > 0
        assert int(r["prep_floor"]) >= 0
    assert {r["component"] for r in items} == COMPONENTS


@pytest.mark.parametrize("d", DIRS, ids=lambda p: p.name)
def test_meals(d):
    items = {r["item_id"]: r for r in read(d, "items.csv")}
    with open(d / "meals.csv", newline="") as f:
        assert next(csv.reader(f)) == MEALS_COLS
    for r in read(d, "meals.csv"):
        assert r["date"] <= HISTORY_END
        assert r["item_id"] in items
        assert r["component"] == items[r["item_id"]]["component"]
        assert r["allergens"] == items[r["item_id"]]["allergens"]
        prepared, taken = int(r["servings_prepared"]), int(r["servings_taken"])
        assert 0 <= taken <= prepared
        assert r["sold_out"] == str(int(taken == prepared))


@pytest.mark.parametrize("d", DIRS, ids=lambda p: p.name)
def test_future_menu_and_votes(d):
    items = {r["item_id"] for r in read(d, "items.csv")}
    assert all(r["date"] > HISTORY_END for r in read(d, "future_meals.csv"))
    menu_dates = {r["date"] for r in read(d, "menu.csv")}
    assert "2026-10-19" in menu_dates
    for r in read(d, "vote_options.csv"):
        assert r["target_date"] > r["open_date"]
        assert {r["option_1"], r["option_2"], r["option_3"]} <= items
