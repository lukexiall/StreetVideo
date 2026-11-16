import sys, io, docx, pandas as pd, numpy as np
from PIL import Image
sys.path.insert(0, ".")
import track
from track import apply, replace, ptext
U = "/root/.claude/uploads/f0016cfd-d14f-56cb-bc44-6a108ec88dfa/"
OUT = "/home/user/StreetVideo/revision/"
log = []

def cell_set(cell, new):
    """tracked replace of the whole text of a table cell (first paragraph holding text)."""
    for p in cell.paragraphs:
        t = ptext(p._p)
        if t.strip():
            if t.strip() != new: replace(p._p, t.strip(), new); log.append(f"cell {t.strip()} -> {new}")
            return
    log.append(f"!! empty cell for {new}")

def row_by_label(tab, label):
    for r in tab.rows:
        if r.cells[0].text.strip().startswith(label): return r
    raise KeyError(label)

def set_image(doc, idx, png):
    shp = doc.inline_shapes[idx]
    rid = shp._inline.graphic.graphicData.pic.blipFill.blip.embed
    part = doc.part.related_parts[rid]
    im = Image.open(png).convert("RGB"); buf = io.BytesIO()
    fmt = "PNG" if part.partname.endswith(".png") else "JPEG"
    im.save(buf, fmt, quality=95, dpi=(300, 300)); part._blob = buf.getvalue()
    w = shp.width; shp.height = int(w * im.height / im.width)
    log.append(f"image {idx} {part.partname} <- {png}")

