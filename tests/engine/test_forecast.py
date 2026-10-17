"""Tests for forecast, explain, prep_list and meal_check."""
import csv
from pathlib import Path
import pytest

from engine import forecast, explain, prep_list, meal_check, backtest, simulate, meter, UnknownDateError, UnknownItemError

ITEMS = ["item_id","name","component","cost_per_serving","allergens","prep_floor"]
MEALS = ["date","item_id","component","attendance","servings_prepared","servings_taken","cost_per_serving","allergens","vote_share","sold_out","day_note"]
MENU = ["date","item_id","day_note"]

def make_data(root, rows=None, menu_dates=None, floor=0, allergens="milk;soybeans", menu_items=("a",)):
    rows = rows or []
    with open(root/"items.csv", "w", newline="") as f:
        w=csv.writer(f); w.writerow(ITEMS); w.writerow(["a","Alpha","grain","1.25",allergens,floor]); w.writerow(["b","Beta","fruit","0.50","",0]); w.writerow(["c","Gamma","meat_alternate","1.00","",0]); w.writerow(["d","Delta","vegetable","0.75","",0]); w.writerow(["e","Epsilon","milk","0.40","",0])
    with open(root/"meals.csv", "w", newline="") as f:
        w=csv.writer(f); w.writerow(MEALS)
        for date,taken,att in rows:
            w.writerow([date,"a","grain",att,max(taken,200),taken,"1.25",allergens,"","0",""])
    with open(root/"menu.csv", "w", newline="") as f:
        w=csv.writer(f); w.writerow(MENU)
        for d in menu_dates or ["2026-10-19"]:
            for item_id in menu_items: w.writerow([d,item_id,""])

def monday_rows(n=9, taken=50, att=100):
    # Mondays 2026-08-17 onward
    import datetime as dt
    start=dt.date(2026,8,17)
    return [((start+dt.timedelta(days=7*i)).isoformat(),taken,att) for i in range(n)]

def test_hand_calculation_literal_and_rounding(tmp_path):
    import datetime as dt
    # Four quiet weeks establish a 0.50 rate on every weekday.  In week five,
    # the five weekday ratios are [0.40, 0.60, 0.50, 0.70, 0.30].  For the
    # Monday target, the last four Mondays are [0.50, 0.50, 0.50, 0.40], so
    # rate=.475, rate*100=47.5 and round-half-up gives predicted=48.
    # The last 20 history rows yield 15 zero misses plus
    # [-.10, .10, .00, .20, -.20].  Thus stdev=sqrt(.10/19)=.072548...,
    # sigma=7.2548..., the ratio-3 z is .674489..., and ceil(z*sigma)=5.
    start=dt.date(2026,9,14)
    final_week=[40,60,50,70,30]
    rows=[]
    for week in range(5):
        for weekday in range(5):
            day=start+dt.timedelta(days=7*week+weekday)
            taken=50 if week < 4 else final_week[weekday]
            rows.append((day.isoformat(), taken, 100))
    make_data(tmp_path, rows)
    got=forecast("a","2026-10-19",attendance=100,ratio=3,as_of="2026-10-19",data_dir=str(tmp_path))
    assert set(got)=={"item_id","date","attendance","predicted","sigma","buffer","prep","floor","service_level"}
    assert got["predicted"]==48 and got["sigma"]==7.25 and got["buffer"]==5 and got["prep"]==53
    # round-half-up at exactly .5: .25*1002 = 250.5 -> 251
    rows=[(f"2026-09-{1+i:02d}",25,100) for i in range(4)]
    make_data(tmp_path, rows)
    assert forecast("a","2026-10-19",attendance=1002,ratio=1,data_dir=str(tmp_path))["predicted"]==251

def test_fallbacks_and_no_history(tmp_path):
    # There is no Monday history, so the three non-Monday rows are the fallback.
    rows=[(d,40,100) for d in ["2026-10-06","2026-10-07","2026-10-08"]]
    make_data(tmp_path,rows)
    r=forecast("a","2026-10-19",attendance=100,ratio=1,data_dir=str(tmp_path))
    assert r["predicted"]==40 and r["sigma"]==4.0
    assert "rough, little history" in explain("a","2026-10-19",ratio=1,data_dir=str(tmp_path))
    make_data(tmp_path,[("2026-10-05",40,100)])
    assert forecast("a","2026-10-19",attendance=100,ratio=1,data_dir=str(tmp_path))["predicted"]==40
    make_data(tmp_path,[])
    with pytest.raises(ValueError): forecast("a","2026-10-19",data_dir=str(tmp_path))

