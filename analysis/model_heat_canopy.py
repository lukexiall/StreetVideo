"""First-pass models: heat-related change in pedestrian counts, and its variation with tree canopy.

Usage: python3 analysis/model_heat_canopy.py <raw_dir> <inventory_csv> <out_dir>

Design (set in advance):
- Sample: outdoor sensors in the current location list; warm season (Nov-Mar); 08:00-18:59;
  excludes 2020-03-01 to 2021-12-31 (COVID), Victorian public holidays, and sensor-days
  with a zero daytime total (likely outages).
- Extreme-heat hour: temperature above the warm-season 90th percentile for that hour of day
  (reference 2009-2026).
- Comparison: Poisson fixed-effects model with one fixed effect per matched stratum
  (sensor x year-month x weekday x hour), so heat hours are only compared with ordinary
  hours at the same sensor, in the same month, weekday and hour.
- Controls: precipitation, wind speed, relative humidity (same hour).
- Canopy: % cover within 50 m (2021 map); 25 m as a check. Interaction is per 10 points.
- Standard errors clustered by sensor and by date.
"""
import glob
import os
import sys

import holidays
import numpy as np
import pandas as pd
import pyfixest as pf

RAW, INV, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
WARM = [11, 12, 1, 2, 3]
COVID = (pd.Timestamp("2020-03-01"), pd.Timestamp("2021-12-31 23:00"))

# ---- counts ---------------------------------------------------------------
old = pd.read_csv(glob.glob(f"{RAW}/pedestrian_counts_2009_2022/*.csv")[0],
                  usecols=["Year", "Month", "Mdate", "Time", "Sensor_ID", "Hourly_Counts"])
old["dt"] = pd.to_datetime(old.Year.astype(str) + "-" + old.Month + "-" + old.Mdate.astype(str),
                           format="%Y-%B-%d") + pd.to_timedelta(old.Time, unit="h")
old = old.rename(columns={"Sensor_ID": "sensor", "Hourly_Counts": "count"})[["sensor", "dt", "count"]]
new = pd.read_csv(f"{RAW}/pedestrian_counts_latest.csv", usecols=["location_id", "sensing_date", "hourday", "pedestriancount"])
new["dt"] = pd.to_datetime(new.sensing_date) + pd.to_timedelta(new.hourday, unit="h")
new = new.rename(columns={"location_id": "sensor", "pedestriancount": "count"})[["sensor", "dt", "count"]]
c = pd.concat([old, new], ignore_index=True).drop_duplicates(["sensor", "dt"])

inv = pd.read_csv(INV)
inv = inv[inv.location_type == "Outdoor"]
c = c[c.sensor.isin(inv.location_id)]

c = c[c.dt.dt.month.isin(WARM) & c.dt.dt.hour.between(8, 18) & ~c.dt.between(*COVID)]
vic = holidays.Australia(subdiv="VIC", years=range(2009, 2027))
c["date"] = c.dt.dt.normalize()
c = c[~c.date.dt.date.isin(vic)]
day_total = c.groupby(["sensor", "date"])["count"].transform("sum")
c = c[day_total > 0]

# ---- weather --------------------------------------------------------------
w = pd.read_csv(f"{RAW}/weather_hourly.csv").drop_duplicates("time")
w["dt"] = pd.to_datetime(w.time)
w["hour"] = w.dt.dt.hour
p90 = w[w.dt.dt.month.isin(WARM)].groupby("hour").temperature_2m.quantile(0.9).rename("p90")
w = w.join(p90, on="hour")
w["heat"] = (w.temperature_2m > w.p90).astype(int)
HAS_CTL = os.path.exists(f"{RAW}/weather_hourly_controls.csv")
WCOLS = ["dt", "temperature_2m", "heat"]
if HAS_CTL:
    ctl = pd.read_csv(f"{RAW}/weather_hourly_controls.csv").drop_duplicates("time")
    ctl["dt"] = pd.to_datetime(ctl.time)
    w = w.merge(ctl.drop(columns="time"), on="dt", how="left")
    WCOLS += ["precipitation", "wind_speed_10m", "relative_humidity_2m"]
else:
    print("NOTE: weather controls file not found -> running WITHOUT rain/wind/humidity controls", flush=True)
