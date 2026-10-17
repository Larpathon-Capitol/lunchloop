"""Black-box tests for menu variety, dietary info, demo controls and the split event feed.

Expected values come from the written backend spec (diet tags, more entrees with
a vegetarian choice every day, scope on /api/events, GET /api/demo/calendar and
POST /api/demo/crowd) and from the repo CSVs, worked out by hand. Nothing here
imports the API code. These tests run against the full data folder (data/), not
data/sample, because the spec changes the full menu and vote options.
"""

import csv
import hashlib
from datetime import date as Date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

DATA = Path(__file__).resolve().parents[2] / "data"
SECRET = "unit-test-secret"
TODAY = "2026-10-19"
RANGE_START, RANGE_END = "2026-10-19", "2026-12-18"
PAGES_ORIGIN = "https://larpathon-capitol.github.io"
LIVE_PASSWORD = "live-stage-pw"

ALLOWED_DIET = {"vegetarian", "vegan", "contains_pork", "contains_beef", "spicy"}
DIET_ORDER = ["vegetarian", "vegan", "contains_pork", "contains_beef", "spicy"]
ORIGINAL_ENTREES = {
    "cheese_pizza", "beef_nachos", "chicken_nuggets",
    "cheeseburger", "popcorn_chicken", "spicy_chicken_sandwich",
}
ORIGINAL_ITEMS = ORIGINAL_ENTREES | {
    "dinner_roll", "brown_rice", "steamed_carrots", "broccoli",
    "fruit_cup", "mandarin_oranges", "chocolate_milk", "milk_1pct",
}
ITEM_FLAG_KEYS = {"diet", "gluten_free", "dairy_free"}
POOL_KEYS = {"item_id", "name", "diet", "gluten_free", "dairy_free"}
E_COUNT = {"error": "count must be 1 to 40"}
E_LIVE = {"error": "demo controls are for simulated schools"}

_device_counter = iter(range(1, 10_000))


def new_device(prefix="dev"):
    return f"{prefix}-spec-{next(_device_counter):05d}"


def pbkdf2_hash(password, iterations=200_000, salt=bytes(range(32, 48))):
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}"


def day(date):
    return {"X-Demo-Date": date}


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def rows(name):
    with (DATA / name).open(newline="") as f:
        return list(csv.DictReader(f))


def item_rows():
    return rows("items.csv")


def entrees():
    return [r for r in item_rows() if r["component"] == "meat_alternate"]


def tags(row):
    return [t for t in (row.get("diet") or "").split(";") if t]


# ---------------------------------------------------------------- fixtures


@pytest.fixture(autouse=True)
def fixed_env(monkeypatch):
    import api.auth

    monkeypatch.setenv("LUNCHLOOP_SECRET", SECRET)
    monkeypatch.delenv("LUNCHLOOP_SCHOOL_PASSWORDS", raising=False)
    monkeypatch.setattr(api.auth, "_SECRET", None)


def make_client(monkeypatch, tmp_path):
    monkeypatch.setenv("LUNCHLOOP_DATA_DIR", str(DATA))
    monkeypatch.setenv("LUNCHLOOP_DB", str(tmp_path / "t.db"))
    monkeypatch.setenv("LUNCHLOOP_TODAY", TODAY)
    from api.main import create_app

    return TestClient(create_app())


@pytest.fixture
def client(monkeypatch, tmp_path):
    with make_client(monkeypatch, tmp_path) as c:
        yield c


@pytest.fixture
def live_hashed(monkeypatch, tmp_path):
    monkeypatch.setenv("LUNCHLOOP_SCHOOL_PASSWORDS", f"live={pbkdf2_hash(LIVE_PASSWORD)}")
    with make_client(monkeypatch, tmp_path) as c:
        yield c


# ----------------------------------------------------------------- helpers


def spin(client, device=None, school=None, date=None):
    params = {"device": device or new_device()}
    if school is not None:
        params["school"] = school
    return client.get("/api/spin", params=params, headers=day(date) if date else {})


