import json
import subprocess
import sys
from pathlib import Path

import data.simulate as simulate
from tools.eval_truth import PACKAGED_ITEM_IDS, bootstrap_interval, evaluate, score_rows


ROOT = Path(__file__).resolve().parents[2]


def test_cli_output_is_deterministic(tmp_path):
    outputs = []
    reports = []
    for index in range(2):
        json_path = tmp_path / f"run-{index}.json"
        completed = subprocess.run(
            [
                sys.executable,
                "tools/eval_truth.py",
                "--seeds",
                "1",
                "--weeks",
                "1",
                "--bootstrap-resamples",
                "20",
                "--json",
                str(json_path),
            ],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        outputs.append(completed.stdout)
        reports.append(json.loads(json_path.read_text(encoding="utf-8")))
    assert outputs[0] == outputs[1]
    assert reports[0] == reports[1]


def test_true_demand_usual_shortages_include_censored_shortages():
    report = evaluate(seeds=1, weeks=1, bootstrap_resamples=20)
    seed = report["per_seed"][0]
    assert seed["true_demand"]["usual"]["servings_short"] >= seed["censored"]["usual"]["servings_short"]
    assert seed["true_demand"]["usual"]["dollars_short"] >= seed["censored"]["usual"]["dollars_short"]


def test_score_rows_matches_hand_arithmetic():
    rows = [
        # LunchLoop and usual both prep 10. True demand is 12, so this row is
        # short by 2 servings and costs 2 * $2 * 3 = $12 in net shortage cost.
        {"date": "2026-01-01", "prep_lunchloop": 10, "prep_usual": 10, "true_demand": 12, "taken": 10, "cost": 2.0},
        # Both prep 8 against demand 5, leaving 3 servings worth $4.50.
        {"date": "2026-01-02", "prep_lunchloop": 8, "prep_usual": 8, "true_demand": 5, "taken": 4, "cost": 1.5},
    ]
    true = score_rows(rows, ratio=3.0, demand_key="true_demand")
    censored = score_rows(rows, ratio=3.0, demand_key="taken")

    assert true["lunchloop"] == {
        "leftover_servings": 3,
        "dollars_wasted": 4.5,
        "servings_short": 2,
        "dollars_short": 4.0,
        "net_dollars": 16.5,
        "leftover_dollars_per_day": 2.25,
        "short_servings_per_day": 1.0,
        "net_dollars_per_day": 8.25,
    }
    assert censored["lunchloop"]["servings_short"] == 0
    assert censored["lunchloop"]["dollars_wasted"] == 6.0  # $2 * 0 + $1.50 * 4
    assert censored["net_dollars_saved"] == 0.0


def test_bootstrap_interval_contains_point_estimate():
    values = [1.0, 3.0, 5.0]
    interval = bootstrap_interval(values, resamples=100, seed=0)
    point = sum(values) / len(values)
    assert interval[0] <= point <= interval[1]


def test_true_component_breakdown_sums_and_packages_items():
    report = evaluate(seeds=1, weeks=1, bootstrap_resamples=20)
    true = report["pooled"]["true_demand"]
    rows = true["component_breakdown"]
    component_rows = [row for row in rows if row["component"] in {
        "meat_alternate", "grain", "vegetable", "fruit", "milk"
    }]
    assert abs(sum(row["net_dollars_saved"] for row in component_rows) - true["net_dollars_saved"]) <= 0.01

    package_rows = [
        {"date": "2026-01-01", "item_id": item_id, "prep_lunchloop": 3, "prep_usual": 1,
         "true_demand": 2, "cost": 1.0}
        for item_id in sorted(PACKAGED_ITEM_IDS)
    ]
    breakdown = score_rows(
        package_rows,
        component_by_item={item_id: "fruit" for item_id in PACKAGED_ITEM_IDS},
    )["component_breakdown"]
    package = next(row for row in breakdown if row["component"] == "packaged")
    assert package["net_dollars_saved"] == sum(3.0 - 1.0 for _ in PACKAGED_ITEM_IDS)


def test_prep_ratio_override_changes_result_and_is_restored():
    original = simulate.COMPONENT_PREP_RATIOS.copy()
    baseline = evaluate(seeds=1, weeks=1, bootstrap_resamples=5)
    changed = evaluate(
        seeds=1,
        weeks=1,
        bootstrap_resamples=5,
        prep_ratios={"milk": 1.025},
    )

    assert changed["pooled"]["true_demand"]["net_dollars_saved"] != baseline["pooled"]["true_demand"]["net_dollars_saved"]
    assert simulate.COMPONENT_PREP_RATIOS == original

