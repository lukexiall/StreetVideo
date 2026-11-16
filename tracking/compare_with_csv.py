"""Compare re-extracted sessions against Cities_pedestrian_clean.csv.

Usage:
    python compare_with_csv.py --clean Cities_pedestrian_clean.csv --extracted out/

For every session present in out/*.csv, prints record counts, censoring
counts and duration quantiles side by side, plus a rank-matched agreement
check (ICC-style mean absolute difference on sorted durations). Large,
systematic gaps mean the clean CSV was not produced from these videos.
"""
import argparse
from pathlib import Path

import numpy as np
import pandas as pd


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--clean", required=True)
    ap.add_argument("--extracted", required=True)
    a = ap.parse_args()

    clean = pd.read_csv(a.clean, usecols=["session", "duration_s", "departure_status"])
    ext = pd.concat([pd.read_csv(p) for p in Path(a.extracted).glob("*.csv")], ignore_index=True)
    rows = []
    for s, g in ext.groupby("session"):
        c = clean[clean.session == s]
        if c.empty:
            rows.append({"session": s, "note": "not in clean CSV"})
            continue
        x, y = np.sort(g.duration_s.values), np.sort(c.duration_s.values)
        q = np.linspace(0, 1, min(len(x), len(y)))
        xq, yq = np.quantile(x, q), np.quantile(y, q)
        rows.append({
            "session": s,
            "n_video": len(g), "n_csv": len(c),
            "cens_video": int((g.departure_status == 0).sum()),
            "cens_csv": int((c.departure_status == 0).sum()),
            "median_video": round(np.median(x), 1), "median_csv": round(np.median(y), 1),
            "p90_video": round(np.quantile(x, .9), 1), "p90_csv": round(np.quantile(y, .9), 1),
            "rank_MAD_s": round(np.mean(np.abs(xq - yq)), 1),
        })
    print(pd.DataFrame(rows).to_string(index=False))


if __name__ == "__main__":
    main()
