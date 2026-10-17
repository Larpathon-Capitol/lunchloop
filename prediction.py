"""LunchLoop stage 1: demand prediction + prep quantities + surplus costs.

How it works, in plain words
----------------------------
1. load_data()                -> read the CSV into a Pandas table.
2. predict_demand()           -> "what share of attending students took this food in the past?"
                                 share x expected attendance = predicted servings.
3. calculate_prep_quantity()  -> predicted servings + a small safety buffer, rounded up.
4. calculate_costs()          -> surplus = prepare - predicted; cost = surplus x unit cost.
5. plan_day()                 -> runs steps 2-4 for every menu item and returns plain
                                 dicts/lists that FastAPI can send as JSON to React.

What the numbers mean
---------------------
MEASURED in the cafeteria: attendance, quantity_prepared, quantity_served, quantity_leftover.
ESTIMATED / ASSUMED: unit_cost, predicted demand, surplus, and all savings.
quantity_served is portions that left the serving line. It is NOT food eaten
(plate waste is not measured here), and "surplus" is NOT actual waste: leftovers
can sometimes be stored and reused.
"""
import math
import numpy as np
import pandas as pd

# ---- Settings you can change -------------------------------------------------
SAFETY_BUFFER = 0.10                 # prepare 10% above predicted demand
PROTECTED_BUFFER = 0.15              # bigger buffer for nutritious items (never run short on them)
PROTECTED_CATEGORIES = {"vegetable", "fruit", "dairy"}
MIN_RECORDS = 3                      # fewer past days than this -> use the fallback
FALLBACK_SERVE_RATE = 0.25           # used only if a new food's category has no history either

REQUIRED_COLUMNS = ["date", "food_item", "food_category", "attendance",
                    "quantity_prepared", "quantity_served", "quantity_leftover", "unit_cost"]

# Real-world reference points (from published studies), for context only, not used in math.
BENCHMARKS = {
    "italy_school_canteens_unconsumed_share": 0.217,  # 78 schools; includes plate waste + unserved
    # USDA FNS research summary (Spring 2019): mean % of served lunch left on the tray, by
    # category -- https://schoolnutrition.org/wp-content/uploads/2022/06/USDA-FNS-Research-Summary-Spring2019.pdf
    "usda_plate_waste_by_category": {
        "vegetable": 0.31, "dairy": 0.29, "fruit": 0.26, "grain_side": 0.23,
        "dessert_other": 0.20, "main": 0.16, "meat_alt": 0.14,
    },
    "usda_source": "School Nutrition and Meal Cost Study (SNMCS), SY 2014-15, published April 2019; "
                    "figures verified word-for-word against the FNS summary PDF, page 3: "
                    "https://schoolnutrition.org/wp-content/uploads/2022/06/USDA-FNS-Research-Summary-Spring2019.pdf",
    # Adjapong, Bender, Schaefer & Roe, PLoS ONE 19(12):e0299043 (2024) -- WWF Food Waste
    # Warriors data, 134 US schools. Winter PLATE waste ran significantly higher than spring
    # for entrees (log-coef 0.317, ~+37%) and milk (0.230, ~+26%); produce showed no
    # significant seasonal effect.
    "adjapong_2024_winter_vs_spring_waste_main": 0.37,
    "adjapong_2024_winter_vs_spring_waste_dairy": 0.26,
    "adjapong_2024_source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11676535/",
    "adjapong_2024_usage": "CONTEXT ONLY -- NOT used to generate this dataset. An earlier "
            "version of the generator multiplied the synthetic data's winter LEFTOVER rate "
            "(prepared minus served -- our own, unmeasured-by-anyone-but-us quantity) by these "
            "PLATE-waste figures (served minus eaten -- a different, externally measured "
            "quantity). That was flagged as an unjustified conflation of two different measures "
            "and removed, rather than patched with a weaker version of the same mistake. The "
            "figures stay here as real-world context for the pitch, not as a calibration input.",
    "note": "Our 'leftover' is UNSERVED food (prep minus servings taken), not plate waste "
            "(servings taken minus food actually eaten) -- the two italy/USDA figures above "
            "measure plate waste, which runs higher. The category *ranking* in the USDA figures "
            "(vegetables and milk wasted most, entrees wasted least) is the same ranking the "
            "synthetic data's per-item serve-rates and leftover-rates were built around. "
            "'estimated_plate_waste' below applies this external benchmark rate to OUR predicted "
            "servings -- it is not measured from this cafeteria's own data.",
}

# Days with no school, for the 2026-27 school year. Shared by the data generator and by
# plan_month() below, so "predict the next month" skips the same days the history does.
SCHOOL_HOLIDAYS = {
    "2026-09-07",  # Labor Day
    "2026-11-25", "2026-11-26", "2026-11-27",  # Thanksgiving break
    "2026-12-21", "2026-12-22", "2026-12-23", "2026-12-24", "2026-12-25",
    "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01",  # Winter break
    "2027-01-18",  # MLK Day
    "2027-02-15",  # Presidents' Day
    "2027-03-15", "2027-03-16", "2027-03-17", "2027-03-18", "2027-03-19",  # Spring break
    "2027-05-31",  # Memorial Day
}


def school_days(start, end):
    """Every weekday between start and end (inclusive) that isn't in SCHOOL_HOLIDAYS."""
    days = pd.date_range(pd.Timestamp(start), pd.Timestamp(end), freq="D")
    days = days[days.weekday < 5]
    return [d for d in days if d.strftime("%Y-%m-%d") not in SCHOOL_HOLIDAYS]


def validate_history(df):
    """Checks a loaded history for the problems a real (hand-kept) production record is
    prone to. Returns a list of human-readable issue strings; an empty list means nothing
    was found. Doesn't raise or drop rows -- load_data() just prints whatever this finds,
    so a real record can still be loaded (and used) with its problems visible.
    """
    issues = []
    bad_leftover = df[(df["quantity_prepared"] - df["quantity_served"]) != df["quantity_leftover"]]
    if len(bad_leftover):
        issues.append(f"{len(bad_leftover)} row(s) where quantity_leftover != "
                       "quantity_prepared - quantity_served.")

    dupes = df[df.duplicated(subset=["date", "food_item"], keep=False)]
    if len(dupes):
        issues.append(f"{len(dupes)} row(s) are duplicates -- same date + food_item appears "
                       "more than once.")

    negative = df[(df["quantity_prepared"] < 0) | (df["quantity_served"] < 0) | (df["attendance"] < 0)]
    if len(negative):
        issues.append(f"{len(negative)} row(s) have a negative attendance/prepared/served value.")

    if len(df):
        present = set(df["date"].dt.strftime("%Y-%m-%d"))
        expected = {d.strftime("%Y-%m-%d") for d in school_days(df["date"].min(), df["date"].max())}
        missing = sorted(expected - present)
        if missing:
            preview = ", ".join(missing[:3]) + ("..." if len(missing) > 3 else "")
            issues.append(f"{len(missing)} expected school day(s) missing from the data "
                           f"(e.g. {preview}).")
    return issues


def load_data(path="data/cafeteria_history_synthetic.csv"):
    """Read the CSV, check the columns, and drop rows that can't be used."""
    df = pd.read_csv(path, parse_dates=["date"])
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"CSV is missing columns: {missing}")
    before = len(df)
    df = df.dropna(subset=["food_item", "attendance", "quantity_served"])
    df = df[df["attendance"] > 0]
    if len(df) < before:
        print(f"Warning: dropped {before - len(df)} unusable row(s).")
    df = df.reset_index(drop=True)
    for issue in validate_history(df):
        print(f"Warning: {issue}")
    return df


