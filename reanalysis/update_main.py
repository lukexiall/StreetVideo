"""Apply re-analysis results to the main manuscript with minimal edits.
Usage: python3 update_main.py <in.docx> <results_dir> <data_dir> <fig_dir> <out_clean.docx> <out_highlight.docx>"""
import sys, os
import pandas as pd
import docx
from docx.shared import Emu
from docx_edit import replace_everywhere, set_cell

src, res, data, figs, out_clean, out_hl = sys.argv[1:7]
S = lambda s: pd.read_csv(os.path.join(res, f"summary_{s}.csv")).iloc[0]
fp = lambda p: "<0.001" if p < 0.001 else f"= {p:.3f}"
tr = lambda r, d="-": f"{r.TR20v10:.2f} ({r.lo:.2f}{d}{r.hi:.2f})"
full, pred = S("Full"), pd.read_csv(os.path.join(res, "pred_Full.csv")).set_index("GVI")
cov = pd.read_csv(os.path.join(res, "covariate_TR_Full.csv")).set_index("term")
c3 = lambda t, d="-": f"{cov.TR[t]:.2f}, 95% CI {cov.lo[t]:.2f}{d}{cov.hi[t]:.2f}, P {fp(cov.p[t])}"
m = lambda g: f"{pred.loc[g,'median']:.1f}"; ci = lambda g: f"{pred.loc[g,'lo']:.1f}-{pred.loc[g,'hi']:.1f}"
W = S("Weibull") if os.path.exists(os.path.join(res, "summary_Weibull.csv")) else None
weib = tr(W) if W is not None else "[Weibull pending]"

ped = pd.read_csv(os.path.join(data, "ped.csv"), usecols=["duration_s", "departure_status", "street"])
def outc(df):
    n, e = len(df), int(df.departure_status.sum()); q = df.duration_s.quantile([.5, .25, .75])
    return (f"{e:,} ({e/n*100:.1f})", f"{n-e:,} ({(n-e)/n*100:.1f})", f"{q[.5]:.1f} [{q[.25]:.1f}-{q[.75]:.1f}]")
groups = [ped] + [ped[ped.street == s] for s in ["Hindley", "Gouger", "Hutt", "Melbourne"]]
o = [outc(g) for g in groups]
q = ped.duration_s.quantile([.5, .25, .75]); ne = int(ped.departure_status.sum()); n = len(ped)

