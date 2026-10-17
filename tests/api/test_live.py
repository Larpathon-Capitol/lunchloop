"""Black-box tests for the live demo school and the sign-in expiry time.

Expected values come from docs/backend-contract.md ("Live demo school" and
"School accounts"), worked out by hand against data/sample. Password hashes
are built here with hashlib, not with the code under test.
"""

import base64
import hashlib
import json
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

DATA = Path(__file__).resolve().parents[2] / "data" / "sample"
SECRET = "unit-test-secret"
TACOS, PIZZA, POPCORN = "chicken_tacos", "cheese_pizza", "popcorn_chicken"
WRONG_BODY = {"error": "wrong school or password"}
LIVE_PASSWORD = "live-stage-pw"
TODAY = "2026-10-19"
OTHER_DAY = "2026-10-20"  # also a school day with the same three vote options


def pbkdf2_hash(password, iterations=200_000, salt=bytes(range(32, 48))):
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}"


LIVE_HASH = pbkdf2_hash(LIVE_PASSWORD)


def day(date):
    return {"X-Demo-Date": date}


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def fixed_secret(monkeypatch):
    import api.auth

    monkeypatch.setenv("LUNCHLOOP_SECRET", SECRET)
    monkeypatch.delenv("LUNCHLOOP_SCHOOL_PASSWORDS", raising=False)
    monkeypatch.setattr(api.auth, "_SECRET", None)


def make_client(monkeypatch, tmp_path, today=TODAY):
    monkeypatch.setenv("LUNCHLOOP_DATA_DIR", str(DATA))
    monkeypatch.setenv("LUNCHLOOP_DB", str(tmp_path / "t.db"))
    monkeypatch.setenv("LUNCHLOOP_TODAY", today)
    from api.main import create_app

    return TestClient(create_app())


@pytest.fixture
def plain(monkeypatch, tmp_path):
    """No password hashes at all: demo is public, live cannot sign in."""
    with make_client(monkeypatch, tmp_path) as c:
        yield c


@pytest.fixture
def live_hashed(monkeypatch, tmp_path):
    monkeypatch.setenv("LUNCHLOOP_SCHOOL_PASSWORDS", f"live={LIVE_HASH}")
    with make_client(monkeypatch, tmp_path) as c:
        yield c


def login(client, school_id, password):
    return client.post("/api/admin/login", json={"school_id": school_id, "password": password})


def token_for(client, school_id, password):
    response = login(client, school_id, password)
    assert response.status_code == 200, response.text
    return response.json()["token"]


def vote(client, device, item, school=None, date=None):
    body = {"device": device, "item_id": item}
    if school is not None:
        body["school"] = school
    return client.post("/api/vote", json=body, headers=day(date) if date else {})


def summary(client, token, date=None):
    headers = bearer(token)
    if date:
        headers |= day(date)
    return client.get("/api/admin/summary", headers=headers)


def option_votes(body):
    return {row["item_id"]: row["votes"] for row in body["vote"]["options"]}


# ------------------------------------------------------------------ schools list


def test_schools_lists_live_without_demo_password(plain):
    schools = {row["school_id"]: row for row in plain.get("/api/schools").json()["schools"]}
    assert schools["live"]["name"] == "LunchLoop live demo"
    assert schools["live"]["demo_password"] is None
    # the public demo school keeps its public password
    assert schools["demo"]["demo_password"] == "lunchloop"


def test_live_demo_password_stays_null_when_live_has_a_hash(live_hashed):
    schools = {row["school_id"]: row for row in live_hashed.get("/api/schools").json()["schools"]}
    assert schools["live"]["demo_password"] is None
    # a hash for live does not take the demo school's public password away
    assert schools["demo"]["demo_password"] == "lunchloop"


# ---------------------------------------------------------------------- sign in


@pytest.mark.parametrize("password", ["lunchloop", "live", "", LIVE_PASSWORD])
def test_live_cannot_sign_in_without_a_configured_hash(plain, password):
    response = login(plain, "live", password)
    assert response.status_code == 401
    assert response.json() == WRONG_BODY


def test_live_rejects_public_demo_password_even_with_a_hash(live_hashed):
    response = login(live_hashed, "live", "lunchloop")
    assert response.status_code == 401
    assert response.json() == WRONG_BODY


def test_live_signs_in_with_its_configured_password(live_hashed):
    response = login(live_hashed, "live", LIVE_PASSWORD)
    assert response.status_code == 200
    body = response.json()
    assert body["school"] == {"school_id": "live", "name": "LunchLoop live demo"}
    assert body["simulated"] is True
    # the token is for live: its summary says so
    summary_body = summary(live_hashed, body["token"]).json()
    assert summary_body["school"]["school_id"] == "live"


def test_live_wrong_password_is_rejected_when_a_hash_is_set(live_hashed):
    response = login(live_hashed, "live", "not-the-password")
    assert response.status_code == 401
    assert response.json() == WRONG_BODY


def test_demo_public_password_still_works_next_to_a_live_hash(live_hashed):
    assert login(live_hashed, "demo", "lunchloop").status_code == 200


# ------------------------------------------------------------------ expires_at


def test_login_expires_at_is_iso_utc_about_twelve_hours_ahead(plain):
    before = datetime.now(timezone.utc)
    body = login(plain, "demo", "lunchloop").json()
    after = datetime.now(timezone.utc)
    text = body["expires_at"]
    assert isinstance(text, str)
    parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    assert parsed.tzinfo is not None
    assert parsed.utcoffset() == timedelta(0)  # UTC
    # 12 hours (43200 s) after the sign-in; a minute of slack for a slow machine
    assert before + timedelta(hours=12) - timedelta(seconds=60) <= parsed
    assert parsed <= after + timedelta(hours=12) + timedelta(seconds=60)


