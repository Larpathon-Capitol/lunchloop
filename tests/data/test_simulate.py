"""Checks the full simulated dataset in data/ against the generator's spec.

These tests read the CSVs and run data/simulate.py as a script. They don't import
its code, so the expected values below are written out on purpose.
"""

import csv
import os
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
FILES = ["items.csv", "meals.csv", "future_meals.csv", "menu.csv", "vote_options.csv"]
COMPONENTS = {"meat_alternate", "grain", "vegetable", "fruit", "milk"}
RING = ["cheese_pizza", "beef_nachos", "chicken_nuggets", "cheeseburger", "popcorn_chicken", "spicy_chicken_sandwich"]  # mirrors data/sources.md
RATES = {"cheese_pizza": .346, "beef_nachos": .200, "chicken_nuggets": .234, "cheeseburger": .300, "popcorn_chicken": .199, "spicy_chicken_sandwich": .235, "dinner_roll": .420, "brown_rice": .150, "steamed_carrots": .295, "broccoli": .180, "fruit_cup": .433, "mandarin_oranges": .150, "chocolate_milk": .308, "milk_1pct": .140}  # mirrors data/sources.md
FLOORS = {"cheese_pizza": 0, "beef_nachos": 0, "chicken_nuggets": 0, "cheeseburger": 0, "popcorn_chicken": 0, "spicy_chicken_sandwich": 0, "dinner_roll": 0, "brown_rice": 0, "steamed_carrots": 120, "broccoli": 80, "fruit_cup": 150, "mandarin_oranges": 70, "chocolate_milk": 0, "milk_1pct": 0}  # mirrors data/sources.md
HOLIDAYS = {"2026-01-19", "2026-02-16", *{f"2026-03-{d:02d}" for d in range(16, 21)}, "2026-04-03", *{(date(2026, 5, 23) + timedelta(days=i)).isoformat() for i in range((date(2026, 8, 23) - date(2026, 5, 23)).days + 1)}, "2026-09-07", "2026-10-12"}  # mirrors data/sources.md

ITEM_ROWS = [  # mirrors data/sources.md
    ("cheese_pizza", "meat_alternate", "0.85", "milk;wheat", "0"),
    ("beef_nachos", "meat_alternate", "0.90", "milk;wheat", "0"),
    ("chicken_nuggets", "meat_alternate", "0.70", "wheat", "0"),
    ("cheeseburger", "meat_alternate", "1.05", "milk;soybeans;wheat", "0"),
    ("popcorn_chicken", "meat_alternate", "0.58", "wheat;soybeans", "0"),
    ("spicy_chicken_sandwich", "meat_alternate", "0.95", "soybeans;wheat", "0"),
    ("dinner_roll", "grain", "0.18", "wheat", "0"),
    ("brown_rice", "grain", "0.15", "", "0"),
    ("steamed_carrots", "vegetable", "0.25", "", "120"),
    ("broccoli", "vegetable", "0.28", "", "80"),
    ("fruit_cup", "fruit", "0.40", "", "150"),
    ("mandarin_oranges", "fruit", "0.35", "", "70"),
    ("chocolate_milk", "milk", "0.40", "milk", "0"),
    ("milk_1pct", "milk", "0.30", "milk", "0"),
]
PRE_BREAK = {"2026-01-16", "2026-02-13", "2026-03-13", "2026-04-02", "2026-05-22", "2026-09-04", "2026-10-09"}  # mirrors data/sources.md
NOTE_DATES = {"early_release": {"2026-02-26", "2026-05-21", "2026-09-24", "2026-11-06"}, "testing": {"2026-04-07", "2026-04-08", "2026-05-12", "2026-10-14"}, "rainy": {"2026-02-10", "2026-08-27", "2026-09-03", "2026-09-16", "2026-10-01", "2026-10-22"}}  # mirrors data/sources.md


def read_rows(folder, name):
    with (folder / name).open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def generate(out, seed):
    env = os.environ.copy()
    env["PYTHONHASHSEED"] = str(seed)
    return subprocess.run([sys.executable, "data/simulate.py", "--out", str(out)], cwd=ROOT, env=env, check=True, capture_output=True, text=True)


