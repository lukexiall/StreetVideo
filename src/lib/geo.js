// Georeferencing for the base map under the interactive plans.
//
// The thesis segment GIS layer is not in the app yet, so each street is
// placed along its OpenStreetMap centreline: the OSM way points are fitted
// with a straight axis (the four streets are straight), and segment 1 starts
// at one end of that axis plus a user-adjustable offset. This is an
// approximate placement and the UI says so.

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const BBOX = '-34.945,138.580,-34.895,138.625';
export const OSM_NAMES = { hindley: 'Hindley Street', gouger: 'Gouger Street', hutt: 'Hutt Street', melbourne: 'Melbourne Street' };

export const BASES = {
  drawing: { label: 'Drawing' },
  map: {
    label: 'Map',
    url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors',
  },
  satellite: {
    label: 'Satellite',
    url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    maxZoom: 19,
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics, GIS User Community',
  },
};

import EMBEDDED from '../data/osm-streets.json';

function framesFrom(points) {
  const frames = {};
  Object.entries(points || {}).forEach(([id, p]) => { if (p.length >= 2) frames[id] = fitFrame(p); });
  return frames;
}

async function query(url, q, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const pts = {};
    for (const el of j.elements || []) {
      const id = Object.keys(OSM_NAMES).find((k) => OSM_NAMES[k] === el.tags?.name);
      if (id && el.geometry) (pts[id] = pts[id] || []).push(...el.geometry.map((p) => [p.lat, p.lon]));
    }
    if (!Object.keys(pts).length) throw new Error('empty');
    return pts;
  } finally {
    clearTimeout(t);
  }
}

let pending = null;
// Street geometry is built into the app at deploy time (scripts/fetch-osm.mjs).
// Only if that is missing does the browser ask OpenStreetMap directly, racing
// the mirrors with a time limit.
export function loadStreetGeometry() {
  if (pending) return pending;
  const embedded = framesFrom(EMBEDDED.points);
  if (Object.keys(embedded).length) return (pending = Promise.resolve(embedded));
  const names = Object.values(OSM_NAMES).join('|');
  const q = `[out:json][timeout:20];way["highway"]["name"~"^(${names})$"](${BBOX});out geom;`;
  pending = Promise.any(OVERPASS.map((u) => query(u, q, 15000)))
    .then(framesFrom)
    .catch((e) => { pending = null; throw e; });
  return pending;
}

const M_LAT = 111320;

// Straight axis through the OSM points (principal component), in local metres.
export function fitFrame(points) {
  const lat0 = points.reduce((a, p) => a + p[0], 0) / points.length;
  const lon0 = points.reduce((a, p) => a + p[1], 0) / points.length;
  const mLon = M_LAT * Math.cos((lat0 * Math.PI) / 180);
  const xy = points.map(([la, lo]) => [(lo - lon0) * mLon, (la - lat0) * M_LAT]);
  let sxx = 0, syy = 0, sxy = 0;
  xy.forEach(([x, y]) => { sxx += x * x; syy += y * y; sxy += x * y; });
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let a = [Math.cos(ang), Math.sin(ang)];
  // canonical direction: eastwards for E–W streets, northwards for N–S streets
  if (Math.abs(a[0]) >= Math.abs(a[1]) ? a[0] < 0 : a[1] < 0) a = [-a[0], -a[1]];
  const c = [a[1], -a[0]]; // right of a: south for E–W, east for N–S (side 0 → side 1)
  const proj = xy.map(([x, y]) => x * a[0] + y * a[1]);
  const offs = xy.map(([x, y]) => x * c[0] + y * c[1]);
  const min = Math.min(...proj);
  const max = Math.max(...proj);
  const mid = offs.reduce((s, v) => s + v, 0) / offs.length;
  return { lat0, lon0, mLon, a, c, min, max, mid, length: max - min };
}

// along: metres from the start of segment 1; u: metres from the side-0 building line.
export function geoPoint(frame, align, width, along, u) {
  const rev = !!align?.reverse;
  const s = (align?.offset || 0) + along;
  const t = rev ? frame.max - s : frame.min + s;
  const k = frame.mid + (u - width / 2);
  const x = frame.a[0] * t + frame.c[0] * k;
  const y = frame.a[1] * t + frame.c[1] * k;
  return [frame.lat0 + y / M_LAT, frame.lon0 + x / frame.mLon];
}

function mercPx([lat, lon], z) {
  const n = 256 * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return [((lon + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
}

// Tiles to draw under a plan, each with the SVG transform that maps tile
// pixels into the plan's own coordinates. `toGeo(sx, sy)` returns
// [along, u] for a plan point; the plan region is [x0,x1]×[y0,y1].
export function tilesFor({ frame, align, width, base, zoom, toGeo, x0, x1, y0, y1 }) {
  const b = BASES[base];
  if (!b || !b.url || !frame) return [];
  const z = Math.min(zoom, b.maxZoom);
  const P = (sx, sy) => { const [al, u] = toGeo(sx, sy); return mercPx(geoPoint(frame, align, width, al, u), z); };
  const p0 = P(0, 0);
  const px = P(1, 0);
  const py = P(0, 1);
  const A = [[px[0] - p0[0], py[0] - p0[0]], [px[1] - p0[1], py[1] - p0[1]]];
  const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
  const Ai = [[A[1][1] / det, -A[0][1] / det], [-A[1][0] / det, A[0][0] / det]];
  const corners = [P(x0, y0), P(x1, y0), P(x0, y1), P(x1, y1)];
  const tx0 = Math.floor(Math.min(...corners.map((c) => c[0])) / 256);
  const tx1 = Math.floor(Math.max(...corners.map((c) => c[0])) / 256);
  const ty0 = Math.floor(Math.min(...corners.map((c) => c[1])) / 256);
  const ty1 = Math.floor(Math.max(...corners.map((c) => c[1])) / 256);
  if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 120) return [];
  // pixel coordinates are made relative to p0 to keep SVG numbers small
  const e = 0, f = 0;
  const m = `matrix(${Ai[0][0]},${Ai[1][0]},${Ai[0][1]},${Ai[1][1]},${e},${f})`;
  const out = [];
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      out.push({ key: `${base}-${z}-${tx}-${ty}`, href: b.url(z, tx, ty), x: tx * 256 - p0[0], y: ty * 256 - p0[1] });
    }
  }
  return { transform: m, tiles: out, attribution: b.attribution };
}