def spin_ok(client, **kwargs):
    response = spin(client, **kwargs)
    assert response.status_code == 200, response.text
    return response.json()


def vote(client, device, item, school=None, date=None):
    body = {"device": device, "item_id": item}
    if school is not None:
        body["school"] = school
    return client.post("/api/vote", json=body, headers=day(date) if date else {})


def get_tray(client, school=None, date=None):
    params = {"device": new_device()}
    if school is not None:
        params["school"] = school
    return client.get("/api/tray", params=params, headers=day(date) if date else {})


def calendar(client, school="demo", date=None):
    return client.get("/api/demo/calendar", params={"school": school}, headers=day(date) if date else {})


def school_days(client):
    response = calendar(client)
    assert response.status_code == 200, response.text
    return response.json()["school_days"]


def days_in_range(client):
    return [d for d in school_days(client) if RANGE_START <= d <= RANGE_END]


def crowd(client, count="__missing__", school="demo", date=None, raw_body=None):
    if raw_body is not None:
        body = raw_body
    else:
        body = {"school": school}
        if count != "__missing__":
            body["count"] = count
    return client.post("/api/demo/crowd", json=body, headers=day(date) if date else {})


def crowd_ok(client, count, **kwargs):
    response = crowd(client, count, **kwargs)
    assert response.status_code == 200, response.text
    return response.json()


