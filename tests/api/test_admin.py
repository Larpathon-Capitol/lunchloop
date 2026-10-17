"""Black-box tests for school accounts: sign-in, tokens, summary, isolation.

Expected values come from docs/backend-contract.md ("School accounts") and the
sample CSVs, worked out by hand. The secret and password hashes are built here
with hashlib/hmac, not with the code under test.
"""

import base64
import csv
import hashlib
import hmac
import json
import shutil
import sqlite3
import time
from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

DATA = Path(__file__).resolve().parents[2] / "data" / "sample"
SECRET = "unit-test-secret"
TACOS, PIZZA, POPCORN = "chicken_tacos", "cheese_pizza", "popcorn_chicken"
WRONG_BODY = {"error": "wrong school or password"}


def pbkdf2_hash(password, iterations=200_000, salt=bytes(range(16))):
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}"


DEMO_HASH = pbkdf2_hash("demo-secret-pw")
NORTH_HASH = pbkdf2_hash("north-secret-pw", salt=bytes(range(16, 32)))


def b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def sign(raw, secret=SECRET):
    return hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()


def craft_token(school_id, exp, secret=SECRET):
    raw = b64(json.dumps({"s": school_id, "exp": exp}).encode())
    return f"{raw}.{sign(raw, secret)}"


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def day(date):
    return {"X-Demo-Date": date}


@pytest.fixture(autouse=True)
def fixed_secret(monkeypatch):
    import api.auth

    monkeypatch.setenv("LUNCHLOOP_SECRET", SECRET)
    monkeypatch.delenv("LUNCHLOOP_SCHOOL_PASSWORDS", raising=False)
    # the secret is cached per process; clear it so the env value above is used
    monkeypatch.setattr(api.auth, "_SECRET", None)


def make_client(monkeypatch, tmp_path, data_dir=DATA, db_name="t.db"):
    monkeypatch.setenv("LUNCHLOOP_DATA_DIR", str(data_dir))
    monkeypatch.setenv("LUNCHLOOP_DB", str(tmp_path / db_name))
    monkeypatch.setenv("LUNCHLOOP_TODAY", "2026-10-19")
    from api.main import create_app

    return TestClient(create_app())


def write_schools(data_dir, rows):
    with (data_dir / "schools.csv").open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["school_id", "name", "students"])
        writer.writerows(rows)


@pytest.fixture
def two_schools(monkeypatch, tmp_path):
    data_dir = tmp_path / "data"
    shutil.copytree(DATA, data_dir)
    write_schools(
        data_dir,
        [
            ["demo", "Simulated high school", "2750"],
            ["north-high", "North High", "900"],
            ["nohash", "No Password School", "100"],
        ],
    )
    monkeypatch.setenv("LUNCHLOOP_SCHOOL_PASSWORDS", f"north-high={NORTH_HASH}")
    with make_client(monkeypatch, tmp_path, data_dir) as c:
        yield c


def login(client, school_id="demo", password="lunchloop"):
    return client.post("/api/admin/login", json={"school_id": school_id, "password": password})


def token_for(client, school_id="demo", password="lunchloop"):
    response = login(client, school_id, password)
    assert response.status_code == 200, response.text
    return response.json()["token"]


def summary(client, token, date=None):
    headers = bearer(token)
    if date:
        headers |= day(date)
    return client.get("/api/admin/summary", headers=headers)


def vote(client, device, item, date=None, school=None):
    body = {"device": device, "item_id": item}
    if school is not None:
        body["school"] = school
    return client.post("/api/vote", json=body, headers=day(date) if date else {})


def guess(client, device, item, date=None, school=None):
    body = {"device": device, "item_id": item}
    if school is not None:
        body["school"] = school
    return client.post("/api/guess", json=body, headers=day(date) if date else {})


# ---------------------------------------------------------------- /api/schools


def test_schools_lists_demo_with_public_password(client):
    response = client.get("/api/schools")
    assert response.status_code == 200
    assert response.json() == {
        "schools": [
            {"school_id": "demo", "name": "Simulated high school", "demo_password": "lunchloop"},
            {"school_id": "live", "name": "LunchLoop live demo", "demo_password": None},
        ],
        "simulated": True,
    }


