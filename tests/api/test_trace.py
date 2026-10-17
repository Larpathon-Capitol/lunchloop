"""Black-box tests for GET /api/trace/forecast.

Expected values come from docs/backend-contract.md ("Behind the scenes" and
the forecast() comment block). The history, rates and misses are rebuilt here
straight from data/sample/meals.csv, and the final numbers are compared with
engine.forecast(), as the contract requires.
"""

import csv
import math
import statistics
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import engine

DATA = Path(__file__).resolve().parents[2] / "data" / "sample"
TODAY = "2026-10-19"
TACOS = "chicken_tacos"
MENU_DATES = [TODAY, "2026-10-20", "2026-10-23"]  # Monday, Tuesday, Friday


def read_csv(name):
    with (DATA / name).open(newline="") as handle:
        return list(csv.DictReader(handle))


MENU = read_csv("menu.csv")
MEALS = read_csv("meals.csv")


def items_on(day):
    return [row["item_id"] for row in MENU if row["date"] == day]


CASES = [(item, day) for day in MENU_DATES for item in items_on(day)]


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("LUNCHLOOP_DATA_DIR", str(DATA))
    monkeypatch.setenv("LUNCHLOOP_DB", str(tmp_path / "t.db"))
    monkeypatch.setenv("LUNCHLOOP_TODAY", TODAY)
    from api.main import create_app

    with TestClient(create_app()) as c:
        yield c


def trace(client, item, day=None, ratio=None, **extra):
    params = {"item_id": item}
    if day is not None:
        params["date"] = day
    if ratio is not None:
        params["ratio"] = ratio
    return client.get("/api/trace/forecast", params=params, **extra)


def raw_history(item, day):
    """The item's meal rows the forecast may use: dated before min(today, day)."""
    cutoff = min(date.fromisoformat(TODAY), date.fromisoformat(day))
    rows = [
        {
            "date": date.fromisoformat(r["date"]),
            "attendance": int(r["attendance"]),
            "taken": int(r["servings_taken"]),
        }
        for r in MEALS
        if r["item_id"] == item and date.fromisoformat(r["date"]) < cutoff
    ]
    return sorted(rows, key=lambda r: r["date"])


def baseline(rows, weekday):
    same = [r for r in rows if r["date"].weekday() == weekday]
    chosen = (same or rows)[-4:]
    return statistics.mean(r["taken"] / r["attendance"] for r in chosen)


# ----------------------------------------------------------- engine agreement


@pytest.mark.parametrize("item,day", CASES)
def test_trace_numbers_equal_engine_forecast(client, item, day):
    body = trace(client, item, day).json()
    expected = engine.forecast(item, day, ratio=3.0, data_dir=str(DATA))
    for key in ("predicted", "buffer", "floor", "prep"):
        assert body[key] == expected[key], key
    assert body["item_id"] == item
    assert body["date"] == day
    assert body["simulated"] is True


@pytest.mark.parametrize("item,day", CASES)
def test_trace_sigma_is_close_to_engine_sigma(client, item, day):
    body = trace(client, item, day).json()
    expected = engine.forecast(item, day, ratio=3.0, data_dir=str(DATA))
    # forecast() reports sigma to 2 decimals
    assert body["sigma"] == pytest.approx(expected["sigma"], abs=0.006)


def test_trace_sigma_equals_engine_sigma_exactly(client):
    # The contract says sigma "must equal what forecast() returns".
    mismatches = []
    for item, day in CASES:
        body = trace(client, item, day).json()
        expected = engine.forecast(item, day, ratio=3.0, data_dir=str(DATA))
        if body["sigma"] != expected["sigma"]:
            mismatches.append((item, day, body["sigma"], expected["sigma"]))
    assert mismatches == []


@pytest.mark.parametrize("item,day", CASES)
def test_prep_is_predicted_plus_buffer_or_the_floor(client, item, day):
    body = trace(client, item, day).json()
    assert body["prep"] == max(body["predicted"] + body["buffer"], body["floor"])


