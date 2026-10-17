# LunchLoop simulated school data

**All of this data is simulated.** There is no real school behind it. It is one made-up large Texas high school of 2,750 students, built so LunchLoop has something realistic to forecast from. About 42% of enrolled students eat the school lunch on a typical day.

It has daily history from Jan 12 to Oct 16, 2026, plus the menu for Oct 19 to Nov 13, 2026.

## The files

- `items.csv`: the 14 menu items, with cost, allergens, and minimum prep amount.
- `meals.csv`: history. One row per item per school day, with attendance, servings cooked, and servings taken.
- `future_meals.csv`: the same columns for upcoming days. Only used to score guesses in the demo, never for forecasting.
- `menu.csv`: which items are served each day, for history and upcoming days.
- `vote_options.csv`: the three entrees students can vote on for each upcoming Thursday.

The exact columns are in [docs/backend-contract.md](../docs/backend-contract.md).

## How it was made

- **Attendance:** start from 2,750 students and an 8.3% absence rate. Mondays and Fridays have more absences (about 17% and 22% above a midweek day). The day before a break has a larger absence multiplier. Random noise is scaled with enrollment.
- **Participation:** each item's take rate is multiplied by one factor so the menu's average entree participation is about 46% of students present, which is about 42% of enrolled students. Relative popularity stays the same.
- **Costs:** food cost is set per meal component, per serving: entree about $1.05, grain $0.13, vegetable $0.39, fruit $0.36, milk $0.32. Individual items vary around those averages.
- **Menus:** three entrees a day from a fixed six-entree rotation, plus sides and milk.
- **Demand:** each item has a share of students who take it. Cheese pizza sells more on Fridays. Calendar notes nudge demand, plus a little shared and item noise.
- **The kitchen's usual amount:** the item's average servings taken over its last 20 serving days, times a fixed over-prep for its food group: entrees and grains 7.5%, fruit and vegetables 20%, milk 12%. These margins are assumptions.
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
- Entrees and grains sell out on 22.6% of history item-days combined, because the 7.5% usual margin is close to the day-to-day swings in the simulation. We found no public source for the right margin, so it is an assumption. `tools/eval_truth.py` scores the forecast against the true demand to account for this.
- The usual-amount margins are assumptions, not a published standard. A real kitchen may plan differently.
- `generate()` exposes the true demand for developer scoring, but true demand is never written to the contract CSVs.

### Two choices that raise the simulated saving

Both are explained in [sources.md](sources.md). The savings below are simulated, pooled over 5 seeds (95 school days), and scored against true demand. Run `python tools/eval_truth.py --seeds 5` to reproduce them.

1. **Milk stays at 1.12.** Schools must offer fluid milk every day (7 CFR 210.10), and the 1.12 value is an assumption kept from the prototype. At 1.025, at least one milk runs out on 75.2% of history days (56.0% of milk item-days), and a kitchen that must offer milk daily would not allow that. At the shipped 1.12 it happens on 9.6% of days (5.2% of milk item-days). The size of the bias: net saving is $40.90 per school day at milk 1.12 and about $35.05 at 1.025 (`python tools/eval_truth.py --seeds 5 --prep-ratio milk=1.025`).
2. **Packaged items count as waste.** Unopened milk cartons, fruit cups and mandarin oranges may be stored and served again; we do not know how often. They are about 78% of the pooled net saving ($32.03 of $40.90 per day). Without them the saving is about $9 per day ($8.87). The `eval_truth.py` output prints this split under its component table.

To get the milk sell-out numbers, run this from the repo root. It rebuilds the simulated history in memory at both milk settings:

```
python - <<'PY'
import data.simulate as s
for ratio in (1.12, 1.025):
    s.COMPONENT_PREP_RATIOS = {**s.COMPONENT_PREP_RATIOS, "milk": ratio}
    rows = [dict(zip(s.HEADER, r)) for r in s.generate()["history_rows"]]
    milk = [r for r in rows if r["component"] == "milk"]
    out_by_day = {}
    for r in milk:
        out_by_day[r["date"]] = max(out_by_day.get(r["date"], 0), int(r["sold_out"]))
    days = sum(out_by_day.values())
    items = sum(int(r["sold_out"]) for r in milk)
    print(f"milk {ratio}: at least one milk out on {days} of {len(out_by_day)} days ({100 * days / len(out_by_day):.1f}%), "
          f"{items} of {len(milk)} milk item-days ({100 * items / len(milk):.1f}%)")
PY
```

It prints 12 of 125 days (9.6%) and 13 of 250 item-days (5.2%) at 1.12, and 94 of 125 days (75.2%) and 140 of 250 item-days (56.0%) at 1.025.
