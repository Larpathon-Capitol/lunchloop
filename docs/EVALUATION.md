# LunchLoop: evaluation notes (developer reference)

> The dashboard was later simplified to three sections (history, next-day plan, expected impact); see the
> top-level [README](../README.md). Everything below still describes the forecast, buffer, cost model,
> held-out evaluation and simulation study, and the endpoints that expose them (`/accuracy`, `/evaluate`,
> `/simulation`, `/plan/month`, `/plan/sensitivity`). Those endpoints and their tests are kept but are no longer
> shown on the dashboard. Sentences below about what "the dashboard shows" refer to the earlier, longer version.

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
- `GET /evaluate`: held-out cost comparison, LunchLoop vs. the usual amount, scored against
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
- `forecast_search.py`: the 72-variant forecast search (training and validation schools only).
- `app.py`: FastAPI wrapper and the dashboard.
- `tests/test_lunchloop.py`, `tests/test_simulation.py`: pytest suite (about 90 s; one test
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

`predict_demand()` (shipped) has two parts:

1. **Base share**: the food's served / attendance over the **last 10 school days** (all
   history while there are fewer).
2. **Weekday factor**: that weekday's share relative to the all-days share, shrunk toward 1
   by `w = n / (n + 4)` (`n` = past days on that weekday). With 2 past Fridays the Friday
   pattern gets 33% weight, with 12 it gets 75%.

`forecast = base share x weekday factor x expected attendance`.

**Ship rule: a forecast is used only if it beats the all-time average on held-out data.**

| Forecast | How it was chosen | CSV validation MAE | CSV test MAE | Simulation test MAE (vs. true demand) | Ships? |
|---|---|---|---|---|---|
| all-time average (baseline) | n/a | 6.02 | 7.26 | 15.52 | baseline |
| hard cascade (earlier version) | earlier | n/a | 8.00 | n/a | no |
| weekday factor on the all-time share | `4` picked on CSV validation | 5.69 | 7.53 | n/a | no |
| last 20 days (previous) | validation schools | 6.02 | 7.17 | 14.98 | replaced |
| **last 10 days x weekday factor** | **training schools, 72 variants** | **5.65** | **6.86** | **12.93** | **yes** |

