import { SPECIES, SHADE_CLASSES } from '../data/species.js';
import { SpeciesIcon } from './TreeGlyph.jsx';
import { Src, fmt } from './ui.jsx';

const { useState } = React;

const Missing = () => <span className="missing" title="Mature height and crown spread are not reported in the thesis text">Not in thesis</span>;

const COLS = [
  ['thesisId', '#'], ['name', 'Species'], ['shade', 'Canopy size'], ['height', 'Mature height'], ['spread', 'Crown spread'],
  ['water', 'Water demand'], ['climate', 'Climate suitability'], ['origin', 'Origin'], ['leaf', 'Leaf'],
  ['overall', 'Overall score'], ['attractiveness', 'Attract.'], ['comfort', 'Comfort'], ['safety', 'Safety'], ['stay', 'Stay'], ['publicRating', 'Public rating'],
];
const ORD = { Low: 1, Moderate: 2, High: 3, Small: 1, Medium: 2, Large: 3 };

function PrefChart() {
  const rows = SPECIES.slice().sort((a, b) => b.overall - a.overall);
  const [hover, setHover] = useState(null);
  const W = 640, rowH = 20, pl = 210, pr = 24, pt = 24;
  const H = pt + rows.length * rowH + 28;
  const x0 = 2.9, x1 = 3.45;
  const x = (v) => pl + ((v - x0) / (x1 - x0)) * (W - pl - pr);
  return (
    <div className="table-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="prefchart" role="img" aria-label="Overall perceptual score by species with 95% confidence intervals, coloured by climate suitability">
        {[2.9, 3.0, 3.1, 3.2, 3.3, 3.4].map((v) => (
          <g key={v} className="pc-grid"><line x1={x(v)} x2={x(v)} y1={pt - 6} y2={H - 22} /><text x={x(v)} y={H - 8} textAnchor="middle">{v.toFixed(1)}</text></g>
        ))}
        {rows.map((s, i) => {
          const y = pt + i * rowH + rowH / 2;
          return (
            <g key={s.id} className={`pc-row ${hover === s.id ? 'is-hover' : ''}`} onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}>
              <rect x={0} y={y - rowH / 2} width={W} height={rowH} className="pc-hit" />
              <text x={pl - 10} y={y + 4} textAnchor="end" className="pc-name">{s.name}</text>
              <line x1={x(s.overallCI[0])} x2={x(s.overallCI[1])} y1={y} y2={y} className="pc-ci" />
              <circle cx={x(s.overall)} cy={y} r={5} className={`pc-dot pc-${s.climate}`} />
              {hover === s.id && <text x={x(s.overallCI[1]) + 8} y={y + 4} className="pc-val">{s.overall.toFixed(3)} ({s.overallCI[0]}–{s.overallCI[1]}) · climate {s.climate}</text>}
            </g>
          );
        })}
      </svg>
      <div className="pc-legend">
        <span><i className="pc-dot pc-High" /> High climate suitability</span>
        <span><i className="pc-dot pc-Moderate" /> Moderate</span>
        <span><i className="pc-dot pc-Low" /> Low</span>
        <span className="fine">Overall perceptual score EMM, 5-point scale, line = 95% CI (Table C3.1); climate class from Table 6.1.</span>
      </div>
    </div>
  );
}

