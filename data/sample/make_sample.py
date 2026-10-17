"""Make the small sample dataset in data/sample/.

The sample is simulated and tiny on purpose. Tests use it so they don't depend
on the full dataset. Allergens here are placeholders for testing, not real
product labels. Run from the repo root:  python data/sample/make_sample.py
"""

import csv
import random
from datetime import date, timedelta
from pathlib import Path

SEED = 7
OUT = Path(__file__).resolve().parent
HISTORY_START = date(2026, 8, 24)
HISTORY_END = date(2026, 10, 16)   # last school day before the demo "today"
FUTURE_END = date(2026, 10, 30)
HOLIDAYS = {date(2026, 9, 7)}      # Labor Day
STUDENTS = 1200

# item_id, name, component, cost_per_serving, allergens, prep_floor, take_rate
ITEMS = [
    ("chicken_tacos", "Chicken tacos", "meat_alternate", 1.35, "milk", 0, 0.30),
    ("cheese_pizza", "Cheese pizza", "meat_alternate", 1.10, "wheat;milk;soybeans", 0, 0.34),
    ("popcorn_chicken", "Popcorn chicken", "meat_alternate", 1.25, "wheat;soybeans", 0, 0.28),
    ("wheat_roll", "Whole wheat roll", "grain", 0.20, "wheat", 0, 0.45),
    ("side_salad", "Side salad", "vegetable", 0.40, "", 150, 0.25),
    ("apple_slices", "Apple slices", "fruit", 0.35, "", 150, 0.40),
    ("milk_1pct", "1% milk", "milk", 0.30, "milk", 0, 0.55),
]
ENTREES = ["chicken_tacos", "cheese_pizza", "popcorn_chicken"]
WEEKDAY_ATTENDANCE = {0: 0.93, 1: 0.95, 2: 0.95, 3: 0.94, 4: 0.91}


def school_days(start, end):
    d = start
    while d <= end:
        if d.weekday() < 5 and d not in HOLIDAYS:
            yield d
        d += timedelta(days=1)


def menu_for(day):
    # Two of the three entrees each day, rotating, plus every side.
    skip = ENTREES[day.toordinal() % 3]
    return [i[0] for i in ITEMS if i[0] != skip]


def main():
    rng = random.Random(SEED)
    items = {i[0]: i for i in ITEMS}

    with open(OUT / "items.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["item_id", "name", "component", "cost_per_serving", "allergens", "prep_floor"])
        for item_id, name, comp, cost, allergens, floor, _ in ITEMS:
            w.writerow([item_id, name, comp, f"{cost:.2f}", allergens, floor])

    def rows_for(day):
        attendance = round(STUDENTS * WEEKDAY_ATTENDANCE[day.weekday()] * rng.uniform(0.97, 1.02))
        out = []
        for item_id in menu_for(day):
            _, _, comp, cost, allergens, floor, rate = items[item_id]
            usual = round(STUDENTS * 0.94 * rate * 1.15)
            demand = round(attendance * rate * rng.uniform(0.85, 1.15))
            prepared = max(usual, floor)
            taken = min(demand, prepared)
            out.append([day.isoformat(), item_id, comp, attendance, prepared, taken,
                        f"{cost:.2f}", allergens, "", int(taken == prepared), ""])
        return out

    header = ["date", "item_id", "component", "attendance", "servings_prepared",
              "servings_taken", "cost_per_serving", "allergens", "vote_share",
              "sold_out", "day_note"]
    with open(OUT / "meals.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        for day in school_days(HISTORY_START, HISTORY_END):
            w.writerows(rows_for(day))

    future = list(school_days(HISTORY_END + timedelta(days=1), FUTURE_END))
    with open(OUT / "future_meals.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        for day in future:
            w.writerows(rows_for(day))

    with open(OUT / "menu.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["date", "item_id", "day_note"])
        for day in list(school_days(HISTORY_START, HISTORY_END)) + future:
            for item_id in menu_for(day):
                w.writerow([day.isoformat(), item_id, ""])

    with open(OUT / "vote_options.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["open_date", "target_date", "target_slot", "option_1", "option_2", "option_3"])
        for day in future:
            target = day + timedelta(days=11 - day.weekday())  # Friday of the next week
            w.writerow([day.isoformat(), target.isoformat(), "entree", *ENTREES])


if __name__ == "__main__":
    main()
