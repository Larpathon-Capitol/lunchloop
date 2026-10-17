# Where the numbers come from

Everything in this folder is simulated. There is no real school behind it. This page lists every number in `simulate.py` and says where it came from.

Only one number is checked against a real source: the base absence rate. Everything else is a guess, a copy of a teammate's prototype numbers, or an idea from a source we have not checked.

The labels:

- **Source:** the value comes from a real document that we opened and checked.
- **Calibrated from Ekansh Simgekar's prototype data:** measured from a teammate's small prototype dataset and turned into a parameter. That dataset is itself simulated, not from a real cafeteria. His repo is private, so there is no link. No rows were copied.
- **ASSUMPTION (unverified source: URL):** an idea we took from a document, but we did not confirm the exact number against it.
- **ASSUMPTION: reason:** our own guess, with the reason for it.

---

## Run setup

| Constant | Value | Label |
| --- | --- | --- |
| `SEED` | 20261016 | ASSUMPTION: any fixed number works. This one is the date the history ends (2026-10-16), so it is easy to remember. The same seed gives the same files every run. |
| Random draws | One `random.Random(SEED)` for the whole run. Draw order: for each date, attendance noise, day noise, one noise per item served (in `items.csv` order), then one vote draw on history Thursdays. | ASSUMPTION: a fixed order keeps output identical on every machine. |
| Bell-curve draw | Add 12 random numbers, subtract 6.0 | ASSUMPTION: a simple bell-curve draw that needs only Python's standard library. |
| Python version | 3.12 or newer | ASSUMPTION: matches what our checks run on. |
| Cost format | 2 decimals | ASSUMPTION: dollars and cents. |
| Vote share format | 3 decimals | ASSUMPTION: enough precision for a share. |

## Calendar

| Constant | Value | Label |
| --- | --- | --- |
| `HISTORY_START` | 2026-01-12 (Monday) | ASSUMPTION: start of the spring term of the simulated school. |
| `HISTORY_END` | 2026-10-16 (Friday) | ASSUMPTION: fixed by the backend contract. The demo "today" is the next Monday, 2026-10-19. |
| `FUTURE_END` | 2026-11-13 (Friday) | ASSUMPTION: four school weeks of upcoming menu after the history ends. |
| School day | Monday to Friday, not a holiday | ASSUMPTION: a typical US school week. |
| `HOLIDAYS`: 2026-01-19 | no school | ASSUMPTION: a typical US school calendar, not any real district's. |
| `HOLIDAYS`: 2026-02-16 | no school | ASSUMPTION: same reason. |
| `HOLIDAYS`: 2026-03-16 to 2026-03-20 (5 days) | spring break | ASSUMPTION: same reason. |
| `HOLIDAYS`: 2026-04-03 | no school | ASSUMPTION: same reason. |
| `HOLIDAYS`: 2026-05-23 for 93 days (through 2026-08-23) | summer break | ASSUMPTION: a typical summer break, so history has no school days between May and late August. |
| `HOLIDAYS`: 2026-09-07 | no school | ASSUMPTION: same reason. |
| `HOLIDAYS`: 2026-10-12 | no school | ASSUMPTION: same reason. |
| `EARLY_RELEASE` | 2026-02-26, 2026-05-21, 2026-09-24, 2026-11-06 | ASSUMPTION: a few odd days picked by hand so the data has some. 2026-11-06 is in the upcoming menu. |
| `TESTING` | 2026-04-07, 2026-04-08, 2026-05-12, 2026-10-14 | ASSUMPTION: picked by hand, same reason. |
| `RAINY` | 2026-02-10, 2026-08-27, 2026-09-03, 2026-09-16, 2026-10-01, 2026-10-22 | ASSUMPTION: picked by hand, not real weather. 2026-10-22 is in the upcoming menu. |
| `pre_break` rule | A school day is `pre_break` if the next school day is more than 3 calendar days later | ASSUMPTION: the last day before a break. A normal Friday to Monday gap does not count. |
| Note priority | `early_release`, then `testing`, then `rainy`, then `pre_break` | ASSUMPTION: only one note per day, so a fixed order settles any overlap. |

## Attendance

