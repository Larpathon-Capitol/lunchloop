# Where the numbers come from

Everything in this folder is simulated. There is no real school behind it. This page lists the constants in `simulate.py`, the label for each one, and the source used for each research input.

The labels mean:

- **CONFIRMED:** a number or range checked in the linked source.
- **ESTIMATE:** a value calculated from confirmed inputs or selected as a midpoint. It is still a simulation choice.
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

The history is 2026-01-12 through 2026-10-16. The future menu is 2026-10-19 through 2026-11-13. School days are weekdays except the listed holidays. These dates are a local simulated calendar.

| Constant | Value | Label |
| --- | --- | --- |
| `HISTORY_START` | 2026-01-12 | **ASSUMPTION.** Start of the simulated term. |
| `HISTORY_END` | 2026-10-16 | **CONFIRMED by the frozen backend contract.** |
| `FUTURE_END` | 2026-11-13 | **ASSUMPTION.** Four school weeks after history. |
| Holidays | Jan 19, Feb 16, Mar 16 to 20, Apr 3, May 23 to Aug 23, Sep 7, Oct 12 | **ASSUMPTION.** A simple school calendar for the demo. |
| Early release | Feb 26, May 21, Sep 24, Nov 6 | **ASSUMPTION.** |
| Testing days | Apr 7, Apr 8, May 12, Oct 14 | **ASSUMPTION.** |
| Rainy days | Feb 10, Aug 27, Sep 3, Sep 16, Oct 1, Oct 22 | **ASSUMPTION.** |

## Attendance

