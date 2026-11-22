import subprocess,os,zipfile,glob,sys,time
B="https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/"
csv=lambda d:B+d+"/exports/csv?delimiter=%2C"
shp=lambda d:B+d+"/exports/shp"
J={
"pedestrian_counts_latest.csv":csv("pedestrian-counting-system-monthly-counts-per-hour"),
"pedestrian_counts_2009_2022.zip":"https://data.melbourne.vic.gov.au/api/datasets/1.0/pedestrian-counting-system-monthly-counts-per-hour/attachments/pedestrian_counting_system_monthly_counts_per_hour_may_2009_to_14_dec_2022_csv_zip/",
"sensor_locations_shp.zip":shp("pedestrian-counting-system-sensor-locations"),
"tree_canopies_2021_shp.zip":shp("tree-canopies-2021-urban-forest"),
"trees_inventory.csv":csv("trees-with-species-and-dimensions-urban-forest"),
"microclimate_sensors_data.csv":csv("microclimate-sensors-data"),
"microclimate_sensor_readings.csv":csv("microclimate-sensor-readings"),
"tree_canopies_2018_shp.zip":shp("tree-canopies-2018-entire-municipal-area-urban-forest"),
"tree_canopies_2011_shp.zip":shp("tree-canopies-2011-urban-forest"),
"building_footprints_2023_shp.zip":shp("2023-building-footprints"),
"cafe_restaurant_seats.csv":csv("cafes-and-restaurants-with-seating-capacity"),
}
D="melbourne_data"; R=D+"/raw"; os.makedirs(R,exist_ok=True)
only=sys.argv[1:]
for f,u in J.items():
    if only and f not in only: continue
    p=(D if f.endswith(".zip") else R)+"/"+f
    for i in range(15):
        r=subprocess.run(["curl","-sSL","--fail","--retry","5","--retry-all-errors","-C","-","-o",p,u],capture_output=True,text=True)
        if r.returncode==0: break
        if r.returncode==33: os.remove(p)  # resume unsupported
        time.sleep(5)
    print(f, "OK" if r.returncode==0 else "FAIL "+r.stderr.strip()[-120:], flush=True)
for z in glob.glob(D+"/*.zip"):
    try: zipfile.ZipFile(z).extractall(R+"/"+os.path.basename(z)[:-4])
    except Exception as e: print("unzip fail",z,e)
