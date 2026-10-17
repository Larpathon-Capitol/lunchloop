# Backend contract

This is the shared agreement between the data, engine and API parts of the backend. Each part can be built and tested on its own as long as it sticks to this file. Changing anything here needs the whole team's OK first.

All data is simulated. Every successful API response includes `"simulated": true`.

## Dates and the demo clock

- The simulated school's history ends on **Friday 2026-10-16**.
- The demo "today" is **Monday 2026-10-19** (env var `LUNCHLOOP_TODAY`, default `2026-10-19`). Kitchen prep lists default to today. Students vote and guess "today".
- Dates are ISO strings: `YYYY-MM-DD`.
- Data folder: env var `LUNCHLOOP_DATA_DIR`, default `data`. Tests use `data/sample`.

## Data files (in the data folder)

All CSVs have a header row and use `,` as the separator. Lists inside a cell use `;`. Empty cell means none.

**items.csv**: one row per menu item.

| column | type | notes |
| --- | --- | --- |
| item_id | str | lowercase slug, unique |
| name | str | display name |
| component | str | one of `meat_alternate`, `grain`, `vegetable`, `fruit`, `milk` |
| cost_per_serving | float | dollars |
| allergens | str | `;` list from: milk, egg, fish, shellfish, tree_nuts, peanuts, wheat, soybeans, sesame |
| prep_floor | int | minimum servings to prep (fruit and vegetable items), else 0 |

**meals.csv**: history, one row per item per school day, up to and including 2026-10-16.

| column | type | notes |
| --- | --- | --- |
| date | str | school day |
| item_id | str | from items.csv |
| component | str | copied from items.csv |
| attendance | int | students present that day |
| servings_prepared | int | what the kitchen cooked |
| servings_taken | int | what students took, never more than prepared |
| cost_per_serving | float | |
| allergens | str | copied from items.csv |
| vote_share | float or empty | share of votes the item got, only on days it won a student vote |
| sold_out | 0 or 1 | 1 when taken equals prepared (real demand may have been higher) |
| day_note | str or empty | `early_release`, `testing`, `rainy`, `pre_break`, or empty |

**future_meals.csv**: same columns, for every school day after 2026-10-16 that menu.csv covers. Only used to score Called It guesses in the demo. The engine must never read it for forecasting.

**menu.csv**: `date, item_id, day_note`. Which items are served each school day, for history and at least two weeks after 2026-10-16.

**vote_options.csv**: `open_date, target_date, target_slot, option_1, option_2, option_3`. The three options students can vote on each day, for a future menu slot.

## Engine (Python, `engine/`)

Import everything from `engine`. Every function takes an optional `data_dir`. Every function uses only meals dated before `as_of` (default: the demo today), so nothing leaks from the future.

