"""Live school day control and stale tray protection."""

import hashlib
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


DATA = Path(__file__).resolve().parents[2] / "data" / "sample"
TODAY = "2026-10-19"
MOVED = "2026-10-20"
LIVE_PASSWORD = "live-stage-pw"


def pbkdf2_hash(password):
    salt = bytes(range(32, 48))
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)
    return f"pbkdf2_sha256$200000${salt.hex()}${digest.hex()}"


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def fixed_secret(monkeypatch):
    import api.auth

    monkeypatch.setenv("LUNCHLOOP_SECRET", "live-clock-test-secret")
    monkeypatch.setenv("LUNCHLOOP_SCHOOL_PASSWORDS", f"live={pbkdf2_hash(LIVE_PASSWORD)}")
    monkeypatch.setattr(api.auth, "_SECRET", None)


@pytest.fixture
def live_client(monkeypatch, tmp_path):
    db_path = tmp_path / "clock.db"
    monkeypatch.setenv("LUNCHLOOP_DATA_DIR", str(DATA))
    monkeypatch.setenv("LUNCHLOOP_DB", str(db_path))
    monkeypatch.setenv("LUNCHLOOP_TODAY", TODAY)
    from api.main import create_app

    with TestClient(create_app()) as client:
        client.db_path = db_path
        yield client


def live_token(client):
    response = client.post("/api/admin/login", json={"school_id": "live", "password": LIVE_PASSWORD})
    assert response.status_code == 200, response.text
    return response.json()["token"]


def clock(client, token, date=MOVED):
    return client.post("/api/admin/clock", headers=bearer(token), json={"date": date})


def first_picks(client, school="live"):
    body = client.get("/api/tray", params={"school": school}).json()
    return body["target_date"], {group["component"]: group["items"][0]["item_id"] for group in body["groups"]}


def test_clock_requires_auth_and_live_school(live_client):
    assert live_client.get("/api/admin/clock").json() == {"error": "sign in again"}
    demo = live_client.post("/api/admin/login", json={"school_id": "demo", "password": "lunchloop"}).json()["token"]
    response = live_client.get("/api/admin/clock", headers=bearer(demo))
    assert response.status_code == 400
    assert response.json() == {"error": "the day control is for the live school"}


def test_clock_moves_live_reads_and_ignores_demo_header(live_client):
    token = live_token(live_client)
    before = live_client.get("/api/admin/clock", headers=bearer(token))
    assert before.status_code == 200
    assert before.json()["today"] == TODAY
    moved = clock(live_client, token)
    assert moved.status_code == 200
    assert moved.json()["today"] == MOVED
    assert live_client.get("/api/health?school=live", headers={"X-Demo-Date": "2026-10-19"}).json()["today"] == MOVED
    assert live_client.get("/api/tray?school=live", headers={"X-Demo-Date": "2026-10-19"}).json()["open_date"] == MOVED
    assert live_client.get("/api/admin/summary", headers=bearer(token) | {"X-Demo-Date": TODAY}).json()["today"] == MOVED
    assert live_client.get("/api/health", headers={"X-Demo-Date": MOVED}).json()["today"] == MOVED


def test_clock_validation_and_reset(live_client):
    token = live_token(live_client)
    assert clock(live_client, token, "2026-02-30").json() == {"error": "invalid date"}
    assert clock(live_client, token, "2026-10-24").json() == {"error": "not a school day"}
    assert clock(live_client, token, None).json()["today"] == TODAY
    assert live_client.post("/api/admin/clock", headers=bearer(token), json={}).status_code == 400


def test_clock_persists_across_fresh_app(live_client, monkeypatch):
    token = live_token(live_client)
    assert clock(live_client, token).status_code == 200
    from api.main import create_app

    with TestClient(create_app()) as fresh:
        assert fresh.get("/api/health?school=live").json()["today"] == MOVED


def test_demo_day_is_unaffected(live_client):
    token = live_token(live_client)
    assert clock(live_client, token).status_code == 200
    assert live_client.get("/api/health").json()["today"] == TODAY
    assert live_client.get("/api/health", headers={"X-Demo-Date": MOVED}).json()["today"] == MOVED


def test_player_can_pack_again_after_live_day_moves(live_client):
    token = live_token(live_client)
    target, picks = first_picks(live_client)
    assert target == MOVED
    assert live_client.post("/api/tray", json={"device": "live-player-old", "school": "live", "picks": picks}).status_code == 200
    assert clock(live_client, token).status_code == 200
    new_target, new_picks = first_picks(live_client)
    assert new_target == "2026-10-21"
    response = live_client.post("/api/tray", json={"device": "live-player-old", "school": "live", "picks": new_picks})
    assert response.status_code == 200


def test_stale_target_date_is_rejected_before_insert(live_client):
    token = live_token(live_client)
    old_target, _ = first_picks(live_client)
    assert clock(live_client, token).status_code == 200
    new_target, picks = first_picks(live_client)
    assert new_target != old_target
    response = live_client.post(
        "/api/tray",
        json={"device": "stale-target-player", "school": "live", "picks": picks, "target_date": old_target},
    )
    assert response.status_code == 409
    assert response.json() == {"error": "the lunch day changed"}
    with sqlite3.connect(live_client.db_path) as connection:
        assert connection.execute("SELECT COUNT(*) FROM trays WHERE device=?", ("stale-target-player",)).fetchone()[0] == 0


def test_tray_without_target_date_keeps_old_behavior(live_client):
    _, picks = first_picks(live_client)
    response = live_client.post("/api/tray", json={"device": "no-target-player", "school": "live", "picks": picks})
    assert response.status_code == 200


def test_clock_records_event(live_client):
    token = live_token(live_client)
    assert clock(live_client, token).status_code == 200
    events = live_client.get("/api/events", params={"scope": "live"}).json()["events"]
    changed = [event for event in events if event["kind"] == "live_day_changed"]
    assert changed[-1]["school_id"] == "live"
    assert changed[-1]["detail"] == {"today": MOVED}


def ballot(client):
    return client.get("/api/spin", params={"school": "live"}).json()


def test_stale_vote_and_guess_are_rejected_before_insert(live_client):
    token = live_token(live_client)
    old = ballot(live_client)
    option = old["options"][0]["item_id"]
    assert clock(live_client, token).status_code == 200
    for path in ("/api/vote", "/api/guess"):
        response = live_client.post(path, json={"device": "stale-ballot-player", "school": "live", "item_id": option, "date": old["date"]})
        assert response.status_code == 409, path
        assert response.json() == {"error": "the lunch day changed"}
    with sqlite3.connect(live_client.db_path) as connection:
        assert connection.execute("SELECT COUNT(*) FROM votes WHERE device=?", ("stale-ballot-player",)).fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM guesses WHERE device=?", ("stale-ballot-player",)).fetchone()[0] == 0


def test_vote_on_the_current_day_still_counts(live_client):
    current = ballot(live_client)
    option = current["options"][0]["item_id"]
    response = live_client.post("/api/vote", json={"device": "current-ballot-player", "school": "live", "item_id": option, "date": current["date"]})
    assert response.status_code == 200
    without = live_client.post("/api/vote", json={"device": "no-date-ballot-player", "school": "live", "item_id": option})
    assert without.status_code == 200