@pytest.mark.parametrize("item,day", CASES)
def test_buffer_is_ceil_of_z_times_sigma(client, item, day):
    body = trace(client, item, day).json()
    # at ratio 3 the service level is 3/4, so z is the 75th percentile of a normal curve
    z = statistics.NormalDist().inv_cdf(0.75)
    assert body["z"] == pytest.approx(z, abs=1e-6)
    product = z * body["sigma"]
    assert math.ceil(product - 1e-6) <= body["buffer"] <= math.ceil(product + 1e-6)


# --------------------------------------------------------- the rows behind it


@pytest.mark.parametrize("item,day", CASES)
def test_mean_rate_is_the_mean_of_the_history_rates(client, item, day):
    body = trace(client, item, day).json()
    assert body["history"], "history should not be empty"
    assert body["mean_rate"] == pytest.approx(statistics.mean(r["rate"] for r in body["history"]))
    for row in body["history"]:
        assert row["rate"] == pytest.approx(row["taken"] / row["attendance"])


@pytest.mark.parametrize("item,day", CASES)
def test_history_is_the_newest_four_same_weekday_rows(client, item, day):
    body = trace(client, item, day).json()
    weekday = date.fromisoformat(day).weekday()
    rows = raw_history(item, day)
    same = [r for r in rows if r["date"].weekday() == weekday]
    expected = (same or rows)[-4:]
    assert sorted(r["date"] for r in expected) == sorted(
        date.fromisoformat(r["date"]) for r in body["history"]
    )
    if same:
        assert len(body["history"]) == min(4, len(same))
        assert all(date.fromisoformat(r["date"]).weekday() == weekday for r in body["history"])
    by_date = {r["date"].isoformat(): r for r in expected}
    for row in body["history"]:
        source = by_date[row["date"]]
        assert (row["attendance"], row["taken"]) == (source["attendance"], source["taken"])


@pytest.mark.parametrize("item,day", CASES)
def test_mean_rate_matches_an_independent_baseline(client, item, day):
    body = trace(client, item, day).json()
    weekday = date.fromisoformat(day).weekday()
    assert body["mean_rate"] == pytest.approx(baseline(raw_history(item, day), weekday))


@pytest.mark.parametrize("item,day", CASES)
def test_predicted_is_mean_rate_times_attendance(client, item, day):
    body = trace(client, item, day).json()
    assert abs(body["predicted"] - body["mean_rate"] * body["attendance"]) <= 0.5


@pytest.mark.parametrize("item,day", CASES)
def test_attendance_is_the_mean_of_the_attendance_history(client, item, day):
    body = trace(client, item, day).json()
    weekday = date.fromisoformat(day).weekday()
    cutoff = min(date.fromisoformat(TODAY), date.fromisoformat(day))
    school_days = {}
    for r in MEALS:
        d = date.fromisoformat(r["date"])
        if d < cutoff:
            school_days.setdefault(d, int(r["attendance"]))
    same = sorted(d for d in school_days if d.weekday() == weekday)[-4:]
    assert [r["date"] for r in body["attendance_history"]] == [d.isoformat() for d in same]
    assert [r["attendance"] for r in body["attendance_history"]] == [school_days[d] for d in same]
    # engine reports a whole number of students: the mean, rounded
    assert abs(body["attendance"] - statistics.mean(school_days[d] for d in same)) <= 0.5


@pytest.mark.parametrize("item,day", CASES)
def test_misses_and_sigma_follow_the_walk_forward_rule(client, item, day):
    body = trace(client, item, day).json()
    rows = raw_history(item, day)
    expected = []
    for row in rows[-20:]:
        earlier = [r for r in rows if r["date"] < row["date"]]
        if len(earlier) < 4:
            continue
        expected.append(row["taken"] / row["attendance"] - baseline(earlier, row["date"].weekday()))
    assert body["misses"] == pytest.approx(expected)
    if body["sigma_fallback"]:
        assert body["sigma"] == pytest.approx(0.1 * body["predicted"], abs=0.5)
    else:
        assert body["sigma"] == pytest.approx(statistics.stdev(body["misses"]) * body["attendance"], abs=0.006)


