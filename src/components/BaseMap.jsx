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
        <image key={t.key} href={t.href} x={t.x} y={t.y} width={256.6} height={256.6} preserveAspectRatio="none" onError={onFail} />
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
        <button className={`btn btn-sm btn-ghost ${open ? 'is-on' : ''}`} onClick={() => setOpen(!open)}>Align segments</button>
      )}
      {base !== 'drawing' && geo.status === 'loading' && <span className="fine">Loading street position…</span>}
      {unavailable && <span className="fine">Base map unavailable here. It works on the public site.</span>}
      {failed && base !== 'drawing' && !unavailable && <span className="fine">Map images blocked here. Open lukexiall.github.io/StreetVideo to see them.</span>}
      {open && base !== 'drawing' && frame && (
        <div className="align-pop">
          <p className="fine">Study segment positions are not imported yet, so segment {street.prefix}1 is placed from one end of the OpenStreetMap centreline. Slide until the segments sit where you surveyed them.</p>
          <label className="field">
            <span>Start of {street.prefix}1: {a.offset} m from the {a.reverse ? (street.orientation === 'N–S' ? 'north' : 'east') : (street.orientation === 'N–S' ? 'south' : 'west')} end (street length about {frame ? Math.round(frame.length) : '?'} m)</span>
            <input id="align-offset" type="range" min={0} max={Math.max(maxOffset, 0)} step={1} value={Math.min(a.offset, maxOffset)} onChange={(e) => setAlign({ ...a, offset: Number(e.target.value) })} />
          </label>
          <label className="check"><input id="align-rev" type="checkbox" checked={a.reverse} onChange={(e) => setAlign({ ...a, reverse: e.target.checked })} /> Number segments from the other end</label>
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
