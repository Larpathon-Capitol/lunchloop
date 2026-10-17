"""Evaluate LunchLoop against the simulated demand hidden by sold-out rows.

This is a development-only tool.  The simulator exposes uncensored demand in
memory, while the CSV contract intentionally stores only servings taken.
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import statistics
import sys
import tempfile
from contextlib import contextmanager
from collections import defaultdict
from pathlib import Path
from typing import Iterable, Mapping


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import data.simulate as simulate  # noqa: E402
from data.simulate import ENROLL, HEADER, SEED, generate  # noqa: E402
from engine import backtest  # noqa: E402


ITEMS_HEADER = ["item_id", "name", "component", "cost_per_serving", "allergens", "prep_floor"]
MENU_HEADER = ["date", "item_id", "day_note"]
VOTES_HEADER = ["open_date", "target_date", "target_slot", "option_1", "option_2", "option_3"]

# unopened or sealed items that usually go back to the cooler (an assumption, see data/sources.md)
PACKAGED_ITEM_IDS = frozenset({"chocolate_milk", "milk_1pct", "fruit_cup", "mandarin_oranges"})


@contextmanager
def _prep_ratio_overrides(overrides: Mapping[str, float] | None):
    if not overrides:
        yield
        return
    unknown = sorted(set(overrides) - set(simulate.COMPONENT_PREP_RATIOS))
    if unknown:
        raise ValueError(f"unknown component(s) in --prep-ratio: {', '.join(unknown)}")
    original = simulate.COMPONENT_PREP_RATIOS
    patched = original.copy()
    patched.update({key: float(value) for key, value in overrides.items()})
    simulate.COMPONENT_PREP_RATIOS = patched
    try:
        yield
    finally:
        simulate.COMPONENT_PREP_RATIOS = original


def _write_csv(folder: Path, name: str, header: Iterable[str], rows: Iterable[Iterable[object]]) -> None:
    with (folder / name).open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(rows)


def write_contract(folder: Path, generated: Mapping[str, object]) -> None:
    """Write one generated dataset using the public data CSV contract."""

    _write_csv(folder, "items.csv", ITEMS_HEADER, generated["items_rows"])
    _write_csv(folder, "meals.csv", HEADER, generated["history_rows"])
    _write_csv(folder, "future_meals.csv", HEADER, generated["future_rows"])
    _write_csv(folder, "menu.csv", MENU_HEADER, generated["menu_rows"])
    _write_csv(folder, "vote_options.csv", VOTES_HEADER, generated["vote_rows"])


def bootstrap_interval(values: Iterable[float], resamples: int = 2000, seed: int = 0) -> list[float]:
    """Return a deterministic percentile bootstrap interval for a mean.

    The input values are paired day-level savings.  A point estimate is kept
    inside the returned interval so small samples remain useful in reports.
    """

    values = [float(value) for value in values]
    if not values:
        return [0.0, 0.0]
    if isinstance(resamples, bool) or not isinstance(resamples, int) or resamples < 1:
        raise ValueError("resamples must be an integer >= 1")
    point = statistics.fmean(values)
    rng = random.Random(seed)
    count = len(values)
    means = [
        statistics.fmean(rng.choice(values) for _ in range(count))
        for _ in range(resamples)
    ]
    means.sort()

    def percentile(fraction: float) -> float:
        position = fraction * (len(means) - 1)
        lower = int(position)
        upper = min(lower + 1, len(means) - 1)
        weight = position - lower
        return means[lower] + weight * (means[upper] - means[lower])

    return [round(min(percentile(0.025), point), 2), round(max(percentile(0.975), point), 2)]


def _arm_metrics(rows: list[Mapping[str, object]], prep_key: str, demand_key: str, ratio: float) -> dict:
    leftover_servings = 0
    leftover_dollars = 0.0
    short_servings = 0
    short_dollars = 0.0
    daily = defaultdict(lambda: {"leftover_dollars": 0.0, "short_servings": 0, "short_dollars": 0.0})
    for row in rows:
        prep = int(row[prep_key])
        demand = int(row[demand_key])
        cost = float(row["cost"])
        date = str(row["date"])
        leftover = max(0, prep - demand)
        short = max(0, demand - prep)
        leftover_servings += leftover
        leftover_dollars += leftover * cost
        short_servings += short
        short_dollars += short * cost
        daily[date]["leftover_dollars"] += leftover * cost
        daily[date]["short_servings"] += short
        daily[date]["short_dollars"] += short * cost

    days = len(daily)
    net_dollars = leftover_dollars + ratio * short_dollars
    result = {
        "leftover_servings": int(leftover_servings),
        "dollars_wasted": round(leftover_dollars, 2),
        "servings_short": int(short_servings),
        "dollars_short": round(short_dollars, 2),
        "net_dollars": round(net_dollars, 2),
        "leftover_dollars_per_day": round(leftover_dollars / days, 2) if days else 0.0,
        "short_servings_per_day": round(short_servings / days, 2) if days else 0.0,
        "net_dollars_per_day": round(net_dollars / days, 2) if days else 0.0,
    }
    return result


def score_rows(
    rows: Iterable[Mapping[str, object]],
    ratio: float = 3.0,
    demand_key: str = "true_demand",
    bootstrap_resamples: int | None = None,
    bootstrap_seed: int = 0,
    component_by_item: Mapping[str, str] | None = None,
) -> dict:
    """Score both prep arms against a demand field in item-level rows.

    Rows must contain ``date``, ``prep_lunchloop``, ``prep_usual``, ``cost`` and
    the selected demand field.  Aggregation happens by date before any mean or
    bootstrap calculation, so menu size cannot weight one school day more than
    another.
    """

    rows = list(rows)
    days = sorted({str(row["date"]) for row in rows})
    lunchloop = _arm_metrics(rows, "prep_lunchloop", demand_key, ratio)
    usual = _arm_metrics(rows, "prep_usual", demand_key, ratio)

    daily_lunch = defaultdict(float)
    daily_usual = defaultdict(float)
    for row in rows:
        date = str(row["date"])
        cost = float(row["cost"])
        demand = int(row[demand_key])
        for key, prep in (
            (daily_lunch, int(row["prep_lunchloop"])),
            (daily_usual, int(row["prep_usual"])),
        ):
            leftover = max(0, prep - demand) * cost
            short = max(0, demand - prep) * cost
            key[date] += leftover + ratio * short
    daily_saved = [daily_usual[day] - daily_lunch[day] for day in days]
    net_saved = sum(daily_saved)
    result = {
        "school_days": len(days),
        "lunchloop": lunchloop,
        "usual": usual,
        "net_dollars_saved": round(net_saved, 2),
        "net_dollars_saved_per_day": round(net_saved / len(days), 2) if days else 0.0,
        "_daily_net_saved": daily_saved,
    }
    if component_by_item is not None:
        item_saved = defaultdict(float)
        component_saved = defaultdict(float)
        for row in rows:
            date = str(row["date"])
            cost = float(row["cost"])
            demand = int(row[demand_key])
            item_id = str(row["item_id"])
            usual_prep = int(row["prep_usual"])
            lunchloop_prep = int(row["prep_lunchloop"])

            def net(prep: int) -> float:
                return max(0, prep - demand) * cost + ratio * max(0, demand - prep) * cost

            saved = net(usual_prep) - net(lunchloop_prep)
            item_saved[item_id] += saved
            component_saved[component_by_item[item_id]] += saved
        breakdown = []
        components = list(dict.fromkeys(component_by_item.values()))
        for component in components:
            breakdown.append({
                "component": component,
                "label": "entree" if component == "meat_alternate" else component,
                "net_dollars_saved": round(component_saved[component], 2),
            })
        packaged = round(sum(item_saved[item_id] for item_id in PACKAGED_ITEM_IDS), 2)
        total = round(net_saved, 2)
        breakdown.append({
            "component": "total",
            "label": "total",
            "net_dollars_saved": total,
        })
        breakdown.append({
            "component": "packaged",
            "label": "of which packaged items that usually go back to the cooler (milk cartons, fruit cup, mandarin oranges)",
            "net_dollars_saved": packaged,
        })
        breakdown.append({
            "component": "total_without_packaged",
            "label": "total without packaged items",
            "net_dollars_saved": round(total - packaged, 2),
        })
        for entry in breakdown:
            entry["net_dollars_saved_per_day"] = round(entry["net_dollars_saved"] / len(days), 2) if days else 0.0
            entry["share_percent"] = round(entry["net_dollars_saved"] / total * 100, 2) if total else 0.0
        result["component_breakdown"] = breakdown
    if bootstrap_resamples is not None:
        result["bootstrap_95_ci"] = bootstrap_interval(daily_saved, bootstrap_resamples, bootstrap_seed)
    return result


def _series_rows(series: Iterable[Mapping[str, object]], generated: Mapping[str, object]) -> list[dict]:
    costs = {(row[0], row[1]): float(row[6]) for row in generated["history_rows"]}
    true_demand = generated["true_demand"]
    rows = []
    for row in series:
        key = (row["date"], row["item_id"])
        rows.append({
            **row,
            "true_demand": int(true_demand[key]),
            "cost": costs[key],
        })
    return rows


def _item_components(folder: Path) -> dict[str, str]:
    with (folder / "items.csv").open(newline="", encoding="utf-8") as handle:
        return {row["item_id"]: row["component"] for row in csv.DictReader(handle)}


def evaluate_seed(
    seed: int,
    weeks: int = 4,
    ratio: float = 3.0,
    enroll: int = ENROLL,
    bootstrap_resamples: int = 2000,
    bootstrap_seed: int = 0,
) -> dict:
    """Generate, backtest, and score one seed in a cleaned temporary folder."""

    generated = generate(seed=seed, enroll=enroll)
    with tempfile.TemporaryDirectory(prefix="lunchloop-eval-") as temp:
        folder = Path(temp)
        write_contract(folder, generated)
        result = backtest(weeks=weeks, ratio=ratio, data_dir=str(folder))
        rows = _series_rows(result["series"], generated)
        components = _item_components(folder)
        true = score_rows(rows, ratio, "true_demand", bootstrap_resamples, bootstrap_seed, components)
        censored = score_rows(rows, ratio, "taken", bootstrap_resamples, bootstrap_seed)
        censored["backtest_net_dollars_saved"] = result["net_dollars_saved"]
        censored["backtest_lunchloop"] = result["lunchloop"]
        censored["backtest_usual"] = result["usual"]
    return {"seed": seed, "true_demand": true, "censored": censored}


def evaluate(
    seeds: int = 5,
    weeks: int = 4,
    ratio: float = 3.0,
    enroll: int = ENROLL,
    bootstrap_resamples: int = 2000,
    bootstrap_seed: int = 0,
    prep_ratios: Mapping[str, float] | None = None,
) -> dict:
    if isinstance(seeds, bool) or not isinstance(seeds, int) or seeds < 1:
        raise ValueError("seeds must be an integer >= 1")
    with _prep_ratio_overrides(prep_ratios):
        per_seed = [
            evaluate_seed(SEED + offset, weeks, ratio, enroll, bootstrap_resamples, bootstrap_seed)
            for offset in range(seeds)
        ]
    pooled = {}
    for view in ("true_demand", "censored"):
        # Pool the per-seed totals and the retained paired day-level savings;
        # no second set of temporary datasets is needed.
        entries = [item[view] for item in per_seed]
        days = sum(item["school_days"] for item in entries)
        daily_saved = [value for item in entries for value in item["_daily_net_saved"]]
        arm_data = {}
        for arm in ("lunchloop", "usual"):
            arm_data[arm] = {}
            for key in ("leftover_servings", "dollars_wasted", "servings_short", "dollars_short", "net_dollars"):
                value = sum(item[arm][key] for item in entries)
                arm_data[arm][key] = int(value) if key.endswith("servings") else round(value, 2)
            arm_data[arm]["leftover_dollars_per_day"] = round(arm_data[arm]["dollars_wasted"] / days, 2)
            arm_data[arm]["short_servings_per_day"] = round(arm_data[arm]["servings_short"] / days, 2)
            arm_data[arm]["net_dollars_per_day"] = round(arm_data[arm]["net_dollars"] / days, 2)
        net = arm_data["usual"]["net_dollars"] - arm_data["lunchloop"]["net_dollars"]
        pooled[view] = {
            "school_days": days,
            "lunchloop": arm_data["lunchloop"],
            "usual": arm_data["usual"],
            "net_dollars_saved": round(net, 2),
            "net_dollars_saved_per_day": round(net / days, 2),
            "bootstrap_95_ci": bootstrap_interval(daily_saved, bootstrap_resamples, bootstrap_seed),
        }
        if view == "true_demand":
            component_rows = []
            for index, component in enumerate(entries[0].get("component_breakdown", [])):
                amount = round(sum(item["component_breakdown"][index]["net_dollars_saved"] for item in entries), 2)
                component_rows.append({
                    "component": component["component"],
                    "label": component["label"],
                    "net_dollars_saved": amount,
                    "net_dollars_saved_per_day": round(amount / days, 2) if days else 0.0,
                })
            for row in component_rows:
                row["share_percent"] = round(row["net_dollars_saved"] / net * 100, 2) if net else 0.0
            pooled[view]["component_breakdown"] = component_rows
    for item in per_seed:
        item["true_demand"].pop("_daily_net_saved", None)
        item["censored"].pop("_daily_net_saved", None)
    return {
        "simulated": True,
        "seeds": [SEED + offset for offset in range(seeds)],
        "weeks": weeks,
        "ratio": float(ratio),
        "enroll": enroll,
        "bootstrap_resamples": bootstrap_resamples,
        "bootstrap_seed": bootstrap_seed,
        "prep_ratio_overrides": dict(prep_ratios or {}),
        "per_seed": per_seed,
        "pooled": pooled,
    }


def _table(report: Mapping[str, object]) -> str:
    lines = [
        "All data is simulated.",
        "",
        "| scope | demand view | school days | LunchLoop leftover $/day | Usual leftover $/day | LunchLoop short servings/day | Usual short servings/day | net $ saved/day | 95% paired bootstrap CI |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    if report.get("prep_ratio_overrides"):
        lines.insert(1, "\n".join(
            f"What-if: {component} usual amount {value:g} (data files use {simulate.COMPONENT_PREP_RATIOS[component]:g})"
            for component, value in report["prep_ratio_overrides"].items()
        ))
    for item in report["per_seed"] + [{"seed": "pooled", **report["pooled"]}]:
        scope = f"seed {item['seed']}" if item["seed"] != "pooled" else "pooled"
        for view in ("true_demand", "censored"):
            data = item[view]
            lines.append(
                f"| {scope} | {view} | {data['school_days']} | "
                f"${data['lunchloop']['leftover_dollars_per_day']:.2f} | ${data['usual']['leftover_dollars_per_day']:.2f} | "
                f"{data['lunchloop']['short_servings_per_day']:.2f} | {data['usual']['short_servings_per_day']:.2f} | "
                f"${data['net_dollars_saved_per_day']:.2f} | "
                f"[${data['bootstrap_95_ci'][0]:.2f}, ${data['bootstrap_95_ci'][1]:.2f}] |"
            )
    pooled_true = report["pooled"]["true_demand"]
    lines.extend([
        "",
        "Pooled true demand net savings by meal component:",
        "",
        "| meal component | net $ saved/day | share of total net saving |",
        "| --- | ---: | ---: |",
    ])
    for row in pooled_true["component_breakdown"]:
        lines.append(
            f"| {row['label']} | ${row['net_dollars_saved_per_day']:.2f} | {row['share_percent']:.2f}% |"
        )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seeds", type=int, default=5)
    parser.add_argument("--weeks", type=int, default=4)
    parser.add_argument("--ratio", type=float, default=3.0)
    parser.add_argument("--enroll", type=int, default=ENROLL)
    parser.add_argument("--json", type=Path)
    parser.add_argument("--bootstrap-resamples", type=int, default=2000, help=argparse.SUPPRESS)
    parser.add_argument("--prep-ratio", action="append", default=[], metavar="COMPONENT=VALUE")
    args = parser.parse_args(argv)
    prep_ratios = {}
    for raw in args.prep_ratio:
        component, separator, value = raw.partition("=")
        if not separator or not component or not value:
            parser.error("--prep-ratio must be COMPONENT=VALUE")
        if component not in simulate.COMPONENT_PREP_RATIOS:
            parser.error(f"unknown component in --prep-ratio: {component}")
        try:
            prep_ratios[component] = float(value)
        except ValueError:
            parser.error(f"invalid value for --prep-ratio {component}: {value}")
    report = evaluate(args.seeds, args.weeks, args.ratio, args.enroll, args.bootstrap_resamples, prep_ratios=prep_ratios)
    print(_table(report))
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
