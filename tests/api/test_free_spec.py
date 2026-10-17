"""Black-box tests for lunch-service check-ins and free leftovers.

Covers POST /api/served, today_lunch and free_today on /api/tray and /api/me,
POST /api/admin/free, GET /api/free, the "service" and "free" parts of
GET /api/admin/summary, the demo crowd check-ins, and the new event kinds.
Expected values come from the written spec and the CSVs, worked out by hand.
Nothing here imports the code under test.

Sample data facts used below (data/sample/menu.csv, clock 2026-10-19):
- A tray packed on Mon 10-19 targets Tue 10-20. A tray packed on 10-20 targets 10-21.
- 10-20 menu rows: chicken_tacos, popcorn_chicken (meat_alternate, in that
  order), wheat_roll, side_salad, apple_slices, milk_1pct.
- 10-21 menu rows: chicken_tacos, cheese_pizza, wheat_roll, side_salad,
  apple_slices, milk_1pct.
- 10-19 menu rows: cheese_pizza, popcorn_chicken, wheat_roll, side_salad,
  apple_slices, milk_1pct.
- Lunch is "served" on the target day, so tests pack on 10-19 (header) and then
  move the demo date to 10-20 to check in.

The crowd tests use the full data folder (data/), like the other crowd tests.
"""

import csv
import hashlib
import re
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
SAMPLE = ROOT / "data" / "sample"
FULL = ROOT / "data"
SECRET = "unit-test-secret"
LIVE_PASSWORD = "live-stage-pw"
TODAY = "2026-10-19"
TARGET = "2026-10-20"
NEXT = "2026-10-21"
TACOS, PIZZA, POPCORN = "chicken_tacos", "cheese_pizza", "popcorn_chicken"
ROLL, SALAD, APPLE, MILK = "wheat_roll", "side_salad", "apple_slices", "milk_1pct"
COMPONENTS = ["meat_alternate", "grain", "vegetable", "fruit", "milk"]
SLOW = {"error": "slow down a little"}
MISSING = object()

E_DEVICE = {"error": "invalid device"}
E_GOT = {"error": "got must be true or false"}
E_NO_TRAY = {"error": "no tray for today"}
E_OFF_MENU = {"error": "that food is not on today's menu"}
E_FREE = {"error": "free must be true or false"}
E_LIVE = {"error": "demo controls are for simulated schools"}

# The 10-20 menu as the service view must list it: tray order, every item.
MENU_1020 = [
    (TACOS, "Chicken tacos", "meat_alternate"),
    (POPCORN, "Popcorn chicken", "meat_alternate"),
    (ROLL, "Whole wheat roll", "grain"),
    (SALAD, "Side salad", "vegetable"),
    (APPLE, "Apple slices", "fruit"),
    (MILK, "1% milk", "milk"),
]
NAMES = {i: n for i, n, _ in MENU_1020} | {PIZZA: "Cheese pizza"}

# Three devices, picks chosen so every service count below can be checked by hand.
#   meat_alternate: D1 tacos, D2 tacos, D3 popcorn
#   grain:          D1 roll,  D2 roll,  D3 skip
#   vegetable:      D1 salad, D2 skip,  D3 skip
#   fruit:          D1 skip,  D2 apple, D3 skip
#   milk:           D1 milk,  D2 skip,  D3 milk
D1 = {"meat_alternate": TACOS, "grain": ROLL, "vegetable": SALAD, "fruit": None, "milk": MILK}
D2 = {"meat_alternate": TACOS, "grain": ROLL, "vegetable": None, "fruit": APPLE, "milk": None}
D3 = {"meat_alternate": POPCORN, "grain": None, "vegetable": None, "fruit": None, "milk": MILK}
ONLY_TACOS = {"meat_alternate": TACOS, "grain": None, "vegetable": None, "fruit": None, "milk": None}
DEV1, DEV2, DEV3 = "device-0001", "device-0002", "device-0003"


def pbkdf2_hash(password, iterations=200_000, salt=bytes(range(32, 48))):
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}"


def day(date):
    return {"X-Demo-Date": date}


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------- fixtures


@pytest.fixture(autouse=True)
def fixed_env(monkeypatch):
    import api.auth

    monkeypatch.setenv("LUNCHLOOP_SECRET", SECRET)
    monkeypatch.delenv("LUNCHLOOP_SCHOOL_PASSWORDS", raising=False)
    monkeypatch.setattr(api.auth, "_SECRET", None)


def make_app(monkeypatch, tmp_path, today=TODAY, data=SAMPLE, db="t.db", **limits):
    monkeypatch.setenv("LUNCHLOOP_DATA_DIR", str(data))
    monkeypatch.setenv("LUNCHLOOP_DB", str(tmp_path / db))
    monkeypatch.setenv("LUNCHLOOP_TODAY", today)
    from api.main import create_app

    return create_app(**limits)


@pytest.fixture
def client(monkeypatch, tmp_path):
    with TestClient(make_app(monkeypatch, tmp_path)) as c:
        yield c


@pytest.fixture
def full_client(monkeypatch, tmp_path):
    with TestClient(make_app(monkeypatch, tmp_path, data=FULL)) as c:
        yield c


@pytest.fixture
def live_hashed(monkeypatch, tmp_path):
    monkeypatch.setenv("LUNCHLOOP_SCHOOL_PASSWORDS", f"live={pbkdf2_hash(LIVE_PASSWORD)}")
    with TestClient(make_app(monkeypatch, tmp_path)) as c:
        yield c


# ----------------------------------------------------------------- helpers


def tray(client, device, picks, school=None, date=TODAY):
    body = {"device": device, "picks": picks}
    if school is not None:
        body["school"] = school
    return client.post("/api/tray", json=body, headers=day(date) if date else {})