MIN_WEEKDAY_RECORDS = 2              # fewer same-weekday days than this -> use the overall average


def predict_attendance(df, target_date=None):
    """Estimate expected attendance for a day, using the same weekday's history when there's enough of it.

    Example: if Fridays in the history run lower than other days, a Friday target_date
    will use the Friday average instead of the all-days average.
    Returns a dict (never None); falls back to the overall average with a note if
    target_date is missing or that weekday doesn't have enough history yet.
    """
    daily = df.drop_duplicates("date")[["date", "attendance"]]  # one row per school day
    overall_mean = daily["attendance"].mean()
    if target_date is None:
        return {"expected_attendance": round(overall_mean), "method": "overall_average",
                "note": "No target date given, so the average attendance across all history was used."}

    target_date = pd.Timestamp(target_date)
    weekday = target_date.weekday()
    same_weekday = daily[daily["date"].dt.weekday == weekday]
    if len(same_weekday) >= MIN_WEEKDAY_RECORDS:
        value = same_weekday["attendance"].mean()
        note = (f"Based on {len(same_weekday)} past {target_date.strftime('%A')}s "
                 f"(avg {value:.0f}), vs. {overall_mean:.0f} across all days.")
        return {"expected_attendance": round(value), "method": "weekday_average", "note": note}

    return {"expected_attendance": round(overall_mean), "method": "overall_average_fallback",
            "note": f"Not enough past {target_date.strftime('%A')}s yet, so the overall average was used."}


WEEKDAY_SHRINK_K = 4  # a weekday's own pattern gets weight n / (n + 4) after n past occurrences
# Shipped forecast = share over the last RECENT_WINDOW_DAYS school days x a shrunk per-food
# weekday factor. Picked on TRAINING schools in the synthetic study (lowest error vs. true
# demand out of 40 window / smoothing / weekday / sold-out-correction variants), confirmed
# on VALIDATION schools (13.00 vs. 14.91 for the previous last-20-days forecast), then
# passed the CSV ship gate (held-out test MAE 6.86 vs. 7.17 previous, 7.26 all-time).
USE_WEEKDAY_SHRINK = True
RECENT_WINDOW_DAYS = 10
PREVIOUS_WINDOW_DAYS = 20  # the previous shipped forecast, still scored by mae_report()


def _estimate_serve_rate(hist, target_date=None, weekday_shrink=None, window=None):
    """The rate estimate behind predict_demand(), once a food has enough history.

    base = served / attendance over the last `window` days (RECENT_WINDOW_DAYS by default,
    0 = all history). With weekday_shrink (default USE_WEEKDAY_SHRINK) and a target_date,
    base is multiplied by that weekday's ratio to the all-days rate (over all history),
    shrunk toward 1 by n / (n + WEEKDAY_SHRINK_K): with 2 past Fridays the Friday pattern
    gets 33% weight, with 12 it gets 75%.
    """
    if weekday_shrink is None:
        weekday_shrink = USE_WEEKDAY_SHRINK
    window = RECENT_WINDOW_DAYS if window is None else window
    recent = hist.tail(window) if window else hist
    rate = recent["quantity_served"].sum() / recent["attendance"].sum()
    if len(recent) < len(hist):
        method, note = "recent_window", (f"Based on the last {len(recent)} school days: "
                                         f"{rate:.1%} of attending students took it.")
    else:
        method, note = "history_scaled_by_attendance", (
            f"Based on all {len(hist)} past days: {rate:.1%} of attending students took it.")
    all_rate = hist["quantity_served"].sum() / hist["attendance"].sum()
    if not weekday_shrink or target_date is None or all_rate == 0:
        return rate, method, note
    day_name = pd.Timestamp(target_date).strftime("%A")
    same = hist[hist["date"].dt.weekday == pd.Timestamp(target_date).weekday()]
    if len(same) == 0:
        return rate, method, note + f" No past {day_name}s yet."
    ratio = (same["quantity_served"].sum() / same["attendance"].sum()) / all_rate
    weight = len(same) / (len(same) + WEEKDAY_SHRINK_K)
    factor = weight * ratio + (1 - weight)
    return rate * factor, method + "_weekday", (
        note + f" {day_name}s run {ratio - 1:+.0%} vs. other days ({len(same)} past "
        f"{day_name}s, weighted {weight:.0%}), so {rate * factor:.1%} is expected.")


def predict_demand(df, food_item, food_category=None, expected_attendance=None, target_date=None,
                   weekday_shrink=None, window=None):
    """Predict how many servings of one food students will want.

    Example: 120 served out of 200 attending, expected attendance 250
             -> (120 / 200) x 250 = 150 servings.
    weekday_shrink / window override the shipped settings (USE_WEEKDAY_SHRINK,
    RECENT_WINDOW_DAYS; window=0 = all history). Returns a dict (never negative).
    """
    hist = df[df["food_item"] == food_item].sort_values("date")
    # Sold-out days are KEPT. Served there is capped by what was prepared, so it is a lower
    # bound on demand -- but those are the high-demand days, so dropping them (the previous
    # behavior) biased the rate even lower than keeping the capped value does.
    sold_out = int((hist["quantity_leftover"] == 0).sum())
    typical_attendance = df["attendance"].mean()
    attendance = typical_attendance if expected_attendance is None else max(0, expected_attendance)

    if len(hist) >= MIN_RECORDS and hist["attendance"].sum() > 0:
        rate, method, note = _estimate_serve_rate(hist, target_date, weekday_shrink, window)
        predicted = rate * attendance
        confidence = "ok"
        if expected_attendance is None:
            note += " No expected attendance given, so typical attendance was used."
        if sold_out:
            note += (f" {sold_out} past day(s) sold out; served on those days is only a lower "
                     "bound on demand, so true demand may be a bit higher than this.")
    else:
        # New (or barely-seen) food: use the average rate of its category, else a flat default.
        cat_hist = df[df["food_category"] == food_category]
        if len(cat_hist):
            per_item = cat_hist.groupby("food_item").apply(
                lambda g: g["quantity_served"].sum() / g["attendance"].sum())
            rate = per_item.mean()
            method = "category_average_fallback"
            note = f"No history for this food. Used the average of existing '{food_category}' items ({rate:.1%})."
        else:
            rate = FALLBACK_SERVE_RATE
            method = "default_fallback"
            note = f"No history for this food or category. Used a default rate of {rate:.0%}."
        predicted = rate * attendance
        confidence = "low"
        note += " Treat as a rough guess and update after the first real day."

    return {"predicted_demand": max(0, round(predicted)), "method": method,
            "confidence": confidence, "records_used": len(hist), "note": note}


MIN_BACKTEST_WARMUP_DAYS = 10   # skip this many of the earliest school days (too little history yet)
TEST_DAYS = 15                  # the last 15 school days (3 weeks) are the held-out test window


def split_dates(df, min_warmup_days=MIN_BACKTEST_WARMUP_DAYS, test_days=TEST_DAYS):
    """Splits the school days into warm-up (never scored), validation (the only days used
    to choose model settings such as WEEKDAY_SHRINK_K), and test (the last test_days days,
    only ever used to REPORT results, never to tune anything)."""
    dates = sorted(pd.Timestamp(d) for d in df["date"].unique())
    test_start = max(min_warmup_days, len(dates) - test_days)
    return {"warmup": dates[:min_warmup_days], "validation": dates[min_warmup_days:test_start],
            "test": dates[test_start:]}


