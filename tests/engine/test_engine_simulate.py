"""Check simulate outputs, expected leftovers, cost scaling, and multiplier validation."""

import csv
import math
from datetime import date, timedelta
from pathlib import Path
from statistics import NormalDist

import numpy as np
import pytest

from engine import forecast, prep_list, simulate


ITEMS_HEADER = ["item_id", "name", "component", "cost_per_serving", "allergens", "prep_floor"]
MEALS_HEADER = [
    "date", "item_id", "component", "attendance", "servings_prepared",
    "servings_taken", "cost_per_serving", "allergens", "vote_share", "sold_out", "day_note",
]
MENU_HEADER = ["date", "item_id", "day_note"]


def _write_csv(path: Path, header, rows):
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=header)
        writer.writeheader()
        writer.writerows(rows)


def _fixture(tmp_path: Path):
    """Make a tiny, self-contained history with a Monday target and exact schemas."""
    _write_csv(
        tmp_path / "items.csv",
        ITEMS_HEADER,
        [{
            "item_id": "stew", "name": "Bean stew", "component": "meat_alternate",
            "cost_per_serving": "1.25", "allergens": "soybeans", "prep_floor": "0",
        }],
    )
    values = [50, 60, 40, 50, 60, 40]
    rows = []
    first = date(2026, 9, 14)
    for index, taken in enumerate(values):
        day = first + timedelta(days=7 * index)
        rows.append({
            "date": day.isoformat(), "item_id": "stew", "component": "meat_alternate",
            "attendance": "100", "servings_prepared": str(max(100, taken)),
            "servings_taken": str(taken), "cost_per_serving": "1.25", "allergens": "soybeans",
            "vote_share": "", "sold_out": "0", "day_note": "",
        })
    _write_csv(tmp_path / "meals.csv", MEALS_HEADER, rows)
    _write_csv(
        tmp_path / "menu.csv",
        MENU_HEADER,
        [{"date": "2026-10-19", "item_id": "stew", "day_note": ""}],
    )
    return tmp_path


def test_simulate_price_multiplier_scales_cost_without_changing_prep(tmp_path):
    data_dir = _fixture(tmp_path)
    base = simulate("2026-10-19", ratio=1.0, data_dir=str(data_dir))
    doubled = simulate("2026-10-19", ratio=1.0, price_multiplier=2.0, data_dir=str(data_dir))
    direct = prep_list("2026-10-19", ratio=1.0, data_dir=str(data_dir))

    assert [item["prep"] for item in doubled["items"]] == [item["prep"] for item in base["items"]]
    assert [item["prep"] for item in base["items"]] == [item["prep"] for item in direct["items"]]
    assert doubled["totals"]["food_cost"] == pytest.approx(2 * base["totals"]["food_cost"], abs=0.01)
    assert doubled["items"][0]["cost_per_serving"] == pytest.approx(2.50, abs=0.01)
    assert doubled["totals"]["expected_waste_cost"] == pytest.approx(
        2 * base["totals"]["expected_waste_cost"], abs=0.01
    )


def test_simulate_expected_leftover_matches_normal_monte_carlo(tmp_path):
    data_dir = _fixture(tmp_path)
    # ratio=1 gives service level 0.5, z=0, so prep is exactly predicted.
    expected_forecast = forecast("stew", "2026-10-19", ratio=1.0, data_dir=str(data_dir))
    assert expected_forecast["prep"] == expected_forecast["predicted"]
    assert expected_forecast["sigma"] > 0

    result = simulate("2026-10-19", ratio=1.0, data_dir=str(data_dir))
    sigma = expected_forecast["sigma"]
    analytic = sigma * NormalDist().pdf(0.0)

    # Monte Carlo check: sample demand from Normal(predicted, sigma).
    rng = np.random.default_rng(1234)
    demand = rng.normal(expected_forecast["predicted"], sigma, size=200_000)
    monte_carlo = np.maximum(0, expected_forecast["prep"] - demand).mean()
    assert monte_carlo == pytest.approx(analytic, rel=0.01)
    # The public result is rounded to one decimal place by the contract.
    assert result["totals"]["expected_leftover_servings"] == pytest.approx(analytic, abs=0.05)


@pytest.mark.parametrize("field", ["attendance_multiplier", "price_multiplier"])
@pytest.mark.parametrize("value", [0, -1, math.nan, math.inf, True])
def test_simulate_rejects_bad_multipliers(tmp_path, field, value):
    data_dir = _fixture(tmp_path)
    kwargs = {field: value}
    with pytest.raises(ValueError):
        simulate("2026-10-19", data_dir=str(data_dir), **kwargs)

