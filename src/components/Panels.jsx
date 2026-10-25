import { SPECIES, SPECIES_BY_ID, SHADE_CLASSES, RATING_RANGE, crownDiameter } from '../data/species.js';
import { HEADINGS, DURATION_CURVE, levelLabel, scenarioFor, renderViews, FOLIAGE_DENSITY, EYE_HEIGHT, VIEW_FOV, minSpacing } from '../lib/metrics.js';
import { Src, Chip, Icon, fmt } from './ui.jsx';

const { useRef, useEffect, useState, useMemo } = React;

export const RENDER_PALETTE = {
  skyLow: [214, 226, 232], skyHigh: [150, 186, 214],
  footpath: [206, 198, 182], parking: [120, 124, 126], lane: [92, 96, 99], median: [150, 168, 128],
  marking: [235, 235, 228], kerb: [178, 176, 168], bldA: [190, 168, 146], bldB: [172, 160, 150],
  window: [96, 112, 124], shop: [70, 82, 90], parapet: [150, 132, 116], trunk: [92, 74, 58],
};

// Table 5.4 reference curve with the existing and design GVI marked.
function DurationChart({ existing, total }) {
  const [hover, setHover] = useState(null);
  const Wd = 300, Ht = 132, pl = 30, pr = 10, pt = 10, pb = 24;
  const x = (g) => pl + ((g - 0) / 35) * (Wd - pl - pr);
  const y = (s) => pt + (1 - (s - 15) / 9) * (Ht - pt - pb);
  const line = DURATION_CURVE.map((d, i) => `${i ? 'L' : 'M'}${x(d.gvi)},${y(d.median)}`).join('');
  const band = DURATION_CURVE.map((d, i) => `${i ? 'L' : 'M'}${x(d.gvi)},${y(d.hi)}`).join('') + DURATION_CURVE.slice().reverse().map((d) => `L${x(d.gvi)},${y(d.lo)}`).join('') + 'Z';
  const mark = (g, cls, lbl) => (g === null ? null : (
    <g className={cls}>
      <line x1={x(Math.min(35, g))} x2={x(Math.min(35, g))} y1={pt} y2={Ht - pb} />
      <text x={x(Math.min(35, g)) + 3} y={pt + 8}>{lbl}</text>
    </g>
  ));
  return (
    <figure className="dchart">
      <svg viewBox={`0 0 ${Wd} ${Ht}`} role="img" aria-label="Adjusted median segment duration by GVI, thesis Table 5.4">
        {[16, 18, 20, 22, 24].map((s) => (
          <g key={s} className="dc-grid"><line x1={pl} x2={Wd - pr} y1={y(s)} y2={y(s)} /><text x={pl - 5} y={y(s) + 3} textAnchor="end">{s}s</text></g>
        ))}
        {[0, 5, 10, 15, 20, 25, 30, 35].map((g) => (<text key={g} className="dc-axis" x={x(g)} y={Ht - 8} textAnchor="middle">{g}%</text>))}
        <path d={band} className="dc-band" />
        <path d={line} className="dc-line" />
        {mark(existing, 'dc-exist', 'existing')}
        {mark(total, 'dc-design', 'design')}
        {DURATION_CURVE.map((d) => (
          <g key={d.gvi} onMouseEnter={() => setHover(d)} onMouseLeave={() => setHover(null)}>
            <circle cx={x(d.gvi)} cy={y(d.median)} r={4} className="dc-pt" />
            <circle cx={x(d.gvi)} cy={y(d.median)} r={11} fill="transparent" />
          </g>
        ))}
        {hover && (
          <g className="dc-tip" transform={`translate(${Math.min(x(hover.gvi) + 8, Wd - 112)},${y(hover.median) + 8})`}>
            <rect width="104" height="30" rx="4" />
            <text x="6" y="12">GVI {hover.gvi}%: {hover.median} s</text>
            <text x="6" y="24" className="dc-tip-sub">95% CI {hover.lo}–{hover.hi} s</text>
          </g>
        )}
      </svg>
      <figcaption>Adjusted median time in a 20 m segment at GVI display points (Table 5.4, line with 95% CI band). Context only: the thesis model was not run on this design.</figcaption>
    </figure>
  );
}

function Row({ label, value, unit, note, kind, bar, barCls }) {
  return (
    <div className="res-row">
      <div className="res-top">
        <span className="res-label"><i className={`dot dot-${kind}`} />{label}</span>
        <span className="res-value">{value}{unit && <small>{unit}</small>}</span>
      </div>
      {bar !== undefined && <div className={`meter ${barCls || ''}`}><i style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} /></div>}
      {note && <p className="res-note">{note}</p>}
    </div>
  );
}

