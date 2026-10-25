// Study streets (Adelaide, South Australia).
//
// Thesis data used here:
//   Table 8.2  warm-season pedestrian records, staying ≥2 min, mean GVI, mean canopy
//   Table 5.3  mean footpath width and mean H/W ratio per street
//   Table D.2/D.3/D.1  per-segment data (see segments.js)
//   §8.2.1     street character descriptions, segment counts
//
// DEMONSTRATION GEOMETRY: the thesis does not report lane layouts or total
// reserve widths. Carriageway lanes, parking and medians below are an
// illustrative cross-section (flagged `demo`). Footpath widths use the thesis
// street means; building height = thesis mean H/W × demo reserve width.

import { SEGMENT_DATA } from './segments.js';

export const SEGMENT_LENGTH = 20;

const P = (kind, width, label) => ({ kind, width, label });

const RAW = [
  {
    id: 'hindley',
    name: 'Hindley Street',
    prefix: 'H',
    orientation: 'E–W',
    sides: ['North side', 'South side'],
    character: 'Entertainment and hospitality corridor with strong day–night activity.',
    records: 49361, stayShare: 6.2, meanGvi: 4.5, meanCanopy: 0.5,
    footpath: 4.38, hw: 0.87,
    lanes: [P('parking', 2.3, 'Parking'), P('lane', 3.2, 'Traffic lane'), P('lane', 3.2, 'Traffic lane'), P('parking', 2.3, 'Parking')],
  },
  {
    id: 'gouger',
    name: 'Gouger Street',
    prefix: 'G',
    orientation: 'E–W',
    sides: ['North side', 'South side'],
    character: 'Major dining, retail, Chinatown and Central Market corridor.',
    records: 23839, stayShare: 21.6, meanGvi: 8.2, meanCanopy: 14.5,
    footpath: 4.6, hw: 0.58,
    lanes: [P('parking', 5.5, 'Angle parking'), P('lane', 3.5, 'Traffic lane'), P('lane', 3.5, 'Traffic lane'), P('median', 3, 'Median'), P('lane', 3.5, 'Traffic lane'), P('lane', 3.5, 'Traffic lane'), P('parking', 5.5, 'Angle parking')],
  },
  {
    id: 'hutt',
    name: 'Hutt Street',
    prefix: 'Ht',
    orientation: 'N–S',
    sides: ['West side', 'East side'],
    character: 'Village-like mix of cafés, restaurants, shops and community services.',
    records: 11099, stayShare: 45.5, meanGvi: 22.4, meanCanopy: 32.9,
    footpath: 5.62, hw: 0.34,
    lanes: [P('parking', 2.5, 'Parking'), P('lane', 3.5, 'Traffic lane'), P('lane', 3.5, 'Traffic lane'), P('median', 11, 'Central median'), P('lane', 3.5, 'Traffic lane'), P('lane', 3.5, 'Traffic lane'), P('parking', 2.5, 'Parking')],
  },
  {
    id: 'melbourne',
    name: 'Melbourne Street',
    prefix: 'M',
    orientation: 'E–W',
    sides: ['North side', 'South side'],
    character: 'Professional and education uses to the west; restaurants and leisure to the east.',
    records: 8856, stayShare: 37.7, meanGvi: 14.2, meanCanopy: 8.6,
    footpath: 4.42, hw: 0.46,
    lanes: [P('parking', 2.2, 'Parking'), P('lane', 3.4, 'Traffic lane'), P('lane', 3.4, 'Traffic lane'), P('parking', 2.2, 'Parking')],
  },
];

export const STREETS = RAW.map((s) => {
  const profile = [P('footpath', s.footpath, 'Footpath'), ...s.lanes, P('footpath', s.footpath, 'Footpath')];
  const width = profile.reduce((a, p) => a + p.width, 0);
  const segments = SEGMENT_DATA.filter((d) => d.street === s.id).map((d, i) => ({ ...d, id: d.seg, index: i + 1 }));
  return { ...s, profile, width, buildingHeight: Math.round(s.hw * width * 10) / 10, segments };
});

export const STREET_BY_ID = Object.fromEntries(STREETS.map((s) => [s.id, s]));

export function zonesFor(street) {
  let u = 0;
  return street.profile.map((p, i) => {
    const z = { ...p, i, u0: u, u1: u + p.width };
    u += p.width;
    return z;
  });
}
