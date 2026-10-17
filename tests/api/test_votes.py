"""Black-box tests for the live vote tally route."""

import csv
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "data" / "sample"


def demo_headers(date):
    return {"X-Demo-Date": date}


def option_row(date):
    with (DATA / "vote_options.csv").open(newline="") as f:
        return next(r for r in csv.DictReader(f) if r["open_date"] == date)


def test_votes_empty_tally(client):
    body = client.get("/api/votes").json()
    assert body["simulated"] is True
    assert body["total"] == 0
    assert [o["votes"] for o in body["options"]] == [0, 0, 0]
    assert all(o["share"] == 0.0 for o in body["options"])
    assert body["days"] == []


def test_votes_counts_live_votes(client):
    options = option_row("2026-10-19")
    first, second = options["option_1"], options["option_2"]
    for device, item in (("device-aaaa", first), ("device-bbbb", first), ("device-cccc", second)):
        assert client.post("/api/vote", json={"device": device, "item_id": item}).status_code == 200
    body = client.get("/api/votes").json()
    by_item = {o["item_id"]: o for o in body["options"]}
    assert body["total"] == 3
    assert by_item[first]["votes"] == 2
    assert by_item[first]["share"] == round(2 / 3, 4)
    assert by_item[second]["votes"] == 1
    assert body["days"] == [{"date": "2026-10-19", "votes": 3}]


def test_votes_unknown_day_is_404(client):
    response = client.get("/api/votes", headers=demo_headers("2026-10-17"))
    assert response.status_code == 404
    assert response.json() == {"error": "no voting today"}
