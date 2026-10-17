# TrayTrack (prototype)

Predicts how many servings of each cafeteria food students will take, recommends how much
to prepare with a cost-based safety buffer, and compares the cost of that plan with
"cooking the usual amount" on held-out school days it never saw while being tuned.

**All data here is synthetic (a simulated school).** Every accuracy and savings number below
describes how the method behaves on that simulated data. None of it is a real-world claim.

## Setup

```
pip install -r requirements.txt
```

## Run the checks

```
python -m pytest           # tests/ : forecast, buffers, cost accounting, held-out evaluation, API
python test_prototype.py   # older script checks, prints a sample-day plan
python test_api.py         # older script checks for every endpoint
```

The two scripts print `ALL CHECKS PASSED` / `ALL API CHECKS PASSED` on success.

## Run the API and dashboard

```
python -m uvicorn app:app --port 8000
```

Open `http://127.0.0.1:8000/` for the dashboard, or `/docs` to call endpoints directly:

```
curl -X POST http://127.0.0.1:8000/plan -H "Content-Type: application/json" \
  -d "{\"expected_attendance\": 410}"
```

The dashboard shows, all computed live from the CSV: history per food with its buffer,
forecast accuracy on the held-out test window (old vs. current method, with an uncertainty
interval), the held-out cost comparison against the usual amount (food cost, shortage cost,
surplus, shortage and plate waste as separate rows), and next month's forecast.

### Endpoints

- `GET /summary`: plain historical averages per food, straight from the CSV.
- `GET /accuracy`: forecast error on the held-out test window, old method vs. current
  method, plus the validation window and a 95% bootstrap interval for the difference.
- `GET /evaluate`: held-out cost comparison, TrayTrack vs. the usual amount, scored against
  actual servings. Optional `?shortage_penalty_multiplier=`.
- `GET /plan/sensitivity?expected_attendance=410`: one day planned at 1x, 1.5x, 2x, 3x and
  5x shortage cost. Each multiplier gets its own buffers.
- `GET /buffers`: per-food newsvendor buffers, their target and backtest short-day rate,
  and the backtest errors they were read from.
- `GET /data-quality`: results of `validate_history()` on the loaded CSV.
- `POST /plan`: one day's plan. Takes `expected_attendance` or `target_date`
  (`YYYY-MM-DD`; attendance is then estimated from that weekday's history). Optional
  `menu` and `shortage_penalty_multiplier` (default 3, must be > 0).
- `POST /plan/month`: a calendar month (`year`, `month`), one daily plan per school day.

## Files

- `data/cafeteria_history_synthetic.csv`: the synthetic history (see below).
- `prediction.py`: forecast, buffers, cost model, backtests. Documented inline.
- `app.py`: FastAPI wrapper and the dashboard.
- `tests/test_traytrack.py`: pytest suite. `test_prototype.py`, `test_api.py`: older script checks.

## The dataset

204 rows: 6 school foods (cheese pizza, chicken nuggets, popcorn chicken, steamed carrots,
fruit cup, chocolate milk) over 34 school days (Aug 31 to Oct 16, 2026, weekdays minus
Labor Day). It is **synthetic**:

- Attendance dips on Fridays and grows slowly over the year.
- Per-food demand share has its own weekday story ("pizza Friday" +5 points; popcorn
  chicken slowly getting more popular).
- Leftovers average about 10 to 15% of what's prepared. About 6% of rows sell out
  (`quantity_leftover == 0`).
- Popcorn chicken's unit cost (~$0.58) comes from a real district nutrition report; other
  unit costs are assumptions.
- **The recorded `quantity_prepared` was generated from that day's `quantity_served`**
  (they correlate at about 0.92, while prepared vs. attendance is only about 0.35). So the
  recorded prep "knew" each day's demand in advance, and it is **not** used as the baseline
  in the cost comparison: comparing against a clairvoyant kitchen would be unfair in the
  other direction. See "Baseline" below.

## What's measured vs. estimated

- **Measured** (in a real cafeteria; here simulated): `attendance`, `quantity_prepared`,
  `quantity_served`, `quantity_leftover`.
- `quantity_served` is portions that left the line, not food eaten. On sold-out days it is
  only a lower bound on demand.
- **Estimated or assumed:** `unit_cost`, forecasts, buffers, surplus, shortage, plate waste,
  every savings figure, the shortage cost multiplier.

## How the forecast works

`predict_demand()`: the food's share of attending students (served / attendance over all
its past days), nudged toward that weekday's own share:

```
share = w x weekday_share + (1 - w) x all_days_share,   w = n / (n + 4)
forecast = share x expected attendance
```

where `n` is how many past days fell on that weekday. With 2 past Fridays the Friday share
gets 33% weight; with 12 it gets 75%. This replaced a hard cascade (last 8 same weekdays,
else last 25 days, else all history) that chased noise.

