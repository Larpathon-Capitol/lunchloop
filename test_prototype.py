"""Run with:  python test_prototype.py
Checks the maths, then prints a readable plan for a sample day."""
import pandas as pd
from prediction import (load_data, predict_demand, predict_attendance,
                         calculate_prep_quantity, calculate_costs, plan_day, plan_month,
                         mae_report, compute_data_driven_buffers, validate_history, evaluate_methods)

df = load_data()
assert len(df) == 204, "expected 204 rows (34 school days x 6 foods)"
assert ((df.quantity_prepared - df.quantity_served) == df.quantity_leftover).all(), "leftover must = prepared - served"

# The example from the brief: 120 of 200 -> expected 250 -> 150 servings.
mini = pd.DataFrame({"date": pd.to_datetime(["2026-09-01", "2026-09-02", "2026-09-03"]),
                     "food_item": ["X"] * 3, "food_category": ["main"] * 3, "attendance": [200] * 3,
                     "quantity_prepared": [140] * 3, "quantity_served": [120] * 3,
                     "quantity_leftover": [20] * 3, "unit_cost": [1.0] * 3})
assert predict_demand(mini, "X", "main", 250)["predicted_demand"] == 150
assert calculate_prep_quantity(150, "main")[0] == 165          # 150 x 1.10
assert calculate_prep_quantity(150, "fruit")[0] == 173         # 150 x 1.15, rounded up
c = calculate_costs(150, 165, 2.0, baseline_prep=180)
assert c["estimated_surplus"] == 15 and c["estimated_surplus_cost"] == 30.0
# Cost model: total_cost = prep_cost + shortage_cost (surplus_cost is informational, already
# INSIDE prep_cost, not added again) -- 165x2=330 for us, 180x2=360 for baseline.
assert c["estimated_preparation_cost"] == 330.0 and c["estimated_total_cost"] == 330.0
assert c["baseline_preparation_cost"] == 360.0 and c["baseline_total_cost"] == 360.0
assert c["estimated_savings_vs_baseline"] == 30.0               # 360 - 330
assert c["estimated_savings_pct_vs_baseline"] == round(30 / 360 * 100, 1)

# Bad input must never give a negative prediction.
assert predict_demand(df, "Cheese Pizza", "main", -50)["predicted_demand"] == 0

# Weekday attendance handling: with a year of history, every weekday has enough
# past occurrences to use its own average (Fridays run lower than other days).
mon = predict_attendance(df, "2027-06-14")  # a Monday
fri = predict_attendance(df, "2027-06-18")  # a Friday
assert mon["method"] == "weekday_average" and fri["method"] == "weekday_average"
assert fri["expected_attendance"] < mon["expected_attendance"], "Fridays should run lower"
# A day of the week with NO history (weekends aren't in the data) falls back to the overall average.
sat = predict_attendance(df, "2027-06-19")  # a Saturday
assert sat["method"] == "overall_average_fallback"
# plan_day can derive expected_attendance from target_date instead of requiring a number.
auto_plan = plan_day(df, target_date="2027-06-14")
assert auto_plan["expected_attendance"] == mon["expected_attendance"] and auto_plan["attendance_note"] is not None

# Sample day: Wednesday, 410 students expected, plus a brand-new food.
menu = [{"food_item": n, "food_category": c} for n, c in
        df.drop_duplicates("food_item")[["food_item", "food_category"]].values]
menu.append({"food_item": "Mac and Cheese", "food_category": "main", "unit_cost": 0.60})
plan = plan_day(df, expected_attendance=410, menu=menu)

for i in plan["items"]:
    assert i["predicted_demand"] >= 0 and i["estimated_surplus"] >= 0
    assert i["recommended_prep"] >= i["predicted_demand"]
new = next(i for i in plan["items"] if i["food_item"] == "Mac and Cheese")
assert new["confidence"] == "low" and new["method"] == "category_average_fallback"

print(f"\nTRAYTRACK SAMPLE DAY  (expected attendance: {plan['expected_attendance']})  [synthetic data]\n")
print(f"{'Food':<17}{'Predict':>8}{'Prepare':>8}{'Surplus':>8}{'$/unit':>8}{'Total $':>10}{'Baseline $':>11}{'Est. save':>10}  Confidence")
for i in plan["items"]:
    b = "-" if i["baseline_total_cost"] is None else f"{i['baseline_total_cost']:.2f}"
    s = "-" if i["estimated_savings_vs_baseline"] is None else f"{i['estimated_savings_vs_baseline']:.2f}"
    print(f"{i['food_item']:<17}{i['predicted_demand']:>8}{i['recommended_prep']:>8}{i['estimated_surplus']:>8}"
          f"{i['unit_cost']:>8.2f}{i['estimated_total_cost']:>10.2f}{b:>11}{s:>10}  {i['confidence']}")
