# LunchLoop

LunchLoop tells a school cafeteria how many servings of each item to cook, so less food ends up in the trash. It also has a daily student game: spin to see menu options, vote, and guess what will be popular.

It is a web app with a Python backend. We're building it for Hack Club Capitol. The main demo runs on a simulated school, a large Texas high school of 2,750 students, not real cafeteria records.

---

## Try it

Open the site: **https://larpathon-capitol.github.io/lunchloop/**

The site is hosted on GitHub Pages and talks to a backend that we run ourselves. If the backend is off, the pages will load but show no data.

- `/` is the home page.
- `/hub` lists every page and has a QR code for the live game, so a room can join from their phones.
- `/student` is the student game on the simulated school: spin, vote, make a "Called It" guess, build streaks, earn badges, and watch the leftovers meter.
- `/school` is the staff sign-in. Each school signs in on its own and only sees its own votes. The "What students want" panel updates live.
- `/school/kitchen` is the cafeteria manager's view: the prep list, a meal check, what-if sliders for attendance and price, and the savings.
- `/live` is a separate live demo school where real votes are counted. `/live/admin` is its staff view. The staff password is set by whoever runs the server.
- `/behind-the-scenes` shows the server's anonymous event log, the path a request takes, and a forecast worked out step by step.

The simulated school's demo staff password is `lunchloop`. It is public on purpose, so anyone can try the staff view.

Students do not need an account. The browser makes a random device ID and keeps it. There is no name or email.

---

## Run it yourself

You need Python 3.12 or newer, Node.js 22 and git.

### macOS and Linux

Get Python 3.12 or newer if you don't have it. On macOS, download it from [python.org](https://www.python.org/downloads/) or run `brew install python@3.12`. Check with `python3 --version`. If it says something older than 3.12, use `python3.12` in place of `python3` below. Get Node.js from [nodejs.org](https://nodejs.org/) and check with `node --version`.

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

Start the backend (port 8000):

```
uvicorn api.main:app --reload
```

In a second terminal, start the web app:

```
cd lunchloop/web
npm ci
npm run dev
```

Open the address that Vite prints. It sends anything under `/api` to the backend on `127.0.0.1:8000`.

To check the backend by itself:

```
curl http://127.0.0.1:8000/api/health
curl "http://127.0.0.1:8000/api/prep"
```

The first one should answer `{"ok":true,"today":"2026-10-19","simulated":true}`. The second returns a prep amount and a one-line reason for each menu item, for example `"prep": 560` and `"reason": "Attendance is normal, buffer +22"` for cheese pizza.

To build the site the way it is published:

```
npm run build
```

### Windows

