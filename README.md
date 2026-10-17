# LunchLoop

LunchLoop tells a school cafeteria how many servings of each item to cook tomorrow, so less food ends up in the trash. Students get a quick daily game: spin to reveal menu options, vote for an upcoming menu, and guess tomorrow's most popular item.

We're building it for Hack Club Capitol. It's a work in progress, so nothing runs yet. The demo will use a simulated school, not real cafeteria records.

---

## How to download / install

Not ready yet. Setup steps for macOS and Windows will go here once the app runs.

## Current features

- A small simulated sample dataset (`data/sample/`) and the script that makes it
- Checks that every data file matches the backend's expected format

## Planned features

- Kitchen view: tomorrow's prep amount for each item, with a small safety buffer
- Student view: spin, vote, and guess, with streaks
- A backtest that shows how the forecast would have done on past (simulated) days

## Known bugs / limitations

- All data is simulated. LunchLoop has not been tested with a real school.

## License

MIT. See [LICENSE](LICENSE).
