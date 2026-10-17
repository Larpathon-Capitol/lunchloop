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
ENROLL = 2750
BASE_ABSENCE = 0.083  # Verified TEA attendance figure (91.7%).
ATTENDANCE_FLOOR_BASE = 850
ABSENCE_NOISE_BASE = 13.0
COMPONENT_PREP_RATIOS = {
    "meat_alternate": 1.075,
    "grain": 1.075,
    "fruit": 1.20,
    "vegetable": 1.20,
    "milk": 1.12,
}
# Relative costs from the simulated prototype, rescaled to the research
# component targets. Rounding here preserves the shipped cent values.
_PROTOTYPE_COSTS = {
    "cheese_pizza": 0.85, "beef_nachos": 0.90, "chicken_nuggets": 0.70,
    "cheeseburger": 1.05, "popcorn_chicken": 0.58, "spicy_chicken_sandwich": 0.95,
    "dinner_roll": 0.18, "brown_rice": 0.15, "steamed_carrots": 0.25,
    "broccoli": 0.28, "fruit_cup": 0.40, "mandarin_oranges": 0.35,
    "chocolate_milk": 0.40, "milk_1pct": 0.30,
    "bean_cheese_burrito": 0.92, "veggie_burger": 0.98,
    "black_bean_quesadilla": 0.88, "chickpea_curry_rice": 0.95,
    "falafel_wrap": 0.93, "teriyaki_tofu_bowl": 1.02,
    "chicken_shawarma_wrap": 1.12, "orange_chicken": 1.08,
    # Sides added for tray variety. Relative costs are assumptions, rescaled
    # with the rest of their food group below.
    "whole_wheat_tortilla": 0.16, "whole_wheat_pita": 0.17, "side_salad": 0.33,
    "black_beans": 0.22, "seasoned_corn": 0.20, "apple_slices": 0.36, "banana": 0.25,
    "milk_fat_free": 0.29,
}
_COST_TARGETS = {"meat_alternate": 1.05, "grain": 0.13, "vegetable": 0.39,
                 "fruit": 0.36, "milk": 0.32}


def _scaled_cost(item_id, component):
    component_costs = [cost for name, cost in _PROTOTYPE_COSTS.items()
                       if next(item[2] for item in _ITEM_DEFINITIONS if item[0] == name) == component]
    return round(_PROTOTYPE_COSTS[item_id] * _COST_TARGETS[component] /
                 (sum(component_costs) / len(component_costs)), 2)


# The remaining parameters are assumptions. Details live in data/sources.md.

HISTORY_START = date(2026, 1, 12)
HISTORY_END = date(2026, 10, 16)
FUTURE_END = date(2027, 1, 29)


def _closed(first, last):
    return {first + timedelta(days=i) for i in range((last - first).days + 1)}


# A typical Texas district pattern, not any real district's calendar. See
# data/sources.md. Weekends are always closed on top of these.
CLOSURES = {
    "Martin Luther King Jr. Day": _closed(date(2026, 1, 19), date(2026, 1, 19)),
    "Presidents Day": _closed(date(2026, 2, 16), date(2026, 2, 16)),
    "Spring break": _closed(date(2026, 3, 16), date(2026, 3, 20)),
    "Good Friday": _closed(date(2026, 4, 3), date(2026, 4, 3)),
    "Memorial Day": _closed(date(2026, 5, 25), date(2026, 5, 25)),
    "Summer break": _closed(date(2026, 5, 29), date(2026, 8, 11)),
    "Labor Day": _closed(date(2026, 9, 7), date(2026, 9, 7)),
    "Fall holiday": _closed(date(2026, 10, 12), date(2026, 10, 12)),
    "Thanksgiving break": _closed(date(2026, 11, 23), date(2026, 11, 27)),
    "Winter break": _closed(date(2026, 12, 21), date(2027, 1, 1)),
    "Martin Luther King Jr. Day 2027": _closed(date(2027, 1, 18), date(2027, 1, 18)),
}
HOLIDAYS = set().union(*CLOSURES.values())

