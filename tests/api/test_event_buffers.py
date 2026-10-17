from api.events import EventStore


def test_simulated_flood_does_not_evict_live_events():
    store = EventStore(capacity=10)
    store.add("vote", "live", "real-device", "A live vote")
    for n in range(50):
        store.add("vote", "demo", f"sim-{n}", "A simulated vote")
    live, latest = store.after(0, 100, "live")
    assert [event["summary"] for event in live] == ["A live vote"]
    simulated, _ = store.after(0, 100, "simulated")
    assert len(simulated) == 10 and simulated[-1]["id"] == latest == 51
    everything, _ = store.after(0, 100)
    assert [event["id"] for event in everything] == sorted(event["id"] for event in everything)
    assert everything[0]["school_id"] == "live" and len(everything) == 11
