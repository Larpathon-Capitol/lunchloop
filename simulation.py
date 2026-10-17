"""SYNTHETIC multi-scenario simulation study for LunchLoop prep strategies.

Everything here is made up on purpose: no real cafeteria records exist for this project.
The point is to see how prep strategies behave across many plausible schools, not to
prove anything about a real one.

Why simulate at all: in the real-style CSV, demand is unknown on sold-out days (served is
capped by what was made), so shortages can only be guessed. A simulated school knows its
own TRUE demand every day, so every strategy's leftovers and shortages can be scored
exactly, while the strategies themselves only ever see what a real kitchen would see
(attendance, prepared, served).

Pipeline:
  simulate_school()     one synthetic school in the same CSV columns, plus true_demand
  run_simulation_study() many schools x 5 scenario families x train/validation/test seeds:
      1. TRAIN seeds tune per-food buffers (cost-optimal and shortage-capped),
      2. VALIDATION seeds choose the "best" strategy (by cost, and within a shortage limit),
      3. TEST seeds (never used to choose anything) are what gets reported.
"""
import math

import numpy as np
import pandas as pd

from prediction import (safety_buffer, target_service_level, school_days, _pick_errors,
                        PROTECTED_CATEGORIES, PROTECTED_MIN_BUFFER, SAFETY_BUFFER,
                        PROTECTED_BUFFER, BUFFER_RULES, RECENT_WINDOW_DAYS,
                        PREVIOUS_WINDOW_DAYS, WEEKDAY_SHRINK_K, SHORTAGE_FIRST_LEVEL, DEFAULT_BUFFER_RULE)

# name, category, base share of attending students, unit cost. Shares and costs match the
# synthetic CSV (data/cafeteria_history_synthetic.csv) so both datasets describe the same
# imaginary cafeteria.
FOODS = [
    ("Cheese Pizza", "main", 0.346, 0.85),
    ("Chicken Nuggets", "main", 0.234, 0.70),
    ("Popcorn Chicken", "main", 0.199, 0.58),
    ("Steamed Carrots", "vegetable", 0.295, 0.25),
    ("Fruit Cup", "fruit", 0.433, 0.40),
    ("Chocolate Milk", "dairy", 0.308, 0.40),
]

# Demand assumptions per scenario family. All are ASSUMPTIONS, chosen to span calm to messy:
#   noise    day-to-day demand noise (log sd)
#   drift    popularity random walk per day (log sd)
#   trend    max popularity trend over the whole period (+/-, log scale)
#   weekday  sd of each food's own weekday effects
#   shock_p  chance per food per day of an unexpected one-day change of +/- shock
#   shift_p  chance per food of a permanent level change (e.g. a recipe change) mid-period
SCENARIOS = {
    "steady":        dict(noise=0.06, drift=0.000, trend=0.05, weekday=0.04, shock_p=0.00, shock=0.00, shift_p=0.0),
    "typical":       dict(noise=0.10, drift=0.008, trend=0.10, weekday=0.08, shock_p=0.03, shock=0.30, shift_p=0.2),
    "volatile":      dict(noise=0.18, drift=0.012, trend=0.10, weekday=0.08, shock_p=0.08, shock=0.45, shift_p=0.5),
    "trending":      dict(noise=0.10, drift=0.015, trend=0.35, weekday=0.08, shock_p=0.03, shock=0.30, shift_p=0.3),
    "weekday_heavy": dict(noise=0.10, drift=0.008, trend=0.10, weekday=0.20, shock_p=0.03, shock=0.30, shift_p=0.2),
}

KITCHEN_MARGIN = 0.20   # simulated kitchen cooks its running average + 20%: ~10% sell-outs, ~17% leftovers (see README)
WARMUP_DAYS = 10        # days of history before any strategy is scored
# "recent" = the shipped forecast (last RECENT_WINDOW_DAYS days x shrunk weekday factor);
# "prev" = the previous shipped forecast (last PREVIOUS_WINDOW_DAYS days), kept for comparison.
BUFFER_GRID = np.round(np.arange(0.0, 0.5001, 0.025), 3)
SHORTAGE_LIMIT = 1.00   # the goal: no more short servings than the usual amount (and no more short rows)
TRADEOFF_LEVELS = (0.80, 0.90, 0.94, 0.97, 0.99)   # coverage levels drawn on the trade-off curve


