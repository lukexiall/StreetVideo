// Species database – extracted from the thesis (Thesis_v18.docx).
//
// Sources (every value below is traceable to one of these):
//   T6.1  Table 6.1  climate suitability, shade coverage class, water demand, origin
//   C1    Appendix C1 survey information panels – leaf type
//   C2    Tables C2.1–C2.4 LMM fixed effects (reference species = Bottlebrushes)
//   C3.1  Table C3.1 EMMs for the overall perceptual score (mean of 4 dimensions)
//   T8.5  Table 8.5 public rating ("overall value") + climate score, 6 species
//   F6.4  Chapter 6 text describing the Figure 6.4 quadrants (70th percentile)
//
// NOT reported in the thesis text: mature height and crown spread per species
// (Table 6.3 says they exist in the attribute database, but the values are not
// reproduced). They stay `null`. The canvas therefore draws crowns from the
// thesis' shade-coverage class areas (see CROWN_CLASSES) – a modelling
// assumption that is labelled as such in the app.

export const SHADE_CLASSES = {
  Small: { label: 'Small', range: '≤ 80 m²', lower: 40, mid: 60, upper: 80 },
  Medium: { label: 'Medium', range: '80–200 m²', lower: 80, mid: 140, upper: 200 },
  Large: { label: 'Large', range: '≥ 200 m²', lower: 200, mid: 250, upper: 300 },
};
// Class bounds are from the Table 6.1 note. The representative areas
// (lower / mid / upper) inside each class – and the open upper value for
// Large – are app assumptions for drawing, not thesis data.

// LMM fixed effects (Tables C2.1–C2.4). The app derives a per-dimension species
// mean as intercept + coefficient. These are derived values, not EMMs printed in
// the thesis; their average differs from Table C3.1 by at most 0.017 because
// C3.1 comes from a separate model of the overall score.
const C2 = {
  attractiveness: { intercept: 3.173, 'Chinese Elm': 0.065, 'Claret Ash': 0.105, 'Coral Gum': -0.058, 'Crepe Myrtle': 0.031, 'European Hackberry': -0.101, 'Evergreen Ash': 0.019, 'Golden Rain Tree': 0.072, Jacaranda: 0.115, 'London Plane Tree': 0.118, 'Native Frangipani': 0.025, 'Ornamental Pears': 0.021, 'Queensland Brush Box': 0.007, 'Red Flowering Gum': -0.043, 'Red Ironbark': -0.067, 'River Red Gum': 0.031, 'South Australian Blue Gum': -0.201, Tuckeroo: -0.137, 'Western Australian Willow Myrtle': -0.17, 'White Cedar': -0.055, Bottlebrushes: 0 },
  comfort: { intercept: 3.074, 'Chinese Elm': 0.084, 'Claret Ash': 0.072, 'Coral Gum': 0.002, 'Crepe Myrtle': 0.031, 'European Hackberry': -0.065, 'Evergreen Ash': 0.041, 'Golden Rain Tree': 0.092, Jacaranda: 0.151, 'London Plane Tree': 0.125, 'Native Frangipani': 0.026, 'Ornamental Pears': 0.034, 'Queensland Brush Box': -0.043, 'Red Flowering Gum': -0.084, 'Red Ironbark': -0.065, 'River Red Gum': 0.086, 'South Australian Blue Gum': -0.103, Tuckeroo: -0.074, 'Western Australian Willow Myrtle': -0.079, 'White Cedar': -0.01, Bottlebrushes: 0 },
  safety: { intercept: 3.242, 'Chinese Elm': 0.022, 'Claret Ash': 0.07, 'Coral Gum': -0.038, 'Crepe Myrtle': 0.079, 'European Hackberry': -0.132, 'Evergreen Ash': 0.101, 'Golden Rain Tree': 0.079, Jacaranda: 0.129, 'London Plane Tree': 0.067, 'Native Frangipani': 0, 'Ornamental Pears': 0.096, 'Queensland Brush Box': -0.017, 'Red Flowering Gum': -0.003, 'Red Ironbark': -0.019, 'River Red Gum': 0.038, 'South Australian Blue Gum': -0.029, Tuckeroo: -0.103, 'Western Australian Willow Myrtle': -0.145, 'White Cedar': 0.122, Bottlebrushes: 0 },
  stay: { intercept: 3.177, 'Chinese Elm': 0.115, 'Claret Ash': 0.122, 'Coral Gum': 0.058, 'Crepe Myrtle': 0.12, 'European Hackberry': -0.07, 'Evergreen Ash': 0.084, 'Golden Rain Tree': 0.15, Jacaranda: 0.204, 'London Plane Tree': 0.189, 'Native Frangipani': 0.024, 'Ornamental Pears': 0.079, 'Queensland Brush Box': 0.055, 'Red Flowering Gum': 0.016, 'Red Ironbark': 0.062, 'River Red Gum': 0.079, 'South Australian Blue Gum': -0.106, Tuckeroo: -0.038, 'Western Australian Willow Myrtle': -0.07, 'White Cedar': 0.074, Bottlebrushes: 0 },
};
const emm = (dim, name) => Math.round((C2[dim].intercept + C2[dim][name]) * 1000) / 1000;

