"""Black-box tests for signed device ids and the anti-abuse limits.

Written from the written anti-abuse spec only; nothing here imports the new code.

Expected values:
- A signed id is "<id>.<sig>" where sig is the first 16 hex characters of
  HMAC-SHA256(secret, "device:" + id). The tests compute it themselves with hmac
  and hashlib, using the secret they set in LUNCHLOOP_SECRET.
- Limits are the spec defaults (the spec does not name the env variables, so
  none are set): 1200 requests a minute per IP, 300 actions per 10 minutes per
  IP, 60 requests a minute per device, 12 actions per 10 minutes per device, and
  120 mints per IP per 10 minutes.
- Enforcement is switched with LUNCHLOOP_SIGNED_DEVICES=1 (off by default).
"""

import hashlib
import hmac
import json
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

DATA = Path(__file__).resolve().parents[2] / "data" / "sample"
SECRET = "unit-test-secret"
TACOS = "chicken_tacos"
SLOW = {"error": "slow down a little"}
MINT_SLOW = {"error": "too many new players from this network, try again soon"}
E_DEVICE = {"error": "invalid device"}
COMPONENTS = ["meat_alternate", "grain", "vegetable", "fruit", "milk"]

DEVICE_LIMIT_REQUESTS = 60
DEVICE_LIMIT_ACTIONS = 12
IP_LIMIT_REQUESTS = 1200
IP_LIMIT_ACTIONS = 300
MINT_LIMIT = 120

BASE = "student-abuse-0001"


# ------------------------------------------------------------------ helpers


def sign(base, secret=SECRET):
    mac = hmac.new(secret.encode(), ("device:" + base).encode(), hashlib.sha256).hexdigest()
    return f"{base}.{mac[:16]}"


def split(signed):
    base, _, sig = signed.partition(".")
    return base, sig


@pytest.fixture(autouse=True)
def env(monkeypatch, tmp_path):
    import api.auth

    monkeypatch.setenv("LUNCHLOOP_SECRET", SECRET)
    monkeypatch.delenv("LUNCHLOOP_SCHOOL_PASSWORDS", raising=False)
    monkeypatch.delenv("LUNCHLOOP_SIGNED_DEVICES", raising=False)
    monkeypatch.setattr(api.auth, "_SECRET", None)
    monkeypatch.setenv("LUNCHLOOP_DATA_DIR", str(DATA))
    monkeypatch.setenv("LUNCHLOOP_DB", str(tmp_path / "t.db"))
    monkeypatch.setenv("LUNCHLOOP_TODAY", "2026-10-19")


@pytest.fixture
def build(monkeypatch):
    """build(enforce=False) creates an app with LUNCHLOOP_SIGNED_DEVICES set to match.

    Several apps in one test share the same database file, so history made in one
    carries into the next.
    """

    def factory(enforce=False):
        if enforce:
            monkeypatch.setenv("LUNCHLOOP_SIGNED_DEVICES", "1")
        else:
            monkeypatch.delenv("LUNCHLOOP_SIGNED_DEVICES", raising=False)
        from api.main import create_app

        return create_app()

    return factory


def vote(client, device, item=TACOS):
    return client.post("/api/vote", json={"device": device, "item_id": item})


def guess(client, device, item=TACOS):
    return client.post("/api/guess", json={"device": device, "item_id": item})


def me(client, device):
    return client.get("/api/me", params={"device": device})


def spin(client, device):
    return client.get("/api/spin", params={"device": device})


def mint(client, legacy="__missing__"):
    body = {} if legacy == "__missing__" else {"legacy": legacy}
    return client.post("/api/device", json=body)


def pack(client, device):
    groups = client.get("/api/tray", params={"device": device}).json()["groups"]
    picks = {group["component"]: group["items"][0]["item_id"] for group in groups}
    return client.post("/api/tray", json={"device": device, "picks": picks})