def test_schools_hides_demo_password_once_hash_configured(monkeypatch, tmp_path):
    monkeypatch.setenv("LUNCHLOOP_SCHOOL_PASSWORDS", f"demo={DEMO_HASH}")
    with make_client(monkeypatch, tmp_path) as c:
        body = c.get("/api/schools").json()
        assert body["schools"] == [
            {"school_id": "demo", "name": "Simulated high school", "demo_password": None},
            {"school_id": "live", "name": "LunchLoop live demo", "demo_password": None},
        ]
        assert login(c, "demo", "lunchloop").status_code == 401
        ok = login(c, "demo", "demo-secret-pw")
        assert ok.status_code == 200
        assert ok.json()["school"] == {"school_id": "demo", "name": "Simulated high school"}


def test_schools_lists_every_school_and_only_demo_has_public_password(two_schools):
    body = two_schools.get("/api/schools").json()
    by_id = {s["school_id"]: s for s in body["schools"]}
    assert set(by_id) == {"demo", "north-high", "nohash"}
    assert by_id["demo"]["demo_password"] == "lunchloop"
    assert by_id["north-high"]["demo_password"] is None
    assert by_id["nohash"]["demo_password"] is None
    assert by_id["north-high"]["name"] == "North High"
    assert body["simulated"] is True


def test_multiple_hashes_in_env_var(monkeypatch, tmp_path):
    data_dir = tmp_path / "data"
    shutil.copytree(DATA, data_dir)
    write_schools(data_dir, [["demo", "D", "10"], ["north-high", "N", "20"]])
    monkeypatch.setenv(
        "LUNCHLOOP_SCHOOL_PASSWORDS", f"demo={DEMO_HASH},north-high={NORTH_HASH}"
    )
    with make_client(monkeypatch, tmp_path, data_dir) as c:
        assert login(c, "demo", "demo-secret-pw").status_code == 200
        assert login(c, "north-high", "north-secret-pw").status_code == 200
        assert login(c, "north-high", "demo-secret-pw").status_code == 401


# ------------------------------------------------------------------- login


def test_demo_login_returns_token_school_and_12h_expiry(client):
    before = time.time()
    response = login(client)
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"token", "school", "expires_at", "simulated"}
    assert body["simulated"] is True
    assert body["school"] == {"school_id": "demo", "name": "Simulated high school"}
    expires_at = datetime.fromisoformat(body["expires_at"].replace("Z", "+00:00")).timestamp()
    assert abs(expires_at - (before + 12 * 3600)) < 60
    # token format from the contract: <base64url JSON payload>.<hex HMAC-SHA256>
    raw, signature = body["token"].split(".")
    assert signature == sign(raw)
    payload = json.loads(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)))
    assert payload == {"s": "demo", "exp": int(expires_at)}


def test_wrong_password_and_unknown_school_give_identical_401(client):
    wrong = login(client, "demo", "nope")
    unknown = login(client, "no-such-school", "lunchloop")
    assert wrong.status_code == 401 and unknown.status_code == 401
    assert wrong.json() == WRONG_BODY
    assert unknown.json() == WRONG_BODY


def test_school_without_hash_cannot_sign_in(two_schools):
    for password in ("lunchloop", "", "nohash"):
        response = login(two_schools, "nohash", password)
        assert response.status_code == 401
        assert response.json() == WRONG_BODY


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"school_id": "demo"},
        {"password": "lunchloop"},
        {"school_id": 5, "password": "lunchloop"},
        {"school_id": "demo", "password": None},
    ],
)
def test_login_missing_or_bad_fields_is_400(client, payload):
    response = client.post("/api/admin/login", json=payload)
    assert response.status_code == 400
    assert set(response.json()) == {"error"}


def test_login_non_json_body_is_400(client):
    response = client.post(
        "/api/admin/login", content="nope", headers={"content-type": "application/json"}
    )
    assert response.status_code == 400
    assert set(response.json()) == {"error"}


