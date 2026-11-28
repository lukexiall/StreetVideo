"""Data quality checks for the Melbourne pedestrian x heat x canopy study."""
import glob, sys
import numpy as np, pandas as pd, geopandas as gpd
R = sys.argv[1]
old = pd.read_csv(glob.glob(f"{R}/pedestrian_counts_2009_2022/*.csv")[0])
new = pd.read_csv(f"{R}/pedestrian_counts_latest.csv")
print("== OLD file", len(old), "| cols", list(old.columns))
old["dt"] = pd.to_datetime(old.Year.astype(str)+"-"+old.Month+"-"+old.Mdate.astype(str), format="%Y-%B-%d") + pd.to_timedelta(old.Time, unit="h")
d = old.duplicated(["Sensor_ID","dt"]); print("duplicate sensor-hours:", d.sum())
print("hours present per sensor-day (DST check):", old.groupby(["Sensor_ID",old.dt.dt.date]).size().value_counts().sort_index().tail(6).to_dict())
print("counts: min", old.Hourly_Counts.min(), "| zeros %.2f%%" % (100*(old.Hourly_Counts==0).mean()), "| max", old.Hourly_Counts.max())
print("== NEW file", len(new), "| cols", list(new.columns))
print("pedestriancount == dir1+dir2:", (new.pedestriancount == new.direction_1+new.direction_2).mean().round(4))
print("duplicate sensor-hours:", new.duplicated(["location_id","sensing_date","hourday"]).sum())
print("zeros %.2f%%" % (100*(new.pedestriancount==0).mean()), "| hours per sensor-day:", new.groupby(["location_id","sensing_date"]).size().value_counts().sort_index().tail(5).to_dict())
loc = new.groupby("location_id").location.nunique(); print("sensors with >1 coordinate in new file:", (loc>1).sum())
# long zero runs / stuck values (outages) in old file, daytime only
o = old[old.Time.between(8,18)].sort_values(["Sensor_ID","dt"])
def runs(x, val):
    m = (x==val).astype(int); g = (m.diff()!=0).cumsum(); r = m.groupby(g).sum(); return r.max()
zr = o.groupby("Sensor_ID").Hourly_Counts.apply(lambda x: runs(x.values==0, True) if False else ((x==0).astype(int).groupby(((x!=0)).cumsum()).sum().max()))
print("sensors with daytime zero-runs >= 11 h (a full day):", (zr>=11).sum(), "of", len(zr))
# daily totals: level shifts (relocations) -- ratio of median daily total, year to year
dd = old.groupby(["Sensor_ID", old.dt.dt.year]).Hourly_Counts.sum() / old.groupby(["Sensor_ID", old.dt.dt.year]).dt.apply(lambda s: s.dt.date.nunique())
yr = dd.unstack()
print("sensor-years with >60% change in mean daily total (excl. 2020-21 years):",
      int(((yr.pct_change(axis=1).abs()>0.6).drop(columns=[c for c in [2020,2021,2022] if c in yr.columns])).sum().sum()))
# weather
w = pd.read_csv(f"{R}/weather_hourly.csv"); w["dt"]=pd.to_datetime(w.time)
print("== WEATHER rows", len(w), "| missing temp", w.temperature_2m.isna().sum(), "| duplicate times", w.dt.duplicated().sum(),
      "| hours per day:", w.groupby(w.dt.dt.date).size().value_counts().to_dict())
# coordinate precision
s = gpd.read_file(glob.glob(f"{R}/sensor_locations_shp/**/*.shp", recursive=True)[0])
dec = s.latitude.astype(str).str.split(".").str[1].str.len()
print("== SENSOR coords decimals (lat):", dec.value_counts().sort_index().to_dict())
nl = new.drop_duplicates("location_id")[["location_id","location"]]
nl[["lat","lon"]] = nl.location.str.split(",", expand=True).astype(float)
m = s.assign(location_id=s.location_id.astype(int)).merge(nl, on="location_id")
g1 = gpd.GeoSeries(gpd.points_from_xy(m.longitude.astype(float), m.latitude.astype(float)), crs=4326).to_crs(7855)
g2 = gpd.GeoSeries(gpd.points_from_xy(m.lon, m.lat), crs=4326).to_crs(7855)
dist = g1.distance(g2); print("distance shp coord vs count-file coord (m):", dist.describe()[["50%","max"]].round(1).to_dict(), "| >10 m:", (dist>10).sum())