@pytest.fixture(scope="session")
def generated(tmp_path_factory):
    first = tmp_path_factory.mktemp("simulate_first")
    second = tmp_path_factory.mktemp("simulate_second")
    generate(first, 0)
    generate(second, 1)
    return first, second


@pytest.fixture(scope="session")
def data(generated):
    folder, _ = generated
    return {name: read_rows(folder, name) for name in FILES}


def school_days(start, end):
    d = date.fromisoformat(start)
    stop = date.fromisoformat(end)
    while d <= stop:
        s = d.isoformat()
        if d.weekday() < 5 and s not in HOLIDAYS:
            yield s
        d += timedelta(days=1)


def test_deterministic_outputs_and_committed_data(generated):
    first, second = generated
    for name in FILES:
        assert (first / name).read_bytes() == (second / name).read_bytes(), f"{name} changed between deterministic runs"
    committed = ROOT / "data"
    if not (committed / "meals.csv").exists():
        pytest.skip("committed data/meals.csv is not present yet")
    for name in FILES:
        assert (committed / name).read_bytes() == (first / name).read_bytes(), f"committed {name} differs from a fresh run"


def test_calendar(data):
    history_dates = sorted({r["date"] for r in data["meals.csv"]})
    future_dates = sorted({r["date"] for r in data["future_meals.csv"]})
    assert len(history_dates) >= 90, "history has too few distinct dates"
    assert history_dates[0] == "2026-01-12", "history starts on the wrong date"
    assert history_dates[-1] == "2026-10-16", "history ends on the wrong date"
    assert all(date.fromisoformat(x).weekday() < 5 and x not in HOLIDAYS for x in history_dates), "history contains a weekend or holiday"
    assert history_dates == list(school_days("2026-01-12", "2026-10-16")), "history is missing a non-holiday weekday"
    assert future_dates[0] == "2026-10-19" and len(future_dates) >= 10, "future calendar is too short or starts late"
    assert all(date.fromisoformat(x).weekday() < 5 and x not in HOLIDAYS for x in future_dates), "future contains a weekend or holiday"


def test_attendance(data):
    rows = data["meals.csv"]
    by_date = {}
    for r in rows:
        by_date.setdefault(r["date"], set()).add(int(r["attendance"]))
    assert all(len(v) == 1 for v in by_date.values()), "attendance differs within a date"
    vals = [next(iter(v)) for v in by_date.values()]
    assert all(850 <= x <= 1200 for x in vals), "attendance falls outside the allowed range"
    assert .89 <= sum(vals) / len(vals) / 1200 <= .94, "mean attendance rate is outside the spec range"
    note_free = {d for d in by_date if not next(r["day_note"] for r in rows if r["date"] == d)}
    def avg(ds): return sum(next(iter(by_date[d])) for d in ds) / len(ds)
    assert avg({d for d in note_free if date.fromisoformat(d).weekday() == 0}) <= avg({d for d in note_free if date.fromisoformat(d).weekday() in (1, 2, 3)}) * .995, "note-free Monday attendance is not lower"
    assert avg({d for d in note_free if date.fromisoformat(d).weekday() == 4}) <= avg({d for d in note_free if date.fromisoformat(d).weekday() in (1, 2, 3)}) * .995, "note-free Friday attendance is not lower"
    pre = avg(PRE_BREAK & set(by_date)); nf = avg(note_free)
    assert pre <= nf * .97, "pre-break attendance is not at least 3 percent lower"


def test_take_rates(data):
    rows = [r for r in data["meals.csv"] if not r["day_note"]]
    for item, rate in RATES.items():
        vals = [int(r["servings_taken"]) / int(r["attendance"]) for r in rows if r["item_id"] == item]
        assert vals, f"no note-free history rows for {item}"
        actual = sum(vals) / len(vals)
        assert abs(actual - rate) / rate <= .10, f"{item} take rate misses its spec rate"
    cp = [r for r in rows if r["item_id"] == "cheese_pizza"]
    fri = sum(int(r["servings_taken"]) / int(r["attendance"]) for r in cp if date.fromisoformat(r["date"]).weekday() == 4) / len([r for r in cp if date.fromisoformat(r["date"]).weekday() == 4])
    mt = [r for r in cp if date.fromisoformat(r["date"]).weekday() != 4]
    other = sum(int(r["servings_taken"]) / int(r["attendance"]) for r in mt) / len(mt)
    assert fri >= 1.08 * other, "Friday cheese pizza demand is not high enough"


