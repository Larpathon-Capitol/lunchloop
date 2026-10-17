# Where the numbers come from

Everything in this folder is simulated. There is no real school behind it. This page lists the constants in `simulate.py`, the label for each one, and the source used for each research input.

The labels mean:

- **CONFIRMED:** a number or range checked in the linked source.
- **ESTIMATE:** a value calculated from confirmed inputs or picked from a confirmed range. It is still a simulation choice.
- **ASSUMPTION:** a value chosen for a useful, repeatable simulation. It is not a measured school policy.
- **Calibrated from Ekansh Simgekar's prototype data:** a relative rate or effect kept from the original simulated prototype. The prototype is simulated and private.
- **BLOCKED:** the research search did not find an authoritative value.

## Run setup

| Constant | Value | Label and source |
| --- | --- | --- |
| `SEED` | 20261016 | **ASSUMPTION.** A fixed seed makes every generated file repeatable. |
| Random draws | One `random.Random(seed)`. For each date: attendance draw, shared day draw, one item draw in `items.csv` order, then one vote draw on history Thursdays. | **ASSUMPTION.** This fixed order is part of reproducibility. |
| Bell-curve draw | Twelve uniform draws minus 6.0 | **ASSUMPTION.** A standard-library approximation. |
| Cost format | Two decimal places | **ASSUMPTION.** Dollars and cents. |
| Vote format | Three decimal places | **ASSUMPTION.** Enough precision for a simulated share. |
| Python | 3.12 or newer | **ASSUMPTION.** Matches the project checks. |

## Calendar

The history is 2026-01-12 through 2026-10-16. The future menu is 2026-10-19 through 2026-12-31. School days are weekdays except the listed holidays. These dates are a local simulated calendar.

| Constant | Value | Label |
| --- | --- | --- |
| `HISTORY_START` | 2026-01-12 | **ASSUMPTION.** Start of the simulated term. |
| `HISTORY_END` | 2026-10-16 | **CONFIRMED by the frozen backend contract.** |
| `FUTURE_END` | 2026-12-31 | **ASSUMPTION.** Votes open every school day through 2026-12-18, and each targets a Thursday at least a week later, so the menu runs to 2026-12-31. There is no winter break in this calendar. |
| Holidays | Jan 19, Feb 16, Mar 16 to 20, Apr 3, May 23 to Aug 23, Sep 7, Oct 12 | **ASSUMPTION.** A simple school calendar for the demo. |
| Early release | Feb 26, May 21, Sep 24, Nov 6 | **ASSUMPTION.** |
| Testing days | Apr 7, Apr 8, May 12, Oct 14 | **ASSUMPTION.** |
| Rainy days | Feb 10, Aug 27, Sep 3, Sep 16, Oct 1, Oct 22 | **ASSUMPTION.** |

## Attendance

