"""Apply re-analysis results to the supplementary appendix (Tables S1-S2, Figs. S2-S3).
Usage: python3 update_appendix.py <in.docx> <results_dir> <fig_dir> <out_clean.docx> <out_highlight.docx>"""
import sys, os, io
import pandas as pd
import docx
from PIL import Image
from docx_edit import set_cell, replace_everywhere

src, res, figs, out_clean, out_hl = sys.argv[1:6]
has = lambda s: os.path.exists(os.path.join(res, f"summary_{s}.csv"))
S = lambda s: pd.read_csv(os.path.join(res, f"summary_{s}.csv")).iloc[0]
fp = lambda p: "<0.001" if p < 0.001 else f"{p:.3f}"
cov = pd.read_csv(os.path.join(res, "covariate_TR_Full.csv")).set_index("term")
moran_i, moran_p = open(os.path.join(res, "moran.txt")).read().split()

s1 = {"Gouger vs Hindley": "streetGouger", "Hutt vs Hindley": "streetHutt", "Melbourne vs Hindley": "streetMelbourne",
      "Late spring-early summer vs spring": "seasonsummer", "Winter vs spring": "seasonwinter",
      "Midday vs morning": "periodnoon", "Late afternoon vs morning": "periodlate_afternoon",
      "Weekend vs weekday": "day_typeweekend", "Temperature": "air_temp_BoM_S4_C_z", "FAR": "FAR_z",
      "Functional mix": "functional_mix_z", "H/W ratio": "HW_ratio_z", "Footpath width": "footpath_m_z",
      "Seating present": "seating", "Outdoor dining present": "outdoor_dining", "POI density": "POI_per100m_z",
      "Bus stop present": "bus_stop", "Pedestrian crossing present": "crossing"}
s2 = {"Log-normal AFT": "Full", "Weibull AFT": "Weibull", "Log-logistic AFT": "LogLogistic", "3-knot RCS": "K3",
      "5-knot RCS": "K5", "Median of four directional views": "Median4", "GSV GVI": "GSV",
      "Complete departures only": "Complete", "+ pedestrian volume": "Volume", "Exclude Hindley": "exHindley",
      "Exclude Gouger": "exGouger", "Exclude Melbourne": "exMelbourne", "Exclude Hutt": "exHutt"}
prim = S("Full")

def interp(spec, r):
    if spec == "Full": return "Reference"
    if spec == "GSV": return "Attenuated; weaker evidence"
    if r.p_overall >= 0.05: return "Positive contrast retained; weaker overall evidence"
    if spec == "exHutt" and r.p_nonlinear >= 0.05: return "Association retained; upper-range support reduced"
    if r.p_nonlinear >= 0.05: return "Association retained; weaker curvature"
    if r.TR20v10 - prim.TR20v10 >= 0.02: return "Slightly stronger"
    if prim.TR20v10 - r.TR20v10 >= 0.02: return "Slightly attenuated"
    return "Consistent"

def uniq(row):
    out, prev = [], None
    for c in row.cells:
        if c._tc is not prev: out.append(c); prev = c._tc
    return out

def put(c, v, hl):
    if c.text.strip() != v: set_cell(c, v, hl)

def swap_image(d, rid, png):
    part = d.part.related_parts[rid]
    if part.content_type == "image/jpeg":
        buf = io.BytesIO(); Image.open(png).convert("RGB").save(buf, "JPEG", quality=95, dpi=(600, 600)); part._blob = buf.getvalue()
    else:
        part._blob = open(png, "rb").read()
    w, h = Image.open(png).size
    for inl in d.element.body.xpath(f".//wp:inline[.//a:blip[@r:embed='{rid}']]"):
        ext = inl.xpath("./wp:extent")[0]; cx = int(ext.get("cx")); cy = int(cx * h / w)
        ext.set("cy", str(cy))
        for e in inl.xpath(".//a:ext"): e.set("cx", str(cx)); e.set("cy", str(cy))

def apply(hl, out):
    d = docx.Document(src)
    for row in d.tables[0].rows[1:]:
        c = uniq(row); lab = c[0].text.strip()
        key = next((k for k in s1 if lab.startswith(k)), None)
        if key is None: continue
        t = s1[key]
        put(c[1], f"{cov.TR[t]:.2f}", hl); put(c[2], f"{cov.lo[t]:.2f}-{cov.hi[t]:.2f}", hl); put(c[3], fp(cov.p[t]), hl)
    for row in d.tables[1].rows[1:]:
        c = uniq(row); lab = c[1].text.strip()
        if lab.startswith("Residual spatial"):
            put(c[1], f"Residual spatial autocorrelation (Moran’s I = {moran_i})", hl); put(c[3], moran_p, hl); continue
        key = next((k for k in s2 if lab.startswith(k)), None)
        if key is None: continue
        spec = s2[key]
        if not has(spec):
            [put(x, "[to be updated]", hl) for x in c[2:6]]; continue
        r = S(spec)
        put(c[2], f"{r.TR20v10:.2f} ({r.lo:.2f}-{r.hi:.2f})", hl); put(c[3], fp(r.p_overall), hl)
        put(c[4], fp(r.p_nonlinear), hl); put(c[5], interp(spec, r), hl)
    swap_image(d, "rId10", os.path.join(figs, "FigS2_adjustment_sets.png"))
    swap_image(d, "rId11", os.path.join(figs, "FigS3_sensitivity.png"))
    d.save(out)

apply(False, out_clean); apply(True, out_hl)
print("saved", out_clean, out_hl)