def test_other_fields_are_present_and_sensible(client):
    body = trace(client, TACOS, "2026-10-23").json()
    assert body["name"] == "Chicken tacos"  # items.csv
    assert body["weekday"] == "Friday"  # 2026-10-23 is a Friday
    assert body["ratio"] == 3.0
    assert isinstance(body["reason"], str) and body["reason"]
    assert isinstance(body["sigma_fallback"], bool)
    assert body["service_level"] == pytest.approx(0.75, abs=1e-4)
    expected_keys = {
        "item_id", "name", "date", "weekday", "ratio", "history", "mean_rate", "attendance",
        "attendance_history", "predicted", "misses", "sigma", "sigma_fallback", "service_level",
        "z", "buffer", "floor", "prep", "reason", "simulated",
    }
    assert expected_keys <= set(body)


def test_date_defaults_to_today_and_ratio_to_three(client):
    default = trace(client, TACOS).json()
    explicit = trace(client, TACOS, TODAY, ratio=3.0).json()
    assert default["date"] == TODAY
    assert default["weekday"] == "Monday"
    assert default["ratio"] == 3.0
    assert default == explicit


# ----------------------------------------------------------------- the ratio


@pytest.mark.parametrize("ratio", [1.0, 2.0, 3.0, 9.0])
def test_ratio_sets_service_level_and_matches_engine(client, ratio):
    body = trace(client, TACOS, "2026-10-23", ratio=ratio).json()
    expected = engine.forecast(TACOS, "2026-10-23", ratio=ratio, data_dir=str(DATA))
    assert body["ratio"] == ratio
    assert body["service_level"] == pytest.approx(ratio / (ratio + 1), abs=1e-4)
    z = statistics.NormalDist().inv_cdf(ratio / (ratio + 1))
    assert body["z"] == pytest.approx(z, abs=1e-6)
    for key in ("predicted", "buffer", "floor", "prep"):
        assert body[key] == expected[key], key


def test_even_ratio_means_no_buffer_and_a_bigger_ratio_means_a_bigger_one(client):
    # ratio 1 -> service level 1/2 -> z = 0 -> no buffer
    even = trace(client, TACOS, "2026-10-23", ratio=1.0).json()
    cautious = trace(client, TACOS, "2026-10-23", ratio=9.0).json()
    assert even["buffer"] == 0
    assert cautious["buffer"] > even["buffer"]
    assert cautious["prep"] > even["prep"]
    assert cautious["predicted"] == even["predicted"]


# --------------------------------------------------------------- bad requests


def test_unknown_item_is_404(client):
    response = trace(client, "no_such_item", TODAY)
    assert response.status_code == 404
    assert "error" in response.json()


@pytest.mark.parametrize("bad", ["garbage", "2026-13-45", "2026-10-1", "20261019"])
def test_bad_date_is_400(client, bad):
    response = client.get("/api/trace/forecast", params={"item_id": TACOS, "date": bad})
    assert response.status_code == 400
    assert "error" in response.json()


@pytest.mark.parametrize("day", ["2026-10-17", "2026-10-18", "2027-06-01", "2020-01-01"])
def test_valid_date_not_on_any_menu_is_404(client, day):
    # 10-17 and 10-18 are a weekend; the others are outside the menu data
    response = trace(client, TACOS, day)
    assert response.status_code == 404
    assert "error" in response.json()


def test_missing_item_id_is_400(client):
    assert client.get("/api/trace/forecast").status_code == 400


def test_bad_ratio_is_400(client):
    assert trace(client, TACOS, TODAY, ratio="abc").status_code == 400
