"""How the default coverage level (SHORTAGE_FIRST_LEVEL) was chosen. Run: python level_search.py (about 40 s).

For each coverage level it prints, on SYNTHETIC TRAIN and VALIDATION schools only (never test), how the shipped
strategy compares with the usual amount: leftovers, short servings and short rows, overall and per kind of school.
Selection rule: the lowest level (most leftover savings) at which, overall on TRAIN, short servings AND short rows
are no higher than the usual amount, and VALIDATION agrees. 93% passed train but not validation, so 94% is used."""
import numpy as np
import pandas as pd
import prediction
import simulation as sim

SPLITS = {"train": range(0, 6), "validation": range(6, 12)}
LEVELS = [0.90, 0.92, 0.93, 0.94, 0.95, 0.96, 0.97]
schools = {(fam, sp, seed): sim.simulate_school(fam, seed)
           for fam in sim.SCENARIOS for sp, seeds in SPLITS.items() for seed in seeds}


def metrics(rows, col):
    prep, dem = rows[col].to_numpy(), rows["true_demand"].to_numpy()
    served = np.minimum(prep, dem)
    return prep.sum() - served.sum(), (dem - served).sum(), int((dem > prep).sum())


for level in LEVELS:
    prediction.SHORTAGE_FIRST_LEVEL = level
    frames = []
    for (fam, sp, seed), df in schools.items():
        r = pd.DataFrame(sim._school_rows(df, (3.0,)))
        r["family"], r["split"] = fam, sp
        frames.append(r)
    rows = pd.concat(frames)
    print(f"=== level {level}")
    for sp in SPLITS:
        sub = rows[rows["split"] == sp]
        u = metrics(sub, "prep_usual")
        x = metrics(sub, "prep_recent_shortage_first_3x")
        print(f"  {sp:10s} ALL  left {x[0]/u[0]-1:+.1%}  short servings {x[1]/u[1]:.2f}x  short rows {x[2]/u[2]:.2f}x")
        for fam in sim.SCENARIOS:
            f = sub[sub["family"] == fam]
            uu, xx = metrics(f, "prep_usual"), metrics(f, "prep_recent_shortage_first_3x")
            print(f"     {fam:14s} left {xx[0]/uu[0]-1:+.1%}  short serv {xx[1]/uu[1]:.2f}x  rows {xx[2]/uu[2]:.2f}x")
