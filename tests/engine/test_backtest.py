"""Tests for backtest and the weekly meter."""

import csv
from datetime import date, timedelta

import pytest

from engine import UnknownDateError, backtest, meter


ITEMS_HEADER = ["item_id", "name", "component", "cost_per_serving", "allergens", "prep_floor"]
MEALS_HEADER = [
    "date", "item_id", "component", "attendance", "servings_prepared",
    "servings_taken", "cost_per_serving", "allergens", "vote_share", "sold_out", "day_note",
]
MENU_HEADER = ["date", "item_id", "day_note"]


def write_fixture(tmp_path, rows):
    """Write only the three engine CSVs, using the contract's exact columns."""
    with (tmp_path / "items.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(ITEMS_HEADER)
        w.writerow(["soup", "Soup", "vegetable", "2.50", "", "0"])
    with (tmp_path / "meals.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(MEALS_HEADER)
        for d, prepared, taken, attendance, cost in rows:
            w.writerow([d, "soup", "vegetable", attendance, prepared, taken, cost, "", "0.5", int(taken == prepared), ""])
    with (tmp_path / "menu.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(MENU_HEADER)
        for d, *_ in rows:
            w.writerow([d, "soup", ""])


def heldout_rows():
    """Four weeks of history followed by four held-out dates."""
    rows = []
    start = date(2026, 9, 1)
    for i in range(8):
        d = start + timedelta(days=7 * i)
        rows.append((d.isoformat(), 200 + i, 80 + i * 5, 1000, "2.50"))
    return rows


def test_backtest_is_deterministic_and_totals_match_csv(tmp_path):
    """The held-out series and both arm aggregates match direct CSV arithmetic."""
    rows = heldout_rows()
    write_fixture(tmp_path, rows)

    first = backtest(weeks=4, ratio=3.0, data_dir=str(tmp_path))
    second = backtest(weeks=4, ratio=3.0, data_dir=str(tmp_path))
    assert first == second
    assert first["simulated"] is True
    assert first["weeks"] == 4
    assert [r["taken"] for r in first["series"]] == [r[2] for r in rows[4:]]

    # Compute the held-out window directly from meals.csv, independently of engine formulas.
    last = date.fromisoformat(rows[-1][0])
    start = last - timedelta(days=last.weekday()) - timedelta(days=21)
    held = [r for r in rows if date.fromisoformat(r[0]) >= start]
    usual_left = sum(max(0, r[1] - r[2]) for r in held)
    usual_short = sum(max(0, r[2] - r[1]) for r in held)
    usual_waste = round(sum(max(0, r[1] - r[2]) * float(r[4]) for r in held), 2)
    usual_miss = round(sum(abs(r[1] - r[2]) for r in held) / len(held), 2)
    usual = first["usual"]
    assert (usual["leftover_servings"], usual["servings_short"], usual["dollars_wasted"], usual["avg_miss"]) == (
        usual_left, usual_short, usual_waste, usual_miss
    )
    assert usual["servings_short"] == 0

    series = first["series"]
    cost_by_date = {r[0]: float(r[4]) for r in rows}
    lunch_left = sum(max(0, r["prep_lunchloop"] - r["taken"]) for r in series)
    lunch_short = sum(max(0, r["taken"] - r["prep_lunchloop"]) for r in series)
    lunch_miss = round(sum(abs(r["prep_lunchloop"] - r["taken"]) for r in series) / len(series), 2)
    lunch_waste = round(sum(max(0, r["prep_lunchloop"] - r["taken"]) * cost_by_date[r["date"]] for r in series), 2)
    assert first["lunchloop"] == {
        "leftover_servings": lunch_left,
        "servings_short": lunch_short,
        "dollars_wasted": lunch_waste,
        "avg_miss": lunch_miss,
    }
    assert first["leftover_cut_pct"] == round(100 * (usual_left - lunch_left) / usual_left, 1)
    assert usual_left - usual_short == sum(r[1] - r[2] for r in held)
    assert usual["leftover_servings"] - usual["servings_short"] == sum(r[1] - r[2] for r in held)
    assert first["lunchloop"]["leftover_servings"] - first["lunchloop"]["servings_short"] == sum(
        r["prep_lunchloop"] - r["taken"] for r in series
    )


def test_backtest_last_heldout_data_cannot_change_prep_values(tmp_path):
    original = tmp_path / "original"
    mutated = tmp_path / "mutated"
    original.mkdir()
    mutated.mkdir()
    rows = heldout_rows()
    write_fixture(original, rows)
    write_fixture(mutated, rows)
    expected = backtest(weeks=4, ratio=3.0, data_dir=str(original))["series"]

    changed = list(rows)
    last = changed[-1]
    changed[-1] = (last[0], last[1], 999, 9999, last[4])
    write_fixture(mutated, changed)
    actual = backtest(weeks=4, ratio=3.0, data_dir=str(mutated))["series"]
    expected_preps = {row["date"]: row["prep_lunchloop"] for row in expected}
    actual_preps = {row["date"]: row["prep_lunchloop"] for row in actual}
    assert actual_preps == expected_preps


def test_backtest_rejects_invalid_weeks(tmp_path):
    """Weeks must be an integer at least one, with bool excluded."""
    write_fixture(tmp_path, heldout_rows())
    for bad in (0, -1, 1.5, True):
        with pytest.raises(ValueError):
            backtest(weeks=bad, data_dir=str(tmp_path))


def test_meter_sums_latest_week_and_rejects_dates_before_series(tmp_path):
    """Meter savings are a direct sum over that week's backtest rows and costs."""
    rows = heldout_rows()
    write_fixture(tmp_path, rows)
    result = meter(date=rows[-1][0], data_dir=str(tmp_path))
    bt = backtest(data_dir=str(tmp_path))
    last = date.fromisoformat(rows[-1][0])
    week_start = last - timedelta(days=last.weekday())
    assert result["simulated"] is True
    assert result["week_start"] == week_start.isoformat()
    week = [r for r in bt["series"] if week_start.isoformat() <= r["date"] <= rows[-1][0]]
    saved = [
        max(0, r["prep_usual"] - r["taken"])
        - max(0, r["prep_lunchloop"] - r["taken"])
        for r in week
    ]
    assert result["servings_saved"] == sum(saved)
    cost_by_date = {r[0]: float(r[4]) for r in rows}
    assert result["dollars_saved"] == round(sum(x * cost_by_date[r["date"]] for x, r in zip(saved, week)), 2)
    with pytest.raises(UnknownDateError):
        meter(date="2020-01-01", data_dir=str(tmp_path))

