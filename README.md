# TrayTrack (prototype)

Predicts how much of each cafeteria food to prepare, using each food's history of
what share of attending students actually took it. Estimates the surplus and its
cost compared with the kitchen's historical prep-per-student baseline, backtests
its own accuracy, and can project a full month ahead.

## Setup

```
pip install -r requirements.txt
```

## Run the checks

```
python test_prototype.py   # core prediction/backtest/validation logic, prints a sample-day plan
python test_api.py         # FastAPI endpoints, via TestClient (no server needed)
```

Both print `ALL CHECKS PASSED` / `ALL API CHECKS PASSED` on success.

## Run the API

```
python -m uvicorn app:app --port 8000
```

(`python -m uvicorn ...` rather than bare `uvicorn ...` avoids a "command not found"
on setups where pip's script shim isn't on `PATH`.)

Then open `http://127.0.0.1:8000/` for the dashboard, or `/docs` for interactive
endpoint testing:

```
curl -X POST http://127.0.0.1:8000/plan -H "Content-Type: application/json" \
  -d "{\"expected_attendance\": 410}"
```

### Endpoints

- `GET /summary` — plain historical averages per food, straight from the CSV.
- `GET /accuracy` — backtested MAE, old all-time method vs. the current method (pure
  prediction accuracy; see "How accuracy is measured").
- `GET /evaluate` — leak-free walk-forward evaluation of baseline vs. LunchLoop **costs**
  on the same held-out days (see "Cost model" and "How the evaluation works"). Optional
  `?shortage_penalty_multiplier=`.
- `GET /plan/sensitivity?expected_attendance=410` — the same sample day re-planned under
  5 different shortage-penalty assumptions (0.5×–3×), side by side.
- `GET /buffers` — backtested, per-food safety buffers and their shortage-rate estimate.
- `GET /data-quality` — results of `validate_history()` against the loaded CSV.
- `POST /plan` — one day's plan. Takes `expected_attendance` (a number you already
  know) or `target_date` (a `YYYY-MM-DD` string — attendance *and* demand are then
  estimated from that weekday's recent history, e.g. "pizza Friday"). Optional `menu`
  list overrides which foods are planned; optional `shortage_penalty_multiplier`
  (default 1.0) — see "Cost model".
- `POST /plan/month` — a whole calendar month (`year`, `month`), rolled up from one
  `/plan`-equivalent call per school day. Same optional fields as `/plan`.

## Files

- `data/cafeteria_history_synthetic.csv` — synthetic history (see below). `load_data()` expects it at this path.
- `prediction.py` — all prediction/backtest/validation logic, documented inline.
- `app.py` — FastAPI wrapper + dashboard, exposing the endpoints above.
- `test_prototype.py`, `test_api.py` — runnable checks for the two layers above.

## The dataset

204 rows: 6 real school foods (cheese pizza, chicken nuggets, popcorn chicken,
steamed carrots, fruit cup, chocolate milk) over 34 real school days (Aug 31 – Oct
16, 2026, weekdays minus Labor Day). It is **synthetic**, but calibrated against
real figures:

- **The history stops the day before "today."** An earlier version of this dataset
  ran through June 2027 — a full fabricated school year. That's wrong on its face:
  a "history" file can't contain measured rows for days that haven't happened yet,
  and having them silently made every backtest and every `/plan/month` call partly
  circular (predicting "the future" from data that already encoded it). The 2026-27
  school year's later months (Nov 2026 onward) are deliberately **not** in this file
  — that's what `/plan/month` is *for*.
- Attendance dips on Fridays, and grows slowly over the year (enrollment trend) —
  consistent with typical school attendance patterns. (A winter flu-season dip is
  coded in the generator for if/when the window is later extended into Dec–Feb, but
  doesn't affect this 34-day window at all.)
- Per-food demand share has its own weekday story (not just one global curve):
  "pizza Friday" (+5 points on top of the base share), popcorn chicken trending
  slightly more popular over time.
- Leftovers average ~10–15% of what's prepared — **not** calibrated to any plate-waste
  study (see "Issues found and fixed" below for why that was removed).
- Popcorn chicken's unit cost (~$0.58) comes from a real district nutrition report;
  other unit costs are assumptions.
- ~6% of rows sell out (`quantity_leftover == 0`), more often for popcorn chicken and
  Friday pizza, to exercise the sold-out handling described below.

## What's measured vs. estimated

- **Measured in a real cafeteria:** `attendance`, `quantity_prepared`,
  `quantity_served`, `quantity_leftover`.
- **`quantity_served`** is portions that left the serving line, not food eaten —
  plate waste is not captured anywhere in this prototype's *own* data (see
  `estimated_plate_waste_*` below for an external-benchmark estimate of it).
- **Estimated/assumed:** `unit_cost`, predicted demand, surplus, shortage, all savings
  figures, safety buffers, the shortage-rate estimate, estimated plate waste, and (when
  derived from `target_date` rather than given directly) expected attendance.

## How prediction works

1. `predict_attendance()` — estimates expected attendance for a `target_date` from
   that weekday's history (falls back to the overall average if there aren't at
   least 2 past occurrences of that weekday yet).
