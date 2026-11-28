"""Sensor inventory for the Melbourne heat x canopy study.

One row per pedestrian sensor: location, indoor/outdoor, notes on moves,
observation coverage, number of extreme-heat hours observed, canopy around
the sensor, and simple street-context measures.

Usage: python3 analysis/sensor_inventory.py <raw_dir> <canopy_by_sensor.csv> <out_csv>

Definitions (set in advance, change here if the plan changes):
- Warm season: November to March.
- Extreme-heat hour: hourly air temperature above the 90th percentile of the
  same hour of day in the warm season, using all years 2009-2026 as reference.
- Daytime window for counting heat exposure: 08:00-18:59.
- COVID window excluded in the "_excl_covid" columns: 2020-03-01 to 2021-12-31.
"""
import glob
import sys

import geopandas as gpd
import pandas as pd

RAW, CANOPY_CSV, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
WARM = [11, 12, 1, 2, 3]
DAY_HOURS = range(8, 19)
COVID = (pd.Timestamp("2020-03-01"), pd.Timestamp("2021-12-31 23:00"))


def shp(name):
    return glob.glob(f"{RAW}/{name}/**/*.shp", recursive=True)[0]


# ---- 1. hourly counts from both files ------------------------------------
old = pd.read_csv(glob.glob(f"{RAW}/pedestrian_counts_2009_2022/*.csv")[0],
                  usecols=["Year", "Month", "Mdate", "Time", "Sensor_ID", "Sensor_Name", "Hourly_Counts"])
old["dt"] = pd.to_datetime(old.Year.astype(str) + "-" + old.Month + "-" + old.Mdate.astype(str),
                           format="%Y-%B-%d") + pd.to_timedelta(old.Time, unit="h")
old = old.rename(columns={"Sensor_ID": "location_id", "Hourly_Counts": "count", "Sensor_Name": "name_old"})

new = pd.read_csv(f"{RAW}/pedestrian_counts_latest.csv",
                  usecols=["location_id", "sensing_date", "hourday", "pedestriancount", "sensor_name"])
new["dt"] = pd.to_datetime(new.sensing_date) + pd.to_timedelta(new.hourday, unit="h")
new = new.rename(columns={"pedestriancount": "count"})

cnt = pd.concat([old[["location_id", "dt", "count"]], new[["location_id", "dt", "count"]]], ignore_index=True)
cnt = cnt.drop_duplicates(["location_id", "dt"])
print("hourly records:", len(cnt), "sensors:", cnt.location_id.nunique(), flush=True)

# ---- 2. extreme-heat hours -----------------------------------------------
w = pd.read_csv(f"{RAW}/weather_hourly.csv")
w["dt"] = pd.to_datetime(w.time)
w = w.dropna(subset=["temperature_2m"])
w["hour"] = w.dt.dt.hour
warm = w[w.dt.dt.month.isin(WARM)]
p90 = warm.groupby("hour").temperature_2m.quantile(0.9).rename("p90")
w = w.join(p90, on="hour")
w["heat"] = w.dt.dt.month.isin(WARM) & (w.temperature_2m > w.p90)
print("P90 threshold by hour (degC):", p90.round(1).to_dict(), flush=True)

cnt = cnt.merge(w[["dt", "heat", "temperature_2m"]].drop_duplicates("dt"), on="dt", how="left")
cnt["heat"] = cnt.heat.fillna(False).astype(bool)
day = cnt[cnt.dt.dt.hour.isin(DAY_HOURS)]
in_covid = day.dt.between(*COVID)


def per_sensor(d, suffix=""):
    g = d.groupby("location_id")
    out = pd.DataFrame({
        f"heat_hours{suffix}": g.heat.sum(),
        f"heat_days{suffix}": d[d.heat].groupby("location_id").dt.apply(lambda s: s.dt.date.nunique()),
    })
    return out


cov = cnt.groupby("location_id").agg(first_obs=("dt", "min"), last_obs=("dt", "max"),
                                     n_hours=("dt", "size"))
cov["hours_2009_2022"] = cnt[cnt.dt < "2022-11-01"].groupby("location_id").size()
cov["hours_2024_2026"] = cnt[cnt.dt >= "2024-11-01"].groupby("location_id").size()
cov["mean_daytime_count"] = day.groupby("location_id")["count"].mean().round(0)
cov = cov.join(per_sensor(day)).join(per_sensor(day[~in_covid], "_excl_covid"))
# heat hours near the canopy map years (+-1 year), outside COVID window
for yr in (2018, 2021):
    near = day[day.dt.dt.year.between(yr - 1, yr + 1) & ~in_covid]
    cov[f"heat_hours_near_{yr}"] = near.groupby("location_id").heat.sum()
