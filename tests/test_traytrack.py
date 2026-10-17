"""pytest suite for the forecast, buffers, cost accounting and held-out evaluation.

Run from the repo root:  python -m pytest
Hand-calculated cases and limiting cases on purpose, so these don't just restate the code.
"""
import math

import pandas as pd
import pytest

from prediction import (load_data, predict_demand, service_level, newsvendor_buffer,
                        calculate_costs, expected_costs, evaluate_methods, mae_report,
                        split_dates, compute_data_driven_buffers, TEST_DAYS, USE_WEEKDAY_SHRINK)


@pytest.fixture(scope="module")
def df():
    return load_data()


@pytest.fixture(scope="module")
def evaluation(df):
    return evaluate_methods(df)


def make_history(served, attendance=400, start="2026-09-07"):
    n = len(served)
    out = pd.DataFrame({"date": pd.bdate_range(start, periods=n), "food_item": ["X"] * n,
                        "food_category": ["main"] * n, "attendance": [attendance] * n,
                        "quantity_served": served, "unit_cost": [1.0] * n})
    out["quantity_prepared"] = out["quantity_served"] + 10
    out["quantity_leftover"] = 10
    return out


# ---- forecast ------------------------------------------------------------------

def test_identical_days_forecast_equals_that_day():
    # Limiting case: if every day is the same, the forecast must equal that day, any weekday.
    hist = make_history([100] * 20)
    for day in ["2026-10-05", "2026-10-09"]:  # a Monday and a Friday
        assert predict_demand(hist, "X", "main", 400, target_date=day)["predicted_demand"] == 100


def test_forecast_scales_with_attendance():
    hist = make_history([100] * 20)
    assert predict_demand(hist, "X", "main", 200, target_date="2026-10-05")["predicted_demand"] == 50


def test_weekday_candidate_hand_calc():
    # The (not shipped) weekday candidate. 10 weekdays: Fridays (2) serve 200, others 100.
    served = [200 if d.weekday() == 4 else 100 for d in pd.bdate_range("2026-09-07", periods=10)]
    hist = make_history(served)
    overall = sum(served) / (400 * 10)          # 0.3
    weight = 2 / (2 + 4)                        # 2 past Fridays, k = 4
    expected = round((weight * 0.5 + (1 - weight) * overall) * 400)  # 133
    assert predict_demand(hist, "X", "main", 400, target_date="2026-09-25",
                          weekday_shrink=True)["predicted_demand"] == expected
    # Shipped forecast is the all-time average: 0.3 x 400 = 120, whatever the weekday.
    assert predict_demand(hist, "X", "main", 400, target_date="2026-09-25")["predicted_demand"] == 120


def test_forecast_ship_gate(df):
    # Only a forecast change that beats the baseline on held-out test data may ship.
    r = mae_report(df)
    assert USE_WEEKDAY_SHRINK == r["new_beats_old_on_test"] == r["candidate_adopted"]
    if not USE_WEEKDAY_SHRINK:
        assert r["shipped_mae_servings_per_day"] == r["old_method"]["overall_mae_servings_per_day"]


# ---- buffers -------------------------------------------------------------------

def test_service_level_matches_cost_model():
    assert service_level(3.0) == pytest.approx(2 / 3)
    assert service_level(1.0) == 0.0   # a shortage costs no more than the food it saves
    assert service_level(0.5) == 0.0


def test_newsvendor_buffer_is_quantile_with_floors():
    errors = [i / 100 for i in range(-10, 31)]   # -10% .. +30%
    assert newsvendor_buffer(errors, "main", 2.0) == pytest.approx(0.10)    # median
    assert newsvendor_buffer(errors, "main", 1.0) == 0.0                     # never below forecast
    assert newsvendor_buffer(errors, "fruit", 1.0) == pytest.approx(0.10)   # protected floor
    assert newsvendor_buffer([1.0] * 20, "main", 3.0) == pytest.approx(0.40)  # cap


