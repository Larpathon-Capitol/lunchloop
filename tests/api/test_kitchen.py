"""Black-box tests for the kitchen engine endpoints."""


import engine


def test_engine_stubs_return_not_ready(client, monkeypatch):
    def not_ready(**kwargs):
        raise NotImplementedError

    for name in ("prep_list", "backtest", "simulate", "meter"):
        monkeypatch.setattr(engine, name, not_ready)
    requests = (
        client.get("/api/prep"),
        client.get("/api/savings"),
        client.post("/api/simulate", json={}),
        client.get("/api/meter"),
    )
    for response in requests:
        assert response.status_code == 501
        assert response.json() == {"error": "engine not ready"}


def test_prep_passes_defaults_date_data_dir_and_result(client, monkeypatch):
    calls = []

    def fake_prep_list(**kwargs):
        calls.append(kwargs)
        return {"date": kwargs["date"], "items": [], "meal_check": {"ok": True}}

    monkeypatch.setattr(engine, "prep_list", fake_prep_list)
    response = client.get("/api/prep")
    assert response.status_code == 200
    assert response.json()["simulated"] is True
    assert response.json()["date"] == "2026-10-19"
    assert calls and calls[0]["date"] == "2026-10-19"
    assert calls[0]["ratio"] == 3.0
    assert calls[0]["data_dir"].endswith("data/sample")

    response = client.get("/api/prep", headers={"X-Demo-Date": "2026-10-20"})
    assert response.status_code == 200
    assert calls[-1]["date"] == "2026-10-20"


def test_prep_validates_dates_and_does_not_call_engine_for_unknown_menu_date(client, monkeypatch):
    calls = []

    def fake_prep_list(**kwargs):
        calls.append(kwargs)
        return {}

    monkeypatch.setattr(engine, "prep_list", fake_prep_list)
    for value in ("2026-02-30", "abc"):
        response = client.get("/api/prep", params={"date": value})
        assert response.status_code == 400
        assert set(response.json()) == {"error"}
    response = client.get("/api/prep", params={"date": "2026-10-24"})
    assert response.status_code == 404
    assert set(response.json()) == {"error"}
    assert calls == []


def test_kitchen_numeric_validation(client, monkeypatch):
    calls = {"prep": [], "backtest": [], "simulate": []}
    monkeypatch.setattr(engine, "prep_list", lambda **kwargs: calls["prep"].append(kwargs) or {})
    monkeypatch.setattr(engine, "backtest", lambda **kwargs: calls["backtest"].append(kwargs) or {})
    monkeypatch.setattr(engine, "simulate", lambda **kwargs: calls["simulate"].append(kwargs) or {})

    for ratio in ("0", "-1", "inf", "nan"):
        response = client.get("/api/prep", params={"ratio": ratio})
        assert response.status_code == 400
        assert set(response.json()) == {"error"}
    for weeks in ("0", "53"):
        response = client.get("/api/savings", params={"weeks": weeks})
        assert response.status_code == 400
        assert set(response.json()) == {"error"}
    # Raw bodies, because httpx refuses to encode Infinity and NaN, but Python's
    # JSON parser on the server side accepts them.
    for field, value in (("attendance_multiplier", "0"), ("attendance_multiplier", "Infinity"),
                         ("price_multiplier", "0"), ("price_multiplier", "NaN")):
        response = client.post("/api/simulate", content=f'{{"{field}": {value}}}',
                               headers={"content-type": "application/json"})
        assert response.status_code == 400
        assert set(response.json()) == {"error"}
    assert calls == {"prep": [], "backtest": [], "simulate": []}


def test_savings_passes_arguments_and_simulated(client, monkeypatch):
    calls = []

    def fake_backtest(**kwargs):
        calls.append(kwargs)
        return {"weeks": kwargs["weeks"], "ratio": kwargs["ratio"], "series": []}

    monkeypatch.setattr(engine, "backtest", fake_backtest)
    response = client.get("/api/savings", params={"weeks": 2, "ratio": 4.5})
    assert response.status_code == 200
    assert response.json()["simulated"] is True
    assert calls == [{"weeks": 2, "ratio": 4.5, "data_dir": calls[0]["data_dir"]}]