def _walk_forward_predictions(df, min_warmup_days=MIN_BACKTEST_WARMUP_DAYS, test_days=TEST_DAYS):
    """Walk-forward backtest engine, shared by mae_report(), compute_data_driven_buffers()
    and evaluate_methods().

    For each scored school day and each food already established by then, predicts that
    day's demand using ONLY data strictly before that date, with both the OLD all-time-
    average method and the current method, plus the baseline prep ("the usual amount per
    student", also from prior days only). Both predictions are rounded to whole servings.
    Attendance is the day's actual count for every method alike (it assumes a morning
    head count is known before cooking).

    Returns one row per scored (date, food_item): date, split ("validation"/"test"),
    food_item, food_category, attendance, actual, sold_out, unit_cost, old_pred (all-time
    average), new_pred (the SHIPPED forecast, used for buffers and costs), prev_pred (the
    previous shipped forecast, last PREVIOUS_WINDOW_DAYS days, scored for comparison only),
    baseline_prep.
    """
    splits = split_dates(df, min_warmup_days, test_days)
    test_set = set(splits["test"])
    records = []
    for date in splits["validation"] + splits["test"]:
        past = df[df["date"] < date]
        for _, row in df[df["date"] == date].iterrows():
            item, cat, attendance = row["food_item"], row["food_category"], row["attendance"]
            item_hist = past[past["food_item"] == item]
            if len(item_hist) < MIN_RECORDS:
                continue  # this food itself is still in its own warm-up period
            old_rate = item_hist["quantity_served"].sum() / item_hist["attendance"].sum()
            records.append({
                "date": date, "split": "test" if date in test_set else "validation",
                "food_item": item, "food_category": cat, "attendance": int(attendance),
                "actual": int(row["quantity_served"]), "sold_out": bool(row["quantity_leftover"] == 0),
                "unit_cost": float(row["unit_cost"]),
                "old_pred": max(0, round(old_rate * attendance)),
                "new_pred": predict_demand(past, item, cat, attendance, target_date=date)["predicted_demand"],
                "prev_pred": predict_demand(past, item, cat, attendance, target_date=date,
                                            weekday_shrink=False,
                                            window=PREVIOUS_WINDOW_DAYS)["predicted_demand"],
                "baseline_prep": math.ceil(item_hist["quantity_prepared"].sum()
                                           / item_hist["attendance"].sum() * max(0, attendance)),
            })
    return pd.DataFrame(records)


def walk_forward_residuals(df, min_warmup_days=MIN_BACKTEST_WARMUP_DAYS):
    """Walk-forward rows plus rel_error = (actual - new_pred) / new_pred (rows with a zero
    prediction are dropped, since a relative error is undefined there)."""
    res = _walk_forward_predictions(df, min_warmup_days)
    if res.empty:
        return res
    res = res[res["new_pred"] > 0].copy()
    res["rel_error"] = (res["actual"] - res["new_pred"]) / res["new_pred"]
    return res


def _mae_summary(res, pred_col):
    abs_err = (res[pred_col] - res["actual"]).abs()
    mape = (abs_err / res["actual"].replace(0, np.nan)).mean() * 100
    return {"overall_mae_servings_per_day": round(float(abs_err.mean()), 2),
            "overall_mape_pct": round(float(mape), 1) if pd.notna(mape) else None,
            "mae_by_food": abs_err.groupby(res["food_item"]).mean().round(2).to_dict()}


def mae_report(df, min_warmup_days=MIN_BACKTEST_WARMUP_DAYS, test_days=TEST_DAYS):
    """The ship gate for the forecast: prediction accuracy (servings/day) of the all-time
    average ("old_method", the baseline) vs. the SHIPPED forecast ("new_method", last
    RECENT_WINDOW_DAYS days), scored on the HELD-OUT test window, with validation reported
    separately and the rejected weekday candidate scored alongside.

    Also reports a 95% bootstrap interval (resampling whole test days, fixed seed) for
    "new MAE minus old MAE", so a small difference isn't mistaken for a real one. A forecast
    change may ship only when new_beats_old_on_test is True.
    """
    res = _walk_forward_predictions(df, min_warmup_days, test_days)
    if res.empty:
        return {"n_predictions": 0, "old_method": None, "new_method": None}
    test, val = res[res["split"] == "test"], res[res["split"] == "validation"]

    def mean_abs(sub, col):
        return round(float((sub[col] - sub["actual"]).abs().mean()), 2)

    diff = (test["new_pred"] - test["actual"]).abs() - (test["old_pred"] - test["actual"]).abs()
    per_day = diff.groupby(test["date"]).sum().to_numpy()
    counts = test.groupby("date").size().to_numpy()
    idx = np.random.default_rng(0).integers(0, len(per_day), size=(2000, len(per_day)))
    boot = per_day[idx].sum(axis=1) / counts[idx].sum(axis=1)
    lo, hi = np.percentile(boot, [2.5, 97.5])
    shipped = (f"recent_{RECENT_WINDOW_DAYS}_days" if RECENT_WINDOW_DAYS else "all_time_average") + \
        ("_weekday" if USE_WEEKDAY_SHRINK else "")

    return {"n_predictions": int(len(test)),
            "window": {"test_start": str(test["date"].min().date()), "test_end": str(test["date"].max().date()),
                       "test_days": int(test["date"].nunique())},
            "old_method": _mae_summary(test, "old_pred"), "new_method": _mae_summary(test, "new_pred"),
            "new_minus_old_mae": round(float(diff.mean()), 2),
            "new_minus_old_mae_95ci": [round(float(lo), 2), round(float(hi), 2)],
            "new_beats_old_on_test": bool(diff.mean() < 0),
            "shipped_method": shipped,
            "shipped_mae_servings_per_day": mean_abs(test, "new_pred"),
            "previous_shipped": {
                "method": f"recent_{PREVIOUS_WINDOW_DAYS}_days",
                "test_mae": mean_abs(test, "prev_pred"),
                "validation_mae": mean_abs(val, "prev_pred") if len(val) else None},
            "new_beats_previous_on_test": bool(mean_abs(test, "new_pred") < mean_abs(test, "prev_pred")),
            "validation": None if val.empty else {
                "n_predictions": int(len(val)),
                "start": str(val["date"].min().date()), "end": str(val["date"].max().date()),
                "old_mae": mean_abs(val, "old_pred"), "new_mae": mean_abs(val, "new_pred")},
            "note": "Walk-forward: each prediction uses only data from before that day. 'old' = "
                    "all-time average share (the baseline); 'new' = the shipped forecast, the "
                    f"share over the last {RECENT_WINDOW_DAYS} school days, chosen on validation "
                    "schools in the synthetic simulation study. The test window (the last "
                    f"{test_days} school days) is the ship gate. Actual served on sold-out days is "
                    "a lower bound on demand.",
            "circularity_caveat": "This dataset is SYNTHETIC, generated with explicit weekday "
                    "and seasonal patterns by the same project that builds the forecasts. Treat "
                    "this as a demonstration of mechanics, not a real-world accuracy claim, until "
                    "it has been run against real records."}


SHORTAGE_PENALTY_MULTIPLIER = 3.0  # default: a missing serving costs 3x its own unit_cost
PROTECTED_MIN_BUFFER = 0.10        # guardrail: fruit/vegetable/dairy never prepped below forecast + 10%
MAX_BUFFER = 0.40
MIN_BUFFER_SAMPLES = 15            # backtest errors needed before trusting an error distribution


