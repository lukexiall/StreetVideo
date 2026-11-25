"""Can the council tree inventory rebuild street-tree change near pedestrian sensors?"""
import geopandas as gpd, pandas as pd, glob, sys
R = sys.argv[1]; OUT = sys.argv[2]
t = pd.read_csv(f"{R}/trees_inventory.csv", low_memory=False)
t = gpd.GeoDataFrame(t, geometry=gpd.points_from_xy(t.longitude, t.latitude), crs=4326).to_crs(7855)
t["dp"] = pd.to_datetime(t.date_planted, errors="coerce")
t["unknown"] = t.year_planted.eq(1900) | t.dp.isna()
t["bulk_2012"] = t.date_planted.eq("2012-04-27")          # one-day batch, likely a data load date
t["yr"] = t.dp.dt.year.where(~t.unknown & ~t.bulk_2012)
print("all trees", len(t), "| street", (t.located_in=="Street").sum())
st = t[t.located_in=="Street"]
print("street: unknown date %.0f%%, 2012-04-27 batch %.0f%%, usable year %.0f%%" % (100*st.unknown.mean(), 100*st.bulk_2012.mean(), 100*st.yr.notna().mean()))
print("street trees by planting year (usable):", st.yr.value_counts().sort_index().loc[2005:].astype(int).to_dict())
print("street age_description:", st.age_description.value_counts().to_dict())
s = gpd.read_file(glob.glob(f"{R}/sensor_locations_shp/**/*.shp", recursive=True)[0]).to_crs(7855)
j = gpd.sjoin(st, s[["location_id","sensor_desc","geometry"]].assign(geometry=s.buffer(50)), predicate="within")
g = j.groupby(["location_id","sensor_desc"]).agg(n_now=("com_id","size"),
        n_unknown=("unknown","sum"), n_bulk2012=("bulk_2012","sum"),
        n_2009_2015=("yr", lambda y: y.between(2009,2015).sum()),
        n_2016_2021=("yr", lambda y: y.between(2016,2021).sum()),
        n_2022_on=("yr", lambda y: (y>=2022).sum())).reset_index()
g.to_csv(OUT, index=False)
print("sensors with street trees within 50 m:", len(g), "of", len(s))
print(g[["n_now","n_unknown","n_2009_2015","n_2016_2021","n_2022_on"]].describe().loc[["mean","50%","max"]].round(1).to_string())
print("sensors with >=5 known plantings 2009-2021:", ((g.n_2009_2015+g.n_2016_2021)>=5).sum())
print(g.assign(new=g.n_2009_2015+g.n_2016_2021).sort_values("new",ascending=False).head(10).to_string(index=False))
