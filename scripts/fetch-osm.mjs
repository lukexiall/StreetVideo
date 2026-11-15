// Downloads the OpenStreetMap geometry of the four study streets and writes
// it into src/data/osm-streets.json so the app does not need to query
// OpenStreetMap in the visitor's browser. Run before `npm run build`
// (the GitHub Pages workflow does this). Keeps the old file on failure.
import { writeFileSync } from 'node:fs';

const NAMES = { hindley: 'Hindley Street', gouger: 'Gouger Street', hutt: 'Hutt Street', melbourne: 'Melbourne Street' };
const BBOX = '-34.945,138.580,-34.895,138.625';
const q = `[out:json][timeout:60];way["highway"]["name"~"^(${Object.values(NAMES).join('|')})$"](${BBOX});out geom;`;
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

for (const url of ENDPOINTS) {
  try {
    const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'StreetTreeStudio/0.2 (github.com/lukexiall/StreetVideo)' }, signal: AbortSignal.timeout(90000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const out = {};
    for (const el of j.elements || []) {
      const id = Object.keys(NAMES).find((k) => NAMES[k] === el.tags?.name);
      if (id && el.geometry) (out[id] = out[id] || []).push(...el.geometry.map((p) => [+p.lat.toFixed(7), +p.lon.toFixed(7)]));
    }
    const missing = Object.keys(NAMES).filter((k) => !(out[k] && out[k].length >= 2));
    if (missing.length) throw new Error('missing ' + missing.join(', '));
    writeFileSync('src/data/osm-streets.json', JSON.stringify({ source: 'OpenStreetMap via Overpass API', fetched: new Date().toISOString(), points: out }));
    console.log('Wrote src/data/osm-streets.json from', url, Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
    process.exit(0);
  } catch (e) {
    console.warn('Overpass failed at', url, String(e));
  }
}
console.warn('Could not fetch OpenStreetMap geometry; the app will try in the browser instead.');