def test_configured_school_login_and_token_school(two_schools):
    ok = login(two_schools, "north-high", "north-secret-pw")
    assert ok.status_code == 200
    assert ok.json()["school"] == {"school_id": "north-high", "name": "North High"}
    assert login(two_schools, "north-high", "lunchloop").status_code == 401
    raw = ok.json()["token"].split(".")[0]
    payload = json.loads(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)))
    assert payload["s"] == "north-high"


# ----------------------------------------------------------- token checks


def test_summary_accepts_a_crafted_valid_token(client):
    # proves the crafting helper follows the contract, so the 401 cases below mean something
    response = summary(client, craft_token("demo", int(time.time()) + 3600))
    assert response.status_code == 200
    assert response.json()["school"]["school_id"] == "demo"


def test_summary_without_token_is_401(client):
    response = client.get("/api/admin/summary")
    assert response.status_code == 401
    assert set(response.json()) == {"error"}


@pytest.mark.parametrize(
    "header",
    ["Bearer", "Bearer ", "Bearer garbage", "Bearer a.b", "Bearer ..", "Token abc.def"],
)
def test_summary_malformed_token_is_401(client, header):
    response = client.get("/api/admin/summary", headers={"Authorization": header})
    assert response.status_code == 401
    assert set(response.json()) == {"error"}


def test_summary_token_without_bearer_prefix_is_401(client):
    token = craft_token("demo", int(time.time()) + 3600)
    response = client.get("/api/admin/summary", headers={"Authorization": token})
    assert response.status_code == 401


def test_summary_tampered_payload_is_401(two_schools):
    token = token_for(two_schools, "demo")
    _, signature = token.split(".")
    forged_raw = b64(json.dumps({"s": "north-high", "exp": int(time.time()) + 3600}).encode())
    response = summary(two_schools, f"{forged_raw}.{signature}")
    assert response.status_code == 401


def test_summary_tampered_signature_is_401(client):
    token = token_for(client)
    raw, signature = token.split(".")
    flipped = ("0" if signature[-1] != "0" else "1")
    for bad in (signature[:-1] + flipped, signature[:-4], "", "0" * 64):
        response = summary(client, f"{raw}.{bad}")
        assert response.status_code == 401


def test_summary_expired_token_is_401(client):
    response = summary(client, craft_token("demo", int(time.time()) - 10))
    assert response.status_code == 401


def test_summary_token_signed_with_other_secret_is_401(client):
    response = summary(client, craft_token("demo", int(time.time()) + 3600, secret="other"))
    assert response.status_code == 401


def test_summary_signed_but_unusable_payloads_are_401(client):
    for payload in (b"not json", json.dumps({"s": "demo"}).encode(), b"[1, 2]"):
        raw = b64(payload)
        response = summary(client, f"{raw}.{sign(raw)}")
        assert response.status_code == 401, payload


def test_summary_token_for_unknown_school_is_401(client):
    response = summary(client, craft_token("ghost", int(time.time()) + 3600))
    assert response.status_code == 401


def test_token_lasts_twelve_hours(client, monkeypatch):
    start = time.time()
    token = token_for(client)
    monkeypatch.setattr(time, "time", lambda: start + 11 * 3600 + 59 * 60)
    assert summary(client, token).status_code == 200
    monkeypatch.setattr(time, "time", lambda: start + 12 * 3600 + 120)
    assert summary(client, token).status_code == 401


# -------------------------------------------------------------- rate limit


def test_five_wrong_tries_then_sixth_is_429_even_with_right_password(two_schools):
    for _ in range(5):
        assert login(two_schools, "north-high", "wrong").status_code == 401
    blocked = login(two_schools, "north-high", "north-secret-pw")
    assert blocked.status_code == 429
    assert set(blocked.json()) == {"error"}
    # still blocked, and the public demo school is untouched
    assert login(two_schools, "north-high", "north-secret-pw").status_code == 429
    assert login(two_schools, "demo", "lunchloop").status_code == 200


def test_four_wrong_tries_do_not_block(two_schools):
    for _ in range(4):
        assert login(two_schools, "north-high", "wrong").status_code == 401
    assert login(two_schools, "north-high", "north-secret-pw").status_code == 200