def test_login_expires_at_matches_the_token_exp(plain):
    body = login(plain, "demo", "lunchloop").json()
    payload_part = body["token"].split(".")[0]
    payload = json.loads(base64.urlsafe_b64decode(payload_part + "=" * (-len(payload_part) % 4)))
    parsed = datetime.fromisoformat(body["expires_at"].replace("Z", "+00:00"))
    assert abs(parsed.timestamp() - payload["exp"]) <= 1


# ------------------------------------------------------------- the clock is fixed


def test_live_ignores_demo_date_header_so_a_device_cannot_vote_twice(plain):
    first = vote(plain, "device-live-0001", TACOS, school="live", date=TODAY)
    assert first.status_code == 200
    second = vote(plain, "device-live-0001", TACOS, school="live", date=OTHER_DAY)
    assert second.status_code == 409


def test_live_double_vote_is_blocked_with_a_different_item_too(plain):
    assert vote(plain, "device-live-0002", TACOS, school="live", date=OTHER_DAY).status_code == 200
    assert vote(plain, "device-live-0002", PIZZA, school="live", date=TODAY).status_code == 409


def test_demo_still_honours_demo_date_header(plain):
    first = vote(plain, "device-demo-0001", TACOS, date=TODAY)
    second = vote(plain, "device-demo-0001", TACOS, date=OTHER_DAY)
    assert first.status_code == 200
    assert second.status_code == 200  # a new demo day, so a new vote is allowed
    # and the same demo day still blocks it
    assert vote(plain, "device-demo-0001", TACOS, date=OTHER_DAY).status_code == 409


def test_live_spin_date_is_the_server_today_not_the_header(plain):
    spin = plain.get("/api/spin", params={"school": "live"}, headers=day(OTHER_DAY))
    assert spin.status_code == 200
    assert spin.json()["date"] == TODAY


def test_demo_spin_date_follows_the_header(plain):
    spin = plain.get("/api/spin", headers=day(OTHER_DAY))
    assert spin.status_code == 200
    assert spin.json()["date"] == OTHER_DAY


def test_live_spin_uses_the_configured_today(monkeypatch, tmp_path):
    with make_client(monkeypatch, tmp_path, today=OTHER_DAY) as client:
        spin = client.get("/api/spin", params={"school": "live"}, headers=day(TODAY))
        assert spin.status_code == 200
        assert spin.json()["date"] == OTHER_DAY


def test_live_ignores_a_garbage_demo_date_header(plain):
    spin = plain.get("/api/spin", params={"school": "live"}, headers=day("not-a-date"))
    assert spin.status_code == 200
    assert spin.json()["date"] == TODAY


def test_live_already_voted_stays_true_under_another_header_date(plain):
    vote(plain, "device-live-0003", TACOS, school="live")
    spin = plain.get(
        "/api/spin", params={"school": "live", "device": "device-live-0003"}, headers=day(OTHER_DAY)
    )
    assert spin.json()["already_voted"] is True


# --------------------------------------------------------- votes stay in their school


def test_live_and_demo_votes_stay_apart_in_the_admin_summary(live_hashed):
    c = live_hashed
    # same device votes in both schools; two more demo voters
    assert vote(c, "device-both-0001", TACOS, school="live").status_code == 200
    assert vote(c, "device-both-0001", PIZZA).status_code == 200
    assert vote(c, "device-demo-0002", PIZZA).status_code == 200
    live_summary = summary(c, token_for(c, "live", LIVE_PASSWORD)).json()
    demo_summary = summary(c, token_for(c, "demo", "lunchloop")).json()

    # hand count: live saw one vote (tacos), demo saw two (both pizza)
    assert live_summary["vote"]["total"] == 1
    assert option_votes(live_summary) == {TACOS: 1, PIZZA: 0, POPCORN: 0}
    assert demo_summary["vote"]["total"] == 2
    assert option_votes(demo_summary) == {TACOS: 0, PIZZA: 2, POPCORN: 0}
    assert live_summary["players"] == {"total": 1, "voted_today": 1, "voted_last_5_days": 1}
    assert demo_summary["players"] == {"total": 2, "voted_today": 2, "voted_last_5_days": 2}


def test_vote_response_tally_counts_only_the_voters_school(plain):
    vote(plain, "device-demo-0003", TACOS)
    response = vote(plain, "device-live-0004", TACOS, school="live")
    assert response.json()["tally"] == {TACOS: 1, PIZZA: 0, POPCORN: 0}
    again = vote(plain, "device-demo-0004", TACOS)
    assert again.json()["tally"] == {TACOS: 2, PIZZA: 0, POPCORN: 0}


def test_live_admin_summary_ignores_demo_date_header(live_hashed):
    c = live_hashed
    vote(c, "device-live-0005", POPCORN, school="live")
    token = token_for(c, "live", LIVE_PASSWORD)
    plain_body = summary(c, token).json()
    shifted = summary(c, token, date=OTHER_DAY).json()
    assert plain_body["today"] == TODAY
    assert shifted["today"] == TODAY
    assert shifted["vote"]["total"] == 1
    assert option_votes(shifted) == {TACOS: 0, PIZZA: 0, POPCORN: 1}
    assert shifted["vote"] == plain_body["vote"]


def test_demo_admin_summary_still_honours_demo_date_header(live_hashed):
    c = live_hashed
    vote(c, "device-demo-0005", POPCORN, date=TODAY)
    token = token_for(c, "demo", "lunchloop")
    assert summary(c, token, date=TODAY).json()["vote"]["total"] == 1
    moved = summary(c, token, date=OTHER_DAY).json()
    assert moved["today"] == OTHER_DAY
    assert moved["vote"]["total"] == 0
