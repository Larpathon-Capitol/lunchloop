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
| diet | str | semicolon list of vegetarian, vegan, contains_pork, contains_beef, spicy |

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

**vote_options.csv**: `open_date, target_date, target_slot, option_1, option_2, option_3, option_4`. Four varied options students can vote on each day, with at least one vegetarian entree.

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

Run with `uvicorn api.main:app`. All routes are under `/api`. CORS origin from env var `LUNCHLOOP_CORS_ORIGIN` (default `*` for local work). A request may send header `X-Demo-Date: YYYY-MM-DD` to move the demo clock for simulated schools; live always uses `LUNCHLOOP_TODAY`.

Errors are `{"error": "<plain message>"}` with status 400 (bad input), 404 (unknown date or item), 409 (already voted or guessed today), or 501 (engine function not built yet).

| method and path | request | response |
| --- | --- | --- |
| GET /api/health | | `{"ok": true, "today", "simulated": true}` |
| GET /api/prep?date=&ratio= | date default today | engine `prep_list()`; each item also gets `diet`, `gluten_free`, `dairy_free` |
| GET /api/savings?weeks=&ratio= | | engine `backtest()` |
| POST /api/simulate | `{"date"?, "attendance_multiplier", "price_multiplier", "ratio"}` | engine `simulate()` |
| POST /api/device | `{"legacy"?: str}` | `{"device": "<id>.<sig>", "simulated": true}` (see the device notes below the tray section) |
| GET /api/spin?device= | | `{"date", "target_date", "target_slot", "options": [{"item_id", "name", "allergens": [str], "diet": [str], "gluten_free": bool, "dairy_free": bool}], "pool": [{"item_id", "name", "diet", "gluten_free", "dairy_free"}], "already_voted": bool, "simulated": true}` |
| POST /api/vote | `{"device", "item_id"}` (any of today's options, four on the full data) | `{"ok": true, "streak", "xp", "tally": {item_id: count}, "simulated": true}` |
| POST /api/guess | `{"device", "item_id"}` (most popular item next school day) | `{"ok": true, "target_date", "simulated": true}` |
| GET /api/me?device= | | `{"device", "streak", "xp", "badges": [str], "last_guess": {"target_date", "item_id", "correct": bool or null} or null, "voted_today", "packed_today", "correct_calls": int (guesses scored correct so far), "simulated": true}` |
| GET /api/meter | | engine `meter()` |

## Tray

Students can pack one tray for the next school day. `GET /api/tray?device=&school=` returns the target date and that day's menu grouped in fixed component order: `meat_alternate`, `grain`, `vegetable`, `fruit`, `milk`. Each item is `{"item_id", "name", "allergens", "diet", "gluten_free", "dairy_free"}`. `diet` is a list in the fixed order vegetarian, vegan, contains_pork, contains_beef, spicy; `gluten_free` means no wheat allergen and `dairy_free` means no milk allergen (derived, not stored). The spin options use the same item shape. A device's `picks` are item ids or null for a skipped group. The response includes a `tally` only after that device has packed today.

`POST /api/tray` accepts `{"device", "school"?, "picks": {component: item_id or null}}`. Every target-day group must be picked or skipped, and at least one group must be picked. A device can pack once per school day. The response includes the target date, current streak and XP, and a tally. The tally counts packed trays, skips, and each menu item's picks and share.

Packing a tray earns 10 XP. A school day is active for streaks and longest-run badges when the device voted or packed a tray. The `tray` key in `/api/admin/summary` is the current school's tally, or null when no trays were packed today. Tray submissions use the same per-IP limit as votes and guesses.

- `device` is a random ID the browser makes (8 to 64 letters, digits or dashes). No names or emails. The first call with a new device creates its player row.
- `POST /api/device` accepts an optional `legacy` id and returns `{"device": "<id>.<sig>", "simulated": true}`. `<id>` is a device id as above and `<sig>` is the first 16 lowercase hex characters of HMAC-SHA256(server secret, `device:<id>`), so a signed id is at most 81 characters. A valid unsigned `legacy` id that already has a player row (any school) is signed as is, so the student keeps their streak and XP. Any other `legacy` value, or none, gets a new random id (32 hex characters). A `legacy` that is already a valid signed id comes back unchanged. Every call except the unchanged case counts as a new player for the mint limit (see Limits).
- Env `LUNCHLOOP_SIGNED_DEVICES=1` turns enforcement on: `POST /api/vote`, `POST /api/guess`, `GET /api/tray` with a device, `POST /api/tray`, `POST /api/served`, `GET /api/me` and `GET /api/spin` with a device answer 400 `{"error": "invalid device"}` to a missing, unsigned or wrongly signed device. Off (the default), both plain and signed ids are accepted, but a signed id with a bad signature is still 400. Either way a signed id and its unsigned base are the same player: history, streaks and the one-per-day rules are kept under the unsigned base id. Simulated `/api/demo/crowd` devices are internal and not affected.
- One vote and one guess per device per school day.
- Streak counts consecutive school days with a vote. XP: +10 per vote, +25 per correct guess.
- A guess is scored once its target date is in the past (by the demo clock), using `future_meals.csv`: correct if the item has the most `servings_taken` among that day's `meat_alternate` items.
- Badges: `streak_3`, `streak_7`, `called_it_5`.

## Database (SQLite, owned by `api/`)

Built fresh at startup from the data folder (hosting disks may be wiped), at `LUNCHLOOP_DB` (default `lunchloop.db`, git-ignored). Tables: `items`, `meals`, `menu`, `vote_options`, `votes(device, date, item_id)`, `guesses(device, date, target_date, item_id)`, `trays(school_id, device, date, target_date, component, item_id)`, `players(device, streak, xp, last_vote_date)`. Votes, guesses, trays and players survive restarts only if the file does.

## School accounts

Students play without an account. School staff sign in to see what their students want. Each school has its own password, and a school's staff only ever see their own school's votes.

**schools.csv** (in the data folder): `school_id, name, students`. `school_id` is a lowercase slug. The repo ships one school: `demo`, the simulated school.

- Passwords never live in the repo. Env var `LUNCHLOOP_SCHOOL_PASSWORDS` holds `school_id=hash` pairs separated by commas. A hash is `pbkdf2_sha256$<iterations>$<salt hex>$<hash hex>`, made with `python tools/hash_password.py`.
- If the env var does not set a hash for `demo`, the demo school uses the public demo password `lunchloop`, so anyone can try the school view. Every other school without a hash cannot sign in.
- Sign-in returns a token: `<payload>.<signature>`, where payload is base64url JSON `{"s": school_id, "exp": unix seconds}` and signature is the hex HMAC-SHA256 of the payload with env var `LUNCHLOOP_SECRET` (a random secret per process if unset, so sign-ins end on restart). Tokens last 12 hours.
- Five failed sign-ins for one school from one client in 10 minutes block more tries for that pair until the window passes (status 429).

Student routes (`spin`, `vote`, `guess`, `me`) take an optional `school` (query param on GET, body field on POST), default `demo`. An unknown school is a 404. Votes, guesses and players are stored per school. Every school uses the same simulated menu data for now.

| method and path | request | response |
| --- | --- | --- |
| GET /api/schools | | `{"schools": [{"school_id", "name", "demo_password": str or null}], "simulated": true}` (`demo_password` is set only when the school uses the public demo password) |
| POST /api/admin/login | `{"school_id", "password"}` | `{"token", "school": {"school_id", "name"}, "expires_at" (ISO UTC time), "simulated": true}`; 401 `{"error": "wrong school or password"}`; 429 when blocked |
| GET /api/admin/summary | header `Authorization: Bearer <token>` | see below; 401 when the token is missing, wrong or expired |

`/api/admin/summary` response, for the token's school and the demo clock's today:

```
{"school": {"school_id", "name", "students"}, "today",
 "vote": {"target_date", "target_slot", "total",
          "options": [{"item_id", "name", "votes", "share"}]} or null,   # today's live vote; share is 0 to 1, 0 when total is 0
 "recent_votes": [{"open_date", "target_date", "total", "winner": {"item_id", "name", "votes"}}],
                                                                        # this school's last 10 vote days before today that had votes, newest first
 "past_winners": [{"date", "item_id", "name", "vote_share"}],           # meals.csv rows before today with a vote_share, newest first, at most 10 (simulated history)
 "guesses": {"target_date", "total", "items": [{"item_id", "name", "guesses"}]} or null,
                                                                        # Called It guesses made today, most guessed first
 "players": {"total", "voted_today", "voted_last_5_days"},              # last 5 school days up to and including today
 "simulated": true}
```

## Live demo school

`schools.csv` also has `live` (name "LunchLoop live demo", students empty). It is where real people vote during a presentation. It has no public password: it signs in only when `LUNCHLOOP_SCHOOL_PASSWORDS` sets a hash for it. For `live`, the `X-Demo-Date` header is ignored (its clock is always `LUNCHLOOP_TODAY`), so nobody can vote twice by changing the date.

## Behind the scenes

These routes are public and show only anonymous data, so judges can watch the backend work.

| method and path | request | response |
| --- | --- | --- |
| GET /api/events?after=&limit=&scope= | `scope` optional `live` or `simulated`; global ids remain unchanged | same response, filtered when scoped |
| GET /api/demo/calendar?school= | simulated school only | `{"today", "school_days": [str], "default_today", "simulated": true}` |
| POST /api/demo/crowd | `{"school": "demo", "count": 1..40}` | `{"ok": true, "added", "date", "totals": {"votes", "trays", "checked_in"}, "simulated": true}` |
| GET /api/trace/forecast?item_id=&date=&ratio= | date default today, ratio default 3.0 | see below |

Demo controls never touch `live`: both demo routes return 400 `demo controls are for simulated schools` for it, and an unknown school is 404. `POST /api/demo/crowd` acts on the school's current demo date (the `X-Demo-Date` header): each simulated student votes for one of today's options (weighted by that entree's past popularity, so vegetarian options get a real share), packs a tray for the next school day (each group picked or skipped), and about a third also guess. Device ids are `sim-<school>-<date>-<index>`, the index continuing from that day's earlier simulated votes and skipping any id a real device already used. Every action records the usual `spin`, `vote`, `tray` or `guess` event. `count` must be an integer 1 to 40 (400 `count must be 1 to 40`). One request counts as one write for rate limits. 404 `no voting today` when the date has no vote or no next school day.

Events: the server keeps the newest 300 live events (school `live`) and, separately, the newest 300 of everything else, in memory (lost on restart), so simulated bursts never push live events out. `?scope=live` or `?scope=simulated` reads one buffer; no scope merges both (up to 600) in id order. `kind` is one of `spin`, `vote`, `guess`, `tray`, `served`, `free`, `staff_sign_in`, `staff_sign_in_failed`, `prep`, `savings`, `simulate`, `meter`, `rate_limited`. A tray event says that a player packed a tray for the target date, with picked count and tally total in `detail`. `at` is an ISO UTC time. `player` is a 6-character anonymous tag (an HMAC of the device id with the server secret), or null. `summary` is one plain sentence (for example "A player voted for Beef nachos"). `detail` holds small numbers (for example the new tally, or the prep total and item count). `ms` is how long the work took, or null. Events never hold device ids, passwords, tokens, IP addresses or user agents. Admin summary polls are not events.

`/api/trace/forecast` shows every step of `forecast()` for one item, with the same inputs the engine used:

```
{"item_id", "name", "date", "weekday", "ratio",
 "history": [{"date", "attendance", "taken", "rate"}],   # the rows behind the baseline rate (same weekday, newest 4)
 "mean_rate", "attendance", "attendance_history": [{"date", "attendance"}],
 "predicted", "misses": [float], "sigma", "sigma_fallback": bool,
 "service_level", "z", "buffer", "floor", "prep", "reason", "simulated": true}
```
`predicted`, `sigma`, `buffer`, `floor` and `prep` must equal what `forecast()` returns for the same arguments.

## Limits

- The interactive docs (`/docs`, `/redoc`, `/openapi.json`) are off unless env `LUNCHLOOP_DOCS=1`.
- Request bodies over 16 KB get 413.
- Each client IP may make 1,200 requests a minute and 300 actions in 10 minutes (a whole school can share one Wi-Fi address). Actions are `POST` to `/api/vote`, `/api/guess`, `/api/tray`, `/api/served`, `/api/admin/free` and `/api/demo/crowd`.
- Each device (the `device` query parameter or JSON body field, counted by its unsigned base id) may also make 60 requests a minute and 12 actions in 10 minutes. Requests without a device only count against their IP. A signed id with a bad signature is not counted as that device.
- Over an IP or device limit: 429 `{"error": "slow down a little"}`.
- Each client IP may get 120 new players from `POST /api/device` in 10 minutes. Over that: 429 `{"error": "too many new players from this network, try again soon"}`.
- The first time an address hits a limit kind in a minute, a `rate_limited` event is recorded with `detail.limit` set to `requests`, `votes and guesses`, `device requests`, `device actions` or `new players`. It never holds the address or the device id.
- Every limit can be changed with env (read when the app starts; each must be a whole number of at least 1):

  | env | default |
  | --- | --- |
  | `LUNCHLOOP_IP_REQUESTS` | 1200 requests per IP per minute |
  | `LUNCHLOOP_IP_ACTIONS` | 300 actions per IP per 10 minutes |
  | `LUNCHLOOP_DEVICE_REQUESTS` | 60 requests per device per minute |
  | `LUNCHLOOP_DEVICE_ACTIONS` | 12 actions per device per 10 minutes |
  | `LUNCHLOOP_DEVICE_MINTS` | 120 new players per IP per 10 minutes |
- Every response carries `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and `X-Frame-Options: DENY`; admin responses also carry `Cache-Control: no-store`.

## Free leftovers and lunch service

Students can report whether they received the tray they packed for the current school date with `POST /api/served` using `{"device", "school"?, "got": true|false}`. The request requires a tray targeting that date and returns `no tray for today` when none exists. Repeating the request updates the answer. `GET /api/me` and `GET /api/tray` include `today_lunch` and `free_today`.

Staff can mark a menu item free with `POST /api/admin/free` using a bearer staff token and `{"item_id", "free": true|false}`. The server returns `that food is not on today's menu` for an off-menu item. `GET /api/free?school=` is public. Free records are stored in the `freebies` table, per school and date, and the admin token determines the school. The admin summary includes `free` and a `service` object with packed, checked-in, got, missed, and per-item wanted, got, missed, waiting, and free counts.

The demo crowd also simulates today's lunch service: if no simulated student packed a tray for the current date yet, it first makes `count` of them on the previous school day, then checks in about 85% of up to `count` waiting simulated students (about 90% of those got their pick), recording `served` events. `totals.trays` counts trays packed on the current date; `totals.checked_in` counts today's check-ins.
