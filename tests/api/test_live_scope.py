"""The live school ignores a presenter's stepped demo date on every student read.

A presenter can step the simulated school's calendar in their browser, which sends
X-Demo-Date on every request. Opening the live game in the same browser must still
show the live school's real day for the date, the menu and the waste meter.
"""

STEPPED = {"X-Demo-Date": "2026-10-20"}


def test_health_uses_the_live_day_when_asked_for_the_live_school(client):
    assert client.get("/api/health", headers=STEPPED).json()["today"] == "2026-10-20"
    assert client.get("/api/health?school=live", headers=STEPPED).json()["today"] == "2026-10-19"


def test_prep_without_a_date_reads_the_live_day_for_the_live_school(client):
    demo = client.get("/api/prep", headers=STEPPED).json()
    live = client.get("/api/prep?school=live", headers=STEPPED).json()
    assert demo["date"] == "2026-10-20"
    assert live["date"] == "2026-10-19"


def meter_dates(client):
    return [e["detail"]["date"] for e in client.get("/api/events").json()["events"] if e["kind"] == "meter"]


def test_meter_reads_the_live_day_for_the_live_school(client):
    # The meter's totals don't change with the day in the sample data, so check the day the
    # engine was asked about, which the event log records.
    assert client.get("/api/meter", headers=STEPPED).status_code == 200
    assert client.get("/api/meter?school=live", headers=STEPPED).status_code == 200
    assert meter_dates(client) == ["2026-10-20", "2026-10-19"]


def test_unknown_school_is_rejected(client):
    assert client.get("/api/health?school=nope").status_code == 404
