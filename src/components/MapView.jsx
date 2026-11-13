// Real-world map of the study streets (Leaflet).
// Base maps: OpenStreetMap (street map) and Esri World Imagery (satellite).
// Street lines are fetched from OpenStreetMap (Overpass API) when the map
// opens, so their geometry is OSM's, not hand-drawn. The exact extent of the
// thesis study segments is not known to the app yet and is labelled as such.
import L from 'leaflet';
import { STREETS } from '../data/streets.js';

const { useEffect, useRef, useState } = React;

const BASES = {
  map: {
    label: 'Map',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: 19,
  },
};

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
// Central Adelaide + North Adelaide
const BBOX = '-34.945,138.580,-34.895,138.625';
const OSM_NAMES = { hindley: 'Hindley Street', gouger: 'Gouger Street', hutt: 'Hutt Street', melbourne: 'Melbourne Street' };

async function fetchStreets() {
  const names = Object.values(OSM_NAMES).join('|');
  const q = `[out:json][timeout:25];way["highway"]["name"~"^(${names})$"](${BBOX});out geom;`;
  let lastErr;
  for (const url of OVERPASS) {
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const out = {};
      for (const el of j.elements || []) {
        const id = Object.keys(OSM_NAMES).find((k) => OSM_NAMES[k] === el.tags?.name);
        if (!id || !el.geometry) continue;
        (out[id] = out[id] || []).push(el.geometry.map((p) => [p.lat, p.lon]));
      }
      return out;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('No response');
}

let streetCache = null;

export function MapView({ streetId, onPickStreet }) {
  const el = useRef(null);
  const map = useRef(null);
  const base = useRef(null);
  const lines = useRef({});
  const [baseId, setBaseId] = useState('map');
  const [status, setStatus] = useState('loading');
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    const m = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([-34.922, 138.602], 15);
    m.attributionControl.setPrefix(false);
    map.current = m;
    const load = streetCache ? Promise.resolve(streetCache) : fetchStreets().then((d) => (streetCache = d));
    load.then((data) => {
      if (!map.current) return;
      const all = [];
      STREETS.forEach((s) => {
        const segs = data[s.id] || [];
        if (!segs.length) return;
        const group = L.featureGroup(segs.map((ll) => L.polyline(ll, { weight: 7, lineCap: 'round' })));
        group.on('click', () => onPickStreet(s.id));
        group.bindTooltip(`${s.name} · ${s.segments.length} study segments`, { sticky: true });
        group.addTo(m);
        lines.current[s.id] = group;
        all.push(group);
      });
      if (all.length) {
        m.fitBounds(L.featureGroup(all).getBounds(), { padding: [24, 24] });
        setStatus('ok');
      } else setStatus('empty');
    }).catch(() => setStatus('error'));
    return () => { m.remove(); map.current = null; lines.current = {}; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (base.current) m.removeLayer(base.current);
    const b = BASES[baseId];
    let errors = 0;
    const layer = L.tileLayer(b.url, { maxZoom: b.maxZoom, attribution: b.attribution, crossOrigin: true });
    layer.on('tileerror', () => { errors += 1; if (errors >= 4) setTilesFailed(true); });
    layer.on('tileload', () => setTilesFailed(false));
    layer.addTo(m);
    layer.bringToBack();
    base.current = layer;
  }, [baseId]);

  useEffect(() => {
    Object.entries(lines.current).forEach(([id, g]) => {
      const on = id === streetId;
      g.setStyle({ color: on ? '#e0a54b' : baseId === 'satellite' ? '#ffffff' : '#1d6a55', weight: on ? 9 : 6, opacity: on ? 1 : 0.85 });
      if (on) g.bringToFront();
    });
  });

  return (
    <div className="mapview">
      <div className="map-bar">
        <div className="seg-ctl" role="radiogroup" aria-label="Base map">
          {Object.entries(BASES).map(([id, b]) => (
            <button key={id} role="radio" aria-checked={baseId === id} className={baseId === id ? 'is-on' : ''} onClick={() => setBaseId(id)}>{b.label}</button>
          ))}
        </div>
        <span className="fine">Click a street to select it · highlighted: {STREETS.find((s) => s.id === streetId)?.name}</span>
      </div>
      <div className="map-box">
        <div ref={el} className="leaflet-host" />
        <div className="map-note">Study segment positions not yet imported. Lines show the whole street from OpenStreetMap.</div>
        {status === 'loading' && <div className="map-msg">Loading street lines from OpenStreetMap…</div>}
        {status === 'error' && <div className="map-msg">Street lines could not be loaded from OpenStreetMap right now. The base map still works; try again later.</div>}
        {tilesFailed && (
          <div className="map-msg map-msg-block">
            The map images could not load here. This preview blocks outside images; open the public site instead:
            <br /><a href="https://lukexiall.github.io/StreetVideo/" target="_blank" rel="noopener">lukexiall.github.io/StreetVideo</a>
          </div>
        )}
      </div>
    </div>
  );
}