_ITEM_DEFINITIONS = [
    ("cheese_pizza", "Cheese pizza", "meat_alternate", "milk;wheat", 0, "ring", 0.346),
    ("beef_nachos", "Beef nachos", "meat_alternate", "milk;wheat", 0, "ring", 0.200),
    ("chicken_nuggets", "Chicken nuggets", "meat_alternate", "wheat", 0, "ring", 0.234),
    ("cheeseburger", "Cheeseburger", "meat_alternate", "milk;soybeans;wheat", 0, "ring", 0.300),
    ("popcorn_chicken", "Popcorn chicken", "meat_alternate", "wheat;soybeans", 0, "ring", 0.199),
    ("spicy_chicken_sandwich", "Spicy chicken sandwich", "meat_alternate", "soybeans;wheat", 0, "ring", 0.235),
    ("bean_cheese_burrito", "Bean and cheese burrito", "meat_alternate", "milk;wheat", 0, "ring", 0.220),
    ("veggie_burger", "Veggie burger", "meat_alternate", "soybeans;wheat", 0, "ring", 0.180),
    ("black_bean_quesadilla", "Black bean quesadilla", "meat_alternate", "milk;wheat", 0, "ring", 0.190),
    ("chickpea_curry_rice", "Chickpea curry with rice", "meat_alternate", "", 0, "ring", 0.160),
    ("falafel_wrap", "Falafel wrap", "meat_alternate", "wheat;sesame", 0, "ring", 0.150),
    ("teriyaki_tofu_bowl", "Teriyaki tofu bowl", "meat_alternate", "soybeans;wheat", 0, "ring", 0.140),
    ("chicken_shawarma_wrap", "Chicken shawarma wrap", "meat_alternate", "wheat;milk", 0, "ring", 0.200),
    ("orange_chicken", "Orange chicken", "meat_alternate", "wheat;soybeans", 0, "ring", 0.210),
    ("dinner_roll", "Dinner roll", "grain", "wheat", 0, "daily", 0.420),
    ("brown_rice", "Brown rice", "grain", "", 0, "Tue, Thu", 0.150),
    ("whole_wheat_tortilla", "Whole wheat tortilla", "grain", "wheat", 0, "Mon, Wed, Fri", 0.140),
    ("whole_wheat_pita", "Whole wheat pita", "grain", "wheat", 0, "Tue, Fri", 0.100),
    ("steamed_carrots", "Steamed carrots", "vegetable", "", 120, "daily", 0.295),
    ("broccoli", "Broccoli", "vegetable", "", 80, "Mon, Wed, Fri", 0.180),
    ("side_salad", "Side salad", "vegetable", "", 100, "daily", 0.120),
    ("black_beans", "Seasoned black beans", "vegetable", "", 60, "Tue", 0.110),
    ("seasoned_corn", "Seasoned corn", "vegetable", "", 60, "Thu", 0.150),
    ("fruit_cup", "Fruit cup", "fruit", "", 150, "daily", 0.433),
    ("mandarin_oranges", "Mandarin oranges", "fruit", "", 70, "Mon, Wed, Fri", 0.150),
    ("apple_slices", "Apple slices", "fruit", "", 80, "Tue, Thu", 0.170),
    ("banana", "Banana", "fruit", "", 60, "Mon, Thu", 0.120),
    ("chocolate_milk", "Chocolate milk", "milk", "milk", 0, "daily", 0.308),
    ("milk_1pct", "1% milk", "milk", "milk", 0, "daily", 0.140),
    ("milk_fat_free", "Fat-free milk", "milk", "milk", 0, "daily", 0.080),
]
ITEMS = [(item_id, name, component, _scaled_cost(item_id, component), allergens,
          floor, schedule, rate)
         for item_id, name, component, allergens, floor, schedule, rate in _ITEM_DEFINITIONS]