R = [  # (old, new) -- exact strings from the R2 manuscript
 ("Final departure was confirmed for 125,753 records (90.6%), while 13,120 records (9.4%) were right-censored.",
  f"Final departure was confirmed for {ne:,} records ({ne/n*100:.1f}%), while {n-ne:,} records ({(n-ne)/n*100:.1f}%) were right-censored."),
 ("Overall median observed segment duration was 17.8 s (IQR 13.8-26.8).",
  f"Overall median observed segment duration was {q[.5]:.1f} s (IQR {q[.25]:.1f}-{q[.75]:.1f})."),
 ("(Wald χ² = 18.6, df = 3, P < 0.001)", f"(Wald χ² = {full.Wald:.1f}, df = 3, P < 0.001)"),
 ("(Wald χ² = 7.3, df = 2, P = 0.026; Table 4)", f"(Wald χ² = {full.Wald_nl:.1f}, df = 2, P {fp(full.p_nonlinear)}; Table 4)"),
 ("The overall GVI test was Wald χ² = 18.6 (df = 3, P < 0.001), and the non-linearity test was Wald χ² = 7.3 (df = 2, P = 0.026).",
  f"The overall GVI test was Wald χ² = {full.Wald:.1f} (df = 3, P < 0.001), and the non-linearity test was Wald χ² = {full.Wald_nl:.1f} (df = 2, P {fp(full.p_nonlinear)})."),
 ("The predicted median duration was 17.5 s (95% CI 16.0-19.1) at 5% GVI, 18.7 s (17.2-20.3) at 10%, 19.9 s (18.3-21.7) at 15%, and 20.7 s (18.9-22.7) at 20%.",
  f"The predicted median duration was {m(5)} s (95% CI {ci(5)}) at 5% GVI, {m(10)} s ({ci(10)}) at 10%, {m(15)} s ({ci(15)}) at 15%, and {m(20)} s ({ci(20)}) at 20%."),
 ("the TRs at 10%, 15%, and 20% were 1.07, 1.14, and 1.18, respectively.",
  f"the TRs at 10%, 15%, and 20% were {pred.TR_vs5[10]:.2f}, {pred.TR_vs5[15]:.2f}, and {pred.TR_vs5[20]:.2f}, respectively."),
 ("The 20% versus 10% contrast was TR = 1.11 (95% CI 1.05-1.17).", f"The 20% versus 10% contrast was TR = {full.TR20v10:.2f} (95% CI {full.lo:.2f}-{full.hi:.2f})."),
 ("predicted median duration was 20.6 s (95% CI 18.4-23.0) at 25% GVI and 20.1 s (17.3-23.3) at 30%.",
  f"predicted median duration was {m(25)} s (95% CI {ci(25)}) at 25% GVI and {m(30)} s ({ci(30)}) at 30%."),
 ("Segments with seating had about 9% longer adjusted duration (TR = 1.09, 95% CI 1.03-1.15, P = 0.005). Outdoor dining was associated with about 7% longer duration (TR = 1.07, 95% CI 1.00-1.14, P = 0.034). Hutt Street also had longer adjusted duration than Hindley Street (TR = 1.14, 95% CI 1.02-1.26, P = 0.017). Other built-environment covariates showed smaller associations or lower precision after mutual adjustment (Table S1).",
  f"Segments with seating had about {round((cov.TR['seating']-1)*100)}% longer adjusted duration (TR = {c3('seating')}). Outdoor dining was associated with about {round((cov.TR['outdoor_dining']-1)*100)}% longer duration (TR = {c3('outdoor_dining')}). Gouger Street had shorter adjusted duration than Hindley Street (TR = {c3('streetGouger')}). Functional mix, H/W ratio, and POI density showed smaller but statistically supported associations per reported increment, whereas other built-environment covariates showed lower precision after mutual adjustment (Table S1)."),
 ("The primary log-normal AFT model gave TR = 1.11 (95% CI 1.05-1.17).", f"The primary log-normal AFT model gave TR = {full.TR20v10:.2f} (95% CI {full.lo:.2f}-{full.hi:.2f})."),
 ("Weibull and log-logistic models gave TR = 1.09 (1.03-1.16) and 1.13 (1.06-1.21), respectively.",
  f"Weibull and log-logistic models gave TR = {weib} and {tr(S('LogLogistic'))}, respectively."),
 ("Three-knot and five-knot RCS models gave TR = 1.10 (1.04-1.16) and 1.12 (1.05-1.20).",
  f"Three-knot and five-knot RCS models gave TR = {tr(S('K3'))} and {tr(S('K5'))}, although the three-knot model provided weaker evidence for non-linearity (P = {S('K3').p_nonlinear:.3f})."),
 ("Using single-time-point GSV GVI weakened the association to TR = 1.06 (95% CI 1.00-1.12), with overall P = 0.064 and non-linear P = 0.118. Restricting the analysis to complete departures gave TR = 1.12 (1.06-1.18). Additional adjustment for pedestrian volume gave TR = 1.09 (1.03-1.15; overall P = 0.008; non-linear P = 0.056).",
  f"Using single-time-point GSV GVI weakened the association to TR = {S('GSV').TR20v10:.2f} (95% CI {S('GSV').lo:.2f}-{S('GSV').hi:.2f}), with overall P = {S('GSV').p_overall:.3f} and non-linear P = {S('GSV').p_nonlinear:.3f}. Restricting the analysis to complete departures gave TR = {tr(S('Complete'))}. Additional adjustment for pedestrian volume gave TR = {S('Volume').TR20v10:.2f} ({S('Volume').lo:.2f}-{S('Volume').hi:.2f}; overall P {fp(S('Volume').p_overall)}; non-linear P {fp(S('Volume').p_nonlinear)})."),
 ("All leave-one-street-out estimates remained positive. Excluding Hindley Street gave TR = 1.09 (1.02-1.17), although evidence for non-linearity weakened (P = 0.063). Excluding Gouger Street gave TR = 1.12 (1.05-1.20), and excluding Melbourne Street gave TR = 1.10 (1.04-1.17). Excluding Hutt Street gave TR = 1.08 (1.01-1.16), with a non-linearity P value of 0.087, reflecting reduced support in the upper GVI range.",
  f"All leave-one-street-out estimates remained positive. Excluding Hindley Street gave TR = {tr(S('exHindley'))}. Excluding Gouger Street gave TR = {tr(S('exGouger'))}, although the joint test of the GVI spline was weaker (overall P = {S('exGouger').p_overall:.3f}; non-linear P = {S('exGouger').p_nonlinear:.3f}), and excluding Melbourne Street gave TR = {tr(S('exMelbourne'))}. Excluding Hutt Street gave TR = {tr(S('exHutt'))}, with a non-linearity P value of {S('exHutt').p_nonlinear:.3f}, reflecting reduced support in the upper GVI range."),
 ("Across the four adjustment sets, the 20% versus 10% TR declined from 1.15 (95% CI 1.08-1.23) in the street-adjusted model to 1.13 (1.07-1.20) after temporal adjustment, 1.12 (1.06-1.18) after built-environment adjustment, and 1.11 (1.05-1.17) in the fully adjusted model (Fig. S2).",
  f"Across the four adjustment sets, the 20% versus 10% TR was {S('Base').TR20v10:.2f} (95% CI {S('Base').lo:.2f}-{S('Base').hi:.2f}) in the street-adjusted model, {tr(S('Temporal'))} after temporal adjustment, {tr(S('Built'))} after built-environment adjustment, and {tr(full)} in the fully adjusted model (Fig. S2)."),
 ("(Moran’s I = 0.058, permutation P = 0.238; Table S2)", "(Moran’s I = MORAN_I, permutation P = MORAN_P; Table S2)"),
 ("with overall evidence for the GVI association (P < 0.001) and its nonlinear component (P = 0.026).",
  f"with overall evidence for the GVI association (P < 0.001) and its nonlinear component (P {fp(full.p_nonlinear)})."),
 ("The 20% versus 10% TR declined from 1.15 in the street-adjusted model to 1.11 in the fully adjusted model, while alternative distributions, spline specifications, exposure summaries, censoring treatment, pedestrian-volume adjustment, and leave-one-street-out analyses generally produced positive estimates around 1.08–1.13 (Fig. S2; Table S2; Fig. S3).",
  "The 20% versus 10% TR ranged from SET_MIN to SET_MAX across the four adjustment sets and was 1.11 in the fully adjusted model, while alternative distributions, spline specifications, exposure summaries, censoring treatment, pedestrian-volume adjustment, and leave-one-street-out analyses generally produced positive estimates around SENS_MIN–SENS_MAX (Fig. S2; Table S2; Fig. S3)."),
 ("and the attenuation from TR = 1.15 to 1.11 after broader adjustment indicates some overlap between GVI and contextual conditions (Fig. S2).",
  "and the broadly similar TRs across adjustment sets (SET_MIN–SET_MAX) suggest that the association was not explained by the measured contextual conditions, although some overlap between GVI and these conditions cannot be excluded (Fig. S2)."),
 ("the similar complete-departure estimate (TR = 1.12, 95% CI 1.06–1.18)",
  f"the similar complete-departure estimate (TR = {S('Complete').TR20v10:.2f}, 95% CI {S('Complete').lo:.2f}–{S('Complete').hi:.2f})"),
]
sets = [S(s).TR20v10 for s in ["Base", "Temporal", "Built", "Full"]]
sens = [S(s).TR20v10 for s in ["LogLogistic", "K3", "K5", "Complete", "Volume", "exHindley", "exGouger", "exMelbourne", "exHutt"]
        + (["Weibull"] if W is not None else [])]