# ---------------- manuscript ----------------
D = docx.Document(U + "f12d2126-Cities_JCIT-D-26-03871_R2_clean.docx")
E = [
 # abstract
 ("This study analysed 138,873", "producing 300 segment-season", "producing 298 segment-season"),
 ("This study analysed 138,873", "(TR = 1.11, 95% CI 1.05–1.17)", "(TR = 1.11, 95% CI 1.05–1.18)"),
 ("This study analysed 138,873", "although the upper-range curve was less stable; December 2025 Google Street View GVI produced a weaker association.",
  "although the upper-range curve was less stable and evidence was weaker under some specifications; December 2025 Google Street View GVI produced a slightly smaller contrast."),
 # methods
 ("The approximately 20 m segment served", "yielding 300 segment-season GVI observations", "yielding 298 segment-season GVI observations"),
 ("For single-camera field rotation", "yielding 2,700 segment-level sessions and 900 h of segment-specific video", "yielding 2,678 segment-level sessions and approximately 893 h of segment-specific video"),
 ("The four knots were placed", "percentiles of the 300 street-segment × season GVI observations", "percentiles of the 298 street-segment × season GVI observations"),
 ("The four knots were placed", "The 300 GVI values were repeated seasonal measurements from 100 segments", "The 298 GVI values were repeated seasonal measurements from 100 segments"),
 ("Multicollinearity was assessed", "survival, tramME, car, and spdep packages", "survival, TMB, car, and spdep packages"),
 # 4.2
 ("The final analytical sample contained 138,873 pedestrian passage", "17.8 s (IQR 13.8-26.8)", "16.7 s (IQR 13.0-26.1)"),
 ("Camera-view GVI differed clearly", "Across the 300 street-segment × season observations, mean GVI was 11.41% (SD 8.64)", "Across the 298 street-segment × season observations, mean GVI was 11.43% (SD 8.67)"),
 ("Camera-view GVI differed clearly", "Hutt Street (21.24%, SD 7.16)", "Hutt Street (21.67%, SD 6.85)"),
 ("Camera-view GVI differed clearly", "9.87% in winter to 11.21% in spring", "9.90% in winter to 11.24% in spring"),
 # 4.3
 ("Camera-view GVI was associated with observed", "(Wald χ² = 18.6, df = 3, P < 0.001)", "(Wald χ² = 18.2, df = 3, P < 0.001)"),
 ("The adjusted curve rose", "The predicted median duration was 17.5 s (95% CI 16.0-19.1) at 5% GVI, 18.7 s (17.2-20.3) at 10%, 19.9 s (18.3-21.7) at 15%, and 20.7 s (18.9-22.7) at 20%. Compared with 5% GVI, the TRs at 10%, 15%, and 20% were 1.07, 1.14, and 1.18, respectively. The 20% versus 10% contrast was TR = 1.11 (95% CI 1.05-1.17).",
  "The predicted median duration was 24.5 s (95% CI 23.6-25.3) at 5% GVI, 26.0 s (24.9-27.2) at 10%, 28.1 s (26.7-29.7) at 15%, and 29.0 s (27.2-30.8) at 20%. Compared with 5% GVI, the TRs at 10%, 15%, and 20% were 1.06, 1.15, and 1.18, respectively. The 20% versus 10% contrast was TR = 1.11 (95% CI 1.05-1.18)."),
 ("At higher display points", "20.6 s (95% CI 18.4-23.0) at 25% GVI and 20.1 s (17.3-23.3) at 30%", "28.8 s (95% CI 26.9-30.8) at 25% GVI and 28.3 s (25.9-31.0) at 30%"),
 ("Among the background covariates", "Among the background covariates, seating showed the clearest positive association with longer duration, while outdoor dining showed a smaller but statistically supported positive association. Segments with seating had about 9% longer adjusted duration (TR = 1.09, 95% CI 1.03-1.15, P = 0.005). Outdoor dining was associated with about 7% longer duration (TR = 1.07, 95% CI 1.00-1.14, P = 0.034). Hutt Street also had longer adjusted duration than Hindley Street (TR = 1.14, 95% CI 1.02-1.26, P = 0.017).",
  "Among the background covariates, weekend observation was associated with about 12% longer adjusted duration (TR = 1.12, 95% CI 1.08-1.16, P < 0.001), whereas midday observation was associated with shorter duration than morning (TR = 0.81, 95% CI 0.78-0.84, P < 0.001). Among built-environment features, higher functional mix (TR = 1.03 per 0.1 increase, 95% CI 1.02-1.05, P < 0.001) and POI density (TR = 1.03 per 1 POI/100 m, 95% CI 1.01-1.04, P = 0.001) were associated with longer duration, and a higher H/W ratio with shorter duration (TR = 0.98 per 0.1 increase, 95% CI 0.97-0.98, P < 0.001). Seating (TR = 1.04, 95% CI 0.99-1.09, P = 0.106) and outdoor dining (TR = 1.04, 95% CI 0.99-1.09, P = 0.141) showed positive but imprecise associations. Hutt Street also had longer adjusted duration than Hindley Street (TR = 1.14, 95% CI 1.01-1.28, P = 0.028)."),
 ("Adjusted estimates are standardised predictions", "The overall GVI test was Wald χ² = 18.6", "The overall GVI test was Wald χ² = 18.2"),
 ("Fig. 6. Adjusted association", "distribution of the 300 street-segment × season GVI observations", "distribution of the 298 street-segment × season GVI observations"),
 # 4.4
 ("The 20% versus 10% GVI contrast remained positive", "The primary log-normal AFT model gave TR = 1.11 (95% CI 1.05-1.17). Weibull and log-logistic models gave TR = 1.09 (1.03-1.16) and 1.13 (1.06-1.21), respectively. Three-knot and five-knot RCS models gave TR = 1.10 (1.04-1.16) and 1.12 (1.05-1.20).",
  "The primary log-normal AFT model gave TR = 1.11 (95% CI 1.05-1.18). Weibull and log-logistic models gave TR = 1.11 (1.02-1.20) and 1.16 (1.08-1.24), respectively, although overall evidence for the GVI spline was weaker in the Weibull model (P = 0.109). Three-knot and five-knot RCS models gave TR = 1.06 (1.02-1.10) and 1.13 (1.04-1.22)."),
 ("Using single-time-point GSV GVI", "Using single-time-point GSV GVI weakened the association to TR = 1.06 (95% CI 1.00-1.12), with overall P = 0.064 and non-linear P = 0.118. Restricting the analysis to complete departures gave TR = 1.12 (1.06-1.18). Additional adjustment for pedestrian volume gave TR = 1.09 (1.03-1.15; overall P = 0.008; non-linear P = 0.056).",
  "Using single-time-point GSV GVI gave a slightly smaller contrast, TR = 1.08 (95% CI 1.02-1.16), with overall P < 0.001 and non-linear P = 0.003. Restricting the analysis to complete departures gave TR = 1.10 (1.04-1.17). Additional adjustment for pedestrian volume gave TR = 1.11 (1.05-1.17; overall P < 0.001; non-linear P = 0.020)."),
 ("All leave-one-street-out estimates", "Excluding Hindley Street gave TR = 1.09 (1.02-1.17), although evidence for non-linearity weakened (P = 0.063). Excluding Gouger Street gave TR = 1.12 (1.05-1.20), and excluding Melbourne Street gave TR = 1.10 (1.04-1.17). Excluding Hutt Street gave TR = 1.08 (1.01-1.16), with a non-linearity P value of 0.087,",
  "Excluding Hindley Street gave TR = 1.12 (1.04-1.20). Excluding Gouger Street gave TR = 1.10 (1.01-1.19), although overall evidence for the GVI spline weakened (P = 0.152), and excluding Melbourne Street gave TR = 1.09 (1.01-1.18). Excluding Hutt Street gave TR = 1.11 (1.05-1.16), with a non-linearity P value of 0.765,"),
 ("All leave-one-street-out estimates", "the 20% versus 10% TR declined from 1.15 (95% CI 1.08-1.23) in the street-adjusted model to 1.13 (1.07-1.20) after temporal adjustment, 1.12 (1.06-1.18) after built-environment adjustment, and 1.11 (1.05-1.17) in the fully adjusted model",
  "the 20% versus 10% TR was 1.09 (95% CI 1.01-1.17) in the street-adjusted model, 1.08 (1.00-1.16) after temporal adjustment, 1.12 (1.06-1.19) after built-environment adjustment, and 1.11 (1.05-1.18) in the fully adjusted model"),
 ("The fully adjusted model showed no serious", "The maximum VIF or adjusted GVIF was 2.3.", "The maximum VIF or adjusted GVIF was 2.7."),
 ("The fully adjusted model showed no serious", "ranging from −0.24 to 0.28", "ranging from −0.22 to 0.28"),
 ("The fully adjusted model showed no serious", "The spatial diagnostic provided no evidence of detectable residual spatial autocorrelation in the estimated segment-level random effects (Moran’s I = 0.058, permutation P = 0.238; Table S2).",
  "The spatial diagnostic did not indicate statistically significant residual spatial autocorrelation in the estimated segment-level random effects (Moran’s I = 0.139, permutation P = 0.075; Table S2)."),
 # discussion
 ("The first finding was a positive", "(TR = 1.11, 95% CI 1.05–1.17)", "(TR = 1.11, 95% CI 1.05–1.18)"),
 ("The second finding was", "The 20% versus 10% TR declined from 1.15 in the street-adjusted model to 1.11 in the fully adjusted model, while alternative distributions, spline specifications, exposure summaries, censoring treatment, pedestrian-volume adjustment, and leave-one-street-out analyses generally produced positive estimates around 1.08–1.13",
  "The 20% versus 10% TR remained similar across adjustment sets (1.08–1.12; 1.11 in the fully adjusted model), while alternative distributions, spline specifications, exposure summaries, censoring treatment, pedestrian-volume adjustment, and leave-one-street-out analyses produced positive estimates of 1.06–1.16, although overall evidence for the GVI spline was weaker in the Weibull and Gouger-excluded models"),
 ("The third finding concerned", "9.87% in winter to 11.21% in spring", "9.90% in winter to 11.24% in spring"),
 ("The third finding concerned", "reduced the 20% versus 10% contrast from 1.11 to 1.06 and weakened statistical evidence for the overall and nonlinear associations",
  "reduced the 20% versus 10% contrast only slightly, from 1.11 to 1.08, while statistical evidence for the overall and nonlinear associations was retained"),
 ("Visible greenery should also be interpreted", "and the attenuation from TR = 1.15 to 1.11 after broader adjustment indicates some overlap between GVI and contextual conditions (Fig. S2). Seating and outdoor dining were independently associated with longer adjusted duration (Table S1),",
  "and the relative stability of the TR across adjustment sets (1.08–1.12) suggests that the GVI association was not explained by the measured contextual conditions (Fig. S2). Functional mix and POI density were independently associated with longer adjusted duration, while seating and outdoor dining showed positive but imprecise associations (Table S1),"),
 ("The weaker result obtained with single-time-point GSV", "The weaker result obtained with single-time-point GSV further suggests that exposure timing deserves attention.",
  "The slightly smaller contrast obtained with single-time-point GSV further suggests that exposure timing may deserve attention."),
 ("Greening should be considered together", "The positive associations for seating and outdoor dining are consistent with this integrated interpretation (Table S1).",
  "The positive associations for functional mix and POI density, and the positive but imprecise estimates for seating and outdoor dining, are consistent with this integrated interpretation (Table S1)."),
 ("Imagery timing also matters", "The weaker association obtained from single-time-point GSV suggests", "The slightly smaller contrast obtained from single-time-point GSV suggests"),
 ("Fifth, inference at the upper end", "provided no evidence of detectable residual spatial autocorrelation", "did not indicate statistically significant residual spatial autocorrelation (P = 0.075)"),
 ("Finally, video tracking", "(TR = 1.12, 95% CI 1.06–1.18)", "(TR = 1.10, 95% CI 1.04–1.17)"),
 ("On the four Adelaide main streets studied", "(TR = 1.11, 95% CI 1.05–1.17)", "(TR = 1.11, 95% CI 1.05–1.18)"),
]
apply(D, E, log)