# Costs are rescaled from research targets. The first relative calibration came
# from Ekansh Simgekar's prototype data; the prototype data is simulated.
# cheese_pizza, chicken_nuggets, popcorn_chicken, chocolate_milk, fruit_cup, steamed_carrots.
RING = [item[0] for item in ITEMS if item[2] == "meat_alternate"]
# Dietary tags in a fixed order. vegan always comes with vegetarian.
DIET = {
    "cheese_pizza": "vegetarian", "beef_nachos": "contains_beef", "cheeseburger": "contains_beef",
    "spicy_chicken_sandwich": "spicy",
    "bean_cheese_burrito": "vegetarian", "veggie_burger": "vegetarian",
    "black_bean_quesadilla": "vegetarian", "chickpea_curry_rice": "vegetarian;vegan",
    "falafel_wrap": "vegetarian;vegan", "teriyaki_tofu_bowl": "vegetarian;vegan",
    "dinner_roll": "vegetarian", "brown_rice": "vegetarian;vegan", "steamed_carrots": "vegetarian;vegan",
    "broccoli": "vegetarian;vegan", "fruit_cup": "vegetarian;vegan", "mandarin_oranges": "vegetarian;vegan",
    "chocolate_milk": "vegetarian", "milk_1pct": "vegetarian",
    "whole_wheat_tortilla": "vegetarian;vegan", "whole_wheat_pita": "vegetarian;vegan",
    "side_salad": "vegetarian;vegan", "black_beans": "vegetarian;vegan", "seasoned_corn": "vegetarian;vegan",
    "apple_slices": "vegetarian;vegan", "banana": "vegetarian;vegan", "milk_fat_free": "vegetarian",
}
VEGETARIAN_ENTREES = [item_id for item_id in RING if "vegetarian" in DIET.get(item_id, "").split(";")]
MEAT_ENTREES = [item_id for item_id in RING if item_id not in VEGETARIAN_ENTREES]
# The entree rotation alternates vegetarian and meat entrees, so any three
# neighbours in it always include at least one vegetarian entree.
ROTATION = [item_id for pair in zip(VEGETARIAN_ENTREES, MEAT_ENTREES) for item_id in pair]
ENTREES_PER_DAY = 3
# Each entree has only 28 to 30 history days, so its sold-out share moves several
# points with the rotation's phase. This step and phase were picked (of 196 tried,
# on the earlier calendar) to keep every entree at or under the 35% sold-out cap
# while giving a varied week; on the current calendar the highest is 27.6%.
# See data/sources.md.
ROTATION_WEEKDAY_STEP = 4
ROTATION_PHASE = 11
VOTE_OPTIONS = 4
VOTE_TARGET_WEEKDAY = 3  # Thursday
VOTE_MIN_LEAD_DAYS = 7
_WEEKDAY_ABSENCE_RELATIVE = (1.17, 1.0, 1.0, 1.0, 1.22)
_weekday_mean = sum(_WEEKDAY_ABSENCE_RELATIVE) / len(_WEEKDAY_ABSENCE_RELATIVE)
WEEKDAY_ATTENDANCE = tuple(value / _weekday_mean for value in _WEEKDAY_ABSENCE_RELATIVE)
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


def vote_target(open_day, days):
    """The school day a vote opened on ``open_day`` decides, or None.

    It is the first Thursday at least a week out. If that Thursday is a holiday,
    it is the next school day after it. ``days`` is the sorted list of school days.
    """
    earliest = open_day + timedelta(days=VOTE_MIN_LEAD_DAYS)
    thursday = earliest + timedelta(days=(VOTE_TARGET_WEEKDAY - earliest.weekday()) % 7)
    return next((d for d in days if d >= thursday), None)


def _history_raw_entree_take_rate():
    days = school_days(HISTORY_START, HISTORY_END)
    daily_sums = [sum(rate for item_id, _, component, _, _, _, _, rate in ITEMS
                      if component == "meat_alternate" and item_id in menu_for(day))
                  for day in days]
    return sum(daily_sums) / len(daily_sums)


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


def _weekday_index(day):
    """How many earlier school days fall on the same weekday as ``day``."""
    return sum(1 for d in school_days(HISTORY_START, day - timedelta(days=1)) if d.weekday() == day.weekday())


_ENTREE_CACHE = {}