c = c.merge(w[WCOLS], on="dt")

# ---- strata: sensor x year-month x weekday x hour -------------------------
c["stratum"] = (c.sensor.astype(str) + "_" + c.dt.dt.strftime("%Y%m") + "_" +
                c.dt.dt.weekday.astype(str) + "_" + c.dt.dt.hour.astype(str))
mix = c.groupby("stratum").heat.agg(["min", "max"])
c = c[c.stratum.isin(mix[(mix["min"] == 0) & (mix["max"] == 1)].index)]
c["date_id"] = c.date.dt.strftime("%Y%m%d")

ctx = inv.set_index("location_id")
for col in ["c2021_50", "c2021_25", "c2018_50", "cafe_seats_50m", "building_cover_50m"]:
    c[col] = c.sensor.map(ctx[col])
c["canopy50_10"] = (c.c2021_50 - c.c2021_50.mean()) / 10          # per 10 points, centred
c["canopy25_10"] = (c.c2021_25 - c.c2021_25.mean()) / 10
c["canopy50_2018_10"] = (c.c2018_50 - c.c2018_50.mean()) / 10
c["log_seats"] = np.log1p(c.cafe_seats_50m) - np.log1p(c.cafe_seats_50m).mean()
c["bld_10"] = (c.building_cover_50m - c.building_cover_50m.mean()) / 10
c["commercial"] = (c.cafe_seats_50m > 0).astype(int)

print(f"analysis sample: {len(c):,} sensor-hours | sensors {c.sensor.nunique()} | heat hours {int(c.heat.sum()):,} | "
      f"heat days {c[c.heat == 1].date.nunique()} | strata {c.stratum.nunique():,}", flush=True)
c.to_parquet(f"{OUT}/model_sample.parquet", index=False)

CTRL = "precipitation + wind_speed_10m + relative_humidity_2m" if HAS_CTL else "1"
VC = {"CRV1": "sensor+date_id"}
specs = {
    "M1 heat only": f"count ~ heat + {CTRL} | stratum",
    "M2 heat x canopy50": f"count ~ heat + heat:canopy50_10 + {CTRL} | stratum",
    "M3 + heat x cafes, buildings": f"count ~ heat + heat:canopy50_10 + heat:log_seats + heat:bld_10 + {CTRL} | stratum",
    "M4 commercial only (M3)": f"count ~ heat + heat:canopy50_10 + heat:log_seats + heat:bld_10 + {CTRL} | stratum",
    "R1 canopy 25 m": f"count ~ heat + heat:canopy25_10 + heat:log_seats + heat:bld_10 + {CTRL} | stratum",
    "R2 canopy 2018": f"count ~ heat + heat:canopy50_2018_10 + heat:log_seats + heat:bld_10 + {CTRL} | stratum",
}
rows = []
for name, f in specs.items():
    d = c[c.commercial == 1] if "commercial" in name else c
    m = pf.fepois(f, data=d, vcov=VC)
    t = m.tidy().reset_index().rename(columns={"Coefficient": "term"})
    t = t[t.term.str.contains("heat")]
    t.insert(0, "model", name)
    t["n_obs"] = m._N
    t["n_sensors"] = d.sensor.nunique()
    rows.append(t)
    print(name, "\n", t[["term", "Estimate", "Std. Error", "Pr(>|t|)"]].round(4).to_string(index=False), flush=True)
res = pd.concat(rows)
res["pct_change"] = 100 * (np.exp(res.Estimate) - 1)
res.to_csv(f"{OUT}/model_results.csv", index=False)

# heat loss implied at canopy 25th vs 75th percentile across sensors (M3)
m3 = res[res.model == "M3 + heat x cafes, buildings"].set_index("term").Estimate
q = inv.c2021_50.quantile([0.25, 0.75])
mean = c.c2021_50.mean()
for lab, v in q.items():
    b = m3["heat"] + m3["heat:canopy50_10"] * (v - mean) / 10
    print(f"implied heat change at canopy {v:.1f}% (p{int(lab*100)}): {100*(np.exp(b)-1):.1f}%")
print("saved", f"{OUT}/model_results.csv")
