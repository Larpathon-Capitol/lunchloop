"""Black-box tests for the tray vote feature (GET and POST /api/tray).

Expected values come from the written tray spec and the sample CSVs, worked out
by hand. Nothing here imports the tray code.

Sample data facts used below (data/sample/menu.csv, clock 2026-10-19):
- 2026-10-19 Mon to 2026-10-23 Fri, then 2026-10-26 Mon onward, are school days;
  the menu ends on Fri 2026-10-30 (so a tray on that day has no next day).
- 2026-10-20 menu rows: chicken_tacos, popcorn_chicken (meat_alternate, in that
  file order), wheat_roll, side_salad, apple_slices, milk_1pct.
- A tray opened on 10-19 is for 10-20; opened on Fri 10-23 it is for Mon 10-26.
"""

import csv
import re
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

DATA = Path(__file__).resolve().parents[2] / "data" / "sample"
SECRET = "unit-test-secret"
TODAY = "2026-10-19"
TARGET = "2026-10-20"
TACOS, PIZZA, POPCORN = "chicken_tacos", "cheese_pizza", "popcorn_chicken"
ROLL, SALAD, APPLE, MILK = "wheat_roll", "side_salad", "apple_slices", "milk_1pct"
COMPONENTS = ["meat_alternate", "grain", "vegetable", "fruit", "milk"]
SLOW = {"error": "slow down a little"}

# every error message the spec lists for POST /api/tray, in validation order
E_DEVICE = "invalid device"
E_PICKS = "picks must be an object"
E_GROUP = "unknown food group"
E_MISSING = "pick or skip every food group"
E_NOT_ON_TRAY = "that food is not on this tray"
E_NONE = "pick at least one food"
E_DUP = "already packed a tray today"

# The 10-20 tray as GET /api/tray must list it (items.csv names and allergens).
GROUPS_1020 = [
    {
        "component": "meat_alternate",
        "items": [
            {"item_id": TACOS, "name": "Chicken tacos", "allergens": ["milk"], "diet": [], "gluten_free": True, "dairy_free": False},
            {"item_id": POPCORN, "name": "Popcorn chicken", "allergens": ["wheat", "soybeans"], "diet": [], "gluten_free": False, "dairy_free": True},
        ],
    },
    {"component": "grain", "items": [{"item_id": ROLL, "name": "Whole wheat roll", "allergens": ["wheat"], "diet": ["vegetarian"], "gluten_free": False, "dairy_free": True}]},
    {"component": "vegetable", "items": [{"item_id": SALAD, "name": "Side salad", "allergens": [], "diet": ["vegetarian", "vegan"], "gluten_free": True, "dairy_free": True}]},
    {"component": "fruit", "items": [{"item_id": APPLE, "name": "Apple slices", "allergens": [], "diet": ["vegetarian", "vegan"], "gluten_free": True, "dairy_free": True}]},
    {"component": "milk", "items": [{"item_id": MILK, "name": "1% milk", "allergens": ["milk"], "diet": ["vegetarian"], "gluten_free": True, "dairy_free": False}]},
]

# Three devices, picks chosen so every count below can be checked by hand.
#   meat_alternate: D1 tacos, D2 tacos, D3 popcorn
#   grain:          D1 roll,  D2 roll,  D3 skip
#   vegetable:      D1 salad, D2 skip,  D3 skip
#   fruit:          D1 skip,  D2 apple, D3 skip
#   milk:           D1 milk,  D2 skip,  D3 milk
D1 = {"meat_alternate": TACOS, "grain": ROLL, "vegetable": SALAD, "fruit": None, "milk": MILK}
D2 = {"meat_alternate": TACOS, "grain": ROLL, "vegetable": None, "fruit": APPLE, "milk": None}
D3 = {"meat_alternate": POPCORN, "grain": None, "vegetable": None, "fruit": None, "milk": MILK}


def tally_literal(total, rows):
    """rows: component -> (skips, [(item_id, name, picks)]); shares given as picks/total by hand below."""
    out = {"target_date": TARGET, "total": total, "groups": []}
    for component in COMPONENTS:
        skips, items = rows[component]
        out["groups"].append(
            {
                "component": component,
                "skips": skips,
                "items": [
                    {"item_id": i, "name": n, "picks": p, "share": p / total if total else 0}
                    for i, n, p in items
                ],
            }
        )
    return out


# after D1 alone: total 1, every picked item has share 1
TALLY_AFTER_1 = tally_literal(
    1,
    {
        "meat_alternate": (0, [(TACOS, "Chicken tacos", 1), (POPCORN, "Popcorn chicken", 0)]),
        "grain": (0, [(ROLL, "Whole wheat roll", 1)]),
        "vegetable": (0, [(SALAD, "Side salad", 1)]),
        "fruit": (1, [(APPLE, "Apple slices", 0)]),
        "milk": (0, [(MILK, "1% milk", 1)]),
    },
)
# after D1, D2: total 2
TALLY_AFTER_2 = tally_literal(
    2,
    {
        "meat_alternate": (0, [(TACOS, "Chicken tacos", 2), (POPCORN, "Popcorn chicken", 0)]),
        "grain": (0, [(ROLL, "Whole wheat roll", 2)]),
        "vegetable": (1, [(SALAD, "Side salad", 1)]),
        "fruit": (1, [(APPLE, "Apple slices", 1)]),
        "milk": (1, [(MILK, "1% milk", 1)]),
    },
)
# after D1, D2, D3: total 3 (shares 2/3, 1/3, 1/3 ...)
TALLY_AFTER_3 = tally_literal(
    3,
    {
        "meat_alternate": (0, [(TACOS, "Chicken tacos", 2), (POPCORN, "Popcorn chicken", 1)]),
        "grain": (1, [(ROLL, "Whole wheat roll", 2)]),
        "vegetable": (2, [(SALAD, "Side salad", 1)]),
        "fruit": (2, [(APPLE, "Apple slices", 1)]),
        "milk": (1, [(MILK, "1% milk", 2)]),
    },
)