def test_simulate_passes_arguments_and_unknown_date_is_rejected(client, monkeypatch):
    calls = []

    def fake_simulate(**kwargs):
        calls.append(kwargs)
        return {"date": kwargs["date"], "totals": {"prep_servings": 0}}

    monkeypatch.setattr(engine, "simulate", fake_simulate)
    response = client.post(
        "/api/simulate",
        json={
            "date": "2026-10-20",
            "attendance_multiplier": 1.2,
            "price_multiplier": 0.8,
            "ratio": 2.5,
        },
    )
    assert response.status_code == 200
    assert response.json()["simulated"] is True
    assert calls[0]["date"] == "2026-10-20"
    assert calls[0]["attendance_multiplier"] == 1.2
    assert calls[0]["price_multiplier"] == 0.8
    assert calls[0]["ratio"] == 2.5
    assert calls[0]["data_dir"].endswith("data/sample")

    response = client.post("/api/simulate", json={"date": "2026-10-24"})
    assert response.status_code == 404
    assert set(response.json()) == {"error"}
    assert len(calls) == 1

    response = client.post("/api/simulate", json={"date": "2026-02-30"})
    assert response.status_code == 400
    assert set(response.json()) == {"error"}
    assert len(calls) == 1


def test_meter_uses_demo_date_and_data_dir(client, monkeypatch):
    calls = []

    def fake_meter(**kwargs):
        calls.append(kwargs)
        return {"week_start": "2026-10-19", "servings_saved": 1, "dollars_saved": 2.0}

    monkeypatch.setattr(engine, "meter", fake_meter)
    response = client.get("/api/meter", headers={"X-Demo-Date": "2026-10-20"})
    assert response.status_code == 200
    assert response.json()["simulated"] is True
    assert calls[0]["date"] == "2026-10-20"
    assert calls[0]["data_dir"].endswith("data/sample")


def test_engine_value_error_is_bad_request(client, monkeypatch):
    def fail(**kwargs):
        raise ValueError("bad kitchen input")

    monkeypatch.setattr(engine, "prep_list", fail)
    response = client.get("/api/prep")
    assert response.status_code == 400
    assert response.json() == {"error": "bad kitchen input"}


def test_huge_numbers_are_bad_request(client):
    for body in (
        {"attendance_multiplier": 1e308},
        {"price_multiplier": 1e308},
        {"ratio": 1e308},
    ):
        response = client.post("/api/simulate", json=body)
        assert response.status_code == 400
        assert set(response.json()) == {"error"}
    for path in ("/api/prep?ratio=1e308", "/api/savings?ratio=1e308"):
        response = client.get(path)
        assert response.status_code == 400
        assert set(response.json()) == {"error"}


def test_engine_overflow_is_bad_request(client, monkeypatch):
    def overflow(**kwargs):
        raise OverflowError("cannot convert float infinity to integer")

    monkeypatch.setattr(engine, "prep_list", overflow)
    response = client.get("/api/prep")
    assert response.status_code == 400
    assert set(response.json()) == {"error"}


def test_engine_unknown_date_or_item_is_not_found(client, monkeypatch):
    class UnknownDate(ValueError):
        pass

    class UnknownItem(ValueError):
        pass

    monkeypatch.setattr(engine, "UnknownDateError", UnknownDate, raising=False)
    monkeypatch.setattr(engine, "UnknownItemError", UnknownItem, raising=False)
    for error in (UnknownDate("unknown date: 2020-01-01"), UnknownItem("unknown item: x")):
        def fail(**kwargs):
            raise error

        monkeypatch.setattr(engine, "meter", fail)
        response = client.get("/api/meter")
        assert response.status_code == 404
        assert response.json() == {"error": str(error)}


def test_meter_before_history_is_not_found(client):
    response = client.get("/api/meter", headers={"X-Demo-Date": "2020-01-01"})
    assert response.status_code == 404
    assert set(response.json()) == {"error"}
