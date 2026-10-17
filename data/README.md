# LunchLoop simulated school data

**All of this data is simulated.** There is no real school behind it. It is one made-up high school of about 1,200 students, built so LunchLoop has something realistic to forecast from.

It has daily history from Jan 12 to Oct 16, 2026 (125 school days), plus the menu for Oct 19 to Nov 13, 2026.

## The files

- `items.csv`: the 14 menu items, with cost, allergens and minimum prep amount.
- `meals.csv`: history. One row per item per school day, with attendance, servings cooked and servings taken.
- `future_meals.csv`: the same columns for the upcoming days. Only used to score guesses in the demo, never for forecasting.
- `menu.csv`: which items are served each day, for history and the upcoming days.
- `vote_options.csv`: the three entrees students can vote on for each upcoming Thursday.

The exact columns are in [docs/backend-contract.md](../docs/backend-contract.md).

## How it was made

- **Attendance:** start from 1,200 students and an 8.3% absence rate (the one real number, from TEA). Mondays and Fridays have more absences. The day before a break has many more. Then add random noise.
- **Menus:** three entrees a day from a fixed six-entree rotation, plus sides and milk.
- **Demand:** each item has a share of students who take it. Cheese pizza sells more on Fridays. Odd days (early release, testing, rainy) nudge it up or down, plus a little noise.
- **The kitchen's "usual amount":** the kitchen cooks about 12% more than the item's average over its last 20 serving days. It ignores the weekday and the day's attendance. ASSUMPTION: this is our guess at a typical kitchen, not a measured policy.
- **Votes:** on Thursdays in the history, the special was picked by a student vote, and its row gets a vote share.

Every number and where it came from is in [sources.md](sources.md). Only one is verified. The rest are labelled as assumptions, or as calibrated from Ekansh Simgekar's prototype data.

## Regenerate it

```
python data/simulate.py
```

You need Python 3.12 or newer. No extra packages. The seed is `20261016`, so every run gives the same files. Tests in `tests/data/` run the script fresh and check that the committed files match.

## Numbers from the current files

- 1,198 history rows and 192 upcoming rows
- Mean attendance 1096.6 students
- 10.7% of cooked servings are left over
- 7.1% of rows sold out (6.9% of entree rows)

## Known limitations

- It is simulated. LunchLoop has not been tested with a real school.
- Allergens are made-up placeholders. Real allergen information always comes from the product label and nutrition staff.
- `servings_taken` undercounts demand on sold-out days, because students cannot take food that was not cooked.
- The usual-amount rule is our guess at a typical kitchen. A real kitchen may plan differently.

Rates and costs for six items (cheese pizza, chicken nuggets, popcorn chicken, chocolate milk, fruit cup, steamed carrots) are calibrated from Ekansh Simgekar's prototype data.