def test_limiting_ratio_and_guardrails(tmp_path):
    make_data(tmp_path,monday_rows(9,50,100),floor=60)
    base=forecast("a","2026-10-19",attendance=100,ratio=1,data_dir=str(tmp_path))
    assert base["service_level"]==0.5 and base["buffer"]==0 and base["prep"]==60
    assert forecast("a","2026-10-19",attendance=100,ratio=3,data_dir=str(tmp_path))["sigma"] == 0
    assert forecast("a","2026-10-19",attendance=100,ratio=3,data_dir=str(tmp_path))["buffer"] == 0
    vals=[forecast("a","2026-10-19",attendance=100,ratio=x,data_dir=str(tmp_path))["buffer"] for x in [0.5,1,2,3,5,10]]
    assert vals==sorted(vals)
    make_data(tmp_path,monday_rows(5,50,100),floor=60)
    low=forecast("a","2026-10-19",attendance=100,ratio=.5,data_dir=str(tmp_path)); assert low["buffer"] < 0 and low["prep"]>=60 and low["prep"]>=0
    for bad in [0,-1,float("nan"),float("inf"),True]:
        with pytest.raises(ValueError): forecast("a","2026-10-19",ratio=bad,data_dir=str(tmp_path))


def test_input_validation_is_consistent_across_public_calls(tmp_path):
    make_data(tmp_path, monday_rows(5,50,100), menu_dates=["2026-10-19"])
    for bad in [0,-1,float("nan"),float("inf"),True]:
        for call in (
            lambda: explain("a", "2026-10-19", ratio=bad, data_dir=str(tmp_path)),
            lambda: prep_list("2026-10-19", ratio=bad, data_dir=str(tmp_path)),
            lambda: backtest(ratio=bad, data_dir=str(tmp_path)),
            lambda: simulate("2026-10-19", ratio=bad, data_dir=str(tmp_path)),
        ):
            with pytest.raises(ValueError):
                call()
    for bad in [0, -1, True]:
        with pytest.raises(ValueError):
            forecast("a", "2026-10-19", attendance=bad, data_dir=str(tmp_path))
    accepted = forecast("a", "2026-10-19", attendance=100.0, data_dir=str(tmp_path))
    assert accepted["attendance"] == 100

def test_attendance_scaling_and_explain_format(tmp_path):
    make_data(tmp_path,monday_rows(9,50,100))
    a=forecast("a","2026-10-19",attendance=100,ratio=1,data_dir=str(tmp_path)); b=forecast("a","2026-10-19",attendance=200,ratio=1,data_dir=str(tmp_path))
    assert a["predicted"]==50 and a["sigma"]==0 and a["buffer"]==0
    assert b["predicted"]==2*a["predicted"] and b["sigma"]==2*a["sigma"]
    text=explain("a","2026-10-19",ratio=1,data_dir=str(tmp_path))
    assert "attendance is normal" in text.lower() and "buffer +0" in text and "\n" not in text and text[0].isupper()
    assert text.split(", ")[-1].startswith("buffer +0")
    assert "Mondays run" not in text

def test_prep_list_keys_allergens_shared_attendance_and_unknown_date(tmp_path):
    make_data(tmp_path,monday_rows(5,50,100),menu_dates=["2026-10-19"],floor=80,allergens="milk;soybeans",menu_items=("a", "b"))
    out=prep_list("2026-10-19",data_dir=str(tmp_path))
    assert out["attendance"]==100 and out["simulated"] is True
    assert set(out)=={"date","attendance","ratio","simulated","items","meal_check"}
    item=out["items"][0]; assert item["allergens"]==["milk","soybeans"]
    assert set(item)=={"item_id","name","component","predicted","buffer","prep","floor","reason","allergens"}
    assert all(entry["prep"] >= entry["floor"] for entry in out["items"])
    assert item["reason"]==explain("a","2026-10-19",data_dir=str(tmp_path))
    no_history=out["items"][1]
    assert no_history["item_id"]=="b" and "rough guess" in no_history["reason"].lower() and "no history" in no_history["reason"].lower()
    with pytest.raises(UnknownDateError): prep_list("2026-10-18",data_dir=str(tmp_path))
    with pytest.raises(ValueError): prep_list("bad-date",data_dir=str(tmp_path))
    with pytest.raises(UnknownItemError): forecast("missing","2026-10-19",data_dir=str(tmp_path))


