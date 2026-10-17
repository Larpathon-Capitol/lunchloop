"""Black-box tests for the public behind-the-scenes feed, GET /api/events.

Expected values come from docs/backend-contract.md ("Behind the scenes"),
worked out by hand against data/sample. Nothing here imports the event code.
"""

import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

DATA = Path(__file__).resolve().parents[2] / "data" / "sample"
SECRET = "unit-test-secret"
TACOS, PIZZA, POPCORN = "chicken_tacos", "cheese_pizza", "popcorn_chicken"
KINDS = {
    "spin", "vote", "guess", "staff_sign_in", "staff_sign_in_failed",
    "prep", "savings", "simulate", "meter", "rate_limited",
}
EVENT_KEYS = {"id", "at", "kind", "school_id", "player", "summary", "detail", "ms"}
DEVICE_A, DEVICE_B = "device-aaaa-0001", "device-bbbb-0002"


@pytest.fixture(autouse=True)
def fixed_secret(monkeypatch):
    import api.auth

    monkeypatch.setenv("LUNCHLOOP_SECRET", SECRET)
    monkeypatch.delenv("LUNCHLOOP_SCHOOL_PASSWORDS", raising=False)
    monkeypatch.setattr(api.auth, "_SECRET", None)


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("LUNCHLOOP_DATA_DIR", str(DATA))
    monkeypatch.setenv("LUNCHLOOP_DB", str(tmp_path / "t.db"))
    monkeypatch.setenv("LUNCHLOOP_TODAY", "2026-10-19")
    from api.main import create_app

    with TestClient(create_app()) as c:
        yield c


def feed(client, after=0, limit=100):
    response = client.get("/api/events", params={"after": after, "limit": limit})
    assert response.status_code == 200, response.text
    return response.json()


def latest(client):
    return feed(client, limit=1)["latest_id"]


def new_events(client, since):
    return feed(client, after=since)["events"]


def vote(client, device, item, school=None):
    body = {"device": device, "item_id": item}
    if school:
        body["school"] = school
    return client.post("/api/vote", json=body)


def only_event(client, since, kind):
    events = new_events(client, since)
    assert [e["kind"] for e in events] == [kind], events
    return events[0]


# ------------------------------------------------------------------- shape


def test_fresh_feed_is_empty(client):
    body = feed(client)
    assert body["events"] == []
    assert body["latest_id"] == 0
    assert body["simulated"] is True


def test_event_has_exactly_the_contract_fields(client):
    vote(client, DEVICE_A, TACOS)
    event = feed(client)["events"][0]
    assert set(event) == EVENT_KEYS
    assert event["kind"] in KINDS
    assert isinstance(event["id"], int)
    assert isinstance(event["summary"], str) and event["summary"]
    assert isinstance(event["detail"], dict)


def test_event_time_is_iso_utc_and_current(client):
    before = datetime.now(timezone.utc) - timedelta(seconds=5)
    vote(client, DEVICE_A, TACOS)
    after = datetime.now(timezone.utc) + timedelta(seconds=5)
    parsed = datetime.fromisoformat(feed(client)["events"][0]["at"].replace("Z", "+00:00"))
    assert parsed.utcoffset() == timedelta(0)
    assert before <= parsed <= after


# -------------------------------------------------------------------- votes


def test_vote_makes_one_vote_event(client):
    since = latest(client)
    vote(client, DEVICE_A, TACOS)
    event = only_event(client, since, "vote")
    assert event["school_id"] == "demo"
    assert "Chicken tacos" in event["summary"]  # items.csv name for chicken_tacos
    assert isinstance(event["ms"], (int, float)) and event["ms"] >= 0


def test_vote_for_another_school_is_tagged_with_that_school(client):
    since = latest(client)
    vote(client, DEVICE_A, TACOS, school="live")
    assert only_event(client, since, "vote")["school_id"] == "live"


def test_vote_event_tally_matches_the_vote_response(client):
    first = vote(client, DEVICE_A, TACOS).json()["tally"]
    second = vote(client, DEVICE_B, TACOS).json()["tally"]
    # hand count: the second tacos vote makes the tacos tally 2
    assert first[TACOS] == 1 and second[TACOS] == 2
    events = feed(client)["events"]
    assert [e["kind"] for e in events] == ["vote", "vote"]
    for event, response_tally in zip(events, (first, second)):
        tally = event["detail"]["tally"]
        assert tally in (response_tally[TACOS], response_tally)