def test_items(data):
    rows = data["items.csv"]
    assert [(r["item_id"], r["component"], r["cost_per_serving"], r["allergens"], r["prep_floor"]) for r in rows] == ITEM_ROWS, "items.csv rows differ from the spec (ids, order, costs, allergens or floors)"
    assert 12 <= len(rows) <= 15, "item count is outside the allowed range"
    assert {r["component"] for r in rows} == COMPONENTS, "items do not cover all components"
    ids = {r["item_id"] for r in rows}
    assert {"cheese_pizza", "chicken_nuggets", "popcorn_chicken", "chocolate_milk", "fruit_cup", "steamed_carrots"} <= ids, "Ekansh's required item ids are missing"
    for r in rows:
        floor = int(r["prep_floor"])
        if r["component"] in {"fruit", "vegetable"}:
            assert floor > 0, f"{r['item_id']} has no positive produce floor"
        else:
            assert floor == 0, f"{r['item_id']} has a nonzero non-produce floor"


def test_menu(data):
    meals = data["meals.csv"] + data["future_meals.csv"]
    menu = data["menu.csv"]
    assert [(r["date"], r["item_id"], r["day_note"]) for r in menu] == [(r["date"], r["item_id"], r["day_note"]) for r in meals], "menu rows do not mirror meal rows"
    dates = sorted({r["date"] for r in menu})
    for d in dates:
        rs = [r for r in menu if r["date"] == d]
        assert len([r for r in rs if r["item_id"] in RING]) == 3, f"{d} does not have exactly three entrees"
        assert {r["item_id"] for r in rs} >= {"dinner_roll", "steamed_carrots", "fruit_cup", "chocolate_milk", "milk_1pct"}, f"{d} is missing a required daily item"
        assert len([r for r in rs if r["item_id"] in {"chocolate_milk", "milk_1pct"}]) >= 2, f"{d} has fewer than two milk rows"
        assert len({r["item_id"] for r in rs}) == len(rs), f"{d} repeats an item"


def test_engine_safety(data):
    hist = data["meals.csv"]
    allrows = hist + data["future_meals.csv"]
    for r in allrows:
        assert int(r["servings_prepared"]) > 0 and int(r["attendance"]) > 0, "prepared servings or attendance is zero"
        if r["item_id"] in FLOORS:
            assert int(r["servings_prepared"]) >= FLOORS[r["item_id"]], f"{r['item_id']} is below its prep floor"
    for r in allrows:
        if r["date"] >= "2026-09-21":
            wd = date.fromisoformat(r["date"]).weekday()
            earlier = [x for x in hist if x["item_id"] == r["item_id"] and date.fromisoformat(x["date"]).weekday() == wd and x["date"] < r["date"]]
            assert len(earlier) >= 3, f"{r['item_id']} lacks three earlier same-weekday history rows"
    for r in data["future_meals.csv"]:
        assert len([x for x in hist if x["item_id"] == r["item_id"]]) >= 20, f"{r['item_id']} lacks twenty history rows"


def test_sold_out(data):
    hist = data["meals.csv"]
    overall = sum(r["sold_out"] == "1" for r in hist) / len(hist)
    assert .02 <= overall <= .25, "overall sold-out share is outside the allowed range"
    for item in {r["item_id"] for r in hist}:
        share = sum(r["sold_out"] == "1" for r in hist if r["item_id"] == item) / len([r for r in hist if r["item_id"] == item])
        assert share <= .40, f"{item} is sold out too often"


