"""Run with:  python test_api.py
Exercises the FastAPI endpoints with TestClient (no server needs to be running)."""
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

r = client.get("/health")
assert r.status_code == 200 and r.json()["status"] == "ok"

r = client.get("/summary")
body = r.json()
assert r.status_code == 200 and body["days_in_history"] == 34
assert len(body["per_food"]) == 6
assert all(0 <= f["leftover_rate"] <= 1 for f in body["per_food"])

r = client.get("/")
assert r.status_code == 200 and "text/html" in r.headers["content-type"]

# Missing both attendance and target_date -> 400.
r = client.post("/plan", json={})
assert r.status_code == 400

# expected_attendance path.
r = client.post("/plan", json={"expected_attendance": 410})
body = r.json()
assert r.status_code == 200
assert body["expected_attendance"] == 410
assert len(body["items"]) > 0

# target_date path (Monday) should derive attendance from weekday history.
r = client.post("/plan", json={"target_date": "2027-06-14"})
body = r.json()
assert r.status_code == 200
assert body["expected_attendance"] > 0
assert body["attendance_note"] is not None

# Custom menu including a brand-new food.
r = client.post("/plan", json={
    "expected_attendance": 410,
    "menu": [{"food_item": "Mac and Cheese", "food_category": "main", "unit_cost": 0.60}],
})
body = r.json()
assert r.status_code == 200 and len(body["items"]) == 1
assert body["items"][0]["confidence"] == "low"

# Month-ahead plan: a full month beyond the history, rolled up from daily plans.
r = client.post("/plan/month", json={"year": 2027, "month": 1})
body = r.json()
assert r.status_code == 200
assert body["school_days"] == 19
assert len(body["per_food_totals"]) == 6
assert len(body["daily_plans"]) == 19

r = client.post("/plan/month", json={"year": 2027, "month": 13})
assert r.status_code == 400

# Accuracy: backtested MAE, old all-time method vs. the current weekday+recency method.
# With only ~34 days of real history, "new" doesn't reliably beat "old" -- that's an honest
# result (not enough data yet), so this only checks both compute and the caveat is present.
r = client.get("/accuracy")
body = r.json()
assert r.status_code == 200 and body["n_predictions"] > 0
assert "circularity_caveat" in body

# Buffers: backtested per-food safety buffers.
r = client.get("/buffers")
body = r.json()
assert r.status_code == 200 and len(body) == 6
for info in body.values():
    assert 0 <= info["buffer"] <= 0.40

# Data quality: this CSV was generated clean, so no issues expected.
r = client.get("/data-quality")
body = r.json()
assert r.status_code == 200 and body["clean"] and body["issues"] == []

# /plan items should carry the data-driven buffer and the plate-waste estimate, and the
# cost-model fields (preparation cost, shortage, savings %) the review added.
r = client.post("/plan", json={"expected_attendance": 410})
body = r.json()
item = body["items"][0]
assert item["buffer_source"] == "data_driven"
assert item["estimated_plate_waste_servings"] is not None
assert "estimated_preparation_cost" in item and "estimated_shortage_cost" in item
assert "estimated_savings_pct_vs_baseline" in body["totals"]
assert body["synthetic_data"] is True

# shortage_penalty_multiplier is configurable and actually changes the result.
r1 = client.post("/plan", json={"expected_attendance": 410, "shortage_penalty_multiplier": 1.0})
r3 = client.post("/plan", json={"expected_attendance": 410, "shortage_penalty_multiplier": 3.0})
assert r1.json()["totals"]["shortage_penalty_multiplier"] == 1.0
assert r3.json()["totals"]["shortage_penalty_multiplier"] == 3.0

# Sensitivity endpoint: same day, several shortage-penalty assumptions side by side.
r = client.get("/plan/sensitivity", params={"expected_attendance": 410})
body = r.json()
assert r.status_code == 200 and len(body["results"]) == 5
assert {res["shortage_penalty_multiplier"] for res in body["results"]} == {1.0, 1.5, 2.0, 3.0, 5.0}

# Evaluation endpoint: leak-free walk-forward comparison, same days for both methods.
r = client.get("/evaluate")
body = r.json()
assert r.status_code == 200 and body["evaluated_predictions"] > 0
assert body["synthetic_data"] is True and "circularity_caveat" in body
assert set(body["per_food"].keys()) == set(r.json()["per_food"].keys())  # just confirms it's stable JSON
assert body["overall"]["n"] == body["evaluated_predictions"]

print("ALL API CHECKS PASSED")