def read_feed(app):
    """Every event in the public feed, read from a different client address so the
    limit under test does not block us. The feed caps `limit` at 100, so page with `after`."""
    reader = TestClient(app, client=("203.0.113.9", 50000))
    events, cursor = [], 0
    while True:
        response = reader.get("/api/events", params={"after": cursor, "limit": 100})
        assert response.status_code == 200, response.text
        page = response.json()["events"]
        if not page:
            return events
        events.extend(page)
        cursor = page[-1]["id"]


def feed_text(app):
    """The raw JSON of the whole feed, for checks that nothing private leaks into it."""
    return json.dumps(read_feed(app))


def rate_limited_events(app):
    return [e for e in read_feed(app) if e["kind"] == "rate_limited"]


# ------------------------------------------------------- POST /api/device mint


def test_mint_returns_a_signed_id_with_the_exact_hmac(build):
    with TestClient(build()) as client:
        response = mint(client)
        assert response.status_code == 200
        body = response.json()
        assert set(body) == {"device", "simulated"}
        assert body["simulated"] is True
        device = body["device"]
        base, sig = split(device)
        assert re.fullmatch(r"[A-Za-z0-9-]{8,64}", base)
        assert re.fullmatch(r"[0-9a-f]{16}", sig)
        assert device == sign(base)
        assert len(device) <= 81


def test_new_ids_are_random_32_hex_characters_and_all_different(build):
    with TestClient(build()) as client:
        ids = [mint(client).json()["device"] for _ in range(5)]
    bases = [split(i)[0] for i in ids]
    assert len(set(bases)) == 5
    for base in bases:
        assert re.fullmatch(r"[0-9a-f]{32}", base)


def test_mint_works_with_enforcement_on_and_off(build):
    for enforce in (False, True):
        with TestClient(build(enforce)) as client:
            device = mint(client).json()["device"]
            assert device == sign(split(device)[0])


def test_signature_depends_on_the_server_secret(build, monkeypatch):
    import api.auth

    monkeypatch.setenv("LUNCHLOOP_SECRET", "a-different-secret")
    monkeypatch.setattr(api.auth, "_SECRET", None)
    with TestClient(build()) as client:
        device = mint(client).json()["device"]
    base, _ = split(device)
    assert device == sign(base, "a-different-secret")
    assert device != sign(base, SECRET)


def test_unknown_legacy_id_gets_a_fresh_id_and_is_never_signed(build):
    legacy = "never-seen-before-device"
    with TestClient(build()) as client:
        device = mint(client, legacy).json()["device"]
    base, _ = split(device)
    assert base != legacy
    assert device == sign(base)
    assert device != sign(legacy)
    assert re.fullmatch(r"[0-9a-f]{32}", base)


@pytest.mark.parametrize(
    "legacy",
    ["short", "has spaces in it", "bad!chars-in-this-id", "x" * 65, "", "abcdefgh.0123456789abcdef.extra"],
)
def test_invalid_legacy_values_get_a_fresh_id(build, legacy):
    with TestClient(build()) as client:
        response = mint(client, legacy)
        assert response.status_code == 200
        device = response.json()["device"]
    base, _ = split(device)
    assert device == sign(base)
    assert base != legacy


def test_already_signed_legacy_is_returned_unchanged(build):
    signed = sign("already-signed-0001")
    with TestClient(build()) as client:
        response = mint(client, signed)
        assert response.status_code == 200
        assert response.json() == {"device": signed, "simulated": True}


def test_legacy_with_a_bad_signature_is_not_trusted(build):
    base = "forged-signature-0001"
    forged = base + "." + "0" * 16
    with TestClient(build()) as client:
        device = mint(client, forged).json()["device"]
    assert device != forged
    assert split(device)[0] != base
    assert device == sign(split(device)[0])


def test_legacy_upgrade_keeps_the_streak_and_xp(build):
    legacy = "legacy-player-00001"
    # history made while enforcement is off, with the plain id
    with TestClient(build(enforce=False)) as client:
        assert vote(client, legacy).status_code == 200
        before = me(client, legacy).json()
        assert before["voted_today"] is True
        assert before["streak"] >= 1 and before["xp"] > 0
    # a second app on the same database signs that id
    with TestClient(build(enforce=True)) as client:
        signed = mint(client, legacy).json()["device"]
        assert signed == sign(legacy)
        after = me(client, signed).json()
        assert after["streak"] == before["streak"]
        assert after["xp"] == before["xp"]
        assert after["badges"] == before["badges"]
        assert after["voted_today"] is True
        # and the upgraded id is the same player, so it cannot vote again today
        assert vote(client, signed).status_code == 409


