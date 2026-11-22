import os,glob,csv,sys
csv.field_size_limit(10**9)
def sz(p):
    t=sum(os.path.getsize(f) for f in glob.glob(p+"/**",recursive=True) if os.path.isfile(f)) if os.path.isdir(p) else os.path.getsize(p)
    return f"{t/1e6:.1f} MB"
for p in sorted(glob.glob("melbourne_data/raw/*")): print(os.path.basename(p),sz(p))
def rng(path,cands):
    with open(path,newline="",encoding="utf-8-sig",errors="ignore") as f:
        r=csv.reader(f); h=r.__next__(); low=[x.lower() for x in h]
        c=next((low.index(x) for x in cands if x in low),None)
        if c is None: return "cols:"+",".join(h[:8])
        mn=mx=None;n=0
        for row in r:
            if len(row)<=c or not row[c]: continue
            v=row[c][:10] if row[c][:4].isdigit() else row[c]; n+=1
            mn=v if mn is None or v<mn else mn; mx=v if mx is None or v>mx else mx
        return f"{mn} → {mx} ({n} rows)"
for f in ["melbourne_data/raw/pedestrian_counts_latest.csv"]+glob.glob("melbourne_data/raw/pedestrian_counts_2009_2022/**/*.csv",recursive=True):
    print("RANGE",f,rng(f,["sensing_date","date_time"]))