def test_block_ends_after_ten_minutes(two_schools, monkeypatch):
    start = time.time()
    for _ in range(5):
        login(two_schools, "north-high", "wrong")
    assert login(two_schools, "north-high", "north-secret-pw").status_code == 429
    monkeypatch.setattr(time, "time", lambda: start + 10 * 60 + 5)
    assert login(two_schools, "north-high", "north-secret-pw").status_code == 200


def test_public_demo_password_school_is_never_429(client):
    for _ in range(20):
        assert login(client, "demo", "wrong").status_code == 401
    assert login(client, "demo", "lunchloop").status_code == 200


def test_demo_with_configured_hash_is_rate_limited(monkeypatch, tmp_path):
    monkeypatch.setenv("LUNCHLOOP_SCHOOL_PASSWORDS", f"demo={DEMO_HASH}")
    with make_client(monkeypatch, tmp_path) as c:
        for _ in range(5):
            assert login(c, "demo", "lunchloop").status_code == 401
        assert login(c, "demo", "demo-secret-pw").status_code == 429


# --------------------------------------------------------------- isolation


def test_votes_never_cross_schools(two_schools):
    c = two_schools
    token_a = token_for(c, "demo")
    token_b = token_for(c, "north-high", "north-secret-pw")
    for i in range(3):
        assert vote(c, f"demo-student-{i}", TACOS).status_code == 200
    assert vote(c, "north-student-0", POPCORN, school="north-high").status_code == 200
    assert vote(c, "north-student-1", POPCORN, school="north-high").status_code == 200

    a = summary(c, token_a).json()["vote"]
    b = summary(c, token_b).json()["vote"]
    assert a["total"] == 3
    assert {o["item_id"]: o["votes"] for o in a["options"]} == {TACOS: 3, PIZZA: 0, POPCORN: 0}
    assert b["total"] == 2
    assert {o["item_id"]: o["votes"] for o in b["options"]} == {TACOS: 0, PIZZA: 0, POPCORN: 2}
    sa = summary(c, token_a).json()
    sb = summary(c, token_b).json()
    assert sa["school"]["school_id"] == "demo" and sb["school"]["school_id"] == "north-high"
    assert (sa["players"]["total"], sa["players"]["voted_today"]) == (3, 3)
    assert {k: sb["players"][k] for k in ("total", "voted_today")} == {"total": 2, "voted_today": 2}


def test_guesses_and_players_are_per_school(two_schools):
    c = two_schools
    token_a = token_for(c, "demo")
    token_b = token_for(c, "north-high", "north-secret-pw")
    assert guess(c, "guesser-0001", TACOS, school="north-high").status_code == 200
    assert summary(c, token_a).json()["guesses"] is None
    assert summary(c, token_a).json()["players"]["total"] == 0
    assert summary(c, token_b).json()["guesses"] == {
        "target_date": "2026-10-20",
        "total": 1,
        "items": [{"item_id": TACOS, "name": "Chicken tacos", "guesses": 1}],
    }


def test_same_device_can_vote_once_in_each_school(two_schools):
    c = two_schools
    assert vote(c, "shared-device", TACOS, school="demo").status_code == 200
    assert vote(c, "shared-device", TACOS, school="north-high").status_code == 200
    assert vote(c, "shared-device", TACOS, school="north-high").status_code == 409
    assert vote(c, "shared-device", TACOS).status_code == 409  # omitted school is demo
    assert c.get("/api/spin", params={"device": "shared-device"}).json()["already_voted"] is True
    other = c.get("/api/spin", params={"device": "fresh-device-1", "school": "north-high"})
    assert other.json()["already_voted"] is False
    me = c.get("/api/me", params={"device": "shared-device", "school": "north-high"}).json()
    assert me["xp"] == 10 and me["streak"] == 1