def test_buffers_grow_with_shortage_penalty(df):
    low, high = compute_data_driven_buffers(df, 1.5), compute_data_driven_buffers(df, 5.0)
    assert all(high[i]["buffer"] >= low[i]["buffer"] for i in low)


# ---- cost accounting ------------------------------------------------------------

def test_costs_hand_calc_both_sides_same_demand():
    # demand 100, TrayTrack prep 95, usual 120, $1/serving, shortage = 3x.
    c = calculate_costs(100, 95, 1.0, baseline_prep=120, shortage_penalty_multiplier=3.0)
    assert (c["estimated_surplus"], c["estimated_shortage"]) == (0, 5)
    assert c["estimated_total_cost"] == 95 + 15
    assert (c["baseline_surplus"], c["baseline_shortage"]) == (20, 0)
    assert c["baseline_total_cost"] == 120
    assert c["estimated_savings_vs_baseline"] == 10


@pytest.mark.parametrize("demand,prep,base", [(100, 80, 130), (100, 130, 80), (0, 10, 0), (50, 50, 50)])
def test_no_double_counting(demand, prep, base):
    c = calculate_costs(demand, prep, 2.0, baseline_prep=base, shortage_penalty_multiplier=2.5)
    for p in ("estimated", "baseline"):
        served = c[f"{p}_served"]
        surplus = c["estimated_surplus" if p == "estimated" else "baseline_surplus"]
        shortage = c["estimated_shortage" if p == "estimated" else "baseline_shortage"]
        prep_cost = c[f"{p}_preparation_cost"]
        assert served + surplus == (prep if p == "estimated" else base)
        assert served + shortage == demand
        assert c[f"{p}_surplus_cost"] <= prep_cost          # surplus is INSIDE food cost
        assert c[f"{p}_total_cost"] == pytest.approx(prep_cost + c[f"{p}_shortage_cost"])


def test_expected_costs_hand_calc():
    # forecast 100, prep 100, errors -10% / +10% -> demands 90 and 110.
    c = expected_costs(100, 100, 1.0, baseline_prep=100, shortage_penalty_multiplier=3.0,
                       rel_errors=[-0.1, 0.1])
    assert c["estimated_surplus"] == 5 and c["estimated_shortage"] == 5
    assert c["estimated_total_cost"] == 100 + 0.5 * 10 * 3
    assert c["estimated_savings_vs_baseline"] == 0
    assert expected_costs(100, 110, 1.0)["cost_basis"] == "point_forecast"


# ---- held-out evaluation -----------------------------------------------------------

def test_split_is_ordered_and_disjoint(df):
    s = split_dates(df)
    assert max(s["warmup"]) < min(s["validation"]) and max(s["validation"]) < min(s["test"])
    assert len(s["test"]) == TEST_DAYS
    assert max(s["test"]) == df["date"].max()


def test_headline_is_test_window_only(evaluation, df):
    test_rows = [r for r in evaluation["daily"] if r["split"] == "test"]
    o = evaluation["overall"]
    assert o["n"] == len(test_rows) == evaluation["evaluated_predictions"]
    assert o["window_start"] == str(min(split_dates(df)["test"]).date())
    assert o["estimated_savings_vs_baseline"] == pytest.approx(o["baseline_total_cost"] - o["lunchloop_total_cost"], abs=0.01)
    assert o["baseline_total_cost"] == pytest.approx(o["baseline_food_cost"] + o["baseline_shortage_cost"], abs=0.01)
    assert o["lunchloop_total_cost"] == pytest.approx(o["lunchloop_food_cost"] + o["lunchloop_shortage_cost"], abs=0.01)


def test_rows_scored_against_actual_served(evaluation):
    for r in evaluation["daily"]:
        assert r["estimated_served"] + r["estimated_surplus"] == r["recommended_prep"]
        assert r["estimated_served"] + r["estimated_shortage"] == r["actual_served"]
        assert r["baseline_served"] + r["baseline_shortage"] == r["actual_served"]
        # plate waste is reported, never priced
        assert r["estimated_total_cost"] == pytest.approx(r["estimated_preparation_cost"] + r["estimated_shortage_cost"])