```python
forecast(item_id, date, attendance=None, ratio=3.0, as_of=None, data_dir=None) -> dict
# {"item_id", "date", "attendance", "predicted": int, "sigma": float,
#  "buffer": int, "prep": int, "floor": int, "service_level": float}
# predicted = mean(taken/attendance) over the item's last 4 same-weekday days, times attendance
#   (fewer than 4: use what there is; none on that weekday: last 4 days of that item; none: ValueError)
# attendance None -> mean attendance of the last 4 same-weekday days
# sigma = std of the item's recent baseline misses (walk-forward); fallback 10% of predicted
# service_level = ratio / (ratio + 1);  buffer = ceil(z(service_level) * sigma)
# prep = max(predicted + buffer, floor)

validate(data_dir=None) -> list[str]  # plain-English data warnings; never raises for a folder path

explain(item_id, date, ratio=3.0, as_of=None, data_dir=None) -> str
# one plain line, e.g. "Fridays run 15% higher, attendance is normal, buffer +18"

prep_list(date=None, attendance=None, ratio=3.0, data_dir=None) -> dict
# {"date", "attendance", "ratio", "simulated": true,
#  "items": [{"item_id", "name", "component", "predicted", "buffer", "prep",
#             "floor", "reason", "allergens": [str]}],
#  "meal_check": <meal_check result>}
# items = that date's menu.csv rows. Allergens are copied from items.csv, never changed.

meal_check(menu, prep=None, data_dir=None) -> dict
# menu: list of item_ids; prep: optional {item_id: servings}
# {"ok": bool, "missing_components": [str], "below_floor": [{"item_id", "prep", "floor"}]}

backtest(weeks=4, ratio=3.0, data_dir=None) -> dict
# Holds out the last `weeks` weeks of meals.csv, forecasts each day with only earlier data.
# "usual" = what the simulated kitchen actually prepared (servings_prepared).
# {"simulated": true, "weeks", "ratio", "shortage_ratio",
#  "lunchloop": {"avg_miss", "leftover_servings", "dollars_wasted", "servings_short", "dollars_short"},
#  "usual": {same keys},
#  "leftover_cut_pct": float, "net_dollars_saved": float,
#  "series": [{"date", "item_id", "prep_lunchloop", "prep_usual", "taken"}]}
# waste = max(0, prep - taken); short = max(0, taken - prep). Taken understates demand on sold-out days.
# dollars_short is short servings multiplied by cost_per_serving.
# net_dollars_saved = usual waste dollars + shortage_ratio x usual shortage dollars
#   minus the same two amounts for lunchloop.

simulate(date=None, attendance_multiplier=1.0, price_multiplier=1.0, ratio=3.0, data_dir=None) -> dict
# prep_list() with attendance and costs scaled, plus
# {"totals": {"prep_servings", "expected_leftover_servings", "food_cost", "expected_waste_cost"}}

meter(date=None, data_dir=None) -> dict
# {"simulated": true, "week_start", "servings_saved", "dollars_saved",
#  "net_dollars_saved", "extra_short_servings"}
# from backtest() rows in the latest simulated week up to date.
# servings_saved and dollars_saved are leftover-only values.
# net_dollars_saved nets leftover dollars saved against shortages at the default ratio of 3.0.
```

## API (FastAPI, `api/`)

Run with `uvicorn api.main:app`. All routes are under `/api`. CORS origin from env var `LUNCHLOOP_CORS_ORIGIN` (default `*` for local work). A request may send header `X-Demo-Date: YYYY-MM-DD` to move the demo clock (for showing streaks); otherwise today is `LUNCHLOOP_TODAY`.

Errors are `{"error": "<plain message>"}` with status 400 (bad input), 404 (unknown date or item), 409 (already voted or guessed today), or 501 (engine function not built yet).

| method and path | request | response |
| --- | --- | --- |
| GET /api/health | | `{"ok": true, "today", "simulated": true}` |
| GET /api/prep?date=&ratio= | date default today | engine `prep_list()` |
| GET /api/savings?weeks=&ratio= | | engine `backtest()` |
| POST /api/simulate | `{"date"?, "attendance_multiplier", "price_multiplier", "ratio"}` | engine `simulate()` |
| GET /api/spin?device= | | `{"date", "target_date", "target_slot", "options": [{"item_id", "name", "allergens": [str]}], "already_voted": bool, "simulated": true}` |
| POST /api/vote | `{"device", "item_id"}` | `{"ok": true, "streak", "xp", "tally": {item_id: count}, "simulated": true}` |
| POST /api/guess | `{"device", "item_id"}` (most popular item next school day) | `{"ok": true, "target_date", "simulated": true}` |
| GET /api/me?device= | | `{"device", "streak", "xp", "badges": [str], "last_guess": {"target_date", "item_id", "correct": bool or null} or null, "simulated": true}` |
| GET /api/meter | | engine `meter()` |

- `device` is a random ID the browser makes (8 to 64 letters, digits or dashes). No names or emails. The first call with a new device creates its player row.
- One vote and one guess per device per school day.
- Streak counts consecutive school days with a vote. XP: +10 per vote, +25 per correct guess.
- A guess is scored once its target date is in the past (by the demo clock), using `future_meals.csv`: correct if the item has the most `servings_taken` among that day's `meat_alternate` items.
- Badges: `streak_3`, `streak_7`, `called_it_5`.

## Database (SQLite, owned by `api/`)

Built fresh at startup from the data folder (hosting disks may be wiped), at `LUNCHLOOP_DB` (default `lunchloop.db`, git-ignored). Tables: `items`, `meals`, `menu`, `vote_options`, `votes(device, date, item_id)`, `guesses(device, date, target_date, item_id)`, `players(device, streak, xp, last_vote_date)`. Votes, guesses and players survive restarts only if the file does.