export function FeedbackPanel({ street, seg, trees, metrics, crownSize, viewSide, setViewSide, warnings, openAbout }) {
  const refs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const [showViews, setShowViews] = useState(false);
  const size = 112;
  useEffect(() => {
    if (!showViews) return undefined;
    const id = requestAnimationFrame(() => renderViews(street, trees, SPECIES_BY_ID, crownSize, viewSide, refs.map((r) => r.current), RENDER_PALETTE, size));
    return () => cancelAnimationFrame(id);
  }, [street, trees, crownSize, viewSide, showViews]);
  const a = metrics.attrs;
  const n = trees.length;
  const total = Math.min(100, seg.gvi + metrics.gvi.pct);
  return (
    <div className="feedback">
      {!n && <p className="res-empty">Choose a tree below and click the street. Results appear here as you plant.</p>}
      <div className="results">
        <Row label="Trees" value={n} kind="calc" note={n ? a.species.join(', ') : null} />
        <Row label="Canopy cover" value={fmt(metrics.canopy.pct)} unit="%" kind="est" bar={metrics.canopy.pct}
          note={`Existing in this segment: ${seg.canopy}%`} />
        <Row label="Green View Index" value={`≈ ${fmt(total)}`} unit="%" kind="est" bar={total * 2.5} barCls="meter-gvi1"
          note={`Measured today ${seg.gvi}% + your trees ≈ ${fmt(metrics.gvi.pct)}%`} />
        <Row label="Water demand" value={n ? levelLabel(a.waterMean) : '—'} kind="thesis"
          note={n ? `Low ${a.water.Low} · Moderate ${a.water.Moderate} · High ${a.water.High}` : null} />
        <Row label="Climate suitability" value={n ? levelLabel(a.climateMean) : '—'} kind="thesis"
          note={n ? `${a.climate.High} of ${n} trees rated High for a hotter, drier future` : null} />
        <Row label="Public preference" value={fmt(a.overall, 2)} unit=" / 5" kind="thesis"
          note={n ? 'Survey of 416 people; species range 3.04–3.32' : null} />
      </div>
      <p className="legend-line"><i className="dot dot-thesis" />From the thesis <i className="dot dot-est" />Design estimate, not a measurement <button className="linkbtn" onClick={openAbout}>How is this calculated?</button></p>

      {warnings.length > 0 && (
        <details className="fold">
          <summary>{warnings.length} placement {warnings.length === 1 ? 'check' : 'checks'}</summary>
          <ul className="checks">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </details>
      )}

      <details className="fold" onToggle={(e) => setShowViews(e.currentTarget.open)}>
        <summary>Eye-level views</summary>
        <div className="seg-ctl seg-ctl-sm" role="radiogroup" aria-label="Viewpoint side">
          {street.sides.map((s, i) => (
            <button key={s} role="radio" aria-checked={viewSide === i} className={viewSide === i ? 'is-on' : ''} onClick={() => setViewSide(i)}>{s}</button>
          ))}
        </div>
        <div className="views">
          {HEADINGS.map((h, i) => (
            <figure key={h.deg} className="view">
              <canvas ref={refs[i]} width={size} height={size} />
              <figcaption><span>{h.label}</span><b>{fmt(metrics.gvi.views[i])}%</b></figcaption>
            </figure>
          ))}
        </div>
      </details>

      <details className="fold">
        <summary>What the thesis found about GVI</summary>
        <DurationChart existing={seg.gvi} total={n ? total : null} />
        {n > 0 && (
          <dl className="dims">
            <div><dt>Attractiveness</dt><dd>{fmt(a.attractiveness, 2)}</dd></div>
            <div><dt>Comfort</dt><dd>{fmt(a.comfort, 2)}</dd></div>
            <div><dt>Safety</dt><dd>{fmt(a.safety, 2)}</dd></div>
            <div><dt>Willing to stay</dt><dd>{fmt(a.stay, 2)}</dd></div>
          </dl>
        )}
      </details>
    </div>
  );
}