def service_level(shortage_penalty_multiplier=SHORTAGE_PENALTY_MULTIPLIER):
    """Newsvendor target share of days with enough food, for THIS cost model.

    total_cost = prep x unit_cost + shortage x unit_cost x m. One extra serving costs
    unit_cost for sure and saves unit_cost x m with probability P(demand > prep), so total
    cost is lowest where P(demand <= prep) = 1 - 1/m. With m <= 1 a shortage is no worse
    than the food it saves, so the math says "no buffer" (the floors below still apply).
    """
    m = shortage_penalty_multiplier
    return max(0.0, 1 - 1 / m) if m > 0 else 0.0


def newsvendor_buffer(rel_errors, food_category=None,
                      shortage_penalty_multiplier=SHORTAGE_PENALTY_MULTIPLIER):
    """Buffer = the service_level() quantile of past relative errors (actual / predicted - 1),
    so prep = forecast x (1 + buffer) covers that share of past days. Never below 0 (never
    prep below the forecast), never below PROTECTED_MIN_BUFFER for protected categories,
    never above MAX_BUFFER."""
    floor = PROTECTED_MIN_BUFFER if food_category in PROTECTED_CATEGORIES else 0.0
    buf = float(np.quantile(rel_errors, service_level(shortage_penalty_multiplier)))
    return float(np.clip(buf, floor, MAX_BUFFER))


SHORTAGE_FIRST_LEVEL = 0.90
# Default buffer rule. "shortage_first" was the cheapest strategy that kept shortages within
# 110% of the usual amount on VALIDATION schools in the simulation study, at 1x, 3x and 5x.
# "cost_optimal" (the plain newsvendor rule) cuts more leftovers but runs short far more.
DEFAULT_BUFFER_RULE = "shortage_first"
BUFFER_RULES = ("shortage_first", "cost_optimal")


def target_service_level(shortage_penalty_multiplier=SHORTAGE_PENALTY_MULTIPLIER,
                         buffer_rule=DEFAULT_BUFFER_RULE):
    """Share of days the buffer aims to cover. cost_optimal: 1 - 1/m (newsvendor).
    shortage_first: at least 90%, higher only if 1 - 1/m is higher (m above 10)."""
    m_level = service_level(shortage_penalty_multiplier)
    return m_level if buffer_rule == "cost_optimal" else max(SHORTAGE_FIRST_LEVEL, m_level)


def safety_buffer(rel_errors, food_category=None,
                  shortage_penalty_multiplier=SHORTAGE_PENALTY_MULTIPLIER,
                  buffer_rule=DEFAULT_BUFFER_RULE):
    """The buffer for one food under either rule. cost_optimal = newsvendor_buffer().
    shortage_first = the target_service_level() quantile of past errors, never below +5%
    (+10% for fruit/vegetable/milk), never above MAX_BUFFER."""
    if buffer_rule not in BUFFER_RULES:
        raise ValueError(f"buffer_rule must be one of {BUFFER_RULES}")
    if buffer_rule == "cost_optimal":
        return newsvendor_buffer(rel_errors, food_category, shortage_penalty_multiplier)
    floor = max(0.05, PROTECTED_MIN_BUFFER if food_category in PROTECTED_CATEGORIES else 0.0)
    level = target_service_level(shortage_penalty_multiplier, buffer_rule)
    return float(np.clip(np.quantile(rel_errors, level), floor, MAX_BUFFER))


def _pick_errors(item_errors, pooled_errors):
    """This food's own backtest errors if there are enough, else all foods' errors pooled,
    else None (callers then use the fixed default buffer)."""
    if len(item_errors) >= MIN_BUFFER_SAMPLES:
        return item_errors, "data_driven"
    if len(pooled_errors) >= MIN_BUFFER_SAMPLES:
        return pooled_errors, "data_driven_pooled"
    return None, None


def compute_data_driven_buffers(df, shortage_penalty_multiplier=SHORTAGE_PENALTY_MULTIPLIER,
                                residuals=None, min_warmup_days=MIN_BACKTEST_WARMUP_DAYS,
                                buffer_rule=DEFAULT_BUFFER_RULE):
    """Per-food buffers (see safety_buffer()) for LIVE planning, from the whole walk-forward backtest
    (every one of those days is genuinely in the past when planning a future day).

    Returns {food_item: {buffer, service_level_target, shortage_rate_estimate, low_pct,
    high_pct, samples, source, rel_errors}}. rel_errors are kept so plan_day() can price
    surplus AND shortage over the same error distribution the buffer was sized on.
    shortage_rate_estimate is in-sample (share of those same past days the buffer would
    have missed); the out-of-sample rate is in evaluate_methods().
    Pass residuals (from walk_forward_residuals()) to skip recomputing the backtest.
    """
    res = walk_forward_residuals(df, min_warmup_days) if residuals is None else residuals
    if res.empty:
        return {}
    pooled = res["rel_error"].to_numpy()
    buffers = {}
    for item, g in res.groupby("food_item"):
        errors, source = _pick_errors(g["rel_error"].to_numpy(), pooled)
        if errors is None:
            continue
        buf = safety_buffer(errors, g["food_category"].iloc[0], shortage_penalty_multiplier, buffer_rule)
        buffers[item] = {
            "buffer": round(buf, 3), "buffer_rule": buffer_rule,
            "service_level_target": round(target_service_level(shortage_penalty_multiplier, buffer_rule), 3),
            "shortage_rate_estimate": round(float((errors > buf).mean()), 3),
            "low_pct": round(float(np.percentile(errors, 10)) * 100, 1),
            "high_pct": round(float(np.percentile(errors, 90)) * 100, 1),
            "samples": int(len(errors)), "source": source,
            "rel_errors": [round(float(e), 4) for e in errors],
        }
    return buffers


def calculate_prep_quantity(predicted_demand, food_category=None, buffer=None,
                             food_item=None, buffers_table=None):
    """Predicted servings + safety buffer, rounded up to a whole serving.

    buffers_table (optional): output of compute_data_driven_buffers() -- if food_item has
    an entry there, its backtested buffer is used instead of the fixed defaults below.
    Returns (recommended_prep, buffer, buffer_source).
    """
    if buffer is not None:
        return math.ceil(max(0, predicted_demand) * (1 + buffer)), buffer, "manual"
    if buffers_table and food_item in buffers_table:
        entry = buffers_table[food_item]
        return (math.ceil(max(0, predicted_demand) * (1 + entry["buffer"])), entry["buffer"],
                entry.get("source", "data_driven"))
    buffer = PROTECTED_BUFFER if food_category in PROTECTED_CATEGORIES else SAFETY_BUFFER
    return math.ceil(max(0, predicted_demand) * (1 + buffer)), buffer, "fixed_default"