How the new one was found: 72 variants (window of 10 / 15 / 20 / 30 days or all history,
or exponential smoothing; weekday factor off or with strength 4 / 8 / 16; and a sold-out
correction that raises a sold-out day's demand to at least its own forecast) were scored
against **true demand on training schools only**. The best was a 10-day window with
strength 4, and validation schools agreed (13.01 vs. 14.91 for the previous forecast). The
sold-out correction made no difference (13.037 vs. 13.038), and smoothing did not beat a
plain window, so neither was kept. Then it had to pass the CSV gate.

Caveats: on the CSV's 15 test days the gain over the baseline is not clear-cut (-0.40
servings/day, 95% bootstrap interval -0.97 to +0.19, which includes 0), and the same days
showed that a 10-day window **without** the weekday factor would have scored 6.66, a bit
better than the chosen 6.86. I kept the training-school choice instead of picking on those
test days. The weekday part helps most in the simulation's weekday-heavy schools, where the
weekday effects were built in on purpose (see the circularity caveat below).

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
savings       = baseline total_cost - LunchLoop total_cost
savings %     = savings / baseline total_cost   (null when the baseline costs 0)
```

LunchLoop and the baseline are always measured against the **same demand**:

- In the held-out evaluation, that is the actual served count for the day.
- In forward planning (`/plan`, `/plan/month`), the true demand is unknown, so both plans
  are priced as **expected values** over demand scenarios `forecast x (1 + each past
  backtest error)` for that food, the same errors the buffer was sized on
  (`cost_basis: "expected_over_N_backtest_errors"`). A food without backtest history falls
  back to treating the forecast as exact (`cost_basis: "point_forecast"`), which can never
  show a LunchLoop shortage, so its savings are less trustworthy.

The previous version measured both plans against LunchLoop's **own forecast**. That made
LunchLoop's shortage zero by construction and counted its whole buffer as waste, so neither
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

**Forecast**: see the table above. Shipped: last 10 days x weekday factor, test MAE 6.86 vs.
7.26 for the all-time average and 7.17 for the previous forecast.

**Cost, held-out test window, LunchLoop vs. usual amount** (total = food + shortage cost):

| Shortage cost | Buffer rule | Usual total | LunchLoop total | Savings (test) | Savings (validation) | Leftovers (usual / LL) | Shortage servings (usual / LL) |
|---|---|---|---|---|---|---|---|
| 1x | shortage_first (default) | $6,142.39 | $6,029.50 | 1.8% | 0.9% | 1501 / 1243 | 26 / 28 |
| 3x | shortage_first (default) | $6,178.49 | $6,057.24 | 2.0% | 0.5% | 1501 / 1243 | 26 / 28 |
| 5x | shortage_first (default) | $6,214.59 | $6,084.98 | 2.1% | 0.1% | 1501 / 1243 | 26 / 28 |
| 1x | cost_optimal | $6,142.39 | $5,791.12 | 5.7% | 2.6% | 1501 / 913 | 26 / 129 |
| 3x | cost_optimal | $6,178.49 | $5,951.31 | 3.7% | 0.6% | 1501 / 1005 | 26 / 72 |
| 5x | cost_optimal | $6,214.59 | $6,046.92 | 2.7% | -0.2% | 1501 / 1115 | 26 / 46 |

On these 15 test days the default cuts leftovers by 17% with 2 more short servings than the
usual amount (28 vs. 26; 6 short rows vs. 5). The cost-optimal rule saves more but runs
short 2 to 5 times as much, and on the validation days its savings are near zero or
negative. The savings here are small and shrink on validation: read them as "about 0 to 2%",
not as a result. `/evaluate` also lists every buffer rule side by side.

## Simulation study (synthetic schools, `GET /simulation`, `simulation.py`)

The CSV has one school and 15 test days, and on sold-out days nobody knows true demand. So
LunchLoop is also tested on many **synthetic** schools where the simulator knows true demand
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
buffers and found the forecast. Validation schools confirm the forecast and pick the "best"
strategy. Test schools are only reported. A test fails if the shipped settings differ from
the validation choice.

**Strategies** (all walk-forward, each using only earlier days): the usual amount; all-time
average + fixed 10%/15%; each forecast (all-time average, LunchLoop forecast) with each
buffer rule; per-food static buffers tuned for cost on training schools; and per-food static
buffers capped so training shortages stay within 110% of the usual amount.

**Picked on validation:** forecast = LunchLoop forecast. Best within the shortage limit =
LunchLoop forecast + shortage-first at 3x and 5x. At 1x a per-food capped buffer edges it
on validation (5.49% vs. 5.41% savings) while running short *more* (0.94x vs. 0.85x of the
usual shortages); that difference is tiny, so shortage-first stays the single default.
Cheapest ignoring shortages = per-food cost-tuned (1x) or LunchLoop forecast + cost-optimal
(3x, 5x).

**Unseen test schools, 3x** (1x and 5x are on the dashboard):

| Strategy | Savings | Leftovers | Shortage servings vs. usual | Rows short | Demand met |
|---|---|---|---|---|---|
| cooking the usual amount | 0% | 0% | 1.00x | 3198 | 97.93% |
| all-time + fixed 10%/15% | 3.83% | -31.6% | 1.51x | 5164 | 96.88% |
| all-time + cost-optimal (earlier LunchLoop) | 5.08% | -43.9% | 1.73x | 6622 | 96.43% |
| all-time + shortage-first | 3.22% | -20.0% | 1.04x | 3870 | 97.85% |
| LunchLoop forecast + cost-optimal | 7.09% | -52.2% | 1.52x | 6618 | 96.86% |
| **LunchLoop forecast + shortage-first (shipped)** | **5.61%** | **-31.7%** | **0.90x** | **3823** | **98.15%** |
| per-food buffer tuned for cost | 7.04% | -54.2% | 1.62x | 6692 | 96.65% |
| per-food buffer capped at usual shortages | 5.38% | -32.9% | 1.01x | 3962 | 97.91% |

Savings of the shipped strategy at 1x / 3x / 5x: 5.39% / 5.61% / 5.81%. The previous
shipped version (last 20 days + shortage-first) saved 3.5% with 20.7% fewer leftovers.

**Can LunchLoop cut leftovers and keep shortages near the usual amount?** Overall, yes in
this simulation: about 32% fewer leftovers with 10% fewer short servings. But:

- **Shortages are smaller but more frequent**: 3823 short rows vs. 3198 (+20%).
- **It depends on the scenario** (test schools):

| Scenario | Forecast MAE (all-time -> LunchLoop) | Leftovers | Shortages vs. usual | Demand met (usual / LL) | Savings at 3x |
|---|---|---|---|---|---|
| steady | 6.86 -> 6.34 | -50.0% | 9.84x (1584 vs. 161 servings) | 99.97% / 99.74% | 8.31% |
| typical | 13.69 -> 11.75 | -32.0% | 1.13x | 98.98% / 98.85% | 5.36% |
| volatile | 21.23 -> 20.22 | -7.6% | 0.90x | 95.88% / 96.27% | 1.88% |
| trending | 14.77 -> 11.67 | -29.4% | 0.67x | 98.09% / 98.72% | 5.66% |
| weekday-heavy | 21.06 -> 14.68 | -39.0% | 0.87x | 96.70% / 97.15% | 6.93% |

In steady schools (and, narrowly, typical ones) the shipped strategy breaks the 110%
shortage limit. The usual amount barely runs short there because its 20% margin is generous
for calm demand. The overall total stays within the limit because volatile schools dominate
the shortage counts. In volatile schools the leftover cut is small (about 8%). Per-food
static buffers did not beat the adaptive rules: the cost-tuned ones have about 1.6 times the
usual shortage servings at 3x, and the shortage-capped ones cut about the same leftovers as
shortage-first but run short slightly more.

**What stays uncertain:** every number above comes from scenarios we designed. The
weekday-heavy gain is partly by construction, since weekday effects were put into those
schools on purpose. A real school's noise, trends and surprises could look different, and
the ranking of strategies could change. The kitchen policy that generated the history also
shapes what every strategy learns from. None of this is evidence of real-world savings.

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
  whichever plan prepares less (usually LunchLoop). 3 of the 90 test rows sold out.
- The shortage multiplier is an assumption. Goodwill, nutrition and staff time aren't
  priced. Look at the whole sensitivity table, not one row.
- Plate waste is an external USDA category rate applied to our servings, not a local
  measurement, and it is never in any cost.
- The baseline is a ratio proxy, not a recorded "usual" decision.
- The backtest short-day rate in `/buffers` is in-sample; the out-of-sample rate is in
  `/evaluate` (`lunchloop_days_short`).
- The CSV test window is the forecast ship gate and has now been used to check five
  candidates (cascade, weekday shrinkage, last 20 days, last 10 days with and without the
  weekday factor), so its numbers are no longer a clean, untouched estimate. With only 15
  test days, rerun everything on new days before trusting any ranking.
- The simulation's scenarios, the kitchen's 20% margin and the 110% shortage limit are
  choices we made. Different choices could change which strategy wins.
- In the simulation the shipped strategy breaks the shortage limit in steady schools (9.84x)
  and, narrowly, typical ones (1.13x), and it makes shortages more frequent (+20% short
  rows) even though total short servings fall overall.
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
    schools in 5 scenario types with train / validation / test splits. It picked the new
    `shortage_first` buffer rule, now the default. The cost-optimal newsvendor rule stays
    available as `buffer_rule`.
13. **Tighter forecast**: last 10 days x a shrunk weekday factor replaces the last-20-days
    forecast. Error against true demand on unseen simulated schools fell from 14.98 to 12.93
    servings, and on the CSV's held-out days from 7.17 to 6.86 (baseline 7.26). Leftovers
    fell 32% (was 21%) with fewer short servings, and savings rose to about 5.6% (was 3.5%)
    in the simulation.
14. **Renamed** the app from TrayTrack to LunchLoop (code, dashboard, README, tests).

## Sources

- [USDA FNS Research Summary, Spring 2019](https://schoolnutrition.org/wp-content/uploads/2022/06/USDA-FNS-Research-Summary-Spring2019.pdf):
  plate waste by food category (School Nutrition and Meal Cost Study, SY 2014-15).
- [Adjapong, Bender, Schaefer & Roe, *PLoS ONE* 19(12):e0299043 (2024)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11676535/):
  winter vs. spring plate waste in 134 US schools. Context only, not used to build the data.
- Saha et al., *Childhood Obesity* (Nov. 2024): photo-based plate-waste study.
- An Italian 78-school canteen study (food not consumed ~21.7% of what's prepared): an early
  benchmark for the order of magnitude.