def simulate_school(family="typical", seed=0, n_days=80):
    """One SYNTHETIC school: n_days school days x 6 foods, in the same columns as the CSV
    plus true_demand (what students actually wanted; only a simulation can know this).

    quantity_prepared comes from a simulated kitchen that cooks its running average share
    + KITCHEN_MARGIN (it does NOT know the day's demand), so sell-outs happen naturally and
    served = min(prepared, true_demand), just like real records.
    """
    p = SCENARIOS[family]
    rng = np.random.default_rng([list(SCENARIOS).index(family), seed])
    dates = school_days("2026-08-31", "2027-06-30")[:n_days]
    wd = np.array([d.weekday() for d in dates])
    t = np.arange(n_days)

    base_att = rng.uniform(340, 460)
    att = base_att * np.array([1.0, 1.0, 1.0, 0.99, 0.95])[wd] * np.exp(rng.normal(0, 0.03, n_days))
    att *= np.where(rng.random(n_days) < 0.03, rng.uniform(0.75, 0.9, n_days), 1.0)  # field trips, flu days
    att = np.maximum(1, np.round(att)).astype(int)

    rows = []
    for name, cat, share, cost in FOODS:
        weekday_eff = rng.normal(0, p["weekday"], 5)
        weekday_eff -= weekday_eff.mean()
        popularity = (np.cumsum(rng.normal(0, p["drift"], n_days))
                      + rng.uniform(-p["trend"], p["trend"]) * t / n_days)
        if rng.random() < p["shift_p"]:
            popularity[rng.integers(n_days // 4, n_days):] += np.log(rng.uniform(0.75, 1.3))
        shocks = np.where(rng.random(n_days) < p["shock_p"],
                          rng.choice([-1, 1], n_days) * rng.uniform(p["shock"] / 2, p["shock"] + 1e-9, n_days), 0)
        noise = rng.normal(-p["noise"] ** 2 / 2, p["noise"], n_days)
        mean = att * share * rng.uniform(0.85, 1.15) * np.exp(popularity + weekday_eff[wd] + shocks + noise)
        demand = np.maximum(0, np.round(mean)).astype(int)

        prepared = np.zeros(n_days, int)
        served = np.zeros(n_days, int)
        first_guess = share * rng.uniform(0.85, 1.15)
        for i in range(n_days):
            ratio = first_guess if i < 5 else served[:i].sum() / att[:i].sum()
            prepared[i] = math.ceil(ratio * (1 + KITCHEN_MARGIN) * att[i])
            served[i] = min(prepared[i], demand[i])
        for i in range(n_days):
            rows.append((dates[i], name, cat, int(att[i]), int(prepared[i]), int(served[i]),
                         int(prepared[i] - served[i]), cost, int(demand[i])))
    df = pd.DataFrame(rows, columns=["date", "food_item", "food_category", "attendance",
                                     "quantity_prepared", "quantity_served", "quantity_leftover",
                                     "unit_cost", "true_demand"])
    df.attrs.update(synthetic=True, family=family, seed=seed)
    return df


def _fixed_buffer(cat):
    return PROTECTED_BUFFER if cat in PROTECTED_CATEGORIES else SAFETY_BUFFER


def _school_rows(df, multipliers):
    """Walk-forward prep for every strategy in one simulated school, using only what a real
    kitchen could see before each day (attendance that morning, past prepared and served).
    Mirrors prediction.py: same forecasts, safety_buffer() for both rules, _pick_errors()."""
    foods = list(df["food_item"].unique())
    by_food = {f: g.sort_values("date") for f, g in df.groupby("food_item")}
    n = len(by_food[foods[0]])
    att = by_food[foods[0]]["attendance"].to_numpy()
    srv = np.array([by_food[f]["quantity_served"].to_numpy() for f in foods])
    prep_hist = np.array([by_food[f]["quantity_prepared"].to_numpy() for f in foods])
    cum_att = np.concatenate([[0], np.cumsum(att)])
    cum_srv = np.concatenate([np.zeros((len(foods), 1)), np.cumsum(srv, axis=1)], axis=1)
    cum_prep = np.concatenate([np.zeros((len(foods), 1)), np.cumsum(prep_hist, axis=1)], axis=1)

    wd = np.array([d.weekday() for d in by_food[foods[0]]["date"]])

    def window_rate(i, window):
        lo = max(0, i - window)
        return (cum_srv[:, i] - cum_srv[:, lo]) / (cum_att[i] - cum_att[lo])

    def weekday_factor(i):
        # Mirrors prediction._estimate_serve_rate(): that weekday's ratio to the all-days
        # rate, shrunk toward 1 by n / (n + WEEKDAY_SHRINK_K).
        same = wd[:i] == wd[i]
        n_same = int(same.sum())
        if n_same == 0:
            return np.ones(len(foods))
        all_rate = cum_srv[:, i] / cum_att[i]
        ratio = np.divide(srv[:, :i][:, same].sum(axis=1) / att[:i][same].sum(), all_rate,
                          out=np.ones(len(foods)), where=all_rate > 0)
        w = n_same / (n_same + WEEKDAY_SHRINK_K)
        return w * ratio + (1 - w)

    days = range(WARMUP_DAYS, n)
    f_all = {i: np.maximum(0, np.round(cum_srv[:, i] / cum_att[i] * att[i])) for i in days}
    f_prev = {i: np.maximum(0, np.round(window_rate(i, PREVIOUS_WINDOW_DAYS) * att[i])) for i in days}
    f_rec = {i: np.maximum(0, np.round(window_rate(i, RECENT_WINDOW_DAYS) * weekday_factor(i) * att[i]))
             for i in days}
    # Observable errors (served / forecast - 1), exactly what the live system can measure.
    err_all = np.full((len(foods), n), np.nan)
    err_rec = np.full((len(foods), n), np.nan)
    for i in days:
        ok = f_all[i] > 0
        err_all[ok, i] = srv[ok, i] / f_all[i][ok] - 1
        ok = f_rec[i] > 0
        err_rec[ok, i] = srv[ok, i] / f_rec[i][ok] - 1

    out = []
    for i in days:
        for k, food in enumerate(foods):
            g = by_food[food].iloc[i]
            cat = g["food_category"]
            row = {"food_item": food, "food_category": cat, "day": i, "attendance": int(att[i]),
                   "served": int(srv[k, i]), "true_demand": int(g["true_demand"]),
                   "unit_cost": float(g["unit_cost"]), "f_all": f_all[i][k], "f_prev": f_prev[i][k], "f_recent": f_rec[i][k],
                   "prep_usual": math.ceil(cum_prep[k, i] / cum_att[i] * att[i]),
                   "prep_fixed": math.ceil(f_all[i][k] * (1 + _fixed_buffer(cat)))}
            for tag, fc, err in (("all", f_all[i][k], err_all), ("recent", f_rec[i][k], err_rec)):
                item = err[k, WARMUP_DAYS:i]
                errors, _ = _pick_errors(item[~np.isnan(item)], err[:, WARMUP_DAYS:i][~np.isnan(err[:, WARMUP_DAYS:i])])
                for rule in BUFFER_RULES:
                    for m in multipliers:
                        buf = _fixed_buffer(cat) if errors is None else safety_buffer(errors, cat, m, rule)
                        row[f"prep_{tag}_{rule}_{m:g}x"] = math.ceil(fc * (1 + buf))
                if tag == "recent":
                    for lv in TRADEOFF_LEVELS:
                        buf = (_fixed_buffer(cat) if errors is None
                               else safety_buffer(errors, cat, 3.0, "shortage_first", level=lv))
                        row[f"prep_level_{lv:g}"] = math.ceil(fc * (1 + buf))
            out.append(row)
    return out


def _metrics(sub, prep_col, m):
    prep, demand, cost = sub[prep_col].to_numpy(), sub["true_demand"].to_numpy(), sub["unit_cost"].to_numpy()
    served = np.minimum(prep, demand)
    leftover, shortage = prep - served, demand - served
    food_cost = float((prep * cost).sum())
    shortage_cost = float((shortage * cost * m).sum())
    return {"leftover_servings": int(leftover.sum()), "shortage_servings": int(shortage.sum()),
            "days_short": int((shortage > 0).sum()), "fill_rate_pct": round(served.sum() / max(1, demand.sum()) * 100, 2),
            "food_cost": round(food_cost, 2), "shortage_cost": round(shortage_cost, 2),
            "total_cost": round(food_cost + shortage_cost, 2)}


def _tune_per_food(train, multipliers, forecast_col):
    """Per-food buffers from TRAIN schools only (the chosen forecast, static % buffer).
    cost_optimal[m][food]: the grid buffer with the lowest train total cost at m.
    shortage_capped[food]: the SMALLEST grid buffer (fewest leftovers) whose train shortages
    stay within SHORTAGE_LIMIT x the usual amount's train shortages for that food.
    Fruit/vegetable/milk never go below PROTECTED_MIN_BUFFER (same guardrail as live)."""
    cost_optimal = {m: {} for m in multipliers}
    capped, capped_ok = {}, {}
    for food, g in train.groupby("food_item"):
        cat = g["food_category"].iloc[0]
        grid = BUFFER_GRID[BUFFER_GRID >= (PROTECTED_MIN_BUFFER if cat in PROTECTED_CATEGORIES else 0)]
        f, d, c = g[forecast_col].to_numpy(), g["true_demand"].to_numpy(), g["unit_cost"].to_numpy()
        preps = np.ceil(np.outer(1 + grid, f))                     # grid x rows
        short = np.maximum(0, d - preps)
        for m in multipliers:
            costs = (preps * c).sum(axis=1) + (short * c * m).sum(axis=1)
            cost_optimal[m][food] = float(grid[int(np.argmin(costs))])
        usual_short = np.maximum(0, d - g["prep_usual"].to_numpy()).sum()
        fits = np.nonzero(short.sum(axis=1) <= SHORTAGE_LIMIT * usual_short)[0]
        capped[food] = float(grid[fits[0]] if len(fits) else grid[-1])
        capped_ok[food] = bool(len(fits))
    return cost_optimal, capped, capped_ok


STRATEGY_LABELS = {
    "usual": "Cooking the usual amount (baseline)",
    "fixed": "All-time average + fixed 10% / 15%",
    "all_cost_optimal": "All-time average + cost-optimal buffer (previous LunchLoop)",
    "all_shortage_first": "All-time average + shortage-first buffer",
    "recent_cost_optimal": "LunchLoop forecast + cost-optimal buffer",
    "recent_shortage_first": "LunchLoop forecast + shortage-first buffer",
    "per_food_cost_tuned": "Chosen forecast + per-food buffer tuned for cost",
    "per_food_shortage_capped": "Chosen forecast + per-food buffer capped at baseline shortages",
}


def run_simulation_study(n_train=6, n_val=6, n_test=12, n_days=80, multipliers=(1.0, 3.0, 5.0)):
    """The full study. Returns a JSON-friendly dict; every number in it is SYNTHETIC."""
    splits = {"train": range(0, n_train), "validation": range(n_train, n_train + n_val),
              "test": range(n_train + n_val, n_train + n_val + n_test)}
    frames = []
    for family in SCENARIOS:
        for split, seeds in splits.items():
            for seed in seeds:
                rows = pd.DataFrame(_school_rows(simulate_school(family, seed, n_days), multipliers))
                rows["family"], rows["seed"], rows["split"] = family, seed, split
                frames.append(rows)
    rows = pd.concat(frames, ignore_index=True)

    # Step 1: pick the forecast on VALIDATION schools (MAE vs true demand).
    val_rows = rows[rows["split"] == "validation"]
    forecast_col = min(("f_all", "f_prev", "f_recent"),
                       key=lambda c: (val_rows[c] - val_rows["true_demand"]).abs().mean())
    # Step 2: tune per-food buffers on TRAIN schools with that forecast.
    cost_optimal, capped, capped_ok = _tune_per_food(rows[rows["split"] == "train"], multipliers, forecast_col)
    for m in multipliers:
        b = rows["food_item"].map(cost_optimal[m])
        rows[f"prep_per_food_cost_tuned_{m:g}x"] = np.ceil(rows[forecast_col] * (1 + b)).astype(int)
    rows["prep_per_food_shortage_capped"] = np.ceil(rows[forecast_col] * (1 + rows["food_item"].map(capped))).astype(int)

    def col(strategy, m):
        return f"prep_{strategy}_{m:g}x" if f"prep_{strategy}_{m:g}x" in rows else f"prep_{strategy}"

    def table(sub, m):
        out = {}
        usual = _metrics(sub, "prep_usual", m)
        for s in STRATEGY_LABELS:
            r = _metrics(sub, col(s, m), m)
            r["savings_vs_usual"] = round(usual["total_cost"] - r["total_cost"], 2)
            r["savings_pct_vs_usual"] = round(r["savings_vs_usual"] / usual["total_cost"] * 100, 2)
            r["leftover_change_pct"] = round((r["leftover_servings"] / usual["leftover_servings"] - 1) * 100, 1)
            r["shortage_vs_usual_ratio"] = (round(r["shortage_servings"] / usual["shortage_servings"], 2)
                                            if usual["shortage_servings"] else None)
            r["short_rows_vs_usual_ratio"] = (round(r["days_short"] / usual["days_short"], 2)
                                              if usual["days_short"] else None)
            # The goal: fewer leftovers AND no more short servings AND no more short rows.
            r["beats_usual_on_all_three"] = bool(
                s != "usual" and r["leftover_servings"] < usual["leftover_servings"]
                and r["shortage_servings"] <= SHORTAGE_LIMIT * usual["shortage_servings"]
                and r["days_short"] <= SHORTAGE_LIMIT * usual["days_short"])
            out[s] = r
        return out

    def tradeoff(sub):
        usual = _metrics(sub, "prep_usual", 3.0)
        out = {}
        for lv in TRADEOFF_LEVELS:
            r = {"fill_rate_pct": None, "savings_pct_vs_usual": {}}
            for m in multipliers:
                x, u = _metrics(sub, f"prep_level_{lv:g}", m), _metrics(sub, "prep_usual", m)
                r["savings_pct_vs_usual"][f"{m:g}x"] = round((u["total_cost"] - x["total_cost"]) / u["total_cost"] * 100, 2)
            x = _metrics(sub, f"prep_level_{lv:g}", 3.0)
            r.update({"fill_rate_pct": x["fill_rate_pct"],
                      "leftover_change_pct": round((x["leftover_servings"] / usual["leftover_servings"] - 1) * 100, 1),
                      "shortage_vs_usual_ratio": round(x["shortage_servings"] / usual["shortage_servings"], 2),
                      "short_rows_vs_usual_ratio": round(x["days_short"] / usual["days_short"], 2)})
            out[f"{lv:g}"] = r
        return out

    results = {}
    for m in multipliers:
        by_split = {sp: table(rows[rows["split"] == sp], m) for sp in splits}
        val = by_split["validation"]
        best_cost = min(val, key=lambda s: val[s]["total_cost"])
        dominating = [s for s in val if val[s]["beats_usual_on_all_three"]]
        best_dominating = min(dominating, key=lambda s: val[s]["total_cost"]) if dominating else None
        test = rows[rows["split"] == "test"]
        results[f"{m:g}x"] = {
            "shortage_penalty_multiplier": m,
            "service_level_target": {r: round(target_service_level(m, r), 3) for r in BUFFER_RULES},
            "by_split": by_split,
            "test_by_family": {fam: table(test[test["family"] == fam], m) for fam in SCENARIOS},
            "chosen_on_validation": {"best_by_cost": best_cost, "best_dominating": best_dominating,
                                     "dominating_strategies": dominating},
        }

    def mae(sub, fc):
        return {"vs_true_demand": round(float((sub[fc] - sub["true_demand"]).abs().mean()), 2),
                "vs_served": round(float((sub[fc] - sub["served"]).abs().mean()), 2)}
    names = {"all_time_average": "f_all", "previous_last_20_days": "f_prev", "lunchloop_forecast": "f_recent"}
    forecast_mae = {sp: {k: mae(rows[rows["split"] == sp], c) for k, c in names.items()} for sp in splits}
    test = rows[rows["split"] == "test"]
    forecast_mae["test_by_family"] = {fam: {k: mae(test[test["family"] == fam], c) for k, c in names.items()}
                                      for fam in SCENARIOS}
    return {
        "synthetic_data": True,
        "config": {"schools_per_family": {k: len(v) for k, v in splits.items()}, "families": SCENARIOS,
                   "days_per_school": n_days, "scored_days_per_school": n_days - WARMUP_DAYS,
                   "foods": [f[0] for f in FOODS], "shortage_limit": SHORTAGE_LIMIT,
                   "shipped_strategy": f"recent_{DEFAULT_BUFFER_RULE}",
                   "shipped_coverage_level": SHORTAGE_FIRST_LEVEL,
                   "kitchen_margin": KITCHEN_MARGIN},
        "strategy_labels": STRATEGY_LABELS,
        "chosen_forecast_on_validation": {"f_all": "all_time_average", "f_prev": "previous_last_20_days",
                                          "f_recent": "lunchloop_forecast"}[forecast_col],
        "tuned_buffers": {"per_food_cost_tuned": {f"{m:g}x": cost_optimal[m] for m in multipliers},
                          "per_food_shortage_capped": capped,
                          "shortage_cap_reachable_on_train": capped_ok},
        "forecast_mae": forecast_mae,
        "coverage_tradeoff": {sp: tradeoff(rows[rows["split"] == sp]) for sp in ("validation", "test")},
        "results": results,
        "assumptions": [
            "All schools are SYNTHETIC. Demand shares and unit costs match the synthetic CSV; "
            "noise, drift, trends, weekday effects, shocks and level shifts are assumptions "
            "(see config.families).",
            "Leftovers and shortages are scored against TRUE simulated demand. Strategies only "
            "see what a real kitchen sees: attendance that morning and past prepared/served.",
            "Every strategy is scored on the same days, but the history they learn from was "
            "generated by one simulated kitchen policy (its running average + 20%), so its "
            "sell-outs shape what every strategy sees.",
            "Per-food buffers are tuned on TRAIN schools only; the best strategy is chosen on "
            "VALIDATION schools only; TEST schools are only reported.",
            "Shortage cost = missing servings x unit cost x multiplier (1x, 3x, 5x): an "
            "assumption, not a measured cost of a student going without.",
        ],
    }
