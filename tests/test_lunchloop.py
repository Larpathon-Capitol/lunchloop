"""pytest suite for the forecast, buffers, cost accounting and held-out evaluation.

Run from the repo root:  python -m pytest
Hand-calculated cases and limiting cases on purpose, so these don't just restate the code.
"""
import math

import pandas as pd
import pytest

from prediction import (load_data, predict_demand, service_level, newsvendor_buffer,
                        calculate_costs, expected_costs, evaluate_methods, mae_report,
                        split_dates, compute_data_driven_buffers, TEST_DAYS, USE_WEEKDAY_SHRINK,
                        RECENT_WINDOW_DAYS, DEFAULT_BUFFER_RULE, safety_buffer, validate_history)


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


def test_weekday_factor_hand_calc():
    # 10 weekdays (2 Fridays serve 200, the rest 100), attendance 400, so every window sees
    # all 10 days: base 0.3. Friday ratio 0.5/0.3 = 1.667, weight 2/(2+4) = 1/3,
    # factor = 1/3 x 1.667 + 2/3 = 1.222 -> 0.3 x 1.222 x 400 = 146.67 -> 147.
    served = [200 if d.weekday() == 4 else 100 for d in pd.bdate_range("2026-09-07", periods=10)]
    hist = make_history(served)
    p = predict_demand(hist, "X", "main", 400, target_date="2026-09-25")   # a Friday
    assert p["predicted_demand"] == 147 and p["method"].endswith("_weekday")
    # Monday: 2 past Mondays at 100 -> share 0.25, ratio 0.25/0.3 = 0.833, weight 1/3,
    # factor = 1/3 x 0.833 + 2/3 = 0.944 -> 0.3 x 0.944 x 400 = 113.3 -> 113.
    assert predict_demand(hist, "X", "main", 400, target_date="2026-09-28")["predicted_demand"] == 113
    # Without the weekday factor it is the plain share: 0.3 x 400 = 120.
    assert predict_demand(hist, "X", "main", 400, target_date="2026-09-25",
                          weekday_shrink=False)["predicted_demand"] == 120


def test_forecast_ship_gate(df):
    # Only a forecast change that beats the all-time average on held-out test data may ship.
    # The shipped forecast must beat BOTH the all-time average and the previous forecast.
    r = mae_report(df)
    assert r["new_beats_old_on_test"] and r["new_beats_previous_on_test"]
    assert r["shipped_mae_servings_per_day"] < r["previous_shipped"]["test_mae"]


def test_recent_window_hand_calc():
    # 5 old days at 200 served, then RECENT_WINDOW_DAYS at 100 (attendance 400): without the
    # weekday factor the shipped window sees only the recent days -> 100.
    hist = make_history([200] * 5 + [100] * RECENT_WINDOW_DAYS)
    p = predict_demand(hist, "X", "main", 400, target_date="2026-10-15", weekday_shrink=False)
    assert p["predicted_demand"] == 100 and p["method"] == "recent_window"
    assert predict_demand(hist, "X", "main", 400, weekday_shrink=False, window=0)["predicted_demand"] > 100


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
    for rule in ("cost_optimal", "shortage_first"):
        low = compute_data_driven_buffers(df, 1.5, buffer_rule=rule)
        high = compute_data_driven_buffers(df, 5.0, buffer_rule=rule)
        assert all(high[i]["buffer"] >= low[i]["buffer"] for i in low)


def test_shortage_first_buffer_hand_calc():
    errors = [i / 100 for i in range(-10, 31)]          # -10% .. +30%
    assert safety_buffer(errors, "main", 3.0, "shortage_first") == pytest.approx(0.276)   # 94th pct: -0.10 + 0.01 x (0.94 x 40)
    assert safety_buffer([-0.2] * 20, "main", 3.0, "shortage_first") == pytest.approx(0.05)  # floor
    assert safety_buffer([-0.2] * 20, "fruit", 3.0, "shortage_first") == pytest.approx(0.10)
    assert safety_buffer(errors, "main", 3.0, "cost_optimal") == newsvendor_buffer(errors, "main", 3.0)
    with pytest.raises(ValueError):
        safety_buffer(errors, "main", 3.0, "bogus")


# ---- cost accounting ------------------------------------------------------------

