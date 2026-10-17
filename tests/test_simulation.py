"""Tests for the SYNTHETIC simulation study (simulation.py)."""
import pandas as pd
import pytest

import prediction
from prediction import predict_demand, validate_history, evaluate_methods, REQUIRED_COLUMNS
from simulation import (simulate_school, run_simulation_study, _school_rows, SCENARIOS,
                        WARMUP_DAYS, STRATEGY_LABELS)


@pytest.fixture(scope="module")
def school():
    return simulate_school("typical", seed=3, n_days=60)


@pytest.fixture(scope="module")
def small_study():
    return run_simulation_study(n_train=1, n_val=1, n_test=1, n_days=45)


def test_school_has_csv_columns_and_is_labeled(school):
    assert set(REQUIRED_COLUMNS) <= set(school.columns) and "true_demand" in school.columns
    assert school.attrs["synthetic"] is True
    assert validate_history(school.drop(columns="true_demand")) == []


def test_served_is_capped_by_prep(school):
    assert (school["quantity_served"] == school[["quantity_prepared", "true_demand"]].min(axis=1)).all()
    assert (school["quantity_leftover"] == school["quantity_prepared"] - school["quantity_served"]).all()
    assert (school["quantity_leftover"] == 0).any()   # the simulated kitchen does sell out


def test_seeds_are_reproducible_and_distinct():
    a, b = simulate_school("volatile", 1, 30), simulate_school("volatile", 1, 30)
    pd.testing.assert_frame_equal(a, b)
    assert not simulate_school("volatile", 2, 30)["true_demand"].equals(a["true_demand"])


def test_every_scenario_runs():
    for family in SCENARIOS:
        assert len(simulate_school(family, 0, 20)) == 20 * 6


def test_existing_pipeline_runs_on_a_simulated_school(school):
    e = evaluate_methods(school.drop(columns="true_demand"))
    assert e["evaluated_predictions"] > 0 and e["synthetic_data"] is True


def test_sim_forecast_matches_production(school):
    # The vectorized simulator must forecast exactly what predict_demand() would.
    rows = pd.DataFrame(_school_rows(school, (3.0,)))
    dates = sorted(school["date"].unique())
    for _, r in rows.sample(15, random_state=0).iterrows():
        past = school[school["date"] < dates[r["day"]]]
        shipped = predict_demand(past, r["food_item"], r["food_category"], r["attendance"],
                                 target_date=dates[r["day"]])["predicted_demand"]
        assert r["f_recent"] == shipped


def test_sim_walk_forward_has_no_leakage(school):
    full = pd.DataFrame(_school_rows(school, (1.0, 3.0, 5.0)))
    cut = school[school["date"] < sorted(school["date"].unique())[40]]
    part = pd.DataFrame(_school_rows(cut, (1.0, 3.0, 5.0)))
    merged = full[full["day"] < 40].reset_index(drop=True)
    prep_cols = [c for c in part.columns if c.startswith("prep_") or c.startswith("f_")]
    pd.testing.assert_frame_equal(merged[prep_cols], part[prep_cols])


def test_study_selects_on_validation_only(small_study):
    for res in small_study["results"].values():
        val = res["by_split"]["validation"]
        assert res["chosen_on_validation"]["best_by_cost"] == min(val, key=lambda s: val[s]["total_cost"])
        assert set(res["by_split"]["test"]) == set(STRATEGY_LABELS)


def test_study_metrics_are_consistent(small_study):
    for res in small_study["results"].values():
        for split in res["by_split"].values():
            usual = split["usual"]
            for r in split.values():
                assert r["total_cost"] == pytest.approx(r["food_cost"] + r["shortage_cost"], abs=0.05)
                assert r["savings_vs_usual"] == pytest.approx(usual["total_cost"] - r["total_cost"], abs=0.05)
                assert 0 <= r["fill_rate_pct"] <= 100
    assert small_study["synthetic_data"] is True


def test_shipped_settings_match_full_study_validation_choice():
    # Production settings must be what the FULL study picks on validation schools: the
    # forecast, and the cheapest strategy that has fewer leftovers AND no more short
    # servings AND no more short rows than the usual amount, at 1x, 3x and 5x.
    study = run_simulation_study()
    assert study["chosen_forecast_on_validation"] == "lunchloop_forecast"
    shipped = "recent_" + prediction.DEFAULT_BUFFER_RULE
    assert study["config"]["shipped_strategy"] == shipped
    assert study["config"]["shipped_coverage_level"] == prediction.SHORTAGE_FIRST_LEVEL
    for key in ("1x", "3x", "5x"):
        assert study["results"][key]["chosen_on_validation"]["best_dominating"] == shipped
    # The goal check itself is reported, not assumed: it is True on validation schools.
    assert study["results"]["3x"]["by_split"]["validation"][shipped]["beats_usual_on_all_three"] is True


def test_dashboard_has_simulation_section():
    from fastapi.testclient import TestClient
    import app
    app._simulation["result"] = run_simulation_study(n_train=1, n_val=1, n_test=1, n_days=45)
    client = TestClient(app.app)
    body = client.get("/simulation").json()
    assert body["synthetic_data"] is True and set(body["results"]) == {"1x", "3x", "5x"}
    assert "Simulation study" not in client.get("/").text   # kept in the API, off the MVP dashboard