def test_omitting_school_is_demo(two_schools):
    c = two_schools
    assert vote(c, "omit-device-1", PIZZA).status_code == 200
    assert vote(c, "omit-device-1", PIZZA, school="demo").status_code == 409
    token = token_for(c, "demo")
    assert summary(c, token).json()["vote"]["total"] == 1
    assert summary(c, token_for(c, "north-high", "north-secret-pw")).json()["vote"]["total"] == 0
    spin = c.get("/api/spin", params={"device": "omit-device-1", "school": "demo"})
    assert spin.json()["already_voted"] is True


def test_unknown_school_is_404_on_every_student_route(two_schools):
    c = two_schools
    responses = [
        c.get("/api/spin", params={"device": "device-0001", "school": "ghost"}),
        c.get("/api/me", params={"device": "device-0001", "school": "ghost"}),
        vote(c, "device-0001", TACOS, school="ghost"),
        guess(c, "device-0001", TACOS, school="ghost"),
    ]
    for response in responses:
        assert response.status_code == 404
        assert set(response.json()) == {"error"}
    # a rejected request must not create anything for the real schools
    assert summary(c, token_for(c)).json()["players"]["total"] == 0


# --------------------------------------------------------- summary numbers


def test_summary_empty_day(client):
    body = summary(client, token_for(client)).json()
    assert body["simulated"] is True
    assert body["today"] == "2026-10-19"
    assert body["school"] == {"school_id": "demo", "name": "Simulated high school", "students": 2750}
    assert body["vote"] == {
        "target_date": "2026-10-30",
        "target_slot": "entree",
        "total": 0,
        "options": [
            {"item_id": TACOS, "name": "Chicken tacos", "votes": 0, "share": 0},
            {"item_id": PIZZA, "name": "Cheese pizza", "votes": 0, "share": 0},
            {"item_id": POPCORN, "name": "Popcorn chicken", "votes": 0, "share": 0},
        ],
    }
    assert body["recent_votes"] == []
    assert body["past_winners"] == []  # the sample meals.csv has no vote_share rows
    assert body["guesses"] is None
    assert body["players"] == {"total": 0, "voted_today": 0, "voted_last_5_days": 0}


def test_summary_vote_is_null_on_a_day_without_voting(client):
    body = summary(client, token_for(client), date="2026-10-16").json()
    assert body["today"] == "2026-10-16"
    assert body["vote"] is None


def test_summary_counts_and_shares(client):
    token = token_for(client)
    for i in range(3):
        assert vote(client, f"voter-tacos-{i}", TACOS).status_code == 200
    assert vote(client, "voter-pizza-0", PIZZA).status_code == 200
    client.get("/api/spin", params={"device": "only-looked-1"})  # a player who never votes
    body = summary(client, token).json()
    assert body["vote"]["total"] == 4
    assert body["vote"]["target_date"] == "2026-10-30"
    assert [(o["item_id"], o["votes"], o["share"]) for o in body["vote"]["options"]] == [
        (TACOS, 3, 0.75),
        (PIZZA, 1, 0.25),
        (POPCORN, 0, 0),
    ]
    assert [o["name"] for o in body["vote"]["options"]] == [
        "Chicken tacos", "Cheese pizza", "Popcorn chicken"
    ]
    assert body["players"]["total"] == 5 and body["players"]["voted_today"] == 4
    assert body["recent_votes"] == []  # today's votes are not "recent"


def test_summary_guess_counts_most_guessed_first(client):
    token = token_for(client)
    for i in range(3):
        assert guess(client, f"guess-popcorn-{i}", POPCORN).status_code == 200
    assert guess(client, "guess-tacos-0001", TACOS).status_code == 200
    # a guess made on an earlier day is not part of today's list
    assert guess(client, "guess-old-0001", PIZZA, date="2026-10-16").status_code == 200
    body = summary(client, token).json()
    assert body["guesses"] == {
        "target_date": "2026-10-20",
        "total": 4,
        "items": [
            {"item_id": POPCORN, "name": "Popcorn chicken", "guesses": 3},
            {"item_id": TACOS, "name": "Chicken tacos", "guesses": 1},
        ],
    }


def test_summary_guesses_null_when_none_made_today(client):
    assert guess(client, "guess-old-0001", PIZZA, date="2026-10-16").status_code == 200
    assert summary(client, token_for(client)).json()["guesses"] is None