def test_prep_list_no_history_uses_component_rate_and_ratio_buffer(tmp_path):
    make_data(tmp_path, monday_rows(5, 50, 100), menu_dates=["2026-10-19"], menu_items=("b",))
    with open(tmp_path / "meals.csv", "a", newline="") as handle:
        handle.write("2026-10-07,c,fruit,100,100,60,1.00,,,0,\n")
        handle.write("2026-10-08,c,fruit,100,100,80,1.00,,,0,\n")
    result = prep_list("2026-10-19", attendance=100, data_dir=str(tmp_path))
    item = result["items"][0]
    # The same-component rates are .60 and .80, so predicted is 70.
    # At ratio 3, z is about .6745, so the fallback buffer is ceil(.6745 x 7) = 5.
    assert item["predicted"] == 70
    assert item["buffer"] == 5
    assert item["prep"] == 75
    ratio_two = prep_list("2026-10-19", attendance=100, ratio=2, data_dir=str(tmp_path))["items"][0]
    assert ratio_two["buffer"] == 4 and ratio_two["prep"] == 74
    assert "rough guess" in item["reason"].lower()
    assert "no history" in item["reason"].lower()


def test_no_history_component_fallback_ignores_rows_on_cutoff(tmp_path):
    make_data(tmp_path, monday_rows(5, 50, 100), menu_dates=["2026-10-19"], menu_items=("b",))
    with open(tmp_path / "meals.csv", "a", newline="") as handle:
        handle.write("2026-10-07,c,fruit,100,100,60,1.00,,,0,\n")
        handle.write("2026-10-08,c,fruit,100,100,80,1.00,,,0,\n")
        handle.write("2026-10-19,c,fruit,100,100,100,1.00,,,0,\n")
    result = prep_list("2026-10-19", attendance=100, data_dir=str(tmp_path))
    assert result["items"][0]["predicted"] == 70

def test_meal_check_order_floors_unknown_and_no_mutation(tmp_path):
    make_data(tmp_path, floor=80)
    menu=["a","b"]; prep={"a":10,"b":20}; before=prep.copy()
    got=meal_check(menu,prep,data_dir=str(tmp_path))
    assert got["missing_components"]==["meat_alternate","vegetable","milk"]
    assert got["below_floor"]==[{"item_id":"a","prep":10,"floor":80}]
    assert prep==before and menu==["a","b"]
    assert meal_check(["a","b","c","d","e"],{"a":80,"b":1,"c":1,"d":1,"e":1},data_dir=str(tmp_path))["ok"] is True
    with pytest.raises(UnknownItemError): meal_check(["z"],{},data_dir=str(tmp_path))
    with pytest.raises(UnknownItemError): meal_check(["a"],{"z":1},data_dir=str(tmp_path))


@pytest.mark.parametrize("menu, prep", [(None, None), (["a"], {"cheese_pizza": "abc"}), (["a"], [])])
def test_meal_check_rejects_invalid_types_with_value_error(tmp_path, menu, prep):
    make_data(tmp_path)
    with pytest.raises(ValueError):
        meal_check(menu, prep, data_dir=str(tmp_path))

