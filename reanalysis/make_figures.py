"""Publication figures for the GVI-duration re-analysis (Fig. 6, Fig. S2, Fig. S3).
Usage: python3 make_figures.py <data_dir> <model_out_dir> <fig_out_dir>"""
import sys, os, re
import numpy as np, pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LogNorm

data_dir, mod_dir, fig_dir = sys.argv[1:4]
os.makedirs(fig_dir, exist_ok=True)
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.linewidth": 0.8,
                     "axes.spines.top": False, "axes.spines.right": False, "savefig.dpi": 600})
BLUE = "#1f5a99"

def save(fig, name):
    fig.savefig(os.path.join(fig_dir, name + ".png"), bbox_inches="tight", facecolor="white")
    fig.savefig(os.path.join(fig_dir, name + ".pdf"), bbox_inches="tight")
    plt.close(fig)

# ---------- Fig. 6 ----------
cur = pd.read_csv(os.path.join(mod_dir, "curve_Full.csv"))
gvi = pd.read_csv(os.path.join(data_dir, "gvi.csv"))
ped = pd.read_csv(os.path.join(data_dir, "ped.csv"), usecols=["duration_s", "GVI_seasonal"])
fig, (a, b) = plt.subplots(2, 1, figsize=(7.0, 7.2), gridspec_kw={"height_ratios": [1, 1.15], "hspace": 0.38})
a.fill_between(cur.GVI, cur.lo, cur.hi, color=BLUE, alpha=0.15, lw=0, label="95% CI")
a.plot(cur.GVI, cur["median"], color=BLUE, lw=1.8, label="Adjusted median")
ylo = np.floor(cur.lo.min() / 2) * 2 - 2
a.set_ylim(ylo, np.ceil(cur.hi.max() / 2) * 2)
a.plot(gvi.GVI_seasonal, np.full(len(gvi), ylo), "|", color=BLUE, ms=9, mew=0.6, alpha=0.7, clip_on=False)
a.set_xlim(0, 40); a.set_xlabel("Camera-view GVI (%)")
a.set_ylabel("Adjusted median observed\nsegment duration (s)")
a.legend(frameon=False, loc="upper left")
a.grid(alpha=0.25, lw=0.5)
a.set_title("A", loc="left", fontweight="bold")
hb = b.hexbin(ped.GVI_seasonal, ped.duration_s, gridsize=(70, 40), yscale="log", bins="log",
              cmap="magma_r", mincnt=1, linewidths=0.1, extent=(0, 40, np.log10(3), np.log10(1500)))
b.set_xlim(0, 40); b.set_ylim(3, 1500)
b.set_yticks([5, 10, 20, 30, 60, 120, 300, 600, 1200]); b.set_yticklabels([5, 10, 20, 30, 60, 120, 300, 600, 1200])
b.set_xlabel("Camera-view GVI (%)"); b.set_ylabel("Observed segment duration\n(s; log scale)")
cb = fig.colorbar(hb, ax=b, pad=0.02); cb.set_label("Number of pedestrian records (log scale)")
b.set_title("B", loc="left", fontweight="bold")
save(fig, "Fig6_GVI_duration")

# ---------- Fig. S2: adjustment sets ----------
cols = {"Base": "#1f77b4", "Temporal": "#ff7f0e", "Built": "#2ca02c", "Full": "#d62728"}
labs = {"Base": "Base", "Temporal": "Temporal", "Built": "5D / Built", "Full": "Full"}
fig, ax = plt.subplots(figsize=(6.5, 4.6))
ax.axhline(1, ls="--", color="grey", lw=0.8)
for x in (10, 20): ax.axvline(x, ls=":", color="grey", lw=0.8)
txt = []
for s in cols:
    c = pd.read_csv(os.path.join(mod_dir, f"curve_{s}.csv"))
    ax.plot(c.GVI, c.TR_vs10, color=cols[s], lw=1.8, label=labs[s])
    v = pd.read_csv(os.path.join(mod_dir, f"summary_{s}.csv")).TR20v10.iloc[0]; txt.append(f"{labs[s]} = {v:.2f}")
