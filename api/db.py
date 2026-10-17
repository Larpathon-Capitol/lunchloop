"""SQLite setup and CSV loading for the LunchLoop API."""

import csv
import sqlite3
from pathlib import Path


def connect(path):
    connection = sqlite3.connect(path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA busy_timeout=5000")
    return connection


def init_db(path, data_dir):
    connection = connect(path)
    try:
        _migrate_game_tables(connection)
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS votes(
                school_id TEXT NOT NULL DEFAULT 'demo', device TEXT, date TEXT, item_id TEXT,
                PRIMARY KEY(school_id, device, date)
            );
            CREATE TABLE IF NOT EXISTS guesses(
                school_id TEXT NOT NULL DEFAULT 'demo', device TEXT, date TEXT, target_date TEXT, item_id TEXT,
                PRIMARY KEY(school_id, device, date)
            );
            CREATE TABLE IF NOT EXISTS players(
                school_id TEXT NOT NULL DEFAULT 'demo', device TEXT, streak INTEGER, xp INTEGER,
                last_vote_date TEXT, PRIMARY KEY(school_id, device)
            );
            DROP TABLE IF EXISTS items;
            DROP TABLE IF EXISTS meals;
            DROP TABLE IF EXISTS menu;
            DROP TABLE IF EXISTS vote_options;
            CREATE TABLE items(
                item_id TEXT PRIMARY KEY, name TEXT, component TEXT,
                cost_per_serving REAL, allergens TEXT, prep_floor INTEGER
            );
            CREATE TABLE meals(
                date TEXT, item_id TEXT, component TEXT, attendance INTEGER,
                servings_prepared INTEGER, servings_taken INTEGER,
                cost_per_serving REAL, allergens TEXT, vote_share REAL,
                sold_out INTEGER, day_note TEXT
            );
            CREATE TABLE menu(date TEXT, item_id TEXT, day_note TEXT);
            CREATE TABLE vote_options(
                open_date TEXT PRIMARY KEY, target_date TEXT, target_slot TEXT,
                option_1 TEXT, option_2 TEXT, option_3 TEXT
            );
            """
        )
        data_path = Path(data_dir)

        def load_csv(filename, table_name):
            with (data_path / filename).open(newline="") as handle:
                rows = list(csv.DictReader(handle))
            if not rows:
                return
            columns = list(rows[0])
            placeholders = ",".join("?" for _ in columns)
            column_sql = ",".join(columns)
            statement = f"INSERT INTO {table_name} ({column_sql}) VALUES ({placeholders})"
            for row in rows:
                values = [row[column] if row[column] != "" else None for column in columns]
                connection.execute(statement, values)

        for filename, table_name in (
            ("items.csv", "items"),
            ("meals.csv", "meals"),
            ("menu.csv", "menu"),
            ("vote_options.csv", "vote_options"),
        ):
            load_csv(filename, table_name)
        connection.commit()
    finally:
        connection.close()


def _migrate_game_tables(connection):
    definitions = {
        "votes": "school_id TEXT NOT NULL DEFAULT 'demo', device TEXT, date TEXT, item_id TEXT, PRIMARY KEY(school_id, device, date)",
        "guesses": "school_id TEXT NOT NULL DEFAULT 'demo', device TEXT, date TEXT, target_date TEXT, item_id TEXT, PRIMARY KEY(school_id, device, date)",
        "players": "school_id TEXT NOT NULL DEFAULT 'demo', device TEXT, streak INTEGER, xp INTEGER, last_vote_date TEXT, PRIMARY KEY(school_id, device)",
    }
    connection.commit()
    for table, definition in definitions.items():
        old = f"{table}_old"
        columns = [row[1] for row in connection.execute(f"PRAGMA table_info({table})")]
        leftover = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (old,)
        ).fetchone()
        if "school_id" in columns and not leftover:
            continue
        if not columns and not leftover:
            continue
        fields = "device,date,item_id" if table == "votes" else "device,date,target_date,item_id" if table == "guesses" else "device,streak,xp,last_vote_date"
        # One transaction per table, so a crash halfway leaves the old table as it was.
        connection.execute("BEGIN")
        try:
            if columns and "school_id" not in columns:
                connection.execute(f"DROP TABLE IF EXISTS {old}")
                connection.execute(f"ALTER TABLE {table} RENAME TO {old}")
                columns = []
            if not columns:
                connection.execute(f"CREATE TABLE {table}({definition})")
            connection.execute(f"INSERT OR IGNORE INTO {table}(school_id,{fields}) SELECT 'demo',{fields} FROM {old}")
            connection.execute(f"DROP TABLE {old}")
            connection.execute("COMMIT")
        except Exception:
            connection.execute("ROLLBACK")
            raise


def load_taken(data_dir):
    taken = {}
    for filename in ("meals.csv", "future_meals.csv"):
        with (Path(data_dir) / filename).open(newline="") as handle:
            for row in csv.DictReader(handle):
                taken.setdefault(row["date"], {})[row["item_id"]] = {
                    "component": row["component"],
                    "servings_taken": int(row["servings_taken"]),
                }
    return taken
