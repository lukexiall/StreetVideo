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

function Bar({ parts }) {
  const total = parts.reduce((a, p) => a + p.n, 0) || 1;
  return (
    <div className="dist">
      <div className="dist-bar">
        {parts.map((p) => (p.n ? <i key={p.label} className={`dist-${p.cls}`} style={{ width: `${(p.n / total) * 100}%` }} title={`${p.label}: ${p.n}`} /> : null))}
      </div>
      <div className="dist-legend">
        {parts.map((p) => (
          <span key={p.label}><i className={`dist-${p.cls}`} />{p.label} {p.n}</span>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, unit, sub, children, src }) {
  return (
    <div className="metric">
      <div className="metric-head">
        <span className="metric-label">{label}</span>
        {src}
      </div>
      <div className="metric-value">
        {value}
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
      {sub && <div className="metric-sub">{sub}</div>}
      {children}
    </div>
  );
}

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

export function FeedbackPanel({ street, seg, trees, metrics, crownSize, viewSide, setViewSide, warnings }) {
  const refs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const size = 112;
  useEffect(() => {
    const id = requestAnimationFrame(() => renderViews(street, trees, SPECIES_BY_ID, crownSize, viewSide, refs.map((r) => r.current), RENDER_PALETTE, size));
    return () => cancelAnimationFrame(id);
  }, [street, trees, crownSize, viewSide]);
  const a = metrics.attrs;
  const total = Math.min(100, seg.gvi + metrics.gvi.pct);
  const ratingPos = a.overall === null ? null : ((a.overall - RATING_RANGE[0]) / (RATING_RANGE[1] - RATING_RANGE[0])) * 100;
  return (
    <div className="feedback">
      <div className="metric-grid">
        <Metric label="Trees in design" value={trees.length} sub={a.species.length ? a.species.join(', ') : 'Choose a species below, then click the street'} />
        <Metric label="Canopy cover" value={fmt(metrics.canopy.pct)} unit="%" src={<Src kind="estimate" />}
          sub={<>Added crowns {fmt(metrics.canopy.area, 0)} m² over {fmt(metrics.canopy.siteArea, 0)} m² site{metrics.canopy.overlap > 0.5 ? `, ${fmt(metrics.canopy.overlap, 0)} m² overlap counted once` : ''}. Existing 2022 canopy: {seg.canopy}% <Src kind="thesis" refText="D.2" /></>}>
          <div className="meter"><i style={{ width: `${Math.min(100, metrics.canopy.pct)}%` }} /></div>
        </Metric>
        <Metric label="Green View Index" value={`≈ ${fmt(total)}`} unit="%" src={<Src kind="estimate" />}
          sub={<>Measured {seg.gvi}% <Src kind="thesis" refText="D.2" /> + design trees ≈ {fmt(metrics.gvi.pct)}% (four-view ray-cast proxy). Indicative sum; not a measurement.</>}>
          <div className="meter meter-gvi"><i className="m-exist" style={{ width: `${Math.min(100, seg.gvi * 2.5)}%` }} /><i style={{ width: `${Math.min(100 - seg.gvi * 2.5, metrics.gvi.pct * 2.5)}%` }} /></div>
          <div className="meter-scale"><span>0</span><span>20%</span><span>40%</span></div>
        </Metric>
        <Metric label="Water demand" value={trees.length ? levelLabel(a.waterMean) : '—'} src={<Src kind="thesis" refText="Table 6.1" />}
          sub={trees.length ? `Mean class score ${fmt(a.waterMean, 2)} (Low 1 · Moderate 2 · High 3)` : 'No trees yet'}>
          <Bar parts={[{ label: 'Low', n: a.water.Low, cls: 'lo' }, { label: 'Moderate', n: a.water.Moderate, cls: 'mid' }, { label: 'High', n: a.water.High, cls: 'hi' }]} />
        </Metric>
        <Metric label="Future climate suitability" value={trees.length ? levelLabel(a.climateMean) : '—'} src={<Src kind="thesis" refText="Table 6.1" />}
          sub={trees.length ? `${a.climate.High} of ${trees.length} trees rated High for hot–dry future conditions` : 'No trees yet'}>
          <Bar parts={[{ label: 'High', n: a.climate.High, cls: 'good' }, { label: 'Moderate', n: a.climate.Moderate, cls: 'mid' }, { label: 'Low', n: a.climate.Low, cls: 'warn' }]} />
        </Metric>
        <Metric label="Public preference" value={fmt(a.overall, 2)} unit="/ 5" src={<Src kind="thesis" refText="Table C3.1" />}
          sub="Mean overall perceptual score of planted trees (EMM, 416 participants)">
          {ratingPos !== null && (
            <div className="rating-scale">
              <div className="rs-track"><i style={{ left: `${Math.max(0, Math.min(100, ratingPos))}%` }} /></div>
              <div className="rs-ends"><span>3.04 lowest species</span><span>3.32 highest</span></div>
            </div>
          )}
          {trees.length > 0 && (
            <dl className="dims">
              <div><dt>Attractiveness</dt><dd>{fmt(a.attractiveness, 2)}</dd></div>
              <div><dt>Comfort</dt><dd>{fmt(a.comfort, 2)}</dd></div>
              <div><dt>Safety</dt><dd>{fmt(a.safety, 2)}</dd></div>
              <div><dt>Willingness to stay</dt><dd>{fmt(a.stay, 2)}</dd></div>
            </dl>
          )}
          {trees.length > 0 && <p className="fine">Dimension means derived from Tables C2.1–C2.4 (intercept + species coefficient).</p>}
        </Metric>
      </div>

      <section className="panel-sec">
        <div className="sec-head">
          <h3>Eye-level views</h3>
          <div className="seg-ctl" role="radiogroup" aria-label="Viewpoint side">
            {street.sides.map((s, i) => (
              <button key={s} role="radio" aria-checked={viewSide === i} className={viewSide === i ? 'is-on' : ''} onClick={() => setViewSide(i)}>{s}</button>
            ))}
          </div>
        </div>
        <div className="views">
          {HEADINGS.map((h, i) => (
            <figure key={h.deg} className="view">
              <canvas ref={refs[i]} width={size} height={size} />
              <figcaption><span>{h.label}</span><b>{fmt(metrics.gvi.views[i])}%</b></figcaption>
            </figure>
          ))}
        </div>
        <p className="fine">Schematic ray-cast of the design trees only, from one point at {EYE_HEIGHT} m in mid-segment, four {VIEW_FOV}° views averaged as in §8.2.2. Existing vegetation and context beyond 20 m are not modelled.</p>
      </section>

      <section className="panel-sec">
        <h3>GVI and time in the street</h3>
        <DurationChart existing={seg.gvi} total={trees.length ? total : null} />
      </section>

      <section className="panel-sec">
        <h3>Design checks</h3>
        {warnings.length ? (
          <ul className="checks">{warnings.map((w, i) => <li key={i}><Chip tone="warn">Check</Chip> {w}</li>)}</ul>
        ) : (
          <p className="fine">No placement conflicts under the app's rules (traffic lanes blocked, 1.8 m clear walkway, 4 m trunk spacing, façade clearance).</p>
        )}
      </section>
    </div>
  );
}

export function ScenarioPanel({ street, seg, crownSize, viewSide, currentTotal, onApply }) {
  const [target, setTarget] = useState(20);
  const [layout, setLayout] = useState('both');
  const hasMedian = street.profile.some((p) => p.kind === 'median');
  const rows = useMemo(() => SPECIES.map((sp) => ({ sp, r: scenarioFor(street, seg.gvi, sp, layout, target, crownSize, viewSide) }))
    .sort((p, q) => (q.r.reached - p.r.reached) || (p.r.reached ? p.r.n - q.r.n : q.r.total - p.r.total) || (q.sp.overall - p.sp.overall)), [street, seg, layout, target, crownSize, viewSide]);
  const thesis = { hindley: 'Hindley', gouger: 'Gouger' }[street.id];
  return (
    <div className="scenarios">
      <div className="sec-head">
        <h3>Target GVI</h3>
        <div className="seg-ctl" role="radiogroup" aria-label="Target GVI">
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
        <p>Current design ≈ <b>{fmt(currentTotal)}%</b> GVI ({seg.gvi}% measured + design trees). {currentTotal >= target ? 'Target reached.' : `${fmt(target - currentTotal)} points below the ${target}% target.`}</p>
      </div>
      <label className="field">
        <span>Layout to test</span>
        <select id="scenario-layout" value={layout} onChange={(e) => setLayout(e.target.value)}>
          <option value="both">Both footpaths, 1.0 m from kerb</option>
          <option value="one">{street.sides[0]} footpath only</option>
          {hasMedian && <option value="all">Both footpaths + median</option>}
        </select>
      </label>
      <p className="fine">For each species the app adds evenly spaced trees per row (minimum spacing max(4 m, ½ crown diameter)) until the indicative GVI reaches the target. About 20% GVI is the thesis' study-specific scenario reference, where the duration curve levels off (§8.2.6, Table 5.4); it is not an established design target.</p>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Species</th><th>Trees</th><th>GVI ≈</th><th>Canopy</th><th title="Water demand · climate suitability (Table 6.1)">W · C</th><th>Pref.</th><th /></tr></thead>
          <tbody>
            {rows.map(({ sp, r }) => (
              <tr key={sp.id} className={r.reached ? '' : 'is-short'}>
                <td><span className="sw" style={{ background: sp.color }} />{sp.name}</td>
                <td className="num">{r.already ? '0' : r.n}{!r.reached && <span className="flag" title="Target not reached within this segment">max</span>}</td>
                <td className="num">{fmt(r.total)}%</td>
                <td className="num">{fmt(r.canopy, 0)}%</td>
                <td className="wc"><span className={`lvl lvl-w-${sp.water}`} title={`Water ${sp.water}`}>{sp.water[0]}</span> · <span className={`lvl lvl-c-${sp.climate}`} title={`Climate ${sp.climate}`}>{sp.climate[0]}</span></td>
                <td className="num">{sp.overall.toFixed(2)}</td>
                <td>{r.n > 0 && <button className="btn btn-sm" onClick={() => onApply(r.trees, sp)}>Apply</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fine">W · C = water demand · future climate suitability (L / M / H, Table 6.1). Pref. = overall perceptual score (Table C3.1). "max" = the target is not reached even at the densest layout the spacing rule allows in this 20 m segment.</p>
      {thesis && (
        <section className="panel-sec">
          <h3>Thesis corridor scenarios: {thesis} Street</h3>
          <table className="data">
            <thead><tr><th>Scenario</th><th>Trees added</th><th>Canopy</th><th>Illustrative GVI</th></tr></thead>
            <tbody>
              {(thesis === 'Hindley'
                ? [['Existing', 0, 0.3, 0.0], ['A · Minimal', 12, 11.0, 20.4], ['B · Balanced', 24, 25.0, 27.4], ['C · Maximum', 46, 43.0, 45.6]]
                : [['Existing', 0, 14.3, 8.2], ['A · Minimal', 7, 18.0, 13.5], ['B · Balanced', 18, 24.0, 20.0], ['C · Maximum', 32, 34.0, 28.5]]
              ).map(([n, t, c, g]) => <tr key={n}><td>{n}</td><td className="num">+{t}</td><td className="num">{c}%</td><td className="num">{g}%</td></tr>)}
            </tbody>
          </table>
          <p className="fine">Table 8.4: whole-corridor design estimates (26 segments); GVI values are render-based for the displayed views only. <Src kind="thesis" refText="Table 8.4" /></p>
        </section>
      )}
    </div>
  );
}

export function MethodPanel({ crownSize }) {
  return (
    <div className="method">
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