moran = open(os.path.join(res, "moran.txt")).read().split()
fill = {"SET_MIN": f"{min(sets):.2f}", "SET_MAX": f"{max(sets):.2f}", "SENS_MIN": f"{min(sens):.2f}", "SENS_MAX": f"{max(sens):.2f}",
        "MORAN_I": moran[0], "MORAN_P": moran[1]}
for k, v in fill.items():
    R = [(a, b.replace(k, v)) for a, b in R]


def apply(highlight, out):
    d = docx.Document(src)
    for old, new in R:
        if old != new:
            replace_everywhere(d, old, new, highlight=highlight, count_expected=1)
    # Table 3 outcome rows (tables[2])
    t3 = d.tables[2]
    rowmap = {"Confirmed departures": 0, "Right-censored records": 1, "Observed segment duration": 2}
    for row in t3.rows:
        lab = row.cells[0].text
        for key, k in rowmap.items():
            if lab.startswith(key):
                cells = []; prev = None
                for c in row.cells:
                    if c._tc is not prev: cells.append(c); prev = c._tc
                for j, c in enumerate(cells[1:6]):
                    if c.text.strip() != o[j][k]: set_cell(c, o[j][k], highlight)
    # Table 4 (tables[3])
    t4 = d.tables[3]
    for row in t4.rows[1:]:
        g = int(row.cells[0].text.strip().rstrip("%")); r = pred.loc[g]
        vals = [m(g), ci(g)] + (["1.00 (Ref.)", "Ref.", "Ref."] if g == 5 else
               [f"{r.TR_vs5:.2f}", f"+{(r.TR_vs5-1)*100:.1f}%", "<0.001" if r.p_vs5 < 0.001 else f"{r.p_vs5:.3f}"])
        for c, v in zip(row.cells[1:], vals):
            if c.text.strip() != v: set_cell(c, v, highlight)
    # Fig. 6 image (rId13): replace blob, keep width, update height to the new aspect ratio
    from PIL import Image
    png = os.path.join(figs, "Fig6_GVI_duration.png")
    part = d.part.related_parts["rId13"]
    if part.content_type == "image/jpeg":
        import io; buf = io.BytesIO(); Image.open(png).convert("RGB").save(buf, "JPEG", quality=95, dpi=(600, 600)); part._blob = buf.getvalue()
    else:
        part._blob = open(png, "rb").read()
    w, h = Image.open(png).size
    for p in d.paragraphs:
        for inl in p._p.xpath(".//wp:inline[.//a:blip[@r:embed='rId13']]"):
            ext = inl.xpath("./wp:extent")[0]; cx = int(ext.get("cx")); cy = int(cx * h / w)
            ext.set("cy", str(cy))
            for e in inl.xpath(".//a:ext"): e.set("cx", str(cx)); e.set("cy", str(cy))
    d.save(out)

apply(False, out_clean); apply(True, out_hl)
print("saved", out_clean, out_hl)