// Table C3.1 – overall perceptual score EMM (95% CI)
const C31 = {
  Bottlebrushes: [3.149, 3.055, 3.244], 'Chinese Elm': [3.232, 3.138, 3.327], 'Claret Ash': [3.253, 3.158, 3.347], 'Coral Gum': [3.149, 3.055, 3.243],
  'Crepe Myrtle': [3.224, 3.13, 3.318], 'European Hackberry': [3.059, 2.965, 3.153], 'Evergreen Ash': [3.221, 3.127, 3.315], 'Golden Rain Tree': [3.26, 3.166, 3.354],
  Jacaranda: [3.317, 3.223, 3.411], 'London Plane Tree': [3.283, 3.189, 3.377], 'Native Frangipani': [3.176, 3.081, 3.27], 'Ornamental Pears': [3.218, 3.124, 3.312],
  'Queensland Brush Box': [3.151, 3.057, 3.246], 'Red Flowering Gum': [3.129, 3.035, 3.223], 'Red Ironbark': [3.129, 3.035, 3.224], 'River Red Gum': [3.219, 3.125, 3.313],
  'South Australian Blue Gum': [3.043, 2.949, 3.137], Tuckeroo: [3.062, 2.968, 3.156], 'Western Australian Willow Myrtle': [3.036, 2.942, 3.13], 'White Cedar': [3.185, 3.091, 3.279],
};

// Table 8.5 (six design-scenario species)
const T85 = {
  'London Plane Tree': { sci: 'Platanus × acerifolia', rating: 3.29, climateScore: 18, designUse: 'Selective use where existing streetscape character is important', consideration: 'Lower climate score; use selectively' },
  Jacaranda: { sci: 'Jacaranda mimosifolia', rating: 3.28, climateScore: 27, designUse: 'Strong balanced option for dining, waiting, and staying areas', consideration: 'Requires adequate canopy space' },
  'Golden Rain Tree': { sci: 'Koelreuteria paniculata', rating: 3.24, climateScore: 23, designUse: 'Visual and experience-oriented option', consideration: 'Moderate climate score' },
  'Chinese Elm': { sci: 'Ulmus parvifolia', rating: 3.22, climateScore: 22, designUse: 'Flexible medium-canopy option', consideration: 'Moderate climate score' },
  'River Red Gum': { sci: 'Eucalyptus camaldulensis', rating: 3.2, climateScore: 28, designUse: 'Larger-canopy option for wider or open locations', consideration: 'Requires substantial space' },
  'Crepe Myrtle': { sci: 'Lagerstroemia indica', rating: 3.2, climateScore: 24, designUse: 'Smaller-scale option for more constrained locations', consideration: 'Provides less canopy than larger species' },
};

// Figure 6.4 quadrant membership, only where the Chapter 6 text names the species.
const QUADRANT = {
  Jacaranda: 'High preference × high climate suitability',
  'River Red Gum': 'High preference × high climate suitability',
  'Golden Rain Tree': 'High preference × lower climate suitability',
  'Claret Ash': 'High preference × lower climate suitability',
  'London Plane Tree': 'High preference × lower climate suitability',
  'White Cedar': 'High climate suitability, below preference threshold',
  'Coral Gum': 'High climate suitability, below preference threshold',
  Bottlebrushes: 'High climate suitability, below preference threshold',
  'South Australian Blue Gum': 'Low preference × low climate suitability',
  Tuckeroo: 'Low preference × low climate suitability',
};