def calculate_costs(predicted_demand, recommended_prep, unit_cost, baseline_prep=None,
                     shortage_penalty_multiplier=SHORTAGE_PENALTY_MULTIPLIER):
    """Cost accounting for one food/day, for LunchLoop and (optionally) the baseline, both
    measured against the SAME demand figure. See README's "Cost model" section.

    predicted_demand is the demand both plans are measured against: the ACTUAL served count
    in evaluate_methods(), one demand scenario in expected_costs().

      served           = min(prepared, demand)
      surplus          = prepared - served      (unserved food; NOT plate waste)
      shortage         = demand - served        (students who wanted it and missed out)
      preparation_cost = prepared x unit_cost   (already INCLUDES the surplus's cost)
      shortage_cost    = shortage x unit_cost x shortage_penalty_multiplier (an ASSUMPTION)
      total_cost       = preparation_cost + shortage_cost

    surplus_cost is reported as the part of preparation_cost spent on unserved food; it is
    never added on top of total_cost (that would count it twice).
    """
    def side(prep, demand):
        served = min(prep, demand)
        surplus, shortage = prep - served, demand - served
        prep_cost = round(prep * unit_cost, 2)
        shortage_cost = round(shortage * unit_cost * shortage_penalty_multiplier, 2)
        return served, surplus, shortage, prep_cost, round(surplus * unit_cost, 2), shortage_cost, \
            round(prep_cost + shortage_cost, 2)

    demand = max(0, predicted_demand)
    served, surplus, shortage, prep_cost, surplus_cost, shortage_cost, total_cost = \
        side(max(0, recommended_prep), demand)
    result = {"estimated_served": served,
              "estimated_surplus": surplus, "estimated_surplus_cost": surplus_cost,
              "estimated_shortage": shortage, "estimated_shortage_cost": shortage_cost,
              "estimated_preparation_cost": prep_cost, "estimated_total_cost": total_cost,
              "shortage_penalty_multiplier": shortage_penalty_multiplier,
              "baseline_prep": baseline_prep, "baseline_served": None, "baseline_surplus": None,
              "baseline_shortage": None, "baseline_surplus_cost": None,
              "baseline_shortage_cost": None, "baseline_preparation_cost": None,
              "baseline_total_cost": None, "estimated_savings_vs_baseline": None,
              "estimated_savings_pct_vs_baseline": None}
    if baseline_prep is not None:
        b_served, b_surplus, b_shortage, b_prep_cost, b_surplus_cost, b_shortage_cost, b_total = \
            side(max(0, baseline_prep), demand)
        savings = round(b_total - total_cost, 2)
        result.update({
            "baseline_served": b_served, "baseline_surplus": b_surplus, "baseline_shortage": b_shortage,
            "baseline_surplus_cost": b_surplus_cost, "baseline_shortage_cost": b_shortage_cost,
            "baseline_preparation_cost": b_prep_cost, "baseline_total_cost": b_total,
            "estimated_savings_vs_baseline": savings,
            "estimated_savings_pct_vs_baseline": round(savings / b_total * 100, 1) if b_total > 0 else None,
        })
    return result


_AVERAGED_COST_KEYS = (
    "estimated_served", "estimated_surplus", "estimated_surplus_cost", "estimated_shortage",
    "estimated_shortage_cost", "estimated_preparation_cost", "estimated_total_cost",
    "baseline_served", "baseline_surplus", "baseline_shortage", "baseline_surplus_cost",
    "baseline_shortage_cost", "baseline_preparation_cost", "baseline_total_cost")


def expected_costs(predicted_demand, recommended_prep, unit_cost, baseline_prep=None,
                   shortage_penalty_multiplier=SHORTAGE_PENALTY_MULTIPLIER, rel_errors=None):
    """calculate_costs() averaged over demand scenarios forecast x (1 + each past backtest
    error), so a future day's surplus AND shortage are both priced, for LunchLoop and the
    baseline alike. Without errors it falls back to treating the forecast as exact, which
    can never show a LunchLoop shortage; that case is flagged cost_basis="point_forecast".
    """
    if rel_errors is None or len(rel_errors) == 0:
        out = calculate_costs(predicted_demand, recommended_prep, unit_cost, baseline_prep,
                              shortage_penalty_multiplier)
        out["cost_basis"] = "point_forecast"
        return out
    scenarios = [calculate_costs(max(0, round(predicted_demand * (1 + e))), recommended_prep,
                                 unit_cost, baseline_prep, shortage_penalty_multiplier)
                 for e in rel_errors]
    out = dict(scenarios[0])
    for key in _AVERAGED_COST_KEYS:
        if out[key] is not None:
            out[key] = round(float(np.mean([s[key] for s in scenarios])), 2)
    if out["baseline_total_cost"] is not None:
        savings = round(out["baseline_total_cost"] - out["estimated_total_cost"], 2)
        out["estimated_savings_vs_baseline"] = savings
        out["estimated_savings_pct_vs_baseline"] = (
            round(savings / out["baseline_total_cost"] * 100, 1) if out["baseline_total_cost"] > 0 else None)
    out["cost_basis"] = f"expected_over_{len(rel_errors)}_backtest_errors"
    return out