| Constant | Value | Label |
| --- | --- | --- |
| `ENROLL` | 1200 | ASSUMPTION: a large high school of about 1,200 students. |
| `BASE_ABSENCE` | 0.083 (8.3% absent) | Source: TEA, El Paso ISD 2024-25 attendance rate of 91.7%. https://rptsvr1.tea.texas.gov/cgi/sas/broker?_debug=0&_program=perfrept.perfmast.sas&_service=marykay&ccyy=2025&id=071902&lev=D&prgopt=reports/tapr/attendgrad.sas |
| `WEEKDAY_ATTENDANCE` Monday | 1.085 | ASSUMPTION (unverified source: https://files.eric.ed.gov/fulltext/ED677930.pdf). Monday absence about 17% above Wednesday. |
| `WEEKDAY_ATTENDANCE` Tuesday, Wednesday, Thursday | 0.928 each | ASSUMPTION: the middle of the week is treated as one level. The three values are set so the five weekday numbers average to 1.0. |
| `WEEKDAY_ATTENDANCE` Friday | 1.132 | ASSUMPTION (unverified source: https://files.eric.ed.gov/fulltext/ED677930.pdf). Friday absence about 22% above Wednesday. |
| Absence note multiplier `pre_break` | 1.9 | ASSUMPTION: many students skip the day before a break. |
| Absence note multiplier `rainy` | 1.25 | ASSUMPTION: bad weather keeps some students home. |
| Absence note multiplier `testing` | 0.7 | ASSUMPTION: attendance is pushed on test days. |
| Absence note multiplier `early_release`, none | 1.0 | ASSUMPTION: no change. |
| Absence noise | 13.0 students (times one bell-curve draw) | ASSUMPTION: gives a day-to-day swing of a few dozen students out of 1,200. |
| Absent students | `round(ENROLL * BASE_ABSENCE * weekday * note + 13.0 * draw)` | ASSUMPTION: our formula built from the rows above. |
| Attendance clamp | Between 850 and 1200 (the 1200 is `ENROLL`) | ASSUMPTION: keeps one unlucky draw from making a silly day. |

## Items

All 14 items share one rule for where they came from.

| Part | Label |
| --- | --- |
| Item list and components | ASSUMPTION (unverified source: https://core-docs.s3.us-east-1.amazonaws.com/documents/asset/uploaded_file/3850/PISD/4673053/2024-25_HS_Lunch_and_a_la_carte_Menu.pdf, https://www.trschools.com/parents/docs/2025/02/2MARCH-2025-HIGH-SCHOOL-MENU.pdf and https://resources.finalsite.net/images/v1740603724/cfisdnet/p0u3qklqosgny1axaon9/HSMarch2025WebAccessibleMenu.pdf). Kinds of items seen on district high school menus. Not every item appears on every menu listed, and we did not check each item against them. |
| Allergens | ASSUMPTION: typical guesses for each food, not product labels. They are placeholders for a simulated school. Real allergen information always comes from the product label and nutrition staff. |

| item_id | Component | Cost per serving | Allergens | Prep floor | Take rate | Served | Cost and rate label |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `cheese_pizza` | meat_alternate | 0.85 | milk;wheat | 0 | 0.346 | entree ring | Calibrated from Ekansh Simgekar's prototype data |
| `beef_nachos` | meat_alternate | 0.90 | milk;wheat | 0 | 0.200 | entree ring | ASSUMPTION: a guess near the other entrees. |
| `chicken_nuggets` | meat_alternate | 0.70 | wheat | 0 | 0.234 | entree ring | Calibrated from Ekansh Simgekar's prototype data |
| `cheeseburger` | meat_alternate | 1.05 | milk;soybeans;wheat | 0 | 0.300 | entree ring | ASSUMPTION: a guess, a bit more costly and popular than most entrees. |
| `popcorn_chicken` | meat_alternate | 0.58 | wheat;soybeans | 0 | 0.199 | entree ring | Calibrated from Ekansh Simgekar's prototype data |
| `spicy_chicken_sandwich` | meat_alternate | 0.95 | soybeans;wheat | 0 | 0.235 | entree ring | ASSUMPTION: a guess near the other entrees. |
| `dinner_roll` | grain | 0.18 | wheat | 0 | 0.420 | daily | ASSUMPTION: a cheap side that many students take. |
| `brown_rice` | grain | 0.15 | none | 0 | 0.150 | Tuesday, Thursday | ASSUMPTION: a cheap side that fewer students take. |
| `steamed_carrots` | vegetable | 0.25 | none | 120 | 0.295 | daily | Calibrated from Ekansh Simgekar's prototype data |
| `broccoli` | vegetable | 0.28 | none | 80 | 0.180 | Monday, Wednesday, Friday | ASSUMPTION: a guess, slightly above carrots in cost and below in popularity. |
| `fruit_cup` | fruit | 0.40 | none | 150 | 0.433 | daily | Calibrated from Ekansh Simgekar's prototype data |
| `mandarin_oranges` | fruit | 0.35 | none | 70 | 0.150 | Monday, Wednesday, Friday | ASSUMPTION: a guess below the fruit cup. |
| `chocolate_milk` | milk | 0.40 | milk | 0 | 0.308 | daily | Calibrated from Ekansh Simgekar's prototype data |
| `milk_1pct` | milk | 0.30 | milk | 0 | 0.140 | daily | ASSUMPTION: a plain milk option that fewer students pick. |

| Constant | Value | Label |
| --- | --- | --- |
| Take rate meaning | Share of students present who take the item, before noise | ASSUMPTION: our definition. |
| Prep floor (the four fruit and vegetable items) | 120 steamed carrots, 80 broccoli, 150 fruit cup, 70 mandarin oranges | ASSUMPTION: the kitchen always preps at least this much of fruit and vegetables. Other items have a floor of 0. |
| `RING` | The first six items above, in that order | ASSUMPTION: the entree rotation uses these six. |

## Menu

| Constant | Value | Label |
| --- | --- | --- |
| Entrees per day | 3 | ASSUMPTION: a typical choice of a few entrees a day. |
| Rotation length | 3 weeks, counted in calendar weeks from 2026-01-12 (holidays do not shift it) | ASSUMPTION: a fixed cycle so the menu repeats. |
| Rotation formula | `offset = (2 * (5 * week + weekday)) % 6`, then three entrees in a row from `RING` starting at `offset` | ASSUMPTION: a simple way to cycle all six entrees. Every day has exactly one of nachos, cheeseburger or spicy chicken sandwich. |
| Daily sides | `dinner_roll`, `steamed_carrots`, `fruit_cup`, `chocolate_milk`, `milk_1pct` every school day | ASSUMPTION: a fruit, a vegetable, a grain and two milks each day. |
| Tuesday and Thursday sides | `brown_rice` | ASSUMPTION: to vary the grain. |
| Monday, Wednesday and Friday sides | `broccoli`, `mandarin_oranges` | ASSUMPTION: to vary the vegetable and fruit. |
| Pizza on Fridays | Cheese pizza sells more on Fridays (see Demand). Whether pizza is served on a Friday follows the rotation, not a rule. | ASSUMPTION (unverified source: https://www.trschools.com/parents/docs/2025/02/2MARCH-2025-HIGH-SCHOOL-MENU.pdf). The idea that Friday pizza is common. |

## Demand

| Constant | Value | Label |
| --- | --- | --- |
| Demand formula | `round(attendance * take rate * pizza weekday factor * note factor * day noise * item noise)` | ASSUMPTION: our formula built from the rows here and in Items. |
| Pizza weekday factor, Monday to Thursday | 0.971 | Calibrated from Ekansh Simgekar's prototype data |
| Pizza weekday factor, Friday | 1.116 (the pizza Friday bump) | Calibrated from Ekansh Simgekar's prototype data |
| Weekday factor, every other item | 1.0 every day | ASSUMPTION: the prototype showed no clear weekday pattern for them. |
| Demand note factor `early_release` | 0.92 | ASSUMPTION: fewer students stay for lunch. |
| Demand note factor `rainy` | 1.04 | ASSUMPTION: a few more students eat at school on a wet day. |
| Demand note factor `pre_break` | 0.97 | ASSUMPTION: slightly lower interest before a break. |
| Demand note factor `testing`, none | 1.0 | ASSUMPTION: no change. |
| Day noise size | 0.03 (3%), the same for every item on a day | ASSUMPTION: a small shared swing, such as a busy lunch period. |
| Item noise size | 0.06 (6%), separate for each item | ASSUMPTION: a small per-item swing. |
| Noise clamp | Each noise factor stays between 0.75 and 1.35 | ASSUMPTION: keeps one extreme draw from making a silly day. |
| Servings taken | The smaller of demand and servings prepared | ASSUMPTION: students cannot take food that was not cooked. This is why `servings_taken` undercounts demand on sold-out days. |
| `sold_out` | 1 when taken equals prepared, else 0 | ASSUMPTION: as defined by the backend contract. |

## Kitchen usual amount

| Constant | Value | Label |
| --- | --- | --- |
| Usual-amount rule | Look at the item's last 20 days it was served (servings taken), average them, multiply by `PREP_RATIO` | ASSUMPTION: our guess at how a typical kitchen "cooks the usual". It ignores the weekday, attendance and the day note on purpose. |
| `PREP_RATIO` | 1.12 | Calibrated from Ekansh Simgekar's prototype data (his prep to served ratio was about 1.11). |
| Window | Last 20 served days of that item (all earlier days, including upcoming menu days already generated) | ASSUMPTION: about a month of school days. |
| First-day fallback | `PREP_RATIO * 1100 * take rate` when an item has no earlier days | ASSUMPTION: 1,100 is a round guess at typical attendance. |
| Rounding | Nearest 5 servings | ASSUMPTION: kitchens cook in round numbers. |
| Prep floor | Servings prepared is at least the item's prep floor | ASSUMPTION: see the Items table. |

## Votes

| Constant | Value | Label |
| --- | --- | --- |
| Which days have a vote share | Thursdays in the history only. The day's special (nachos, cheeseburger or spicy chicken sandwich) gets the share. Every other row is empty. | ASSUMPTION: we pretend students voted on that Thursday's special. The upcoming menu has no votes yet. |
| `vote_share` | `0.36 + 0.16 * u`, where `u` is a random number from 0 to 1 (so 0.36 to 0.52) | ASSUMPTION: a winner of a three-way vote would usually get a bit over a third of the votes. |
| Vote options rule | For each upcoming school day, the target is the first upcoming Thursday at least 7 calendar days later. Slot is `entree`. The options are `beef_nachos`, `cheeseburger`, `spicy_chicken_sandwich`, in that order. | ASSUMPTION: gives students a week of notice. The target Thursday's menu always has exactly one of the three. |
| Called It tie rule | "Called It" is the guessing game in the app. In the upcoming menu, if two or more entrees tie for most servings taken, the later one in `items.csv` loses 1 from its demand. Repeat until one entree is on top. | ASSUMPTION: the game needs one clear winner per day. With the current seed this never triggers. |
