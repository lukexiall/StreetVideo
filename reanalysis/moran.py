"""Moran's I of segment random effects; neighbours = immediately adjacent segments in the same street.
Usage: python3 moran.py <ranef_segment_Full.csv>"""
import re, sys
import numpy as np, pandas as pd

re_ = pd.read_csv(sys.argv[1])
re_["street"] = re_.segment.str.extract(r"^([A-Za-z]+)")[0]
re_["k"] = re_.segment.str.extract(r"(\d+)$")[0].astype(int)
re_ = re_.sort_values(["street", "k"]).reset_index(drop=True)
n = len(re_); W = np.zeros((n, n))
for i in range(n):
    for j in range(n):
        if re_.street[i] == re_.street[j] and abs(re_.k[i] - re_.k[j]) == 1: W[i, j] = 1
W = W / W.sum(1, keepdims=True)                      # row-standardised (spdep style "W")
def moran(x):
    z = x - x.mean(); return (n / W.sum()) * (z @ W @ z) / (z @ z)
x = re_.re.values; I = moran(x)
rng = np.random.default_rng(999)
perm = np.array([moran(rng.permutation(x)) for _ in range(999)])
p = (1 + (perm >= I).sum()) / 1000                   # one-sided, as spdep::moran.mc default ("greater")
print(f"Moran's I = {I:.3f}, permutation P = {p:.3f} (n = {n}, links = {(W > 0).sum()})")
