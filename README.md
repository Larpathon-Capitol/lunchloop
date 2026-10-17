# LunchLoop

LunchLoop tells a school cafeteria how many servings of each item to cook, so less food ends up in the trash. It also has the backend for a daily student game: spin to see menu options, vote, and guess what will be popular.

We're building it for Hack Club Capitol. The demo runs on a simulated school, a large Texas high school of 2,750 students, not real cafeteria records. The backend works today. The screens do not exist yet.

---

## How to download / install

You need Python 3.12 or newer and git.

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

The first one should answer `{"ok":true,"today":"2026-10-19","simulated":true}`. The second returns a prep amount and a one-line reason for each menu item, for example `"prep": 560` and `"reason": "Attendance is normal, buffer +22"` for cheese pizza.

### Windows

Get Python 3.12 or newer from [python.org](https://www.python.org/downloads/) and git from [git-scm.com](https://git-scm.com/download/win). Check with `py -3 --version`. Then, in PowerShell or Command Prompt:

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

You should see the same answers described in the macOS steps above.

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

- A simulated large Texas high school of 2,750 students, made by `python data/simulate.py` with a fixed seed. It has 125 school days of history (Jan 12 to Oct 16, 2026), 14 menu items across all five meal components, and four upcoming school weeks of menu.
- A forecast engine that suggests a prep amount for each menu item, with a one-line reason for each. An item with no history gets a rough guess instead of an error.
- Data checks: `engine.validate()` lists problems in the data files in plain words.
- A meal check that flags a missing food group.
- A backtest that scores the forecast on the last 4 weeks of history, with shortages priced in.
- `tools/eval_truth.py`, which scores the forecast against how much food students really wanted in the simulation, not just what was served.
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
- At the default setting, LunchLoop runs short more often than the kitchen's usual amount (see the results below).
- Entrees and grains sell out on some days in the simulated history (22.6% of entree and grain item-days), so the history undercounts what students wanted. `tools/eval_truth.py` scores against the true demand to check this.
- Packaged items (milk cartons, fruit cups, mandarin oranges) are counted as waste when they are not eaten. Some of them may be stored and served again, so the results may overstate their waste.
- The kitchen's "usual amount" is a fixed over-prep per food group (7.5% for entrees and grains, 20% for fruit and vegetables, 12% for milk). These margins are our assumptions. No published standard sets them.
- The 4-week backtest (`engine.backtest()` and the dashboard meter) can only see what was served, so the usual amount never shows a shortage there and only LunchLoop's shortages are charged. `tools/eval_truth.py` scores both against true demand and is the fairer check.
- The vote options are the same three entrees every day in the current data.
- Votes and streaks live in a local SQLite file, so a fresh deploy resets them.
- There is no frontend yet. For now you use the API directly.

---

## How the forecast works

- Look at the last 4 days that fell on the same weekday as the day you are planning, and scale by expected attendance.
- Add a safety buffer. We price a shortage at 3 times the food cost of a leftover serving. That works out to prepping enough to cover demand on about 75% of days (3 / (3 + 1)).
- Never go below a prep floor for fruit and vegetables.
- If an item has no history yet, take a rough guess: the average take rate of its food group, times expected attendance. The reason line says "Rough guess, no history for this item".
- Allergens are copied from the item list and never changed.
- Every item gets a one-line reason for its number.
- `engine.validate()` reads the data files and returns a list of warnings, such as an unreadable file, a bad number, a menu item missing from the item list, or a duplicate row. An empty list means no problems were found.

---

## Results in our simulated school

All numbers here are simulated. The test: run the forecast on the last 4 weeks of each simulated school (19 school days) and compare it with the kitchen's usual amount. A leftover serving costs its food cost. A serving the kitchen runs short on costs 3 times its food cost, the same ratio the forecast uses. "Net saved" is the usual amount's cost minus LunchLoop's cost.

The score uses true demand: the simulation knows how many students wanted each item, including students who found it sold out. We ran 5 random simulated schools (5 seeds) and pooled them, 95 school days in all.

- **Pooled over 5 simulated schools:** LunchLoop saves about **$40.90 per school day**. The 95% interval is $21.63 to $59.53.
- **The school in this repo** (seed 20261016, 19 school days): about $74.08 per school day, interval $47.07 to $98.15. One school and one 4-week window swing a lot. Across the 5 seeds the single-school figure ran from $19.79 to $74.08 per day.
- Per day, LunchLoop leaves $118.19 of food uneaten and the usual amount leaves $227.88. LunchLoop comes up 62.13 servings short and the usual amount 17.87.

Where the saving comes from (pooled, per school day):

| Food group | Net saved per day |
| --- | ---: |
| Entree | -$11.18 |
| Grain | -$0.36 |
| Vegetable | $20.41 |
| Fruit | $25.69 |
| Milk | $6.34 |
| **Total** | **$40.90** |

Entrees lose money because LunchLoop runs out more often than the usual amount does. About 78% of the total ($32.03) comes from packaged items (milk cartons, fruit cups, mandarin oranges). If those leftovers are stored and served again instead of wasted, only about $9 per day ($8.87) remains.

Two choices in the simulation push the saving up:

- The usual amount for milk is 12% above recent use, an assumption kept from the prototype. Schools must offer fluid milk every day, but the rule sets no margin. With milk at 2.5% over, the pooled saving is about $35.05 per day instead (interval $17.10 to $52.12).
- Packaged leftovers count as waste, as noted above. Without the packaged items the saving is about $9 per day.

A real school's saving would scale with its size and with how much it over-cooks today. We have not measured that. These numbers come from simulated data, not a real cafeteria.

To regenerate them (each takes a few seconds):

```
python tools/eval_truth.py --seeds 5
python tools/eval_truth.py --seeds 5 --prep-ratio milk=1.025
```

The first command prints the pooled and per-seed tables. The second changes the milk over-prep from 1.12 to 1.025.

For a quick check on just the shipped data, scored on what was served instead of true demand:

```
python -c "import engine, json; print(json.dumps({k: v for k, v in engine.backtest().items() if k != 'series'}, indent=2))"
```

That prints 49.4% fewer leftovers (5,361 servings against 10,603) and a net saving of $1,358.05 over the 4 weeks.

---

## Project layout

- `data/`: the simulated school and the script that makes it (see `data/README.md` and `data/sources.md`)
- `engine/`: the forecast, meal check, backtest, simulator and data checks
- `tools/`: `eval_truth.py`, the true-demand scoring script
- `api/`: the FastAPI app and the student game logic
- `tests/`: tests for the data, engine and API
- `docs/`: the [backend contract](docs/backend-contract.md)

---

## Credits

- [Ekansh Simgekar](https://github.com/magicKansh) built the first forecasting prototype and the simulated cafeteria data this project started from.
- [Yojith](https://github.com/yojithprograms), LunchLoop team member.
- The shortage-aware scoring, the data checks and the no-history fallback build on ideas from Ekansh's TrayTrack branch.

## License

MIT. See [LICENSE](LICENSE).
