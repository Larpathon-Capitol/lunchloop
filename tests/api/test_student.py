"""Black-box tests for student voting and guessing routes."""

import csv
import shutil
from pathlib import Path

import pytest

from fastapi.testclient import TestClient

DATA = Path(__file__).resolve().parents[2] / "data" / "sample"


def demo_headers(date):
    return {"X-Demo-Date": date}


def rows(name):
    with (DATA / name).open(newline="") as f:
        return list(csv.DictReader(f))


def copy_sample(tmp_path):
    data_dir = tmp_path / "data"
    shutil.copytree(DATA, data_dir)
    return data_dir


def custom_client(monkeypatch, data_dir, tmp_path):
    monkeypatch.setenv("LUNCHLOOP_DATA_DIR", str(data_dir))
    monkeypatch.setenv("LUNCHLOOP_DB", str(tmp_path / "lunchloop.db"))
    monkeypatch.setenv("LUNCHLOOP_TODAY", "2026-10-19")
    from api.main import create_app

    return TestClient(create_app())


def item_map():
    return {r["item_id"]: r for r in rows("items.csv")}


def option_row(date):
    return next(r for r in rows("vote_options.csv") if r["open_date"] == date)


def expected_guess_winner(date):
    values = [
        r
        for r in rows("future_meals.csv")
        if r["date"] == date and r["component"] == "meat_alternate"
    ]
    high = max(int(r["servings_taken"]) for r in values)
    return {r["item_id"] for r in values if int(r["servings_taken"]) == high}


def next_menu_date(date):
    dates = sorted({r["date"] for r in rows("menu.csv") if r["date"] > date})
    return dates[0]


def assert_success(payload):
    assert payload.get("simulated") is True


def assert_error(response):
    assert isinstance(response.json(), dict)
    assert set(response.json()) == {"error"}
    assert isinstance(response.json()["error"], str)


def vote(client, device, item="chicken_tacos", date=None):
    headers = demo_headers(date) if date else {}
    return client.post("/api/vote", json={"device": device, "item_id": item}, headers=headers)


def test_health_clock_and_date_errors(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "today": "2026-10-19",
        "simulated": True,
    }
    assert set(response.json()) == {"ok", "today", "simulated"}
    moved = client.get("/api/health", headers=demo_headers("2026-10-20"))
    assert moved.status_code == 200
    assert moved.json()["today"] == "2026-10-20"
    for value in ("2026-13-01", "tomorrow"):
        bad = client.get("/api/health", headers=demo_headers(value))
        assert bad.status_code == 400
        assert_error(bad)


def test_spin_uses_csv_options_and_allergens(client):
    response = client.get("/api/spin?device=device-01")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {
        "date", "target_date", "target_slot", "options", "already_voted", "simulated"
    }
    assert_success(body)
    expected = option_row("2026-10-19")
    items = item_map()
    assert body["date"] == expected["open_date"]
    assert body["target_date"] == expected["target_date"]
    assert body["target_slot"] == expected["target_slot"]
    assert [o["item_id"] for o in body["options"]] == [expected[f"option_{i}"] for i in range(1, 4)]
    for option in body["options"]:
        assert set(option) == {"item_id", "name", "allergens"}
        raw = items[option["item_id"]]["allergens"]
        assert option["name"] == items[option["item_id"]]["name"]
        assert option["allergens"] == [x for x in raw.split(";") if x]
    assert body["already_voted"] is False
    assert vote(client, "device-01", expected["option_1"]).status_code == 200
    after_vote = client.get("/api/spin?device=device-01")
    assert after_vote.status_code == 200
    assert_success(after_vote.json())
    assert after_vote.json()["already_voted"] is True
    assert client.get("/api/spin", headers=demo_headers("2026-10-16")).status_code == 404
    assert client.get("/api/spin", headers=demo_headers("2026-10-17")).status_code == 404
    assert_error(client.get("/api/spin?device=bad device"))


def test_vote_tally_validation_and_duplicate(client):
    opts = [option_row("2026-10-19")[f"option_{i}"] for i in range(1, 4)]
    first = vote(client, "device-01", opts[0])
    assert first.status_code == 200
    body = first.json()
    assert_success(body)
    assert set(body) == {"ok", "streak", "xp", "tally", "simulated"}
    assert body["ok"] is True
    assert body["streak"] == 1 and body["xp"] == 10
    assert body["tally"] == {x: 1 if x == opts[0] else 0 for x in opts}
    second_device = vote(client, "device-02", opts[1])
    assert second_device.status_code == 200
    assert second_device.json()["tally"] == {x: 1 for x in opts[:2]} | {opts[2]: 0}
    duplicate = vote(client, "device-01", opts[0])
    assert duplicate.status_code == 409
    assert_error(duplicate)
    for payload, expected_status in (
        ({"device": "device-03", "item_id": "unknown_item"}, 404),
        ({"device": "device-03", "item_id": "wheat_roll"}, 400),
        ({"device": "bad device", "item_id": opts[0]}, 400),
        ({"device": "device-03"}, 400),
    ):
        bad = client.post("/api/vote", json=payload)
        assert bad.status_code == expected_status
        assert_error(bad)
    malformed = client.post(
        "/api/vote", content="not-json", headers={"content-type": "application/json"}
    )
    assert malformed.status_code == 400
    assert_error(malformed)