def evaluate_methods(df, min_warmup_days=MIN_BACKTEST_WARMUP_DAYS,
                      shortage_penalty_multiplier=SHORTAGE_PENALTY_MULTIPLIER, test_days=TEST_DAYS,
                      buffer_rule=DEFAULT_BUFFER_RULE):
    """Leak-free cost comparison of the baseline ("cook the usual amount per student") vs.
    LunchLoop, on the SAME held-out school days, against the ACTUAL served counts.

    For each scored day, using only data strictly before it: LunchLoop's forecast, its
    newsvendor buffer (sized on backtest errors from earlier days only), and the baseline
    prep. Both plans are then costed with calculate_costs() against what was actually
    served that day. Headline numbers ("overall", "per_food") are the TEST window only;
    "validation" is reported separately; "daily" lists every scored row with its split.

    Known bias: on sold-out days actual served is capped by what the kitchen made, so true
    demand is unknown and treated as = served. That hides shortages that likely happened
    on those days, for BOTH plans, which tends to flatter whichever plan prepares less.
    """
    m = shortage_penalty_multiplier
    splits = split_dates(df, min_warmup_days, test_days)
    wf = _walk_forward_predictions(df, min_warmup_days, test_days)
    excluded = [{"date": str(d.date()), "food_item": None, "reason": "warm-up period"}
                for d in splits["warmup"]]
    scored = set(zip(wf["date"], wf["food_item"])) if not wf.empty else set()
    for d in splits["validation"] + splits["test"]:
        for item in df.loc[df["date"] == d, "food_item"]:
            if (d, item) not in scored:
                excluded.append({"date": str(d.date()), "food_item": item,
                                 "reason": "insufficient prior history for this food"})
    if wf.empty:
        return {"evaluated_predictions": 0, "excluded": excluded, "daily": [], "per_food": {},
                "overall": {}, "validation": None, "synthetic_data": True}

    wf["rel_error"] = (wf["actual"] - wf["new_pred"]) / wf["new_pred"].replace(0, np.nan)
    waste_rates = BENCHMARKS["usda_plate_waste_by_category"]
    records, rule_totals = [], {}
    for row in wf.itertuples():
        prior = wf[(wf["date"] < row.date) & wf["rel_error"].notna()]
        errors, source = _pick_errors(prior.loc[prior["food_item"] == row.food_item, "rel_error"].to_numpy(),
                                      prior["rel_error"].to_numpy())
        if errors is None:
            prep, buf, source = calculate_prep_quantity(row.new_pred, row.food_category)
        else:
            buf = safety_buffer(errors, row.food_category, m, buffer_rule)
            prep = math.ceil(row.new_pred * (1 + buf))
        costs = calculate_costs(row.actual, prep, row.unit_cost, row.baseline_prep, m)
        rate = waste_rates.get(row.food_category)
        fixed_prep = calculate_prep_quantity(row.new_pred, row.food_category)[0]
        # Alternative buffer rules on the same forecast, for comparison only (not shipped).
        rule_preps = {
            "usual_amount": row.baseline_prep, "no_buffer": row.new_pred,
            "fixed_10_15pct": fixed_prep,
            **{rule: fixed_prep if errors is None else
               math.ceil(row.new_pred * (1 + safety_buffer(errors, row.food_category, m, rule)))
               for rule in BUFFER_RULES}}
        for rule, rule_prep in rule_preps.items():
            c = calculate_costs(row.actual, rule_prep, row.unit_cost, None, m)
            t = rule_totals.setdefault((row.split, rule), [0.0, 0, 0])
            t[0] += c["estimated_total_cost"]; t[1] += c["estimated_surplus"]; t[2] += c["estimated_shortage"]
        records.append({
            "date": str(row.date.date()), "split": row.split, "food_item": row.food_item,
            "food_category": row.food_category, "attendance": row.attendance,
            "actual_served": row.actual, "sold_out": row.sold_out,
            "predicted_demand": row.new_pred, "old_method_prediction": row.old_pred,
            "prediction_abs_error": abs(row.new_pred - row.actual),
            "buffer_used": round(buf, 3), "buffer_source": source, "recommended_prep": prep,
            "estimated_plate_waste_servings": round(costs["estimated_served"] * rate) if rate is not None else None,
            "baseline_estimated_plate_waste_servings": round(costs["baseline_served"] * rate) if rate is not None else None,
            **costs})
    res = pd.DataFrame(records)

    def agg(sub):
        baseline_total = round(float(sub["baseline_total_cost"].sum()), 2)
        lunchloop_total = round(float(sub["estimated_total_cost"].sum()), 2)
        savings = round(baseline_total - lunchloop_total, 2)
        return {
            "n": int(len(sub)),
            "baseline_total_cost": baseline_total, "lunchloop_total_cost": lunchloop_total,
            "baseline_food_cost": round(float(sub["baseline_preparation_cost"].sum()), 2),
            "lunchloop_food_cost": round(float(sub["estimated_preparation_cost"].sum()), 2),
            "baseline_shortage_cost": round(float(sub["baseline_shortage_cost"].sum()), 2),
            "lunchloop_shortage_cost": round(float(sub["estimated_shortage_cost"].sum()), 2),
            "estimated_savings_vs_baseline": savings,
            "estimated_savings_pct_vs_baseline": round(savings / baseline_total * 100, 1) if baseline_total > 0 else None,
            "estimated_surplus_servings": int(sub["estimated_surplus"].sum()),
            "estimated_shortage_servings": int(sub["estimated_shortage"].sum()),
            "baseline_surplus_servings": int(sub["baseline_surplus"].sum()),
            "baseline_shortage_servings": int(sub["baseline_shortage"].sum()),
            "lunchloop_days_short": int((sub["estimated_shortage"] > 0).sum()),
            "baseline_days_short": int((sub["baseline_shortage"] > 0).sum()),
            "estimated_plate_waste_servings": int(sub["estimated_plate_waste_servings"].sum()),
            "baseline_estimated_plate_waste_servings": int(sub["baseline_estimated_plate_waste_servings"].sum()),
            "sold_out_rows": int(sub["sold_out"].sum()),
            "mae_servings_per_day": round(float(sub["prediction_abs_error"].mean()), 2),
            "old_method_mae_servings_per_day": round(float((sub["old_method_prediction"] - sub["actual_served"]).abs().mean()), 2),
        }

    test, val = res[res["split"] == "test"], res[res["split"] == "validation"]
    overall = agg(test)
    overall.update({"evaluated_days": int(test["date"].nunique()),
                    "window_start": test["date"].min(), "window_end": test["date"].max(),
                    "shortage_penalty_multiplier": m, "buffer_rule": buffer_rule,
                    "service_level_target": round(target_service_level(m, buffer_rule), 3)})
    return {
        "evaluated_predictions": int(len(test)), "excluded": excluded,
        "daily": res.to_dict("records"),
        "per_food": {item: agg(sub) for item, sub in test.groupby("food_item")},
        "overall": overall, "validation": agg(val) if len(val) else None,
        "buffer_rules": {split: {rule: {"total_cost": round(t[0], 2), "surplus_servings": int(t[1]),
                                        "shortage_servings": int(t[2])}
                                 for (sp, rule), t in rule_totals.items() if sp == split}
                         for split in ("validation", "test")},
        "buffer_rules_note": f"Same forecast, same days, different prep rules. {buffer_rule} is the "
                "rule used for the headline numbers. shortage_first aims to have enough on 90% of "
                "days; cost_optimal is the newsvendor rule (1 - 1/multiplier). no_buffer breaks "
                "the +10% fruit/vegetable/milk floor and runs short most often, so it is not a "
                "valid choice even when it is cheapest.",
        "synthetic_data": True,
        "note": "Baseline and LunchLoop are scored on the SAME held-out test days against the "
                "ACTUAL served counts, using only data from before each day (forecast, buffer "
                "and baseline alike). Food cost already includes surplus; shortage cost is "
                "added once; plate waste is a separate external-benchmark estimate and is not "
                "in any cost. On sold-out days true demand is unknown and treated as = served, "
                "which hides likely shortages for both plans. A simulation over synthetic data "
                "shows how the system behaves under its own assumptions; it does NOT prove "
                "real-world savings at an actual school.",
        "circularity_caveat": ("This dataset is SYNTHETIC and was generated with the same kind "
                "of weekday/seasonal structure this method looks for; treat these numbers as a "
                "demonstration of mechanics, not a real-world accuracy or savings claim."),
    }