def entrees_for(day):
    """The day's entrees in rotation order.

    Each weekday walks the rotation on its own, three entrees per serving day,
    so every entree comes back on every weekday about once every five weeks.
    That keeps same-weekday history deep enough for the forecast engine.
    Weekdays start four places apart, so one week shows about 12 of the 14 entrees.
    """
    if day not in _ENTREE_CACHE:
        start = ENTREES_PER_DAY * _weekday_index(day) + ROTATION_WEEKDAY_STEP * day.weekday() + ROTATION_PHASE
        _ENTREE_CACHE[day] = [ROTATION[(start + i) % len(ROTATION)] for i in range(ENTREES_PER_DAY)]
    return _ENTREE_CACHE[day]


_WEEKDAY_NAMES = ("Mon", "Tue", "Wed", "Thu", "Fri")


def _serves_on(schedule, weekday):
    if schedule == "daily":
        return True
    return weekday in {_WEEKDAY_NAMES.index(name) for name in schedule.split(", ")}


def menu_for(day):
    entrees = set(entrees_for(day))
    served = []
    for item_id, _, _, _, _, _, schedule, _ in ITEMS:
        if schedule == "ring":
            if item_id in entrees:
                served.append(item_id)
        elif _serves_on(schedule, day.weekday()):
            served.append(item_id)
    return served


def vote_options_for(open_index, target):
    """Four entree options for one open day.

    Exactly one option is on the target day's menu: the target's special, which is
    the entree the simulated vote ends up serving. The other three are off-menu
    entrees that change from day to day. At least one option is vegetarian.
    """
    on_menu = entrees_for(target)
    special = on_menu[0]
    off_menu = [item_id for item_id in ROTATION if item_id not in on_menu]
    start = (VOTE_OPTIONS - 1) * open_index
    off_menu = [off_menu[(start + i) % len(off_menu)] for i in range(len(off_menu))]
    fillers = off_menu[:VOTE_OPTIONS - 1]
    if special not in VEGETARIAN_ENTREES and not any(item_id in VEGETARIAN_ENTREES for item_id in fillers):
        fillers[-1] = next(item_id for item_id in off_menu if item_id in VEGETARIAN_ENTREES)
    position = open_index % VOTE_OPTIONS
    return fillers[:position] + [special] + fillers[position:]


# 0.636691 is the per-day sum of the three entree take rates, averaged over
# history days. The factor makes that sum 0.46 of students present.
PARTICIPATION_FACTOR = 0.46 / _history_raw_entree_take_rate()


def normal_draw(rng):
    total = 0.0
    for _ in range(12):
        total += rng.random()
    return total - 6.0


def rounded_five(value):
    return 5 * round(value / 5)


def effective_rate(rate):
    return rate * PARTICIPATION_FACTOR


def _item_rows():
    return [[item_id, name, component, f"{cost:.2f}", allergens, floor, DIET.get(item_id, "")]
            for item_id, name, component, cost, allergens, floor, _, _ in ITEMS]