def test_no_future_leakage_and_env_call_time(tmp_path,monkeypatch):
    rows=monday_rows(5,50,100); make_data(tmp_path,rows,menu_dates=["2026-10-19"])
    monkeypatch.setenv("LUNCHLOOP_DATA_DIR",str(tmp_path)); monkeypatch.setenv("LUNCHLOOP_TODAY","2026-10-19")
    before=forecast("a","2026-10-19")
    before_explain=explain("a","2026-10-19")
    with open(tmp_path/"meals.csv","a") as f: f.write("2026-10-20,a,grain,100,200,200,1.25,milk;soybeans,,0,\n")
    assert forecast("a","2026-10-19")==before
    assert explain("a","2026-10-19")==before_explain

    # The row on the cutoff date is same-day data and must be excluded too.
    with open(tmp_path/"meals.csv", "a") as f:
        f.write("2026-10-19,a,grain,100,200,200,1.25,milk;soybeans,,0,\n")
    same_day_before = forecast("a", "2026-10-19")
    same_day_explain = explain("a", "2026-10-19")
    with open(tmp_path/"meals.csv", "a") as f:
        f.write("2026-10-19,a,grain,100,999,999,1.25,milk;soybeans,,0,\n")
    assert forecast("a", "2026-10-19") == same_day_before
    assert explain("a", "2026-10-19") == same_day_explain
    # A future file is irrelevant and must not be opened.
    (tmp_path/"future_meals.csv").write_text("garbage")
    assert forecast("a","2026-10-19")==before
    assert explain("a","2026-10-19")==before_explain


def _append_meal_rows(path, rows):
    with open(path / "meals.csv", "a") as handle:
        for d, item_id, attendance, taken in rows:
            component = "fruit" if item_id == "b" else "grain"
            handle.write(f"{d},{item_id},{component},{attendance},{max(taken, 200)},{taken},1.25,,,0,\n")


def test_cutoff_excludes_same_day_and_later_rows_for_forecast_and_explain(tmp_path):
    rows = monday_rows(5, 50, 100)
    make_data(tmp_path, rows)
    _append_meal_rows(tmp_path, [(f"2026-10-{day:02d}", "a", 100, 50) for day in range(12, 19)])

    for target, as_of in [("2026-10-19", "2026-10-12"), ("2026-10-12", "2026-10-19")]:
        before = forecast("a", target, as_of=as_of, data_dir=str(tmp_path))
        before_explain = explain("a", target, as_of=as_of, data_dir=str(tmp_path))
        _append_meal_rows(tmp_path, [(f"2026-10-{day:02d}", "a", 100, 900 + day) for day in range(12, 19)])
        assert forecast("a", target, as_of=as_of, data_dir=str(tmp_path)) == before
        assert explain("a", target, as_of=as_of, data_dir=str(tmp_path)) == before_explain


def test_cutoff_attendance_estimate_ignores_other_items_on_or_after_cutoff(tmp_path):
    # The first row seen for a date sets its attendance, so the cutoff-day rows
    # must not exist before the snapshot or a <= cutoff bug would go unnoticed.
    make_data(tmp_path, monday_rows(5, 50, 100))
    before = forecast("a", "2026-10-19", data_dir=str(tmp_path))
    _append_meal_rows(tmp_path, [("2026-10-19", "b", 999, 50), ("2026-10-20", "b", 999, 50)])
    assert forecast("a", "2026-10-19", data_dir=str(tmp_path)) == before

def test_default_as_of_is_demo_today(tmp_path, monkeypatch):
    # With today = Mon 10-12, a forecast for 10-19 may only use rows before 10-12.
    monkeypatch.setenv("LUNCHLOOP_TODAY", "2026-10-12")
    make_data(tmp_path, monday_rows(5, 50, 100), menu_dates=["2026-10-19"])
    d = str(tmp_path)
    calls = [
        lambda: forecast("a", "2026-10-19", data_dir=d),
        lambda: explain("a", "2026-10-19", data_dir=d),
        lambda: prep_list("2026-10-19", data_dir=d),
        lambda: simulate("2026-10-19", data_dir=d),
    ]
    before = [call() for call in calls]
    _append_meal_rows(tmp_path, [(f"2026-10-{day:02d}", "a", 300, 250) for day in range(12, 17)])
    assert [call() for call in calls] == before


def test_backtest_ignores_demo_today(tmp_path, monkeypatch):
    make_data(tmp_path, monday_rows(9, 50, 100))
    monkeypatch.setenv("LUNCHLOOP_TODAY", "2026-10-19")
    first = backtest(weeks=2, data_dir=str(tmp_path))
    monkeypatch.setenv("LUNCHLOOP_TODAY", "2026-09-01")
    assert backtest(weeks=2, data_dir=str(tmp_path)) == first


def test_empty_allergens_and_weekend_allowed(tmp_path):
    make_data(tmp_path,monday_rows(5,50,100),allergens="")
    assert forecast("a","2026-10-24",attendance=100,data_dir=str(tmp_path))["date"]=="2026-10-24"
    out=prep_list("2026-10-19",data_dir=str(tmp_path)); assert out["items"][0]["allergens"]==[]