def plan_month(df, year, month, menu=None, buffers_table=None,
                shortage_penalty_multiplier=SHORTAGE_PENALTY_MULTIPLIER, buffer_rule=DEFAULT_BUFFER_RULE):
    """Plan every school day in a calendar month by calling plan_day() once per day,
    then roll the results up into monthly per-food and overall totals.

    This is a month of separate daily predictions, not a single model fit to a month,
    so each day still carries its own weekday-based attendance estimate and its own
    confidence/notes. Returns a JSON-friendly dict for FastAPI -> React.
    """
    import calendar
    last_day = calendar.monthrange(year, month)[1]
    days = school_days(f"{year}-{month:02d}-01", f"{year}-{month:02d}-{last_day:02d}")
    if not days:
        return {"year": year, "month": month, "school_days": 0, "daily_plans": [],
                "per_food_totals": [], "totals": {}, "assumptions": []}

    daily_plans = [plan_day(df, target_date=day, menu=menu, buffers_table=buffers_table,
                             shortage_penalty_multiplier=shortage_penalty_multiplier,
                             buffer_rule=buffer_rule) for day in days]

    by_food = {}
    for day_plan in daily_plans:
        for item in day_plan["items"]:
            agg = by_food.setdefault(item["food_item"], {
                "food_item": item["food_item"], "food_category": item["food_category"],
                "total_predicted_demand": 0, "total_recommended_prep": 0,
                "total_estimated_surplus": 0, "total_estimated_surplus_cost": 0.0,
                "total_estimated_shortage": 0, "total_estimated_shortage_cost": 0.0,
                "total_estimated_preparation_cost": 0.0, "total_estimated_total_cost": 0.0,
                "total_baseline_surplus_cost": 0.0, "total_baseline_shortage_cost": 0.0,
                "total_baseline_preparation_cost": 0.0, "total_baseline_total_cost": 0.0,
                "total_estimated_savings_vs_baseline": 0.0,
                "total_baseline_prep": 0, "total_baseline_surplus": 0, "total_baseline_shortage": 0,
                "total_estimated_plate_waste_servings": 0, "total_estimated_plate_waste_cost": 0.0,
                "has_baseline": False,
            })
            agg["total_predicted_demand"] += item["predicted_demand"]
            agg["total_recommended_prep"] += item["recommended_prep"]
            agg["total_estimated_surplus"] += item["estimated_surplus"]
            agg["total_estimated_surplus_cost"] += item["estimated_surplus_cost"]
            agg["total_estimated_shortage"] += item["estimated_shortage"]
            agg["total_estimated_shortage_cost"] += item["estimated_shortage_cost"]
            agg["total_estimated_preparation_cost"] += item["estimated_preparation_cost"]
            agg["total_estimated_total_cost"] += item["estimated_total_cost"]
            if item["estimated_plate_waste_servings"] is not None:
                agg["total_estimated_plate_waste_servings"] += item["estimated_plate_waste_servings"]
                agg["total_estimated_plate_waste_cost"] += item["estimated_plate_waste_cost"]
            if item["baseline_total_cost"] is not None:
                agg["has_baseline"] = True
                agg["total_baseline_prep"] += item["baseline_prep"]
                agg["total_baseline_surplus"] += item["baseline_surplus"]
                agg["total_baseline_shortage"] += item["baseline_shortage"]
                agg["total_baseline_surplus_cost"] += item["baseline_surplus_cost"]
                agg["total_baseline_shortage_cost"] += item["baseline_shortage_cost"]
                agg["total_baseline_preparation_cost"] += item["baseline_preparation_cost"]
                agg["total_baseline_total_cost"] += item["baseline_total_cost"]
                agg["total_estimated_savings_vs_baseline"] += item["estimated_savings_vs_baseline"]

    per_food_totals = []
    for agg in by_food.values():
        if not agg.pop("has_baseline"):
            for key in ("total_baseline_prep", "total_baseline_surplus", "total_baseline_shortage"):
                agg[key] = None
            agg["total_baseline_surplus_cost"] = None
            agg["total_baseline_shortage_cost"] = None
            agg["total_baseline_preparation_cost"] = None
            agg["total_baseline_total_cost"] = None
            agg["total_estimated_savings_vs_baseline"] = None
            agg["total_estimated_savings_pct_vs_baseline"] = None
        else:
            agg["total_baseline_surplus_cost"] = round(agg["total_baseline_surplus_cost"], 2)
            agg["total_baseline_shortage_cost"] = round(agg["total_baseline_shortage_cost"], 2)
            agg["total_baseline_preparation_cost"] = round(agg["total_baseline_preparation_cost"], 2)
            agg["total_baseline_total_cost"] = round(agg["total_baseline_total_cost"], 2)
            agg["total_estimated_savings_vs_baseline"] = round(agg["total_estimated_savings_vs_baseline"], 2)
            agg["total_estimated_savings_pct_vs_baseline"] = (
                round(agg["total_estimated_savings_vs_baseline"] / agg["total_baseline_total_cost"] * 100, 1)
                if agg["total_baseline_total_cost"] > 0 else None)
        for key in ("total_estimated_surplus", "total_estimated_shortage",
                    "total_baseline_surplus", "total_baseline_shortage"):
            if agg[key] is not None:
                agg[key] = round(agg[key], 1)
        agg["total_estimated_surplus_cost"] = round(agg["total_estimated_surplus_cost"], 2)
        agg["total_estimated_shortage_cost"] = round(agg["total_estimated_shortage_cost"], 2)
        agg["total_estimated_preparation_cost"] = round(agg["total_estimated_preparation_cost"], 2)
        agg["total_estimated_total_cost"] = round(agg["total_estimated_total_cost"], 2)
        agg["total_estimated_plate_waste_cost"] = round(agg["total_estimated_plate_waste_cost"], 2)
        per_food_totals.append(agg)

    compared = [f for f in per_food_totals if f["total_baseline_total_cost"] is not None]
    baseline_total = round(sum(f["total_baseline_total_cost"] or 0 for f in per_food_totals), 2)
    total_cost_compared = round(sum(f["total_estimated_total_cost"] for f in compared), 2)
    savings = round(baseline_total - total_cost_compared, 2)
    totals = {
        "estimated_surplus_cost_all_items": round(sum(f["total_estimated_surplus_cost"] for f in per_food_totals), 2),
        "estimated_preparation_cost_all_items": round(sum(f["total_estimated_preparation_cost"] for f in per_food_totals), 2),
        "estimated_total_cost_all_items": round(sum(f["total_estimated_total_cost"] for f in per_food_totals), 2),
        "estimated_total_cost_compared_items": total_cost_compared,
        "baseline_surplus_cost": round(sum(f["total_baseline_surplus_cost"] or 0 for f in per_food_totals), 2),
        "baseline_total_cost": baseline_total,
        "estimated_savings_vs_baseline": savings,
        "estimated_savings_pct_vs_baseline": round(savings / baseline_total * 100, 1) if baseline_total > 0 else None,
        "shortage_penalty_multiplier": shortage_penalty_multiplier,
        "service_level_target": round(target_service_level(shortage_penalty_multiplier, buffer_rule), 3),
        "buffer_rule": buffer_rule,
    }
    return {
        "year": year, "month": month, "school_days": len(days),
        "synthetic_data": True,
        "daily_plans": [{"date": day.strftime("%Y-%m-%d"),
                          "expected_attendance": p["expected_attendance"],
                          "estimated_surplus_cost": round(sum(it["estimated_surplus_cost"] for it in p["items"]), 2)}
                         for day, p in zip(days, daily_plans)],
        "per_food_totals": per_food_totals,
        "totals": totals,
        "assumptions": daily_plans[0]["assumptions"] + [
            "Monthly totals are 1-20+ separate daily predictions added together, not one model "
            "fit to the month, so each day still carries its own weekday-based attendance estimate.",
        ],
    }


def summarize_history(df):
    """Per-food averages straight from the CSV: attendance, prepared, served, leftover,
    and the leftover rate (leftover / prepared). Used for the dashboard's "history at a
    glance" view, not for predictions.
    """
    grouped = df.groupby(["food_item", "food_category"], as_index=False).agg(
        days_recorded=("date", "nunique"),
        avg_attendance=("attendance", "mean"),
        avg_prepared=("quantity_prepared", "mean"),
        avg_served=("quantity_served", "mean"),
        avg_leftover=("quantity_leftover", "mean"),
    )
    grouped["leftover_rate"] = grouped["avg_leftover"] / grouped["avg_prepared"]
    return grouped.round(2).to_dict("records")


