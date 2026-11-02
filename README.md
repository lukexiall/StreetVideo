# StreetTree Studio

Interactive street-tree design tool for four Adelaide main streets (Hindley, Gouger, Hutt, Melbourne), built from the PhD thesis *Street trees and pedestrian lingering on Adelaide main streets* (Thesis_v18).

Open `dist/index.html` in a browser to run it. Rebuild after editing `src/` with:

```
npm install
npm run build
```

## Data provenance

| Data | Source in thesis |
|---|---|
| 20 species, climate suitability, shade class, water demand, origin | Table 6.1 |
| Leaf type | Appendix C1 survey information panels |
| Attractiveness, comfort, safety, willingness to stay | Derived: intercept + coefficient, Tables C2.1–C2.4 |
| Overall perceptual score (EMM, 95% CI) | Table C3.1 |
| Public rating, climate score, design use (6 species) | Table 8.5 |
| 100 segments: flow, warm-season GVI, 2022 canopy, PGPI, rank | Tables D.2, D.3 |
| Shortlist decision records | Table D.1 |
| GVI–duration reference curve | Table 5.4 |
| Street summaries, footpath width, H/W | Tables 8.2, 5.3 |

Not in the thesis text, so left blank or modelled: per-species mature height and crown spread (not shown as data); crown footprint drawn from the shade-class area range; lane/parking/median widths are demonstration geometry. Canopy and GVI in the designer are design estimates, not measurements.

## v0.2 additions

- **Whole street** view (Streets → Whole street): Existing / Minimal / Balanced / Maximum / My designs for all segments of a street, with trees added, mean canopy, mean GVI and segments reaching ~20% GVI, compared with Table 8.4 where the thesis has values (Hindley, Gouger). The layout rules are app rules (the thesis does not publish tree positions).
- **Decision path** for each segment: Right place (PGPI) → Role (LI) → Feasibility → Species, from Tables D.1–D.3.
- **GVI cross-check**: slope of warm-season GVI on 2022 canopy across the 100 segments of Table D.2 (≈ 0.31 GVI points per canopy %, R² ≈ 0.33), shown beside the 3D design estimate.
- **Summer / winter** toggle: deciduous species (leaf type, Appendix C1) drawn bare in winter (app assumption: 25% foliage density).
