import { STREETS, zonesFor } from '../data/streets.js';
import { Icon, Chip, Src, fmt } from './ui.jsx';

const { useState } = React;

const METRICS = [
  { id: 'gvi', label: 'Green view (GVI)', unit: '%', max: 40, src: 'Table D.2' },
  { id: 'canopy', label: 'Canopy cover', unit: '%', max: 70, src: 'Table D.2' },
  { id: 'pgpi', label: 'Planting priority', unit: '', max: 100, src: 'Table D.3' },
];

export function CrossSection({ street, height = 54 }) {
  const zones = zonesFor(street);
  const W = street.width;
  return (
    <svg viewBox={`-1 0 ${W + 2} 12`} className="xsec" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x={-1} y={0} width={1} height={12} className="xs-bld" />
      <rect x={W} y={0} width={1} height={12} className="xs-bld" />
      {zones.map((z) => (
        <rect key={z.i} x={z.u0} y={4} width={z.width} height={8} className={`xs-${z.kind}`} />
      ))}
      {zones.map((z) => (
        <text key={'t' + z.i} x={z.u0 + z.width / 2} y={2.6} textAnchor="middle" className="xs-label">
          {z.width.toFixed(1)}
        </text>
      ))}
    </svg>
  );
}

export function StreetSelect({ onDesign, initialStreet, onStreet }) {
  const [streetId, setStreetId] = useState(initialStreet || 'hindley');
  const [metric, setMetric] = useState('gvi');
  const street = STREETS.find((s) => s.id === streetId);
  const [segId, setSegId] = useState(null);
  const seg = street.segments.find((s) => s.id === segId) || null;
  const m = METRICS.find((x) => x.id === metric);

  return (
    <div className="streets">
      <aside className="street-list" aria-label="Study streets">
        <p className="eyebrow">Adelaide · South Australia</p>
        <h1>Study streets</h1>
        {STREETS.map((s) => (
          <button key={s.id} className={`street-card ${s.id === streetId ? 'is-active' : ''}`} onClick={() => { setStreetId(s.id); setSegId(null); onStreet && onStreet(s.id); }}>
            <div className="street-card-head">
              <h3>{s.name}</h3>
              <span className="mono">{s.segments.length} segments</span>
            </div>
            <p>{s.character}</p>
            <dl className="mini-stats">
              <div><dt>Records</dt><dd>{s.records.toLocaleString('en-AU')}</dd></div>
              <div><dt>Stay ≥2 min</dt><dd>{s.stayShare}%</dd></div>
              <div><dt>Mean GVI</dt><dd>{s.meanGvi}%</dd></div>
              <div><dt>Mean canopy</dt><dd>{s.meanCanopy}%</dd></div>
            </dl>
          </button>
        ))}
        <p className="fine">Street figures: Table 8.2 (warm season, spring + late spring–early summer 2025).</p>
      </aside>

      <section className="street-detail">
        <header className="sd-head">
          <div>
            <p className="eyebrow">Step 2 · Choose a 20 m segment</p>
            <h2>{street.name}</h2>
          </div>
          <div className="seg-metric" role="radiogroup" aria-label="Colour segments by">
            {METRICS.map((x) => (
              <button key={x.id} role="radio" aria-checked={metric === x.id} className={`seg-pill ${metric === x.id ? 'is-on' : ''}`} onClick={() => setMetric(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
        </header>

        <div className="strip-wrap">
          <div className="strip" style={{ gridTemplateColumns: `repeat(${street.segments.length}, minmax(0, 1fr))` }}>
            {street.segments.map((s) => {
              const val = s[metric];
              const pct = Math.min(100, (val / m.max) * 100);
              return (
                <button key={s.id}
                  className={`strip-cell ${s.id === segId ? 'is-sel' : ''} ${s.shortlist ? 'is-short' : ''}`}
                  style={{ '--k': `${pct}%` }}
                  onClick={() => setSegId(s.id)}
                  title={`${s.id}: ${m.label} ${val}${m.unit}${s.shortlist ? ' · PGPI top-20' : ''}`}
                  aria-label={`${s.id}, ${m.label} ${val}${m.unit}`}>
                  <span className="strip-val">{metric === 'flow' ? Math.round(val) : fmt(val, metric === 'pgpi' ? 0 : 0)}</span>
                  <span className="strip-id">{s.id}</span>
                </button>
              );
            })}
          </div>
          <div className="strip-legend">
            <span>{m.label} · low</span>
            <i className="strip-ramp" />
            <span>high (scale 0–{m.max}{m.unit})</span>
            <span className="strip-key"><i className="key-short" /> Top-20 planting priority</span>
            <span>Thesis {m.src}</span>
          </div>
        </div>

        <div className="sd-grid">
          <div className="panel seg-panel">
            {seg ? (
              <>
                <div className="seg-panel-head">
                  <h3>Segment {seg.id}</h3>
                  {seg.shortlist ? <Chip tone="accent">Priority #{seg.rank} of 100</Chip> : <Chip>Priority #{seg.rank} of 100</Chip>}
                </div>
                <dl className="kv">
                  <div><dt>Pedestrian flow</dt><dd>{seg.flow} / h</dd></div>
                  <div><dt>Warm-season GVI</dt><dd>{seg.gvi}%</dd></div>
                  <div><dt>Canopy cover (2022 LiDAR)</dt><dd>{seg.canopy}%</dd></div>
                  <div><dt>Priority score (PGPI)</dt><dd>{seg.pgpi}</dd></div>
                </dl>
                {seg.decision && (
                  <div className="decision">
                    <h4>Thesis recommendation</h4>
                    <p>{seg.decision.action} <b>{seg.decision.species}</b> · {seg.decision.role}-oriented · {seg.decision.feasibility}</p>
                    <p className="fine">{seg.decision.rationale} (Table D.1)</p>
                  </div>
                )}
                <button className="btn btn-primary btn-lg" onClick={() => onDesign(street.id, seg.id)}>
                  Design segment {seg.id} <Icon name="arrow" size={18} />
                </button>
              </>
            ) : (
              <div className="empty">
                <Icon name="target" size={28} />
                <p>Pick a segment in the strip above to see its thesis data and open it in the designer.</p>
                {street.segments.some((s) => s.shortlist) && (
                  <button className="btn" onClick={() => setSegId(street.segments.filter((s) => s.shortlist).sort((a, b) => a.rank - b.rank)[0].id)}>
                    Show the highest-priority segment
                  </button>
                )}
              </div>
            )}
          </div>
          <details className="panel fold">
            <summary>Street cross-section used in the designer</summary>
            <CrossSection street={street} />
            <p className="fine">
              Widths in metres. Footpaths use the thesis street mean ({street.footpath} m, Table 5.3); lanes, parking and medians are a demonstration layout because the thesis does not report carriageway geometry.
            </p>
          </details>
        </div>
      </section>
    </div>
  );
}
