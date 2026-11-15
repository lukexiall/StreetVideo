import { SPECIES, SPECIES_BY_ID, crownDiameter } from '../data/species.js';
import { SEGMENT_LENGTH, zonesFor } from '../data/streets.js';
import { SCENARIOS, GVI_REFERENCE, THESIS_T84, corridorScenario } from '../lib/corridor.js';
import { Icon, fmt } from './ui.jsx';
import { BaseTiles, BaseControls, Attribution } from './BaseMap.jsx';
import { gviCanopyFit } from '../lib/metrics.js';
import { SEGMENT_DATA } from '../data/segments.js';

const FIT = gviCanopyFit(SEGMENT_DATA);

const { useState, useMemo } = React;

// Long plan of the whole street: every segment side by side, trees as circles.
function CorridorPlan({ street, result, crownSize, selected, onPick, mapBase, frame, align, onTileFail }) {
  const W = street.width;
  const L = street.segments.length * SEGMENT_LENGTH;
  const zones = zonesFor(street);
  return (
    <div className={`cp-wrap ${mapBase !== 'drawing' ? 'has-base' : ''}`}>
      <svg viewBox={`-2 -6 ${L + 4} ${W + 8}`} className="cp" role="img" aria-label={`Plan of ${street.name} with the selected scenario`}>
        <BaseTiles frame={frame} align={align} width={W} base={mapBase} zoom={19} toGeo={(sx, sy) => [sx, sy]} x0={-4} x1={L + 4} y0={-10} y1={W + 6} onFail={onTileFail} />
        {zones.map((z) => <rect key={z.i} x={0} y={z.u0} width={L} height={z.width} className={`pl-${z.kind}`} />)}
        {result.rows.map((r, i) => (
          <g key={r.seg.id} className={`cp-seg ${r.seg.shortlist ? 'is-short' : ''} ${selected === r.seg.id ? 'is-sel' : ''}`} onClick={() => onPick(r.seg.id)}>
            <rect x={i * SEGMENT_LENGTH} y={-0.2} width={SEGMENT_LENGTH} height={W + 0.4} className="cp-hit" />
            <line x1={i * SEGMENT_LENGTH} x2={i * SEGMENT_LENGTH} y1={0} y2={W} className="cp-div" />
            <text x={i * SEGMENT_LENGTH + SEGMENT_LENGTH / 2} y={-1.6} textAnchor="middle" className="cp-id">{r.seg.id}</text>
            {r.seg.shortlist && <circle cx={i * SEGMENT_LENGTH + SEGMENT_LENGTH / 2} cy={-4} r={0.9} className="cp-star" />}
            {r.trees.map((t) => {
              const sp = SPECIES_BY_ID[t.speciesId];
              return <circle key={t.id} cx={i * SEGMENT_LENGTH + t.v} cy={t.u} r={crownDiameter(sp, crownSize) / 2} fill={sp.color} className="cp-tree" />;
            })}
          </g>
        ))}
      </svg>
      <Attribution base={mapBase} />
    </div>
  );
}

// GVI per segment: measured (blue) + added by the scenario (ochre), 20% reference line.
function GviBars({ result, selected, onPick }) {
  const n = result.rows.length;
  const H = 120, top = 8, bottom = 18, max = 45;
  const y = (v) => top + (1 - Math.min(v, max) / max) * (H - top - bottom);
  const bw = 100 / n;
  return (
    <div className="gb">
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="gb-svg" role="img" aria-label="GVI per segment, measured plus scenario">
        {[0, 10, 20, 30, 40].map((g) => <line key={g} x1={0} x2={100} y1={y(g)} y2={y(g)} className={g === GVI_REFERENCE ? 'gb-ref' : 'gb-grid'} vectorEffect="non-scaling-stroke" />)}
        {result.rows.map((r, i) => (
          <g key={r.seg.id} onClick={() => onPick(r.seg.id)} className={`gb-col ${selected === r.seg.id ? 'is-sel' : ''}`}>
            <rect x={i * bw} y={0} width={bw} height={H} className="gb-hit" />
            <rect x={i * bw + bw * 0.15} y={y(r.seg.gvi)} width={bw * 0.7} height={y(0) - y(r.seg.gvi)} className="gb-exist" />
            {r.addedGvi > 0.05 && <rect x={i * bw + bw * 0.15} y={y(r.gvi)} width={bw * 0.7} height={y(r.seg.gvi) - y(r.gvi)} className="gb-add" />}
          </g>
        ))}
      </svg>
      <div className="gb-axis"><span>40%</span><span>20% reference</span><span>0</span></div>
    </div>
  );
}

