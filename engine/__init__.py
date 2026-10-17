"""LunchLoop forecast engine. See docs/backend-contract.md for the exact contract.

Every function below is a stub until the engine is built. Keep these names and
signatures: the API imports them.
"""


def forecast(item_id, date, attendance=None, ratio=3.0, as_of=None, data_dir=None):
    raise NotImplementedError


def explain(item_id, date, ratio=3.0, as_of=None, data_dir=None):
    raise NotImplementedError


def prep_list(date=None, attendance=None, ratio=3.0, data_dir=None):
    raise NotImplementedError


def meal_check(menu, prep=None, data_dir=None):
    raise NotImplementedError


def backtest(weeks=4, ratio=3.0, data_dir=None):
    raise NotImplementedError


def simulate(date=None, attendance_multiplier=1.0, price_multiplier=1.0, ratio=3.0, data_dir=None):
    raise NotImplementedError


def meter(date=None, data_dir=None):
    raise NotImplementedError