def test_legacy_player_from_another_school_is_also_upgraded(build):
    legacy = "legacy-demo-player01"
    with TestClient(build(enforce=False)) as client:
        voted = client.post("/api/vote", json={"device": legacy, "item_id": TACOS, "school": "demo"})
        assert voted.status_code == 200, voted.text
    with TestClient(build(enforce=True)) as client:
        assert mint(client, legacy).json()["device"] == sign(legacy)


# ---------------------------------------------------------------- enforcement


def tray_get(client, device):
    params = {} if device is None else {"device": device}
    return client.get("/api/tray", params=params)


def with_device(body, device):
    if device is not None:
        body["device"] = device
    return body


ENDPOINTS = {
    "vote": lambda c, d: c.post("/api/vote", json=with_device({"item_id": TACOS}, d)),
    "guess": lambda c, d: c.post("/api/guess", json=with_device({"item_id": TACOS}, d)),
    "tray_post": lambda c, d: c.post("/api/tray", json=with_device({"picks": {}}, d)),
    "served": lambda c, d: c.post("/api/served", json=with_device({"got": True}, d)),
    "me": lambda c, d: c.get("/api/me", params={} if d is None else {"device": d}),
    "tray_get": tray_get,
    "spin": lambda c, d: c.get("/api/spin", params={} if d is None else {"device": d}),
}
NEEDS_DEVICE = ["vote", "guess", "tray_post", "served", "me"]
BASE_FOR_BAD = "enforce-bad-0001"


def bad_devices():
    good = sign(BASE_FOR_BAD)
    flipped = good[:-1] + ("0" if good[-1] != "0" else "1")
    return {
        "plain": BASE_FOR_BAD,
        "tampered_sig": flipped,
        "wrong_secret": sign(BASE_FOR_BAD, "someone-elses-secret"),
        "truncated_sig": good[:-1],
        "sig_of_another_id": BASE_FOR_BAD + "." + split(sign("another-id-0001"))[1],
        "empty_sig": BASE_FOR_BAD + ".",
        "too_short_base": sign("abc"),
    }


@pytest.mark.parametrize("name", list(ENDPOINTS))
def test_enforcement_rejects_plain_and_badly_signed_ids(build, name):
    with TestClient(build(enforce=True)) as client:
        for label, device in bad_devices().items():
            response = ENDPOINTS[name](client, device)
            assert response.status_code == 400, (name, label, response.text)
            assert response.json() == E_DEVICE, (name, label)


@pytest.mark.parametrize("name", NEEDS_DEVICE)
def test_enforcement_rejects_a_missing_device(build, name):
    with TestClient(build(enforce=True)) as client:
        response = ENDPOINTS[name](client, None)
        assert response.status_code == 400
        assert response.json() == E_DEVICE


@pytest.mark.parametrize("name", ["vote", "guess", "me", "tray_get", "spin"])
def test_enforcement_accepts_a_correctly_signed_id(build, name):
    with TestClient(build(enforce=True)) as client:
        response = ENDPOINTS[name](client, sign("enforce-good-0001"))
        assert response.status_code == 200, response.text


def test_enforcement_accepts_a_signed_id_on_tray_post_and_served(build):
    device = sign("enforce-good-0002")
    with TestClient(build(enforce=True)) as client:
        packed = pack(client, device)
        assert packed.status_code == 200, packed.text
        # no tray targets today yet, so served says so, but never "invalid device"
        served = ENDPOINTS["served"](client, device)
        assert served.json() != E_DEVICE


def test_enforcement_applies_to_a_device_minted_by_the_server(build):
    with TestClient(build(enforce=True)) as client:
        device = mint(client).json()["device"]
        assert vote(client, device).status_code == 200
        assert me(client, device).json()["voted_today"] is True


