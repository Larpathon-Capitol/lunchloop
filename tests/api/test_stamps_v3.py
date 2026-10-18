"""Stamp book badges added after v2: first tray, vote, call and check-in, plus count stamps."""

import csv
import os
from contextlib import closing
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.db import connect
from api.game import player_counts

DATA = Path(__file__).resolve().parents[2] / "data" / "sample"


@pytest.fixture
def client(monkeypatch, tmp_path):
    """The shared setup, with the per-device action limit lifted so one player can play many days."""
    monkeypatch.setenv("LUNCHLOOP_DATA_DIR", str(DATA))
    monkeypatch.setenv("LUNCHLOOP_DB", str(tmp_path / "t.db"))
    monkeypatch.setenv("LUNCHLOOP_TODAY", "2026-10-19")
    from api.main import create_app

    with TestClient(create_app(device_action_limit=1000, device_request_limit=1000)) as test_client:
        yield test_client


def rows(name):
    with (DATA / name).open(newline="") as handle:
        return list(csv.DictReader(handle))


COMPONENT = {row["item_id"]: row["component"] for row in rows("items.csv")}
MENU_DATES = sorted({row["date"] for row in rows("menu.csv")})


def day(date):
    return {"X-Demo-Date": date}


def picks_for(open_date, entree_index=0):
    """A valid tray for the school day after open_date; entree_index picks which entree."""
    target = next(d for d in MENU_DATES if d > open_date)
    groups = {}
    for row in rows("menu.csv"):
        if row["date"] == target:
            groups.setdefault(COMPONENT[row["item_id"]], []).append(row["item_id"])
    picks = {component: items[0] for component, items in groups.items()}
    entrees = groups["meat_alternate"]
    picks["meat_alternate"] = entrees[entree_index % len(entrees)]
    return picks


def pack(client, device, date, entree_index=0):
    body = {"device": device, "picks": picks_for(date, entree_index)}
    response = client.post("/api/tray", json=body, headers=day(date))
    assert response.status_code == 200, response.text


def me(client, device, date="2026-10-19"):
    response = client.get("/api/me", params={"device": device}, headers=day(date))
    assert response.status_code == 200, response.text
    return response.json()


def counts(client, device, date="2026-10-19"):
    with closing(connect(os.environ["LUNCHLOOP_DB"])) as connection:
        return player_counts(connection, device, date, client.app.state.taken)


def test_fresh_player_has_no_stamps_and_zero_counts(client):
    assert me(client, "fresh-stamps")["badges"] == []
    assert counts(client, "fresh-stamps") == {
        "trays": 0, "entrees": 0, "checkins": 0, "votes": 0, "calls": 0, "correct_calls": 0, "longest_streak": 0,
    }


def test_first_tray_vote_and_call_each_earn_a_stamp(client):
    device = "firsts-device"
    pack(client, device, "2026-10-19")
    assert "first_tray" in me(client, device)["badges"]
    assert "first_vote" not in me(client, device)["badges"]

    assert client.post("/api/vote", json={"device": device, "item_id": "chicken_tacos"}, headers=day("2026-10-19")).status_code == 200
    assert "first_vote" in me(client, device)["badges"]

    target = next(d for d in MENU_DATES if d > "2026-10-19")
    entree = next(r["item_id"] for r in rows("menu.csv") if r["date"] == target and COMPONENT[r["item_id"]] == "meat_alternate")
    assert client.post("/api/guess", json={"device": device, "item_id": entree}, headers=day("2026-10-19")).status_code == 200
    badges = me(client, device)["badges"]
    assert {"first_tray", "first_vote", "first_call"} <= set(badges)
    assert "called_it_1" not in badges  # not scored until lunch is over
    assert counts(client, device) == {
        "trays": 1, "entrees": 1, "checkins": 0, "votes": 1, "calls": 1, "correct_calls": 0, "longest_streak": 1,
    }


def test_check_in_stamp_needs_an_answer_to_how_was_lunch(client):
    device = "checkin-device"
    pack(client, device, "2026-10-16")
    assert "first_checkin" not in me(client, device)["badges"]
    response = client.post("/api/served", json={"device": device, "got": True}, headers=day("2026-10-19"))
    assert response.status_code == 200, response.text
    assert "first_checkin" in me(client, device)["badges"]
    assert counts(client, device)["checkins"] == 1


def test_count_stamps_ten_day_streak_and_rewind(client):
    device = "regular-device"
    days = [d for d in MENU_DATES if d <= "2026-10-19"][-10:]
    for index, date in enumerate(days):
        pack(client, device, date, entree_index=index)
    for date in ("2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"):
        assert client.post("/api/vote", json={"device": device, "item_id": "chicken_tacos"}, headers=day(date)).status_code == 200

    now = counts(client, device, "2026-10-23")
    assert now["trays"] == 10 and now["votes"] == 5 and now["longest_streak"] == 14
    badges = me(client, device, "2026-10-23")["badges"]
    assert {"streak_3", "streak_7", "streak_10", "first_tray", "trays_5", "first_vote", "votes_5"} <= set(badges)
    assert ("explorer_4" in badges) == (now["entrees"] >= 4)

    # The clock rewound to before most of it: only rows dated on or before that day count.
    early = me(client, device, days[2])["badges"]
    assert "first_tray" in early and "streak_3" in early
    assert not {"trays_5", "streak_7", "streak_10", "first_vote", "votes_5"} & set(early)


def test_older_badge_ids_keep_their_place_at_the_front(client):
    device = "order-device"
    for date in [d for d in MENU_DATES if d <= "2026-10-19"][-3:]:
        pack(client, device, date)
    badges = me(client, device)["badges"]
    assert badges[0] == "streak_3"
    assert badges[1:] == ["first_tray"]


def test_explorer_counts_different_entrees_only(client):
    device = "explorer-device"
    days = [d for d in MENU_DATES if d <= "2026-10-19"][-6:]
    for date in days:
        pack(client, device, date, entree_index=0)
    expected = len({picks_for(date)["meat_alternate"] for date in days})
    assert counts(client, device)["entrees"] == expected
    assert ("explorer_4" in me(client, device)["badges"]) == (expected >= 4)
