import hashlib
import hmac

from fastapi.testclient import TestClient


def test_device_issue_and_signature(client, monkeypatch):
    secret = b"unit-test-secret"
    monkeypatch.setenv("LUNCHLOOP_SECRET", secret.decode())
    import api.auth
    api.auth._SECRET = None
    response = client.post("/api/device")
    assert response.status_code == 200
    value = response.json()["device"]
    base, signature = value.split(".")
    expected = hmac.new(secret, ("device:" + base).encode(), hashlib.sha256).hexdigest()[:16]
    assert signature == expected


def test_signed_device_enforcement(client, monkeypatch):
    monkeypatch.setenv("LUNCHLOOP_SIGNED_DEVICES", "1")
    from api.main import create_app
    with TestClient(create_app()) as signed_client:
        assert signed_client.get("/api/me", params={"device": "plain-device-1"}).json() == {"error": "invalid device"}


def test_per_device_limit_is_configurable(monkeypatch, tmp_path):
    from pathlib import Path
    from api.main import create_app
    monkeypatch.setenv("LUNCHLOOP_DATA_DIR", str(Path("data/sample")))
    monkeypatch.setenv("LUNCHLOOP_DB", str(tmp_path / "abuse.db"))
    with TestClient(create_app(device_request_limit=2)) as c:
        assert c.get("/api/spin", params={"device": "device-abuse-1"}).status_code == 200
        assert c.get("/api/spin", params={"device": "device-abuse-1"}).status_code == 200
        assert c.get("/api/spin", params={"device": "device-abuse-1"}).status_code == 429


def _app(monkeypatch, tmp_path, **env):
    from pathlib import Path
    import api.auth
    from api.main import create_app

    monkeypatch.setenv("LUNCHLOOP_SECRET", "unit-test-secret")
    monkeypatch.setattr(api.auth, "_SECRET", None)
    monkeypatch.setenv("LUNCHLOOP_DATA_DIR", str(Path(__file__).resolve().parents[2] / "data" / "sample"))
    monkeypatch.setenv("LUNCHLOOP_DB", str(tmp_path / "abuse-extra.db"))
    monkeypatch.setenv("LUNCHLOOP_TODAY", "2026-10-19")
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    return create_app()


def test_every_limit_is_read_from_env(monkeypatch, tmp_path):
    app = _app(
        monkeypatch, tmp_path,
        LUNCHLOOP_IP_REQUESTS="7", LUNCHLOOP_IP_ACTIONS="8", LUNCHLOOP_DEVICE_REQUESTS="9",
        LUNCHLOOP_DEVICE_ACTIONS="10", LUNCHLOOP_DEVICE_MINTS="11",
    )
    with TestClient(app) as c:
        # IP request limit: 7 requests pass, the 8th is refused
        assert [c.get("/api/health").status_code for _ in range(8)] == [200] * 7 + [429]


def test_bad_limit_env_fails_at_startup(monkeypatch, tmp_path):
    import pytest

    with pytest.raises(ValueError, match="LUNCHLOOP_DEVICE_ACTIONS"):
        _app(monkeypatch, tmp_path, LUNCHLOOP_DEVICE_ACTIONS="lots")
    monkeypatch.delenv("LUNCHLOOP_DEVICE_ACTIONS")
    with pytest.raises(ValueError, match="LUNCHLOOP_DEVICE_MINTS"):
        _app(monkeypatch, tmp_path, LUNCHLOOP_DEVICE_MINTS="0")


def test_signing_a_known_legacy_id_counts_as_a_mint(monkeypatch, tmp_path):
    with TestClient(_app(monkeypatch, tmp_path, LUNCHLOOP_DEVICE_MINTS="2")) as c:
        assert c.get("/api/me", params={"device": "legacy-known-0001"}).status_code == 200
        first = c.post("/api/device", json={"legacy": "legacy-known-0001"})
        assert first.json()["device"].startswith("legacy-known-0001.")
        assert c.post("/api/device", json={"legacy": "legacy-known-0001"}).status_code == 200
        blocked = c.post("/api/device", json={"legacy": "legacy-known-0001"})
        assert blocked.status_code == 429
        assert blocked.json() == {"error": "too many new players from this network, try again soon"}
        # handing back an already signed id is not a mint, so it still works
        assert c.post("/api/device", json={"legacy": first.json()["device"]}).json()["device"] == first.json()["device"]


def test_events_feed_has_no_limit_bypass(monkeypatch, tmp_path):
    app = _app(monkeypatch, tmp_path, LUNCHLOOP_IP_REQUESTS="3")
    with TestClient(app, client=("198.51.100.20", 1234)) as c:
        statuses = [c.get("/api/events", params={"limit": 100}).status_code for _ in range(4)]
    assert statuses == [200, 200, 200, 429]


def test_a_forged_signature_does_not_use_up_the_real_device_budget(monkeypatch, tmp_path):
    with TestClient(_app(monkeypatch, tmp_path, LUNCHLOOP_DEVICE_REQUESTS="2")) as c:
        for _ in range(3):
            assert c.get("/api/me", params={"device": "victim-device-01.0000000000000000"}).status_code == 400
        assert c.get("/api/me", params={"device": "victim-device-01"}).status_code == 200


def test_rate_limited_event_repeats_each_minute_of_blocked_requests(monkeypatch, tmp_path):
    # Only blocked requests arrive, so nothing else gets a chance to clear the
    # one-event-per-minute marker: it must still allow a new event a minute later.
    import api.limits

    clock = [100.0]
    monkeypatch.setattr(api.limits.time, "monotonic", lambda: clock[0])
    app = _app(monkeypatch, tmp_path, LUNCHLOOP_IP_ACTIONS="1")
    with TestClient(app) as c:
        vote = {"device": "event-repeat-01", "item_id": "chicken_tacos"}
        assert c.post("/api/vote", json=vote).status_code == 200
        assert c.post("/api/vote", json=vote).status_code == 429
        clock[0] += 30
        assert c.post("/api/vote", json=vote).status_code == 429
        clock[0] += 31
        assert c.post("/api/vote", json=vote).status_code == 429
    kinds = [e["kind"] for e in app.state.events.after(0, 10_000)[0]]
    assert kinds.count("rate_limited") == 2