Sold-out days are **kept**. Served on a sold-out day is capped, so it understates demand,
but those are the high-demand days: the old code dropped them, which biased the estimate
even lower. Foods with under 3 days of history fall back to their category's average
share, then to a flat 25% (`confidence: "low"`).

## Safety buffers (newsvendor)

The cost model (next section) is `total = food prepared x unit cost + shortage x unit cost
x m`. One more prepared serving costs `unit cost` for sure and saves `m x unit cost` if it
would otherwise have been missing, so total cost is lowest when the share of days with
enough food is:

```
service level = 1 - 1/m        (m = shortage_penalty_multiplier; 3x -> 67%, 5x -> 80%)
```

The buffer is that quantile of the food's walk-forward forecast errors (actual / forecast
- 1), so `prep = ceil(forecast x (1 + buffer))`. Guardrails: never below the forecast,
never below +10% for fruit, vegetables and milk, never above +40%. A food needs 15 backtest
errors of its own; otherwise all foods' errors are pooled; otherwise the old fixed 10%/15%
is used.

The default `m = 3` is an assumption (the project plan's example treats running out as
several times worse than a leftover). With `m <= 1` a shortage costs no more than the food
it saves, so the rule says "no buffer". That is why the old default of 1x made under-
preparing look free.

## Cost model

Four quantities, kept separate everywhere:

| Quantity | Meaning | In cost? |
|---|---|---|
| food prepared | servings cooked x unit cost | yes |
| unserved surplus | cooked but never served (`prepared - served`) | already inside food prepared, never added again |
| shortage | wanted but not available (`demand - served`) | yes, x unit cost x m |
| plate waste | served but not eaten; external USDA category rate x servings served | **no**, reported only |

```
served        = min(prepared, demand)
total_cost    = prepared x unit_cost + shortage x unit_cost x m
savings       = baseline total_cost - TrayTrack total_cost
savings %     = savings / baseline total_cost   (null when the baseline costs 0)
```

TrayTrack and the baseline are always measured against the **same demand**:

- In the held-out evaluation, that is the actual served count for the day.
- In forward planning (`/plan`, `/plan/month`), the true demand is unknown, so both plans
  are priced as **expected values** over demand scenarios `forecast x (1 + each past
  backtest error)` for that food, the same errors the buffer was sized on
  (`cost_basis: "expected_over_N_backtest_errors"`). A food without backtest history falls
  back to treating the forecast as exact (`cost_basis: "point_forecast"`), which can never
  show a TrayTrack shortage, so its savings are less trustworthy.

The previous version measured both plans against TrayTrack's **own forecast**. That made
TrayTrack's shortage zero by construction and counted its whole buffer as waste, so neither
the shortage cost nor the savings meant anything.

**Baseline ("cooking the usual amount")**: each food's historical prepared-per-attending-
student ratio, from data before the day only, times that day's attendance. It's a proxy,
not a separately recorded "what the kitchen would have done".

## How the evaluation works

School days are split in time order. Nothing is shuffled:

| Window | Days | Used for |
|---|---|---|
| warm-up | Aug 31 to Sep 14 (10) | never scored |
| validation | Sep 15 to Sep 25 (9) | choosing model settings (the `4` above) |
| **test** | **Sep 28 to Oct 16 (15)** | **reporting only; nothing was tuned on it** |

Every scored prediction uses only data from strictly before that day: forecast, buffer
(errors from earlier days only) and baseline alike. A test checks this by truncating the
data and confirming no earlier prediction, buffer or prep changes. Attendance is the day's
actual count for every method (it assumes a morning head count before cooking).

## Results (synthetic data, regenerate with `GET /accuracy` and `GET /evaluate`)

**Forecast accuracy, test window** (MAE, servings per food per day, 90 predictions):

| Method | Validation MAE | Test MAE |
|---|---|---|
| old: all-time average share | 6.02 | 7.26 |
| previous cascade (removed) | 5.96 | 8.00 |
| current: weekday-shrunk share | 5.69 | 7.53 |

The current method beat the old one on validation, which is why it was picked, but **it
does not beat the old method on the held-out test window**: +0.28 servings/day worse, with
a 95% bootstrap interval of -0.09 to +0.67. That means no clear difference either way. It
does clearly beat the previous cascade (8.00). With 34 days of history there just isn't
enough data for weekday structure to pay off reliably. The test window was scored once and
not used to re-tune, so the result stays as it is.

**Cost, test window, TrayTrack vs. usual amount** (total = food + shortage cost):

