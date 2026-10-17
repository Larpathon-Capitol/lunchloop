# LunchLoop simulated school data

**All of this data is simulated.** There is no real school behind it. It is one made-up large Texas high school of about 2,750 students, built so LunchLoop has something realistic to forecast from.

It has daily history from Jan 12 to Oct 16, 2026, plus the menu for Oct 19 to Nov 13, 2026.

## The files

- `items.csv`: the 14 menu items, with cost, allergens, and minimum prep amount.
- `meals.csv`: history. One row per item per school day, with attendance, servings cooked, and servings taken.
- `future_meals.csv`: the same columns for upcoming days. Only used to score guesses in the demo, never for forecasting.
- `menu.csv`: which items are served each day, for history and upcoming days.
- `vote_options.csv`: the three entrees students can vote on for each upcoming Thursday.

The exact columns are in [docs/backend-contract.md](../docs/backend-contract.md).

## How it was made

- **Attendance:** start from 2,750 students and an 8.3% absence rate. Monday and Friday absence factors follow the cited weekday pattern. The day before a break has a larger absence multiplier. Random noise is scaled with enrollment.
- **Participation:** each item's prototype take rate is multiplied by one factor so the menu's average entree participation is about 46% of students present. Relative popularity stays the same.
- **Costs:** each component's relative costs are scaled to the research targets and rounded to cents. These are estimates from confirmed research inputs.
- **Menus:** three entrees a day from a fixed six-entree rotation, plus sides and milk.
- **Demand:** each item has a share of students who take it. Cheese pizza sells more on Fridays. Calendar notes nudge demand, plus a little shared and item noise.
- **The kitchen's usual amount:** the kitchen uses a component-specific ratio over its last 20 serving days. These ratios are simulation estimates based on measured ranges.
- **Votes:** on Thursdays in the history, the special was picked by a simulated student vote, and its row gets a vote share.

Every number and its source is in [sources.md](sources.md). The original prototype calibration credit stays with Ekansh Simgekar. The prototype data is simulated.

## Regenerate it

```
python data/simulate.py
```

You need Python 3.12 or newer. No extra packages are required. The seed is `20261016`, so every run gives the same files. Tests in `tests/data/` run the script fresh and check that the committed files match.

## Numbers from the current files

The values below are computed from the generated files. Run this script after regeneration instead of editing numbers by hand:

```
python - <<'PY'
import csv
from collections import defaultdict
from pathlib import Path

root = Path("data")
with (root / "meals.csv").open(newline="", encoding="utf-8") as f:
    history = list(csv.DictReader(f))
with (root / "future_meals.csv").open(newline="", encoding="utf-8") as f:
    future = list(csv.DictReader(f))

by_date = defaultdict(list)
for row in history:
    by_date[row["date"]].append(row)
attendance = [int(rows[0]["attendance"]) for rows in by_date.values()]
prepared = sum(int(row["servings_prepared"]) for row in history)
taken = sum(int(row["servings_taken"]) for row in history)
sold_out = sum(row["sold_out"] == "1" for row in history)
entree_per_day = [sum(int(row["servings_taken"]) for row in rows if row["component"] == "meat_alternate") / int(rows[0]["attendance"])
                  for rows in by_date.values()]
print("history rows:", len(history))
print("upcoming rows:", len(future))
print("mean attendance:", round(sum(attendance) / len(attendance), 1))
print("leftover share:", round((prepared - taken) / prepared, 4))
print("sold-out share:", round(sold_out / len(history), 4))
print("mean entree servings per attendance:", round(sum(entree_per_day) / len(entree_per_day), 4))
for component in ("meat_alternate", "grain", "vegetable", "fruit", "milk"):
    rows = [row for row in history if row["component"] == component]
    prepared_component = sum(int(row["servings_prepared"]) for row in rows)
    taken_component = sum(int(row["servings_taken"]) for row in rows)
    sold_component = sum(row["sold_out"] == "1" for row in rows)
    print(component, "sold-out share:", round(sold_component / len(rows), 4),
          "leftover share:", round((prepared_component - taken_component) / prepared_component, 4))
group = [row for row in history if row["component"] in {"meat_alternate", "grain"}]
print("entree and grain sold-out share:", round(sum(row["sold_out"] == "1" for row in group) / len(group), 4))
PY
```

## Known limitations

- It is simulated. LunchLoop has not been tested with a real school.
- Allergens are placeholders. Real allergen information always comes from the product label and nutrition staff.
- `servings_taken` undercounts demand on sold-out days because students cannot take food that was not cooked.
- The usual-amount ratios are estimates. A real kitchen may plan differently.
- **ASSUMPTION:** Unopened milk cartons and sealed fruit cups usually go back to the cooler, so counting them as waste overstates waste dollars.
- **ASSUMPTION:** Research measured 0% to 5% over-prep for milk. At 1.025 the simulated milk sells out on 56% of days, which a kitchen required to offer milk daily would not allow, so the original prototype value 1.12 is kept. This choice raises the simulated savings.
- Entree and grain items sell out on about 23% of history item-days combined because the 7.5% usual margin is close to the simulated day-to-day noise. This is an assumption with no public source (we found no public source for this). On sold-out item-days, `servings_taken` understates demand.
- `generate()` exposes latent true demand for developer scoring, but true demand is never written to the contract CSVs.
