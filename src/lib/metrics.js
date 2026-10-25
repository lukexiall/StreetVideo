import { crownDiameter, modelHeight, WATER_SCORE, CLIMATE_SCORE } from '../data/species.js';
import { SEGMENT_LENGTH, zonesFor } from '../data/streets.js';

// ---- model assumptions (shown in the app's "Method" panel) ----
export const EYE_HEIGHT = 1.6; // §8.2.2: camera at ~1.6 m
export const VIEW_FOV = 90; // §8.2.2: four 90° horizontal views; vertical FOV assumed 90°
export const FOLIAGE_DENSITY = 0.8; // app assumption
const TRUNK_R = 0.15;

export function treeGeom(tree, sp, crownSize) {
  const d = crownDiameter(sp, crownSize);
  const H = modelHeight(sp, crownSize);
  const base = Math.max(2.5, H * 0.35);
  const a = (H - base) / 2;
  return { id: tree.id, u: tree.u, v: tree.v, r: d / 2, a, cz: base + a, base, H, sp, color: sp.color };
}

function geoms(trees, speciesById, crownSize) {
  return trees.filter((t) => speciesById[t.speciesId]).map((t) => treeGeom(t, speciesById[t.speciesId], crownSize));
}

// ---------- placement rules (app rules, not thesis criteria) ----------
export function zoneAt(street, u) {
  return zonesFor(street).find((z) => u >= z.u0 && u <= z.u1) || null;
}

export function checkPlacement(street, u, v, trees, ignoreId, sp, crownSize) {
  if (v < 0.3 || v > SEGMENT_LENGTH - 0.3 || u < 0.3 || u > street.width - 0.3) return { ok: false, reason: 'Outside the 20 m segment' };
  const zone = zoneAt(street, u);
  if (!zone) return { ok: false, reason: 'Outside the street reserve' };
  if (zone.kind === 'lane') return { ok: false, reason: 'Trees cannot go in a traffic lane' };
  const warnings = [];
  if (zone.kind === 'parking') warnings.push('Kerb build-out: removes on-street parking');
  if (zone.kind === 'footpath') {
    const clear = Math.max(zone.u1 - u, u - zone.u0) - 0.6;
    if (clear < 1.8) warnings.push('Less than 1.8 m clear walkway beside the tree pit');
  }
  if (sp) {
    const r = crownDiameter(sp, crownSize) / 2;
    if (u - r < 0 || u + r > street.width) warnings.push('Crown reaches the building façade');
  }
  for (const t of trees) {
    if (t.id === ignoreId) continue;
    const dd = Math.hypot(t.u - u, t.v - v);
    if (dd < 1.5) return { ok: false, reason: 'Too close to another tree' };
    if (dd < 4) warnings.push('Trunks closer than 4 m');
  }
  return { ok: true, zone, warnings: [...new Set(warnings)] };
}

// ---------- canopy (plan projection, overlap counted once) ----------
export function canopyCover(street, trees, speciesById, crownSize, cell = 0.2) {
  const W = street.width;
  const L = SEGMENT_LENGTH;
  const siteArea = W * L;
  const g = geoms(trees, speciesById, crownSize);
  if (!g.length) return { pct: 0, area: 0, siteArea, crownSum: 0, overlap: 0 };
  const nu = Math.floor(W / cell);
  const nv = Math.floor(L / cell);
  const cu = W / nu;
  const cv = L / nv;
  let covered = 0;
  let hits = 0;
  for (let i = 0; i < nu; i++) {
    const u = (i + 0.5) * cu;
    for (let j = 0; j < nv; j++) {
      const v = (j + 0.5) * cv;
      let k = 0;
      for (const c of g) {
        const du = u - c.u;
        const dv = v - c.v;
        if (du * du + dv * dv <= c.r * c.r) k++;
      }
      if (k) covered++;
      hits += k;
    }
  }
  const area = covered * cu * cv;
  const crownSum = hits * cu * cv;
  return { pct: (area / siteArea) * 100, area, siteArea, crownSum, overlap: crownSum - area };
}