2. `predict_demand()` — historical share of attending students who took a food ×
   expected attendance, via `_estimate_serve_rate()`'s cascade:
   1. **same-weekday, recent** — last 8 occurrences of the target weekday (needs ≥4),
      so "pizza Friday" and slow seasonal drift are both picked up;
   2. **recent window** — last 25 days overall (needs ≥8), when weekday-specific
      history is too thin;
   3. **all-time average** — the original, simplest estimate.
   Sold-out days (`quantity_leftover == 0`) are excluded from all three — `served`
   there was capped by what was prepared, not by actual demand, so including them
   biases the rate low. Foods with fewer than 3 days of history altogether fall back
   to their category's average share, then to a flat default (both flagged
   `confidence: "low"`).
3. `calculate_prep_quantity()` — predicted demand + a safety buffer, rounded up to a
   whole serving. The buffer comes from `compute_data_driven_buffers()` when a food
   has enough backtested days (≥15): the smallest buffer that would have covered the
   90th-percentile day in a walk-forward backtest, with the resulting miss rate
   reported alongside it as `shortage_rate_estimate`. Foods without enough backtest
   history fall back to a fixed 10% (15% for vegetable/fruit/dairy, so nutritious
   items are never cut just because they're less popular).
4. `calculate_costs()` — see "Cost model" below; compares the recommended plan's total
   cost against a historical baseline's total cost, with surplus and shortage costed
   separately and consistently.
5. `plan_day()` — runs the above for every menu item, adds an `estimated_plate_waste_*`
   figure (predicted servings × an external USDA category plate-waste rate — *not*
   measured from this cafeteria's own data, just a labeled external estimate, and never
   added into the cost totals), and returns a JSON-friendly dict.
6. `plan_month()` — calls `plan_day()` once per school day in a calendar month and
   rolls the results into per-food and overall monthly totals.

## Cost model

For each food/day, four quantities are tracked **separately** — conflating them was a
real bug found and fixed during review (see "Issues found and fixed"):

| Quantity | Meaning | Status |
|---|---|---|
| `recommended_prep` / `baseline_prep` | servings prepared | the decision being evaluated |
| `estimated_surplus` | `max(0, prepared − predicted_demand)` | unserved food — a quantity, not plate waste |
| `estimated_shortage` | `max(0, predicted_demand − prepared)` | demand the plan would miss — an ESTIMATE |
| `estimated_plate_waste_*` | `predicted_demand × external USDA rate` | served-but-uneaten — not measured locally, never added into cost |

**The cost formula** (`calculate_costs()`):

```
preparation_cost = prepared_servings x unit_cost       # ALREADY includes surplus's cost
shortage_cost     = shortage_servings x unit_cost x shortage_penalty_multiplier
total_cost        = preparation_cost + shortage_cost    # NOT + surplus_cost again
```

`estimated_surplus_cost` is still reported (it's informative — "how much of
preparation_cost was wasted") but it is a **subset of** `preparation_cost`, not an
addition to it. Adding it a second time was exactly the double-counting bug a review
caught: it silently rewarded under-preparing, because a baseline that ran short showed
"no surplus cost" with no offsetting shortage cost either — free lunch, literally.

`shortage_penalty_multiplier` (default **1.0**) values one missing serving at that many
times its own `unit_cost`. **This is a configurable assumption, not a measured cost** —
a real stockout also costs goodwill, nutrition, and staff time that aren't priced here.
`GET /plan/sensitivity` shows the same day's result at 0.5×, 1×, 1.5×, 2×, and 3× side
by side, specifically so a single multiplier choice can't quietly make the comparison
look one-sided. On *this* dataset, that table happens to show no variation at all —
`evaluate_methods()` confirms the baseline proxy never actually falls short of predicted
demand anywhere in these 34 days (the generator always has historical `quantity_prepared
>= quantity_served`, so the baseline ratio rarely undershoots a demand estimate derived
from the same served numbers). That's a property of this particular synthetic dataset,
not evidence the shortage-cost code path is unused or untested — see the hand-calculable
`calculate_costs()` unit tests in `test_prototype.py` for cases where it does bite.

**Savings** = `baseline_total_cost − lunchloop_total_cost` (positive = LunchLoop cheaper,
negative = more expensive). **Savings %** = `savings / baseline_total_cost × 100`, or
`null`/"Unavailable" when `baseline_total_cost` is 0 (never a division error, never a
silently-assumed value).

**The baseline is a proxy, not a measured real-world number**: `baseline_prep` is this
food's own all-time historical `prepared / attendance` ratio (from this same CSV),
scaled to the day's expected attendance — the best stand-in available, not a separately
recorded "what the kitchen actually would have done today." Foods with fewer than 3
days of history get no baseline at all (`None`), never a silently-assumed zero.

## How accuracy is measured

Two different, complementary evaluations exist, both walk-forward (each prediction
uses *only* data from strictly before that day — the only honest way to measure this;
scoring a method on days it was fitted on overstates how good it is):

- **`mae_report()` / `GET /accuracy`** — pure prediction accuracy (predicted servings vs.
  actual `quantity_served`), old all-time-average method vs. the current weekday+recency
  method. On this 34-day dataset: old misses by **6.82 servings/food/day (5.8% MAPE)**;
  current misses by **7.24 servings/food/day (6.3% MAPE)** — the current method is
  slightly **worse** here, not better. That's an honest result, not a bug: there isn't
  enough real history yet (34 days) for the extra weekday/recency structure to pay off
  over a plain average. (An earlier version of this dataset spanned a full fabricated
  year and showed a ~9% improvement — which was itself circular, since a generator that
  plants a pattern and a method built to find that exact pattern will always "win" on
  its own fabricated data. See "Issues found and fixed.")
- **`evaluate_methods()` / `GET /evaluate`** — the **cost** comparison (baseline vs.
  LunchLoop total cost, the same days, the fixed default buffer rather than the
  data-driven one, specifically to avoid tuning on the data being evaluated). On this
  dataset, over 144 (day, food) predictions across 24 held-out days: baseline total cost
  **$9,813.84**, LunchLoop total cost **$9,897.55** — **−$83.71 (−0.9%)**, i.e. LunchLoop
  costs slightly *more* here, not less, at `shortage_penalty_multiplier = 1.0`. Fruit Cup
  is the worst-performing food (−$72.00, −3.9%). These are **not asserted** — they're
  computed fresh from this exact CSV every time `/evaluate` is called, and both the
  per-food and the per-day breakdown are in the response, not just this one aggregate.

Both carry the same caveat: **this dataset is synthetic**, built with the same kind of
weekday/seasonal structure these methods look for. A simulation over synthetic data
demonstrates how the system behaves under its own assumptions; it does not prove real
savings at a real school. Both `/accuracy` and `/evaluate` include this caveat directly
in their JSON (`circularity_caveat`), not only in this README.

## Input validation

`validate_history(df)` checks a loaded CSV for the problems a real, hand-kept
production record is prone to — `quantity_leftover != prepared - served` mismatches,
duplicate `(date, food_item)` rows, negative values, and school days missing from the
expected calendar — and returns a list of human-readable issues (empty = clean).
`load_data()` calls it automatically and prints whatever it finds as warnings, so a
real record can still be loaded (and used) with its problems visible rather than
failing silently. `GET /data-quality` exposes the same check for the currently loaded
CSV.

## Known limitations

- No real item-by-item school cafeteria dataset is publicly available (schools keep
  this as internal production records), so the dataset stays synthetic. If you can
  get even a few days of a real production record, it can be converted into this
  same CSV format and nothing else needs to change — `validate_history()` will flag
  whatever's off about it.
- Plate waste (served but uneaten food) isn't measured locally — `estimated_plate_waste_*`
  applies an external benchmark rate to our own predicted servings, which is a
  different (and weaker) thing than measuring it, and is never summed into any cost total.
- `shortage_penalty_multiplier` is a modeling assumption (default 1x unit_cost); the
  entire savings conclusion can flip sign depending on this choice (see `/plan/sensitivity`)
  — don't present a single multiplier's result as "the" answer.
- Weekday attendance/demand modeling only works where there's enough history for that
  weekday (2+ for attendance, 4+ for demand); a brand-new school year or a new food
  falls back progressively to coarser estimates. With only 34 days of real history,
  this cascade doesn't yet outperform a plain average (see "How accuracy is measured").
- Foods that sold out are excluded from their own rate estimate rather than corrected
  for, so true demand on those days may still be understated beyond what the exclusion
  accounts for; this dataset never fabricates a specific shortage quantity for a
  historical sold-out day, only an estimate for a planned future day.
- The backtest, buffers, and evaluation all assume the future looks statistically like
  the recorded past (same foods, same weekday patterns); a real deployment should
  re-run all three periodically as new days come in, and should NOT re-tune the
  data-driven buffer on the same days it's then evaluated against (see "Cost model").
- This dataset is SYNTHETIC. Every accuracy and savings number in this README and in
  the API is a demonstration of mechanics on fabricated data, not a real-world claim.

## Issues found and fixed

A review of an earlier version of this project caught several real problems, kept here
for context rather than erased:

1. **Future-dated "history."** The dataset originally ran through June 2027 — a "history"
   file containing fabricated rows for days that hadn't happened yet. Fixed by truncating
   the CSV to end the day before "today," so `/plan/month` is the only thing that ever
   touches the school year's later months.
2. **Savings calculation double-counted / mis-counted cost.** `estimated_total_cost` was
   computed as `surplus_cost + shortfall_cost`, omitting the baseline cost of correctly-
   served food. The fix (see "Cost model") uses `preparation_cost + shortage_cost`, with
   surplus_cost reported as a breakdown of (not an addition to) preparation_cost, and adds
   `estimated_savings_pct_vs_baseline` with safe zero-baseline handling.
3. **Backtest circularity.** The accuracy improvement claimed earlier came from a dataset
   deliberately generated with the exact weekday/seasonal patterns the method was built to
   find — not evidence it would work at a real school. `mae_report()` and `evaluate_methods()`
   now both say this explicitly in their own JSON (`circularity_caveat`), not just in docs.
4. **Winter leftover rate calibrated to the wrong metric.** An earlier generator multiplied
   the synthetic *leftover* rate (prepared − served, our own quantity) by a seasonal
   multiplier taken from a *plate-waste* study (served − eaten, a different, externally
   measured quantity). Removed rather than patched; the study stays cited below as context.
5. **Shortage-penalty assumption was invisible.** The cost of running short was hardcoded
   at 1x `unit_cost` with no way to see how much the conclusion depended on that choice.
   `shortage_penalty_multiplier` is now a parameter on every relevant function/endpoint,
   and `/plan/sensitivity` shows the result across several values explicitly.
6. **Buffers allowing deliberate shortfalls weren't said out loud.** `compute_data_driven_buffers()`
   sizes each buffer to the backtested 90th-percentile day on purpose — accepting an
   estimated shortage on the other ~10% of days — but this was only visible in a nested
   field. It's now stated directly in `plan_day()`'s per-item notes and assumptions list.

## Sources

- [USDA FNS Research Summary, Spring 2019](https://schoolnutrition.org/wp-content/uploads/2022/06/USDA-FNS-Research-Summary-Spring2019.pdf) —
  plate waste by food category (School Nutrition and Meal Cost Study, SY 2014–15);
  figures verified word-for-word against the source PDF.
- [Adjapong, Bender, Schaefer & Roe, *PLoS ONE* 19(12):e0299043 (2024)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11676535/) —
  WWF Food Waste Warriors data, 134 US schools; winter plate waste significantly
  higher than spring for entrees (~+37%) and milk (~+26%), not for produce. Context
  only — **not** used to calibrate this dataset (see "Issues found and fixed" #4).
- Saha et al., *Childhood Obesity* (Nov. 2024) — photo-based plate-waste study; fruit,
  vegetables, and milk selected below NSLP guidelines and substantially uneaten.
- An Italian 78-school canteen study (food not consumed ~21.7% of what's prepared) —
  an early benchmark for the overall leftover-rate order of magnitude.