Get Python 3.12 or newer from [python.org](https://www.python.org/downloads/), Node.js from [nodejs.org](https://nodejs.org/) and git from [git-scm.com](https://git-scm.com/download/win). Check with `py -3 --version` and `node --version`. Then, in PowerShell or Command Prompt:

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

Start the backend (port 8000):

```
uvicorn api.main:app --reload
```

In a second terminal, start the web app:

```
cd lunchloop\web
npm ci
npm run dev
```

Open the address that Vite prints. It sends anything under `/api` to the backend on `127.0.0.1:8000`. You can also open `http://127.0.0.1:8000/api/health` and `http://127.0.0.1:8000/api/prep` in your browser to check the backend by itself, with the same answers described in the macOS steps above.

To build the site the way it is published:

```
npm run build
```

### Settings

All optional. Set them as environment variables before starting the backend.

- `LUNCHLOOP_DATA_DIR`: where the CSV data lives (default `data`)
- `LUNCHLOOP_TODAY`: the demo "today" (default `2026-10-19`)
- `LUNCHLOOP_DB`: the SQLite file for votes and streaks (default `lunchloop.db`)
- `LUNCHLOOP_CORS_ORIGIN`: allowed web origin, or several separated by commas (default `*`)
- `LUNCHLOOP_SCHOOL_PASSWORDS`: staff passwords for real schools, as `school_id=hash` pairs separated by commas
- `LUNCHLOOP_SECRET`: the secret that signs staff sign-ins and anonymous player tags (random on each start if unset, so sign-ins end on restart)
- `LUNCHLOOP_DOCS`: set to `1` to turn on the interactive API docs at `/docs` (off by default)

For example, `export LUNCHLOOP_TODAY=2026-10-20` on macOS and Linux, `$env:LUNCHLOOP_TODAY="2026-10-20"` in PowerShell, or `set LUNCHLOOP_TODAY=2026-10-20` in Command Prompt.

You can also move the demo clock for a single request with a header, like `X-Demo-Date: 2026-10-20`. The live demo school ignores that header, so nobody can vote twice by changing the date.

### Staff passwords

Passwords never live in the repo. To give a school a password, make a hash and put it in `LUNCHLOOP_SCHOOL_PASSWORDS`:

```
python tools/hash_password.py
```

It asks for the password and prints a hash. Then set, for example, `LUNCHLOOP_SCHOOL_PASSWORDS=live=<the hash>`. A school with no hash cannot sign in. The one exception is the simulated `demo` school, which uses the public password above.

### Publishing your own copy

The site is built and published by GitHub Actions from `main`. Set the repository variable `LUNCHLOOP_API_URL` to the `https` address of your backend first, or the publish step stops.

The full list of routes and response shapes is in the [API reference](docs/backend-contract.md).

---

## Current features

- A simulated large Texas high school of 2,750 students, made by `python data/simulate.py` with a fixed seed. It has 136 school days of history (Jan 12 to Oct 16, 2026), 30 menu items across all five meal components (14 entrees, 7 of them vegetarian, and 2 to 3 choices of grain, vegetable, fruit and milk every day), and 59 upcoming school days of menu (Oct 19, 2026 to Jan 29, 2027).
- A forecast engine that suggests a prep amount for each menu item, with a one-line reason for each. An item with no history gets a rough guess instead of an error.
- Data checks: `engine.validate()` lists problems in the data files in plain words.
- A meal check that flags a missing food group.
- A backtest that scores the forecast on the last 4 weeks of history, with shortages priced in.
- `tools/eval_truth.py`, which scores the forecast against how much food students really wanted in the simulation, not just what was served.
- A what-if simulator for attendance and price changes.
- A student game: spin for menu options, vote, guess the most popular item (Called It), streaks, XP, badges, and a school leftovers meter.
- Students are identified only by a device ID, not a name or email. Votes are stored per school.
- Staff sign-in for each school, with a live "What students want" panel.
- A kitchen view with the prep list, meal check, what-if sliders and savings.
- A live demo school where real votes are counted.
- A "Behind the scenes" page with the server's anonymous event log, the path a request takes, and a forecast worked out step by step.
- A hub page that lists every page and shows a QR code for the live game.
- Safety limits: requests and votes are rate limited per IP address, request bodies over 16 KB are refused, and the interactive API docs are off by default.
- An API (FastAPI and SQLite) with routes under `/api`.

---

## Known limitations

- All data is simulated. No real school has used LunchLoop.
- Every school shares the one simulated menu for now.
- The prep, savings and simulate routes are open. They are not behind staff sign-in.
- The live page counts real taps, but anyone can make a new device ID. It is a demo, not a secure poll.
- The event log on the "Behind the scenes" page is kept in memory. It holds the newest 300 events and is gone when the server restarts.
- The hosted backend runs on a single machine, so the site only works while that machine is up.
- Votes and streaks live in a local SQLite file, so a fresh deploy resets them.
- Allergens in the data are placeholders, not product labels. Do not use them for real food safety.
- At the default setting, LunchLoop runs short more often than the kitchen's usual amount (see the results below).
- Entrees and grains sell out on some days in the simulated history (19.9% of entree and grain item-days), so the history undercounts what students wanted. `tools/eval_truth.py` scores against the true demand to check this.
- Packaged items (milk cartons, fruit cups, mandarin oranges, bagged apple slices) are counted as waste when they are not eaten. Some of them may be stored and served again, so the results may overstate their waste.
- The kitchen's "usual amount" is a fixed over-prep per food group (7.5% for entrees and grains, 20% for fruit and vegetables, 12% for milk). These margins are our assumptions. No published standard sets them.
- The 4-week backtest (`engine.backtest()` and the leftovers meter) can only see what was served, so the usual amount never shows a shortage there and only LunchLoop's shortages are charged. `tools/eval_truth.py` scores both against true demand and is the fairer check.
- Each school day has four vote options with at least one vegetarian entree. The simulated calendar follows a typical Texas district pattern (weekends, Thanksgiving week, winter break, spring break, summer and the usual Monday holidays are off), not any real district's calendar.

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

- **Pooled over 5 simulated schools:** LunchLoop saves about **$81.10 per school day**. The 95% interval is $58.34 to $103.16.
- **The school in this repo** (seed 20261016, 19 school days): about $74.52 per school day, interval $13.10 to $130.83. One school and one 4-week window swing a lot. Across the 5 seeds the single-school figure ran from $71.50 to $94.55 per day.
- Per day, LunchLoop leaves $153.46 of food uneaten and the usual amount leaves $316.22. LunchLoop comes up 84.48 servings short and the usual amount 20.74.

Where the saving comes from (pooled, per school day):

| Food group | Net saved per day |
| --- | ---: |
| Entree | -$3.75 |
| Grain | -$1.88 |
| Vegetable | $41.67 |
| Fruit | $40.92 |
| Milk | $4.14 |
| **Total** | **$81.10** |

Entrees and grains lose money because LunchLoop runs out more often than the usual amount does. About 54% of the total ($43.39) comes from packaged items (milk cartons, fruit cups, mandarin oranges, bagged apple slices). If those leftovers are stored and served again instead of wasted, about $38 per day ($37.71) remains.

Two choices in the simulation push the saving up:

- The usual amount for milk is 12% above recent use, an assumption kept from the prototype. Schools must offer fluid milk every day, but the rule sets no margin. With milk at 2.5% over, the pooled saving is about $78.81 per day instead (interval $58.47 to $98.35).
- Packaged leftovers count as waste, as noted above. Without the packaged items the saving is about $38 per day.

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

That prints 56.6% fewer leftovers (5,688 servings against 13,100) and a net saving of $1,348.37 over the 4 weeks.

---

## Project layout

- `data/`: the simulated school and the script that makes it (see `data/README.md` and `data/sources.md`)
- `engine/`: the forecast, meal check, backtest, simulator and data checks
- `tools/`: `eval_truth.py`, the true-demand scoring script, and `hash_password.py`, which makes staff password hashes
- `api/`: the FastAPI app, the student game logic and staff sign-in
- `web/`: the web app (React and Vite)
- `.github/workflows/`: the build check and the GitHub Pages publish
- `tests/`: tests for the data, engine and API
- `docs/`: the [backend contract](docs/backend-contract.md)

---

## Credits

- [Ekansh Simgekar](https://github.com/magicKansh) built the first forecasting prototype and the simulated cafeteria data this project started from. He also helped with the simulated school dataset (3da8b1a, d24c487), the API and database (9c0d6b1), and the README and data notes (b8baa8c, fd7ffe7).
- [Yojith](https://github.com/yojithprograms), LunchLoop team member, helped with the forecast engine (31d2753), the API and database (9c0d6b1), the first web frontend (328d934) and serving the app pages on GitHub Pages (f24038f).
- The shortage-aware scoring, the data checks and the no-history fallback build on ideas from Ekansh's TrayTrack branch.

## License

MIT. See [LICENSE](LICENSE).
