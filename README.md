# LunchLoop

LunchLoop helps a school cafeteria decide how many servings of each food to cook. It:

1. **Predicts** how many servings students will take of each food.
2. **Recommends** how much to cook: the prediction plus a safety buffer, so a food rarely runs out.
3. **Estimates the impact** against "cooking the usual amount": cost, leftover servings and short servings.

**All data here is synthetic (a simulated school).** Costs and savings are estimates. Nothing in this project shows
what LunchLoop would do at a real school.

## Run it

```
pip install -r requirements.txt
python -m uvicorn app:app --port 8000
```

Open http://127.0.0.1:8000/. Interactive API docs are at http://127.0.0.1:8000/docs.

## The dashboard

Three sections, all computed live from the CSV through the API (nothing is typed into the page):

1. **What the history shows**: date range, and each food's average servings and average leftovers per day.
2. **The plan**: for the next school day (or any day you pick), each food's predicted demand, safety buffer and the
   amount to cook. Cook is the prominent column.
3. **Expected impact**: LunchLoop vs. the usual amount for that day: food cost, shortage cost, total cost, leftover
   servings, short servings, and the estimated savings (or extra cost). If the plan saves money but runs short a bit
   more, or costs a bit more but runs short less, both facts are shown. A one-line backtest on the dataset's last 15 school days is added as a reality check.

## How it works

- **Forecast** (`predict_demand` in `prediction.py`): the share of attending students who took a food over its last 10
  school days, adjusted by how busy that weekday usually is for the food (shrunk toward no adjustment when there is
  little data), times expected attendance. A food with under 3 days of history falls back to its category's average
  and is marked "rough guess". It is compared with a plain all-time-average baseline when accuracy is evaluated
  (`GET /accuracy`).
- **Safety buffer** (`safety_buffer`): sized from how wrong the forecast was for that food on earlier days, so the
  amount cooked would have covered 97% of them. Never below +5%, and never below +10% for fruit, vegetables and milk.
- **Cost** (`calculate_costs`): `total = food cooked x unit cost + shortage x unit cost x 3`. Leftover (surplus) food is
  already inside the food cost and is never added again. The 3x for a missing serving is an assumption, not a measured
  cost. LunchLoop and the usual amount are always compared against the same demand.
- **Usual amount**: each food's own historical cooked-per-attending-student ratio, scaled to the day's attendance.

## API

The existing endpoints are kept. The dashboard uses `/summary`, `/next-school-day`, `/plan` and `/evaluate`.

- `GET /summary`: history averages per food, plus the date range.
- `GET /next-school-day`: today if it is a school day, else the next one.
- `POST /plan`: one day's plan (`target_date` or `expected_attendance`).
- `GET /evaluate`: walk-forward comparison on the last 15 school days, scored against what was actually served.
- Also available, not shown on the dashboard: `/accuracy`, `/buffers`, `/data-quality`, `/plan/month`,
  `/plan/sensitivity`, `/simulation` (a multi-school synthetic study). See [docs/EVALUATION.md](docs/EVALUATION.md).

## Tests

```
python -m pytest              # about 90 s; one test reruns the full simulation study
python test_prototype.py
python test_api.py
```

## Limitations

- The data is synthetic, so no result here is evidence of real-world savings or less waste.
- Next-day impact figures are expected values based on how the forecast erred on earlier days, not promises.
- The dataset is small (34 school days), and when a food sells out nobody knows how much more students wanted.
- The shortage cost multiplier is an assumption. Plate waste (food served but not eaten) is not measured or counted.

## Files

- `app.py`: FastAPI app and the dashboard route. `dashboard.html`: the page.
- `prediction.py`: forecast, buffer, cost model, evaluation. `simulation.py`: synthetic multi-school study (backend only).
- `data/cafeteria_history_synthetic.csv`: the synthetic history.
- `tests/`, `test_prototype.py`, `test_api.py`: automated checks. `forecast_search.py`, `level_search.py`: how the forecast was chosen and how the coverage level trades leftovers against shortages (97% is a deliberate choice for fewer shortages; the search rule alone would pick 94%).
- `docs/EVALUATION.md`: the full evaluation write-up.

## License

MIT, see the LICENSE file in the main LunchLoop repository.