def test_vote_weekend_streak_and_badge_persistence(client):
    device = "streak-device"
    friday = vote(client, device, date="2026-10-23")
    assert friday.status_code == 200 and friday.json()["streak"] == 1
    for day in ("2026-10-24", "2026-10-25"):
        me = client.get(f"/api/me?device={device}", headers=demo_headers(day))
        assert me.status_code == 200 and me.json()["streak"] == 1
    assert vote(client, device, date="2026-10-25").status_code == 404
    monday = vote(client, device, date="2026-10-26")
    assert monday.status_code == 200 and monday.json()["streak"] == 2
    skipped = client.get(f"/api/me?device={device}", headers=demo_headers("2026-10-28"))
    assert skipped.json()["streak"] == 0
    wednesday = vote(client, device, date="2026-10-28")
    assert wednesday.status_code == 200 and wednesday.json()["streak"] == 1
    me = client.get(f"/api/me?device={device}", headers=demo_headers("2026-10-28"))
    assert "streak_3" not in me.json()["badges"]


def test_streak_three_badge_is_permanent_after_break(client):
    device = "badge-device"
    for day in ("2026-10-19", "2026-10-20", "2026-10-21"):
        assert vote(client, device, date=day).status_code == 200
    earned = client.get(f"/api/me?device={device}", headers=demo_headers("2026-10-21"))
    assert "streak_3" in earned.json()["badges"]
    broken = client.get(f"/api/me?device={device}", headers=demo_headers("2026-10-23"))
    assert broken.json()["streak"] == 0
    assert "streak_3" in broken.json()["badges"]


def test_guess_target_validation_and_duplicate(client):
    winner = next(iter(expected_guess_winner("2026-10-20")))
    guessed = client.post("/api/guess", json={"device": "guess-dev", "item_id": winner})
    assert guessed.status_code == 200
    assert_success(guessed.json())
    assert set(guessed.json()) == {"ok", "target_date", "simulated"}
    assert guessed.json()["ok"] is True
    assert guessed.json()["target_date"] == "2026-10-20"
    duplicate = client.post("/api/guess", json={"device": "guess-dev", "item_id": winner})
    assert duplicate.status_code == 409
    assert_error(duplicate)
    friday = client.post(
        "/api/guess",
        json={"device": "friday-dev", "item_id": winner},
        headers=demo_headers("2026-10-23"),
    )
    assert friday.status_code == 200 and friday.json()["target_date"] == "2026-10-26"
    for day in ("2026-10-30", "2026-10-24"):
        bad = client.post(
            "/api/guess",
            json={"device": "new-device", "item_id": winner},
            headers=demo_headers(day),
        )
        assert bad.status_code == 404
        assert_error(bad)
    for item in ("wheat_roll", "cheese_pizza"):
        bad = client.post("/api/guess", json={"device": "other-device", "item_id": item})
        assert bad.status_code == 400
        assert_error(bad)
    unknown = client.post("/api/guess", json={"device": "other-device", "item_id": "nope"})
    assert unknown.status_code == 404
    assert_error(unknown)


def test_guess_scoring_xp_badge_and_clock_rewind(client):
    device = "score-device"
    winner = next(iter(expected_guess_winner("2026-10-20")))
    target_options = {
        r["item_id"]
        for r in rows("menu.csv")
        if r["date"] == "2026-10-20"
        and r["item_id"] in {"chicken_tacos", "cheese_pizza", "popcorn_chicken"}
    }
    loser = (target_options - expected_guess_winner("2026-10-20")).pop()
    assert client.post("/api/guess", json={"device": device, "item_id": winner}).status_code == 200
    before_response = client.get(f"/api/me?device={device}", headers=demo_headers("2026-10-20"))
    assert_success(before_response.json())
    before = before_response.json()
    assert before["last_guess"]["correct"] is None and before["xp"] == 0
    assert before["correct_calls"] == 0
    scored_response = client.get(f"/api/me?device={device}", headers=demo_headers("2026-10-21"))
    assert_success(scored_response.json())
    scored = scored_response.json()
    assert set(scored) == {
        "device", "streak", "xp", "badges", "last_guess", "voted_today", "packed_today", "correct_calls", "simulated"
    }
    assert set(scored["last_guess"]) == {"target_date", "item_id", "correct"}
    assert scored["last_guess"]["correct"] is True and scored["xp"] == 25
    assert scored["correct_calls"] == 1
    assert (
        client.get(
            f"/api/me?device={device}", headers=demo_headers("2026-10-21")
        ).json()["xp"]
        == 25
    )
    rewind = client.get(f"/api/me?device={device}", headers=demo_headers("2026-10-20")).json()
    assert rewind["last_guess"]["correct"] is None and rewind["xp"] == 0
    wrong = "wrong-device"
    assert client.post("/api/guess", json={"device": wrong, "item_id": loser}).status_code == 200
    wrong_result = client.get(f"/api/me?device={wrong}", headers=demo_headers("2026-10-21")).json()
    assert wrong_result["last_guess"]["correct"] is False and wrong_result["xp"] == 0
    assert wrong_result["correct_calls"] == 0