export function Corridor({ street, crownSize, designs, onOpenSegment, onAdopt, mapProps }) {
  const [failed, setFailed] = useState(false);
  const frame = mapProps.geo.frames[street.id];
  const mapBase = frame && mapProps.base !== 'drawing' ? mapProps.base : 'drawing';
  const [mode, setMode] = useState('balanced');
  const [fallbackId, setFallbackId] = useState('chinese-elm');
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const result = useMemo(() => corridorScenario(street, mode, { fallbackId, crownSize, myDesigns: designs }), [street, mode, fallbackId, crownSize, designs]);
  const t84 = THESIS_T84[street.id];
  const sel = result.rows.find((r) => r.seg.id === selected);
  const scen = SCENARIOS.find((s) => s.id === mode);

  return (
    <div className="corridor">
      <div className="cor-controls">
        <div className="target-chips cor-modes" role="radiogroup" aria-label="Scenario">
          {SCENARIOS.map((s) => (
            <button key={s.id} role="radio" aria-checked={mode === s.id} className={mode === s.id ? 'is-on' : ''} onClick={() => { setMode(s.id); setConfirm(false); }}>{s.label}</button>
          ))}
        </div>
        <p className="fine">{scen.note}.{mode !== 'existing' && mode !== 'mine' ? ' Top-20 segments use the thesis species; other segments use the species below.' : ''}</p>
        {mode !== 'existing' && mode !== 'mine' && (
          <label className="field-inline">
            <span>Species for other segments</span>
            <select id="cor-species" value={fallbackId} onChange={(e) => setFallbackId(e.target.value)}>
              {SPECIES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="cor-stats">
        <div><span>Trees added</span><b>{result.trees}</b>{t84 && mode in t84 && <small>Thesis: +{t84[mode][0]}</small>}</div>
        <div><span>Canopy cover</span><b>{fmt(result.canopy)}%</b><small>Today {fmt(result.existingCanopy)}%{t84 && mode in t84 ? ` · thesis ${t84[mode][1]}%` : ''}</small></div>
        <div><span>Mean GVI ≈</span><b>{fmt(result.gvi)}%</b><small>Today {fmt(result.existingGvi)}% · data cross-check ≈ {fmt(result.existingGvi + FIT.slope * (result.canopy - result.existingCanopy))}%</small></div>
        <div><span>Segments ≥ 20% GVI</span><b>{result.reaching} / {result.rows.length}</b><small>Today {street.segments.filter((s) => s.gvi >= GVI_REFERENCE).length}</small></div>
      </div>

      <BaseControls street={street} base={mapProps.base} setBase={mapProps.setBase} align={mapProps.aligns[street.id]} setAlign={(a) => mapProps.setAlign(street.id, a)} geo={mapProps.geo} failed={failed} />
      <CorridorPlan street={street} result={result} crownSize={crownSize} selected={selected} onPick={setSelected} mapBase={mapBase} frame={frame} align={mapProps.aligns[street.id]} onTileFail={() => setFailed(true)} />
      <GviBars result={result} selected={selected} onPick={setSelected} />
      <p className="legend-line"><i className="dot dot-thesis" />Measured GVI <i className="dot dot-est" />Added by this scenario (design estimate) <i className="cp-star-key" />Top-20 priority segment · Click any segment for details</p>

      {sel && (
        <div className="panel cor-sel">
          <div className="seg-panel-head">
            <h3>Segment {sel.seg.id}</h3>
            <button className="btn btn-primary btn-sm" onClick={() => onOpenSegment(sel.seg.id, mode === 'existing' ? null : sel.trees)}>
              Open in designer <Icon name="arrow" size={14} />
            </button>
          </div>
          <p className="fine">
            {sel.trees.length} {sel.trees.length === 1 ? 'tree' : 'trees'}{sel.trees.length ? ` (${[...new Set(sel.trees.map((t) => SPECIES_BY_ID[t.speciesId].name))].join(', ')})` : ''} · GVI {sel.seg.gvi}% → ≈ {fmt(sel.gvi)}% · canopy {sel.seg.canopy}% → {fmt(sel.canopy)}%
            {mode !== 'existing' && mode !== 'mine' ? ' · opening replaces your drawing for this segment' : ''}
          </p>
        </div>
      )}

      {mode !== 'existing' && mode !== 'mine' && result.trees > 0 && (
        <div className="cor-adopt">
          <button className={`btn ${confirm ? 'btn-danger' : ''}`} onClick={() => { if (!confirm) { setConfirm(true); return; } onAdopt(result.rows); setConfirm(false); }}>
            {confirm ? `Confirm: replace my designs on all ${result.rows.length} segments` : `Use the ${scen.label} layout as my starting designs`}
          </button>
          {confirm && <button className="btn btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>}
        </div>
      )}

      <details className="fold">
        <summary>How these scenarios compare with the thesis</summary>
        {t84 ? (
          <table className="data">
            <thead><tr><th>Thesis scenario (Table 8.4)</th><th>Trees added</th><th>Canopy</th><th>Illustrative GVI</th></tr></thead>
            <tbody>
              {['existing', 'minimal', 'balanced', 'maximum'].map((k) => (
                <tr key={k} className={k === mode ? 'is-cur' : ''}><td>{SCENARIOS.find((s) => s.id === k).label}</td><td className="num">+{t84[k][0]}</td><td className="num">{t84[k][1]}%</td><td className="num">{t84[k][2]}%</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p className="fine">The thesis designed corridor scenarios for Hindley and Gouger only; no segment on {street.name} entered the top-20 priority list, so Minimal adds no trees here.</p>}
        <p className="fine">The thesis does not publish its tree positions, so the app rebuilds each scenario with simple rules: Minimal puts one tree in each top-20 segment; Balanced puts one tree in every segment still below ~20% GVI; Maximum spaces trees one crown diameter apart on both footpaths and leaves out the share of positions already covered by existing canopy. Added GVI in this view counts new trees in the segment and in the two segments either side, because along-street views see them. Site constraints such as entrances, loading zones and crossings are not modelled, so check each segment in the designer. Corridor canopy here is the mean of segment values, adding new crowns to the 2022 canopy without removing overlap, so it is an upper bound. The thesis treats ~20% GVI as a scenario reference, not a design target (§8.2.6). The thesis GVI column is a render-based value for the displayed views only, not a street-wide mean, so it is expected to be higher than the street means here. The data cross-check applies the slope of GVI on canopy across the 100 thesis segments (≈ {fmt(FIT.slope, 2)} GVI points per canopy %, R² {fmt(FIT.r2, 2)}) to the canopy change.</p>
      </details>
    </div>
  );
}