# Table 3 (tables[2])
T3 = D.tables[2]
upd = {
 "Observed segment duration, median": ["16.7 [13.0-26.1]", "16.3 [12.8-23.0]", "15.7 [12.7-20.2]", "21.4 [15.5-138.9]", "17.9 [14.2-128.9]"],
 "Street-segment × season observations": ["298", "78", "78", "64", "78"],
 "Camera-view GVI, mean (SD)": ["11.43 (8.67)", "3.78 (1.61)", "9.19 (7.26)", "21.67 (6.85)", "12.92 (6.50)"],
 "Camera-view GVI, median": ["8.75 [3.90-17.10]", "3.45 [2.32-4.78]", "7.00 [2.90-13.25]", "21.10 [16.20-26.07]", "11.30 [7.80-16.70]"],
 "Observed GVI range": ["1.70-38.70", "1.70-8.30", "1.80-28.00", "9.80-38.70", "5.00-28.20"],
 "Winter GVI": ["9.90 (7.46)", "3.47 (1.37)", "8.20 (6.64)", "18.49 (6.06)", "11.10 (5.79)"],
 "Spring GVI": ["11.24 (8.67)", "3.68 (1.52)", "8.85 (7.13)", "21.82 (6.67)", "12.63 (6.65)"],
}
for lab, vals in upd.items():
    r = row_by_label(T3, lab)
    for j, v in enumerate(vals): cell_set(r.cells[j + 1], v)
