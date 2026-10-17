"""Make the full simulated school dataset in data/.

Everything this writes is simulated. There is no real school behind it. The
numbers and where they come from are listed in data/sources.md. Run from the
repo root:  python data/simulate.py   (or add --out DIR to write somewhere else)
"""

import argparse
import csv
import random
import sys
from datetime import date, timedelta
from pathlib import Path

if sys.version_info < (3, 12):
    sys.exit("simulate.py needs Python 3.12 or newer")

SEED = 20261016
ENROLL = 1200
BASE_ABSENCE = 0.083  # Verified TEA attendance figure (91.7%).
PREP_RATIO = 1.12  # Calibrated from Ekansh Simgekar's prototype.
# The remaining parameters are assumptions. Details live in data/sources.md.

HISTORY_START = date(2026, 1, 12)
HISTORY_END = date(2026, 10, 16)
FUTURE_END = date(2026, 11, 13)
HOLIDAYS = {
    date(2026, 1, 19), date(2026, 2, 16),
    *[date(2026, 3, 16) + timedelta(days=i) for i in range(5)],
    date(2026, 4, 3),
    *[date(2026, 5, 23) + timedelta(days=i) for i in range(93)],
    date(2026, 9, 7), date(2026, 10, 12),
}

ITEMS = [
    ("cheese_pizza", "Cheese pizza", "meat_alternate", 0.85, "milk;wheat", 0, "ring", 0.346),
    ("beef_nachos", "Beef nachos", "meat_alternate", 0.90, "milk;wheat", 0, "ring", 0.200),
    ("chicken_nuggets", "Chicken nuggets", "meat_alternate", 0.70, "wheat", 0, "ring", 0.234),
    ("cheeseburger", "Cheeseburger", "meat_alternate", 1.05, "milk;soybeans;wheat", 0, "ring", 0.300),
    ("popcorn_chicken", "Popcorn chicken", "meat_alternate", 0.58, "wheat;soybeans", 0, "ring", 0.199),
    ("spicy_chicken_sandwich", "Spicy chicken sandwich", "meat_alternate", 0.95, "soybeans;wheat", 0, "ring", 0.235),
    ("dinner_roll", "Dinner roll", "grain", 0.18, "wheat", 0, "daily", 0.420),
    ("brown_rice", "Brown rice", "grain", 0.15, "", 0, "Tue, Thu", 0.150),
    ("steamed_carrots", "Steamed carrots", "vegetable", 0.25, "", 120, "daily", 0.295),
    ("broccoli", "Broccoli", "vegetable", 0.28, "", 80, "Mon, Wed, Fri", 0.180),
    ("fruit_cup", "Fruit cup", "fruit", 0.40, "", 150, "daily", 0.433),
    ("mandarin_oranges", "Mandarin oranges", "fruit", 0.35, "", 70, "Mon, Wed, Fri", 0.150),
    ("chocolate_milk", "Chocolate milk", "milk", 0.40, "milk", 0, "daily", 0.308),
    ("milk_1pct", "1% milk", "milk", 0.30, "milk", 0, "daily", 0.140),
]
# Rates and costs for these six items are calibrated from Ekansh Simgekar's prototype:
# cheese_pizza, chicken_nuggets, popcorn_chicken, chocolate_milk, fruit_cup, steamed_carrots.
RING = [item[0] for item in ITEMS[:6]]
WEEKDAY_ATTENDANCE = (1.085, 0.928, 0.928, 0.928, 1.132)
EARLY_RELEASE = {date(2026, 2, 26), date(2026, 5, 21), date(2026, 9, 24), date(2026, 11, 6)}
TESTING = {date(2026, 4, 7), date(2026, 4, 8), date(2026, 5, 12), date(2026, 10, 14)}
RAINY = {date(2026, 2, 10), date(2026, 8, 27), date(2026, 9, 3), date(2026, 9, 16), date(2026, 10, 1), date(2026, 10, 22)}
HEADER = ["date", "item_id", "component", "attendance", "servings_prepared", "servings_taken",
          "cost_per_serving", "allergens", "vote_share", "sold_out", "day_note"]


def school_days(start, end):
    days = []
    current = start
    while current <= end:
        if current.weekday() < 5 and current not in HOLIDAYS:
            days.append(current)
        current += timedelta(days=1)
    return days


def day_note(day, pre_break):
    if day in EARLY_RELEASE:
        return "early_release"
    if day in TESTING:
        return "testing"
    if day in RAINY:
        return "rainy"
    if day in pre_break:
        return "pre_break"
    return ""