// ---------- ray helpers ----------
function rayCrown(ex, ey, ez, dx, dy, dz, c) {
  const ox = (ex - c.u) / c.r, oy = (ey - c.v) / c.r, oz = (ez - c.cz) / c.a;
  const qx = dx / c.r, qy = dy / c.r, qz = dz / c.a;
  const A = qx * qx + qy * qy + qz * qz;
  const B = 2 * (ox * qx + oy * qy + oz * qz);
  const C = ox * ox + oy * oy + oz * oz - 1;
  if (C < 0) return 0;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return -1;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t > 0 ? t : -1;
}
function rayTrunk(ex, ey, ez, dx, dy, dz, c) {
  const ox = ex - c.u, oy = ey - c.v;
  const A = dx * dx + dy * dy;
  if (A < 1e-9) return -1;
  const B = 2 * (ox * dx + oy * dy);
  const C = ox * ox + oy * oy - TRUNK_R * TRUNK_R;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return -1;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  if (t <= 0) return -1;
  const z = ez + dz * t;
  return z >= 0 && z <= c.base + 0.4 ? t : -1;
}
function mix(a, b, k) {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}
function hash(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function viewpointFor(street, side) {
  const fps = zonesFor(street).filter((z) => z.kind === 'footpath');
  const fp = fps[side] || fps[0];
  return { u: (fp.u0 + fp.u1) / 2, v: SEGMENT_LENGTH / 2, side };
}

// Headings: 0 = along street (+v), 90 = towards u = W, 180 = −v, 270 = towards u = 0
export const HEADINGS = [
  { deg: 0, label: '0° along ↓' },
  { deg: 90, label: '90° across →' },
  { deg: 180, label: '180° along ↑' },
  { deg: 270, label: '270° across ←' },
];

// Ray-casts one 90° view. Returns the foliage share (%) and, if ctx is given,
// paints a schematic eye-level image.
export function castView(street, g, vp, headingDeg, size, ctx, palette) {
  const W = street.width;
  const bh = street.buildingHeight;
  const zones = palette ? zonesFor(street) : null;
  const h = (headingDeg * Math.PI) / 180;
  const fwdU = Math.sin(h), fwdV = Math.cos(h);
  const rightU = Math.cos(h), rightV = -Math.sin(h);
  const f = size / 2 / Math.tan(((VIEW_FOV / 2) * Math.PI) / 180);
  const img = ctx ? ctx.createImageData(size, size) : null;
  const L = [0.4, -0.3, 0.86];
  let laneLines = [];
  if (zones) {
    const lanes = zones.filter((z) => z.kind === 'lane');
    for (let i = 0; i < lanes.length - 1; i++) if (Math.abs(lanes[i].u1 - lanes[i + 1].u0) < 1e-6) laneLines.push(lanes[i].u1);
  }
  let green = 0;
  for (let y = 0; y < size; y++) {
    const cy = -(y + 0.5 - size / 2) / f;
    for (let x = 0; x < size; x++) {
      const cx = (x + 0.5 - size / 2) / f;
      let du = fwdU + cx * rightU, dv = fwdV + cx * rightV, dz = cy;
      const len = Math.hypot(du, dv, dz);
      du /= len; dv /= len; dz /= len;
      let tObs = Infinity;
      let kind = 'sky';
      if (dz < 0) { tObs = -EYE_HEIGHT / dz; kind = 'ground'; }
      if (du < -1e-9) {
        const tb = -vp.u / du;
        if (EYE_HEIGHT + dz * tb < bh && tb < tObs) { tObs = tb; kind = 'bldA'; }
      } else if (du > 1e-9) {
        const tb = (W - vp.u) / du;
        if (EYE_HEIGHT + dz * tb < bh && tb < tObs) { tObs = tb; kind = 'bldB'; }
      }
      for (const c of g) {
        const tt = rayTrunk(vp.u, vp.v, EYE_HEIGHT, du, dv, dz, c);
        if (tt > 0 && tt < tObs) { tObs = tt; kind = 'trunk'; }
      }
      const hits = [];
      for (const c of g) {
        const t = rayCrown(vp.u, vp.v, EYE_HEIGHT, du, dv, dz, c);
        if (t >= 0 && t < tObs) hits.push([t, c]);
      }
      green += 1 - Math.pow(1 - FOLIAGE_DENSITY, hits.length);
      if (!img) continue;
      let col;
      if (kind === 'sky') col = mix(palette.skyLow, palette.skyHigh, Math.min(1, Math.max(0, dz * 1.5)));
      else if (kind === 'ground') {
        const gu = vp.u + du * tObs, gv = vp.v + dv * tObs;
        const z = zones.find((zz) => gu >= zz.u0 && gu <= zz.u1);
        col = z ? palette[z.kind] : palette.footpath;
        if (z && z.kind === 'lane') for (const lu of laneLines) if (Math.abs(gu - lu) < 0.08 && ((gv % 6) + 6) % 6 < 3) col = palette.marking;
        if (z && z.kind !== 'lane' && (Math.abs(gu - z.u0) < 0.15 || Math.abs(gu - z.u1) < 0.15)) col = palette.kerb;
        col = mix(col, palette.skyLow, Math.min(1, tObs / 150) * 0.7);
      } else if (kind === 'trunk') col = palette.trunk;
      else {
        const bz = EYE_HEIGHT + dz * tObs, bv = vp.v + dv * tObs;
        const floor = ((bz % 3.4) + 3.4) % 3.4, bay = ((bv % 4) + 4) % 4;
        const win = bz > 3.6 && floor > 1.0 && floor < 2.6 && bay > 0.8 && bay < 3.2;
        const shop = bz < 3.2 && bz > 0.3 && bay > 0.4 && bay < 3.6;
        col = win ? palette.window : shop ? palette.shop : kind === 'bldA' ? palette.bldA : palette.bldB;
        if (bz > bh - 0.4) col = palette.parapet;
        col = mix(col, palette.skyLow, Math.min(1, tObs / 150) * 0.7);
      }
      if (hits.length) {
        hits.sort((p, q) => q[0] - p[0]);
        for (const [t, c] of hits) {
          const px = vp.u + du * t, py = vp.v + dv * t, pz = EYE_HEIGHT + dz * t;
          const nx = (px - c.u) / (c.r * c.r), ny = (py - c.v) / (c.r * c.r), nz = (pz - c.cz) / (c.a * c.a);
          const nl = Math.hypot(nx, ny, nz) || 1;
          const lam = Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / nl);
          const n = hash(Math.floor(px * 2.5), Math.floor(py * 2.5), Math.floor(pz * 2.5));
          const shade = 0.55 + 0.55 * lam + (n - 0.5) * 0.3;
          const rgb = c.rgb || (c.rgb = hexRgb(c.color));
          col = mix(col, rgb.map((v) => Math.min(255, v * shade)), FOLIAGE_DENSITY + (n - 0.5) * 0.2);
        }
      }
      const o = (y * size + x) * 4;
      img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
    }
  }
  if (ctx) ctx.putImageData(img, 0, 0);
  return (green / (size * size)) * 100;
}