apply(D, [("Camera-view GVI is summarised at the street-segment", "(100 segments × 3 seasons = 300 observations)", "(298 street-segment × season observations)")], log)

# Table 4 (tables[3])
t4 = pd.read_csv("out/table4.csv"); T4 = D.tables[3]
fp = lambda p: "<0.001" if p < 0.001 else f"{p:.3f}"
for i, r in t4.iterrows():
    row = T4.rows[i + 1]
    cell_set(row.cells[1], f"{r.med:.1f}"); cell_set(row.cells[2], f"{r.lo:.1f}-{r.hi:.1f}")
    if r.GVI != 5:
        cell_set(row.cells[3], f"{r.TR5:.2f}"); cell_set(row.cells[4], f"+{100*(r.TR5-1):.1f}%"); cell_set(row.cells[5], fp(r.P5))

set_image(D, 5, "out/Fig6.png")
D.save(OUT + "Manuscript_R3_tracked.docx")

# ---------------- appendix ----------------
A = docx.Document(U + "8b68747c-appendix_2.docx")
s1 = pd.read_csv("out/tableS1.csv").set_index("term"); vif = pd.read_csv("out/vif.csv").set_index("term")
TS1 = A.tables[0]
m = {"Gouger vs Hindley": "streetGouger", "Hutt vs Hindley": "streetHutt", "Melbourne vs Hindley": "streetMelbourne",
     "Late spring-early summer vs spring": "seasonsummer", "Winter vs spring": "seasonwinter", "Midday vs morning": "periodnoon",
     "Late afternoon vs morning": "periodlate_afternoon", "Weekend vs weekday": "weekend", "Temperature, per 5": "z_temp",
     "FAR, per 1-unit": "z_FAR", "Functional mix, per 0.1": "z_fmix", "H/W ratio, per 0.1": "z_HW", "Footpath width": "z_foot",
     "Seating present": "seating", "Outdoor dining present": "outdoor_dining", "POI density": "z_POI", "Bus stop present": "bus_stop",
     "Pedestrian crossing present": "crossing"}
