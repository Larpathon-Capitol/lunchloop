"""Shared validation and player-statistics rules for the LunchLoop API."""

import re
from datetime import date
from math import isfinite

from fastapi import HTTPException


DEVICE_PATTERN = re.compile(r"[A-Za-z0-9-]{8,64}")
DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}")


def parse_date(value):
    if not isinstance(value, str) or not DATE_PATTERN.fullmatch(value):
        raise HTTPException(400, "invalid date")
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise HTTPException(400, "invalid date") from error


def today(request, settings):
    header_value = request.headers.get("X-Demo-Date", settings["today"])
    return parse_date(header_value).isoformat()


def device(value, required=True):
    if value is None and not required:
        return None
    if not isinstance(value, str) or not DEVICE_PATTERN.fullmatch(value):
        raise HTTPException(400, "invalid device")
    return value


def rows(connection, query, arguments=()):
    return connection.execute(query, arguments).fetchall()


def school_dates(connection):
    return [row[0] for row in rows(connection, "SELECT DISTINCT date FROM menu ORDER BY date")]


def prev_day(connection, current_date):
    return connection.execute(
        "SELECT date FROM menu WHERE date < ? ORDER BY date DESC LIMIT 1",
        (current_date,),
    ).fetchone()


def next_day(connection, current_date):
    return connection.execute(
        "SELECT date FROM menu WHERE date > ? ORDER BY date LIMIT 1",
        (current_date,),
    ).fetchone()


def ensure_player(connection, player_device):
    connection.execute(
        "INSERT OR IGNORE INTO players(device, streak, xp, last_vote_date) VALUES(?,?,?,NULL)",
        (player_device, 0, 0),
    )


def score_guess(guess, current_date, taken):
    target_date = guess["target_date"]
    if target_date >= current_date or target_date not in taken:
        return None
    rows_for_date = taken[target_date]
    meat_rows = {
        item_id: row
        for item_id, row in rows_for_date.items()
        if row.get("component") == "meat_alternate"
    }
    if not meat_rows:
        return None
    highest = max(row["servings_taken"] for row in meat_rows.values())
    guessed = meat_rows.get(guess["item_id"])
    return guessed is not None and guessed["servings_taken"] == highest


def stats(connection, player_device, current_date, taken):
    """Return streak, XP, badges, and latest vote date through the current date.

    Streaks run across school days ending today or the previous school day.
    XP is 10 per vote plus 25 per correct scored guess. Badges are permanent
    history-based awards, and only rows dated on or before today count.
    """
    vote_rows = rows(
        connection,
        "SELECT date FROM votes WHERE device=? AND date<=?",
        (player_device, current_date),
    )
    voted_dates = {row[0] for row in vote_rows}
    last_vote_date = max(voted_dates) if voted_dates else None
    previous = prev_day(connection, current_date)
    anchor = current_date if current_date in voted_dates else (previous[0] if previous else None)
    streak = 0
    dates = school_dates(connection)
    index = dates.index(anchor) if anchor in dates else -1
    while index >= 0 and dates[index] in voted_dates:
        streak += 1
        index -= 1

    guess_rows = rows(
        connection,
        "SELECT * FROM guesses WHERE device=? AND date<=?",
        (player_device, current_date),
    )
    correct_guesses = sum(
        score_guess(guess, current_date, taken) is True for guess in guess_rows
    )
    xp = len(vote_rows) * 10 + correct_guesses * 25

    longest = 0
    current_run = 0
    for school_date in dates:
        if school_date <= current_date and school_date in voted_dates:
            current_run += 1
            longest = max(longest, current_run)
        elif school_date <= current_date:
            current_run = 0
    badges = []
    if longest >= 3:
        badges.append("streak_3")
    if longest >= 7:
        badges.append("streak_7")
    if correct_guesses >= 5:
        badges.append("called_it_5")
    return streak, xp, badges, last_vote_date


def valid_num(value, default, lower=None, upper=None, integer=False):
    number = default if value is None else value
    if isinstance(number, bool) or not isinstance(number, (int, float)):
        raise HTTPException(400, "invalid number")
    if integer and not isinstance(number, int):
        raise HTTPException(400, "invalid number")
    if not isfinite(number):
        raise HTTPException(400, "invalid number")
    if lower is not None and number <= lower:
        raise HTTPException(400, "invalid number")
    if upper is not None and number > upper:
        raise HTTPException(400, "invalid number")
    return number
