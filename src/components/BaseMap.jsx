import { BASES, loadStreetGeometry, tilesFor } from '../lib/geo.js';
import { SEGMENT_LENGTH } from '../data/streets.js';

const { useEffect, useState } = React;

export function useStreetFrames() {
  const [state, setState] = useState({ status: 'idle', frames: {} });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, status: 'loading' }));
    loadStreetGeometry()
      .then((frames) => live && setState({ status: 'ok', frames }))
      .catch(() => live && setState({ status: 'error', frames: {} }));
    return () => { live = false; };
  }, []);
  return state;
}

// SVG group of map tiles, transformed into the plan's own coordinates.
export function BaseTiles({ frame, align, width, base, zoom, toGeo, x0, x1, y0, y1, onFail }) {
  if (base === 'drawing' || !frame) return null;
  const r = tilesFor({ frame, align, width, base, zoom, toGeo, x0, x1, y0, y1 });
  if (!r.tiles) return null;
  return (
    <g className="base-tiles" transform={r.transform} pointerEvents="none">
      {r.tiles.map((t) => (
        <image key={t.key} href={t.href} x={t.x} y={t.y} width={256.6} height={256.6} preserveAspectRatio="none"
          onError={(e) => {
            const img = e.currentTarget;
            if (t.fallback && img.getAttribute('href') !== t.fallback) img.setAttribute('href', t.fallback);
            else if (onFail) onFail();
          }} />
      ))}
    </g>
  );
}

// Base-layer switch plus the alignment controls shared by both plans.
export function BaseControls({ street, base, setBase, align, setAlign, geo, failed }) {
  const [open, setOpen] = useState(false);
  const frame = geo.frames[street.id];
  const total = street.segments.length * SEGMENT_LENGTH;
  const maxOffset = frame ? Math.max(0, Math.round(frame.length - total)) : 0;
  const a = align || { offset: 0, reverse: false };
  const unavailable = geo.status === 'error' || (geo.status === 'ok' && !frame);
  return (
    <div className="base-ctl">
      <div className="seg-ctl" role="radiogroup" aria-label="Base layer">
        {Object.entries(BASES).map(([id, b]) => (
          <button key={id} role="radio" aria-checked={base === id} className={base === id ? 'is-on' : ''}
            disabled={id !== 'drawing' && unavailable} onClick={() => setBase(id)}>{b.label}</button>
        ))}
      </div>
      {base !== 'drawing' && frame && (
        <button className={`btn btn-sm btn-ghost ${open ? 'is-on' : ''}`} onClick={() => setOpen(!open)}>Align & calibrate</button>
      )}
      {base !== 'drawing' && geo.status === 'loading' && <span className="fine">Loading street position…</span>}
      {unavailable && <span className="fine">Base map unavailable here. It works on the public site.</span>}
      {failed && base !== 'drawing' && !unavailable && <span className="fine">Map images blocked here. Open lukexiall.github.io/StreetVideo to see them.</span>}
      {open && base !== 'drawing' && frame && (
        <div className="align-pop">
          <p className="fine">Study segment positions are not imported yet, so segment {street.prefix}1 is placed from one end of the OpenStreetMap centreline. Slide until the segments sit where you surveyed them, then match the widths below to the photo.</p>
          <label className="field">
            <span>Start of {street.prefix}1: {a.offset} m from the {a.reverse ? (street.orientation === 'N–S' ? 'north' : 'east') : (street.orientation === 'N–S' ? 'south' : 'west')} end (street length about {frame ? Math.round(frame.length) : '?'} m)</span>
            <input id="align-offset" type="range" min={0} max={Math.max(maxOffset, 0)} step={1} value={Math.min(a.offset, maxOffset)} onChange={(e) => setAlign({ ...a, offset: Number(e.target.value) })} />
          </label>
          <label className="check"><input id="align-rev" type="checkbox" checked={a.reverse} onChange={(e) => setAlign({ ...a, reverse: e.target.checked })} /> Number segments from the other end</label>
          <p className="align-h">Match the street to the photo</p>
          <label className="field">
            <span>Move across: {(a.shift || 0).toFixed(1)} m</span>
            <input id="align-shift" type="range" min={-15} max={15} step={0.5} value={a.shift || 0} onChange={(e) => setAlign({ ...a, shift: Number(e.target.value) })} />
          </label>
          <label className="field">
            <span>Building-to-building width: {street.width.toFixed(1)} m</span>
            <input id="align-width" type="range" min={12} max={60} step={0.5} value={Math.round(street.width * 2) / 2} onChange={(e) => setAlign({ ...a, width: Number(e.target.value) })} />
          </label>
          <label className="field">
            <span>Footpath width (each side): {street.profile[0].width.toFixed(1)} m</span>
            <input id="align-fp" type="range" min={1.5} max={12} step={0.1} value={street.profile[0].width} onChange={(e) => setAlign({ ...a, footpath: Number(e.target.value) })} />
          </label>
          <div className="align-row">
            <span className="fine">{street.calibratedBy ? 'Using your calibrated widths for all results.' : 'Using the demo cross-section.'}</span>
            <button className="btn btn-sm btn-ghost" onClick={() => setAlign({ offset: a.offset, reverse: a.reverse })}>Reset widths</button>
          </div>
          <p className="fine">{BASES[base].attribution}</p>
        </div>
      )}
    </div>
  );
}

export function Attribution({ base }) {
  if (base === 'drawing') return null;
  return <div className="attrib">{BASES[base].attribution}</div>;
}
