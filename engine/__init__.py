"""LunchLoop forecast engine. See docs/backend-contract.md for the exact contract."""

from ._data import UnknownDateError, UnknownItemError
from ._forecast import explain as _explain, forecast as _forecast
from ._kitchen import meal_check as _meal_check, prep_list as _prep_list, simulate as _simulate
from ._backtest import backtest as _backtest, meter as _meter


def forecast(item_id, date, attendance=None, ratio=3.0, as_of=None, data_dir=None):
    return _forecast(item_id, date, attendance, ratio, as_of, data_dir)


def explain(item_id, date, ratio=3.0, as_of=None, data_dir=None):
    return _explain(item_id, date, ratio, as_of, data_dir)


def prep_list(date=None, attendance=None, ratio=3.0, data_dir=None):
    return _prep_list(date, attendance, ratio, data_dir)


def meal_check(menu, prep=None, data_dir=None):
    return _meal_check(menu, prep, data_dir)


def backtest(weeks=4, ratio=3.0, data_dir=None):
    return _backtest(weeks, ratio, data_dir)


def simulate(date=None, attendance_multiplier=1.0, price_multiplier=1.0, ratio=3.0, data_dir=None):
    return _simulate(date, attendance_multiplier, price_multiplier, ratio, data_dir)


def meter(date=None, data_dir=None):
    return _meter(date, data_dir)