def test_called_it_badge_after_five_csv_winners(client):
    device = "called-it-device"
    open_dates = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]
    targets = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-26"]
    for day, target in zip(open_dates, targets):
        winner = next(iter(expected_guess_winner(target)))
        response = client.post(
            "/api/guess",
            json={"device": device, "item_id": winner},
            headers=demo_headers(day),
        )
        assert response.status_code == 200
    result = client.get(f"/api/me?device={device}", headers=demo_headers("2026-10-27"))
    assert result.status_code == 200
    assert "called_it_5" in result.json()["badges"]
    assert result.json()["correct_calls"] == 5
    early = client.get(f"/api/me?device={device}", headers=demo_headers("2026-10-22")).json()
    assert early["correct_calls"] == 2


def test_unknown_route_and_method_are_error_objects(client):
    unknown = client.get("/api/no-such-route")
    assert unknown.status_code == 404
    assert_error(unknown)
    method = client.get("/api/vote")
    assert method.status_code == 405
    assert_error(method)


def test_tied_guess_winners_are_both_correct(monkeypatch, tmp_path):
    data_dir = copy_sample(tmp_path)
    future_path = data_dir / "future_meals.csv"
    with future_path.open(newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames
        assert fieldnames is not None
        future_rows = list(reader)
    tied = [
        row
        for row in future_rows
        if row["date"] == "2026-10-20" and row["component"] == "meat_alternate"
    ]
    assert len(tied) == 2
    for row in tied:
        row["servings_taken"] = "300"
        row["sold_out"] = "0"
    with future_path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(future_rows)

    with custom_client(monkeypatch, data_dir, tmp_path) as custom:
        for device, row in zip(("tie-device-1", "tie-device-2"), tied):
            guess = custom.post(
                "/api/guess",
                json={"device": device, "item_id": row["item_id"]},
                headers=demo_headers("2026-10-19"),
            )
            assert guess.status_code == 200
        for device in ("tie-device-1", "tie-device-2"):
            result = custom.get(
                "/api/me",
                params={"device": device},
                headers=demo_headers("2026-10-21"),
            )
            assert result.status_code == 200
            assert result.json()["last_guess"]["correct"] is True
            assert result.json()["xp"] == 25


def test_streak_seven_badge_and_six_day_boundary(client):
    device = "seven-day-device"
    days = (
        "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22",
        "2026-10-23", "2026-10-26", "2026-10-27",
    )
    item = option_row(days[0])["option_1"]
    for day in days[:6]:
        response = vote(client, device, item, day)
        assert response.status_code == 200
    six = client.get("/api/me", params={"device": device}, headers=demo_headers(days[5]))
    assert six.status_code == 200
    assert six.json()["streak"] == 6
    assert "streak_7" not in six.json()["badges"]
    seventh = vote(client, device, item, days[6])
    assert seventh.status_code == 200
    result = client.get("/api/me", params={"device": device}, headers=demo_headers(days[6]))
    assert result.json()["streak"] == 7
    assert "streak_7" in result.json()["badges"]


def test_vote_clock_rewind_hides_future_vote(client):
    device = "rewind-device"
    item = option_row("2026-10-19")["option_1"]
    assert vote(client, device, item, "2026-10-19").status_code == 200
    assert vote(client, device, item, "2026-10-21").status_code == 200
    current = client.get(
        "/api/me", params={"device": device}, headers=demo_headers("2026-10-19")
    )
    assert current.json()["xp"] == 10
    assert current.json()["streak"] == 1
    rewind = client.get(
        "/api/me", params={"device": device}, headers=demo_headers("2026-10-16")
    )
    assert rewind.json()["xp"] == 0
    assert rewind.json()["streak"] == 0


def test_new_device_spin_me_and_guess(client):
    device = "brand-new-device"
    spin = client.get("/api/spin", params={"device": device})
    assert spin.status_code == 200
    me = client.get("/api/me", params={"device": device})
    assert me.status_code == 200
    assert me.json()["xp"] == 0
    assert me.json()["streak"] == 0
    guess = client.post(
        "/api/guess", json={"device": device, "item_id": "chicken_tacos"}
    )
    assert guess.status_code == 200
    assert guess.json()["ok"] is True