The simulated school is a large Texas high school of about 2,750 students. The UIL 6A conference begins at 2,215 students for 2026 to 2028. That cutoff is **CONFIRMED** in [T01-12](https://www.uiltexas.org/athletics/conference-cutoffs). The choice of 2,750 is an **ESTIMATE** in the middle of the recommended 6A range.

| Constant | Value | Label and source |
| --- | --- | --- |
| `ENROLL` | 2750 | **ESTIMATE** for a mid-size 6A school. Input: **CONFIRMED** T01-12. |
| `BASE_ABSENCE` | 0.083 | **CONFIRMED** TEA El Paso ISD 2024-25 attendance rate of 91.7%. [TEA report](https://rptsvr1.tea.texas.gov/cgi/sas/broker?_debug=0&_program=perfrept.perfmast.sas&_service=marykay&ccyy=2025&id=071902&lev=D&prgopt=reports/tapr/attendgrad.sas) |
| `WEEKDAY_ATTENDANCE` | Monday 1.085343; Tue to Thu 0.927644; Friday 1.131725 | **ESTIMATE** normalized so Monday absence is 17% above and Friday absence is 22% above the Wednesday level while the five-day mean factor is 1.0. The relationships were measured against Wednesday in Rhode Island during 2016 to 2019 in T08-5 and T08-6: [attendance study](https://files.eric.ed.gov/fulltext/ED677930.pdf#page=7). |
| Pre-break absence multiplier | 1.9 | **ASSUMPTION** that keeps the original prototype behavior. **CONFIRMED** research says absence exceeded 10% before major breaks in T08-9: [attendance study](https://files.eric.ed.gov/fulltext/ED677930.pdf#page=7). |
| Rainy absence multiplier | 1.25 | **ASSUMPTION.** |
| Testing absence multiplier | 0.7 | **ASSUMPTION.** |
| Attendance floor | `round(850 * enroll / 1200)`, 1,948 at 2,750 | **ESTIMATE** scaled from the original 850-student floor. |
| Absence noise | `13 * enroll / 1200`, 29.79 students at 2,750 | **ESTIMATE** scaled from the original 13-student noise. |
| Absent students | `round(enroll * BASE_ABSENCE * weekday * note + noise * draw)` | **ASSUMPTION** combining the rows above. |

## Items, participation, and costs

The item list, components, floors, allergens, and relative popularity are simulated menu choices. Six relative rates and three relative effects remain **calibrated from Ekansh Simgekar's original prototype data**: cheese pizza, chicken nuggets, popcorn chicken, chocolate milk, fruit cup, and steamed carrots. The prototype is simulated. No rows were copied.

The research recommendation is a median daily participation of 42% of enrollment at Texas high schools with at least 2,000 students. CEP campuses were 55.8% and non-CEP campuses were 37.3% in the same analysis. Those values are **CONFIRMED** in T13-2, T13-5, and T13-6: [Texas participation data](https://data.texas.gov/resource/i9vs-cqmu.json?%24where=programyear%3D%272024-2025%27&%24limit=5000&%24offset=0) and [CEP breakdown](https://data.texas.gov/resource/5ejx-uftk.json?%24where=programyear%3D%272024-2025%27&%24limit=5000&%24offset=0). In LunchLoop terms the 42% median is about 46% of students present because 42% divided by 91.7% is about 46%.

| Constant | Value | Label |
| --- | --- | --- |
| `PARTICIPATION_FACTOR` | 0.6022266676 | **ESTIMATE**. It is 0.46 divided by 0.763832, the per-day **sum** of the three raw entree take rates averaged over history days. It multiplies every item rate, so item popularity stays in the same relative order. |
| Take rate meaning | Share of students present who take an item before day and item noise | **ASSUMPTION.** |
| Entrees per day | 3 | **ASSUMPTION.** |
| Produce floors | Carrots 120, broccoli 80, fruit cup 150, mandarin oranges 70 | **ASSUMPTION.** Other items have floor 0. |

Costs are **ESTIMATES**. The inputs are **CONFIRMED**: Boston's 2010-11 component costs in T11b-24 were entree $0.56, grain $0.07, vegetable $0.21, fruit $0.19, and milk $0.17 ([Boston table](https://pmc.ncbi.nlm.nih.gov/articles/PMC3788640/)); USDA reported $1.69 mean food cost per reimbursable lunch in T04-8 ([USDA report](https://fns-prod.azureedge.us/sites/default/files/resource-files/SNMCS-Volume3.pdf#page=63)); and food-away-from-home inflation was 1.4398x from 2015 to 2024 in T12-4 ([CPI table](https://www.govinfo.gov/content/pkg/ECONI-2025-01/pdf/ECONI-2025-01.pdf#page=24)). We scale each original component's relative item costs so its mean is the target for a $2.25 lunch. That $2.25 target is a pick inside the $2.14 to $2.43 range from T12-6 ([CPI table](https://www.govinfo.gov/content/pkg/ECONI-2025-01/pdf/ECONI-2025-01.pdf#page=24)) and T12-4 ([CPI table](https://www.govinfo.gov/content/pkg/ECONI-2025-01/pdf/ECONI-2025-01.pdf#page=24)), then we round to cents.

| Component | Item costs in the current files | Target mean |
| --- | --- | --- |
| `meat_alternate` | 1.06, 1.13, 0.88, 1.32, 0.73, 1.19 | about $1.05 |
| `grain` | 0.14, 0.12 | $0.13 |
| `vegetable` | 0.37, 0.41 | $0.39 |
| `fruit` | 0.38, 0.34 | $0.36 |
| `milk` | 0.37, 0.27 | $0.32 |

## Menu and demand

The three-week rotation, daily sides, pizza Friday effect, calendar notes, and noise are **ASSUMPTIONS**. Demand is:

`round(attendance * effective take rate * weekday factor * note factor * day noise * item noise)`.

The day noise is 3%, the item noise is 6%, and both factors are clamped to 0.75 through 1.35. Pizza uses 0.971 Monday to Thursday and 1.116 on Friday. Taken servings are the smaller of latent demand and prepared servings. A sold-out row therefore censors demand.

## Kitchen usual amount

The old flat 1.12 ratio is replaced by component ratios. Entree, grain, fruit, and vegetable values are **ESTIMATES** selected as midpoints of measured ranges. The measurements are **CONFIRMED** in T05a-1, T05a-2, T05a-3, T05a-9, and T05b-4:

- fruit and vegetable: 1.20, a pick inside the 10% to 30% over-prep range, based on measured production leftovers from 10.2% to 28.7% and the 15.31% case study ([T05a-1](https://pubmed.ncbi.nlm.nih.gov/24747044/), [T05a-2](https://pubmed.ncbi.nlm.nih.gov/24747044/), [T05a-9](https://pdfs.semanticscholar.org/9cf7/12fceb42ac0eaa1b26de9b6eef2675efdf5e.pdf#page=5)).
- meat alternate and grain: 1.075, the midpoint of the 5% to 10% working range. The Colorado figure of under 5% overproduced describes 14 school kitchens in the paper abstract ([T05a-3](https://www.sciencedirect.com/science/article/abs/pii/S2212267218313947)).
- milk: 1.12. **ASSUMPTION:** milk must be offered with every lunch, and schools must offer at least two fluid milk options daily ([7 CFR 210.10](https://www.ecfr.gov/current/title-7/subtitle-B/chapter-II/subchapter-A/part-210/section-210.10): "Fluid milk must be offered daily" and "Schools must offer students a variety (at least two different options) of fluid milk at lunch daily."). Research measured 0% to 5% over-prep for milk. At 1.025 the simulated milk sells out on 56% of days, which a kitchen required to offer milk daily would not allow, so the original prototype value 1.12 is kept. This choice raises the simulated savings.

**ASSUMPTION:** Unopened milk cartons and sealed fruit cups usually go back to the cooler, so counting them as waste overstates waste dollars. A Finnish food-service study reports caterers reuse overproduced food on later days ([study](https://projects.luke.fi/ravintolafoorumi/wp-content/uploads/sites/4/2019/09/Silvennoinen_WM_2019.pdf#page=6)).

The generated history has a 22.6% combined sold-out rate for entree and grain item-days.

There is no authoritative universal over-prep standard. That result is **BLOCKED** in T06-12: [ICN search result](https://theicn.org/resources/120/financial-management-a-course-for-school-nutrition-managers/103050/financial-management-managers-instructors-manual.pdf).

The usual amount uses the item's last 20 served days and its component ratio. The first-ever amount uses `component_ratio * ENROLL * (1 - BASE_ABSENCE) * effective_take_rate`. Prep rounds to the nearest five and respects the produce floor.

## Votes

History Thursdays give the selected special a simulated share from 0.36 through 0.52. Future vote options always list beef nachos, cheeseburger, and spicy chicken sandwich. These are **ASSUMPTIONS** for the demo. Future entree ties are broken by lowering the later item by one latent serving so the guessing game has one winner.

## Data contract and true demand

`main()` writes exactly the five contract CSVs and never writes true demand. `generate(seed=SEED, enroll=ENROLL)` returns the rows in memory plus `true_demand[(date, item_id)]` for history and future days. The draw order above is unchanged. All generated files remain simulated.
