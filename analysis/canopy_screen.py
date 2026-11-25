"""Screen pedestrian sensors by canopy change (2011/2018/2021) within 25 m and 50 m."""
import geopandas as gpd, pandas as pd, glob, sys
R = sys.argv[1]; OUT = sys.argv[2]
shp = lambda d: glob.glob(f"{R}/{d}/**/*.shp", recursive=True)[0]
s = gpd.read_file(shp("sensor_locations_shp")).to_crs(7855)
bbox = tuple(s.to_crs(4326).total_bounds + [-0.002, -0.002, 0.002, 0.002])
rows = []
for yr in (2011, 2018, 2021):
    c = gpd.read_file(shp(f"tree_canopies_{yr}_shp"), bbox=bbox).to_crs(7855)
    print(yr, "features", len(c), "geom", c.geom_type.value_counts().to_dict(), flush=True)
    if yr == 2011:
        for col in ["park_stree", "location", "admin_name", "ule"]:
            if col in c: print("  2011", col, c[col].value_counts().head(5).to_dict())
    u = c.geometry.union_all()
    print(yr, "canopy area in bbox (ha)", round(u.area / 1e4, 1), flush=True)
    for r in (25, 50):
        b = s.buffer(r)
        s[f"c{yr}_{r}"] = [g.intersection(u).area / g.area * 100 for g in b]
for r in (25, 50):
    s[f"d11_21_{r}"] = s[f"c2021_{r}"] - s[f"c2011_{r}"]
    s[f"d18_21_{r}"] = s[f"c2021_{r}"] - s[f"c2018_{r}"]
s.drop(columns="geometry").to_csv(OUT, index=False)
print("saved", OUT, len(s))