| Shortage cost | Service level | Usual total | TrayTrack total | Savings | Surplus servings (usual / TT) | Shortage servings (usual / TT) | Validation savings |
|---|---|---|---|---|---|---|---|
| 1x | 0% | $6,142.39 | $5,806.76 | $335.63 (5.5%) | 1501 / 974 | 26 / 142 | $108.67 (2.9%) |
| 1.5x | 33% | $6,151.41 | $5,858.79 | $292.62 (4.8%) | 1501 / 976 | 26 / 141 | $83.87 (2.3%) |
| 2x | 50% | $6,160.44 | $5,916.40 | $244.04 (4.0%) | 1501 / 1010 | 26 / 116 | $59.05 (1.6%) |
| **3x (default)** | **67%** | **$6,178.49** | **$5,982.40** | **$196.09 (3.2%)** | **1501 / 1088** | **26 / 67** | **$23.86 (0.6%)** |
| 5x | 80% | $6,214.59 | $6,053.23 | $161.36 (2.6%) | 1501 / 1181 | 26 / 38 | $2.44 (0.1%) |

How to read it: in this simulated school, TrayTrack cuts unserved surplus by 21 to 35%, but
it **runs short more often** than the usual amount at every setting (at 3x: 67 vs. 26
servings short). That trade comes out cheaper on these test days. The savings shrink as
shortages are priced higher, and on the validation window they were much smaller (0.6% at
3x, 0.1% at 5x). So the honest summary is "a few percent, sensitive to how bad you think
running out is", not a robust win. These numbers are not asserted anywhere; they are
recomputed from the CSV on every call.

## Input validation

`validate_history(df)` flags `quantity_leftover != prepared - served` mismatches, duplicate
`(date, food_item)` rows, negative values, and expected school days missing from the data.
`load_data()` prints them as warnings; `GET /data-quality` exposes the same check.

## Known limitations

- The data is synthetic, and it was generated with the kind of weekday pattern the model
  looks for. Real records are the only real test.
- 15 test days is small. Differences of a few servings or a few percent are within noise
  (see the bootstrap interval in `/accuracy`).
- On sold-out days true demand is unknown and treated as equal to served. That hides
  shortages that likely happened on those days, for both plans; it tends to flatter
  whichever plan prepares less (usually TrayTrack). 3 of the 90 test rows sold out.
- The shortage multiplier is an assumption. Goodwill, nutrition and staff time aren't
  priced. Look at the whole sensitivity table, not one row.
- Plate waste is an external USDA category rate applied to our servings, not a local
  measurement, and it is never in any cost.
- The baseline is a ratio proxy, not a recorded "usual" decision.
- The backtest short-day rate in `/buffers` is in-sample; the out-of-sample rate is in
  `/evaluate` (`lunchloop_days_short`).
- Attendance is treated as known before cooking in the evaluation.

## Changes in this version

1. **Cost comparison measured against the forecast, not reality.** Fixed: the held-out
   evaluation scores both plans against actual servings; forward plans use expected values
   over past errors.
2. **Shortage cost default of 1x made shortages free.** At 1x, cooking less is never
   penalized. The default is now 3x, buffers follow from it (newsvendor), and every
   endpoint takes the multiplier.
3. **Buffers ignored the cost of running out** (fixed 90th percentile). Now
   `1 - 1/m`, with fruit/vegetable/milk floors.
4. **The evaluation never tested the buffers actually used.** It used fixed 10%/15%
   buffers to avoid leakage. Now each test day's buffer uses only errors from earlier days.
5. **Baseline.** The recorded prep was generated from served counts, so it is not used.
6. **Sold-out days were dropped from the forecast**, biasing it low. Now kept.
7. **Forecast**: the cascade was replaced by weekday shrinkage, chosen on validation only.
8. **No held-out split.** Added a warm-up / validation / test split by date.
9. **Dashboard**: added the held-out comparison; the cost-chart tooltip said "surplus
   cost" while showing total cost; the buffer table showed `NaN%` (wrong field name); the
   accuracy note had a hard-coded "~34 days" claim.
10. **Tests**: added a pytest suite (hand calculations, limiting cases, leakage, no
    double counting, monotonicity, API input checks). Removed the committed `__pycache__`
    and the stale `sens.json` (saved output from the old cost model).

## Sources

- [USDA FNS Research Summary, Spring 2019](https://schoolnutrition.org/wp-content/uploads/2022/06/USDA-FNS-Research-Summary-Spring2019.pdf):
  plate waste by food category (School Nutrition and Meal Cost Study, SY 2014-15).
- [Adjapong, Bender, Schaefer & Roe, *PLoS ONE* 19(12):e0299043 (2024)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11676535/):
  winter vs. spring plate waste in 134 US schools. Context only, not used to build the data.
- Saha et al., *Childhood Obesity* (Nov. 2024): photo-based plate-waste study.
- An Italian 78-school canteen study (food not consumed ~21.7% of what's prepared): an early
  benchmark for the order of magnitude.