// Four-view GVI proxy for the trees in the design (mirrors the §8.2.2 protocol:
// one point, four 90° views, mean of the four).
export function gviProxy(street, trees, speciesById, crownSize, side = 0, size = 44) {
  const g = geoms(trees, speciesById, crownSize);
  if (!g.length) return { pct: 0, views: [0, 0, 0, 0] };
  const vp = viewpointFor(street, side);
  const views = HEADINGS.map((hd) => castView(street, g, vp, hd.deg, size));
  return { pct: views.reduce((a, b) => a + b, 0) / 4, views };
}

export function renderViews(street, trees, speciesById, crownSize, side, canvases, palette, size) {
  const g = geoms(trees, speciesById, crownSize);
  const vp = viewpointFor(street, side);
  return HEADINGS.map((hd, i) => {
    const cv = canvases[i];
    if (!cv) return 0;
    return castView(street, g, vp, hd.deg, size, cv.getContext('2d'), palette);
  });
}

// ---------- attribute summaries ----------
export function attributeSummary(trees, speciesById) {
  const sps = trees.map((t) => speciesById[t.speciesId]).filter(Boolean);
  const n = sps.length;
  const count = (key, cats) => Object.fromEntries(cats.map((c) => [c, sps.filter((s) => s[key] === c).length]));
  const mean = (key) => (n ? sps.reduce((a, s) => a + s[key], 0) / n : null);
  const meanOf = (map, key) => (n ? sps.reduce((a, s) => a + map[s[key]], 0) / n : null);
  const rated = sps.filter((s) => s.publicRating !== null);
  return {
    n,
    water: count('water', ['Low', 'Moderate', 'High']),
    waterMean: meanOf(WATER_SCORE, 'water'),
    climate: count('climate', ['High', 'Moderate', 'Low']),
    climateMean: meanOf(CLIMATE_SCORE, 'climate'),
    origin: count('origin', ['Native', 'Exotic']),
    overall: mean('overall'),
    attractiveness: mean('attractiveness'),
    comfort: mean('comfort'),
    safety: mean('safety'),
    stay: mean('stay'),
    publicRatingN: rated.length,
    species: [...new Set(sps.map((s) => s.name))],
  };
}