def test_day_notes(data):
    rows = data["meals.csv"] + data["future_meals.csv"]
    history = data["meals.csv"]
    allowed = {"early_release", "testing", "rainy", "pre_break", ""}
    by_date = {}
    for r in rows:
        by_date.setdefault(r["date"], set()).add(r["day_note"])
    assert all(v <= allowed and len(v) == 1 for v in by_date.values()), "day notes are invalid or inconsistent within a date"
    for kind in ("early_release", "testing", "rainy", "pre_break"):
        assert sum(kind in {r["day_note"] for r in history if r["date"] == d} for d in {r["date"] for r in history}) >= 2, f"too few {kind} dates"
    assert {d for d, v in by_date.items() if "pre_break" in v} == PRE_BREAK, "pre-break dates do not match the spec"
    assert {d for d, v in by_date.items() if "early_release" in v} == NOTE_DATES["early_release"], "early-release dates do not match the spec"
    assert {d for d, v in by_date.items() if "rainy" in v} == NOTE_DATES["rainy"], "rainy dates do not match the spec"


def test_votes(data):
    hist = data["meals.csv"]
    thursdays = {r["date"] for r in hist if date.fromisoformat(r["date"]).weekday() == 3}
    nonempty = [r for r in hist if r["vote_share"]]
    assert all(r["item_id"] in RING and date.fromisoformat(r["date"]).weekday() == 3 and 1/3 <= float(r["vote_share"]) <= 1 for r in nonempty), "vote shares appear on invalid rows"
    assert {r["date"] for r in nonempty} == thursdays and len(nonempty) == len(thursdays), "there is not exactly one vote winner per history Thursday"
    assert all(not r["vote_share"] for r in data["future_meals.csv"]), "future rows contain vote shares"
    items = {r["item_id"] for r in data["items.csv"]}
    menu = data["menu.csv"]
    for r in data["vote_options.csv"]:
        assert (r["target_slot"], r["option_1"], r["option_2"], r["option_3"]) == ("entree", "beef_nachos", "cheeseburger", "spicy_chicken_sandwich"), "vote options differ from the spec"
        assert len({r["option_1"], r["option_2"], r["option_3"]}) == 3 and {r["option_1"], r["option_2"], r["option_3"]} <= items, "vote options are not three known distinct items"
        assert r["open_date"] >= "2026-10-19" and r["target_date"] > r["open_date"] and (date.fromisoformat(r["target_date"]) - date.fromisoformat(r["open_date"])).days >= 7, "vote option dates violate the voting window"
        assert date.fromisoformat(r["target_date"]).weekday() == 3, "vote target is not a Thursday"
        served = {x["item_id"] for x in menu if x["date"] == r["target_date"]}
        assert len(served & {r["option_1"], r["option_2"], r["option_3"]}) == 1, "vote target menu does not contain exactly one option"


def test_called_it_unique(data):
    for d in sorted({r["date"] for r in data["future_meals.csv"]}):
        vals = [int(r["servings_taken"]) for r in data["future_meals.csv"] if r["date"] == d and r["item_id"] in RING]
        assert vals and vals.count(max(vals)) == 1, f"future meat alternate maximum is tied on {d}"


def test_usual_policy_leftovers(data):
    rows = data["meals.csv"]
    pct = sum(int(r["servings_prepared"]) - int(r["servings_taken"]) for r in rows) / sum(int(r["servings_prepared"]) for r in rows)
    assert .08 <= pct <= .18, "history leftover percentage is outside the allowed range"


def test_fair_signal(data):
    hist = data["meals.csv"]
    target = [r for r in hist if "2026-09-21" <= r["date"] <= "2026-10-16"]
    error = 0
    waste = 0
    for r in target:
        wd = date.fromisoformat(r["date"]).weekday()
        prior = [x for x in hist if x["item_id"] == r["item_id"] and date.fromisoformat(x["date"]).weekday() == wd and x["date"] < r["date"]][-4:]
        assert len(prior) == 4, f"{r['item_id']} lacks four baseline rows for {r['date']}"
        baseline = round(sum(int(x["servings_taken"]) / int(x["attendance"]) for x in prior) / 4 * int(r["attendance"]))
        error += abs(baseline - int(r["servings_taken"]))
        waste += int(r["servings_prepared"]) - int(r["servings_taken"])
    assert error < waste, f"fair baseline error {error} is not below kitchen waste {waste}"