def plan_day(df, expected_attendance=None, target_date=None, menu=None, buffers_table=None,
             shortage_penalty_multiplier=SHORTAGE_PENALTY_MULTIPLIER, buffer_rule=DEFAULT_BUFFER_RULE):
    """Plan one day. menu = list of {"food_item", "food_category", "unit_cost"(optional)}.

    expected_attendance: pass a number if you already know it (e.g. from a head count
    or RSVP system). Leave it as None and pass target_date to have LunchLoop estimate
    attendance from that weekday's history instead (e.g. Fridays run lower). target_date
    also lets predict_demand() use that weekday's history (e.g. "pizza Friday").
    buffers_table (optional): output of compute_data_driven_buffers() for the SAME
    shortage_penalty_multiplier -- newsvendor buffers used instead of the fixed 10%/15%
    defaults where available, plus the backtest errors used to price expected costs.
    shortage_penalty_multiplier: see calculate_costs() -- a configurable assumption, not
    a measured cost.
    If menu is None, every food in the history is planned.
    Returns a plain dict (JSON-friendly) for FastAPI -> React.

    BASELINE: "baseline_prep" is a PROXY for "what the kitchen would normally have done",
    computed as this food's all-time historical (prepared / attendance) ratio, scaled to
    expected_attendance -- it is NOT a separately measured real-world baseline, just the
    best stand-in available from the same history used for prediction. It requires at
    least MIN_RECORDS past days for that food; foods without that history have no
    baseline_* fields (None), not a silently-assumed zero.
    """
    attendance_note = None
    if expected_attendance is None:
        attendance_pred = predict_attendance(df, target_date)
        expected_attendance = attendance_pred["expected_attendance"]
        attendance_note = attendance_pred["note"]

    if menu is None:
        menu = (df.drop_duplicates("food_item")[["food_item", "food_category"]]
                .to_dict("records"))
    waste_rates = BENCHMARKS["usda_plate_waste_by_category"]
    items = []
    for entry in menu:
        name, cat = entry["food_item"], entry.get("food_category")
        hist = df[df["food_item"] == name]
        unit_cost = entry.get("unit_cost")
        if unit_cost is None and len(hist):
            unit_cost = float(hist["unit_cost"].iloc[-1])
        if unit_cost is None:
            unit_cost = 0.0  # unknown cost: surplus cost will show as 0, flagged in the note

        pred = predict_demand(df, name, cat, expected_attendance, target_date)
        prep, buffer, buffer_source = calculate_prep_quantity(
            pred["predicted_demand"], cat, food_item=name, buffers_table=buffers_table)

        baseline = None
        if len(hist) >= MIN_RECORDS:
            baseline = math.ceil(hist["quantity_prepared"].sum() / hist["attendance"].sum()
                                 * max(0, expected_attendance))
        buffer_info = (buffers_table.get(name) if buffers_table and buffer_source.startswith("data_driven")
                       else None)
        # Expected surplus/shortage over this food's own backtest errors (the same errors the
        # buffer was sized on), for LunchLoop and baseline alike.
        costs = expected_costs(pred["predicted_demand"], prep, unit_cost, baseline,
                               shortage_penalty_multiplier,
                               rel_errors=buffer_info["rel_errors"] if buffer_info else None)

        # Estimated plate waste: an EXTERNAL benchmark rate (see BENCHMARKS) applied to the
        # servings we expect to hand out. Not measured locally, and never added to any cost.
        waste_rate = waste_rates.get(cat)
        est_plate_waste = round(costs["estimated_served"] * waste_rate) if waste_rate is not None else None
        est_plate_waste_cost = round(est_plate_waste * unit_cost, 2) if est_plate_waste is not None else None

        note = pred["note"]
        if cat in PROTECTED_CATEGORIES:
            note += (f" Nutritious item: buffer is never below {PROTECTED_MIN_BUFFER:.0%}; "
                     "some surplus is expected.")
        if buffer_info:
            note += (f" Buffer +{buffer:.0%} targets enough food on {buffer_info['service_level_target']:.0%} "
                     f"of days (shortage counted as {shortage_penalty_multiplier}x unit cost); in the "
                     f"backtest it would have run short on {buffer_info['shortage_rate_estimate']:.0%} "
                     "of days. That is a deliberate tradeoff, not an error.")
        items.append({"food_item": name, "food_category": cat,
                      "predicted_demand": pred["predicted_demand"],
                      "recommended_prep": prep, "buffer_used": buffer, "buffer_source": buffer_source,
                      "shortage_rate_estimate": buffer_info["shortage_rate_estimate"] if buffer_info else None,
                      "estimated_plate_waste_servings": est_plate_waste,
                      "estimated_plate_waste_cost": est_plate_waste_cost,
                      "unit_cost": round(unit_cost, 2), **costs,
                      "method": pred["method"], "confidence": pred["confidence"], "note": note})

    def total(key):
        vals = [i[key] for i in items if i[key] is not None]
        return round(sum(vals), 2)

    # Fair comparison: only foods that have a baseline (new foods have none), and TOTAL cost
    # (preparation + shortage) on both sides -- comparing surplus cost alone would make a
    # baseline that ran short look free, since an unpriced shortage isn't "no cost".
    compared = [i for i in items if i["baseline_total_cost"] is not None]
    total_cost_compared = round(sum(i["estimated_total_cost"] for i in compared), 2)
    baseline_total_cost = total("baseline_total_cost")
    savings = round(baseline_total_cost - total_cost_compared, 2)
    return {
        "expected_attendance": expected_attendance,
        "attendance_note": attendance_note,
        "synthetic_data": True,
        "items": items,
        "totals": {"estimated_surplus_cost_all_items": total("estimated_surplus_cost"),
                   "estimated_preparation_cost_all_items": total("estimated_preparation_cost"),
                   "estimated_total_cost_all_items": total("estimated_total_cost"),
                   "estimated_total_cost_compared_items": total_cost_compared,
                   "baseline_surplus_cost": total("baseline_surplus_cost"),
                   "baseline_total_cost": baseline_total_cost,
                   "estimated_savings_vs_baseline": savings,
                   "estimated_savings_pct_vs_baseline": (
                       round(savings / baseline_total_cost * 100, 1) if baseline_total_cost > 0 else None),
                   "estimated_surplus_servings": total("estimated_surplus"),
                   "estimated_shortage_servings": total("estimated_shortage"),
                   "baseline_surplus_servings": total("baseline_surplus"),
                   "baseline_shortage_servings": total("baseline_shortage"),
                   "estimated_plate_waste_servings": total("estimated_plate_waste_servings"),
                   "shortage_penalty_multiplier": shortage_penalty_multiplier,
                   "service_level_target": round(target_service_level(shortage_penalty_multiplier, buffer_rule), 3),
                   "buffer_rule": buffer_rule,
                   "foods_without_baseline": [i["food_item"] for i in items if i["baseline_total_cost"] is None]},
        "assumptions": [
            "Data is SYNTHETIC. unit_cost values are assumptions (popcorn chicken ~$0.58 is "
            "based on a real district nutrition report).",
            "quantity_served = portions served, not food eaten. Plate waste is not measured "
            "locally and is not the same quantity as unserved surplus (see estimated_plate_waste_*).",
            "baseline_prep is a PROXY (this food's all-time historical prepared/attendance ratio, "
            "scaled to expected_attendance), not a separately measured real-world baseline. Foods "
            "with no history have no baseline at all (None), not an assumed zero.",
            "Cost model: estimated_total_cost = (recommended_prep x unit_cost) + shortage_cost. "
            "Surplus cost is reported separately for visibility but is NOT added on top of total "
            "cost a second time -- it's already part of preparation cost. Savings compare TOTAL "
            "cost (preparation + shortage) against the baseline's total cost, so a baseline that "
            "historically under-prepared carries a shortage cost here, not a free pass.",
            f"shortage_penalty_multiplier (currently {shortage_penalty_multiplier}) values a missing "
            "serving at that many times its own unit_cost -- a configurable ASSUMPTION, not a "
            "measured stockout cost (a real shortage also costs goodwill, nutrition, and staff "
            "time that aren't priced here). Try other multipliers to see how sensitive the "
            "comparison is to this choice.",
            f"Buffer rule '{buffer_rule}': prepare enough for "
            f"{target_service_level(shortage_penalty_multiplier, buffer_rule):.0%} of days, read off "
            "each food's walk-forward forecast errors. shortage_first (default) aims for at least "
            "90% of days; cost_optimal uses the newsvendor rule 1 - 1/multiplier. Never below "
            f"the forecast, never below +{PROTECTED_MIN_BUFFER:.0%} for fruit/vegetable/dairy, "
            f"never above +{MAX_BUFFER:.0%}. buffers_table must be built with the same rule.",
            "Surplus, shortage and savings are EXPECTED values: averaged over demand scenarios "
            "built from past forecast errors (cost_basis says which). Foods without enough "
            "backtest history fall back to treating the forecast as exact (cost_basis = "
            "point_forecast), which cannot show a LunchLoop shortage.",
            "Sold-out days are kept in each food's demand estimate; served on those days is "
            "only a lower bound on demand.",
            "estimated_plate_waste_* applies an external USDA benchmark rate to the servings we "
            "expect to hand out; it is not measured from this cafeteria's own data and is never "
            "added to any cost.",
        ],
    }