def write_items(out):
    with open(out / "items.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["item_id", "name", "component", "cost_per_serving", "allergens", "prep_floor", "diet"])
        writer.writerows(_item_rows())


def generate(seed=SEED, enroll=ENROLL):
    """Build the simulated rows and uncensored demand in memory.

    ``true_demand`` is keyed by ``(date, item_id)`` and is intentionally not
    written to any contract CSV.
    """
    history_days = school_days(HISTORY_START, HISTORY_END)
    future_days = school_days(HISTORY_END + timedelta(days=1), FUTURE_END)
    all_days = history_days + future_days
    pre_break = {d for d, nxt in zip(all_days, all_days[1:]) if (nxt - d).days > 3}
    item_map = {item[0]: item for item in ITEMS}
    histories = {item[0]: [] for item in ITEMS}
    rng = random.Random(seed)
    history_rows, future_rows, menu_rows = [], [], []
    true_demand = {}
    attendance_values = []
    attendance_floor = min(enroll, round(ATTENDANCE_FLOOR_BASE * enroll / 1200))
    absence_noise = ABSENCE_NOISE_BASE * enroll / 1200
    expected_attendance = enroll * (1 - BASE_ABSENCE)

    for day in all_days:
        note = day_note(day, pre_break)
        z_att = normal_draw(rng)
        z_day = normal_draw(rng)
        absence_note = {"pre_break": 1.9, "rainy": 1.25, "testing": 0.7}.get(note, 1.0)
        absent = round(enroll * BASE_ABSENCE * WEEKDAY_ATTENDANCE[day.weekday()] * absence_note + absence_noise * z_att)
        attendance = max(attendance_floor, min(enroll, enroll - absent))
        attendance_values.append(attendance)
        rows = []
        for item_id in menu_for(day):
            z_item = normal_draw(rng)
            _, _, component, cost, allergens, floor, _, rate = item_map[item_id]
            prior = histories[item_id][-20:]
            take_rate = effective_rate(rate)
            prep_ratio = COMPONENT_PREP_RATIOS[component]
            if prior:
                total = 0
                for value in prior:
                    total += value
                usual = prep_ratio * total / len(prior)
            else:
                usual = prep_ratio * expected_attendance * take_rate
            prepared = max(floor, rounded_five(usual))
            weekday_factor = 1.116 if item_id == "cheese_pizza" and day.weekday() == 4 else 0.971 if item_id == "cheese_pizza" else 1.0
            demand_note = {"early_release": 0.92, "rainy": 1.04, "pre_break": 0.97}.get(note, 1.0)
            f_day = max(0.75, min(1.35, 1 + 0.03 * z_day))
            f_item = max(0.75, min(1.35, 1 + 0.06 * z_item))
            demand = round(attendance * take_rate * weekday_factor * demand_note * f_day * f_item)
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
        for row in rows:
            true_demand[(day.isoformat(), row["item_id"])] = row["demand"]
        special = entrees_for(day)[0]
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

    vote_rows = []
    open_index = 0
    for open_day in future_days:
        target = vote_target(open_day, future_days)
        if target is None:
            continue
        options = vote_options_for(open_index, target)
        vote_rows.append([open_day.isoformat(), target.isoformat(), "entree", *options])
        open_index += 1
    return {
        "items_rows": _item_rows(),
        "history_rows": history_rows,
        "future_rows": future_rows,
        "menu_rows": menu_rows,
        "vote_rows": vote_rows,
        "items": _item_rows(),
        "history": history_rows,
        "future": future_rows,
        "menu": menu_rows,
        "vote_options": vote_rows,
        "true_demand": true_demand,
        "attendance_values": attendance_values,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    out = args.out
    out.mkdir(parents=True, exist_ok=True)
    generated = generate()
    history_days = school_days(HISTORY_START, HISTORY_END)
    write_items(out)
    for filename, header, rows in (("meals.csv", HEADER, generated["history_rows"]),
                                   ("future_meals.csv", HEADER, generated["future_rows"]),
                                   ("menu.csv", ["date", "item_id", "day_note"], generated["menu_rows"])):
        with open(out / filename, "w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle, lineterminator="\n")
            writer.writerow(header)
            writer.writerows(rows)
    with open(out / "vote_options.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["open_date", "target_date", "target_slot", "option_1", "option_2", "option_3", "option_4"])
        writer.writerows(generated["vote_rows"])

    summary_rows = generated["history_rows"]  # the summary describes history only
    prepared = sum(int(row[4]) for row in summary_rows)
    taken = sum(int(row[5]) for row in summary_rows)
    sold = sum(int(row[9]) for row in summary_rows)
    component_shares = []
    for component in ("meat_alternate", "grain", "vegetable", "fruit", "milk"):
        component_rows = [row for row in summary_rows if row[2] == component]
        component_shares.append(f"{component} {sum(int(row[9]) for row in component_rows) / len(component_rows):.1%}")
    print(f"items.csv: {len(ITEMS)} rows")
    print(f"meals.csv: {len(generated['history_rows'])} rows; future_meals.csv: {len(generated['future_rows'])} rows; menu.csv: {len(generated['menu_rows'])} rows; vote_options.csv: {len(generated['vote_rows'])} rows")
    print(f"history: {history_days[0]}..{history_days[-1]} ({len(history_days)} school days); mean attendance {sum(generated['attendance_values'][:len(history_days)]) / len(history_days):.1f}")
    print(f"leftover: {(prepared - taken) / prepared:.1%}; sold-out: {sold / len(summary_rows):.1%} overall; by component: {', '.join(component_shares)}")


if __name__ == "__main__":
    main()