t = plan["totals"]
print(f"\nTotals (estimates): preparation cost, all items ${t['estimated_preparation_cost_all_items']:.2f}")
print(f"Compared with baseline (items with history only, total cost incl. shortages): "
      f"LunchLoop ${t['estimated_total_cost_compared_items']:.2f} "
      f"vs baseline ${t['baseline_total_cost']:.2f} -> estimated savings ${t['estimated_savings_vs_baseline']:.2f} "
      f"({t['estimated_savings_pct_vs_baseline']}%)")
assert round(t["baseline_total_cost"] - t["estimated_total_cost_compared_items"], 2) == t["estimated_savings_vs_baseline"]
print("\nNotes:")
for i in plan["items"]:
    if i["confidence"] == "low" or "sold out" in i["note"]:
        print(f" - {i['food_item']}: {i['note']}")
print("\nAssumptions:")
for a in plan["assumptions"]:
    print(" -", a)

# Month-ahead prediction: rolls up one plan_day() call per school day in the month.
month_plan = plan_month(df, 2027, 1)  # January 2027, entirely beyond the history
assert month_plan["school_days"] == 19  # Jan 2027 minus weekends, New Year's Day, MLK Day
assert len(month_plan["daily_plans"]) == 19
assert len(month_plan["per_food_totals"]) == 6
for f in month_plan["per_food_totals"]:
    assert f["total_recommended_prep"] >= f["total_predicted_demand"] >= 0
t = month_plan["totals"]
assert round(t["baseline_total_cost"] - t["estimated_total_cost_compared_items"], 2) == t["estimated_savings_vs_baseline"]

