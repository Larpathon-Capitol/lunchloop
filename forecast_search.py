"""Forecast search behind the README's "72 variants": scores every candidate on SYNTHETIC
TRAIN and VALIDATION schools only (never test), against TRUE demand. Run: python forecast_search.py
(about 30 s). Candidates: hard window or exponential smoothing x sold-out-day correction x
weekday-factor strength."""
import numpy as np
from simulation import simulate_school, SCENARIOS, WARMUP_DAYS

SPLITS = {"train": range(0, 6), "validation": range(6, 12)}
WINDOWS = [10, 15, 20, 30, None]          # hard window; None = all history
HALFLIVES = [5, 10, 20, 40]               # exponential weighting (days)
WEEKDAY_K = [None, 4, 8, 16]


def forecasts(att, srv, sold, wd, weighting, impute, k):
    n = len(att)
    hist_d = srv.astype(float).copy()       # demand estimates of past days (imputed if asked)
    out = np.full(n, np.nan)
    for t in range(1, n):
        a, d = att[:t], hist_d[:t]
        if weighting[0] == "win":
            w = np.ones(t) if weighting[1] is None else (np.arange(t) >= t - weighting[1]).astype(float)
        else:
            w = 0.5 ** ((t - 1 - np.arange(t)) / weighting[1])
        rate = (w * d).sum() / (w * a).sum()
        if k is not None:
            same = wd[:t] == wd[t]
            if same.any():
                base_all = d.sum() / a.sum()
                ratio = (d[same].sum() / a[same].sum()) / base_all if base_all > 0 else 1
                n_s = same.sum()
                rate *= (n_s * ratio + k) / (n_s + k)
        out[t] = max(0, round(rate * att[t]))
        if impute and sold[t]:
            hist_d[t] = max(srv[t], out[t])
    return out


cands = [(("win", W), imp, k) for W in WINDOWS for imp in (False, True) for k in WEEKDAY_K] + \
        [(("ewm", H), imp, k) for H in HALFLIVES for imp in (False, True) for k in WEEKDAY_K]
err = {c: {sp: [] for sp in SPLITS} for c in cands}
for fam in SCENARIOS:
    for sp, seeds in SPLITS.items():
        for seed in seeds:
            df = simulate_school(fam, seed)
            for food, g in df.groupby("food_item"):
                g = g.sort_values("date")
                att, srv = g.attendance.to_numpy(), g.quantity_served.to_numpy()
                sold = (g.quantity_leftover == 0).to_numpy()
                dem = g.true_demand.to_numpy()
                wd = g.date.dt.weekday.to_numpy()
                for c in cands:
                    f = forecasts(att, srv, sold, wd, *c)
                    err[c][sp].extend(np.abs(f[WARMUP_DAYS:] - dem[WARMUP_DAYS:]))
rows = sorted(((np.mean(v["train"]), np.mean(v["validation"]), c) for c, v in err.items()))
for tr, va, c in rows[:15]:
    print(f"train {tr:.3f}  val {va:.3f}  {c}")
cur = (("win", 20), False, None)
print("previous shipped (last 20 days):", round(np.mean(err[cur]["train"]), 3), round(np.mean(err[cur]["validation"]), 3))
print("all-time:", round(np.mean(err[(("win", None), False, None)]["train"]), 3))
