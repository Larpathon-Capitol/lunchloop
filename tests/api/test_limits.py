"""Black-box tests for request limits, security headers and the docs switch.

Expected values come from docs/backend-contract.md ("Limits"). Small limits are
passed to create_app() (request_limit, vote_limit) so the tests stay fast; the
contract's real numbers are 600 requests a minute and 60 votes plus guesses in
10 minutes.
"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

DATA = Path(__file__).resolve().parents[2] / "data" / "sample"
SECRET = "unit-test-secret"
TACOS = "chicken_tacos"
SLOW = {"error": "slow down a little"}
PAGES_ORIGIN = "https://larpathon-capitol.github.io"
SECURITY = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
}


@pytest.fixture(autouse=True)
def env(monkeypatch, tmp_path):
    import api.auth

    monkeypatch.setenv("LUNCHLOOP_SECRET", SECRET)
    monkeypatch.delenv("LUNCHLOOP_SCHOOL_PASSWORDS", raising=False)
    monkeypatch.delenv("LUNCHLOOP_DOCS", raising=False)
    monkeypatch.setattr(api.auth, "_SECRET", None)
    monkeypatch.setenv("LUNCHLOOP_DATA_DIR", str(DATA))
    monkeypatch.setenv("LUNCHLOOP_DB", str(tmp_path / "t.db"))
    monkeypatch.setenv("LUNCHLOOP_TODAY", "2026-10-19")


def make_app(**limits):
    from api.main import create_app

    return create_app(**limits)


def header_map(response):
    return {key.lower(): value for key, value in response.headers.items()}


def assert_secure(response):
    headers = header_map(response)
    for key, value in SECURITY.items():
        assert headers.get(key) == value, (key, headers)


def vote(client, device):
    return client.post("/api/vote", json={"device": device, "item_id": TACOS})


def guess(client, device):
    return client.post("/api/guess", json={"device": device, "item_id": TACOS})


def read_feed(app):
    """Read the feed from a different client address, so the limit being tested does not block us."""
    reader = TestClient(app, client=("203.0.113.9", 50000))
    return reader.get("/api/events", params={"limit": 100})


def rate_limited_events(app):
    return [e for e in read_feed(app).json()["events"] if e["kind"] == "rate_limited"]


# ------------------------------------------------------------- general limit


def test_request_n_plus_one_gets_429_with_the_plain_message():
    with TestClient(make_app(request_limit=5)) as client:
        for number in range(5):
            assert client.get("/api/health").status_code == 200, number
        blocked = client.get("/api/health")
        assert blocked.status_code == 429
        assert blocked.json() == SLOW


def test_general_limit_blocks_every_route_and_method_once_spent():
    with TestClient(make_app(request_limit=3)) as client:
        for _ in range(3):
            client.get("/api/health")
        assert client.get("/api/schools").status_code == 429
        assert client.get("/api/events").status_code == 429
        assert vote(client, "device-limit-001").status_code == 429


def test_general_limit_is_per_client_address():
    app = make_app(request_limit=2)
    with TestClient(app) as client:
        client.get("/api/health")
        client.get("/api/health")
        assert client.get("/api/health").status_code == 429
        other = TestClient(app, client=("198.51.100.7", 40000))
        assert other.get("/api/health").status_code == 200


def test_default_request_limit_is_not_hit_by_a_normal_burst():
    # 600 a minute is the contract; 50 quick requests must be fine
    with TestClient(make_app()) as client:
        assert all(client.get("/api/health").status_code == 200 for _ in range(50))


def test_one_rate_limited_event_not_one_per_blocked_request():
    app = make_app(request_limit=3)
    with TestClient(app) as client:
        for _ in range(3):
            client.get("/api/health")
        for _ in range(8):
            assert client.get("/api/health").status_code == 429
    events = rate_limited_events(app)
    assert len(events) == 1
    event = events[0]
    assert event["school_id"] is None
    assert event["player"] is None
    assert isinstance(event["summary"], str) and event["summary"]


def test_rate_limited_event_holds_no_address():
    app = make_app(request_limit=1)
    with TestClient(app) as client:
        client.get("/api/health")
        client.get("/api/health")
    raw = read_feed(app).text
    assert "rate_limited" in raw
    assert "testclient" not in raw
    assert "127.0.0.1" not in raw


# -------------------------------------------------------- vote and guess limit


def test_vote_and_guess_limit_blocks_the_next_action_with_429():
    with TestClient(make_app(vote_limit=3)) as client:
        assert vote(client, "device-limit-001").status_code == 200
        assert vote(client, "device-limit-002").status_code == 200
        assert vote(client, "device-limit-003").status_code == 200
        blocked = vote(client, "device-limit-004")
        assert blocked.status_code == 429
        assert blocked.json() == SLOW


def test_votes_and_guesses_share_one_budget():
    with TestClient(make_app(vote_limit=3)) as client:
        assert vote(client, "device-limit-001").status_code == 200
        assert guess(client, "device-limit-001").status_code == 200
        assert guess(client, "device-limit-002").status_code == 200
        assert guess(client, "device-limit-003").status_code == 429
        assert vote(client, "device-limit-003").status_code == 429


def test_vote_limit_is_independent_of_the_general_limit():
    with TestClient(make_app(request_limit=1000, vote_limit=2)) as client:
        vote(client, "device-limit-001")
        vote(client, "device-limit-002")
        assert vote(client, "device-limit-003").status_code == 429
        # plain reads and sign-in are not votes or guesses, so they still work
        assert client.get("/api/health").status_code == 200
        assert client.get("/api/spin", params={"device": "device-limit-003"}).status_code == 200
        login = client.post("/api/admin/login", json={"school_id": "demo", "password": "lunchloop"})
        assert login.status_code == 200


def test_general_limit_is_independent_of_the_vote_limit():
    with TestClient(make_app(request_limit=3, vote_limit=1000)) as client:
        for _ in range(3):
            assert client.get("/api/health").status_code == 200
        assert client.get("/api/health").status_code == 429


def test_reads_do_not_use_up_the_vote_budget():
    with TestClient(make_app(request_limit=1000, vote_limit=2)) as client:
        for _ in range(20):
            client.get("/api/spin")
        assert vote(client, "device-limit-001").status_code == 200
        assert vote(client, "device-limit-002").status_code == 200


def test_vote_limit_makes_one_rate_limited_event():
    app = make_app(request_limit=1000, vote_limit=1)
    with TestClient(app) as client:
        vote(client, "device-limit-001")
        for number in range(2, 7):
            assert vote(client, f"device-limit-00{number}").status_code == 429
    assert len(rate_limited_events(app)) == 1


# ---------------------------------------------------------------- body size


def test_body_over_16_kb_is_413():
    big = {"device": "device-limit-001", "item_id": TACOS, "pad": "x" * (17 * 1024)}
    with TestClient(make_app()) as client:
        response = client.post("/api/vote", json=big)
        assert response.status_code == 413
        assert "error" in response.json()
        assert_secure(response)


def test_oversized_body_is_413_on_other_post_routes_too():
    big = {"school_id": "demo", "password": "lunchloop", "pad": "x" * (20 * 1024)}
    with TestClient(make_app()) as client:
        assert client.post("/api/admin/login", json=big).status_code == 413
        assert client.post("/api/simulate", json={"pad": "x" * (20 * 1024)}).status_code == 413


def test_body_under_16_kb_is_not_413():
    body = {"device": "device-limit-001", "item_id": TACOS, "pad": "x" * (10 * 1024)}
    with TestClient(make_app()) as client:
        assert client.post("/api/vote", json=body).status_code != 413


def test_chunked_oversized_body_is_413():
    # 20 chunks of 1 KB = 20 KB sent with no Content-Length header
    def chunks():
        for _ in range(20):
            yield b"x" * 1024

    with TestClient(make_app()) as client:
        response = client.post(
            "/api/vote", content=chunks(), headers={"content-type": "application/json"}
        )
        assert response.status_code == 413


# ------------------------------------------------------------ security headers


def test_security_headers_on_a_200():
    with TestClient(make_app()) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert_secure(response)


def test_security_headers_on_a_404():
    with TestClient(make_app()) as client:
        response = client.get("/api/does-not-exist")
        assert response.status_code == 404
        assert_secure(response)


def test_security_headers_on_a_route_404():
    with TestClient(make_app()) as client:
        response = client.get("/api/spin", params={"school": "nowhere"})
        assert response.status_code == 404
        assert_secure(response)


def test_security_headers_on_a_400():
    with TestClient(make_app()) as client:
        response = client.get("/api/events", params={"after": "abc"})
        assert response.status_code == 400
        assert_secure(response)


def test_security_headers_on_a_429():
    with TestClient(make_app(request_limit=1)) as client:
        client.get("/api/health")
        response = client.get("/api/health")
        assert response.status_code == 429
        assert_secure(response)


def test_security_headers_on_a_vote_limit_429():
    with TestClient(make_app(vote_limit=1)) as client:
        vote(client, "device-limit-001")
        response = vote(client, "device-limit-002")
        assert response.status_code == 429
        assert_secure(response)


def test_security_headers_on_a_cors_preflight(monkeypatch):
    monkeypatch.setenv("LUNCHLOOP_CORS_ORIGIN", PAGES_ORIGIN)
    with TestClient(make_app()) as client:
        response = client.options(
            "/api/vote",
            headers={
                "Origin": PAGES_ORIGIN,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert response.status_code == 200
        assert header_map(response).get("access-control-allow-origin") == PAGES_ORIGIN
        assert_secure(response)


def test_security_headers_on_a_preflight_with_default_cors():
    with TestClient(make_app()) as client:
        response = client.options(
            "/api/vote",
            headers={"Origin": PAGES_ORIGIN, "Access-Control-Request-Method": "POST"},
        )
        assert response.status_code == 200
        assert_secure(response)


# ---------------------------------------------------------------- no-store


def test_admin_login_and_summary_are_not_cached():
    with TestClient(make_app()) as client:
        login = client.post("/api/admin/login", json={"school_id": "demo", "password": "lunchloop"})
        assert login.status_code == 200
        assert header_map(login).get("cache-control") == "no-store"
        assert_secure(login)
        token = login.json()["token"]
        summary = client.get("/api/admin/summary", headers={"Authorization": f"Bearer {token}"})
        assert summary.status_code == 200
        assert header_map(summary).get("cache-control") == "no-store"
        assert_secure(summary)


def test_admin_error_responses_are_not_cached_either():
    with TestClient(make_app()) as client:
        failed = client.post("/api/admin/login", json={"school_id": "demo", "password": "wrong-one"})
        assert failed.status_code == 401
        assert header_map(failed).get("cache-control") == "no-store"
        unauthorised = client.get("/api/admin/summary")
        assert unauthorised.status_code == 401
        assert header_map(unauthorised).get("cache-control") == "no-store"


# -------------------------------------------------------------------- docs


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
def test_interactive_docs_are_off_by_default(path):
    with TestClient(make_app()) as client:
        assert client.get(path).status_code == 404


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
def test_interactive_docs_are_on_with_the_env_switch(monkeypatch, path):
    monkeypatch.setenv("LUNCHLOOP_DOCS", "1")
    with TestClient(make_app()) as client:
        response = client.get(path)
        assert response.status_code == 200
        assert_secure(response)


@pytest.mark.parametrize("value", ["0", "", "true", "yes"])
def test_docs_stay_off_unless_the_value_is_exactly_one(monkeypatch, value):
    monkeypatch.setenv("LUNCHLOOP_DOCS", value)
    with TestClient(make_app()) as client:
        assert client.get("/openapi.json").status_code == 404


def test_rate_limited_response_still_carries_cors_headers(monkeypatch):
    # Without CORS headers the browser hides the 429 and the page looks offline.
    monkeypatch.setenv("LUNCHLOOP_CORS_ORIGIN", "https://larpathon-capitol.github.io")
    origin = {"Origin": "https://larpathon-capitol.github.io"}
    with TestClient(make_app(request_limit=2)) as client:
        client.get("/api/health", headers=origin)
        client.get("/api/health", headers=origin)
        blocked = client.get("/api/health", headers=origin)
        assert blocked.status_code == 429
        assert header_map(blocked)["access-control-allow-origin"] == "https://larpathon-capitol.github.io"
        assert_secure(blocked)


def test_savings_cache_stays_bounded(client):
    import importlib

    _backtest = importlib.import_module("engine._backtest")

    for n in range(40):
        assert client.get(f"/api/savings?ratio={1 + n / 10}").status_code == 200
    assert len(_backtest._CACHE) <= 32


def test_savings_weeks_are_capped_at_twelve(client):
    assert client.get("/api/savings?weeks=52").status_code == 400


def test_first_rate_limit_is_logged_soon_after_boot(monkeypatch):
    # The limiter's clock starts at boot; a fresh machine must still log the first block.
    import api.limits

    monkeypatch.setattr(api.limits.time, "monotonic", lambda: 5.0)
    app = make_app(request_limit=1)
    with TestClient(app) as client:
        client.get("/api/health")
        assert client.get("/api/health").status_code == 429
    assert [e["kind"] for e in app.state.events.after(0, 10_000)[0]].count("rate_limited") == 1