def test_costs_hand_calc_both_sides_same_demand():
    # demand 100, LunchLoop prep 95, usual 120, $1/serving, shortage = 3x.
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
    assert o["buffer_rule"] == DEFAULT_BUFFER_RULE
    assert rules[DEFAULT_BUFFER_RULE]["total_cost"] == pytest.approx(o["lunchloop_total_cost"], abs=0.05)
    assert rules["usual_amount"]["total_cost"] == pytest.approx(o["baseline_total_cost"], abs=0.05)
    assert rules[DEFAULT_BUFFER_RULE]["shortage_servings"] == o["estimated_shortage_servings"]
    # More buffer can only mean fewer shortages on the same forecast.
    for rule in ("shortage_first", "cost_optimal"):
        assert rules["no_buffer"]["shortage_servings"] >= rules[rule]["shortage_servings"]


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
    assert "Simulated data" in html and "do not" in html and "real-world performance" in html


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


# ---- MVP workflow: forecast -> preparation -> impact -------------------------------------

def test_plan_turns_forecast_into_prep_with_buffers(client):
    plan = client.post("/plan", json={"target_date": "2026-10-19"}).json()
    assert plan["expected_attendance"] > 0 and len(plan["items"]) == 6
    protected = {"vegetable", "fruit", "dairy"}
    for i in plan["items"]:
        assert i["recommended_prep"] == math.ceil(i["predicted_demand"] * (1 + i["buffer_used"]))
        assert i["recommended_prep"] >= i["predicted_demand"]
        floor = 0.10 if i["food_category"] in protected else 0.05
        assert i["buffer_used"] >= floor - 1e-9, i["food_item"]


def test_plan_impact_numbers_are_consistent(client):
    plan = client.post("/plan", json={"target_date": "2026-10-19"}).json()
    t, items = plan["totals"], plan["items"]
    # total = food cooked + shortage, for both sides; surplus is never added on top.
    assert t["estimated_total_cost_compared_items"] == pytest.approx(
        t["estimated_preparation_cost_compared_items"] + t["estimated_shortage_cost_compared_items"], abs=0.005)
    assert t["baseline_total_cost"] == pytest.approx(t["baseline_preparation_cost"] + t["baseline_shortage_cost"], abs=0.005)
    assert t["estimated_savings_vs_baseline"] == pytest.approx(
        t["baseline_total_cost"] - t["estimated_total_cost_compared_items"], abs=0.005)
    for i in items:
        assert i["estimated_total_cost"] == pytest.approx(i["estimated_preparation_cost"] + i["estimated_shortage_cost"], abs=0.005)
        assert i["estimated_surplus"] >= 0 and i["estimated_shortage"] >= 0
    assert t["estimated_surplus_servings"] == pytest.approx(sum(i["estimated_surplus"] for i in items), abs=0.01)
    assert t["estimated_shortage_servings"] == pytest.approx(sum(i["estimated_shortage"] for i in items), abs=0.01)
    assert plan["synthetic_data"] is True


def test_expected_costs_total_is_exactly_the_sum_of_parts():
    for prep in (95, 100, 107):
        c = expected_costs(100, prep, 0.37, baseline_prep=120, shortage_penalty_multiplier=3.0,
                           rel_errors=[-0.13, -0.02, 0.04, 0.11, 0.29])
        assert c["estimated_total_cost"] == round(c["estimated_preparation_cost"] + c["estimated_shortage_cost"], 2)
        assert c["baseline_total_cost"] == round(c["baseline_preparation_cost"] + c["baseline_shortage_cost"], 2)


def test_next_school_day_is_a_real_school_day(client):
    from datetime import date
    d = client.get("/next-school-day").json()["date"]
    ts = pd.Timestamp(d)
    assert ts.weekday() < 5 and ts.date() >= date.today()
    assert d not in prediction_holidays()


def prediction_holidays():
    from prediction import SCHOOL_HOLIDAYS
    return SCHOOL_HOLIDAYS


def test_summary_has_averages_and_date_range(client):
    s = client.get("/summary").json()
    assert s["synthetic_data"] is True and s["first_date"] < s["last_date"] and s["days_in_history"] == 34
    for f in s["per_food"]:
        assert f["avg_served"] > 0 and 0 <= f["avg_leftover"] < f["avg_prepared"]


def test_dashboard_is_three_sections_labeled_synthetic_and_not_hardcoded(client):
    import re
    html = client.get("/").text
    assert re.findall(r"<h2[^>]*>(.*?)</h2>", html) == ["1. What the history shows", "2. The plan", "3. Expected impact"]
    assert "Simulated data" in html and "real-world performance" in html
    assert not re.search(r"\$\d", html), "a hardcoded dollar amount is in the page"
    # every endpoint the page calls exists
    paths = set(re.findall(r"getJSON\('(/[a-z-]+)'", html))
    routes = {r.path for r in client.app.routes}
    assert {"/summary", "/next-school-day", "/plan", "/evaluate"} <= paths <= routes
    assert all(client.get(p).status_code == 200 for p in paths - {"/plan"})
