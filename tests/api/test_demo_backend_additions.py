def test_spin_and_tray_items_include_diet_flags(client):
    spin = client.get("/api/spin").json()
    assert spin["options"]
    for item in spin["options"] + spin["pool"]:
        assert set(item) >= {"item_id", "name", "diet", "gluten_free", "dairy_free"}
    tray = client.get("/api/tray").json()
    for group in tray["groups"]:
        for item in group["items"]:
            assert set(item) >= {"diet", "gluten_free", "dairy_free"}


def test_events_scope_filters_without_changing_latest_id(client):
    client.get("/api/spin", params={"school": "live"})
    client.get("/api/spin", params={"school": "demo"})
    all_events = client.get("/api/events").json()
    live = client.get("/api/events", params={"scope": "live"}).json()
    simulated = client.get("/api/events", params={"scope": "simulated"}).json()
    assert all(event["school_id"] == "live" for event in live["events"])
    assert all(event["school_id"] != "live" for event in simulated["events"])
    assert live["latest_id"] == simulated["latest_id"] == all_events["latest_id"]


def test_demo_calendar_and_crowd_validation(client):
    calendar = client.get("/api/demo/calendar", params={"school": "demo"})
    assert calendar.status_code == 200
    assert calendar.json()["school_days"] == sorted(calendar.json()["school_days"])
    assert client.post("/api/demo/crowd", json={"school": "demo", "count": 0}).json() == {"error": "count must be 1 to 40"}
    assert client.post("/api/demo/crowd", json={"school": "live", "count": 1}).json() == {"error": "demo controls are for simulated schools"}


def test_demo_crowd_adds_votes_and_trays(client):
    result = client.post("/api/demo/crowd", json={"school": "demo", "count": 2})
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["ok"] and body["added"] == 2
    assert body["totals"]["votes"] >= 2


def test_demo_date_cors_header_is_allowed(client):
    response = client.options(
        "/api/spin",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "x-demo-date"},
    )
    assert response.status_code == 200
    assert "x-demo-date" in response.headers.get("access-control-allow-headers", "").lower() or response.headers.get("access-control-allow-headers") == "*"


def test_demo_crowd_skips_a_device_id_a_real_player_already_used(client):
    # A real player can pick any valid device id, including one the crowd would make next.
    taken = "sim-demo-2026-10-19-001"  # the first id after one sim- vote
    assert client.post("/api/vote", json={"device": taken, "item_id": "chicken_tacos"}).status_code == 200
    result = client.post("/api/demo/crowd", json={"school": "demo", "count": 3})
    assert result.status_code == 200, result.text
    assert result.json()["added"] == 3
    assert result.json()["totals"]["votes"] == 4