vm = {"Street (reference": "street", "Season (reference": "season", "Observation period (reference": "period", "Weekend vs weekday": "weekend",
      "Temperature, per 5": "air_temp_BoM_S4_C", "FAR, per 1-unit": "FAR", "Functional mix, per 0.1": "functional_mix", "H/W ratio, per 0.1": "HW_ratio",
      "Footpath width": "footpath_m", "Seating present": "seating", "Outdoor dining present": "outdoor_dining", "POI density": "POI_per100m",
      "Bus stop present": "bus_stop", "Pedestrian crossing present": "crossing"}
for lab, k in m.items():
    r = row_by_label(TS1, lab); x = s1.loc[k]
    cell_set(r.cells[1], f"{x.TR:.2f}"); cell_set(r.cells[2], f"{x.lo:.2f}-{x.hi:.2f}"); cell_set(r.cells[3], fp(x.P))
for lab, k in vm.items():
    cell_set(row_by_label(TS1, lab).cells[4], f"{vif.loc[k, 'report']:.1f}")
summ = pd.read_csv("out/sum_primary.csv").iloc[0]
apply(A, [("The model included 138,873", "were 0.18 and 0.11, respectively", f"were {summ.sd_seg:.2f} and {summ.sd_ses:.2f}, respectively")], log)

S = {k: pd.read_csv(f"out/sum_{k}.csv").iloc[0] for k in ["primary", "weibull", "loglogis", "k3", "k5", "gsv", "complete", "volume", "noHindley", "noGouger", "noMelb", "noHutt"]}
TS2 = A.tables[1]
rowsS2 = {"Log-normal AFT": ("primary", "Reference"), "Weibull AFT": ("weibull", "Similar estimate; weaker overall evidence"),
          "Log-logistic AFT": ("loglogis", "Slightly stronger"), "3-knot RCS": ("k3", "Attenuated; weaker curvature"), "5-knot RCS": ("k5", "Consistent; weaker curvature"),
          "GSV GVI": ("gsv", "Slightly attenuated; evidence retained"), "Complete departures only": ("complete", "Consistent"),
          "+ pedestrian volume": ("volume", "Consistent"), "Exclude Hindley": ("noHindley", "Consistent"),
          "Exclude Gouger": ("noGouger", "Similar estimate; weaker overall evidence"), "Exclude Melbourne": ("noMelb", "Consistent"),
          "Exclude Hutt": ("noHutt", "Association retained; upper-range support reduced")}
for r in TS2.rows[1:]:
    lab = r.cells[1].text.strip()
    for key, (k, interp) in rowsS2.items():
        if lab.startswith(key):
            x = S[k]; cell_set(r.cells[2], f"{x.TR:.2f} ({x.lo:.2f}-{x.hi:.2f})"); cell_set(r.cells[3], fp(x.P_all)); cell_set(r.cells[4], fp(x.P_nl)); cell_set(r.cells[5], interp)
    if lab.startswith("Residual spatial"):
        cell_set(r.cells[1], "Residual spatial autocorrelation (Moran’s I = 0.139)"); cell_set(r.cells[3], "0.075"); cell_set(r.cells[5], "No statistically significant residual spatial autocorrelation")

# Table S4 temperatures from BoM workbook
x = pd.read_excel(U + "1e315496-Table_S4_observation_schedule_BoM.xlsx", header=2)
x["d"] = pd.to_datetime(x["Date"], errors="coerce").dt.strftime("%Y-%m-%d"); x = x.dropna(subset=["d"]).set_index("d")
TS4 = A.tables[3]
for r in TS4.rows[1:]:
    d = pd.to_datetime(r.cells[1].text.strip(), format="%d %b %Y").strftime("%Y-%m-%d")
    cell_set(r.cells[7], f"{x.loc[d, 'Air temperature (°C)ᵃ']:.1f}")
apply(A, [(None, "Temperature (°C)", "Temperature (°C)ᵃ")], log) if False else None
for i, f in enumerate(["FigS1", "FigS2", "FigS3"]): set_image(A, i, f"out/{f}.png")
A.save(OUT + "Appendix_R3_tracked.docx")
open(OUT + "build_log.txt", "w").write("\n".join(log))
print(sum(l.startswith("!!") for l in log), "problems;", len(log), "log lines")
print("\n".join(l for l in log if l.startswith("!!")))