The simulated school is a large Texas high school of about 2,750 students. The UIL 6A conference begins at 2,215 students for 2026 to 2028. That cutoff is **CONFIRMED** on the [UIL conference cutoffs page](https://www.uiltexas.org/athletics/conference-cutoffs). The choice of 2,750 is an **ESTIMATE**: a size well above the cutoff, picked to stand for a large 6A school.

| Constant | Value | Label and source |
| --- | --- | --- |
| `ENROLL` | 2750 | **ESTIMATE** for a large 6A school. Input: the **CONFIRMED** UIL 6A cutoff above. |
| `BASE_ABSENCE` | 0.083 | **CONFIRMED** TEA El Paso ISD 2024-25 attendance rate of 91.7%. [TEA report](https://rptsvr1.tea.texas.gov/cgi/sas/broker?_debug=0&_program=perfrept.perfmast.sas&_service=marykay&ccyy=2025&id=071902&lev=D&prgopt=reports/tapr/attendgrad.sas) |
| `WEEKDAY_ATTENDANCE` | Monday 1.085343; Tue to Thu 0.927644; Friday 1.131725 | **ESTIMATE** normalized so Monday absence is 17% above and Friday absence is 22% above the Wednesday level while the five-day mean factor is 1.0. The relationships were measured against Wednesday in Rhode Island during 2016 to 2019 in this [attendance study](https://files.eric.ed.gov/fulltext/ED677930.pdf#page=7). |
| Pre-break absence multiplier | 1.9 | **ASSUMPTION** that keeps the original prototype behavior. **CONFIRMED** research says absence exceeded 10% before major breaks in the same [attendance study](https://files.eric.ed.gov/fulltext/ED677930.pdf#page=7). |
| Rainy absence multiplier | 1.25 | **ASSUMPTION.** |
| Testing absence multiplier | 0.7 | **ASSUMPTION.** |
| Attendance floor | `round(850 * enroll / 1200)`, 1,948 at 2,750 | **ESTIMATE** scaled from the original 850-student floor. |
| Absence noise | `13 * enroll / 1200`, 29.79 students at 2,750 | **ESTIMATE** scaled from the original 13-student noise. |
| Absent students | `round(enroll * BASE_ABSENCE * weekday * note + noise * draw)` | **ASSUMPTION** combining the rows above. |

## Items, participation, and costs

The item list, components, floors, allergens, and relative popularity are simulated menu choices. Six relative rates and three relative effects remain **calibrated from Ekansh Simgekar's original prototype data**: cheese pizza, chicken nuggets, popcorn chicken, chocolate milk, fruit cup, and steamed carrots. The prototype is simulated. No rows were copied.

The research recommendation is a median daily participation of 42% of enrollment at Texas high schools with at least 2,000 students. CEP campuses were 55.8% and non-CEP campuses were 37.3% in the same analysis. Those values are **CONFIRMED** in the Texas Education Agency data: [Texas participation data](https://data.texas.gov/resource/i9vs-cqmu.json?%24where=programyear%3D%272024-2025%27&%24limit=5000&%24offset=0) and [CEP breakdown](https://data.texas.gov/resource/5ejx-uftk.json?%24where=programyear%3D%272024-2025%27&%24limit=5000&%24offset=0). In LunchLoop terms the 42% median is about 46% of students present because 42% divided by 91.7% is about 46%.

| Constant | Value | Label |
| --- | --- | --- |
| `PARTICIPATION_FACTOR` | 0.7230521604 | **ESTIMATE**. It is 0.46 divided by 0.636192, the per-day **sum** of the three raw entree take rates averaged over history days. It multiplies every item rate, so item popularity stays in the same relative order. |
| Take rate meaning | Share of students present who take an item before day and item noise | **ASSUMPTION.** |
| Entrees per day | 3 | **ASSUMPTION.** |
| Entree rotation | 14 entrees, vegetarian and meat alternating, so any three neighbours include a vegetarian entree. Each weekday walks the rotation three places per serving day; weekdays start four places apart; phase 11. | **ASSUMPTION.** Every entree gets about 27 history days and at least four on each weekday before 2026-09-21. With so few days per entree its sold-out share moves several points with the phase, so the phase was picked (of 196 step and phase pairs) to keep every entree at or under 35%. |
| New entree rates and costs | bean and cheese burrito 0.22, veggie burger 0.18, black bean quesadilla 0.19, chickpea curry 0.16, falafel wrap 0.15, teriyaki tofu bowl 0.14, chicken shawarma wrap 0.20, orange chicken 0.21 | **ASSUMPTION.** Simulated menu choices, not calibrated from any source. |
| Produce floors | Carrots 120, broccoli 80, fruit cup 150, mandarin oranges 70 | **ASSUMPTION.** Other items have floor 0. |

Costs are **ESTIMATES**. The inputs are **CONFIRMED**: Boston's 2010-11 component costs were entree $0.56, grain $0.07, vegetable $0.21, fruit $0.19, and milk $0.17 ([Boston table](https://pmc.ncbi.nlm.nih.gov/articles/PMC3788640/)); USDA reported $1.69 mean food cost per reimbursable lunch ([USDA report](https://fns-prod.azureedge.us/sites/default/files/resource-files/SNMCS-Volume3.pdf#page=63)); and food-away-from-home inflation was 1.4398x from 2015 to 2024 ([CPI table](https://www.govinfo.gov/content/pkg/ECONI-2025-01/pdf/ECONI-2025-01.pdf#page=24)). We scale each original component's relative item costs so its mean is the target for a $2.25 lunch. That $2.25 target is a pick inside the $2.14 to $2.43 range worked out from the same [CPI table](https://www.govinfo.gov/content/pkg/ECONI-2025-01/pdf/ECONI-2025-01.pdf#page=24), then we round to cents.

| Component | Item costs in the current files | Target mean |
| --- | --- | --- |
| `meat_alternate` | 1.06, 1.13, 0.88, 1.32, 0.73, 1.19 | about $1.05 |
| `grain` | 0.14, 0.12 | $0.13 |
| `vegetable` | 0.37, 0.41 | $0.39 |
| `fruit` | 0.38, 0.34 | $0.36 |
| `milk` | 0.37, 0.27 | $0.32 |

## Menu and demand

The entree rotation, daily sides, pizza Friday effect, calendar notes, and noise are **ASSUMPTIONS**. Demand is:

`round(attendance * effective take rate * weekday factor * note factor * day noise * item noise)`.

The day noise is 3%, the item noise is 6%, and both factors are clamped to 0.75 through 1.35. Pizza uses 0.971 Monday to Thursday and 1.116 on Friday. Taken servings are the smaller of latent demand and prepared servings. A sold-out row therefore censors demand.

## Kitchen usual amount

The usual amount is the item's average servings taken over its last 20 served days, times a fixed over-prep for its food group. Entrees and grains are 7.5%, fruit and vegetables 20%, milk 12%. Each value is an **ASSUMPTION** for this simulation. The cited studies give context about leftovers and overproduction. There is no published over-prep standard.

- fruit and vegetable: 1.20. **ASSUMPTION.** The cited studies report production leftovers of 10.2% to 28.7% and 15.31% unserved food in a case study. That is context, not a measured over-prep standard ([school meal leftovers study](https://pubmed.ncbi.nlm.nih.gov/24747044/), [case study](https://pdfs.semanticscholar.org/9cf7/12fceb42ac0eaa1b26de9b6eef2675efdf5e.pdf#page=5)).
- meat alternate and grain: 1.075. **ASSUMPTION.** The cited Colorado abstract reports under 5% overproduced in the school kitchens it studied. It does not establish a margin for this simulation ([abstract](https://www.sciencedirect.com/science/article/abs/pii/S2212267218313947)).
- milk: 1.12. **ASSUMPTION.** The rule says fluid milk must be offered daily with at least two options, but it does not set an over-prep margin ([7 CFR 210.10](https://www.ecfr.gov/current/title-7/subtitle-B/chapter-II/subchapter-A/part-210/section-210.10): "Fluid milk must be offered daily" and "Schools must offer students a variety (at least two different options) of fluid milk at lunch daily."). The value 1.12 comes from the original prototype and is kept as an assumption. At 1.025, at least one milk runs out on 73.6% of history days (54.8% of milk item-days). We judged a kitchen that must offer milk every day would not run out that often, so 1.12 is kept. At 1.12 it happens on 8.8% of days (4.8% of milk item-days). The command is in [README.md](README.md#two-choices-that-raise-the-simulated-saving).

**ASSUMPTION:** Unopened milk cartons and sealed fruit cups are counted as waste in this simulation. Some of them may be stored and served again, which would make the waste dollars too high. A Finnish food-service study reports that caterers reuse some overproduced food on later days, but it does not show what US school kitchens do with unopened items ([study](https://projects.luke.fi/ravintolafoorumi/wp-content/uploads/sites/4/2019/09/Silvennoinen_WM_2019.pdf#page=6)).

The generated history has a 20.1% combined sold-out rate for entree and grain item-days.

There is no authoritative universal over-prep standard. The search for one found nothing, so that result is **BLOCKED**: [ICN search result](https://theicn.org/resources/120/financial-management-a-course-for-school-nutrition-managers/103050/financial-management-managers-instructors-manual.pdf).

The first-ever amount for an item with no history uses `component_ratio * ENROLL * (1 - BASE_ABSENCE) * effective_take_rate`. Prep rounds to the nearest five and respects the produce floor.

## How big the two biases are

These two choices raise the simulated saving. The figures are simulated, pooled over 5 seeds (95 school days), scored against true demand, and printed by `python tools/eval_truth.py --seeds 5`.

| Choice | Effect |
| --- | --- |
| Milk usual amount of 1.12 instead of 1.025 | Net saving is $53.09 per school day at 1.12 and about $45.84 at 1.025 (`python tools/eval_truth.py --seeds 5 --prep-ratio milk=1.025`). |
| Packaged items counted as waste (milk cartons, fruit cup, mandarin oranges) | They are about 71% of the pooled net saving ($37.93 of $53.09). Without them it is about $15 per day ($15.16). |

## Votes

History Thursdays give the selected special a simulated share from 0.36 through 0.52. Future vote options are four entrees. Exactly one is on the target Thursday's menu (its first rotation entree, the one the vote ends up serving); the other three are off-menu entrees that change each school day. At least one option is vegetarian, and the on-menu option moves through the four positions. These are **ASSUMPTIONS** for the demo. Future entree ties are broken by lowering the later item by one latent serving so the guessing game has one winner.

## Data contract and true demand

`main()` writes exactly the five contract CSVs and never writes true demand. `generate(seed=SEED, enroll=ENROLL)` returns the rows in memory plus `true_demand[(date, item_id)]` for history and future days. The draw order above is unchanged. All generated files remain simulated.
