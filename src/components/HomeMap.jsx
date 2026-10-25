import { STATES, ADELAIDE, project, statePath } from '../data/australia.js';
import { STREETS } from '../data/streets.js';
import { Icon } from './ui.jsx';

const { useState } = React;

export function HomeMap({ onOpenSA }) {
  const [hover, setHover] = useState(null);
  const [ax, ay] = project(ADELAIDE);
  const totalRecords = STREETS.reduce((a, s) => a + s.records, 0);
  return (
    <div className="home">
      <section className="home-intro">
        <p className="eyebrow">Street tree design · Australia</p>
        <h1>Choose where to design</h1>
        <p className="lede">
          StreetTree Studio turns the Adelaide main-street study into a working design tool: pick a 20 m street segment, plant species from the study's 20-species palette, and watch canopy, visible greenery and public-preference evidence update as you draw.
        </p>
        <div className="home-stats">
          <div><b>4</b><span>study streets</span></div>
          <div><b>100</b><span>20 m segments</span></div>
          <div><b>20</b><span>tree species</span></div>
          <div><b>{totalRecords.toLocaleString('en-AU')}</b><span>warm-season pedestrian records</span></div>
        </div>
        <button className="btn btn-primary btn-lg" onClick={onOpenSA}>
          Open South Australia <Icon name="arrow" size={18} />
        </button>
        <p className="fine">Pedestrian, GVI and canopy figures: thesis Chapter 8, Table 8.2 and Appendix D.</p>
      </section>
      <section className="map-wrap" aria-label="Map of Australia">
        <svg viewBox="0 0 370 345" className="aus-map" role="img" aria-label="Australian states. South Australia is available.">
          {STATES.map((s) => {
            const active = s.id === 'sa';
            const [lx, ly] = s.label ? project(s.label) : [0, 0];
            return (
              <g key={s.id}
                className={`state ${active ? 'state-active' : 'state-soon'} ${hover === s.id ? 'is-hover' : ''}`}
                onMouseEnter={() => setHover(s.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => active && onOpenSA()}
                tabIndex={active ? 0 : -1}
                role={active ? 'button' : undefined}
                aria-label={active ? 'Open South Australia' : `${s.name}: coming soon`}
                onKeyDown={(e) => active && (e.key === 'Enter' || e.key === ' ') && onOpenSA()}>
                <path d={statePath(s)} />
                {s.label && (
                  <text x={lx} y={ly} textAnchor="middle" className="state-label">
                    {s.abbr}
                    {!active && <tspan x={lx} dy="11" className="state-soon-label">Coming soon</tspan>}
                  </text>
                )}
              </g>
            );
          })}
          <g className="adl-marker" transform={`translate(${ax},${ay})`} pointerEvents="none">
            <circle r="7" className="adl-pulse" />
            <circle r="3.2" />
            <text x="-9" y="3" textAnchor="end" className="adl-label">Adelaide</text>
          </g>
        </svg>
        <div className="map-legend">
          <span><i className="lg lg-active" /> Available: South Australia (Adelaide)</span>
          <span><i className="lg lg-soon" /> Coming soon</span>
          {hover && hover !== 'sa' && <span className="map-hover">{STATES.find((s) => s.id === hover).name} is not available yet</span>}
        </div>
      </section>
    </div>
  );
}
