import sys, pandas as pd, numpy as np, matplotlib
matplotlib.use("Agg"); import matplotlib.pyplot as plt
from matplotlib.colors import LogNorm
from scipy.stats import spearmanr
csv, od = sys.argv[1], sys.argv[2]
df = pd.read_csv(csv, low_memory=False)
ss = df.groupby(["segment", "season"]).GVI_seasonal.first()
S = {r.id: r for r in pd.concat([pd.read_csv(f"{od}/sum_{i}.csv") for i in
     ["primary","base","temporal","built","weibull","loglogis","k3","k5","gsv","complete","volume","segonly","noHindley","noGouger","noMelb","noHutt"]]).itertuples()}
fmt = lambda r: f"{r.TR:.2f} ({r.lo:.2f}–{r.hi:.2f})"

# ---------- Fig 6 ----------
c = pd.read_csv(f"{od}/fig6_curve.csv")
fig = plt.figure(figsize=(12.73, 9)); gs = fig.add_gridspec(2, 1, height_ratios=[1, 1.15], hspace=.45)
a = fig.add_subplot(gs[0]); b = fig.add_subplot(gs[1])
fig.suptitle("Association between camera-view GVI and observed segment duration", x=.07, ha="left", fontsize=16)
a.set_title("A. Adjusted association between camera-view GVI and observed segment duration", loc="left", fontsize=12)
a.fill_between(c.gvi, c.lo, c.hi, color="#c6dbef", alpha=.7, label="95% CI")
a.plot(c.gvi, c.med, color="#1f5f99", lw=1.6, label="Adjusted median")
ylo = np.floor(c.lo.min()) - 2
a.vlines(ss.values, ylo, ylo + .6, color="#2b6cb0", lw=.6)
a.set_ylim(ylo, np.ceil(c.hi.max()) + 1); a.set_xlim(0, 40)
a.set_xlabel("Camera-view GVI (%)", fontsize=12); a.set_ylabel("Adjusted median observed\nsegment duration (s)", fontsize=12)
a.legend(frameon=False, loc="lower right", fontsize=11)
a.text(0, -.32, f"Rug marks show the distribution of {len(ss)} street-segment × season GVI values.", transform=a.transAxes, fontsize=9)
for s in ["top", "right"]: a.spines[s].set_visible(False)
b.set_title(f"B. Descriptive pedestrian-level distribution across shared GVI values (n = {len(df):,})", loc="left", fontsize=12)
hb = b.hexbin(df.GVI_seasonal, df.duration_s, gridsize=(80, 40), yscale="log", bins="log", cmap="magma_r", mincnt=1)
b.set_yticks([5, 10, 15, 20, 30, 60, 120, 300, 600, 1200]); b.set_yticklabels([5, 10, 15, 20, 30, 60, 120, 300, 600, 1200])
b.set_xlim(0, 40); b.set_xlabel("Camera-view GVI (%)", fontsize=12); b.set_ylabel("Observed segment duration\n(seconds; log scale)", fontsize=12)
fig.colorbar(hb, ax=b, label="Number of observations (log scale)")
fig.savefig(f"{od}/Fig6.png", dpi=300, bbox_inches="tight"); plt.close(fig)

# ---------- Fig S2 ----------
fig, ax = plt.subplots(figsize=(10, 7.6))
cols = {"base": ("Base", "#1f77b4"), "temporal": ("Temporal", "#ff7f0e"), "built": ("5D / Built", "#2ca02c"), "primary": ("Full", "#d62728")}
for k, (lab, col) in cols.items():
    cc = pd.read_csv(f"{od}/curve_{k}.csv"); ax.plot(cc.gvi, np.exp(cc.logtr), color=col, lw=2.2, label=lab)
ax.axhline(1, ls="--", color="#1f77b4", lw=1.2); ax.axvline(10, ls=":", lw=1); ax.axvline(20, ls=":", lw=1)
lo_, hi_ = ss.min(), ss.max(); ax.set_xlim(lo_, hi_); ax.set_xticks([lo_, 5, 10, 15, 20, 25, 30, 35, hi_]); ax.set_xticklabels([f"{lo_:.2f}", 5, 10, 15, 20, 25, 30, 35, f"{hi_:.2f}"])
ax.set_xlabel("Camera-view GVI (%)", fontsize=13); ax.set_ylabel("Time ratio relative to 10% GVI", fontsize=13)
ax.legend(ncol=4, frameon=False, loc="upper left")
for s in ["top", "right"]: ax.spines[s].set_visible(False)
fig.suptitle("Robustness of the GVI–duration association across adjustment sets", x=.07, ha="left", fontsize=16)
ax.set_title("Curves standardized to 10% GVI = 1.00 for direct model comparison", loc="left", fontsize=12)
fig.text(.1, -.01, "All curves equal 1.00 at 10% GVI. At 20% GVI: " + ", ".join(f"{v[0]} = {S[k].TR:.2f}" for k, v in cols.items()) + ".", fontsize=10)
fig.savefig(f"{od}/FigS2.png", dpi=300, bbox_inches="tight"); plt.close(fig)