cov = cov.fillna({c: 0 for c in cov.columns if c.startswith(("heat", "hours"))})

# ---- 3. sensor metadata and spatial context -------------------------------
s = gpd.read_file(shp("sensor_locations_shp"))
s["location_id"] = s.location_id.astype(int)
s = s.rename(columns={"installatio": "installed", "location_ty": "location_type",
                      "direction_1": "dir1", "direction_2": "dir2"})
s = s.to_crs(7855)

canopy = pd.read_csv(CANOPY_CSV)[["location_id", "c2018_25", "c2018_50", "c2021_25", "c2021_50"]]
canopy["location_id"] = canopy.location_id.astype(int)

cafe = pd.read_csv(f"{RAW}/cafe_restaurant_seats.csv")
latest = cafe.census_year.max()
cafe = cafe[(cafe.census_year == latest) & cafe.longitude.notna()]
cafe = gpd.GeoDataFrame(cafe, geometry=gpd.points_from_xy(cafe.longitude, cafe.latitude), crs=4326).to_crs(7855)
buf50 = s[["location_id", "geometry"]].copy()
buf50["geometry"] = s.buffer(50)
j = gpd.sjoin(cafe, buf50, predicate="within")
seats = j.groupby("location_id").agg(cafe_seats_50m=("number_of_seats", "sum"),
                                     cafe_venues_50m=("trading_name", "nunique"))

bbox = tuple(s.to_crs(4326).total_bounds + [-0.002, -0.002, 0.002, 0.002])
bld = gpd.read_file(shp("building_footprints_2023_shp"), bbox=bbox).to_crs(7855)
bld_u = bld.geometry.union_all()
s["building_cover_50m"] = [round(g.intersection(bld_u).area / g.area * 100, 1) for g in buf50.geometry]
print("building footprint columns:", list(bld.columns)[:20], flush=True)

# rough flags: Hoddle Grid (CBD core) by bounding box, street name from description
lat, lon = s.latitude.astype(float), s.longitude.astype(float)
s["cbd_core_approx"] = lat.between(-37.8225, -37.8075) & lon.between(144.951, 144.974)
s["street_guess"] = (s.sensor_desc.str.split(r"\s*[-–(]\s*", regex=True).str[0]
                     .str.replace(r"\b(Street|St\.?)\b", "St", regex=True).str.strip())
s["sensors_on_street"] = s.groupby("street_guess").location_id.transform("size")

inv = (s.drop(columns="geometry")
       .merge(canopy, on="location_id", how="left")
       .merge(seats, on="location_id", how="left")
       .merge(cov, left_on="location_id", right_index=True, how="left"))
inv[["cafe_seats_50m", "cafe_venues_50m"]] = inv[["cafe_seats_50m", "cafe_venues_50m"]].fillna(0)

# sensors in the count data that are no longer in the location list (removed)
removed = cov.index.difference(s.location_id)
names = old.drop_duplicates("location_id").set_index("location_id").name_old
gone = cov.loc[removed].reset_index().rename(columns={"index": "location_id"})
gone["sensor_desc"] = gone.location_id.map(names)
gone["location_type"] = "removed (no coordinates)"
inv = pd.concat([inv, gone], ignore_index=True)

cols = ["location_id", "sensor_desc", "location_type", "street_guess", "sensors_on_street", "cbd_core_approx",
        "installed", "note", "dir1", "dir2", "latitude", "longitude",
        "first_obs", "last_obs", "n_hours", "hours_2009_2022", "hours_2024_2026", "mean_daytime_count",
        "heat_hours", "heat_days", "heat_hours_excl_covid", "heat_days_excl_covid",
        "heat_hours_near_2018", "heat_hours_near_2021",
        "c2018_25", "c2018_50", "c2021_25", "c2021_50",
        "building_cover_50m", "cafe_seats_50m", "cafe_venues_50m"]
inv = inv[cols].sort_values(["location_type", "location_id"])
for c in ["c2018_25", "c2018_50", "c2021_25", "c2021_50"]:
    inv[c] = inv[c].round(1)
inv.to_csv(OUT, index=False)
print("saved", OUT, len(inv), "rows", f"(cafe census year {latest})")