export function SpeciesDB() {
  const [sort, setSort] = useState(['overall', -1]);
  const [open, setOpen] = useState(null);
  const val = (s, k) => (ORD[s[k]] !== undefined ? ORD[s[k]] : s[k]);
  const rows = SPECIES.slice().sort((a, b) => {
    const [k, d] = sort;
    const va = val(a, k), vb = val(b, k);
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    return (va > vb ? 1 : va < vb ? -1 : 0) * d;
  });
  const sel = SPECIES.find((s) => s.id === open);
  return (
    <div className="species-db">
      <header className="page-head">
        <p className="eyebrow">Tree species database</p>
        <h1>20 Adelaide street-tree species</h1>
        <p className="lede">The species palette from thesis Chapter 6: the most common street trees in the City of Adelaide and North Adelaide (68.7% of street trees), rated by 416 survey participants in controlled walking videos.</p>
        <div className="src-row">
          <Src kind="thesis" refText="Table 6.1" /><Src kind="thesis" refText="Appendix C1" /><Src kind="derived" refText="Tables C2.1–C2.4" /><Src kind="thesis" refText="Table C3.1" /><Src kind="thesis" refText="Table 8.5" />
        </div>
      </header>
      <section className="panel">
        <h3>Public preference and climate suitability</h3>
        <PrefChart />
      </section>
      <section className="panel">
        <div className="sec-head"><h3>Attribute table</h3><span className="fine">Select a column to sort · select a row for details</span></div>
        <div className="table-wrap">
          <table className="data db">
            <thead>
              <tr>
                {COLS.map(([k, l]) => (
                  <th key={k} aria-sort={sort[0] === k ? (sort[1] > 0 ? 'ascending' : 'descending') : 'none'}>
                    <button className="th-btn" onClick={() => setSort([k, sort[0] === k ? -sort[1] : -1])}>{l}{sort[0] === k ? (sort[1] > 0 ? ' ▲' : ' ▼') : ''}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className={open === s.id ? 'is-open' : ''} onClick={() => setOpen(open === s.id ? null : s.id)}>
                  <td className="num">{s.thesisId}</td>
                  <td className="db-name"><SpeciesIcon sp={s} size={26} /><span><b>{s.name}</b>{s.sci ? <i>{s.sci}</i> : null}</span></td>
                  <td>{s.shade}<span className="sub">{SHADE_CLASSES[s.shade].range}</span></td>
                  <td><Missing /></td>
                  <td><Missing /></td>
                  <td><span className={`lvl lvl-w-${s.water}`}>{s.water}</span></td>
                  <td><span className={`lvl lvl-c-${s.climate}`}>{s.climate}</span>{s.climateScore !== null && <span className="sub">score {s.climateScore}</span>}</td>
                  <td>{s.origin}</td>
                  <td>{s.leaf}</td>
                  <td className="num"><b>{s.overall.toFixed(3)}</b></td>
                  <td className="num">{s.attractiveness.toFixed(3)}</td>
                  <td className="num">{s.comfort.toFixed(3)}</td>
                  <td className="num">{s.safety.toFixed(3)}</td>
                  <td className="num">{s.stay.toFixed(3)}</td>
                  <td className="num">{s.publicRating !== null ? s.publicRating.toFixed(2) : <span className="missing" title="Table 8.5 reports this rating for six species only">Not reported</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fine">
          Ratings use five-point Likert scales. Overall score: EMM of the mean of the four dimensions (Table C3.1). Dimension scores are derived as model intercept + species coefficient (Tables C2.1–C2.4; reference species Bottlebrushes). Public rating and climate score: Table 8.5 (six species, scale of the climate score not stated). Mature height and crown spread exist in the thesis attribute database but are not printed in the text, so they are left blank.
        </p>
      </section>
      {sel && (
        <section className="panel sp-detail">
          <div className="sp-detail-head"><SpeciesIcon sp={sel} size={56} /><div><h3>{sel.name}</h3>{sel.sci && <i>{sel.sci}</i>}</div></div>
          <dl className="kv">
            <div><dt>Shade coverage (canopy area)</dt><dd>{sel.shade} ({SHADE_CLASSES[sel.shade].range})</dd></div>
            <div><dt>Water demand</dt><dd>{sel.water}</dd></div>
            <div><dt>Future climate suitability</dt><dd>{sel.climate}{sel.climateScore !== null ? ` · score ${sel.climateScore} (Table 8.5)` : ''}</dd></div>
            <div><dt>Origin · leaf type</dt><dd>{sel.origin} · {sel.leaf}</dd></div>
            <div><dt>Overall perceptual score</dt><dd>{sel.overall.toFixed(3)} (95% CI {sel.overallCI[0]}–{sel.overallCI[1]})</dd></div>
            <div><dt>Preference × climate quadrant</dt><dd>{sel.quadrant || <span className="missing">Not named in the Chapter 6 text (see Figure 6.4)</span>}</dd></div>
            {sel.designUse && <div><dt>Design use (Table 8.5)</dt><dd>{sel.designUse}. {sel.consideration}.</dd></div>}
          </dl>
          {sel.note && <p className="fine note">Note: {sel.note}</p>}
        </section>
      )}
    </div>
  );
}