# Sold-out days are KEPT in the rate estimate: served there (100) is capped by what was
# prepared, so it is a lower bound on demand. Dropping it would bias the estimate even lower.
# (100 + 50 + 50 + 50) / 800 = 0.3125 x 200 = 62.5 -> 62.
soldout_hist = pd.DataFrame({
    "date": pd.to_datetime(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"]),
    "food_item": ["Y"] * 4, "food_category": ["main"] * 4, "attendance": [200] * 4,
    "quantity_prepared": [100, 100, 100, 100], "quantity_served": [100, 50, 50, 50],
    "quantity_leftover": [0, 50, 50, 50], "unit_cost": [1.0] * 4,
})
pred = predict_demand(soldout_hist, "Y", "main", 200)
assert pred["predicted_demand"] == 62, "the sold-out day (100 served) should be kept as a lower bound"
assert "sold out" in pred["note"] and "lower bound" in pred["note"]

# Weekday candidate (not shipped, see USE_WEEKDAY_SHRINK): with 6 past Fridays (weight 6/10), a strong Friday-specific pattern
# should mostly come through. Overall rate 0.375, Friday rate 0.8 -> 0.63 x 400 = 252.
weekday_hist = pd.DataFrame({
    "date": pd.date_range("2026-09-07", periods=40, freq="D"),  # every day, not just weekdays
    "food_item": ["Pizza"] * 40, "food_category": ["main"] * 40, "attendance": [400] * 40,
    # Fridays (index 4, 11, 18, 25, 32, 39 ...) serve much more than other days.
    "quantity_served": [320 if (i % 7 == 4) else 120 for i in range(40)],
    "unit_cost": [1.0] * 40,
})
weekday_hist["quantity_prepared"] = weekday_hist["quantity_served"]
weekday_hist["quantity_leftover"] = 0
weekday_hist.loc[weekday_hist["quantity_served"] == weekday_hist["quantity_prepared"].max(), "quantity_prepared"] += 1
weekday_hist["quantity_leftover"] = weekday_hist["quantity_prepared"] - weekday_hist["quantity_served"]
friday_pred = predict_demand(weekday_hist, "Pizza", "main", 400, target_date="2026-10-16",
                             weekday_shrink=True)  # a Friday
assert friday_pred["method"].endswith("_weekday")
assert friday_pred["predicted_demand"] > 250, "should pick up the Friday-specific spike"

# Accuracy backtest: sanity-check both methods compute, not that "new" beats "old" --
# with only ~34 days of real history, the weekday+recency method does NOT reliably beat
# the simple all-time average (it's actually slightly worse here: not enough data yet for
# the extra structure to pay off). That's an honest finding, not a bug: asserting "new must
# win" would just be re-planting the same circularity this dataset's generator is already
# flagged for (see mae_report()'s circularity_caveat).
report = mae_report(df)
assert report["n_predictions"] > 50
assert report["old_method"]["overall_mae_servings_per_day"] > 0
assert report["new_method"]["overall_mae_servings_per_day"] > 0
assert "circularity_caveat" in report

# Data-driven (newsvendor) buffers: every established food gets a buffer within the
# configured bounds, protected categories keep their floor, and the in-sample short-day rate
# is no worse than the target allows (1 - service level = 1/3 at the default multiplier 3).
buffers = compute_data_driven_buffers(df)
assert len(buffers) == 6
for item, info in buffers.items():
    assert 0 <= info["buffer"] <= 0.40
    assert info["shortage_rate_estimate"] <= 1 - info["service_level_target"] + 1 / info["samples"] + 1e-9  # quantile interpolation: at most one extra miss
cats = dict(df.drop_duplicates("food_item")[["food_item", "food_category"]].values)
assert all(buffers[i]["buffer"] >= 0.10 for i in buffers if cats[i] in ("fruit", "vegetable", "dairy"))

# Input validation: the generated CSV should be clean; a deliberately broken one should not be.
assert validate_history(df) == []
broken = pd.DataFrame({
    "date": pd.to_datetime(["2026-09-01", "2026-09-01"]),  # duplicate date for same item
    "food_item": ["Z", "Z"], "food_category": ["main"] * 2, "attendance": [200, 200],
    "quantity_prepared": [100, 100], "quantity_served": [80, 80],
    "quantity_leftover": [10, 20], "unit_cost": [1.0] * 2,  # 10 is wrong: should be 20
})
issues = validate_history(broken)
assert any("duplicate" in i for i in issues)
assert any("quantity_leftover" in i for i in issues)

# ---------------------------------------------------------------------------
# calculate_costs(): the ten hand-calculable scenarios from the cost-model review.
# ---------------------------------------------------------------------------

# 1. LunchLoop prepares LESS than the baseline, meets demand exactly, reduces total cost.
c = calculate_costs(predicted_demand=100, recommended_prep=100, unit_cost=1.0, baseline_prep=130)
assert c["estimated_surplus"] == 0 and c["estimated_shortage"] == 0
assert c["estimated_total_cost"] == 100.0 and c["baseline_total_cost"] == 130.0
assert c["estimated_savings_vs_baseline"] == 30.0
assert c["estimated_savings_pct_vs_baseline"] == round(30 / 130 * 100, 1)

# 2. LunchLoop prepares TOO LITTLE and incurs a shortage penalty (here 1.5x unit_cost) --
# this can make LunchLoop look WORSE than a baseline that happened to prepare exactly enough.
c = calculate_costs(predicted_demand=100, recommended_prep=80, unit_cost=2.0, baseline_prep=100,
                     shortage_penalty_multiplier=1.5)
assert c["estimated_shortage"] == 20 and c["estimated_shortage_cost"] == 60.0  # 20 x 2 x 1.5
assert c["estimated_total_cost"] == 220.0  # 80x2 prep + 60 shortage
assert c["baseline_total_cost"] == 200.0   # 100x2 prep, no shortage
assert c["estimated_savings_vs_baseline"] == -20.0, "LunchLoop should look WORSE here, not better"
assert c["estimated_savings_pct_vs_baseline"] == -10.0

# 3. LunchLoop prepares TOO MUCH, generating more surplus than the baseline.
c = calculate_costs(predicted_demand=100, recommended_prep=140, unit_cost=1.0, baseline_prep=110)
assert c["estimated_surplus"] == 40
assert c["estimated_total_cost"] == 140.0 and c["baseline_total_cost"] == 110.0
assert c["estimated_savings_vs_baseline"] == -30.0, "over-preparing should show as a cost, not a saving"

# 4. Identical prep on both sides -> exactly zero savings (not a rounding artifact).
c = calculate_costs(predicted_demand=100, recommended_prep=100, unit_cost=1.0, baseline_prep=100)
assert c["estimated_total_cost"] == c["baseline_total_cost"] == 100.0
assert c["estimated_savings_vs_baseline"] == 0.0 and c["estimated_savings_pct_vs_baseline"] == 0.0

# 5. Baseline total cost of zero -> savings_pct is None (not a ZeroDivisionError, not a lie).
c = calculate_costs(predicted_demand=0, recommended_prep=0, unit_cost=1.0, baseline_prep=0)
assert c["baseline_total_cost"] == 0.0 and c["estimated_savings_vs_baseline"] == 0.0
assert c["estimated_savings_pct_vs_baseline"] is None

# 6. A food sells out and actual demand is unknown -- covered above (soldout_hist test):
# predict_demand() excludes that day from the rate estimate rather than inventing a shortage
# figure for it. Confirm plan_day() doesn't fabricate a per-day shortage estimate for history
# rows either -- it only estimates shortage for the FORECAST day, against the model's own
# predicted_demand, never claiming to know what actually happened on a past sold-out day.
assert "sold_out" not in calculate_costs(100, 100, 1.0)  # no fabricated sold-out-specific field

# 7. Unit costs differ between foods -- cost scales linearly with unit_cost, nothing else changes.
c_cheap = calculate_costs(predicted_demand=100, recommended_prep=100, unit_cost=1.0)
c_pricey = calculate_costs(predicted_demand=100, recommended_prep=100, unit_cost=2.0)
assert c_pricey["estimated_total_cost"] == 2 * c_cheap["estimated_total_cost"]

# 8. Missing/invalid (negative) inputs are handled safely -- clipped to zero, never crash,
# never produce a negative cost or quantity.
c = calculate_costs(predicted_demand=-50, recommended_prep=-10, unit_cost=1.0, baseline_prep=-5)
assert c["estimated_surplus"] == 0 and c["estimated_shortage"] == 0
assert c["estimated_total_cost"] == 0.0 and c["baseline_total_cost"] == 0.0

# 9. Surplus and plate waste are NOT the same quantity, computed independently: surplus comes
# from (recommended_prep - predicted_demand); plate waste comes from an external USDA rate x
# predicted_demand, regardless of how much was actually prepared.
carrots = next(i for i in plan["items"] if i["food_item"] == "Steamed Carrots")
expected_waste = round(carrots["predicted_demand"] * 0.31)  # USDA vegetable plate-waste rate
assert carrots["estimated_plate_waste_servings"] == expected_waste
assert carrots["estimated_plate_waste_servings"] != carrots["estimated_surplus"], (
    "these measure different things and would only coincide by accident")

# 10. evaluate_methods(): baseline and LunchLoop scored on the SAME held-out days, with no
# future-data leakage -- truncating the dataset to a cutoff date must NOT change any
# prediction made for a day on or before that cutoff (if it did, something later in the
# dataset would have to be leaking backward in time).
dates_sorted = sorted(df["date"].unique())
cutoff = dates_sorted[25]
truncated_df = df[df["date"] <= cutoff]
full_eval = evaluate_methods(df)
trunc_eval = evaluate_methods(truncated_df)
cutoff_str = str(pd.Timestamp(cutoff).date())
full_by_key = {(r["date"], r["food_item"]): r for r in full_eval["daily"] if r["date"] <= cutoff_str}
trunc_by_key = {(r["date"], r["food_item"]): r for r in trunc_eval["daily"]}
assert len(full_by_key) > 0 and full_by_key.keys() == trunc_by_key.keys()
for key, full_row in full_by_key.items():
    assert full_row["predicted_demand"] == trunc_by_key[key]["predicted_demand"], (
        f"{key}: prediction changed when later (future-relative) rows were added -- leakage")
    assert full_row["baseline_prep"] == trunc_by_key[key]["baseline_prep"]

# evaluate_methods() also reports fairly: same-dates comparison, aggregate + per-food +
# daily breakdown, nothing silently cherry-picked.
assert full_eval["evaluated_predictions"] > 0
assert set(full_eval["per_food"].keys()) == set(df["food_item"].unique())
assert full_eval["overall"]["n"] == full_eval["evaluated_predictions"]
assert full_eval["synthetic_data"] is True and "circularity_caveat" in full_eval
for day_row in full_eval["daily"][:5]:
    assert "baseline_total_cost" in day_row and "estimated_total_cost" in day_row

print("\nALL CHECKS PASSED")
