import pandas as pd, numpy as np, json, sys
from scipy.stats import spearmanr
df=pd.read_csv(sys.argv[1],low_memory=False)
ss=df.groupby(['street','segment','season'],as_index=False).GVI_seasonal.first()
f=lambda s:f"{s.mean():.2f} ({s.std():.2f})"
m=lambda s:f"{s.median():.2f} [{s.quantile(.25):.2f}-{s.quantile(.75):.2f}]"
out={}
for k,g in [('Overall',ss)]+list(ss.groupby('street')):
    r={'n':len(g),'mean':f(g.GVI_seasonal),'median':m(g.GVI_seasonal),'range':f"{g.GVI_seasonal.min():.2f}-{g.GVI_seasonal.max():.2f}"}
    for s in ['winter','spring','summer']: r[s]=f(g[g.season==s].GVI_seasonal)
    out[k]=r
print(pd.DataFrame(out).to_string())
for k,g in [('Overall',df)]+list(df.groupby('street')):
    d=g.duration_s; print(k, f"{d.median():.1f} [{d.quantile(.25):.1f}-{d.quantile(.75):.1f}]", g.departure_status.sum(), round(100*g.departure_status.mean(),1))
print('pctiles seg-season GVI 5/35/65/95', np.percentile(ss.GVI_seasonal,[5,35,65,95]).round(2))
# Spearman, segment-level mean seasonal GVI
seg=df.groupby('segment').agg(GVI=('GVI_seasonal',lambda s: s.drop_duplicates().mean()) ,**{c:(c,'first') for c in ['FAR','functional_mix','HW_ratio','footpath_m','seating','outdoor_dining','crossing','POI_per100m','bus_stop']})
seg['GVI']=ss.groupby('segment').GVI_seasonal.mean()
rng=np.random.default_rng(2025); n=len(seg); idx=rng.integers(0,n,(2000,n))
for c in seg.columns[1:]:
    r=spearmanr(seg.GVI,seg[c]).statistic
    bs=[spearmanr(seg.GVI.values[i],seg[c].values[i]).statistic for i in idx]
    lo,hi=np.nanpercentile(bs,[2.5,97.5]); print(f"{c:15s} {r:.2f} ({lo:.2f}, {hi:.2f})")