def test_recent_votes_reflect_earlier_vote_day(client):
    token = token_for(client)
    # 2026-10-19: tacos x2, pizza x1 (open_date 10-19, target 10-30)
    for device, item in (("early-a-0001", TACOS), ("early-b-0001", TACOS), ("early-c-0001", PIZZA)):
        assert vote(client, device, item, date="2026-10-19").status_code == 200
    # 2026-10-20: popcorn x1
    assert vote(client, "late-a-00001", POPCORN, date="2026-10-20").status_code == 200

    body = summary(client, token, date="2026-10-21").json()
    assert body["vote"]["total"] == 0
    assert body["recent_votes"] == [
        {
            "open_date": "2026-10-20",
            "target_date": "2026-10-30",
            "total": 1,
            "winner": {"item_id": POPCORN, "name": "Popcorn chicken", "votes": 1},
        },
        {
            "open_date": "2026-10-19",
            "target_date": "2026-10-30",
            "total": 3,
            "winner": {"item_id": TACOS, "name": "Chicken tacos", "votes": 2},
        },
    ]
    # viewed on 10-19 itself the same votes are "today", not recent
    same_day = summary(client, token, date="2026-10-19").json()
    assert same_day["recent_votes"] == []
    assert same_day["vote"]["total"] == 3


def test_recent_votes_skip_days_without_votes_and_cap_at_ten(client):
    token = token_for(client)
    vote_days = [
        "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23",
        "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30",
    ]
    for i, d in enumerate(vote_days):
        assert vote(client, f"daily-voter-{i:02d}", PIZZA, date=d).status_code == 200
    # 11th day with votes cannot exist in the sample options, so also check one empty day: none here
    body = summary(client, token, date="2026-10-30").json()
    assert [r["open_date"] for r in body["recent_votes"]] == vote_days[:-1][::-1]
    assert all(r["total"] == 1 and r["winner"]["item_id"] == PIZZA for r in body["recent_votes"])


def test_recent_votes_only_list_days_that_had_votes(client):
    token = token_for(client)
    assert vote(client, "gap-voter-0001", TACOS, date="2026-10-19").status_code == 200
    assert vote(client, "gap-voter-0002", TACOS, date="2026-10-22").status_code == 200
    body = summary(client, token, date="2026-10-23").json()
    assert [r["open_date"] for r in body["recent_votes"]] == ["2026-10-22", "2026-10-19"]


def test_voted_last_5_days_includes_todays_voters(client):
    assert vote(client, "today-voter-001", TACOS).status_code == 200
    assert summary(client, token_for(client)).json()["players"]["voted_last_5_days"] == 1


def test_voted_last_5_days_uses_five_school_days_up_to_today(client):
    token = token_for(client)
    # school days: ..., 10-19, 10-20, 10-21, 10-22, 10-23, 10-26, ...
    assert vote(client, "window-dev-0001", TACOS, date="2026-10-19").status_code == 200
    assert vote(client, "window-dev-0002", TACOS, date="2026-10-23").status_code == 200
    # on 10-23 the window is 10-19..10-23, so both devices count
    on_23 = summary(client, token, date="2026-10-23").json()["players"]
    assert on_23 == {"total": 2, "voted_today": 1, "voted_last_5_days": 2}
    # on 10-26 the window is 10-20..10-26, so only the 10-23 voter counts
    on_26 = summary(client, token, date="2026-10-26").json()["players"]
    assert on_26["voted_today"] == 0 and on_26["voted_last_5_days"] == 1
    # on 10-19 the window ends today, so the 10-23 vote (future) must not count
    on_19 = summary(client, token, date="2026-10-19").json()["players"]
    assert on_19["voted_today"] == 1 and on_19["voted_last_5_days"] == 1


def test_voted_last_5_days_counts_a_device_once(client):
    token = token_for(client)
    for d in ("2026-10-19", "2026-10-20", "2026-10-21"):
        assert vote(client, "repeat-dev-0001", TACOS, date=d).status_code == 200
    players = summary(client, token, date="2026-10-21").json()["players"]
    assert players["voted_last_5_days"] == 1
    assert players["voted_today"] == 1