def admin_token(client, school_id="demo", password="lunchloop"):
    response = client.post("/api/admin/login", json={"school_id": school_id, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["token"]


def summary(client, token, date=None):
    headers = bearer(token)
    if date:
        headers |= day(date)
    response = client.get("/api/admin/summary", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def feed(client, **params):
    params.setdefault("limit", 100)
    response = client.get("/api/events", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def latest(client):
    return feed(client, limit=1)["latest_id"]


def assert_item_flags(item):
    """An item object that carries allergens must carry diet, gluten_free and dairy_free."""
    assert ITEM_FLAG_KEYS <= set(item), item
    diet = item["diet"]
    assert isinstance(diet, list)
    assert set(diet) <= ALLOWED_DIET, item
    assert diet == [t for t in DIET_ORDER if t in diet], f"diet not in stable order: {item}"
    if "vegan" in diet:
        assert "vegetarian" in diet, item
    assert isinstance(item["gluten_free"], bool)
    assert isinstance(item["dairy_free"], bool)
    assert item["gluten_free"] == ("wheat" not in item["allergens"]), item
    assert item["dairy_free"] == ("milk" not in item["allergens"]), item


def is_vegetarian(item):
    return "vegetarian" in item["diet"]


# ------------------------------------------------------------ items.csv


def test_items_csv_has_a_diet_column():
    assert "diet" in item_rows()[0], "data/items.csv needs a diet column"


def test_every_diet_tag_is_in_the_allowed_set_and_vegan_implies_vegetarian():
    for row in item_rows():
        assert "diet" in row
        found = tags(row)
        assert set(found) <= ALLOWED_DIET, (row["item_id"], found)
        assert len(found) == len(set(found)), (row["item_id"], found)
        if "vegan" in found:
            assert "vegetarian" in found, row["item_id"]


def test_vegan_items_have_no_milk_allergen_and_meat_items_are_not_vegetarian():
    for row in item_rows():
        found = tags(row)
        allergens = [a for a in (row["allergens"] or "").split(";") if a]
        if "vegan" in found:
            assert "milk" not in allergens, row["item_id"]
        if "contains_pork" in found or "contains_beef" in found:
            assert "vegetarian" not in found, row["item_id"]


@pytest.mark.parametrize(
    "item_id, expected",
    [
        ("fruit_cup", {"vegetarian", "vegan"}),
        ("mandarin_oranges", {"vegetarian", "vegan"}),
        ("steamed_carrots", {"vegetarian", "vegan"}),
        ("broccoli", {"vegetarian", "vegan"}),
        ("brown_rice", {"vegetarian", "vegan"}),
        ("milk_1pct", {"vegetarian"}),
        ("chocolate_milk", {"vegetarian"}),
        ("cheese_pizza", {"vegetarian"}),
    ],
)
def test_known_items_are_tagged_by_what_they_are(item_id, expected):
    row = next(r for r in item_rows() if r["item_id"] == item_id)
    found = set(tags(row))
    assert expected <= found, (item_id, found)
    if item_id in {"milk_1pct", "chocolate_milk", "cheese_pizza"}:
        assert "vegan" not in found, item_id


@pytest.mark.parametrize(
    "item_id, tag",
    [("beef_nachos", "contains_beef"), ("cheeseburger", "contains_beef")],
)
def test_beef_entrees_are_tagged_contains_beef(item_id, tag):
    row = next(r for r in item_rows() if r["item_id"] == item_id)
    assert tag in tags(row)
    assert "vegetarian" not in tags(row)


@pytest.mark.parametrize("item_id", ["chicken_nuggets", "popcorn_chicken", "spicy_chicken_sandwich"])
def test_chicken_entrees_are_not_vegetarian(item_id):
    row = next(r for r in item_rows() if r["item_id"] == item_id)
    assert "vegetarian" not in tags(row)


def test_spicy_chicken_sandwich_is_tagged_spicy():
    row = next(r for r in item_rows() if r["item_id"] == "spicy_chicken_sandwich")
    assert "spicy" in tags(row)


def test_original_items_and_ids_are_kept():
    ids = {r["item_id"] for r in item_rows()}
    assert ORIGINAL_ITEMS <= ids


def test_at_least_twelve_entrees_and_four_new_vegetarian_ones():
    meat_alt = entrees()
    assert len(meat_alt) >= 12, [r["item_id"] for r in meat_alt]
    new = [r for r in meat_alt if r["item_id"] not in ORIGINAL_ENTREES]
    assert len(new) >= 6
    vegetarian_new = [r for r in new if "vegetarian" in tags(r)]
    assert len(vegetarian_new) >= 4, [r["item_id"] for r in vegetarian_new]


def test_new_entrees_have_plausible_cost_allergens_and_floor():
    for row in entrees():
        assert 0.3 <= float(row["cost_per_serving"]) <= 3.0, row["item_id"]
        assert int(row["prep_floor"]) >= 0, row["item_id"]
        assert row["name"].strip(), row["item_id"]


def test_every_entree_has_history_and_menu_rows():
    meals = {r["item_id"] for r in rows("meals.csv")}
    menu = {r["item_id"] for r in rows("menu.csv")}
    for row in entrees():
        assert row["item_id"] in meals, f"{row['item_id']} has no history in meals.csv"
        assert row["item_id"] in menu, f"{row['item_id']} never appears on a menu"


# ------------------------------------------------- API item objects (diet)


def test_spin_options_carry_diet_and_derived_flags(client):
    body = spin_ok(client)
    assert body["options"]
    for option in body["options"]:
        assert set(option) >= {"item_id", "name", "allergens"} | ITEM_FLAG_KEYS
        assert_item_flags(option)


def test_spin_option_diet_equals_items_csv_tags(client):
    by_id = {r["item_id"]: r for r in item_rows()}
    for date in days_in_range(client)[:10]:
        for option in spin_ok(client, date=date)["options"]:
            assert option["diet"] == [t for t in DIET_ORDER if t in tags(by_id[option["item_id"]])], option


def test_tray_items_carry_diet_and_derived_flags(client):
    checked = 0
    for date in days_in_range(client)[:12]:
        response = get_tray(client, date=date)
        if response.status_code != 200:
            continue
        for group in response.json()["groups"]:
            for item in group["items"]:
                assert {"item_id", "name", "allergens"} <= set(item)
                assert_item_flags(item)
                checked += 1
    assert checked > 20


def test_tray_item_diet_equals_items_csv_tags(client):
    by_id = {r["item_id"]: r for r in item_rows()}
    body = get_tray(client).json()
    for group in body["groups"]:
        for item in group["items"]:
            assert item["diet"] == [t for t in DIET_ORDER if t in tags(by_id[item["item_id"]])], item


def test_prep_items_with_allergens_also_carry_diet(client):
    response = client.get("/api/prep")
    assert response.status_code == 200, response.text
    for item in response.json().get("items", []):
        if "allergens" in item:
            assert_item_flags(item)


# ---------------------------------------------------------- spin and pool


def test_spin_pool_lists_every_entree(client):
    body = spin_ok(client)
    pool = body["pool"]
    assert {p["item_id"] for p in pool} == {r["item_id"] for r in entrees()}
    assert len(pool) == len({p["item_id"] for p in pool})
    by_id = {r["item_id"]: r for r in entrees()}
    for entry in pool:
        assert set(entry) == POOL_KEYS, entry
        assert entry["name"] == by_id[entry["item_id"]]["name"]
        assert entry["diet"] == [t for t in DIET_ORDER if t in tags(by_id[entry["item_id"]])]
        allergens = [a for a in by_id[entry["item_id"]]["allergens"].split(";") if a]
        assert entry["gluten_free"] == ("wheat" not in allergens)
        assert entry["dairy_free"] == ("milk" not in allergens)


def test_spin_options_are_a_subset_of_the_pool(client):
    body = spin_ok(client)
    pool_ids = {p["item_id"] for p in body["pool"]}
    assert {o["item_id"] for o in body["options"]} <= pool_ids


def test_spin_keeps_its_existing_keys(client):
    body = spin_ok(client)
    assert {"date", "target_date", "target_slot", "options", "already_voted", "simulated", "pool"} <= set(body)
    assert body["date"] == TODAY


def test_spin_pool_is_the_same_on_every_day(client):
    days = days_in_range(client)
    pools = {frozenset(p["item_id"] for p in spin_ok(client, date=d)["pool"]) for d in days[::7]}
    assert len(pools) == 1


# ---------------------------------------------- four options every day


def test_every_school_day_in_range_has_four_options_with_a_vegetarian(client):
    days = days_in_range(client)
    assert len(days) >= 30, days
    assert days[0] == RANGE_START
    entree_ids = {r["item_id"] for r in entrees()}
    for date in days:
        response = spin(client, date=date)
        assert response.status_code == 200, (date, response.text)
        body = response.json()
        assert body["date"] == date
        options = body["options"]
        assert len(options) == 4, (date, options)
        ids = [o["item_id"] for o in options]
        assert len(set(ids)) == 4, (date, ids)
        assert set(ids) <= entree_ids, (date, ids)
        assert any(is_vegetarian(o) for o in options), (date, ids)


def test_range_covers_the_end_of_the_term(client):
    assert max(days_in_range(client)) >= "2026-12-14"


def test_option_sets_are_not_all_identical_across_dates(client):
    sets = {frozenset(o["item_id"] for o in spin_ok(client, date=d)["options"]) for d in days_in_range(client)}
    assert len(sets) > 1


def test_target_date_is_after_the_open_date_on_every_day(client):
    for date in days_in_range(client):
        body = spin_ok(client, date=date)
        assert body["target_date"] > body["date"], date
        assert body["target_slot"] == "entree"


@pytest.mark.parametrize("index", [0, 1, 2, 3])
def test_vote_accepts_each_of_the_four_options(client, index):
    options = spin_ok(client)["options"]
    assert len(options) == 4
    chosen = options[index]["item_id"]
    device = new_device()
    response = vote(client, device, chosen)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["ok"] is True
    assert body["tally"][chosen] == 1


def test_vote_rejects_an_entree_that_is_not_one_of_the_four(client):
    body = spin_ok(client)
    option_ids = {o["item_id"] for o in body["options"]}
    outsider = next(p["item_id"] for p in body["pool"] if p["item_id"] not in option_ids)
    response = vote(client, new_device(), outsider)
    assert response.status_code == 400, response.text
    assert "error" in response.json()


def test_vote_works_on_a_late_date_with_four_options(client):
    date = max(days_in_range(client))
    options = spin_ok(client, date=date)["options"]
    assert len(options) == 4
    response = vote(client, new_device(), options[3]["item_id"], date=date)
    assert response.status_code == 200, response.text


# ----------------------------------------------------------- event scope


def test_scope_live_returns_only_live_events(client):
    vote(client, new_device(), spin_ok(client, school="live")["options"][0]["item_id"], school="live")
    vote(client, new_device(), spin_ok(client)["options"][0]["item_id"])
    client.get("/api/meter")
    body = feed(client, scope="live")
    assert body["events"], "live vote and spin should be in the live feed"
    assert all(e["school_id"] == "live" for e in body["events"]), body["events"]
    assert "vote" in {e["kind"] for e in body["events"]}


def test_scope_simulated_returns_no_live_events(client):
    vote(client, new_device(), spin_ok(client, school="live")["options"][0]["item_id"], school="live")
    vote(client, new_device(), spin_ok(client)["options"][0]["item_id"])
    client.get("/api/meter")
    body = feed(client, scope="simulated")
    assert body["events"]
    assert all(e["school_id"] != "live" for e in body["events"]), body["events"]
    kinds = {e["kind"] for e in body["events"]}
    assert {"vote", "meter"} <= kinds
    assert any(e["school_id"] is None for e in body["events"]), "engine events belong to simulated"


def test_live_plus_simulated_equals_everything(client):
    vote(client, new_device(), spin_ok(client, school="live")["options"][0]["item_id"], school="live")
    vote(client, new_device(), spin_ok(client)["options"][0]["item_id"])
    client.get("/api/meter")
    everything = {e["id"] for e in feed(client)["events"]}
    live = {e["id"] for e in feed(client, scope="live")["events"]}
    simulated = {e["id"] for e in feed(client, scope="simulated")["events"]}
    assert live and simulated
    assert live.isdisjoint(simulated)
    assert live | simulated == everything


def test_scope_keeps_response_shape_and_global_latest_id(client):
    vote(client, new_device(), spin_ok(client, school="live")["options"][0]["item_id"], school="live")
    vote(client, new_device(), spin_ok(client)["options"][0]["item_id"])
    unscoped = feed(client)
    for scope in ("live", "simulated"):
        scoped = feed(client, scope=scope)
        assert set(scoped) == set(unscoped)
        assert scoped["latest_id"] == unscoped["latest_id"]
        assert scoped["simulated"] is True
        for event in scoped["events"]:
            assert set(event) == {"id", "at", "kind", "school_id", "player", "summary", "detail", "ms"}


def test_scope_live_is_empty_when_nothing_live_happened(client):
    vote(client, new_device(), spin_ok(client)["options"][0]["item_id"])
    assert feed(client, scope="live")["events"] == []
    assert feed(client, scope="simulated")["events"]


def test_no_scope_returns_all_events_unchanged(client):
    vote(client, new_device(), spin_ok(client, school="live")["options"][0]["item_id"], school="live")
    vote(client, new_device(), spin_ok(client)["options"][0]["item_id"])
    schools = {e["school_id"] for e in feed(client)["events"]}
    assert {"live", "demo"} <= schools


# --------------------------------------------------------- demo calendar


def test_calendar_shape_and_default_today(client):
    response = calendar(client)
    assert response.status_code == 200, response.text
    body = response.json()
    assert {"today", "school_days", "default_today"} <= set(body)
    assert body["default_today"] == TODAY
    assert body["today"] == TODAY
    days = body["school_days"]
    assert days == sorted(days)
    assert len(days) == len(set(days))
    assert TODAY in days


def test_calendar_days_are_iso_weekdays(client):
    for text in school_days(client):
        assert len(text) == 10
        assert Date.fromisoformat(text).weekday() < 5, text


def test_calendar_covers_the_whole_menu_data(client):
    menu_days = {r["date"] for r in rows("menu.csv")}
    days = set(school_days(client))
    assert menu_days <= days


def test_calendar_today_follows_x_demo_date_but_default_stays(client):
    target = days_in_range(client)[5]
    body = calendar(client, date=target).json()
    assert body["today"] == target
    assert body["default_today"] == TODAY


def test_calendar_defaults_school_to_demo_when_omitted(client):
    response = client.get("/api/demo/calendar")
    if response.status_code == 200:
        assert response.json()["default_today"] == TODAY


def test_calendar_for_live_school_is_refused(client):
    response = calendar(client, school="live")
    assert response.status_code == 400, response.text
    assert "error" in response.json()


def test_calendar_unknown_school_is_404(client):
    response = calendar(client, school="nowhere")
    assert response.status_code == 404, response.text


# ----------------------------------------------------------- demo crowd


@pytest.mark.parametrize("bad", [0, 41, -1, 100, "3", 2.5, None, [3], {"n": 3}])
def test_crowd_count_must_be_an_int_1_to_40(client, bad):
    response = crowd(client, bad)
    assert response.status_code == 400, (bad, response.text)
    assert response.json() == E_COUNT


def test_crowd_missing_count_is_400(client):
    response = crowd(client)
    assert response.status_code == 400, response.text
    assert response.json() == E_COUNT


def test_crowd_rejected_count_adds_nothing(client):
    token = admin_token(client)
    crowd(client, 0)
    crowd(client, 41)
    body = summary(client, token)
    assert body["vote"]["total"] == 0
    assert body["tray"] is None


def test_crowd_for_the_live_school_is_refused_and_touches_nothing(client):
    since = latest(client)
    response = crowd(client, 5, school="live")
    assert response.status_code == 400, response.text
    assert response.json() == E_LIVE
    assert [e for e in feed(client, after=since)["events"] if e["school_id"] == "live"] == []
    assert feed(client, scope="live")["events"] == []
    assert not any(e["kind"] in {"vote", "tray"} for e in feed(client, after=since)["events"])


def test_crowd_for_the_live_school_is_refused_even_with_a_demo_date(client):
    response = crowd(client, 5, school="live", date="2026-10-21")
    assert response.status_code == 400
    assert response.json() == E_LIVE


def test_crowd_unknown_school_is_404(client):
    response = crowd(client, 5, school="nowhere")
    assert response.status_code == 404, response.text


def test_crowd_success_response_shape(client):
    body = crowd_ok(client, 5)
    assert set(body) >= {"ok", "added", "date", "totals"}
    assert body["ok"] is True
    assert body["added"] == 5
    assert body["date"] == TODAY
    assert set(body["totals"]) >= {"votes", "trays"}
    assert body["totals"]["votes"] == 5
    assert body["totals"]["trays"] == 5


def test_crowd_votes_and_trays_show_in_the_admin_summary(client):
    token = admin_token(client)
    body = crowd_ok(client, 8)
    data = summary(client, token)
    assert data["vote"]["total"] == body["totals"]["votes"] == 8
    assert sum(o["votes"] for o in data["vote"]["options"]) == 8
    assert data["tray"] is not None
    assert data["tray"]["total"] == body["totals"]["trays"] == 8


def test_crowd_spreads_votes_and_gives_vegetarians_a_real_share(client):
    options = {o["item_id"]: o for o in spin_ok(client)["options"]}
    token = admin_token(client)
    crowd_ok(client, 40)
    results = summary(client, token)["vote"]["options"]
    assert sum(o["votes"] for o in results) == 40
    assert sum(1 for o in results if o["votes"] > 0) >= 2
    vegetarian_votes = sum(o["votes"] for o in results if is_vegetarian(options[o["item_id"]]))
    assert vegetarian_votes > 0


def test_crowd_repeat_adds_more_students(client):
    token = admin_token(client)
    first = crowd_ok(client, 5)
    second = crowd_ok(client, 3)
    assert second["added"] == 3
    assert second["totals"]["votes"] == first["totals"]["votes"] + 3 == 8
    assert second["totals"]["trays"] == first["totals"]["trays"] + 3 == 8
    data = summary(client, token)
    assert data["vote"]["total"] == 8
    assert data["tray"]["total"] == 8


def test_crowd_can_add_forty_twice_without_a_per_device_block(client):
    first = crowd_ok(client, 40)
    second = crowd_ok(client, 40)
    assert first["added"] == second["added"] == 40
    assert second["totals"]["votes"] == 80
    assert second["totals"]["trays"] == 80


def test_crowd_counts_on_top_of_real_votes(client):
    token = admin_token(client)
    options = spin_ok(client)["options"]
    assert vote(client, new_device(), options[0]["item_id"]).status_code == 200
    body = crowd_ok(client, 4)
    assert body["totals"]["votes"] == 5
    assert summary(client, token)["vote"]["total"] == 5


def test_crowd_records_spin_vote_and_tray_events_for_the_school(client):
    since = latest(client)
    crowd_ok(client, 5)
    events = feed(client, after=since)["events"]
    mine = [e for e in events if e["school_id"] == "demo"]
    kinds = [e["kind"] for e in mine]
    assert kinds.count("spin") == 5, kinds
    assert kinds.count("vote") == 5, kinds
    assert kinds.count("tray") == 5, kinds
    for event in mine:
        assert event["player"] is None or len(event["player"]) == 6
        assert event["summary"]


def test_crowd_events_are_in_the_simulated_feed_not_the_live_feed(client):
    since = latest(client)
    crowd_ok(client, 3)
    simulated = feed(client, scope="simulated", after=since)["events"]
    assert {"spin", "vote", "tray"} <= {e["kind"] for e in simulated}
    assert feed(client, scope="live", after=since)["events"] == []


def test_crowd_events_hold_no_device_ids(client):
    crowd_ok(client, 3)
    for event in feed(client)["events"]:
        assert "sim-" not in str(event)


def test_crowd_acts_on_the_demo_date(client):
    other = days_in_range(client)[3]
    assert other != TODAY
    token = admin_token(client)
    body = crowd_ok(client, 6, date=other)
    assert body["date"] == other
    assert summary(client, token, date=other)["vote"]["total"] == 6
    assert summary(client, token)["vote"]["total"] == 0


def test_crowd_on_two_days_keeps_each_day_separate(client):
    token = admin_token(client)
    d1, d2 = days_in_range(client)[1:3]
    crowd_ok(client, 4, date=d1)
    second = crowd_ok(client, 7, date=d2)
    assert second["totals"]["votes"] == 7
    assert summary(client, token, date=d1)["vote"]["total"] == 4
    assert summary(client, token, date=d2)["vote"]["total"] == 7


def test_crowd_does_not_change_the_live_school(live_hashed):
    client = live_hashed
    token = admin_token(client, "live", LIVE_PASSWORD)
    crowd_ok(client, 10)
    live = summary(client, token)
    assert live["vote"]["total"] == 0
    assert live["tray"] is None


def test_crowd_does_not_make_real_devices_look_voted(client):
    crowd_ok(client, 10)
    assert spin_ok(client, device=new_device("real"))["already_voted"] is False


# -------------------------------------------------- X-Demo-Date handling


def test_demo_school_honors_x_demo_date_on_spin(client):
    target = days_in_range(client)[4]
    assert spin_ok(client, date=target)["date"] == target


def test_live_school_ignores_x_demo_date_on_spin(client):
    target = days_in_range(client)[4]
    assert target != TODAY
    assert spin_ok(client, school="live", date=target)["date"] == TODAY


def test_live_school_ignores_x_demo_date_on_tray_and_me(client):
    target = days_in_range(client)[4]
    live_default = get_tray(client, school="live").json()
    live_shifted = get_tray(client, school="live", date=target).json()
    assert live_shifted["open_date"] == live_default["open_date"] == TODAY
    assert live_shifted["target_date"] == live_default["target_date"]
    demo_shifted = get_tray(client, school="demo", date=target).json()
    assert demo_shifted["open_date"] == target


def test_live_school_ignores_x_demo_date_on_admin_summary(live_hashed):
    client = live_hashed
    token = admin_token(client, "live", LIVE_PASSWORD)
    assert summary(client, token, date="2026-11-03")["today"] == TODAY


def test_demo_school_honors_x_demo_date_on_admin_summary(client):
    token = admin_token(client)
    assert summary(client, token, date="2026-11-03")["today"] == "2026-11-03"


def test_live_school_cannot_vote_twice_by_changing_the_date(client):
    options = spin_ok(client, school="live")["options"]
    device = new_device()
    assert vote(client, device, options[0]["item_id"], school="live").status_code == 200
    again = vote(client, device, options[0]["item_id"], school="live", date=days_in_range(client)[6])
    assert again.status_code == 409, again.text


def test_demo_school_can_vote_again_on_another_demo_date(client):
    days = days_in_range(client)
    device = new_device()
    first = spin_ok(client, date=days[0])["options"][0]["item_id"]
    second = spin_ok(client, date=days[1])["options"][0]["item_id"]
    assert vote(client, device, first, date=days[0]).status_code == 200
    assert vote(client, device, second, date=days[1]).status_code == 200


# ---------------------------------------------------------------- CORS


def test_cors_preflight_allows_the_x_demo_date_header(monkeypatch, tmp_path):
    monkeypatch.setenv("LUNCHLOOP_CORS_ORIGIN", PAGES_ORIGIN)
    with make_client(monkeypatch, tmp_path) as client:
        response = client.options(
            "/api/spin",
            headers={
                "Origin": PAGES_ORIGIN,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "x-demo-date",
            },
        )
        assert response.status_code == 200, response.text
        assert response.headers.get("access-control-allow-origin") == PAGES_ORIGIN
        allowed = {h.strip().lower() for h in response.headers.get("access-control-allow-headers", "").split(",")}
        assert "x-demo-date" in allowed or "*" in allowed, response.headers


def test_cors_preflight_for_the_crowd_route_allows_x_demo_date_and_content_type(monkeypatch, tmp_path):
    monkeypatch.setenv("LUNCHLOOP_CORS_ORIGIN", PAGES_ORIGIN)
    with make_client(monkeypatch, tmp_path) as client:
        response = client.options(
            "/api/demo/crowd",
            headers={
                "Origin": PAGES_ORIGIN,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type, x-demo-date",
            },
        )
        assert response.status_code == 200, response.text
        allowed = {h.strip().lower() for h in response.headers.get("access-control-allow-headers", "").split(",")}
        assert ("x-demo-date" in allowed and "content-type" in allowed) or "*" in allowed, response.headers


def test_cors_preflight_allows_x_demo_date_with_default_cors(client):
    response = client.options(
        "/api/demo/calendar",
        headers={
            "Origin": PAGES_ORIGIN,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "x-demo-date",
        },
    )
    assert response.status_code == 200, response.text
    allowed = {h.strip().lower() for h in response.headers.get("access-control-allow-headers", "").split(",")}
    assert "x-demo-date" in allowed or "*" in allowed, response.headers


def test_crowd_response_carries_cors_headers(monkeypatch, tmp_path):
    monkeypatch.setenv("LUNCHLOOP_CORS_ORIGIN", PAGES_ORIGIN)
    with make_client(monkeypatch, tmp_path) as client:
        response = client.post(
            "/api/demo/crowd",
            json={"school": "demo", "count": 2},
            headers={"Origin": PAGES_ORIGIN, **day(TODAY)},
        )
        assert response.status_code == 200, response.text
        assert response.headers.get("access-control-allow-origin") == PAGES_ORIGIN