# ----------------------------------------------------------------- helpers


@pytest.fixture(autouse=True)
def fixed_secret(monkeypatch):
    import api.auth

    monkeypatch.setenv("LUNCHLOOP_SECRET", SECRET)
    monkeypatch.delenv("LUNCHLOOP_SCHOOL_PASSWORDS", raising=False)
    monkeypatch.setattr(api.auth, "_SECRET", None)


def day(date):
    return {"X-Demo-Date": date}


def rows(name, data_dir=DATA):
    with (data_dir / name).open(newline="") as f:
        return list(csv.DictReader(f))


def auto_picks(open_date):
    """A valid tray for the day after open_date, chosen from menu.csv: first item in every group."""
    dates = sorted({r["date"] for r in rows("menu.csv") if r["date"] > open_date})
    picks = {}
    for row in rows("menu.csv"):
        if row["date"] == dates[0]:
            component = next(i["component"] for i in rows("items.csv") if i["item_id"] == row["item_id"])
            picks.setdefault(component, row["item_id"])
    return picks


def tray(client, device, picks, school=None, date=None):
    body = {"device": device, "picks": picks}
    if school is not None:
        body["school"] = school
    return client.post("/api/tray", json=body, headers=day(date) if date else {})


def get_tray(client, device=None, school=None, date=None):
    params = {}
    if device is not None:
        params["device"] = device
    if school is not None:
        params["school"] = school
    return client.get("/api/tray", params=params, headers=day(date) if date else {})


def vote(client, device, item=TACOS, school=None, date=None):
    body = {"device": device, "item_id": item}
    if school is not None:
        body["school"] = school
    return client.post("/api/vote", json=body, headers=day(date) if date else {})


def me(client, device, date=None, school=None):
    params = {"device": device}
    if school is not None:
        params["school"] = school
    return client.get("/api/me", params=params, headers=day(date) if date else {})


def assert_error(response, status, message):
    assert response.status_code == status, response.text
    assert response.json() == {"error": message}


def assert_tally(actual, expected):
    """Exact structure and order; shares compared as numbers."""
    assert actual["target_date"] == expected["target_date"]
    assert actual["total"] == expected["total"]
    assert [g["component"] for g in actual["groups"]] == [g["component"] for g in expected["groups"]]
    for got, want in zip(actual["groups"], expected["groups"]):
        assert set(got) == {"component", "skips", "items"}
        assert got["skips"] == want["skips"], got["component"]
        assert [i["item_id"] for i in got["items"]] == [i["item_id"] for i in want["items"]]
        for g_item, w_item in zip(got["items"], want["items"]):
            assert set(g_item) == {"item_id", "name", "picks", "share"}
            assert g_item["name"] == w_item["name"]
            assert g_item["picks"] == w_item["picks"], (got["component"], g_item["item_id"])
            assert g_item["share"] == pytest.approx(w_item["share"], abs=1e-6)


def make_custom_client(monkeypatch, tmp_path, edit_menu):
    data_dir = tmp_path / "data"
    shutil.copytree(DATA, data_dir)
    path = data_dir / "menu.csv"
    with path.open(newline="") as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames
        menu = list(reader)
    menu = edit_menu(menu)
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(menu)
    monkeypatch.setenv("LUNCHLOOP_DATA_DIR", str(data_dir))
    monkeypatch.setenv("LUNCHLOOP_DB", str(tmp_path / "custom.db"))
    monkeypatch.setenv("LUNCHLOOP_TODAY", TODAY)
    from api.main import create_app

    return TestClient(create_app())


def limited_app(monkeypatch, tmp_path, **limits):
    monkeypatch.setenv("LUNCHLOOP_DATA_DIR", str(DATA))
    monkeypatch.setenv("LUNCHLOOP_DB", str(tmp_path / "limits.db"))
    monkeypatch.setenv("LUNCHLOOP_TODAY", TODAY)
    from api.main import create_app

    return create_app(**limits)