def menu_for(day):
    week = ((day - HISTORY_START).days // 7) % 3
    offset = (2 * (5 * week + day.weekday())) % 6
    entrees = {RING[(offset + i) % 6] for i in range(3)}
    served = []
    for item_id, _, _, _, _, _, schedule, _ in ITEMS:
        if schedule == "ring" and item_id not in entrees:
            continue
        if schedule == "Tue, Thu" and day.weekday() not in (1, 3):
            continue
        if schedule == "Mon, Wed, Fri" and day.weekday() not in (0, 2, 4):
            continue
        served.append(item_id)
    return served


def normal_draw(rng):
    total = 0.0
    for _ in range(12):
        total += rng.random()
    return total - 6.0


def rounded_five(value):
    return 5 * round(value / 5)


def write_items(out):
    with open(out / "items.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["item_id", "name", "component", "cost_per_serving", "allergens", "prep_floor"])
        for item_id, name, component, cost, allergens, floor, _, _ in ITEMS:
            writer.writerow([item_id, name, component, f"{cost:.2f}", allergens, floor])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    out = args.out
    out.mkdir(parents=True, exist_ok=True)

    history_days = school_days(HISTORY_START, HISTORY_END)
    future_days = school_days(HISTORY_END + timedelta(days=1), FUTURE_END)
    all_days = history_days + future_days
    pre_break = {d for d, nxt in zip(all_days, all_days[1:]) if (nxt - d).days > 3}
    item_map = {item[0]: item for item in ITEMS}
    histories = {item[0]: [] for item in ITEMS}
    rng = random.Random(SEED)
    history_rows, future_rows, menu_rows = [], [], []
    attendance_values = []

    for day in all_days:
        note = day_note(day, pre_break)
        z_att = normal_draw(rng)
        z_day = normal_draw(rng)
        absence_note = {"pre_break": 1.9, "rainy": 1.25, "testing": 0.7}.get(note, 1.0)
        absent = round(ENROLL * BASE_ABSENCE * WEEKDAY_ATTENDANCE[day.weekday()] * absence_note + 13.0 * z_att)
        attendance = max(850, min(ENROLL, ENROLL - absent))
        attendance_values.append(attendance)
        rows = []
        for item_id in menu_for(day):
            z_item = normal_draw(rng)
            _, _, component, cost, allergens, floor, _, rate = item_map[item_id]
            prior = histories[item_id][-20:]
            if prior:
                total = 0
                for value in prior:
                    total += value
                usual = PREP_RATIO * total / len(prior)
            else:
                usual = PREP_RATIO * 1100 * rate
            prepared = max(floor, rounded_five(usual))
            weekday_factor = 1.116 if item_id == "cheese_pizza" and day.weekday() == 4 else 0.971 if item_id == "cheese_pizza" else 1.0
            demand_note = {"early_release": 0.92, "rainy": 1.04, "pre_break": 0.97}.get(note, 1.0)
            f_day = max(0.75, min(1.35, 1 + 0.03 * z_day))
            f_item = max(0.75, min(1.35, 1 + 0.06 * z_item))
            demand = round(attendance * rate * weekday_factor * demand_note * f_day * f_item)
            taken = min(demand, prepared)
            rows.append({"item_id": item_id, "component": component, "cost": cost, "allergens": allergens,
                         "prepared": prepared, "demand": demand, "taken": taken})
            histories[item_id].append(taken)
        if day > HISTORY_END:
            # Called It needs one clear winner per future day. If two entrees tie on
            # servings taken, lower the later one's demand by 1 until the top is unique.
            # With the current seed this never triggers.
            while True:
                meat = [row for row in rows if row["component"] == "meat_alternate"]
                maximum = max(row["taken"] for row in meat)
                tied = [row for row in meat if row["taken"] == maximum]
                if len(tied) < 2:
                    break
                chosen = tied[-1]  # rows are in items.csv order
                chosen["demand"] -= 1
                chosen["taken"] = min(chosen["demand"], chosen["prepared"])
                histories[chosen["item_id"]][-1] = chosen["taken"]
        special = next(item_id for item_id in menu_for(day) if item_id in ("beef_nachos", "cheeseburger", "spicy_chicken_sandwich"))
        vote_id = None
        if day <= HISTORY_END and day.weekday() == 3:
            vote_id = special
            vote = 0.36 + 0.16 * rng.random()
        for row in rows:
            share = f"{vote:.3f}" if row["item_id"] == vote_id else ""
            output = [day.isoformat(), row["item_id"], row["component"], attendance, row["prepared"], row["taken"],
                      f"{row['cost']:.2f}", row["allergens"], share, int(row["taken"] == row["prepared"]), note]
            (history_rows if day <= HISTORY_END else future_rows).append(output)
            menu_rows.append([day.isoformat(), row["item_id"], note])

    write_items(out)
    for filename, header, rows in (("meals.csv", HEADER, history_rows), ("future_meals.csv", HEADER, future_rows),
                                   ("menu.csv", ["date", "item_id", "day_note"], menu_rows)):
        with open(out / filename, "w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle, lineterminator="\n")
            writer.writerow(header)
            writer.writerows(rows)
    future_thursdays = [d for d in future_days if d.weekday() == 3]
    vote_rows = []
    for open_day in future_days:
        targets = [d for d in future_thursdays if d >= open_day + timedelta(days=7)]
        if targets:
            vote_rows.append([open_day.isoformat(), targets[0].isoformat(), "entree", "beef_nachos", "cheeseburger", "spicy_chicken_sandwich"])
    with open(out / "vote_options.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["open_date", "target_date", "target_slot", "option_1", "option_2", "option_3"])
        writer.writerows(vote_rows)

    summary_rows = history_rows  # the summary describes history only
    prepared = sum(int(row[4]) for row in summary_rows)
    taken = sum(int(row[5]) for row in summary_rows)
    sold = sum(int(row[9]) for row in summary_rows)
    component_shares = []
    for component in ("meat_alternate", "grain", "vegetable", "fruit", "milk"):
        component_rows = [row for row in summary_rows if row[2] == component]
        component_shares.append(f"{component} {sum(int(row[9]) for row in component_rows) / len(component_rows):.1%}")
    print(f"items.csv: {len(ITEMS)} rows")
    print(f"meals.csv: {len(history_rows)} rows; future_meals.csv: {len(future_rows)} rows; menu.csv: {len(menu_rows)} rows; vote_options.csv: {len(vote_rows)} rows")
    print(f"history: {history_days[0]}..{history_days[-1]} ({len(history_days)} school days); mean attendance {sum(attendance_values[:len(history_days)]) / len(history_days):.1f}")
    print(f"leftover: {(prepared - taken) / prepared:.1%}; sold-out: {sold / len(summary_rows):.1%} overall; by component: {', '.join(component_shares)}")


if __name__ == "__main__":
    main()