# ------------------------------------------------------------ past_winners

# Hand-picked vote_share values, one per school day of history, newest last.
SHARES = {
    "2026-09-30": "0.31", "2026-10-01": "0.32", "2026-10-02": "0.33", "2026-10-05": "0.34",
    "2026-10-06": "0.35", "2026-10-07": "0.36", "2026-10-08": "0.37", "2026-10-09": "0.38",
    "2026-10-12": "0.39", "2026-10-13": "0.41", "2026-10-14": "0.42", "2026-10-15": "0.43",
    "2026-10-16": "0.44",
}


@pytest.fixture
def history_client(monkeypatch, tmp_path):
    data_dir = tmp_path / "data"
    shutil.copytree(DATA, data_dir)
    path = data_dir / "meals.csv"
    with path.open(newline="") as handle:
        reader = csv.DictReader(handle)
        fields = reader.fieldnames
        rows = list(reader)
    seen = set()
    for row in rows:
        row["vote_share"] = ""
        if row["date"] in SHARES and row["date"] not in seen and row["component"] == "meat_alternate":
            row["vote_share"] = SHARES[row["date"]]
            seen.add(row["date"])
    assert seen == set(SHARES)
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    with make_client(monkeypatch, tmp_path, data_dir) as c:
        c.winner_rows = {r["date"]: r["item_id"] for r in rows if r["vote_share"]}
        yield c


def test_past_winners_newest_first_capped_at_ten(history_client):
    c = history_client
    items = {}
    with (DATA / "items.csv").open(newline="") as handle:
        items = {r["item_id"]: r["name"] for r in csv.DictReader(handle)}
    body = summary(c, token_for(c)).json()
    # 13 days have a share; the 10 newest are 10-16 back to 10-05
    expected_dates = [
        "2026-10-16", "2026-10-15", "2026-10-14", "2026-10-13", "2026-10-12",
        "2026-10-09", "2026-10-08", "2026-10-07", "2026-10-06", "2026-10-05",
    ]
    assert [w["date"] for w in body["past_winners"]] == expected_dates
    for w in body["past_winners"]:
        assert set(w) == {"date", "item_id", "name", "vote_share"}
        assert w["item_id"] == c.winner_rows[w["date"]]
        assert w["name"] == items[w["item_id"]]
        assert w["vote_share"] == pytest.approx(float(SHARES[w["date"]]))
    assert body["past_winners"][0]["vote_share"] == pytest.approx(0.44)
    assert body["past_winners"][-1]["vote_share"] == pytest.approx(0.34)


def test_past_winners_are_before_today_only(history_client):
    c = history_client
    token = token_for(c)
    # today = 10-13: strictly earlier rows only, so 10-12 is the newest
    body = summary(c, token, date="2026-10-13").json()
    dates = [w["date"] for w in body["past_winners"]]
    assert dates[0] == "2026-10-12"
    assert all(d < "2026-10-13" for d in dates)
    assert dates == [
        "2026-10-12", "2026-10-09", "2026-10-08", "2026-10-07", "2026-10-06",
        "2026-10-05", "2026-10-02", "2026-10-01", "2026-09-30",
    ]
    # today = 09-30: nothing earlier has a share
    assert summary(c, token, date="2026-09-30").json()["past_winners"] == []


def test_past_winners_same_for_every_school(history_client):
    c = history_client
    assert summary(c, token_for(c)).json()["past_winners"][0]["date"] == "2026-10-16"


# ------------------------------------------------------ old-schema migration


def make_old_db(path):
    con = sqlite3.connect(path)
    con.executescript(
        """
        CREATE TABLE votes(device TEXT, date TEXT, item_id TEXT, PRIMARY KEY(device, date));
        CREATE TABLE guesses(device TEXT, date TEXT, target_date TEXT, item_id TEXT,
                             PRIMARY KEY(device, date));
        CREATE TABLE players(device TEXT PRIMARY KEY, streak INTEGER, xp INTEGER,
                             last_vote_date TEXT);
        INSERT INTO votes VALUES('old-device-01', '2026-10-19', 'chicken_tacos');
        INSERT INTO guesses VALUES('old-device-01', '2026-10-19', '2026-10-20', 'popcorn_chicken');
        INSERT INTO players VALUES('old-device-01', 1, 10, '2026-10-19');
        """
    )
    con.commit()
    con.close()