export const levelLabel = (m) => (m === null ? '—' : m < 1.5 ? 'Low' : m < 2.5 ? 'Moderate' : 'High');

// ---------- Table 5.4 reference curve ----------
export const DURATION_CURVE = [
  { gvi: 5, median: 17.5, lo: 16.0, hi: 19.1 },
  { gvi: 10, median: 18.7, lo: 17.2, hi: 20.3 },
  { gvi: 15, median: 19.9, lo: 18.3, hi: 21.7 },
  { gvi: 20, median: 20.7, lo: 18.9, hi: 22.7 },
  { gvi: 25, median: 20.6, lo: 18.4, hi: 23.0 },
  { gvi: 30, median: 20.1, lo: 17.3, hi: 23.3 },
];

// ---------- scenario search ----------
export function rowsFor(street, layout) {
  const zones = zonesFor(street);
  const fps = zones.filter((z) => z.kind === 'footpath');
  const rows = [];
  fps.forEach((fp, side) => {
    if (layout === 'one' && side === 1) return;
    rows.push(side === 0 ? fp.u1 - 1.0 : fp.u0 + 1.0);
  });
  if (layout === 'all') zones.filter((z) => z.kind === 'median').forEach((m) => rows.push((m.u0 + m.u1) / 2));
  return rows;
}

export function minSpacing(sp, crownSize) {
  return Math.max(4, 0.5 * crownDiameter(sp, crownSize));
}

export function layoutTrees(street, sp, layout, perRow, crownSize) {
  const trees = [];
  rowsFor(street, layout).forEach((u, ri) => {
    for (let i = 0; i < perRow; i++) {
      const v = ((i + 0.5) * SEGMENT_LENGTH) / perRow;
      trees.push({ id: `auto-${ri}-${i}-${Math.random().toString(36).slice(2, 7)}`, speciesId: sp.id, u: Math.round(u * 10) / 10, v: Math.round(v * 10) / 10 });
    }
  });
  return trees;
}

export function scenarioFor(street, existingGvi, sp, layout, target, crownSize, side) {
  const map = { [sp.id]: sp };
  if (existingGvi >= target) return { trees: [], n: 0, perRow: 0, added: 0, total: existingGvi, reached: true, already: true, canopy: 0 };
  const maxPerRow = Math.max(1, Math.floor(SEGMENT_LENGTH / minSpacing(sp, crownSize)));
  let best = null;
  for (let n = 1; n <= maxPerRow; n++) {
    const trees = layoutTrees(street, sp, layout, n, crownSize);
    const added = gviProxy(street, trees, map, crownSize, side, 36).pct;
    const total = Math.min(100, existingGvi + added);
    const res = { trees, n: trees.length, perRow: n, added, total, reached: total >= target };
    best = res;
    if (res.reached) break;
  }
  best.canopy = canopyCover(street, best.trees, map, crownSize, 0.4).pct;
  return best;
}