def test_enforcement_does_not_apply_to_reads_without_a_player(build):
    with TestClient(build(enforce=True)) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/api/schools").status_code == 200
        assert client.get("/api/events").status_code == 200


def test_enforcement_value_must_be_one_to_turn_on(build, monkeypatch):
    # a value that is not "1" leaves enforcement off, so plain ids still work
    monkeypatch.setenv("LUNCHLOOP_SIGNED_DEVICES", "0")
    from api.main import create_app

    with TestClient(create_app()) as client:
        assert vote(client, "plain-device-0001").status_code == 200


def test_enforcement_off_accepts_plain_and_signed_ids(build):
    with TestClient(build(enforce=False)) as client:
        assert vote(client, "plain-device-0001").status_code == 200
        assert vote(client, sign("signed-device-0001")).status_code == 200
        assert guess(client, "plain-device-0001").status_code == 200
        assert guess(client, sign("signed-device-0001")).status_code == 200
        assert me(client, "plain-device-0001").status_code == 200
        assert me(client, sign("signed-device-0001")).status_code == 200
        assert spin(client, "plain-device-0001").status_code == 200
        assert spin(client, sign("signed-device-0001")).status_code == 200
        assert tray_get(client, sign("signed-device-0001")).status_code == 200


# --------------------------------------------------------- one player, two forms


def test_signed_id_and_its_base_are_one_player_plain_first(build):
    with TestClient(build(enforce=False)) as client:
        assert vote(client, BASE).status_code == 200
        second = vote(client, sign(BASE))
        assert second.status_code == 409


def test_signed_id_and_its_base_are_one_player_signed_first(build):
    with TestClient(build(enforce=False)) as client:
        assert vote(client, sign(BASE)).status_code == 200
        second = vote(client, BASE)
        assert second.status_code == 409


def test_both_forms_see_the_same_history(build):
    with TestClient(build(enforce=False)) as client:
        assert vote(client, BASE).status_code == 200
        plain = me(client, BASE).json()
        signed = me(client, sign(BASE)).json()
        for key in ("streak", "xp", "badges", "voted_today"):
            assert plain[key] == signed[key], key
        assert spin(client, sign(BASE)).json()["already_voted"] is True


def test_guess_is_also_one_per_player_across_both_forms(build):
    with TestClient(build(enforce=False)) as client:
        assert guess(client, BASE).status_code == 200
        assert guess(client, sign(BASE)).status_code == 409


def test_tray_is_also_one_per_player_across_both_forms(build):
    with TestClient(build(enforce=False)) as client:
        assert pack(client, BASE).status_code == 200
        again = pack(client, sign(BASE))
        # the existing tray contract answers a second tray the same day with 409
        assert again.status_code == 409
        assert again.json() == {"error": "already packed a tray today"}


def test_a_different_base_with_a_valid_signature_is_a_different_player(build):
    with TestClient(build(enforce=False)) as client:
        assert vote(client, sign(BASE)).status_code == 200
        assert vote(client, sign("student-abuse-0002")).status_code == 200


# ------------------------------------------------------------- per-device limits


def test_per_device_request_limit_is_60_a_minute(build):
    device = "device-req-limit-1"
    with TestClient(build()) as client:
        for number in range(DEVICE_LIMIT_REQUESTS):
            assert spin(client, device).status_code == 200, number
        blocked = spin(client, device)
        assert blocked.status_code == 429
        assert blocked.json() == SLOW
        # the limit follows the device in the JSON body too
        assert vote(client, device).status_code == 429
        # another device on the same address is fine
        assert spin(client, "device-req-limit-2").status_code == 200


def test_requests_without_a_device_only_count_per_ip(build):
    with TestClient(build()) as client:
        for number in range(DEVICE_LIMIT_REQUESTS + 40):
            assert client.get("/api/health").status_code == 200, number


def test_per_device_request_limit_reads_the_body_field_too(build):
    device = "device-req-limit-3"
    with TestClient(build()) as client:
        # 12 actions would block first, so spend the request budget with reads
        for _ in range(DEVICE_LIMIT_REQUESTS):
            assert me(client, device).status_code == 200
        assert me(client, device).status_code == 429
        assert guess(client, device).status_code == 429


