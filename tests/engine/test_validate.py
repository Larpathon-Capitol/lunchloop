"""Raw CSV validation warnings."""

import csv

from engine import validate


ITEMS_HEADER = ["item_id", "name", "component", "cost_per_serving", "allergens", "prep_floor"]
MEALS_HEADER = [
    "date", "item_id", "component", "attendance", "servings_prepared",
    "servings_taken", "cost_per_serving", "allergens", "vote_share", "sold_out", "day_note",
]
MENU_HEADER = ["date", "item_id", "day_note"]


def _write_fixture(tmp_path, meal_rows, item_rows=None):
    item_rows = item_rows or [
        ["entree", "Entree", "meat_alternate", "1.00", "", "0"],
        ["grain", "Grain", "grain", "0.20", "", "0"],
        ["vegetable", "Vegetable", "vegetable", "0.40", "", "0"],
        ["fruit", "Fruit", "fruit", "0.30", "", "0"],
        ["milk", "Milk", "milk", "0.25", "", "0"],
    ]
    with (tmp_path / "items.csv").open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(ITEMS_HEADER)
        writer.writerows(item_rows)
    with (tmp_path / "meals.csv").open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(MEALS_HEADER)
        writer.writerows(meal_rows)
    with (tmp_path / "menu.csv").open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(MENU_HEADER)
        writer.writerow(["2026-10-19", "entree", ""])


def _complete_day(date="2026-10-01"):
    return [
        [date, "entree", "meat_alternate", "100", "100", "80", "1.00", "", "", "0", ""],
        [date, "grain", "grain", "100", "100", "80", "0.20", "", "", "0", ""],
        [date, "vegetable", "vegetable", "100", "100", "80", "0.40", "", "", "0", ""],
        [date, "fruit", "fruit", "100", "100", "80", "0.30", "", "", "0", ""],
        [date, "milk", "milk", "100", "100", "80", "0.25", "", "", "0", ""],
    ]


def _has(warnings, text):
    assert any(text in warning.lower() for warning in warnings), warnings


def test_validate_warns_taken_greater_than_prepared(tmp_path):
    rows = _complete_day()
    rows[0][5] = "120"
    _write_fixture(tmp_path, rows)
    _has(validate(tmp_path), "servings_taken greater than servings_prepared")


def test_validate_warns_taken_greater_than_attendance(tmp_path):
    rows = _complete_day()
    rows[0][4] = "150"
    rows[0][5] = "120"
    _write_fixture(tmp_path, rows)
    _has(validate(tmp_path), "servings_taken greater than attendance")


def test_validate_warns_negative_values(tmp_path):
    rows = _complete_day()
    rows[0][3] = "-1"
    _write_fixture(tmp_path, rows)
    _has(validate(tmp_path), "negative attendance")


def test_validate_warns_nonpositive_cost(tmp_path):
    rows = _complete_day()
    rows[0][6] = "0"
    _write_fixture(tmp_path, rows)
    _has(validate(tmp_path), "cost_per_serving <= 0")


def test_validate_negative_cost_has_one_warning(tmp_path):
    rows = _complete_day()
    rows[0][6] = "-0.25"
    _write_fixture(tmp_path, rows)
    warnings = validate(tmp_path)
    assert sum("cost_per_serving" in warning.lower() for warning in warnings) == 1


def test_validate_clean_fixture_has_no_warnings(tmp_path):
    _write_fixture(tmp_path, _complete_day())
    assert validate(tmp_path) == []


def test_validate_warns_sold_out_mismatch(tmp_path):
    rows = _complete_day()
    rows[0][9] = "1"
    _write_fixture(tmp_path, rows)
    _has(validate(tmp_path), "sold_out does not match")


def test_validate_warns_duplicate_date_and_item(tmp_path):
    rows = _complete_day()
    rows.append(rows[0][:])
    _write_fixture(tmp_path, rows)
    _has(validate(tmp_path), "duplicate meal row")


def test_validate_warns_history_day_missing_component(tmp_path):
    rows = _complete_day()
    rows = [row for row in rows if row[2] != "milk"]
    _write_fixture(tmp_path, rows)
    _has(validate(tmp_path), "missing meal component milk")


def test_validate_warns_unknown_item_id(tmp_path):
    rows = _complete_day()
    rows[0][1] = "not_in_items"
    _write_fixture(tmp_path, rows)
    _has(validate(tmp_path), "not in items.csv")


def test_validate_does_not_raise_on_malformed_rows(tmp_path):
    rows = _complete_day()
    rows[0][0] = "not-a-date"
    rows[0][3] = "not-an-int"
    _write_fixture(tmp_path, rows)
    warnings = validate(tmp_path)
    _has(warnings, "invalid date")
    _has(warnings, "not an integer")