def test_old_schema_database_is_migrated_to_demo(monkeypatch, tmp_path):
    make_old_db(tmp_path / "old.db")
    with make_client(monkeypatch, tmp_path, db_name="old.db") as c:
        token = token_for(c)
        body = summary(c, token).json()
        assert body["vote"]["total"] == 1
        assert [(o["item_id"], o["votes"]) for o in body["vote"]["options"]] == [
            (TACOS, 1), (PIZZA, 0), (POPCORN, 0)
        ]
        assert body["guesses"] == {
            "target_date": "2026-10-20",
            "total": 1,
            "items": [{"item_id": POPCORN, "name": "Popcorn chicken", "guesses": 1}],
        }
        assert body["players"]["total"] == 1 and body["players"]["voted_today"] == 1
        # the old device cannot vote twice on the same day, in demo (default or explicit)
        assert vote(c, "old-device-01", PIZZA).status_code == 409
        assert vote(c, "old-device-01", PIZZA, school="demo").status_code == 409
        assert c.get("/api/spin", params={"device": "old-device-01"}).json()["already_voted"]
        me = c.get("/api/me", params={"device": "old-device-01"}).json()
        assert me["xp"] == 10 and me["streak"] == 1
        # a new device still can, and the totals move by exactly one
        assert vote(c, "new-device-01", PIZZA).status_code == 200
        after = summary(c, token).json()["vote"]
        assert after["total"] == 2
        assert [o["votes"] for o in after["options"]] == [1, 1, 0]


def test_migrated_database_survives_a_restart(monkeypatch, tmp_path):
    make_old_db(tmp_path / "old.db")
    with make_client(monkeypatch, tmp_path, db_name="old.db") as c:
        assert vote(c, "new-device-01", POPCORN).status_code == 200
    with make_client(monkeypatch, tmp_path, db_name="old.db") as c:
        body = summary(c, token_for(c)).json()
        assert body["vote"]["total"] == 2
        assert [o["votes"] for o in body["vote"]["options"]] == [1, 0, 1]
        assert vote(c, "old-device-01", TACOS).status_code == 409
        assert vote(c, "new-device-01", TACOS).status_code == 409


def test_parallel_wrong_guesses_cannot_pass_the_limit(two_schools):
    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=20) as pool:
        codes = list(pool.map(lambda _: login(two_schools, "north-high", "wrong").status_code, range(40)))
    # Only five passwords may ever be checked; every other try is turned away.
    assert codes.count(401) == 5
    assert codes.count(429) == 35


def test_unknown_school_logins_are_not_remembered(two_schools):
    for n in range(30):
        assert login(two_schools, f"made-up-{n}", "x").status_code == 401
    # Unknown schools never count, so a real school's staff are not affected.
    assert login(two_schools, "north-high", "north-secret-pw").status_code == 200


def test_half_finished_migration_is_completed(monkeypatch, tmp_path):
    # A crash right after the rename leaves votes_old and no votes table.
    db = tmp_path / "half.db"
    connection = sqlite3.connect(db)
    connection.execute(
        "CREATE TABLE votes_old(device TEXT, date TEXT, item_id TEXT, PRIMARY KEY(device, date))"
    )
    connection.execute("INSERT INTO votes_old VALUES('half-device-01','2026-10-19','tacos')")
    connection.commit()
    connection.close()
    monkeypatch.setenv("LUNCHLOOP_DB", str(db))
    from api.main import create_app

    with TestClient(create_app()) as c:
        token = token_for(c)
        assert summary(c, token).json()["players"]["voted_today"] == 1
    tables = {row[0] for row in sqlite3.connect(db).execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert "votes_old" not in tables
