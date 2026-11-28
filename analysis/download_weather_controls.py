"""Hourly precipitation, wind and humidity for Melbourne CBD (Open-Meteo archive), 2009-2026."""
import json, urllib.request, time, csv, sys
OUT = sys.argv[1]
U = ("https://archive-api.open-meteo.com/v1/archive?latitude=-37.814&longitude=144.963&start_date={s}&end_date={e}"
     "&hourly=precipitation,wind_speed_10m,relative_humidity_2m&timezone=Australia%2FMelbourne")
rows = []
for y in range(2009, 2027):
    s, e = f"{y}-01-01", (f"{y}-12-31" if y < 2026 else "2026-11-15")
    for i in range(12):
        try:
            d = json.load(urllib.request.urlopen(U.format(s=s, e=e), timeout=120)); break
        except Exception as ex:
            print(y, "retry", ex, flush=True); time.sleep(15 * (i + 1))
    h = d["hourly"]
    rows += zip(h["time"], h["precipitation"], h["wind_speed_10m"], h["relative_humidity_2m"])
    print(y, "ok", flush=True); time.sleep(3)
with open(OUT, "w", newline="") as f:
    w = csv.writer(f); w.writerow(["time", "precipitation", "wind_speed_10m", "relative_humidity_2m"]); w.writerows(rows)
print("done", len(rows))