def pack(client, device, picks, school=None, date=TODAY):
    response = tray(client, device, picks, school=school, date=date)
    assert response.status_code == 200, response.text


def served(client, device=DEV1, got=True, school=None, date=TARGET, **extra):
    body = {"device": device}
    if got is not MISSING:
        body["got"] = got
    if school is not None:
        body["school"] = school
    body |= extra
    return client.post("/api/served", json=body, headers=day(date) if date else {})


def served_ok(client, device=DEV1, got=True, **kwargs):
    response = served(client, device, got, **kwargs)
    assert response.status_code == 200, response.text
    return response.json()


def get_tray(client, device=None, school=None, date=TARGET):
    params = {}
    if device is not None:
        params["device"] = device
    if school is not None:
        params["school"] = school
    return client.get("/api/tray", params=params, headers=day(date) if date else {})


def me(client, device, school=None, date=TARGET):
    params = {"device": device}
    if school is not None:
        params["school"] = school
    return client.get("/api/me", params=params, headers=day(date) if date else {})


def admin_token(client, school_id="demo", password="lunchloop"):
    response = client.post("/api/admin/login", json={"school_id": school_id, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["token"]


def live_token(client):
    return admin_token(client, "live", LIVE_PASSWORD)


def summary(client, token, date=TARGET):
    headers = bearer(token)
    if date:
        headers |= day(date)
    response = client.get("/api/admin/summary", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def free(client, token, item_id, on=True, date=TARGET, query="", **extra):
    body = {"item_id": item_id, "free": on} | extra
    headers = bearer(token) if token else {}
    if date:
        headers |= day(date)
    return client.post(f"/api/admin/free{query}", json=body, headers=headers)


def free_ok(client, token, item_id, on=True, **kwargs):
    response = free(client, token, item_id, on, **kwargs)
    assert response.status_code == 200, response.text
    return response.json()


def public_free(client, school=None, date=TARGET):
    params = {} if school is None else {"school": school}
    return client.get("/api/free", params=params, headers=day(date) if date else {})


def feed(client, **params):
    params.setdefault("limit", 100)
    response = client.get("/api/events", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def latest(client):
    return feed(client, limit=1)["latest_id"]


def kind_events(client, kind, since=0, **params):
    return [e for e in feed(client, after=since, **params)["events"] if e["kind"] == kind]


def svc_item(item_id, wanted=0, got=0, missed=0, waiting=0, is_free=False):
    names = {i: (n, c) for i, n, c in MENU_1020} | {PIZZA: ("Cheese pizza", "meat_alternate")}
    name, component = names[item_id]
    return {
        "item_id": item_id, "name": name, "component": component,
        "wanted": wanted, "got": got, "missed": missed, "waiting": waiting, "free": is_free,
    }


def zero_menu(**overrides):
    """The 10-20 service items, all zeros, with per-item overrides (a dict of field changes)."""
    out = []
    for item_id, _, _ in MENU_1020:
        row = svc_item(item_id)
        row.update(overrides.get(item_id, {}))
        out.append(row)
    return out


def auto_picks(target_date, data=FULL):
    """A valid tray for target_date: the first item of every group on that day's menu."""
    with (data / "items.csv").open(newline="") as f:
        component = {r["item_id"]: r["component"] for r in csv.DictReader(f)}
    with (data / "menu.csv").open(newline="") as f:
        menu = [r for r in csv.DictReader(f) if r["date"] == target_date]
    picks = {c: None for c in COMPONENTS}
    for row in menu:
        if picks[component[row["item_id"]]] is None:
            picks[component[row["item_id"]]] = row["item_id"]
    return picks


# ============================================================ 1. check-in


def test_served_invalid_device_is_400(client):
    for body in ({"device": "bad device", "got": True}, {"got": True}):
        response = client.post("/api/served", json=body, headers=day(TARGET))
        assert response.status_code == 400, response.text
        assert response.json() == E_DEVICE


@pytest.mark.parametrize("bad", ["yes", "true", 1, 0, None, [], {}, MISSING])
def test_served_got_must_be_a_real_bool(client, bad):
    pack(client, DEV1, D1)
    response = served(client, DEV1, bad)
    assert response.status_code == 400, (bad, response.text)
    assert response.json() == E_GOT
    # nothing was recorded: the device can still answer once
    assert summary(client, admin_token(client))["service"]["checked_in"] == 0


def test_served_without_a_tray_is_404(client):
    response = served(client, DEV1, True)
    assert response.status_code == 404, response.text
    assert response.json() == E_NO_TRAY


def test_served_tray_for_tomorrow_is_not_todays_lunch(client):
    # packed on 10-19 the tray targets 10-20, so on 10-19 there is no lunch to check in to
    pack(client, DEV1, D1)
    response = served(client, DEV1, True, date=TODAY)
    assert response.status_code == 404
    assert response.json() == E_NO_TRAY


def test_served_after_the_target_day_is_404(client):
    pack(client, DEV1, D1)
    response = served(client, DEV1, True, date=NEXT)
    assert response.status_code == 404
    assert response.json() == E_NO_TRAY


def test_served_only_counts_the_devices_own_tray(client):
    pack(client, DEV1, D1)
    assert served(client, DEV2, True).status_code == 404


def test_served_tray_at_another_school_does_not_count(client):
    pack(client, DEV1, D1)  # demo tray targeting 10-20
    response = served(client, DEV1, True, school="live")
    assert response.status_code == 404
    assert response.json() == E_NO_TRAY


def test_served_unknown_school_is_404(client):
    response = served(client, DEV1, True, school="ghost")
    assert response.status_code == 404
    assert set(response.json()) == {"error"}


def test_served_success_response_is_exact_for_true_and_false(client):
    pack(client, DEV1, D1)
    pack(client, DEV2, D2)
    assert served_ok(client, DEV1, True) == {"ok": True, "date": TARGET, "got": True, "simulated": True}
    assert served_ok(client, DEV2, False) == {"ok": True, "date": TARGET, "got": False, "simulated": True}


def test_served_second_post_updates_the_answer(client):
    token = admin_token(client)
    pack(client, DEV1, D1)
    assert served_ok(client, DEV1, True)["got"] is True
    first = summary(client, token)["service"]
    assert (first["checked_in"], first["got"], first["missed"]) == (1, 1, 0)

    # a mis-tap is corrected: still 200, still one check-in
    again = served_ok(client, DEV1, False)
    assert again == {"ok": True, "date": TARGET, "got": False, "simulated": True}
    second = summary(client, token)["service"]
    assert (second["checked_in"], second["got"], second["missed"]) == (1, 0, 1)
    assert me(client, DEV1).json()["today_lunch"]["checked_in"] is False

    # and back again, same answer twice is fine too
    served_ok(client, DEV1, True)
    served_ok(client, DEV1, True)
    third = summary(client, token)["service"]
    assert (third["checked_in"], third["got"], third["missed"]) == (1, 1, 0)


def test_served_makes_a_served_event_for_the_school(client):
    pack(client, DEV1, D1)
    since = latest(client)
    served_ok(client, DEV1, True)
    events = kind_events(client, "served", since)
    assert len(events) == 1
    event = events[0]
    assert event["school_id"] == "demo"
    assert event["summary"] == "A student checked in after lunch"
    assert re.fullmatch(r"[0-9a-f]{6}", event["player"])
    assert DEV1 not in str(event)
    # the same device has the same anonymous tag on its tray event
    tray_event = kind_events(client, "tray")[0]
    assert event["player"] == tray_event["player"]


def test_rejected_check_ins_make_no_served_event(client):
    pack(client, DEV1, D1)
    since = latest(client)
    served(client, "bad device", True)
    served(client, DEV1, "yes")
    served(client, DEV2, True)  # no tray
    assert kind_events(client, "served", since) == []


def test_served_events_are_in_the_simulated_feed_only_for_demo(client):
    pack(client, DEV1, D1)
    since = latest(client)
    served_ok(client, DEV1, True)
    assert len(kind_events(client, "served", since, scope="simulated")) == 1
    assert kind_events(client, "served", since, scope="live") == []


def test_check_ins_count_toward_the_write_limit(monkeypatch, tmp_path):
    with TestClient(make_app(monkeypatch, tmp_path, vote_limit=4)) as c:
        pack(c, DEV1, D1)
        pack(c, DEV2, D2)
        assert served(c, DEV1, True).status_code == 200
        assert served(c, DEV2, False).status_code == 200
        blocked = served(c, DEV1, False)
        assert blocked.status_code == 429
        assert blocked.json() == SLOW


def test_reads_do_not_use_the_write_budget_and_upserts_do(monkeypatch, tmp_path):
    with TestClient(make_app(monkeypatch, tmp_path, request_limit=1000, vote_limit=3)) as c:
        pack(c, DEV1, D1)  # budget 1 of 3
        for _ in range(10):
            assert get_tray(c, DEV1).status_code == 200
            assert me(c, DEV1).status_code == 200
            assert public_free(c).status_code == 200
        assert served(c, DEV1, True).status_code == 200  # 2 of 3
        assert served(c, DEV1, False).status_code == 200  # 3 of 3: an update is a write too
        blocked = served(c, DEV1, True)
        assert blocked.status_code == 429
        assert blocked.json() == SLOW


# ------------------------------------------------------------ today_lunch


def test_today_lunch_is_null_without_a_tray(client):
    assert get_tray(client, DEV1).json()["today_lunch"] is None
    assert me(client, DEV1).json()["today_lunch"] is None
    # no device at all
    assert get_tray(client).json()["today_lunch"] is None


def test_today_lunch_is_null_when_the_tray_targets_another_day(client):
    pack(client, DEV1, D1)  # targets 10-20
    assert get_tray(client, DEV1, date=TODAY).json()["today_lunch"] is None
    assert me(client, DEV1, date=TODAY).json()["today_lunch"] is None
    assert me(client, DEV1, date=NEXT).json()["today_lunch"] is None


def test_today_lunch_for_a_full_tray_on_both_routes(client):
    pack(client, DEV1, D1)
    expected = {
        "date": TARGET,
        "picks": D1,
        "items": [
            {"component": "meat_alternate", "item_id": TACOS, "name": "Chicken tacos"},
            {"component": "grain", "item_id": ROLL, "name": "Whole wheat roll"},
            {"component": "vegetable", "item_id": SALAD, "name": "Side salad"},
            {"component": "milk", "item_id": MILK, "name": "1% milk"},
        ],
        "checked_in": None,
    }
    assert get_tray(client, DEV1).json()["today_lunch"] == expected
    assert me(client, DEV1).json()["today_lunch"] == expected


def test_today_lunch_lists_only_picked_items_in_tray_order(client):
    pack(client, DEV2, D2)
    pack(client, DEV3, D3)
    two = me(client, DEV2).json()["today_lunch"]
    assert [i["item_id"] for i in two["items"]] == [TACOS, ROLL, APPLE]
    three = get_tray(client, DEV3).json()["today_lunch"]
    assert [i["item_id"] for i in three["items"]] == [POPCORN, MILK]
    assert three["picks"] == D3
    assert three["items"][0] == {"component": "meat_alternate", "item_id": POPCORN, "name": "Popcorn chicken"}


def test_today_lunch_is_per_device(client):
    pack(client, DEV1, D1)
    assert me(client, DEV2).json()["today_lunch"] is None
    assert get_tray(client, DEV2).json()["today_lunch"] is None


def test_today_lunch_checked_in_follows_the_answer(client):
    pack(client, DEV1, D1)
    assert me(client, DEV1).json()["today_lunch"]["checked_in"] is None
    served_ok(client, DEV1, True)
    assert me(client, DEV1).json()["today_lunch"]["checked_in"] is True
    assert get_tray(client, DEV1).json()["today_lunch"]["checked_in"] is True
    served_ok(client, DEV1, False)
    assert me(client, DEV1).json()["today_lunch"]["checked_in"] is False
    assert get_tray(client, DEV1).json()["today_lunch"]["checked_in"] is False


def test_today_lunch_keys_are_exactly_the_spec(client):
    pack(client, DEV1, D1)
    lunch = me(client, DEV1).json()["today_lunch"]
    assert set(lunch) == {"date", "picks", "items", "checked_in"}


def test_existing_tray_and_me_fields_survive(client):
    pack(client, DEV1, D1)
    body = get_tray(client, DEV1, date=TODAY).json()
    assert {"open_date", "target_date", "groups", "picks", "tally", "simulated"} <= set(body)
    assert body["picks"] == D1
    assert {"streak", "xp", "badges", "voted_today", "packed_today", "simulated"} <= set(me(client, DEV1).json())


# -------------------------------------------------------- 2. free leftovers


def test_free_requires_a_staff_token(client):
    token = admin_token(client)
    for headers in (
        {},
        {"Authorization": "Bearer not-a-token"},
        {"Authorization": token},  # no Bearer prefix
        {"Authorization": "Bearer "},
    ):
        response = client.post(
            "/api/admin/free", json={"item_id": TACOS, "free": True}, headers=headers | day(TARGET)
        )
        assert response.status_code == 401, headers
    assert public_free(client).json()["free"] == []


def test_free_unauthorised_request_wins_over_a_bad_body(client):
    response = client.post("/api/admin/free", json={"item_id": "nope", "free": "x"}, headers=day(TARGET))
    assert response.status_code == 401


def test_free_on_returns_the_exact_shape(client):
    token = admin_token(client)
    body = free_ok(client, token, TACOS, True)
    assert set(body) == {"ok", "date", "free", "simulated"}
    assert body["ok"] is True and body["simulated"] is True
    assert body["date"] == TARGET
    assert len(body["free"]) == 1
    item = body["free"][0]
    assert set(item) == {"item_id", "name", "since"}
    assert item["item_id"] == TACOS and item["name"] == "Chicken tacos"
    assert isinstance(item["since"], str) and item["since"]


def test_free_on_twice_is_idempotent(client):
    token = admin_token(client)
    first = free_ok(client, token, TACOS, True)
    second = free_ok(client, token, TACOS, True)
    assert [i["item_id"] for i in second["free"]] == [TACOS]
    assert second["free"] == first["free"]  # the original "since" is kept
    assert len(public_free(client).json()["free"]) == 1


def test_free_off_removes_and_is_idempotent(client):
    token = admin_token(client)
    free_ok(client, token, TACOS, True)
    free_ok(client, token, POPCORN, True)
    off = free_ok(client, token, TACOS, False)
    assert [i["item_id"] for i in off["free"]] == [POPCORN]
    again = free_ok(client, token, TACOS, False)
    assert [i["item_id"] for i in again["free"]] == [POPCORN]
    last = free_ok(client, token, POPCORN, False)
    assert last["free"] == []
    assert public_free(client).json()["free"] == []


def test_free_off_when_never_on_is_ok(client):
    body = free_ok(client, admin_token(client), TACOS, False)
    assert body["free"] == []
    assert body["date"] == TARGET


def test_free_lists_all_free_items_ordered_by_created_at(client):
    token = admin_token(client)
    free_ok(client, token, POPCORN, True)  # menu order would put tacos first
    time.sleep(1.1)  # created_at may only be second precise
    body = free_ok(client, token, TACOS, True)
    assert [i["item_id"] for i in body["free"]] == [POPCORN, TACOS]
    assert body["free"][0]["since"] <= body["free"][1]["since"]


@pytest.mark.parametrize("item_id", [PIZZA, "ghost_item", ""])
def test_free_off_menu_item_is_400(client, item_id):
    # cheese pizza is on the 10-19 and 10-21 menus but not on 10-20
    token = admin_token(client)
    response = free(client, token, item_id, True)
    assert response.status_code == 400, response.text
    assert response.json() == E_OFF_MENU
    assert public_free(client).json()["free"] == []


def test_free_off_menu_item_is_400_even_when_turning_it_off(client):
    token = admin_token(client)
    response = free(client, token, PIZZA, False)
    assert response.status_code == 400
    assert response.json() == E_OFF_MENU


def test_free_menu_check_follows_the_demo_date(client):
    token = admin_token(client)
    assert free(client, token, PIZZA, True, date=TARGET).status_code == 400
    assert free(client, token, PIZZA, True, date=NEXT).status_code == 200
    assert free(client, token, TACOS, True, date=TODAY).status_code == 400  # not on the 10-19 menu


@pytest.mark.parametrize("bad", ["yes", "true", 1, 0, None, [], MISSING])
def test_free_flag_must_be_a_real_bool(client, bad):
    token = admin_token(client)
    body = {"item_id": TACOS}
    if bad is not MISSING:
        body["free"] = bad
    response = client.post("/api/admin/free", json=body, headers=bearer(token) | day(TARGET))
    assert response.status_code == 400, (bad, response.text)
    assert response.json() == E_FREE
    assert public_free(client).json()["free"] == []


def test_rejected_free_requests_make_no_free_event(client):
    token = admin_token(client)
    since = latest(client)
    free(client, token, PIZZA, True)
    free(client, token, TACOS, "yes")
    client.post("/api/admin/free", json={"item_id": TACOS, "free": True}, headers=day(TARGET))
    assert kind_events(client, "free", since) == []


def test_free_events_have_the_spec_summaries_and_school(client):
    token = admin_token(client)
    since = latest(client)
    free_ok(client, token, PIZZA, True, date=NEXT)
    free_ok(client, token, PIZZA, False, date=NEXT)
    events = kind_events(client, "free", since)
    assert [e["summary"] for e in events][0] == "Staff made cheese pizza leftovers free"
    assert events[-1]["summary"] == "Staff ended free cheese pizza"
    assert {e["school_id"] for e in events} == {"demo"}
    assert len(kind_events(client, "free", since, scope="simulated")) == len(events)
    assert kind_events(client, "free", since, scope="live") == []


# ----------------------------------------------------------------- /api/free


def test_public_free_is_empty_by_default_with_the_exact_shape(client):
    response = public_free(client)
    assert response.status_code == 200
    assert response.json() == {"date": TARGET, "free": [], "simulated": True}


def test_public_free_needs_no_auth_and_lists_items_with_component(client):
    token = admin_token(client)
    staff = free_ok(client, token, TACOS, True)
    body = public_free(client).json()
    assert set(body) == {"date", "free", "simulated"}
    assert body["date"] == TARGET and body["simulated"] is True
    assert len(body["free"]) == 1
    item = body["free"][0]
    assert set(item) == {"item_id", "name", "component", "since"}
    assert item["item_id"] == TACOS
    assert item["name"] == "Chicken tacos"
    assert item["component"] == "meat_alternate"
    assert item["since"] == staff["free"][0]["since"]


def test_public_free_lists_every_free_item(client):
    token = admin_token(client)
    free_ok(client, token, TACOS, True)
    free_ok(client, token, MILK, True)
    items = {i["item_id"]: i for i in public_free(client).json()["free"]}
    assert set(items) == {TACOS, MILK}
    assert items[MILK]["component"] == "milk" and items[MILK]["name"] == "1% milk"


def test_public_free_defaults_to_the_demo_school(client):
    token = admin_token(client)
    free_ok(client, token, TACOS, True)
    explicit = public_free(client, school="demo").json()
    assert explicit == public_free(client).json()
    assert [i["item_id"] for i in explicit["free"]] == [TACOS]


def test_public_free_is_per_date(client):
    token = admin_token(client)
    free_ok(client, token, TACOS, True, date=TARGET)
    assert public_free(client, date=NEXT).json() == {"date": NEXT, "free": [], "simulated": True}
    assert public_free(client, date=TODAY).json()["free"] == []
    assert [i["item_id"] for i in public_free(client, date=TARGET).json()["free"]] == [TACOS]


def test_public_free_unknown_school_is_404(client):
    response = public_free(client, school="ghost")
    assert response.status_code == 404
    assert set(response.json()) == {"error"}


def test_free_today_is_on_tray_and_me_for_everyone(client):
    token = admin_token(client)
    assert get_tray(client, DEV1).json()["free_today"] == []
    assert me(client, DEV1).json()["free_today"] == []
    free_ok(client, token, TACOS, True)
    expected = public_free(client).json()["free"]
    assert [i["item_id"] for i in expected] == [TACOS]
    assert get_tray(client, DEV1).json()["free_today"] == expected
    assert get_tray(client).json()["free_today"] == expected  # device is optional
    assert me(client, DEV1).json()["free_today"] == expected
    assert me(client, DEV2).json()["free_today"] == expected  # also for a device with no tray
    free_ok(client, token, TACOS, False)
    assert get_tray(client, DEV1).json()["free_today"] == []
    assert me(client, DEV1).json()["free_today"] == []


def test_free_today_follows_the_school_date(client):
    token = admin_token(client)
    free_ok(client, token, TACOS, True, date=TARGET)
    assert me(client, DEV1, date=NEXT).json()["free_today"] == []
    assert get_tray(client, DEV1, date=NEXT).json()["free_today"] == []


def test_free_does_not_change_tray_picks_or_check_ins(client):
    token = admin_token(client)
    pack(client, DEV1, D1)
    free_ok(client, token, TACOS, True)
    lunch = me(client, DEV1).json()["today_lunch"]
    assert lunch["picks"] == D1 and lunch["checked_in"] is None


# ----------------------------------------------- token school wins (live)


def test_demo_staff_cannot_free_at_live(live_hashed):
    c = live_hashed
    demo = admin_token(c)
    # the body and the query both name live, the token is for demo: demo is freed
    body = free_ok(c, demo, TACOS, True, date=TARGET, school="live", query="?school=live")
    assert body["date"] == TARGET
    assert [i["item_id"] for i in body["free"]] == [TACOS]
    assert [i["item_id"] for i in public_free(c, school="demo", date=TARGET).json()["free"]] == [TACOS]
    live_view = public_free(c, school="live", date=None).json()
    assert live_view["date"] == TODAY
    assert live_view["free"] == []
    assert summary(c, live_token(c), date=None)["free"] == []


def test_live_staff_cannot_free_at_demo_and_live_ignores_x_demo_date(live_hashed):
    c = live_hashed
    live = live_token(c)
    # the header says 10-20 and the body says demo; live's own clock (10-19) and token win
    body = free_ok(c, live, PIZZA, True, date=TARGET, school="demo")
    assert body["date"] == TODAY
    assert [i["item_id"] for i in body["free"]] == [PIZZA]
    assert [i["item_id"] for i in public_free(c, school="live", date=None).json()["free"]] == [PIZZA]
    # same header on the read side: live still reports 10-19
    assert public_free(c, school="live", date=NEXT).json()["date"] == TODAY
    assert [i["item_id"] for i in public_free(c, school="live", date=NEXT).json()["free"]] == [PIZZA]
    # demo sees nothing on any of the days
    for d in (TODAY, TARGET, NEXT):
        assert public_free(c, school="demo", date=d).json()["free"] == []
        assert summary(c, admin_token(c), date=d)["free"] == []


def test_live_menu_check_uses_the_live_date_not_the_header(live_hashed):
    c = live_hashed
    live = live_token(c)
    # tacos are on the 10-20 menu (the header) but not on the live 10-19 menu
    response = free(c, live, TACOS, True, date=TARGET)
    assert response.status_code == 400
    assert response.json() == E_OFF_MENU
    # while the demo school, whose clock follows the header, accepts the same request
    assert free(c, admin_token(c), TACOS, True, date=TARGET).status_code == 200


def test_free_events_at_live_stay_in_the_live_feed(live_hashed):
    c = live_hashed
    since = latest(c)
    free_ok(c, live_token(c), PIZZA, True, date=None)
    events = kind_events(c, "free", since)
    assert [e["school_id"] for e in events] == ["live"]
    assert len(kind_events(c, "free", since, scope="live")) == 1
    assert kind_events(c, "free", since, scope="simulated") == []


# ======================================================= 3. service view


def test_summary_service_is_null_when_no_tray_targets_today(client):
    token = admin_token(client)
    # trays packed on 10-19 target 10-20, so the 10-19 summary has no service
    assert summary(client, token, date=TODAY)["service"] is None
    pack(client, DEV1, D1)
    assert summary(client, token, date=TODAY)["service"] is None
    assert summary(client, token, date=NEXT)["service"] is None
    assert "service" in summary(client, token, date=TODAY)


def test_summary_service_hand_computed_example(client):
    """3 devices pick, 2 check in (one got it, one missed), 1 has not answered."""
    token = admin_token(client)
    pack(client, DEV1, D1)
    pack(client, DEV2, D2)
    pack(client, DEV3, D3)
    served_ok(client, DEV1, True)
    served_ok(client, DEV2, False)
    service = summary(client, token)["service"]
    assert service == {
        "date": TARGET,
        "packed": 3,
        "checked_in": 2,
        "got": 1,
        "missed": 1,
        "items": [
            # tacos: D1 got, D2 missed
            svc_item(TACOS, wanted=2, got=1, missed=1, waiting=0),
            # popcorn: only D3, who has not checked in
            svc_item(POPCORN, wanted=1, got=0, missed=0, waiting=1),
            # roll: D1 got, D2 missed
            svc_item(ROLL, wanted=2, got=1, missed=1, waiting=0),
            # salad: D1 got
            svc_item(SALAD, wanted=1, got=1, missed=0, waiting=0),
            # apple: D2 missed
            svc_item(APPLE, wanted=1, got=0, missed=1, waiting=0),
            # milk: D1 got, D3 waiting
            svc_item(MILK, wanted=2, got=1, missed=0, waiting=1),
        ],
    }


def test_summary_service_before_anyone_checks_in(client):
    token = admin_token(client)
    pack(client, DEV1, D1)
    pack(client, DEV2, D2)
    service = summary(client, token)["service"]
    assert (service["packed"], service["checked_in"], service["got"], service["missed"]) == (2, 0, 0, 0)
    by_id = {i["item_id"]: i for i in service["items"]}
    assert by_id[TACOS]["wanted"] == 2 and by_id[TACOS]["waiting"] == 2
    assert by_id[POPCORN]["wanted"] == 0 and by_id[POPCORN]["waiting"] == 0
    assert by_id[MILK]["wanted"] == 1 and by_id[MILK]["waiting"] == 1


def test_summary_service_lists_every_menu_item_with_zeros(client):
    token = admin_token(client)
    pack(client, DEV1, ONLY_TACOS)
    service = summary(client, token)["service"]
    assert service["packed"] == 1
    assert service["items"] == zero_menu(**{TACOS: {"wanted": 1, "waiting": 1}})
    served_ok(client, DEV1, True)
    service = summary(client, token)["service"]
    assert service["items"] == zero_menu(**{TACOS: {"wanted": 1, "got": 1, "waiting": 0}})
    assert (service["checked_in"], service["got"], service["missed"]) == (1, 1, 0)


def test_summary_service_item_keys_are_exactly_the_spec(client):
    token = admin_token(client)
    pack(client, DEV1, D1)
    service = summary(client, token)["service"]
    assert set(service) == {"date", "packed", "checked_in", "got", "missed", "items"}
    for item in service["items"]:
        assert set(item) == {"item_id", "name", "component", "wanted", "got", "missed", "waiting", "free"}


def test_summary_service_free_flag_follows_the_freebies(client):
    token = admin_token(client)
    pack(client, DEV1, ONLY_TACOS)
    free_ok(client, token, POPCORN, True)
    service = summary(client, token)["service"]
    assert service["items"] == zero_menu(
        **{TACOS: {"wanted": 1, "waiting": 1}, POPCORN: {"free": True}}
    )
    free_ok(client, token, POPCORN, False)
    assert all(i["free"] is False for i in summary(client, token)["service"]["items"])


def test_summary_service_counts_only_trays_targeting_that_day(client):
    token = admin_token(client)
    pack(client, DEV1, D1, date=TODAY)  # targets 10-20
    pack(client, DEV2, D2, date=TARGET)  # targets 10-21
    on_20 = summary(client, token, date=TARGET)["service"]
    on_21 = summary(client, token, date=NEXT)["service"]
    assert on_20["date"] == TARGET and on_20["packed"] == 1
    assert on_21["date"] == NEXT and on_21["packed"] == 1
    # the 10-21 menu has cheese pizza next to the tacos; every menu item is listed
    assert [i["item_id"] for i in on_21["items"]].count(PIZZA) == 1
    assert sorted(i["item_id"] for i in on_21["items"]) == sorted([TACOS, PIZZA, ROLL, SALAD, APPLE, MILK])
    assert [i["component"] for i in on_21["items"]] == [
        "meat_alternate", "meat_alternate", "grain", "vegetable", "fruit", "milk",
    ]
    wanted = {i["item_id"]: i["wanted"] for i in on_21["items"]}
    assert wanted == {TACOS: 1, PIZZA: 0, ROLL: 1, SALAD: 0, APPLE: 1, MILK: 0}
    # a check-in on 10-20 does not touch the 10-21 numbers
    served_ok(client, DEV1, True, date=TARGET)
    assert summary(client, token, date=NEXT)["service"]["checked_in"] == 0


def test_summary_free_lists_todays_free_items(client):
    token = admin_token(client)
    assert summary(client, token)["free"] == []
    free_ok(client, token, TACOS, True)
    listed = summary(client, token)["free"]
    assert [i["item_id"] for i in listed] == [TACOS]
    assert {"item_id", "name", "since"} <= set(listed[0])
    assert listed[0]["name"] == "Chicken tacos"
    assert summary(client, token, date=NEXT)["free"] == []
    free_ok(client, token, TACOS, False)
    assert summary(client, token)["free"] == []


def test_summary_keeps_its_existing_fields(client):
    token = admin_token(client)
    body = summary(client, token)
    assert {"school", "today", "vote", "tray", "players"} <= set(body)
    assert body["today"] == TARGET


# ------------------------------------------------- live clock for check-ins


def test_live_check_in_ignores_x_demo_date(monkeypatch, tmp_path):
    """Pack at live on 10-19, then restart the server on 10-20 and check in with misleading headers."""
    monkeypatch.setenv("LUNCHLOOP_SCHOOL_PASSWORDS", f"live={pbkdf2_hash(LIVE_PASSWORD)}")
    with TestClient(make_app(monkeypatch, tmp_path, today=TODAY)) as first:
        pack(first, DEV1, D1, school="live", date=None)
        # on live 10-19 nothing targets today, whatever the header says
        refused = served(first, DEV1, True, school="live", date=TARGET)
        assert refused.status_code == 404
        assert refused.json() == E_NO_TRAY
    with TestClient(make_app(monkeypatch, tmp_path, today=TARGET)) as c:
        # a header for an earlier or later day changes nothing at live
        for header_date in (TODAY, NEXT, "2026-10-25"):
            body = served_ok(c, DEV1, True, school="live", date=header_date)
            assert body == {"ok": True, "date": TARGET, "got": True, "simulated": True}
        lunch = me(c, DEV1, school="live", date=NEXT).json()["today_lunch"]
        assert lunch["date"] == TARGET and lunch["checked_in"] is True
        service = summary(c, live_token(c), date=TODAY)["service"]
        assert service["date"] == TARGET
        assert (service["packed"], service["checked_in"], service["got"], service["missed"]) == (1, 1, 1, 0)
        # the demo school has no tray from this device, so nothing leaks across
        assert served(c, DEV1, True, school="demo", date=None).status_code == 404
        assert summary(c, admin_token(c), date=TARGET)["service"] is None
        # the served event belongs to live
        assert {e["school_id"] for e in kind_events(c, "served")} == {"live"}
        assert len(kind_events(c, "served", scope="live")) >= 1
        assert kind_events(c, "served", scope="simulated") == []


def test_demo_check_in_follows_x_demo_date(client):
    pack(client, DEV1, D1)
    assert served(client, DEV1, True, date=TARGET).status_code == 200
    assert served(client, DEV1, True, date=TODAY).status_code == 404


# ========================================================== 4. demo crowd


def crowd(client, count, school="demo", date=TARGET):
    return client.post(
        "/api/demo/crowd", json={"school": school, "count": count}, headers=day(date) if date else {}
    )


def crowd_ok(client, count, **kwargs):
    response = crowd(client, count, **kwargs)
    assert response.status_code == 200, response.text
    return response.json()


def assert_service_consistent(service):
    assert service["got"] + service["missed"] == service["checked_in"]
    assert service["checked_in"] <= service["packed"]
    for item in service["items"]:
        assert item["got"] + item["missed"] <= item["wanted"], item
        assert item["waiting"] == item["wanted"] - item["got"] - item["missed"], item
        assert item["free"] is False


def test_crowd_makes_students_check_in_and_totals_say_so(full_client):
    c = full_client
    token = admin_token(c)
    body = crowd_ok(c, 40)
    assert {"votes", "trays", "checked_in"} <= set(body["totals"])
    service = summary(c, token)["service"]
    assert service is not None
    assert service["date"] == TARGET
    # no sim trays targeted 10-20 yet, so exactly `count` were made for the previous school day
    assert service["packed"] == 40
    # about 85% of 40 check in (34), about 90% of those got it (31); wide margins on purpose
    assert 25 <= service["checked_in"] <= 40
    assert service["got"] >= 0.7 * service["checked_in"]
    assert service["missed"] == service["checked_in"] - service["got"]
    assert body["totals"]["checked_in"] == service["checked_in"]
    assert_service_consistent(service)
    assert {i["item_id"] for i in service["items"]} == {
        r["item_id"] for r in csv.DictReader((FULL / "menu.csv").open(newline="")) if r["date"] == TARGET
    }


def test_crowd_creates_the_missing_trays_on_the_previous_school_day(full_client):
    c = full_client
    token = admin_token(c)
    crowd_ok(c, 10)
    # Mon 10-19 packed trays for Tue 10-20
    packed_before = summary(c, token, date=TODAY)["tray"]
    assert packed_before["total"] == 10
    assert packed_before["target_date"] == TARGET


def test_crowd_on_a_monday_uses_friday_trays(full_client):
    c = full_client
    token = admin_token(c)
    monday, friday = "2026-10-26", "2026-10-23"
    body = crowd_ok(c, 6, date=monday)
    assert body["date"] == monday
    friday_trays = summary(c, token, date=friday)["tray"]
    assert friday_trays["total"] == 6
    assert friday_trays["target_date"] == monday
    service = summary(c, token, date=monday)["service"]
    assert service["date"] == monday and service["packed"] == 6
    assert body["totals"]["checked_in"] == service["checked_in"]


def test_crowd_again_reuses_existing_trays_instead_of_adding_more(full_client):
    c = full_client
    token = admin_token(c)
    crowd_ok(c, 5)
    assert summary(c, token)["service"]["packed"] == 5
    second = crowd_ok(c, 5)
    service = summary(c, token)["service"]
    # sim trays already targeted today, so no new previous-day trays were made
    assert service["packed"] == 5
    assert summary(c, token, date=TODAY)["tray"]["total"] == 5
    assert service["checked_in"] <= 5
    assert second["totals"]["checked_in"] == service["checked_in"]
    assert_service_consistent(service)


def test_crowd_with_real_trays_present_never_checks_real_devices_in(full_client):
    c = full_client
    token = admin_token(c)
    picks = auto_picks(TARGET)
    pack(c, "device-real-01", picks)
    crowd_ok(c, 5)
    # one real tray plus five simulated ones target 10-20
    service = summary(c, token)["service"]
    assert service["packed"] == 6
    assert service["checked_in"] <= 5
    lunch = me(c, "device-real-01").json()["today_lunch"]
    assert lunch["picks"] == picks
    assert lunch["checked_in"] is None


def test_crowd_check_ins_are_deterministic(monkeypatch, tmp_path):
    results = []
    for name in ("a.db", "b.db"):
        with TestClient(make_app(monkeypatch, tmp_path, data=FULL, db=name)) as c:
            body = crowd_ok(c, 25)
            service = summary(c, admin_token(c))["service"]
            results.append((body["totals"], service))
    assert results[0] == results[1]


def test_crowd_records_served_events_for_the_school(full_client):
    c = full_client
    since = latest(c)
    body = crowd_ok(c, 5)
    events = kind_events(c, "served", since)
    assert len(events) == body["totals"]["checked_in"]
    assert len(events) >= 1
    for event in events:
        assert event["school_id"] == "demo"
        assert event["summary"] == "A student checked in after lunch"
        assert "sim-" not in str(event)
    assert len(kind_events(c, "served", since, scope="simulated")) == len(events)
    assert kind_events(c, "served", since, scope="live") == []


def test_crowd_for_live_is_refused_and_creates_no_check_ins(live_hashed):
    c = live_hashed
    since = latest(c)
    response = crowd(c, 5, school="live", date=TARGET)
    assert response.status_code == 400
    assert response.json() == E_LIVE
    assert kind_events(c, "served", since) == []
    assert summary(c, live_token(c), date=None)["service"] is None


def test_crowd_at_demo_never_touches_live(monkeypatch, tmp_path):
    monkeypatch.setenv("LUNCHLOOP_SCHOOL_PASSWORDS", f"live={pbkdf2_hash(LIVE_PASSWORD)}")
    with TestClient(make_app(monkeypatch, tmp_path, data=FULL)) as c:
        since = latest(c)
        crowd_ok(c, 10, date=TARGET)
        # read the feed before signing in to live, which is itself a live event
        assert feed(c, after=since, scope="live")["events"] == []
        assert not [e for e in feed(c, after=since)["events"] if e["school_id"] == "live"]
        assert c.get("/api/free", params={"school": "live"}).json()["free"] == []
        live = live_token(c)
        # live's clock is 10-19, so sim trays for live would show as a 10-19 tray tally
        # and, one day later, as a service view
        assert summary(c, live, date=None)["tray"] is None
        assert summary(c, live, date=None)["service"] is None
        assert summary(c, live, date=None)["free"] == []
        assert summary(c, live, date=TARGET)["service"] is None


def test_crowd_checked_in_total_exists_for_a_small_crowd(full_client):
    body = crowd_ok(full_client, 1)
    assert isinstance(body["totals"]["checked_in"], int)
    assert 0 <= body["totals"]["checked_in"] <= 1


# ====================================================== 5. events and docs


def test_both_new_event_kinds_appear_in_the_public_feed(client):
    token = admin_token(client)
    pack(client, DEV1, D1)
    served_ok(client, DEV1, True)
    free_ok(client, token, TACOS, True)
    kinds = {e["kind"] for e in feed(client)["events"]}
    assert {"served", "free"} <= kinds


def test_new_events_hold_no_device_ids_or_tokens(client):
    token = admin_token(client)
    pack(client, DEV1, D1)
    served_ok(client, DEV1, True)
    free_ok(client, token, TACOS, True)
    raw = str([e for e in feed(client)["events"] if e["kind"] in {"served", "free"}])
    assert DEV1 not in raw
    assert token not in raw


def test_the_contract_doc_describes_the_new_routes_and_fields():
    text = (ROOT / "docs" / "backend-contract.md").read_text()
    for needle in (
        "/api/served",
        "/api/free",
        "/api/admin/free",
        "today_lunch",
        "free_today",
        "service",
        "no tray for today",
        "that food is not on today's menu",
        "freebies",
    ):
        assert needle in text, needle
    assert re.search(r"`served`", text) and re.search(r"`free`", text)