def test_engine_never_opens_future_meals(tmp_path, monkeypatch):
    import builtins, io
    # The guard applies to every public engine function, including the
    # held-out and simulator paths.  Use the real sample data for those calls.
    sample = Path(__file__).resolve().parents[2] / "data" / "sample"
    real_open, real_io_open = builtins.open, io.open
    def guarded_open(file, *args, **kwargs):
        if "future_meals" in str(file): raise AssertionError("future_meals must not be opened")
        return real_open(file, *args, **kwargs)
    def guarded_io_open(file, *args, **kwargs):
        if "future_meals" in str(file): raise AssertionError("future_meals must not be opened")
        return real_io_open(file, *args, **kwargs)
    monkeypatch.setattr(builtins, "open", guarded_open)
    monkeypatch.setattr(io, "open", guarded_io_open)
    assert forecast("chicken_tacos", "2026-10-19", data_dir=str(sample))["item_id"] == "chicken_tacos"
    assert explain("chicken_tacos", "2026-10-19", data_dir=str(sample))
    assert prep_list("2026-10-19", data_dir=str(sample))["simulated"] is True
    assert meal_check(["chicken_tacos"], {"chicken_tacos": 50}, data_dir=str(sample))["ok"] is False
    assert backtest(data_dir=str(sample))["simulated"] is True
    assert simulate("2026-10-19", data_dir=str(sample))["simulated"] is True
    assert meter("2026-10-16", data_dir=str(sample))["simulated"] is True


def test_explain_weekday_boost_clause(tmp_path):
    rows = [("2026-08-17",90,100),("2026-08-18",30,100),("2026-08-24",90,100),
            ("2026-08-25",30,100),("2026-08-31",90,100),("2026-09-01",30,100),
            ("2026-09-07",90,100),("2026-09-08",30,100)]
    make_data(tmp_path, rows)
    text = explain("a", "2026-10-19", ratio=1, data_dir=str(tmp_path))
    # Monday rate is 0.9 and the all-day rate is 0.6, so (0.9 / 0.6 - 1) * 100 = 50%.
    assert "Mondays run 50% higher" in text


def test_explain_floor_and_attendance_clauses(tmp_path):
    make_data(tmp_path, monday_rows(5, 50, 100), floor=100)
    assert "kept at the 100-serving minimum" in explain("a", "2026-10-19", data_dir=str(tmp_path))

    def attendance_rows(value):
        rows = []
        start = __import__("datetime").date(2026, 9, 21)
        for index in range(20):
            day = start + __import__("datetime").timedelta(days=index)
            if day.weekday() < 5:
                rows.append((day.isoformat(), 50, value if day.weekday() == 0 else 100))
        return rows

    make_data(tmp_path, attendance_rows(120))
    assert "attendance is 15% above usual" in explain("a", "2026-10-19", data_dir=str(tmp_path))
    make_data(tmp_path, attendance_rows(80))
    assert "attendance is 17% below usual" in explain("a", "2026-10-19", data_dir=str(tmp_path))


def test_data_directory_cache_isolated_and_file_edits_are_picked_up(tmp_path):
    first = tmp_path / "one"
    second = tmp_path / "two"
    first.mkdir(); second.mkdir()
    make_data(first, monday_rows(5, 40, 100))
    make_data(second, monday_rows(5, 80, 100))
    assert forecast("a", "2026-10-19", attendance=100, data_dir=str(first))["predicted"] == 40
    assert forecast("a", "2026-10-19", attendance=100, data_dir=str(second))["predicted"] == 80
    make_data(first, monday_rows(5, 60, 100))
    assert forecast("a", "2026-10-19", attendance=100, data_dir=str(first))["predicted"] == 60


def test_sample_prep_smoke_has_six_contract_items():
    sample = Path(__file__).resolve().parents[2] / "data" / "sample"
    result = prep_list("2026-10-19", data_dir=str(sample))
    assert len(result["items"]) == 6
    assert set(result["items"][0]) == {
        "item_id", "name", "component", "predicted", "buffer", "prep",
        "floor", "reason", "allergens",
    }
