"""Backend coverage for free leftovers and lunch service check-ins."""

from api.db import connect


def _day(date):
    return {"X-Demo-Date": date}


def _token(client):
    response = client.post("/api/admin/login", json={"school_id": "demo", "password": "lunchloop"})
    assert response.status_code == 200
    return response.json()["token"]


def _pack(client, device="free-test-1"):
    tray = client.get("/api/tray", params={"device": device})
    assert tray.status_code == 200
    picks = {group["component"]: group["items"][0]["item_id"] for group in tray.json()["groups"]}
    response = client.post("/api/tray", json={"device": device, "picks": picks})
    assert response.status_code == 200, response.text


def test_served_requires_today_tray_and_upserts(client):
    device = "served-test-1"
    response = client.post("/api/served", json={"device": device, "got": True})
    assert response.status_code == 404
    crowd = client.post("/api/demo/crowd", json={"school": "demo", "count": 1})
    assert crowd.status_code == 200
    # The crowd makes yesterday's students (previous school day, Friday 10-16) who ate today.
    device = "sim-demo-2026-10-16-000"
    first = client.post("/api/served", json={"device": device, "got": True})
    second = client.post("/api/served", json={"device": device, "got": False})
    assert first.json()["got"] is True and second.json()["got"] is False
    lunch = client.get("/api/me", params={"device": device}).json()["today_lunch"]
    assert lunch["checked_in"] is False


def test_free_toggle_public_shape_and_menu_validation(client):
    token = _token(client)
    headers = {"Authorization": f"Bearer {token}"}
    menu_item = "cheese_pizza"
    response = client.post("/api/admin/free", headers=headers, json={"item_id": menu_item, "free": True})
    assert response.status_code == 200
    assert response.json()["free"][0]["item_id"] == menu_item
    again = client.post("/api/admin/free", headers=headers, json={"item_id": menu_item, "free": True})
    assert len(again.json()["free"]) == 1
    public = client.get("/api/free")
    assert set(public.json()) == {"date", "free", "simulated"}
    assert set(public.json()["free"][0]) == {"item_id", "name", "component", "since"}
    off_menu = client.post("/api/admin/free", headers=headers, json={"item_id": "not-on-menu", "free": True})
    assert off_menu.status_code == 400
    ended = client.post("/api/admin/free", headers=headers, json={"item_id": menu_item, "free": False})
    assert ended.status_code == 200 and ended.json()["free"] == []


def test_summary_service_counts_and_crowd_checkins(client):
    token = _token(client)
    response = client.post("/api/demo/crowd", json={"school": "demo", "count": 10})
    assert response.status_code == 200
    assert 0 <= response.json()["totals"]["checked_in"] <= 10
    summary = client.get("/api/admin/summary", headers={"Authorization": f"Bearer {token}"}).json()
    service = summary["service"]
    assert service["packed"] == 10
    assert service["checked_in"] == service["got"] + service["missed"]
    assert service["checked_in"] <= service["packed"]
    assert all(set(item) == {"item_id", "name", "component", "wanted", "got", "missed", "waiting", "free"} for item in service["items"])
