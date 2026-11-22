import json,urllib.request,time,csv
U="https://archive-api.open-meteo.com/v1/archive?latitude=-37.814&longitude=144.963&start_date={s}&end_date={e}&hourly=temperature_2m&daily=temperature_2m_max&timezone=Australia%2FMelbourne"
H=[];Dl=[]
for y in range(2009,2027):
    s=f"{y}-01-01"; e=f"{y}-12-31" if y<2026 else "2026-11-15"
    for i in range(10):
        try: d=json.load(urllib.request.urlopen(U.format(s=s,e=e),timeout=120)); break
        except Exception as ex: print(y,"retry",ex,flush=True); time.sleep(10*(i+1))
    H+=zip(d["hourly"]["time"],d["hourly"]["temperature_2m"]); Dl+=zip(d["daily"]["time"],d["daily"]["temperature_2m_max"])
    print(y,"ok",flush=True); time.sleep(2)
for fn,hdr,rows in [("weather_hourly.csv",["time","temperature_2m"],H),("weather_daily.csv",["date","temperature_2m_max"],Dl)]:
    with open("melbourne_data/raw/"+fn,"w",newline="") as f: w=csv.writer(f); w.writerow(hdr); w.writerows(rows)
print("done",len(H),len(Dl))