def test_signed_and_plain_forms_share_the_request_budget(build):
    base = "device-req-shared-1"
    with TestClient(build()) as client:
        for _ in range(DEVICE_LIMIT_REQUESTS // 2):
            assert spin(client, base).status_code == 200
        for _ in range(DEVICE_LIMIT_REQUESTS // 2):
            assert spin(client, sign(base)).status_code == 200
        assert spin(client, base).status_code == 429
        assert spin(client, sign(base)).status_code == 429


def test_per_device_action_limit_is_12_per_ten_minutes(build):
    device = "device-act-limit-1"
    with TestClient(build()) as client:
        statuses = []
        for number in range(DEVICE_LIMIT_ACTIONS):
            send = vote if number % 2 == 0 else guess
            statuses.append(send(client, device).status_code)
        # the first vote and the first guess work; repeats are 409 but still count
        assert statuses[0] == 200 and statuses[1] == 200
        assert all(s in (200, 409) for s in statuses), statuses
        blocked = vote(client, device)
        assert blocked.status_code == 429
        assert blocked.json() == SLOW
        # other devices are not affected, and plain reads by this device still work
        assert vote(client, "device-act-limit-2").status_code == 200
        assert me(client, device).status_code == 200


def test_signed_and_plain_forms_share_the_action_budget(build):
    base = "device-act-shared-1"
    with TestClient(build()) as client:
        for number in range(DEVICE_LIMIT_ACTIONS // 2):
            assert vote(client, base).status_code in (200, 409)
            assert guess(client, sign(base)).status_code in (200, 409)
        assert vote(client, base).status_code == 429
        assert vote(client, sign(base)).status_code == 429


def test_per_device_limits_apply_with_enforcement_on(build):
    device = sign("device-enforced-1")
    with TestClient(build(enforce=True)) as client:
        for _ in range(DEVICE_LIMIT_REQUESTS):
            assert spin(client, device).status_code == 200
        blocked = spin(client, device)
        assert blocked.status_code == 429
        assert blocked.json() == SLOW


def test_per_device_limit_makes_one_event_and_holds_no_device_or_address(build):
    device = "device-event-limit-1"
    app = build()
    with TestClient(app) as client:
        for _ in range(DEVICE_LIMIT_REQUESTS):
            spin(client, device)
        for _ in range(5):
            assert spin(client, device).status_code == 429
    events = rate_limited_events(app)
    assert len(events) == 1
    event = events[0]
    assert event["school_id"] is None
    assert event["player"] is None
    assert isinstance(event["summary"], str) and event["summary"]
    raw = feed_text(app)
    assert device not in raw
    assert "device-event" not in raw
    assert "testclient" not in raw
    assert "127.0.0.1" not in raw


def test_per_device_action_limit_event_holds_no_device_or_address(build):
    device = "device-event-action-1"
    app = build()
    with TestClient(app) as client:
        for number in range(DEVICE_LIMIT_ACTIONS):
            (vote if number % 2 == 0 else guess)(client, device)
        for _ in range(3):
            assert vote(client, device).status_code == 429
    assert len(rate_limited_events(app)) == 1
    raw = feed_text(app)
    assert device not in raw
    assert "testclient" not in raw
    assert "127.0.0.1" not in raw


# ---------------------------------------------------------------- per-IP limits


def test_per_ip_request_limit_is_1200_a_minute(build):
    app = build()
    with TestClient(app) as client:
        for number in range(IP_LIMIT_REQUESTS):
            assert client.get("/api/health").status_code == 200, number
        blocked = client.get("/api/health")
        assert blocked.status_code == 429
        assert blocked.json() == SLOW
        # another address is unaffected
        other = TestClient(app, client=("198.51.100.7", 40000))
        assert other.get("/api/health").status_code == 200


def test_old_3000_a_minute_limit_is_gone(build):
    # 1200 is the default now; the request after it must be blocked, well under 3000
    with TestClient(build()) as client:
        statuses = [client.get("/api/health").status_code for _ in range(IP_LIMIT_REQUESTS + 5)]
    assert statuses[:IP_LIMIT_REQUESTS] == [200] * IP_LIMIT_REQUESTS
    assert 429 in statuses[IP_LIMIT_REQUESTS:]


def test_per_ip_action_limit_is_300_per_ten_minutes(build):
    app = build()
    with TestClient(app) as client:
        for number in range(IP_LIMIT_ACTIONS):
            response = vote(client, f"ip-act-device-{number:05d}")
            assert response.status_code == 200, (number, response.text)
        blocked = vote(client, "ip-act-device-99999")
        assert blocked.status_code == 429
        assert blocked.json() == SLOW
        # reads still work, and another address can still act
        assert client.get("/api/health").status_code == 200
        other = TestClient(app, client=("198.51.100.7", 40000))
        assert vote(other, "ip-act-device-other").status_code == 200


def test_a_shared_school_ip_can_serve_many_students(build):
    # many different devices behind one address, each well under its own limits
    with TestClient(build()) as client:
        for number in range(200):
            device = f"school-wifi-{number:05d}"
            assert spin(client, device).status_code == 200, number


def test_per_ip_limit_event_holds_no_address(build):
    app = build()
    with TestClient(app) as client:
        for _ in range(IP_LIMIT_REQUESTS):
            client.get("/api/health")
        for _ in range(3):
            assert client.get("/api/health").status_code == 429
    assert len(rate_limited_events(app)) == 1
    raw = feed_text(app)
    assert "testclient" not in raw
    assert "127.0.0.1" not in raw


# ------------------------------------------------------------------- mint limit


def test_mint_limit_is_120_per_ip_per_ten_minutes(build):
    app = build()
    with TestClient(app) as client:
        for number in range(MINT_LIMIT):
            assert mint(client).status_code == 200, number
        blocked = mint(client)
        assert blocked.status_code == 429
        assert blocked.json() == MINT_SLOW
        # a legacy upgrade or an unknown legacy mint is a mint too
        assert mint(client, "legacy-not-known-1").status_code == 429
        # other routes are not blocked by the mint limit
        assert vote(client, "mint-limit-voter-1").status_code == 200
        # another address can still mint
        other = TestClient(app, client=("198.51.100.7", 40000))
        assert mint(other).status_code == 200


def test_returning_an_already_signed_id_is_not_a_mint(build):
    signed = sign("already-signed-0002")
    with TestClient(build()) as client:
        for _ in range(MINT_LIMIT):
            assert mint(client).status_code == 200
        assert mint(client).status_code == 429
        again = mint(client, signed)
        assert again.status_code == 200
        assert again.json() == {"device": signed, "simulated": True}


def test_returning_an_already_signed_id_does_not_use_up_the_mint_budget(build):
    signed = sign("already-signed-0003")
    with TestClient(build()) as client:
        for _ in range(MINT_LIMIT):
            assert mint(client, signed).status_code == 200
        assert mint(client).status_code == 200


def test_mint_limit_makes_one_event_and_holds_no_address_or_device(build):
    app = build()
    minted = []
    with TestClient(app) as client:
        for _ in range(MINT_LIMIT):
            minted.append(mint(client).json()["device"])
        for _ in range(4):
            assert mint(client).status_code == 429
    assert len(rate_limited_events(app)) == 1
    raw = feed_text(app)
    assert "testclient" not in raw
    assert "127.0.0.1" not in raw
    for device in minted[:5]:
        assert split(device)[0] not in raw


# ------------------------------------------------------------------ demo crowd


@pytest.mark.parametrize("enforce", [False, True])
def test_demo_crowd_is_unaffected_by_enforcement_and_device_limits(build, enforce):
    with TestClient(build(enforce)) as client:
        for _ in range(2):
            response = client.post("/api/demo/crowd", json={"school": "demo", "count": 40})
            assert response.status_code == 200, response.text
            assert response.json()["ok"] is True
            assert response.json()["added"] == 40