export function ScenarioPanel({ street, seg, crownSize, viewSide, currentTotal, onApply }) {
  const [target, setTarget] = useState(20);
  const [all, setAll] = useState(false);
  const rows = useMemo(() => SPECIES.map((sp) => ({ sp, r: scenarioFor(street, seg.gvi, sp, 'both', target, crownSize, viewSide) }))
    .sort((p, q) => (q.r.reached - p.r.reached) || (p.r.reached ? p.r.n - q.r.n : q.r.total - p.r.total) || (q.sp.overall - p.sp.overall)), [street, seg, target, crownSize, viewSide]);
  const shown = all ? rows : rows.slice(0, 5);
  const met = currentTotal >= target;
  return (
    <div className="scenarios">
      <div>
        <h3>Target green view</h3>
        <div className="target-chips" role="radiogroup" aria-label="Target GVI">
          {[5, 10, 20, 30].map((t) => (
            <button key={t} role="radio" aria-checked={target === t} className={target === t ? 'is-on' : ''} onClick={() => setTarget(t)}>{t}%</button>
          ))}
        </div>
      </div>
      <div className="target-status">
        <div className="meter meter-target">
          <i style={{ width: `${Math.min(100, (currentTotal / 40) * 100)}%` }} />
          <b style={{ left: `${(target / 40) * 100}%` }} />
        </div>
        <p className={met ? 'ok' : ''}>{met ? `Reached: your design is about ${fmt(currentTotal)}%.` : `Your design is about ${fmt(currentTotal)}%, ${fmt(target - currentTotal)} points short.`}</p>
      </div>
      <h3>Quickest way to get there</h3>
      <ol className="picks">
        {shown.map(({ sp, r }) => (
          <li key={sp.id}>
            <span className="sw" style={{ background: sp.color }} />
            <span className="pick-name">{sp.name}<small>{r.already ? 'Already met' : r.reached ? `${r.n} trees · ≈ ${fmt(r.total)}%` : `Best: ${r.n} trees · ≈ ${fmt(r.total)}%`}</small></span>
            {r.n > 0 && <button className="btn btn-sm" onClick={() => onApply(r.trees, sp)}>Use</button>}
          </li>
        ))}
      </ol>
      <button className="linkbtn" onClick={() => setAll(!all)}>{all ? 'Show top 5' : 'Compare all 20 species'}</button>
      <p className="fine">Trees are spaced evenly along both footpaths. The thesis treats ~20% GVI as a reference point, not a fixed target.</p>
    </div>
  );
}

export function MethodPanel({ crownSize, setCrownSize, showLabels, setShowLabels, showViewpoint, setShowViewpoint }) {
  return (
    <div className="method">
      <h3>Display settings</h3>
      <div className="settings">
        <label className="field">
          <span>Crown size used for drawing</span>
          <select id="crown-size" value={crownSize} onChange={(e) => setCrownSize(e.target.value)}>
            <option value="lower">Smaller: lower end of each canopy class (default)</option>
            <option value="mid">Middle of each canopy class</option>
            <option value="upper">Larger: upper end of each canopy class</option>
          </select>
        </label>
        <label className="check"><input id="show-labels" type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /> Show species names on the plan</label>
        <label className="check"><input id="show-vp" type="checkbox" checked={showViewpoint} onChange={(e) => setShowViewpoint(e.target.checked)} /> Show the GVI viewpoint on the plan</label>
      </div>
      <h3>Where each number comes from</h3>
      <ul className="method-list">
        <li><Src kind="thesis" /> Species attributes (Table 6.1), leaf type (Appendix C1 survey panels), perception ratings (Tables C2.1–C2.4, C3.1, 8.5), segment flow / GVI / canopy / PGPI (Tables D.2, D.3), decision records (Table D.1), duration curve (Table 5.4), street summaries (Tables 8.2, 5.3).</li>
        <li><Src kind="missing" /> Mature height and crown spread per species are not printed in the thesis text, so they are not shown as data.</li>
        <li><Src kind="assumption" /> Crown footprint: each species is drawn with the representative area of its Table 6.1 shade class. Current setting "{crownSize}": Small {SHADE_CLASSES.Small[crownSize]} m², Medium {SHADE_CLASSES.Medium[crownSize]} m², Large {SHADE_CLASSES.Large[crownSize]} m². Model height = 0.9 × crown diameter + 2 m; crown base ≥ 2.5 m.</li>
        <li><Src kind="estimate" /> Canopy cover = union of crown footprints inside the 20 m × street-width site (0.2 m grid), overlap counted once, matching the thesis approach for scenario canopy (§8.2.6).</li>
        <li><Src kind="estimate" /> GVI proxy: crowns as ellipsoids with {FOLIAGE_DENSITY * 100}% foliage density, façades as continuous walls, one viewpoint at {EYE_HEIGHT} m, four {VIEW_FOV}° views (vertical FOV assumed {VIEW_FOV}°). The total adds the measured warm-season GVI and ignores overlap with existing vegetation, so treat it as a design estimate pending calibration against the Mask2Former four-view method.</li>
        <li><Src kind="demo" /> Lane, parking and median widths, and total reserve widths. Replace with surveyed cross-sections when available.</li>
      </ul>
    </div>
  );
}
