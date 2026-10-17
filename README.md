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
at 1x, 3x and 5x shortage cost, every buffer rule side by side, the simulation study (best
strategy, its trade-offs, and how it changes across demand scenarios), and next month's
forecast.

### Endpoints

- `GET /summary`: plain historical averages per food, straight from the CSV.
- `GET /accuracy`: the forecast ship gate. Error on the held-out test window, all-time
  average (baseline) vs. weekday candidate, plus the validation window, a 95% bootstrap
  interval for the difference, and which method shipped.
- `GET /evaluate`: held-out cost comparison, TrayTrack vs. the usual amount, scored against
  actual servings, plus `buffer_rules` (every prep rule on the same forecast and days).
  Optional `?shortage_penalty_multiplier=` and `?buffer_rule=shortage_first|cost_optimal`.
- `GET /simulation`: the synthetic multi-scenario strategy study (computed once, about 30 s,
  started in the background when the server starts).
- `GET /plan/sensitivity?expected_attendance=410`: one day planned at 1x, 1.5x, 2x, 3x and
  5x shortage cost. Each multiplier gets its own buffers.
- `GET /buffers`: per-food buffers (default rule), their target and backtest short-day rate,
  and the backtest errors they were read from.
- `GET /data-quality`: results of `validate_history()` on the loaded CSV.
- `POST /plan`: one day's plan. Takes `expected_attendance` or `target_date`
  (`YYYY-MM-DD`; attendance is then estimated from that weekday's history). Optional
  `menu`, `shortage_penalty_multiplier` (default 3, must be > 0) and `buffer_rule`
  (`shortage_first` default, or `cost_optimal`).
- `POST /plan/month`: a calendar month (`year`, `month`), one daily plan per school day.

## Files

- `data/cafeteria_history_synthetic.csv`: the synthetic history (see below).
- `prediction.py`: forecast, buffers, cost model, backtests. Documented inline.
- `simulation.py`: synthetic school generator and the strategy study.
- `app.py`: FastAPI wrapper and the dashboard.
- `tests/test_traytrack.py`, `tests/test_simulation.py`: pytest suite (about 90 s; one test
  reruns the full simulation study). `test_prototype.py`, `test_api.py`: older script checks.

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

`predict_demand()` (shipped): the food's share of attending students over the **last 20
school days** (all history while there are fewer), times expected attendance.

**Ship rule: a forecast change is kept only if it beats the all-time average on held-out
data.** Three changes have been tried:

| Candidate | How it was chosen | CSV test MAE (baseline 7.26) | Ships? |
|---|---|---|---|
| hard cascade (last 8 same weekdays, else last 25 days, else all) | earlier version | 8.00 | no |
| weekday shrinkage, `w = n / (n + 4)` | `4` picked on CSV validation | 7.53 | no |
| last 20 school days | picked on validation schools in the simulation | **7.17** | **yes** |

The 20-day window passes, but only just: its 95% bootstrap interval on the CSV is -0.22 to
+0.07 servings/day, which includes 0. In the simulation it also wins on unseen test schools
(14.98 vs. 15.52 MAE against true demand), mostly in the "trending" scenario where
popularity drifts. The weekday candidate is still in the code behind
`USE_WEEKDAY_SHRINK = False` so `/accuracy` can keep scoring it.

Sold-out days are **kept**. Served on a sold-out day is capped, so it understates demand,
but those are the high-demand days: dropping them biased the estimate even lower. Foods
with under 3 days of history fall back to their category's average share, then to a flat
25% (`confidence: "low"`).

## Safety buffers

Each food's buffer is read off its own walk-forward forecast errors (actual / forecast - 1),
so `prep = ceil(forecast x (1 + buffer))`. Two rules, picked with `buffer_rule`:

- **`shortage_first` (default)**: enough for **90% of past days** (more only if the shortage
  multiplier is above 10x). Never below +5%, never below +10% for fruit, vegetables and
  milk, never above +40%. It was the cheapest strategy that kept shortages within 110% of
  the usual amount on validation schools in the simulation, at 1x, 3x and 5x.
- **`cost_optimal`**: the newsvendor rule. With `total = food prepared x unit cost +
  shortage x unit cost x m`, total cost is lowest when the share of days with enough food is
  `1 - 1/m` (3x -> 67%, 5x -> 80%). It cuts more leftovers but runs short far more often.

A food needs 15 backtest errors of its own; otherwise all foods' errors are pooled;
otherwise the old fixed 10%/15% is used. The default shortage cost `m = 3` is an assumption.

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

## Results on the CSV (synthetic, regenerate with `GET /accuracy` and `GET /evaluate`)

**Forecast**: see the table above. Shipped: last 20 school days, test MAE 7.17 vs. 7.26 for
the all-time average (not a clear difference).

**Cost, held-out test window, TrayTrack vs. usual amount** (total = food + shortage cost):

| Shortage cost | Buffer rule | Usual total | TrayTrack total | Savings | Leftovers (usual / TT) | Shortage servings (usual / TT) |
|---|---|---|---|---|---|---|
| 1x | shortage_first (default) | $6,142.39 | $6,081.54 | 1.0% | 1501 / 1320 | 26 / 29 |
| 3x | shortage_first (default) | $6,178.49 | $6,120.94 | 0.9% | 1501 / 1320 | 26 / 29 |
| 5x | shortage_first (default) | $6,214.59 | $6,160.34 | 0.9% | 1501 / 1320 | 26 / 29 |
| 1x | cost_optimal | $6,142.39 | $5,807.09 | 5.5% | 1501 / 950 | 26 / 125 |
| 3x | cost_optimal | $6,178.49 | $6,014.67 | 2.7% | 1501 / 1065 | 26 / 84 |
| 5x | cost_optimal | $6,214.59 | $6,103.08 | 1.8% | 1501 / 1175 | 26 / 46 |

On these 15 test days the default cuts leftovers by 12% with 3 more short servings than the
usual amount (29 vs. 26, 1.12x, just over the 110% target). The cost-optimal rule saves more
but runs short 2 to 5 times as much. `/evaluate` also lists every buffer rule side by side.

## Simulation study (synthetic schools, `GET /simulation`, `simulation.py`)

The CSV has one school and 15 test days, and on sold-out days nobody knows true demand. So
TrayTrack is also tested on many **synthetic** schools where the simulator knows true demand
every day. The strategies only see what a real kitchen sees: that morning's attendance and
past prepared / served counts.

**How the schools are made** (every number here is an assumption, see `SCENARIOS`):

- 6 foods with the CSV's demand shares and unit costs, 80 school days, 340 to 460 students.
- Attendance: weekday pattern (Fridays -5%), daily noise, occasional field-trip or flu dips.
- Demand: per-school popularity, a popularity random walk and trend, each food's own weekday
  habits, day-to-day noise, one-day surprises (a shock of up to +/-30 to 45%), and sometimes
  a permanent level change mid-term (a recipe change).
- 5 scenario types: steady, typical, volatile, trending and weekday-heavy.
- The kitchen that produced the history cooks its running average + 20%, without knowing the
  day's demand, so it sells out on about 10% of rows and leaves about 17% unserved. The CSV
  shows about 6% sell-outs and 10% leftovers, but its prep was generated from served counts,
  so a kitchen that doesn't see the future can't match both. 20% sits in the middle. It was
  set before any strategy was run.

**How overfitting is prevented:** each scenario type gets 6 training, 6 validation and 12
test schools (120 in all; 70 scored days x 6 foods each). Training schools tune the per-food
buffers. Validation schools pick the forecast and the "best" strategy. Test schools are only
reported. A test fails if the shipped settings ever differ from the validation choice.

**Strategies** (all walk-forward, each using only earlier days): the usual amount; all-time
average + fixed 10%/15%; each forecast (all-time average, last 20 days) with each buffer
rule; per-food static buffers tuned for cost on training schools; and per-food static
buffers capped so training shortages stay within 110% of the usual amount.

**Picked on validation:** forecast = last 20 days at every multiplier. Best within the
shortage limit = last 20 days + shortage-first at 1x, 3x and 5x. Cheapest ignoring
shortages = per-food cost-tuned (1x) or last 20 days + cost-optimal (3x, 5x).

**Unseen test schools, 3x** (1x and 5x are on the dashboard; leftovers and shortages
don't depend on the multiplier for the shortage-first and usual strategies):

| Strategy | Savings | Leftovers | Shortage servings vs. usual | Rows short | Demand met |
|---|---|---|---|---|---|
| cooking the usual amount | 0% | 0% | 1.00x | 3198 | 97.93% |
| all-time + fixed 10%/15% | 3.83% | -31.6% | 1.51x | 5164 | 96.88% |
| all-time + cost-optimal (previous TrayTrack) | 5.08% | -43.9% | 1.73x | 6622 | 96.43% |
| all-time + shortage-first | 3.22% | -20.0% | 1.04x | 3870 | 97.85% |
| last 20 days + cost-optimal | 5.26% | -45.3% | 1.74x | 6787 | 96.41% |
| **last 20 days + shortage-first (shipped)** | **3.48%** | **-20.7%** | **0.99x** | **3815** | **97.95%** |
| per-food buffer tuned for cost | 5.16% | -50.4% | 2.00x | 7267 | 95.86% |
| per-food buffer capped at usual shortages | 2.22% | -13.9% | 1.02x | 3526 | 97.89% |

Savings of the shipped strategy at 1x / 3x / 5x: 3.52% / 3.48% / 3.44%.

**Can TrayTrack cut leftovers and keep shortages near the usual amount?** Overall, yes in
this simulation: about 21% fewer leftovers with the same number of short servings. But:

- **Shortages are smaller but more frequent**: 3815 short rows vs. 3198 (+19%).
- **It depends on the scenario** (test schools):

| Scenario | Leftovers | Shortages vs. usual | Demand met (usual / TT) | Savings at 3x |
|---|---|---|---|---|
| steady | -47.6% | 12.06x (1941 vs. 161 servings) | 99.97% / 99.68% | 7.77% |
| typical | -22.0% | 1.22x | 98.98% / 98.75% | 3.44% |
| volatile | -7.1% | 0.94x | 95.88% / 96.12% | 1.60% |
| trending | -20.7% | 0.73x | 98.09% / 98.61% | 3.93% |
| weekday-heavy | -6.7% | 1.05x | 96.70% / 96.55% | 0.97% |

In steady and typical schools the shipped strategy runs short more than the 110% limit. The
usual amount barely runs short there because its 20% margin is generous for calm demand.
The overall total stays within the limit only because volatile schools dominate the
shortage counts. In volatile and weekday-heavy schools the leftover cut is small (about
7%). Per-food static buffers did not beat the adaptive rules: the cost-tuned ones have about
twice the usual shortage servings at 3x, and the shortage-capped ones cut fewer leftovers than shortage-first.

**What stays uncertain:** every number above comes from scenarios we designed. A real
school's noise, trends and surprises could look different, and the ranking of strategies
could change. The kitchen policy that generated the history also shapes what every strategy
learns from. None of this is evidence of real-world savings.

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
- The CSV test window is the forecast ship gate and has now been used to check three
  candidates, so its numbers are no longer a clean, untouched estimate. With only 15 test
  days, rerun everything on new days before trusting any ranking.
- The simulation's scenarios, the kitchen's 20% margin and the 110% shortage limit are
  choices we made. Different choices could change which strategy wins.
- In the simulation the shipped strategy breaks the shortage limit in steady and typical
  schools (see the scenario table), and it makes shortages more frequent even where total
  short servings stay level.
- Attendance is treated as known before cooking in the evaluation.

## Changes in this version

1. **Cost comparison measured against the forecast, not reality.** Fixed: the held-out
   evaluation scores both plans against actual servings; forward plans use expected values
   over past errors.
2. **Shortage cost default of 1x made shortages free.** At 1x, cooking less is never
   penalized. The default is now 3x, buffers follow from it (newsvendor), and every
   endpoint takes the multiplier.
3. **Buffers ignored the cost of running out** (fixed 90th percentile). Added the
   `1 - 1/m` newsvendor rule with fruit/vegetable/milk floors. The simulation later showed
   it runs short too often, so a 90% rule with floors (`shortage_first`) is the default
   again, now chosen on validation rather than by habit (item 12).
4. **The evaluation never tested the buffers actually used.** It used fixed 10%/15%
   buffers to avoid leakage. Now each test day's buffer uses only errors from earlier days.
5. **Baseline.** The recorded prep was generated from served counts, so it is not used.
6. **Sold-out days were dropped from the forecast**, biasing it low. Now kept.
7. **Forecast**: a ship gate now decides. Neither the old cascade nor the weekday candidate
   beat the all-time average on held-out days, so they were dropped (see item 12 for the
   forecast that did pass).
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
12. **Simulation study** (`simulation.py`, `/simulation`, dashboard section): 120 synthetic
    schools in 5 scenario types with train / validation / test splits. It picked the last-20-
    days forecast (which then passed the CSV gate) and the new `shortage_first` buffer rule,
    now the default. The cost-optimal newsvendor rule stays available as `buffer_rule`.

## Sources

- [USDA FNS Research Summary, Spring 2019](https://schoolnutrition.org/wp-content/uploads/2022/06/USDA-FNS-Research-Summary-Spring2019.pdf):
  plate waste by food category (School Nutrition and Meal Cost Study, SY 2014-15).
- [Adjapong, Bender, Schaefer & Roe, *PLoS ONE* 19(12):e0299043 (2024)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11676535/):
  winter vs. spring plate waste in 134 US schools. Context only, not used to build the data.
- Saha et al., *Childhood Obesity* (Nov. 2024): photo-based plate-waste study.
- An Italian 78-school canteen study (food not consumed ~21.7% of what's prepared): an early
  benchmark for the order of magnitude.
