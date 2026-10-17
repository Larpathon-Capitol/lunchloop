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
forecast accuracy on the held-out test window (baseline vs. candidate, with an uncertainty
interval and which one shipped), the held-out cost comparison against the usual amount (food
cost, shortage cost, surplus, shortage and plate waste as separate rows), the same comparison
at 1x, 3x and 5x shortage cost, every buffer rule side by side, and next month's forecast.

### Endpoints

- `GET /summary`: plain historical averages per food, straight from the CSV.
- `GET /accuracy`: the forecast ship gate. Error on the held-out test window, all-time
  average (baseline) vs. weekday candidate, plus the validation window, a 95% bootstrap
  interval for the difference, and which method shipped.
- `GET /evaluate`: held-out cost comparison, TrayTrack vs. the usual amount, scored against
  actual servings, plus `buffer_rules` (every prep rule on the same forecast and days).
  Optional `?shortage_penalty_multiplier=`.
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

`predict_demand()` (shipped): the food's share of attending students, served / attendance
over all its past days, times expected attendance.

**Ship rule: a forecast change is kept only if it beats this baseline on the held-out test
window.** Two changes were tried and neither passed, so neither ships:

- The earlier hard cascade (last 8 same weekdays, else last 25 days, else all history).
- A weekday candidate, `share = w x weekday_share + (1 - w) x all_days_share` with
  `w = n / (n + 4)` (`n` = past days on that weekday), with `4` chosen on the validation
  window. It is still in the code behind `USE_WEEKDAY_SHRINK = False` so `/accuracy` can
  keep scoring it; a test fails if that flag ever disagrees with the gate result.

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
| validation | Sep 15 to Sep 25 (9) | choosing settings (the candidate's `4`) |
| **test** | **Sep 28 to Oct 16 (15)** | **the ship gate and the reported results; no setting was tuned on it** |

Every scored prediction uses only data from strictly before that day: forecast, buffer
(errors from earlier days only) and baseline alike. A test checks this by truncating the
data and confirming no earlier prediction, buffer or prep changes. Attendance is the day's
actual count for every method (it assumes a morning head count before cooking).

## Results (synthetic data, regenerate with `GET /accuracy` and `GET /evaluate`)

**Forecast accuracy, test window** (MAE, servings per food per day, 90 predictions):

| Method | Validation MAE | Test MAE | Ships? |
|---|---|---|---|
| all-time average share (baseline) | 6.02 | 7.26 | **yes** |
| previous cascade | 5.96 | 8.00 | no, worse than baseline |
| weekday candidate | 5.69 | 7.53 | no, worse than baseline |

**The prediction model did not improve.** The weekday candidate won on validation but lost
on held-out test days (+0.28 servings/day, 95% bootstrap interval -0.09 to +0.67, so no
clear difference either way). Per the ship rule, TrayTrack forecasts with the plain
all-time average. With 34 days of history there isn't enough data for weekday structure to
pay off reliably. The test window was not used to re-tune anything.

**Cost, test window, TrayTrack vs. usual amount** (total = food + shortage cost):

| Shortage cost | Buffer target | Usual total | TrayTrack total | Savings (test) | Savings (validation) | Surplus servings (usual / TT) | Shortage servings (usual / TT) |
|---|---|---|---|---|---|---|---|
| 1x | 0% of days | $6,142.39 | $5,803.72 | $338.67 (5.5%) | $105.48 (2.8%) | 1501 / 958 | 26 / 136 |
| **3x (default)** | **67% of days** | **$6,178.49** | **$6,017.16** | **$161.33 (2.6%)** | **$17.43 (0.5%)** | **1501 / 1072** | **26 / 88** |
| 5x | 80% of days | $6,214.59 | $6,119.43 | $95.16 (1.5%) | $0.26 (0.0%) | 1501 / 1184 | 26 / 52 |

How to read it: in this simulated school, TrayTrack cuts unserved surplus by 21 to 36%, but
it **runs short more often** than the usual amount at every setting (at 3x: 88 vs. 26
servings short). That trade comes out cheaper on these test days. The savings shrink as
shortages are priced higher, and on the validation window they were much smaller (0.5% at
3x, essentially 0 at 5x). The honest summary is "a few percent, sensitive to how bad you
think running out is", not a robust win.

**Buffer rules, same forecast, test window** (total cost; surplus / shortage servings at 3x):

| Prep rule | 1x | 3x | 5x | Surplus / shortage (3x) |
|---|---|---|---|---|
| TrayTrack newsvendor (shipped) | **$5,803.72** | **$6,017.16** | $6,119.43 | 1072 / 88 |
| previous 90th-percentile buffer | $6,013.74 | $6,058.04 | **$6,102.34** | 1155 / 34 |
| fixed +10% / +15% | $6,179.70 | $6,222.00 | $6,264.30 | 1623 / 27 |
| cooking the usual amount | $6,142.39 | $6,178.49 | $6,214.59 | 1501 / 26 |
| no buffer (breaks the fruit/veg floor, not allowed) | $5,610.12 | $5,874.28 | $6,138.44 | 423 / 230 |

The newsvendor rule is cheapest among allowed rules at 1x and 3x, but **not at 5x**, where
the previous 90th-percentile rule wins (and it also wins at 3x and 5x on the validation
window). A version that picked the service level from past costs was tried and did worse at
3x and 5x on both windows, so it was dropped. No buffer at all is cheapest at 1x and 3x
only because a 3x penalty still undervalues 230 short servings; it also breaks the fruit and
vegetable floor. All these numbers are recomputed from the CSV on every `/evaluate` call.

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
- The test window was used as the ship gate for the forecast, and the buffer-rule table was
  read after the fact; with only 15 test days, rerun everything on new days before trusting
  any ranking.
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
7. **Forecast**: a ship gate now decides. Neither the old cascade nor the weekday candidate
   beat the all-time average on held-out days, so the all-time average ships.
8. **No held-out split.** Added a warm-up / validation / test split by date.
9. **Dashboard**: added the held-out comparison; the cost-chart tooltip said "surplus
   cost" while showing total cost; the buffer table showed `NaN%` (wrong field name); the
   accuracy note had a hard-coded "~34 days" claim.
10. **Tests**: added a pytest suite (hand calculations, limiting cases, leakage, no
    double counting, 1x/3x/5x monotonicity, the forecast ship gate, buffer-rule
    consistency, API input checks). Removed the committed `__pycache__` and the stale
    `sens.json` (saved output from the old cost model).
11. **Dashboard, second pass**: shows the ship gate result, a 1x/3x/5x table and every
    buffer rule side by side; the "cheapest rule" sentence is computed, not typed.

## Sources

- [USDA FNS Research Summary, Spring 2019](https://schoolnutrition.org/wp-content/uploads/2022/06/USDA-FNS-Research-Summary-Spring2019.pdf):
  plate waste by food category (School Nutrition and Meal Cost Study, SY 2014-15).
- [Adjapong, Bender, Schaefer & Roe, *PLoS ONE* 19(12):e0299043 (2024)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11676535/):
  winter vs. spring plate waste in 134 US schools. Context only, not used to build the data.
- Saha et al., *Childhood Obesity* (Nov. 2024): photo-based plate-waste study.
- An Italian 78-school canteen study (food not consumed ~21.7% of what's prepared): an early
  benchmark for the order of magnitude.