// [id, name, climate, shade, water, origin, leaf (C1), drawing style, colour]
// Drawing style and colour are illustrative plan symbols, not data.
const T61 = [
  ['jacaranda', 'Jacaranda', 'High', 'Medium', 'Moderate', 'Exotic', 'Deciduous', 'feathery', '#8f86c9'],
  ['river-red-gum', 'River Red Gum', 'High', 'Large', 'Moderate', 'Native', 'Evergreen', 'eucalypt', '#7f9a72'],
  ['chinese-elm', 'Chinese Elm', 'Moderate', 'Medium', 'Moderate', 'Exotic', 'Deciduous', 'round', '#6a9a45'],
  ['london-plane', 'London Plane Tree', 'Low', 'Large', 'High', 'Exotic', 'Deciduous', 'round', '#5b8c3a'],
  ['white-cedar', 'White Cedar', 'High', 'Small', 'Moderate', 'Native', 'Evergreen', 'feathery', '#79a45a'],
  ['red-ironbark', 'Red Ironbark', 'Moderate', 'Medium', 'Moderate', 'Native', 'Evergreen', 'eucalypt', '#6f8b74'],
  ['bottlebrushes', 'Bottlebrushes', 'High', 'Small', 'Moderate', 'Native', 'Evergreen', 'weeping', '#5f8550'],
  ['tuckeroo', 'Tuckeroo', 'Low', 'Small', 'Low', 'Native', 'Evergreen', 'round', '#3f7444'],
  ['sa-blue-gum', 'South Australian Blue Gum', 'Moderate', 'Large', 'Low', 'Native', 'Evergreen', 'eucalypt', '#7d9a92'],
  ['european-hackberry', 'European Hackberry', 'Moderate', 'Small', 'Moderate', 'Exotic', 'Deciduous', 'round', '#719a4a'],
  ['crepe-myrtle', 'Crepe Myrtle', 'Moderate', 'Small', 'Moderate', 'Exotic', 'Deciduous', 'vase', '#c27a95'],
  ['coral-gum', 'Coral Gum', 'High', 'Medium', 'Moderate', 'Native', 'Evergreen', 'eucalypt', '#8fa07a'],
  ['wa-willow-myrtle', 'Western Australian Willow Myrtle', 'High', 'Medium', 'Low', 'Native', 'Evergreen', 'weeping', '#5d8a5c'],
  ['claret-ash', 'Claret Ash', 'Moderate', 'Medium', 'Moderate', 'Exotic', 'Deciduous', 'round', '#8e5c4c'],
  ['golden-rain-tree', 'Golden Rain Tree', 'Moderate', 'Medium', 'Moderate', 'Exotic', 'Deciduous', 'round', '#b4a23c'],
  ['qld-brush-box', 'Queensland Brush Box', 'Moderate', 'Large', 'Moderate', 'Native', 'Evergreen', 'round', '#4b7c3b'],
  ['red-flowering-gum', 'Red Flowering Gum', 'Low', 'Medium', 'Moderate', 'Native', 'Evergreen', 'eucalypt', '#9b6b5c'],
  ['evergreen-ash', 'Evergreen Ash', 'Low', 'Small', 'Moderate', 'Exotic', 'Deciduous', 'oval', '#6d9c55'],
  ['ornamental-pears', 'Ornamental Pears', 'Low', 'Medium', 'Moderate', 'Exotic', 'Deciduous', 'oval', '#7da552'],
  ['native-frangipani', 'Native Frangipani', 'Low', 'Medium', 'High', 'Native', 'Evergreen', 'oval', '#5a8f4e'],
];

// Discrepancies between Table 6.1 and the survey panels shown to participants (Appendix C1).
const NOTES = {
  'Coral Gum': 'Survey panel (C1) showed shade coverage "Small"; Table 6.1 lists Medium. App uses Table 6.1.',
  'Red Flowering Gum': 'Survey panel (C1) showed shade coverage "Small"; Table 6.1 lists Medium. App uses Table 6.1.',
  'Native Frangipani': 'Survey panel (C1) showed shade coverage "Small"; Table 6.1 lists Medium. App uses Table 6.1.',
  'River Red Gum': 'Table 8.5 public rating (3.20) is the article "overall value"; Table C3.1 EMM is 3.219 (see Ch. 6 note).',
  'Evergreen Ash': 'Leaf type shown to participants (C1) was "Deciduous", as recorded here.',
};

export const WATER_SCORE = { Low: 1, Moderate: 2, High: 3 };
export const CLIMATE_SCORE = { Low: 1, Moderate: 2, High: 3 };

export const SPECIES = T61.map(([id, name, climate, shade, water, origin, leaf, form, color], i) => ({
  id,
  thesisId: i + 1,
  name,
  sci: T85[name]?.sci ?? null,
  climate,
  shade,
  water,
  origin,
  leaf,
  form,
  color,
  heightM: null, // not reported in thesis text
  spreadM: null, // not reported in thesis text
  overall: C31[name][0],
  overallCI: [C31[name][1], C31[name][2]],
  attractiveness: emm('attractiveness', name),
  comfort: emm('comfort', name),
  safety: emm('safety', name),
  stay: emm('stay', name),
  publicRating: T85[name]?.rating ?? null,
  climateScore: T85[name]?.climateScore ?? null,
  designUse: T85[name]?.designUse ?? null,
  consideration: T85[name]?.consideration ?? null,
  quadrant: QUADRANT[name] ?? null,
  note: NOTES[name] ?? null,
}));

export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
export const SPECIES_BY_NAME = Object.fromEntries(SPECIES.map((s) => [s.name, s]));

export const RATING_RANGE = [3.036, 3.317]; // min / max of Table C3.1

export const FORMS = {
  round: 'Rounded',
  oval: 'Oval',
  vase: 'Vase',
  feathery: 'Fine, open foliage',
  eucalypt: 'Open, irregular',
  weeping: 'Weeping',
};

// ---- crown model (assumption, see header) ----
export function crownArea(sp, crownSize = 'mid') {
  return SHADE_CLASSES[sp.shade][crownSize];
}
export function crownDiameter(sp, crownSize = 'mid') {
  return 2 * Math.sqrt(crownArea(sp, crownSize) / Math.PI);
}
// 3D proportions used only by the GVI proxy: height = 0.9 × crown diameter + 2 m,
// crown base ≥ 2.5 m above the footpath.
export function modelHeight(sp, crownSize = 'mid') {
  return 0.9 * crownDiameter(sp, crownSize) + 2;
}