def test_no_future_leakage(df, evaluation):
    # Truncating the data after a cutoff must not change any earlier day's forecast, buffer,
    # prep or baseline. If it did, later rows would be leaking backward in time.
    cutoff = sorted(df["date"].unique())[25]
    trunc = evaluate_methods(df[df["date"] <= cutoff])
    cut = str(pd.Timestamp(cutoff).date())
    full = {(r["date"], r["food_item"]): r for r in evaluation["daily"] if r["date"] <= cut}
    part = {(r["date"], r["food_item"]): r for r in trunc["daily"]}
    assert full.keys() == part.keys() and full
    for k, r in full.items():
        for col in ("predicted_demand", "buffer_used", "recommended_prep", "baseline_prep"):
            assert r[col] == part[k][col], (k, col)


def test_penalties_1x_3x_5x_trade_surplus_for_shortage(df):
    runs = [evaluate_methods(df, shortage_penalty_multiplier=m)["overall"] for m in (1.0, 3.0, 5.0)]
    shortages = [o["estimated_shortage_servings"] for o in runs]
    surpluses = [o["estimated_surplus_servings"] for o in runs]
    assert shortages == sorted(shortages, reverse=True)
    assert surpluses == sorted(surpluses)
    # The usual amount doesn't depend on the multiplier's buffer, only its shortage price.
    assert len({o["baseline_surplus_servings"] for o in runs}) == 1


def test_buffer_rule_comparison_is_consistent(evaluation):
    o, rules = evaluation["overall"], evaluation["buffer_rules"]["test"]
    assert rules["newsvendor_shipped"]["total_cost"] == pytest.approx(o["lunchloop_total_cost"], abs=0.05)
    assert rules["usual_amount"]["total_cost"] == pytest.approx(o["baseline_total_cost"], abs=0.05)
    assert rules["newsvendor_shipped"]["shortage_servings"] == o["estimated_shortage_servings"]
    # More buffer can only mean fewer shortages on the same forecast.
    assert rules["no_buffer"]["shortage_servings"] >= rules["newsvendor_shipped"]["shortage_servings"]


def test_accuracy_report_is_honest_about_the_comparison(df):
    r = mae_report(df)
    diff = r["new_method"]["overall_mae_servings_per_day"] - r["old_method"]["overall_mae_servings_per_day"]
    assert r["new_minus_old_mae"] == pytest.approx(diff, abs=0.02)
    assert r["new_beats_old_on_test"] == (r["new_minus_old_mae"] < 0)
    lo, hi = r["new_minus_old_mae_95ci"]
    assert lo <= r["new_minus_old_mae"] <= hi
    assert r["validation"]["end"] < r["window"]["test_start"]


# ---- API ----------------------------------------------------------------------------

@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient
    from app import app
    return TestClient(app)


def test_api_labels_synthetic(client):
    assert client.post("/plan", json={"expected_attendance": 400}).json()["synthetic_data"] is True
    assert client.get("/evaluate").json()["synthetic_data"] is True
    html = client.get("/").text
    assert "Simulated school" in html and "Held-out test" in html


@pytest.mark.parametrize("bad", [0, -1])
def test_api_rejects_nonpositive_multiplier(client, bad):
    assert client.post("/plan", json={"expected_attendance": 400, "shortage_penalty_multiplier": bad}).status_code == 422
    assert client.get("/evaluate", params={"shortage_penalty_multiplier": bad}).status_code == 422


def test_api_buffers_follow_multiplier(client):
    lo = client.post("/plan", json={"expected_attendance": 400, "shortage_penalty_multiplier": 1.5}).json()
    hi = client.post("/plan", json={"expected_attendance": 400, "shortage_penalty_multiplier": 5.0}).json()
    for a, b in zip(lo["items"], hi["items"]):
        assert b["buffer_used"] >= a["buffer_used"]
        assert a["cost_basis"].startswith("expected_over_")