def test_player_tag_is_six_hex_chars_and_not_the_device_id(client):
    vote(client, DEVICE_A, TACOS)
    player = feed(client)["events"][0]["player"]
    assert re.fullmatch(r"[0-9a-f]{6}", player)
    assert player != DEVICE_A
    assert player not in DEVICE_A


def test_player_tag_is_stable_per_device_and_differs_between_devices(client):
    client.get("/api/spin", params={"device": DEVICE_A})
    vote(client, DEVICE_A, TACOS)
    client.get("/api/spin", params={"device": DEVICE_B})
    vote(client, DEVICE_B, PIZZA)
    a_spin, a_vote, b_spin, b_vote = feed(client)["events"]
    assert a_spin["player"] == a_vote["player"]
    assert b_spin["player"] == b_vote["player"]
    assert a_spin["player"] != b_spin["player"]


def test_player_tag_depends_on_the_server_secret(monkeypatch, tmp_path):
    import api.auth
    from api.main import create_app

    tags = []
    for secret in ("first-secret-value", "second-secret-value"):
        monkeypatch.setenv("LUNCHLOOP_SECRET", secret)
        monkeypatch.setattr(api.auth, "_SECRET", None)
        monkeypatch.setenv("LUNCHLOOP_DATA_DIR", str(DATA))
        monkeypatch.setenv("LUNCHLOOP_DB", str(tmp_path / f"{secret}.db"))
        with TestClient(create_app()) as c:
            vote(c, DEVICE_A, TACOS)
            tags.append(feed(c)["events"][0]["player"])
    assert tags[0] != tags[1]


# -------------------------------------------------------------- spin / guess


def test_spin_with_device_makes_a_spin_event(client):
    since = latest(client)
    client.get("/api/spin", params={"device": DEVICE_A})
    event = only_event(client, since, "spin")
    assert event["school_id"] == "demo"
    assert re.fullmatch(r"[0-9a-f]{6}", event["player"])


def test_spin_without_device_makes_no_event(client):
    since = latest(client)
    assert client.get("/api/spin").status_code == 200
    assert new_events(client, since) == []
    assert latest(client) == since


def test_guess_makes_a_guess_event(client):
    since = latest(client)
    assert client.post("/api/guess", json={"device": DEVICE_A, "item_id": TACOS}).status_code == 200
    event = only_event(client, since, "guess")
    assert event["school_id"] == "demo"
    assert re.fullmatch(r"[0-9a-f]{6}", event["player"])


# ------------------------------------------------------------ engine events


def test_prep_event_has_item_count_and_total(client):
    since = latest(client)
    prep = client.get("/api/prep").json()
    event = only_event(client, since, "prep")
    assert isinstance(event["ms"], (int, float)) and event["ms"] >= 0
    # hand count: 2026-10-19 serves 6 items (pizza, popcorn chicken, roll, salad, apples, milk)
    assert len(prep["items"]) == 6
    assert 6 in event["detail"].values()
    assert sum(i["prep"] for i in prep["items"]) in event["detail"].values()


def test_savings_event(client):
    since = latest(client)
    assert client.get("/api/savings").status_code == 200
    event = only_event(client, since, "savings")
    assert isinstance(event["ms"], (int, float)) and event["ms"] >= 0


def test_simulate_event(client):
    since = latest(client)
    body = {"attendance_multiplier": 1.0, "price_multiplier": 1.0, "ratio": 3.0}
    response = client.post("/api/simulate", json=body)
    assert response.status_code == 200
    event = only_event(client, since, "simulate")
    assert isinstance(event["ms"], (int, float)) and event["ms"] >= 0
    assert response.json()["totals"]["prep_servings"] in event["detail"].values()


def test_meter_event(client):
    since = latest(client)
    assert client.get("/api/meter").status_code == 200
    event = only_event(client, since, "meter")
    assert isinstance(event["ms"], (int, float)) and event["ms"] >= 0


# ------------------------------------------------------------------ sign in


def test_successful_sign_in_makes_a_staff_sign_in_event(client):
    since = latest(client)
    ok = client.post("/api/admin/login", json={"school_id": "demo", "password": "lunchloop"})
    assert ok.status_code == 200
    event = only_event(client, since, "staff_sign_in")
    assert event["school_id"] == "demo"
    assert event["player"] is None


def test_failed_sign_in_makes_a_staff_sign_in_failed_event(client):
    since = latest(client)
    bad = client.post("/api/admin/login", json={"school_id": "demo", "password": "nope-nope"})
    assert bad.status_code == 401
    event = only_event(client, since, "staff_sign_in_failed")
    assert event["school_id"] == "demo"
    assert event["player"] is None


