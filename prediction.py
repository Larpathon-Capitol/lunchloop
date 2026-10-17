"""TrayTrack stage 1: demand prediction + prep quantities + surplus costs.

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


WEEKDAY_WINDOW = 8        # use at most the last 8 occurrences of the matching weekday
MIN_WEEKDAY_SAMPLES = 4    # need at least this many to trust a weekday-specific rate
RECENT_WINDOW_DAYS = 25    # else, use at most the last 25 (non-sold-out) days overall
MIN_RECENT_SAMPLES = 8     # need at least this many to trust that recent-window rate


def _estimate_serve_rate(clean_hist, target_date=None):
    """The actual rate estimate behind predict_demand(), once a food has enough history.

    Cascades from most to least specific, each needing a minimum sample size to trust it:
    1. same-weekday, most recent WEEKDAY_WINDOW occurrences (catches "pizza Friday" and
       slow seasonal drift, since recent same-weekday rows already track both).
    2. most recent RECENT_WINDOW_DAYS overall (catches a trend/season when weekday-specific
       data is too thin, e.g. a food that's new enough to have few Fridays yet).
    3. the item's whole history (the original, simplest estimate).
    clean_hist must already have sold-out days excluded and be sorted by date ascending.
    """
    if target_date is not None:
        weekday = pd.Timestamp(target_date).weekday()
        same_weekday = clean_hist[clean_hist["date"].dt.weekday == weekday].tail(WEEKDAY_WINDOW)
        if len(same_weekday) >= MIN_WEEKDAY_SAMPLES:
            rate = same_weekday["quantity_served"].sum() / same_weekday["attendance"].sum()
            day_name = pd.Timestamp(target_date).strftime("%A")
            return rate, "weekday_recent", (f"Based on the last {len(same_weekday)} {day_name}s: "
                                             f"{rate:.1%} of attending students took it.")

    recent = clean_hist.tail(RECENT_WINDOW_DAYS)
    if len(recent) >= MIN_RECENT_SAMPLES:
        rate = recent["quantity_served"].sum() / recent["attendance"].sum()
        return rate, "recent_window", (f"Based on the last {len(recent)} days: "
                                        f"{rate:.1%} of attending students took it.")

    rate = clean_hist["quantity_served"].sum() / clean_hist["attendance"].sum()
    return rate, "history_scaled_by_attendance", (f"Based on all {len(clean_hist)} past days: "
                                                   f"{rate:.1%} of attending students took it.")


def predict_demand(df, food_item, food_category=None, expected_attendance=None, target_date=None):
    """Predict how many servings of one food students will want.

    Example: 120 served out of 200 attending, expected attendance 250
             -> (120 / 200) x 250 = 150 servings.
    Pass target_date to let the estimate use the matching weekday's recent history
    (e.g. Fridays) instead of just an all-time average. Returns a dict (never negative).
    """
    hist = df[df["food_item"] == food_item].sort_values("date")
    sold_out_mask = hist["quantity_leftover"] == 0
    sold_out = int(sold_out_mask.sum())
    # Sold-out days are excluded from the rate estimate: quantity_served there is capped by
    # what was prepared, not by what students wanted, so including them biases the rate low.
    clean = hist[~sold_out_mask]
    typical_attendance = df["attendance"].mean()
    attendance = typical_attendance if expected_attendance is None else max(0, expected_attendance)

    if len(hist) >= MIN_RECORDS and len(clean) > 0:
        rate, method, note = _estimate_serve_rate(clean, target_date)
        predicted = rate * attendance
        confidence = "ok"
        if expected_attendance is None:
            note += " No expected attendance given, so typical attendance was used."
        if sold_out:
            note += (f" {sold_out} day(s) sold out and were excluded from this estimate "
                     "(served was capped by what was prepared), so true demand may be a "
                     "bit higher than even this suggests.")
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


def _walk_forward_predictions(df, min_warmup_days=MIN_BACKTEST_WARMUP_DAYS):
    """Walk-forward backtest engine, shared by mae_report() and compute_data_driven_buffers().

    For each school day (after a warm-up period) and each food already established by then,
    predicts that day's demand using ONLY data strictly before that date -- both with the
    OLD all-time-average method (for comparison) and the current weekday/recency method --
    then records the actual quantity_served. This is what "predicting the future from the
    past" actually looks like; it's the only honest way to measure prediction error, since
    scoring a method against days it was fitted on overstates how good it is.

    Returns a DataFrame with one row per (date, food_item) that had enough prior history to
    be scored at all: columns date, food_item, attendance, actual, old_pred, new_pred.
    """
    dates = sorted(df["date"].unique())
    records = []
    for i, date in enumerate(dates):
        if i < min_warmup_days:
            continue
        past = df[df["date"] < date]
        today = df[df["date"] == date]
        for _, row in today.iterrows():
            item, cat, attendance, actual = (row["food_item"], row["food_category"],
                                              row["attendance"], row["quantity_served"])
            item_hist = past[past["food_item"] == item]
            if len(item_hist) < MIN_RECORDS:
                continue  # this food itself is still in its own warm-up period
            old_rate = item_hist["quantity_served"].sum() / item_hist["attendance"].sum()
            old_pred = old_rate * attendance
            new_pred = predict_demand(past, item, cat, attendance, target_date=date)["predicted_demand"]
            records.append({"date": date, "food_item": item, "attendance": attendance,
                             "actual": actual, "old_pred": old_pred, "new_pred": new_pred})
    return pd.DataFrame(records)


def mae_report(df, min_warmup_days=MIN_BACKTEST_WARMUP_DAYS):
    """Backtested mean absolute error (servings/day), old all-time method vs. the current
    weekday+recency method, overall and per food. This is the number for "how accurate is
    this, really" -- computed from this exact dataset, not assumed.
    """
    res = _walk_forward_predictions(df, min_warmup_days)
    if res.empty:
        return {"n_predictions": 0, "old_method": None, "new_method": None}

    def summarize(pred_col):
        abs_err = (res[pred_col] - res["actual"]).abs()
        per_food = (abs_err.groupby(res["food_item"]).mean()).round(2).to_dict()
        mape = (abs_err / res["actual"].replace(0, np.nan)).mean() * 100
        return {"overall_mae_servings_per_day": round(abs_err.mean(), 2),
                "overall_mape_pct": round(mape, 1) if pd.notna(mape) else None,
                "mae_by_food": per_food}

    return {"n_predictions": int(len(res)), "old_method": summarize("old_pred"),
            "new_method": summarize("new_pred"),
            "note": "Walk-forward: each prediction uses only data from before that day. "
                    "'old' = the original all-time-average method; 'new' = weekday+recency, "
                    "with sold-out days excluded from the rate estimate.",
            "circularity_caveat": "This dataset is SYNTHETIC, generated with explicit weekday "
                    "and seasonal patterns (e.g. a 'pizza Friday' bump) by the same codebase that "
                    "built 'new_method' to look for exactly that kind of pattern. The error "
                    "reduction above shows the method can recover patterns it was designed to "
                    "find in data it was designed to find them in -- not how it would perform at "
                    "a real school. Treat it as a demonstration that the method works as intended, "
                    "not as a real-world accuracy claim, until it's been run against real records."}


def compute_data_driven_buffers(df, percentile=90, min_buffer=0.05, max_buffer=0.40,
                                 min_samples=15, min_warmup_days=MIN_BACKTEST_WARMUP_DAYS):
    """Backtested, per-food safety buffers, replacing the fixed 10%/15% defaults.

    For each food with enough backtested days, sets the buffer so that `percentile`% of
    those PAST days would have had enough food prepared (i.e. actual <= predicted *
    (1 + buffer)); the other (100 - percentile)% are an accepted, estimated shortfall rate --
    "prepare for the 90th percentile day" rather than guessing a flat percentage.
    Returns {food_item: {buffer, shortage_rate_estimate, low_pct, high_pct, samples}}.
    Foods without min_samples backtested days are left out (callers fall back to the fixed
    default for those).
    """
    res = _walk_forward_predictions(df, min_warmup_days)
    if res.empty:
        return {}
    res = res[res["new_pred"] > 0].copy()
    res["rel_error"] = (res["actual"] - res["new_pred"]) / res["new_pred"]

    buffers = {}
    for item, g in res.groupby("food_item"):
        if len(g) < min_samples:
            continue
        buf = float(np.clip(np.percentile(g["rel_error"], percentile), min_buffer, max_buffer))
        shortage_rate = float((g["rel_error"] > buf).mean())
        buffers[item] = {
            "buffer": round(buf, 3),
            "shortage_rate_estimate": round(shortage_rate, 3),
            "low_pct": round(float(np.percentile(g["rel_error"], 10)) * 100, 1),
            "high_pct": round(float(np.percentile(g["rel_error"], 90)) * 100, 1),
            "samples": int(len(g)),
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
        buffer = buffers_table[food_item]["buffer"]
        return math.ceil(max(0, predicted_demand) * (1 + buffer)), buffer, "data_driven"
    buffer = PROTECTED_BUFFER if food_category in PROTECTED_CATEGORIES else SAFETY_BUFFER
    return math.ceil(max(0, predicted_demand) * (1 + buffer)), buffer, "fixed_default"


SHORTAGE_PENALTY_MULTIPLIER = 1.0  # default: value a missing serving at 1x its own unit_cost


def calculate_costs(predicted_demand, recommended_prep, unit_cost, baseline_prep=None,
                     shortage_penalty_multiplier=SHORTAGE_PENALTY_MULTIPLIER):
    """Cost accounting for one food/day, compared with a baseline. See README's "Cost model"
    section for the full writeup; in short:

      preparation_cost = prepared servings x unit_cost.  This ALREADY INCLUDES the cost of
          any surplus (unserved) servings -- they were still prepared and paid for. Adding
          surplus_cost again on top of preparation_cost would double-count it.
      shortage_cost = shortage servings x unit_cost x shortage_penalty_multiplier.  An
          ADDITIONAL cost layered on top of a (lower) preparation cost when demand isn't
          met. shortage_penalty_multiplier is a configurable ASSUMPTION, not a measured
          stockout cost -- a real shortage also costs goodwill, nutrition, and staff time
          that aren't priced here; the default (1.0) just values a missing serving the same
          as its own ingredient cost. Pass other multipliers to see the comparison's
          sensitivity to this assumption (see sensitivity_report() below).
      total_cost = preparation_cost + shortage_cost.

    surplus/shortage are also returned as plain serving counts, and surplus_cost is reported
    as an informational breakdown of how much of preparation_cost is tied up in waste -- it
    is NOT summed into total_cost separately.

    predicted_demand is the model's own estimate, not a measured ground truth (actual demand
    is unobservable whenever a food sells out) -- both this plan's and the baseline's surplus
    and shortage are measured against this SAME estimate, so the comparison is apples-to-apples
    even though the yardstick itself is uncertain. All figures here are ESTIMATES.
    """
    predicted_demand = max(0, predicted_demand)
    recommended_prep = max(0, recommended_prep)
    surplus = max(0, recommended_prep - predicted_demand)
    shortage = max(0, predicted_demand - recommended_prep)
    prep_cost = round(recommended_prep * unit_cost, 2)
    surplus_cost = round(surplus * unit_cost, 2)
    shortage_cost = round(shortage * unit_cost * shortage_penalty_multiplier, 2)
    total_cost = round(prep_cost + shortage_cost, 2)

    result = {"estimated_surplus": surplus, "estimated_surplus_cost": surplus_cost,
              "estimated_shortage": shortage, "estimated_shortage_cost": shortage_cost,
              "estimated_preparation_cost": prep_cost, "estimated_total_cost": total_cost,
              "shortage_penalty_multiplier": shortage_penalty_multiplier,
              "baseline_prep": baseline_prep, "baseline_surplus_cost": None,
              "baseline_shortage_cost": None, "baseline_preparation_cost": None,
              "baseline_total_cost": None, "estimated_savings_vs_baseline": None,
              "estimated_savings_pct_vs_baseline": None}
    if baseline_prep is not None:
        baseline_prep = max(0, baseline_prep)
        baseline_surplus = max(0, baseline_prep - predicted_demand)
        baseline_shortage = max(0, predicted_demand - baseline_prep)
        baseline_prep_cost = round(baseline_prep * unit_cost, 2)
        baseline_surplus_cost = round(baseline_surplus * unit_cost, 2)
        baseline_shortage_cost = round(baseline_shortage * unit_cost * shortage_penalty_multiplier, 2)
        baseline_total_cost = round(baseline_prep_cost + baseline_shortage_cost, 2)
        savings = round(baseline_total_cost - total_cost, 2)
        savings_pct = round(savings / baseline_total_cost * 100, 1) if baseline_total_cost > 0 else None
        result.update({
            "baseline_surplus_cost": baseline_surplus_cost,
            "baseline_shortage_cost": baseline_shortage_cost,
            "baseline_preparation_cost": baseline_prep_cost,
            "baseline_total_cost": baseline_total_cost,
            "estimated_savings_vs_baseline": savings,
            "estimated_savings_pct_vs_baseline": savings_pct,
        })
    return result


def evaluate_methods(df, min_warmup_days=MIN_BACKTEST_WARMUP_DAYS,
                      shortage_penalty_multiplier=SHORTAGE_PENALTY_MULTIPLIER):
    """Leak-free, cost-focused evaluation of the baseline vs. the LunchLoop prediction-based
    plan, on the SAME held-out school days, using the SAME (model-estimated) demand yardstick
    for both methods.

    For each school day after the warm-up, and each food with enough prior history: predicts
    that day's demand using only data strictly before it, computes the recommended prep using
    the FIXED default safety buffer (10%/15%, NOT compute_data_driven_buffers()), and computes
    both methods' costs via calculate_costs() against the baseline (that food's historical
    prepared/attendance ratio, using only data strictly before that day too).

    Why the fixed buffer here specifically: compute_data_driven_buffers() tunes itself on the
    WHOLE dataset. Using it inside this same walk-forward evaluation would leak
    future-relative-to-day-N information into day N's score and let the method "pass its own
    exam" -- exactly the kind of circularity this function exists to avoid. The data-driven
    buffer remains a separate, legitimate feature for LIVE planning (where "all current
    history" genuinely is all past data), just not for evaluating against that same history.

    Returns per-day rows, a per-food aggregate, an overall aggregate (total costs, savings $
    and %, surplus, shortage, prediction MAE), and which days/foods were excluded and why.
    Every number here comes from the SYNTHETIC dataset -- see synthetic_data/circularity_caveat.
    """
    dates = sorted(df["date"].unique())
    records, excluded = [], []
    for i, date in enumerate(dates):
        if i < min_warmup_days:
            excluded.append({"date": str(pd.Timestamp(date).date()), "food_item": None,
                              "reason": "warm-up period"})
            continue
        past = df[df["date"] < date]
        today = df[df["date"] == date]
        for _, row in today.iterrows():
            item, cat = row["food_item"], row["food_category"]
            attendance, actual_served = row["attendance"], row["quantity_served"]
            item_hist = past[past["food_item"] == item]
            if len(item_hist) < MIN_RECORDS:
                excluded.append({"date": str(pd.Timestamp(date).date()), "food_item": item,
                                  "reason": "insufficient prior history for this food"})
                continue
            pred = predict_demand(past, item, cat, attendance, target_date=date)
            predicted_demand = pred["predicted_demand"]
            recommended_prep, _buf, _src = calculate_prep_quantity(predicted_demand, cat)
            baseline_prep = math.ceil(item_hist["quantity_prepared"].sum()
                                       / item_hist["attendance"].sum() * max(0, attendance))
            costs = calculate_costs(predicted_demand, recommended_prep, float(row["unit_cost"]),
                                     baseline_prep, shortage_penalty_multiplier=shortage_penalty_multiplier)
            records.append({"date": str(pd.Timestamp(date).date()), "food_item": item,
                             "food_category": cat, "attendance": int(attendance),
                             "actual_served": int(actual_served), "sold_out": bool(row["quantity_leftover"] == 0),
                             "predicted_demand": predicted_demand, "recommended_prep": recommended_prep,
                             "baseline_prep": baseline_prep, "prediction_abs_error": abs(predicted_demand - actual_served),
                             **costs})

    if not records:
        return {"evaluated_predictions": 0, "excluded": excluded, "daily": [], "per_food": {},
                "overall": {}, "synthetic_data": True}

    res = pd.DataFrame(records)

    def agg(sub):
        baseline_total = round(sub["baseline_total_cost"].sum(), 2)
        lunchloop_total = round(sub["estimated_total_cost"].sum(), 2)
        savings = round(baseline_total - lunchloop_total, 2)
        return {
            "n": int(len(sub)),
            "baseline_total_cost": baseline_total, "lunchloop_total_cost": lunchloop_total,
            "estimated_savings_vs_baseline": savings,
            "estimated_savings_pct_vs_baseline": round(savings / baseline_total * 100, 1) if baseline_total > 0 else None,
            "estimated_surplus_servings": int(sub["estimated_surplus"].sum()),
            "estimated_shortage_servings": int(sub["estimated_shortage"].sum()),
            "baseline_surplus_servings": int((sub["baseline_prep"] - sub["predicted_demand"]).clip(lower=0).sum()),
            "baseline_shortage_servings": int((sub["predicted_demand"] - sub["baseline_prep"]).clip(lower=0).sum()),
            "mae_servings_per_day": round(sub["prediction_abs_error"].mean(), 2),
        }

    per_food = {item: agg(sub) for item, sub in res.groupby("food_item")}
    overall = agg(res)
    overall["evaluated_days"] = int(res["date"].nunique())
    overall["shortage_penalty_multiplier"] = shortage_penalty_multiplier

    return {
        "evaluated_predictions": int(len(res)), "excluded": excluded,
        "daily": res.to_dict("records"), "per_food": per_food, "overall": overall,
        "synthetic_data": True,
        "note": "Baseline and LunchLoop are scored on the SAME held-out days, using only data "
                "from before each day, with the FIXED default buffer (not the data-driven one, "
                "to avoid tuning on the same data being evaluated). A simulation over synthetic "
                "data demonstrates how the system behaves under its own assumptions -- it does "
                "NOT prove real-world savings at an actual school.",
        "circularity_caveat": ("This dataset is SYNTHETIC and was generated with the same kind "
                "of weekday/seasonal structure this method looks for; treat these numbers as a "
                "demonstration of mechanics, not a real-world accuracy or savings claim."),
    }


def plan_month(df, year, month, menu=None, buffers_table=None,
                shortage_penalty_multiplier=SHORTAGE_PENALTY_MULTIPLIER):
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
                             shortage_penalty_multiplier=shortage_penalty_multiplier) for day in days]

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
                agg["total_baseline_surplus_cost"] += item["baseline_surplus_cost"]
                agg["total_baseline_shortage_cost"] += item["baseline_shortage_cost"]
                agg["total_baseline_preparation_cost"] += item["baseline_preparation_cost"]
                agg["total_baseline_total_cost"] += item["baseline_total_cost"]
                agg["total_estimated_savings_vs_baseline"] += item["estimated_savings_vs_baseline"]

    per_food_totals = []
    for agg in by_food.values():
        if not agg.pop("has_baseline"):
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
             shortage_penalty_multiplier=SHORTAGE_PENALTY_MULTIPLIER):
    """Plan one day. menu = list of {"food_item", "food_category", "unit_cost"(optional)}.

    expected_attendance: pass a number if you already know it (e.g. from a head count
    or RSVP system). Leave it as None and pass target_date to have TrayTrack estimate
    attendance from that weekday's history instead (e.g. Fridays run lower). target_date
    also lets predict_demand() use that weekday's recent history (e.g. "pizza Friday").
    buffers_table (optional): output of compute_data_driven_buffers() -- backtested,
    per-food safety buffers used instead of the fixed 10%/15% defaults where available.
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
        costs = calculate_costs(pred["predicted_demand"], prep, unit_cost, baseline,
                                 shortage_penalty_multiplier=shortage_penalty_multiplier)

        # Estimated plate waste: an EXTERNAL benchmark rate (see BENCHMARKS) applied to our
        # own predicted servings. Not measured locally -- surplus already covers that.
        waste_rate = waste_rates.get(cat)
        est_plate_waste = round(pred["predicted_demand"] * waste_rate) if waste_rate is not None else None
        est_plate_waste_cost = round(est_plate_waste * unit_cost, 2) if est_plate_waste is not None else None

        note = pred["note"]
        if cat in PROTECTED_CATEGORIES:
            note += " Nutritious item: kept on the menu with a larger buffer; some surplus is expected."
        buffer_info = buffers_table.get(name) if buffers_table and buffer_source == "data_driven" else None
        if buffer_info:
            note += (f" Buffer sized to the backtested 90th-percentile day: on an estimated "
                      f"{buffer_info['shortage_rate_estimate']:.0%} of days, this is expected to "
                      "run short anyway -- that's a deliberate tradeoff, not an error.")
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
                   "shortage_penalty_multiplier": shortage_penalty_multiplier,
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
            "Buffers are sized to the backtested 90th-percentile day on purpose: each food is "
            "expected to run a little short on roughly 10% of days (see shortage_rate_estimate) "
            "rather than being buffered against every possible spike.",
            "Foods that sold out are excluded from their own demand estimate (served was capped "
            "by what was prepared there), not just flagged -- but demand on those days is still "
            "an ESTIMATE, not a known quantity.",
            "estimated_plate_waste_* applies an external USDA benchmark rate to our predicted "
            "servings; it is not measured from this cafeteria's own data.",
        ],
    }