def admin_token(client, school_id="demo", password="lunchloop"):
    response = client.post("/api/admin/login", json={"school_id": school_id, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["token"]


def summary(client, token, date=None):
    headers = {"Authorization": f"Bearer {token}"}
    if date:
        headers |= day(date)
    response = client.get("/api/admin/summary", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def events(client):
    response = client.get("/api/events", params={"limit": 100})
    assert response.status_code == 200
    return response.json()["events"]


# --------------------------------------------------------------- GET shape


def test_get_tray_shape_and_hand_listed_groups(client):
    response = get_tray(client, "device-0001")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"open_date", "target_date", "groups", "picks", "tally", "today_lunch", "free_today", "simulated"}
    assert body["simulated"] is True
    assert body["open_date"] == TODAY
    assert body["target_date"] == TARGET
    assert body["groups"] == GROUPS_1020
    assert body["picks"] is None
    assert body["tally"] is None


def test_get_tray_groups_follow_fixed_component_order(client):
    groups = get_tray(client, "device-0001").json()["groups"]
    assert [g["component"] for g in groups] == COMPONENTS


def test_get_tray_matches_menu_csv_for_other_days(client):
    # open on 10-20: the target is 10-21 (tacos and pizza on the menu)
    body = get_tray(client, "device-0001", date="2026-10-20").json()
    assert body["open_date"] == "2026-10-20"
    assert body["target_date"] == "2026-10-21"
    meat = body["groups"][0]
    assert meat["component"] == "meat_alternate"
    assert [i["item_id"] for i in meat["items"]] == [TACOS, PIZZA]
    assert next(i for i in meat["items"] if i["item_id"] == PIZZA)["allergens"] == [
        "wheat", "milk", "soybeans",
    ]
    # every item listed is on that day's menu, and every menu item is listed once
    on_menu = [r["item_id"] for r in rows("menu.csv") if r["date"] == "2026-10-21"]
    listed = [i["item_id"] for g in body["groups"] for i in g["items"]]
    assert sorted(listed) == sorted(on_menu)


def test_get_tray_device_is_optional(client):
    assert tray(client, "device-0001", D1).status_code == 200
    body = get_tray(client).json()
    assert body["picks"] is None and body["tally"] is None
    assert body["groups"] == GROUPS_1020


def test_get_tray_invalid_device_is_400(client):
    assert_error(get_tray(client, "bad device"), 400, E_DEVICE)


def test_friday_tray_targets_monday(client):
    body = get_tray(client, "device-0001", date="2026-10-23").json()
    assert body["open_date"] == "2026-10-23"
    assert body["target_date"] == "2026-10-26"


def test_weekend_tray_targets_next_menu_day(client):
    # strictly after today, first date in the menu table: Sat 10-24 and Sun 10-25 both give Mon 10-26
    for weekend_day in ("2026-10-24", "2026-10-25"):
        body = get_tray(client, "device-0001", date=weekend_day).json()
        assert body["target_date"] == "2026-10-26", weekend_day


def test_tray_on_last_menu_day_is_404_for_get_and_post(client):
    # menu ends on 10-30, so there is nothing after it
    assert get_tray(client, "device-0001", date="2026-10-30").status_code == 404
    assert tray(client, "device-0001", D1, date="2026-10-30").status_code == 404
    assert get_tray(client, "device-0001", date="2026-10-29").json()["target_date"] == "2026-10-30"


def test_tray_after_the_menu_ends_is_404(client):
    assert get_tray(client, "device-0001", date="2026-12-01").status_code == 404


def test_tray_group_with_no_items_is_omitted_and_row_order_is_kept(monkeypatch, tmp_path):
    def edit(menu):
        out = [r for r in menu if not (r["date"] == TARGET and r["item_id"] == APPLE)]
        # put popcorn_chicken before chicken_tacos on the target day
        i = next(n for n, r in enumerate(out) if r["date"] == TARGET and r["item_id"] == TACOS)
        j = next(n for n, r in enumerate(out) if r["date"] == TARGET and r["item_id"] == POPCORN)
        out[i], out[j] = out[j], out[i]
        return out

    with make_custom_client(monkeypatch, tmp_path, edit) as client:
        body = get_tray(client, "device-0001").json()
        assert [g["component"] for g in body["groups"]] == [
            "meat_alternate", "grain", "vegetable", "milk",
        ]
        assert [i["item_id"] for i in body["groups"][0]["items"]] == [POPCORN, TACOS]
        # a key for the omitted group is not a food group of this tray
        four = {"meat_alternate": TACOS, "grain": ROLL, "vegetable": SALAD, "milk": MILK}
        with_fruit = dict(four, fruit=None)
        assert_error(tray(client, "device-0001", with_fruit), 400, E_GROUP)
        # the four listed groups are enough
        ok = tray(client, "device-0001", four)
        assert ok.status_code == 200, ok.text
        tally = ok.json()["tally"]
        assert [g["component"] for g in tally["groups"]] == [
            "meat_alternate", "grain", "vegetable", "milk",
        ]
        assert [i["item_id"] for i in tally["groups"][0]["items"]] == [POPCORN, TACOS]


# ----------------------------------------------------------- POST happy path


def test_post_tray_happy_path_shape_and_first_tally(client):
    response = tray(client, "device-0001", D1)
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"ok", "target_date", "streak", "xp", "tally", "simulated"}
    assert body["ok"] is True
    assert body["simulated"] is True
    assert body["target_date"] == TARGET
    assert body["streak"] == 1
    assert body["xp"] == 10
    assert_tally(body["tally"], TALLY_AFTER_1)


def test_three_device_tally_is_checked_by_hand(client):
    first = tray(client, "device-0001", D1).json()["tally"]
    second = tray(client, "device-0002", D2).json()["tally"]
    third = tray(client, "device-0003", D3).json()["tally"]
    assert_tally(first, TALLY_AFTER_1)
    assert_tally(second, TALLY_AFTER_2)
    assert_tally(third, TALLY_AFTER_3)
    # a few of the values written out by hand, so the literals above are not the only check
    assert third["total"] == 3
    meat = third["groups"][0]
    assert [(i["item_id"], i["picks"]) for i in meat["items"]] == [(TACOS, 2), (POPCORN, 1)]
    assert meat["items"][0]["share"] == pytest.approx(2 / 3)
    assert meat["items"][1]["share"] == pytest.approx(1 / 3)
    assert meat["skips"] == 0
    veg = third["groups"][2]
    assert veg["skips"] == 2
    assert veg["items"][0]["picks"] == 1 and veg["items"][0]["share"] == pytest.approx(1 / 3)
    milk = third["groups"][4]
    assert milk["skips"] == 1 and milk["items"][0]["share"] == pytest.approx(2 / 3)
    # in every group, picks plus skips equals the number of devices
    for group in third["groups"]:
        assert sum(i["picks"] for i in group["items"]) + group["skips"] == 3


def test_tally_lists_every_item_even_with_zero_picks(client):
    tally = tray(client, "device-0001", D1).json()["tally"]
    popcorn = tally["groups"][0]["items"][1]
    assert popcorn["item_id"] == POPCORN
    assert popcorn["picks"] == 0 and popcorn["share"] == 0


def test_a_single_pick_is_enough(client):
    only_milk = {"meat_alternate": None, "grain": None, "vegetable": None, "fruit": None, "milk": MILK}
    response = tray(client, "device-0001", only_milk)
    assert response.status_code == 200, response.text
    tally = response.json()["tally"]
    assert tally["total"] == 1
    assert [g["skips"] for g in tally["groups"]] == [1, 1, 1, 1, 0]


def test_get_after_packing_returns_picks_and_tally(client):
    tray(client, "device-0001", D1)
    tray(client, "device-0002", D2)
    body = get_tray(client, "device-0001").json()
    assert body["picks"] == D1
    assert_tally(body["tally"], TALLY_AFTER_2)
    other = get_tray(client, "device-0002").json()
    assert other["picks"] == D2
    assert_tally(other["tally"], TALLY_AFTER_2)
    assert body["groups"] == GROUPS_1020


def test_unpacked_device_sees_no_picks_and_no_tally_even_when_others_packed(client):
    tray(client, "device-0001", D1)
    body = get_tray(client, "device-0009").json()
    assert body["picks"] is None
    assert body["tally"] is None


def test_get_tally_grows_as_more_devices_pack(client):
    tray(client, "device-0001", D1)
    assert get_tray(client, "device-0001").json()["tally"]["total"] == 1
    tray(client, "device-0002", D2)
    tray(client, "device-0003", D3)
    assert_tally(get_tray(client, "device-0001").json()["tally"], TALLY_AFTER_3)


# ------------------------------------------------------- 400 validation, in order


def test_invalid_device_message(client):
    assert_error(tray(client, "bad device", D1), 400, E_DEVICE)
    # a body with no device field at all is also a 400 (the message comes from the body check)
    assert client.post("/api/tray", json={"picks": D1}).status_code == 400


def test_invalid_device_is_checked_before_picks(client):
    assert_error(tray(client, "bad device", "not an object"), 400, E_DEVICE)
    assert_error(tray(client, "bad device", {"dessert": "cake"}), 400, E_DEVICE)


@pytest.mark.parametrize("bad", [None, [], ["meat_alternate"], "text", 7, True])
def test_picks_must_be_an_object(client, bad):
    assert_error(tray(client, "device-0001", bad), 400, E_PICKS)


def test_picks_missing_entirely(client):
    response = client.post("/api/tray", json={"device": "device-0001"})
    assert_error(response, 400, E_PICKS)


def test_picks_is_checked_before_unknown_group(client):
    # a list cannot name groups, so this is the picks message, not the group message
    assert_error(tray(client, "device-0001", [{"dessert": "cake"}]), 400, E_PICKS)


def test_unknown_food_group_message(client):
    assert_error(tray(client, "device-0001", D1 | {"dessert": TACOS}), 400, E_GROUP)
    assert_error(tray(client, "device-0001", D1 | {"Milk": MILK}), 400, E_GROUP)
    assert_error(tray(client, "device-0001", {"dessert": None}), 400, E_GROUP)


def test_unknown_group_is_checked_before_missing_group(client):
    partial_with_extra = {"meat_alternate": TACOS, "dessert": None}
    assert_error(tray(client, "device-0001", partial_with_extra), 400, E_GROUP)


def test_every_group_must_be_picked_or_skipped(client):
    for component in COMPONENTS:
        short = {k: v for k, v in D1.items() if k != component}
        assert_error(tray(client, "device-0001", short), 400, E_MISSING)
    assert_error(tray(client, "device-0001", {}), 400, E_MISSING)


def test_missing_group_is_checked_before_a_bad_food(client):
    short_and_wrong = {"meat_alternate": "no_such_item"}
    assert_error(tray(client, "device-0001", short_and_wrong), 400, E_MISSING)


@pytest.mark.parametrize(
    "component, bad",
    [
        ("meat_alternate", "no_such_item"),   # not an item at all
        ("meat_alternate", ROLL),             # real item, wrong group
        ("meat_alternate", PIZZA),            # real meat item, but not on the 10-20 menu
        ("grain", TACOS),                     # wrong group the other way round
        ("milk", ""),                         # empty string is not an item
        ("fruit", 5),                         # not a string
        ("fruit", True),                      # not a string
        ("vegetable", [SALAD]),               # list, not a string
        ("grain", {"item_id": ROLL}),         # object, not a string
    ],
)
def test_food_not_on_this_tray(client, component, bad):
    picks = dict(D1, **{component: bad})
    assert_error(tray(client, "device-0001", picks), 400, E_NOT_ON_TRAY)


def test_bad_food_is_checked_before_pick_at_least_one(client):
    all_null_but_one_bad = {c: None for c in COMPONENTS} | {"fruit": "no_such_item"}
    assert_error(tray(client, "device-0001", all_null_but_one_bad), 400, E_NOT_ON_TRAY)


def test_all_skips_needs_at_least_one_food(client):
    assert_error(tray(client, "device-0001", {c: None for c in COMPONENTS}), 400, E_NONE)


def test_failed_validation_stores_nothing(client):
    assert tray(client, "device-0001", {c: None for c in COMPONENTS}).status_code == 400
    assert tray(client, "device-0001", D1 | {"fruit": "no_such_item"}).status_code == 400
    body = get_tray(client, "device-0001").json()
    assert body["picks"] is None and body["tally"] is None
    ok = tray(client, "device-0001", D1)
    assert ok.status_code == 200
    assert ok.json()["tally"]["total"] == 1
    assert me(client, "device-0001").json()["xp"] == 10


def test_malformed_json_body_is_400(client):
    response = client.post(
        "/api/tray", content="not-json", headers={"content-type": "application/json"}
    )
    assert response.status_code == 400
    assert isinstance(response.json()["error"], str)


# ------------------------------------------------------------------- 409


def test_second_tray_same_day_is_409(client):
    assert tray(client, "device-0001", D1).status_code == 200
    again = tray(client, "device-0001", D1)
    assert_error(again, 409, E_DUP)
    different = tray(client, "device-0001", D2)
    assert_error(different, 409, E_DUP)
    # the first tray is untouched and the tally did not move
    body = get_tray(client, "device-0001").json()
    assert body["picks"] == D1
    assert body["tally"]["total"] == 1
    assert me(client, "device-0001").json()["xp"] == 10


def test_validation_comes_before_the_409(client):
    assert tray(client, "device-0001", D1).status_code == 200
    assert_error(tray(client, "device-0001", {c: None for c in COMPONENTS}), 400, E_NONE)
    assert_error(tray(client, "device-0001", D1 | {"fruit": "no_such_item"}), 400, E_NOT_ON_TRAY)
    assert_error(tray(client, "device-0001", {}), 400, E_MISSING)


def test_tray_on_a_different_demo_date_is_allowed(client):
    assert tray(client, "device-0001", D1, date=TODAY).status_code == 200
    next_day = tray(client, "device-0001", D1, date="2026-10-20")
    assert next_day.status_code == 200, next_day.text
    assert next_day.json()["target_date"] == "2026-10-21"
    # the same day twice is still blocked
    assert tray(client, "device-0001", D1, date="2026-10-20").status_code == 409


def test_tally_is_per_open_date(client):
    tray(client, "device-0001", D1, date=TODAY)
    tray(client, "device-0002", D2, date=TODAY)
    # device 3 packs the next day: its tally counts only that day's trays
    on_20 = tray(client, "device-0003", dict(D3, meat_alternate=PIZZA), date="2026-10-20")
    assert on_20.status_code == 200, on_20.text
    tally = on_20.json()["tally"]
    assert tally["target_date"] == "2026-10-21"
    assert tally["total"] == 1
    # and the first day still shows its own two
    assert get_tray(client, "device-0001", date=TODAY).json()["tally"]["total"] == 2


def test_get_on_another_day_shows_no_picks_for_that_day(client):
    tray(client, "device-0001", D1, date=TODAY)
    other_day = get_tray(client, "device-0001", date="2026-10-20").json()
    assert other_day["open_date"] == "2026-10-20"
    assert other_day["target_date"] == "2026-10-21"
    assert other_day["picks"] is None and other_day["tally"] is None
    again = get_tray(client, "device-0001", date=TODAY).json()
    assert again["picks"] == D1


def test_tray_and_vote_do_not_block_each_other(client):
    assert tray(client, "device-0001", D1).status_code == 200
    assert vote(client, "device-0001").status_code == 200
    assert vote(client, "device-0002").status_code == 200
    assert tray(client, "device-0002", D2).status_code == 200


# ------------------------------------------------------------ schools


def test_unknown_school_is_404(client):
    assert get_tray(client, "device-0001", school="nowhere").status_code == 404
    assert tray(client, "device-0001", D1, school="nowhere").status_code == 404


def test_default_school_is_demo(client):
    tray(client, "device-0001", D1)
    explicit = get_tray(client, "device-0001", school="demo").json()
    assert explicit["picks"] == D1
    assert explicit["tally"]["total"] == 1


def test_trays_are_isolated_between_schools(client):
    assert tray(client, "device-0001", D1, school="demo").status_code == 200
    # the same device has not packed at the other school
    live_before = get_tray(client, "device-0001", school="live").json()
    assert live_before["picks"] is None and live_before["tally"] is None
    live = tray(client, "device-0001", D3, school="live")
    assert live.status_code == 200, live.text
    live_tally = live.json()["tally"]
    assert live_tally["total"] == 1
    assert live_tally["groups"][0]["items"][1]["picks"] == 1  # popcorn, from D3 at live
    demo_tally = get_tray(client, "device-0001", school="demo").json()
    assert demo_tally["picks"] == D1
    assert demo_tally["tally"]["total"] == 1
    assert demo_tally["tally"]["groups"][0]["items"][0]["picks"] == 1  # tacos, from D1 at demo
    assert demo_tally["tally"]["groups"][0]["items"][1]["picks"] == 0
    # a second tray at demo is still blocked, at live too
    assert tray(client, "device-0001", D1, school="demo").status_code == 409
    assert tray(client, "device-0001", D1, school="live").status_code == 409


def test_live_school_ignores_demo_date_header(client):
    first = tray(client, "device-live-0001", D1, school="live", date="2026-10-23")
    assert first.status_code == 200, first.text
    assert first.json()["target_date"] == TARGET  # today is 10-19, not the header's Friday
    second = tray(client, "device-live-0001", D1, school="live", date="2026-10-20")
    assert second.status_code == 409
    got = get_tray(client, "device-live-0001", school="live", date="2026-10-26").json()
    assert got["open_date"] == TODAY
    assert got["target_date"] == TARGET
    assert got["picks"] == D1


def test_live_school_ignores_a_garbage_demo_date_header(client):
    body = get_tray(client, school="live", date="not-a-date")
    assert body.status_code == 200
    assert body.json()["open_date"] == TODAY


def test_demo_school_follows_demo_date_header(client):
    body = get_tray(client, "device-0001", date="2026-10-22").json()
    assert body["open_date"] == "2026-10-22"
    assert body["target_date"] == "2026-10-23"


# ------------------------------------------------------------------ stats


def test_tray_alone_keeps_a_streak_over_consecutive_school_days(client):
    device = "streak-tray-01"
    for number, open_date in enumerate(("2026-10-19", "2026-10-20", "2026-10-21"), start=1):
        response = tray(client, device, auto_picks(open_date), date=open_date)
        assert response.status_code == 200, response.text
        assert response.json()["streak"] == number
        assert response.json()["xp"] == 10 * number
    result = me(client, device, date="2026-10-21").json()
    assert result["streak"] == 3
    assert result["xp"] == 30
    assert "streak_3" in result["badges"]
    # the badge stays after the streak breaks
    broken = me(client, device, date="2026-10-23").json()
    assert broken["streak"] == 0
    assert "streak_3" in broken["badges"]


def test_tray_streak_crosses_a_weekend(client):
    device = "streak-tray-02"
    assert tray(client, device, D1, date="2026-10-23").json()["streak"] == 1
    assert me(client, device, date="2026-10-25").json()["streak"] == 1
    monday = tray(client, device, D1, date="2026-10-26")
    assert monday.status_code == 200
    assert monday.json()["streak"] == 2


def test_tray_streak_breaks_on_a_missed_school_day(client):
    device = "streak-tray-03"
    tray(client, device, D1, date="2026-10-19")
    skipped = tray(client, device, auto_picks("2026-10-21"), date="2026-10-21")  # nothing on 10-20
    assert skipped.json()["streak"] == 1
    assert me(client, device, date="2026-10-21").json()["streak"] == 1


def test_votes_and_trays_chain_into_one_streak(client):
    device = "streak-mixed-01"
    assert vote(client, device, date="2026-10-19").json()["streak"] == 1
    assert tray(client, device, D1, date="2026-10-20").json()["streak"] == 2
    assert vote(client, device, date="2026-10-21").json()["streak"] == 3
    after_tray = tray(client, device, D1, date="2026-10-22")
    assert after_tray.json()["streak"] == 4
    result = me(client, device, date="2026-10-22").json()
    assert result["streak"] == 4
    # two votes (10-19, 10-21) plus two trays (10-20, 10-22), 10 XP each
    assert result["xp"] == 40


def test_vote_and_tray_on_the_same_day_count_as_one_active_day_and_both_give_xp(client):
    device = "streak-mixed-02"
    assert vote(client, device, date=TODAY).json()["xp"] == 10
    after = tray(client, device, D1, date=TODAY)
    assert after.json()["streak"] == 1
    assert after.json()["xp"] == 20
    result = me(client, device, date=TODAY).json()
    assert result["streak"] == 1
    assert result["xp"] == 20


def test_tray_after_a_vote_in_the_other_order_gives_same_numbers(client):
    device = "streak-mixed-03"
    assert tray(client, device, D1, date=TODAY).json()["xp"] == 10
    after = vote(client, device, date=TODAY)
    assert after.json()["streak"] == 1
    assert after.json()["xp"] == 20


def test_weekend_gap_chains_a_friday_tray_with_a_monday_vote(client):
    device = "streak-mixed-04"
    assert tray(client, device, D1, date="2026-10-23").status_code == 200
    monday = vote(client, device, date="2026-10-26")
    assert monday.status_code == 200
    assert monday.json()["streak"] == 2


def test_xp_adds_ten_per_tray(client):
    device = "xp-tray-01"
    for number, open_date in enumerate(("2026-10-19", "2026-10-22", "2026-10-26"), start=1):
        response = tray(client, device, D2, date=open_date)
        assert response.json()["xp"] == 10 * number
    assert me(client, device, date="2026-10-26").json()["xp"] == 30


def test_xp_combines_votes_trays_and_a_correct_guess(client):
    device = "xp-mixed-01"
    meat = [
        r for r in rows("future_meals.csv")
        if r["date"] == TARGET and r["component"] == "meat_alternate"
    ]
    top = max(int(r["servings_taken"]) for r in meat)
    winner = next(r["item_id"] for r in meat if int(r["servings_taken"]) == top)
    guess = client.post("/api/guess", json={"device": device, "item_id": winner})
    assert guess.status_code == 200
    assert vote(client, device, date=TODAY).status_code == 200
    assert tray(client, device, D1, date=TODAY).status_code == 200
    # 10 for the vote, 10 for the tray, 25 for the correct guess once 10-20 has come
    assert me(client, device, date="2026-10-21").json()["xp"] == 45


def test_seven_day_run_of_mixed_trays_and_votes_earns_streak_seven(client):
    device = "streak-seven-01"
    days = ("2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22",
            "2026-10-23", "2026-10-26", "2026-10-27")
    for number, open_date in enumerate(days[:6]):
        if number % 2 == 0:
            assert tray(client, device, auto_picks(open_date), date=open_date).status_code == 200
        else:
            assert vote(client, device, date=open_date).status_code == 200
    six = me(client, device, date=days[5]).json()
    assert six["streak"] == 6
    assert "streak_7" not in six["badges"]
    assert tray(client, device, auto_picks(days[6]), date=days[6]).status_code == 200  # a tray gives the seventh day
    seven = me(client, device, date=days[6]).json()
    assert seven["streak"] == 7
    assert "streak_7" in seven["badges"]


def test_streak_ignores_trays_later_than_the_demo_clock(client):
    device = "streak-rewind-01"
    assert tray(client, device, auto_picks("2026-10-21"), date="2026-10-21").status_code == 200
    assert me(client, device, date="2026-10-21").json()["streak"] == 1
    assert me(client, device, date="2026-10-19").json()["streak"] == 0


def test_a_tray_at_another_school_does_not_make_a_streak_here(client):
    device = "streak-school-01"
    assert tray(client, device, D1, school="live").status_code == 200
    assert me(client, device).json()["streak"] == 0
    assert me(client, device, school="live").json()["streak"] == 1


def test_a_device_with_no_trays_behaves_as_before(client):
    device = "streak-plain-01"
    assert vote(client, device, date="2026-10-19").json() == {
        "ok": True, "streak": 1, "xp": 10,
        "tally": {TACOS: 1, PIZZA: 0, POPCORN: 0}, "simulated": True,
    }
    result = me(client, device, date="2026-10-19").json()
    assert result["streak"] == 1 and result["xp"] == 10


# ------------------------------------------------------------------ /api/me


def test_me_voted_today_and_packed_today(client):
    device = "me-flags-01"
    fresh = me(client, device).json()
    assert fresh["voted_today"] is False
    assert fresh["packed_today"] is False
    assert vote(client, device).status_code == 200
    voted = me(client, device).json()
    assert voted["voted_today"] is True
    assert voted["packed_today"] is False
    assert tray(client, device, D1).status_code == 200
    both = me(client, device).json()
    assert both["voted_today"] is True
    assert both["packed_today"] is True


def test_me_packed_today_without_a_vote(client):
    device = "me-flags-02"
    assert tray(client, device, D1).status_code == 200
    result = me(client, device).json()
    assert result["packed_today"] is True
    assert result["voted_today"] is False


def test_me_flags_follow_the_demo_date_and_school(client):
    device = "me-flags-03"
    vote(client, device, date=TODAY)
    tray(client, device, D1, date=TODAY)
    next_day = me(client, device, date="2026-10-20").json()
    assert next_day["voted_today"] is False and next_day["packed_today"] is False
    other_school = me(client, device, school="live").json()
    assert other_school["voted_today"] is False and other_school["packed_today"] is False
    assert me(client, device, date=TODAY).json()["packed_today"] is True


def test_me_keeps_its_old_keys(client):
    result = me(client, "me-flags-04").json()
    assert {"device", "streak", "xp", "badges", "last_guess", "simulated"} <= set(result)


# ------------------------------------------------------------- admin summary


def test_admin_summary_tray_is_null_before_and_filled_after(client):
    token = admin_token(client)
    before = summary(client, token)
    assert "tray" in before
    assert before["tray"] is None
    tray(client, "device-0001", D1)
    tray(client, "device-0002", D2)
    tray(client, "device-0003", D3)
    after = summary(client, token)
    assert_tally(after["tray"], TALLY_AFTER_3)


def test_admin_summary_tray_follows_the_demo_date(client):
    token = admin_token(client)
    tray(client, "device-0001", D1, date=TODAY)
    assert summary(client, token, date=TODAY)["tray"]["total"] == 1
    # trays are counted for the day they were packed, so the next day starts empty
    assert summary(client, token, date="2026-10-20")["tray"] is None


def test_admin_summary_tray_is_per_school(client):
    token = admin_token(client)
    tray(client, "device-0001", D1, school="live")
    assert summary(client, token)["tray"] is None
    tray(client, "device-0002", D2, school="demo")
    assert summary(client, token)["tray"]["total"] == 1


def test_admin_summary_other_keys_are_still_there(client):
    token = admin_token(client)
    tray(client, "device-0001", D1)
    keys = set(summary(client, token))
    assert {"tray", "vote"} <= keys


# ------------------------------------------------------------------- events


def test_tray_makes_one_tray_event_with_summary_and_detail(client):
    before = client.get("/api/events").json()["latest_id"]
    assert tray(client, "device-0001", D1).status_code == 200
    new = client.get("/api/events", params={"after": before}).json()["events"]
    assert [e["kind"] for e in new] == ["tray"]
    event = new[0]
    assert event["school_id"] == "demo"
    assert event["summary"] == f"A player packed a tray for {TARGET}"
    # D1 picks four foods (tacos, roll, salad, milk) and skips fruit
    assert event["detail"] == {"picked": 4, "total": 1}
    assert re.fullmatch(r"[0-9a-f]{6}", event["player"])
    assert isinstance(event["ms"], (int, float)) and event["ms"] >= 0
    assert "device-0001" not in str(event)


def test_tray_event_counts_picked_and_total_by_hand(client):
    # D2 picks tacos, roll, apple: three foods. D3 picks popcorn and milk: two foods.
    tray(client, "device-0001", D1)
    tray(client, "device-0002", D2)
    tray(client, "device-0003", D3)
    tray_events = [e for e in events(client) if e["kind"] == "tray"]
    assert [e["detail"] for e in tray_events] == [
        {"picked": 4, "total": 1},
        {"picked": 3, "total": 2},
        {"picked": 2, "total": 3},
    ]


def test_tray_event_is_tagged_with_its_school(client):
    before = client.get("/api/events").json()["latest_id"]
    tray(client, "device-0001", D1, school="live")
    new = client.get("/api/events", params={"after": before}).json()["events"]
    assert [e["kind"] for e in new] == ["tray"]
    assert new[0]["school_id"] == "live"


def test_tray_event_player_tag_matches_the_same_devices_vote_event(client):
    vote(client, "device-0001")
    tray(client, "device-0001", D1)
    by_kind = {e["kind"]: e for e in events(client)}
    assert by_kind["tray"]["player"] == by_kind["vote"]["player"]


def test_a_rejected_tray_makes_no_tray_event(client):
    tray(client, "device-0001", D1)
    tray(client, "device-0001", D1)  # 409
    tray(client, "device-0002", {c: None for c in COMPONENTS})  # 400
    assert [e["kind"] for e in events(client)].count("tray") == 1


# ------------------------------------------------------------------- limits


def test_trays_count_toward_the_vote_and_guess_limit(monkeypatch, tmp_path):
    with TestClient(limited_app(monkeypatch, tmp_path, vote_limit=2)) as client:
        assert tray(client, "device-0001", D1).status_code == 200
        assert tray(client, "device-0002", D2).status_code == 200
        blocked = tray(client, "device-0003", D3)
        assert blocked.status_code == 429
        assert blocked.json() == SLOW


def test_trays_votes_and_guesses_share_one_budget(monkeypatch, tmp_path):
    with TestClient(limited_app(monkeypatch, tmp_path, vote_limit=3)) as client:
        assert tray(client, "device-0001", D1).status_code == 200
        assert vote(client, "device-0002").status_code == 200
        guess = client.post("/api/guess", json={"device": "device-0003", "item_id": TACOS})
        assert guess.status_code == 200
        assert tray(client, "device-0004", D2).status_code == 429
        assert vote(client, "device-0004").status_code == 429


def test_a_spent_vote_budget_blocks_the_tray_too(monkeypatch, tmp_path):
    with TestClient(limited_app(monkeypatch, tmp_path, vote_limit=1)) as client:
        assert vote(client, "device-0001").status_code == 200
        assert tray(client, "device-0001", D1).status_code == 429


def test_reading_the_tray_does_not_use_up_the_budget(monkeypatch, tmp_path):
    app = limited_app(monkeypatch, tmp_path, request_limit=1000, vote_limit=2)
    with TestClient(app) as client:
        for _ in range(10):
            assert get_tray(client, "device-0001").status_code == 200
        assert tray(client, "device-0001", D1).status_code == 200
        assert tray(client, "device-0002", D2).status_code == 200
        assert tray(client, "device-0003", D3).status_code == 429