# ------------------------------------------------------- reads add no events


def test_summary_polls_and_event_reads_add_no_events(client):
    token = client.post(
        "/api/admin/login", json={"school_id": "demo", "password": "lunchloop"}
    ).json()["token"]
    since = latest(client)
    for _ in range(3):
        resp = client.get("/api/admin/summary", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        feed(client)
        feed(client, after=0, limit=5)
    assert latest(client) == since
    assert new_events(client, since) == []


def test_health_schools_and_me_add_no_events(client):
    since = latest(client)
    client.get("/api/health")
    client.get("/api/schools")
    client.get("/api/me", params={"device": DEVICE_A})
    assert latest(client) == since


# ------------------------------------------------------------------- paging


def spin_n(client, count, device=DEVICE_A):
    for _ in range(count):
        assert client.get("/api/spin", params={"device": device}).status_code == 200


def test_after_returns_only_newer_ids_oldest_first(client):
    spin_n(client, 6)
    everything = feed(client)
    ids = [e["id"] for e in everything["events"]]
    assert len(ids) == 6
    assert ids == sorted(ids) and len(set(ids)) == 6
    assert everything["latest_id"] == ids[-1]
    cut = ids[2]
    tail = feed(client, after=cut)
    assert [e["id"] for e in tail["events"]] == ids[3:]
    assert tail["latest_id"] == ids[-1]
    assert feed(client, after=ids[-1])["events"] == []


def test_limit_caps_the_count_and_keeps_oldest_first(client):
    spin_n(client, 6)
    ids = [e["id"] for e in feed(client)["events"]]
    capped = feed(client, limit=2)
    assert [e["id"] for e in capped["events"]] == ids[:2]
    assert capped["latest_id"] == ids[-1]  # latest_id is the newest event, not the page end
    page2 = feed(client, after=capped["events"][-1]["id"], limit=2)
    assert [e["id"] for e in page2["events"]] == ids[2:4]


def test_default_limit_is_fifty(client):
    spin_n(client, 55)
    assert len(client.get("/api/events").json()["events"]) == 50


def test_after_and_limit_default_without_params(client):
    spin_n(client, 3)
    body = client.get("/api/events").json()
    assert len(body["events"]) == 3


def test_limit_one_and_one_hundred_are_accepted(client):
    spin_n(client, 3)
    assert len(feed(client, limit=1)["events"]) == 1
    assert len(feed(client, limit=100)["events"]) == 3


@pytest.mark.parametrize(
    "params",
    [
        {"after": "abc"},
        {"after": "-1"},
        {"after": "1.5"},
        {"limit": "abc"},
        {"limit": "0"},
        {"limit": "101"},
        {"limit": "-5"},
    ],
)
def test_bad_paging_values_are_400(client, params):
    response = client.get("/api/events", params=params)
    assert response.status_code == 400
    assert "error" in response.json()


# --------------------------------------------------------------------- ring


def test_ring_keeps_only_the_newest_300(client):
    spin_n(client, 320)
    collected = []
    cursor = 0
    while True:
        page = feed(client, after=cursor, limit=100)
        if not page["events"]:
            break
        collected.extend(page["events"])
        cursor = page["events"][-1]["id"]
    ids = [e["id"] for e in collected]
    # hand count: ids 1..320 were made, so only 21..320 remain
    assert ids == list(range(21, 321))
    assert feed(client)["latest_id"] == 320


# ------------------------------------------------------------------ privacy


def test_feed_never_exposes_devices_passwords_tokens_or_addresses(client):
    devices = [DEVICE_A, DEVICE_B]
    for device in devices:
        client.get("/api/spin", params={"device": device})
        vote(client, device, TACOS)
        client.post("/api/guess", json={"device": device, "item_id": TACOS})
    failed = client.post("/api/admin/login", json={"school_id": "demo", "password": "hunter2-secret"})
    assert failed.status_code == 401
    ok = client.post("/api/admin/login", json={"school_id": "demo", "password": "lunchloop"})
    token = ok.json()["token"]
    client.get("/api/admin/summary", headers={"Authorization": f"Bearer {token}"})

    raw = client.get("/api/events", params={"limit": 100}).text
    assert '"kind"' in raw  # the feed is not empty
    lowered = raw.lower()
    for forbidden in (*devices, "hunter2-secret", "lunchloop", token, "testclient", "127.0.0.1"):
        assert forbidden.lower() not in lowered, forbidden
    # the token's two halves must not leak on their own either
    for part in token.split("."):
        assert part not in raw
