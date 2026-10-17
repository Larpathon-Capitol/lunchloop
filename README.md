# LunchLoop

LunchLoop tells a school cafeteria how many servings of each item to cook, so less food ends up in the trash. It also has the backend for a daily student game: spin to see menu options, vote, and guess what will be popular.

We're building it for Hack Club Capitol. The demo runs on a simulated high school, not real cafeteria records. The backend works today. The screens do not exist yet.

---

## How to download / install

You need Python 3.12 or newer and git. Older Python versions will not work (the data script refuses to run).

### macOS

Get Python 3.12 or newer if you don't have it: download it from [python.org](https://www.python.org/downloads/) or run `brew install python@3.12`. Check with `python3 --version`. If it says something older than 3.12, use `python3.12` in place of `python3` below.

```
git clone https://github.com/Larpathon-Capitol/lunchloop.git
cd lunchloop
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run the tests:

```
python -m pytest -q
```

Start the API:

```
uvicorn api.main:app --reload
```

In a second terminal, try it:

```
curl http://127.0.0.1:8000/api/health
curl "http://127.0.0.1:8000/api/prep"
```

### Windows

Get Python 3.12 or newer (the newest is fine) from [python.org](https://www.python.org/downloads/) and git from [git-scm.com](https://git-scm.com/download/win). Check with `py -3 --version`. Then, in PowerShell or Command Prompt:

```
git clone https://github.com/Larpathon-Capitol/lunchloop.git
cd lunchloop
py -3 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

If PowerShell says running scripts is disabled, run `Set-ExecutionPolicy -Scope Process Bypass` and try the activate line again.

Run the tests:

```
python -m pytest -q
```

Start the API:

```
uvicorn api.main:app --reload
```

Then open these in your browser:

```
http://127.0.0.1:8000/api/health
http://127.0.0.1:8000/api/prep
```

### Settings

All optional. Set them as environment variables before starting the API.

- `LUNCHLOOP_DATA_DIR`: where the CSV data lives (default `data`)
- `LUNCHLOOP_TODAY`: the demo "today" (default `2026-10-19`)
- `LUNCHLOOP_DB`: the SQLite file for votes and streaks (default `lunchloop.db`)
- `LUNCHLOOP_CORS_ORIGIN`: allowed web origin (default `*`)

For example, `export LUNCHLOOP_TODAY=2026-10-20` on macOS, `$env:LUNCHLOOP_TODAY="2026-10-20"` in PowerShell, or `set LUNCHLOOP_TODAY=2026-10-20` in Command Prompt.

You can also move the demo clock for a single request with a header, like `X-Demo-Date: 2026-10-20`.

The full list of routes and response shapes is in the [API reference](docs/backend-contract.md).

---

## Current features

- A simulated high school of about 1,200 students, made by `python data/simulate.py` with a fixed seed. It has 125 school days of history (Jan 12 to Oct 16, 2026), 14 menu items across all five meal components, and four upcoming school weeks of menu.
- A forecast engine that suggests a prep amount for each menu item, with a one-line reason for each.
- A meal check that flags a missing food group.
- A backtest that scores the forecast on the last 4 weeks of history.
- A what-if simulator for attendance and price changes.
- An API (FastAPI and SQLite) with routes under `/api`: health, prep, savings, simulate, spin, vote, guess, me, meter.
- Streaks, XP and badges for students, in the API.
- Students are identified only by a device ID, not a name or email.

---

## Planned features

Planned means not built yet.

- Kitchen view: a web screen for the cafeteria manager showing the prep list.
- Student view: a phone screen to spin, vote, and guess.
- A live hosted link for the demo.

---

## Known bugs / limitations

- All data is simulated. No real school has used LunchLoop.
- Allergens in the data are placeholders, not product labels. Do not use them for real food safety.
- At the default setting, LunchLoop runs short more often than the kitchen's usual amount. That is on purpose (see the results below).
- The vote options are the same three entrees every day in the current data.
- Votes and streaks live in a local SQLite file, so a fresh deploy resets them.
- There is no frontend yet. For now you use the API directly.

---

## How the forecast works

- Look at the last 4 days that fell on the same weekday as the day you are planning, and scale by expected attendance.
- Add a safety buffer. We count a shortage as 3 times worse than a leftover. That works out to prepping enough to cover demand on about 75% of days.
- Never go below a prep floor for fruit and vegetables.
- Allergens are copied from the item list and never changed.
- Every item gets a one-line reason for its number.

---

## Results in our simulated school

We backtested the last 4 weeks (Sep 21 to Oct 16, 2026), counting a shortage as 3 times a leftover.

- In our simulated school, LunchLoop left 4,096 servings uneaten. The kitchen's usual amount left 7,505. That is 45.4% fewer leftovers ($1,892 of food instead of $3,458).
- LunchLoop also came up 449 servings short, on 34 of 182 item-days.
- The usual amount never counts as short in this data, because students can't take more than was cooked. It sold out on 7 of those item-days, so real demand there is unknown.

So fewer leftovers is not free. LunchLoop trades some shortages for less waste. These numbers come from simulated data, not a real cafeteria.

To regenerate them:

```
python -c "import engine, json; print(json.dumps({k: v for k, v in engine.backtest().items() if k != 'series'}, indent=2))"
```

---

## Project layout

- `data/`: the simulated school and the script that makes it (see `data/README.md` and `data/sources.md`)
- `engine/`: the forecast, meal check, backtest and simulator
- `api/`: the FastAPI app and the student game logic
- `tests/`: tests for the data, engine and API
- `docs/`: the [backend contract](docs/backend-contract.md)

---

## Credits

- [Ekansh Simgekar](https://github.com/magicKansh) built the first forecasting prototype and the simulated cafeteria data this project started from.
- [Yojith](https://github.com/yojithprograms), LunchLoop team member.

## License

MIT. See [LICENSE](LICENSE).