ax.set_xlim(1.7, 38.7); ax.set_xticks([1.7, 5, 10, 15, 20, 25, 30, 35, 38.7])
ax.set_xticklabels(["1.7", "5", "10", "15", "20", "25", "30", "35", "38.7"])
ax.set_xlabel("Camera-view GVI (%)"); ax.set_ylabel("Time ratio relative to 10% GVI")
ax.legend(frameon=False, ncol=4, loc="upper center", bbox_to_anchor=(0.5, 1.08))
fig.text(0.5, -0.03, "All curves equal 1.00 at 10% GVI. At 20% GVI: " + "; ".join(txt) + ".", ha="center", fontsize=8)
save(fig, "FigS2_adjustment_sets")

# ---------- Fig. S3: forest plot ----------
rows = [("Primary model", [("1. Primary: log-normal AFT, 4-knot RCS", "Full")]),
        ("Alternative distribution", [("2. Weibull AFT", "Weibull"), ("3. Log-logistic AFT", "LogLogistic")]),
        ("Spline specification", [("4. 3-knot RCS", "K3"), ("5. 5-knot RCS", "K5")]),
        ("Exposure aggregation", [("6. Median of four directional views", "Median4")]),
        ("Alternative exposure", [("7. GSV GVI", "GSV")]),
        ("Censoring", [("8. Complete departures only", "Complete")]),
        ("Additional adjustment", [("9. + Pedestrian volume", "Volume")]),
        ("Leave-one-street-out", [("10. Exclude Hindley Street", "exHindley"), ("11. Exclude Gouger Street", "exGouger"),
                                  ("12. Exclude Melbourne Street", "exMelbourne"), ("13. Exclude Hutt Street", "exHutt")])]
items, y, num = [], 0, 0
for head, lst in rows:
    lst = [(l, s) for l, s in lst if os.path.exists(os.path.join(mod_dir, f"summary_{s}.csv"))]
    if not lst: continue
    items.append(("H", head, None, y)); y -= 1
    for l, s in lst:
        num += 1; l = f"{num}. " + re.sub(r"^\d+\. ", "", l)
        items.append(("R", l, pd.read_csv(os.path.join(mod_dir, f"summary_{s}.csv")).iloc[0], y)); y -= 1
prim = pd.read_csv(os.path.join(mod_dir, "summary_Full.csv")).iloc[0].TR20v10
fig, ax = plt.subplots(figsize=(7.2, 0.28 * len(items) + 0.8))
ax.axvline(1, ls="--", color="black", lw=0.8); ax.axvline(prim, ls=":", color="black", lw=0.8)
for kind, lab, r, yy in items:
    if kind == "H":
        ax.text(-0.02, yy, lab, transform=ax.get_yaxis_transform(), ha="right", va="center", color=BLUE, fontweight="bold")
    else:
        ax.errorbar(r.TR20v10, yy, xerr=[[r.TR20v10 - r.lo], [r.hi - r.TR20v10]], fmt="o", color=BLUE, ms=4, capsize=2.5, lw=1)
        ax.text(-0.02, yy, lab, transform=ax.get_yaxis_transform(), ha="right", va="center")
        ax.text(1.02, yy, f"{r.TR20v10:.2f} ({r.lo:.2f}–{r.hi:.2f})", transform=ax.get_yaxis_transform(), ha="left", va="center")
ax.text(1.02, 0.9, "TR (95% CI)", transform=ax.get_yaxis_transform(), ha="left", va="bottom", fontweight="bold")
ax.set_ylim(y + 0.5, 1); ax.set_yticks([]); ax.spines["left"].set_visible(False)
lo = min(0.95, min(r.lo for k, _, r, _ in items if k == "R") - 0.02)
hi = max(1.25, max(r.hi for k, _, r, _ in items if k == "R") + 0.02)
ax.set_xlim(lo, hi); ax.set_xlabel("Time ratio for 20% versus 10% camera-view GVI")
save(fig, "FigS3_sensitivity")
print("figures written to", fig_dir)