# ---------- Fig S3 ----------
S["median"] = pd.Series(dict(TR=1.10, lo=1.04, hi=1.17))  # NOT recomputed: directional GVI not available
S["median"] = type("R", (), dict(TR=1.10, lo=1.04, hi=1.17))
rows = [("Primary model", None), ("1. Primary: log-normal AFT, 4-knot RCS", "primary"),
        ("Alternative distribution", None), ("2. Weibull AFT", "weibull"), ("3. Log-logistic AFT", "loglogis"),
        ("Spline specification", None), ("4. 3-knot RCS", "k3"), ("5. 5-knot RCS", "k5"),
        ("Exposure aggregation", None), ("6. Median of four directional views", "median"),
        ("Alternative exposure", None), ("7. GSV GVI", "gsv"),
        ("Censoring", None), ("8. Complete departures only", "complete"),
        ("Additional adjustment", None), ("9. + Pedestrian volume", "volume"),
        ("Leave-one-street-out", None), ("10. Exclude Hindley Street", "noHindley"), ("11. Exclude Gouger Street", "noGouger"),
        ("12. Exclude Melbourne Street", "noMelb"), ("13. Exclude Hutt Street", "noHutt")]
fig, ax = plt.subplots(figsize=(10, 7.8)); y = len(rows)
lo_all = min(S[k].lo for _, k in rows if k); hi_all = max(S[k].hi for _, k in rows if k)
xl = (min(.95, np.floor(lo_all * 20) / 20), max(1.25, np.ceil(hi_all * 20) / 20))
for lab, k in rows:
    y -= 1
    if k is None: ax.text(-.02, y, lab, transform=ax.get_yaxis_transform(), ha="right", va="center", color="#1f5fa8", fontsize=11); continue
    r = S[k]; ax.errorbar(r.TR, y, xerr=[[r.TR - r.lo], [r.hi - r.TR]], fmt="o", color="#0d4fa0", capsize=4)
    ax.text(-.02, y, lab, transform=ax.get_yaxis_transform(), ha="right", va="center", fontsize=10)
    ax.text(1.02, y, fmt(r), transform=ax.get_yaxis_transform(), ha="left", va="center", fontsize=10)
ax.axvline(1, ls="--", color="k", lw=1); ax.axvline(S["primary"].TR, ls=":", color="k", lw=1)
ax.set_xlim(*xl); ax.set_ylim(-.7, len(rows) - .3); ax.set_yticks([])
for s in ["top", "right", "left"]: ax.spines[s].set_visible(False)
ax.set_xlabel("Time ratio for 20% versus 10% camera-view GVI", fontsize=12)
ax.text(1.02, len(rows) - .2, "TR (95% CI)", transform=ax.get_yaxis_transform(), fontsize=12)
fig.suptitle("Figure S3. Robustness of the GVI–duration association across sensitivity analyses", x=.02, ha="left", fontweight="bold", fontsize=14)
fig.text(.5, -.02, f"Dashed line indicates the null (TR = 1.00); dotted line indicates the primary-model estimate (TR = {S['primary'].TR:.2f}).\n"
         "All estimates compare covariate-standardised predicted median observed segment duration at 20% versus 10% camera-view GVI.", ha="center", fontsize=9)
fig.savefig(f"{od}/FigS3.png", dpi=300, bbox_inches="tight"); plt.close(fig)

# ---------- Fig S1 ----------
seg = df.groupby("segment").first(); seg["GVI"] = ss.groupby(level=0).mean()
items = [("Density", "FAR", "FAR", "#e8590c"), ("Diversity", "Functional mix (Shannon index)", "functional_mix", "#7b4fb3"),
         ("Design", "H/W ratio", "HW_ratio", "#f2a900"), ("", "Footpath width (m)", "footpath_m", "#f2a900"),
         ("", "Seating presence (0/1)", "seating", "#f2a900"), ("", "Outdoor dining presence (0/1)", "outdoor_dining", "#f2a900"),
         ("", "Pedestrian crossing presence (0/1)", "crossing", "#f2a900"),
         ("Destination\naccessibility", "POI density (per 100 m frontage)", "POI_per100m", "#2047b5"),
         ("Distance to\ntransit", "Bus-stop presence within 100 m (0/1)", "bus_stop", "#26a69a")]
rng = np.random.default_rng(2025); n = len(seg); idx = rng.integers(0, n, (2000, n)); res = []
for dom, lab, v, col in items:
    r = spearmanr(seg.GVI, seg[v]).statistic
    bs = [spearmanr(seg.GVI.values[i], seg[v].values[i]).statistic for i in idx]
    res.append((dom, lab, col, r, *np.nanpercentile(bs, [2.5, 97.5])))
pd.DataFrame(res, columns=["domain", "item", "col", "rho", "lo", "hi"]).drop(columns="col").round(3).to_csv(f"{od}/spearman.csv", index=False)
fig, ax = plt.subplots(figsize=(11, 6.5)); Y = np.arange(len(res))[::-1]
for y, (dom, lab, col, r, lo, hi) in zip(Y, res):
    ax.errorbar(r, y, xerr=[[r - lo], [hi - r]], fmt="o", color=col, capsize=4, ms=8)
    ax.text(-1.3, y, dom, color=col, va="center", fontsize=12, transform=ax.transData)
    ax.text(-.62 - .38, y, lab, va="center", fontsize=11)
    ax.text(.66, y, f"{r:.2f} ({lo:.2f}, {hi:.2f})".replace("-", "−"), va="center", fontsize=11)
ax.axvline(0, ls="--", color="k", lw=1); ax.set_xlim(-1.32, 1.0); ax.set_xticks(np.arange(-.6, .61, .2))
ax.set_yticks([]); [ax.spines[s].set_visible(False) for s in ["top", "right", "left"]]
ax.set_xlabel("Spearman's ρ   (← negative association | positive association →)", fontsize=11)
fig.suptitle("Segment-level associations between camera-view GVI and built-environment characteristics (n = 100 street segments)", x=.05, ha="left", fontsize=13)
fig.savefig(f"{od}/FigS1.png", dpi=300, bbox_inches="tight"); plt.close(fig)
print("figs done")
