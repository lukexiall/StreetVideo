import { zonesFor, SEGMENT_LENGTH } from '../data/streets.js';
import { crownDiameter } from '../data/species.js';
import { checkPlacement, viewpointFor } from '../lib/metrics.js';
import { TreeGlyph, GlyphDefs } from './TreeGlyph.jsx';
import { Icon } from './ui.jsx';

const { useState, useRef, useEffect, useCallback } = React;

const ZONE_SHORT = { footpath: 'Footpath', parking: 'Parking', lane: 'Lane', median: 'Median' };

export function PlanCanvas({ street, species, speciesById, trees, selectedId, armed, crownSize, showLabels, showViewpoint, viewSide, onAdd, onMoveLive, onMoveEnd, onSelect, notify }) {
  const svgRef = useRef(null);
  const W = street.width;
  const base = { x: -4, y: -3.2, w: W + 8, h: SEGMENT_LENGTH + 6.4 };
  const [vb, setVb] = useState(base);
  const [ghost, setGhost] = useState(null);
  const drag = useRef(null);
  const pan = useRef(null);

  useEffect(() => setVb({ x: -4, y: -3.2, w: street.width + 8, h: SEGMENT_LENGTH + 6.4 }), [street.id]);

  const toWorld = useCallback((e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { u: p.x, v: p.y };
  }, []);

  const zoom = (k, cx, cy) => {
    setVb((b) => {
      const w = Math.min(base.w * 1.6, Math.max(6, b.w * k));
      const h = (w / b.w) * b.h;
      const ox = cx ?? b.x + b.w / 2;
      const oy = cy ?? b.y + b.h / 2;
      return { x: ox - ((ox - b.x) * w) / b.w, y: oy - ((oy - b.y) * h) / b.h, w, h };
    });
  };

  useEffect(() => {
    const svg = svgRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      const p = toWorld(e);
      zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, p.u, p.v);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  });

  const onTreeDown = (e, t) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const p = toWorld(e);
    onSelect(t.id);
    drag.current = { id: t.id, du: t.u - p.u, dv: t.v - p.v, start: { u: t.u, v: t.v }, moved: false, pointer: e.pointerId };
    svgRef.current.setPointerCapture(e.pointerId);
  };

  const onDown = (e) => {
    if (e.button !== 0) return;
    const p = toWorld(e);
    if (armed) {
      const sp = speciesById[armed];
      const chk = checkPlacement(street, p.u, p.v, trees, null, sp, crownSize);
      if (!chk.ok) notify(chk.reason, 'bad');
      else onAdd(Math.round(p.u * 10) / 10, Math.round(p.v * 10) / 10, chk.warnings);
      return;
    }
    onSelect(null);
    pan.current = { x: e.clientX, y: e.clientY, vb, scale: vb.w / svgRef.current.getBoundingClientRect().width };
    svgRef.current.setPointerCapture(e.pointerId);
  };

  const onMove = (e) => {
    if (drag.current) {
      const p = toWorld(e);
      const u = Math.round((p.u + drag.current.du) * 10) / 10;
      const v = Math.round((p.v + drag.current.dv) * 10) / 10;
      drag.current.moved = true;
      onMoveLive(drag.current.id, u, v);
      return;
    }
    if (pan.current) {
      const s = pan.current.scale;
      setVb({ ...pan.current.vb, x: pan.current.vb.x - (e.clientX - pan.current.x) * s, y: pan.current.vb.y - (e.clientY - pan.current.y) * s });
      return;
    }
    if (armed) {
      const p = toWorld(e);
      const chk = checkPlacement(street, p.u, p.v, trees, null, speciesById[armed], crownSize);
      setGhost({ u: p.u, v: p.v, ok: chk.ok });
    }
  };

  const onUp = () => {
    if (drag.current) {
      const d = drag.current;
      drag.current = null;
      if (d.moved) {
        const t = trees.find((x) => x.id === d.id);
        const chk = checkPlacement(street, t.u, t.v, trees, t.id, speciesById[t.speciesId], crownSize);
        if (!chk.ok) {
          onMoveLive(d.id, d.start.u, d.start.v);
          notify(`${chk.reason}. Tree returned to its last position.`, 'bad');
        } else onMoveEnd(d.id, d.start);
      }
    }
    pan.current = null;
  };

  const zones = zonesFor(street);
  const vp = viewpointFor(street, viewSide);
  const lanes = zones.filter((z) => z.kind === 'lane');

  return (
    <div className={`plan ${armed ? 'is-armed' : ''}`}>
      <svg ref={svgRef} className="plan-svg" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => setGhost(null)}
        role="application" aria-label={`Plan of ${street.name} segment`}>
        <GlyphDefs species={species} />
        {/* buildings */}
        <rect x={-40} y={-40} width={40} height={SEGMENT_LENGTH + 80} className="pl-bld" />
        <rect x={W} y={-40} width={40} height={SEGMENT_LENGTH + 80} className="pl-bld" />
        <rect x={-40} y={-40} width={40} height={SEGMENT_LENGTH + 80} fill="url(#hatch)" />
        <rect x={W} y={-40} width={40} height={SEGMENT_LENGTH + 80} fill="url(#hatch)" />
        {zones.map((z) => (
          <rect key={z.i} x={z.u0} y={-40} width={z.width} height={SEGMENT_LENGTH + 80} className={`pl-${z.kind}`} />
        ))}
        {zones.filter((z) => z.kind !== 'lane').map((z) => (
          <g key={'k' + z.i} className="pl-kerb">
            {z.kind !== 'footpath' || z.u0 > 0 ? <line x1={z.u0} x2={z.u0} y1={-40} y2={SEGMENT_LENGTH + 40} /> : null}
            {z.kind !== 'footpath' || z.u1 < W ? <line x1={z.u1} x2={z.u1} y1={-40} y2={SEGMENT_LENGTH + 40} /> : null}
          </g>
        ))}
        {lanes.slice(0, -1).map((z, i) => (Math.abs(z.u1 - lanes[i + 1].u0) < 1e-6 ? <line key={'m' + i} x1={z.u1} x2={z.u1} y1={-40} y2={SEGMENT_LENGTH + 40} className="pl-mark" /> : null))}
        {zones.filter((z) => z.kind === 'parking').map((z) => (
          <g key={'p' + z.i} className="pl-bays">
            {Array.from({ length: 12 }, (_, i) => <line key={i} x1={z.u0} x2={z.u1} y1={-6 + i * 3} y2={-6 + i * 3} />)}
          </g>
        ))}
        {/* outside-segment veil */}
        <rect x={-40} y={-40} width={W + 80} height={40} className="pl-veil" />
        <rect x={-40} y={SEGMENT_LENGTH} width={W + 80} height={40} className="pl-veil" />
        <rect x={0} y={0} width={W} height={SEGMENT_LENGTH} className="pl-site" />
        {/* zone labels */}
        {zones.map((z) => (
          <text key={'l' + z.i} x={z.u0 + z.width / 2} y={-0.9} textAnchor="middle" className="pl-zlabel">
            {z.width < 1.8 ? '' : ZONE_SHORT[z.kind]}
          </text>
        ))}
        {zones.map((z) => (
          <text key={'w' + z.i} x={z.u0 + z.width / 2} y={-2.1} textAnchor="middle" className="pl-dim">
            {z.width.toFixed(1)} m
          </text>
        ))}
        <text x={-0.5} y={SEGMENT_LENGTH / 2} className="pl-side" transform={`rotate(-90 ${-0.5} ${SEGMENT_LENGTH / 2})`} textAnchor="middle">{street.sides[0]} · façade</text>
        <text x={W + 0.5} y={SEGMENT_LENGTH / 2} className="pl-side" transform={`rotate(90 ${W + 0.5} ${SEGMENT_LENGTH / 2})`} textAnchor="middle">{street.sides[1]} · façade</text>
        {/* chainage */}
        {[0, 5, 10, 15, 20].map((v) => (
          <g key={v} className="pl-chain">
            <line x1={-0.25} x2={0.25} y1={v} y2={v} />
            <text x={0.4} y={v + 0.3}>{v}</text>
          </g>
        ))}
        {/* trees */}
        {trees.map((t) => {
          const sp = speciesById[t.speciesId];
          if (!sp) return null;
          return <TreeGlyph key={t.id} tree={t} sp={sp} r={crownDiameter(sp, crownSize) / 2} selected={t.id === selectedId} labels={showLabels} onPointerDown={(e) => onTreeDown(e, t)} />;
        })}
        {armed && ghost && (
          <TreeGlyph tree={{ id: 'ghost', u: ghost.u, v: ghost.v }} sp={speciesById[armed]} r={crownDiameter(speciesById[armed], crownSize) / 2} ghost invalid={!ghost.ok} />
        )}
        {/* viewpoint */}
        {showViewpoint && (
          <g className="pl-vp" transform={`translate(${vp.u},${vp.v})`} pointerEvents="none">
            {[0, 90, 180, 270].map((h) => (
              <path key={h} d="M0,0 L-2.4,-2.4 A3.4,3.4 0 0 1 2.4,-2.4 Z" transform={`rotate(${180 - h})`} className="pl-vp-wedge" />
            ))}
            <circle r={0.45} />
          </g>
        )}
        {/* scale bar */}
        <g className="pl-scale" transform={`translate(${W - 5.5},${SEGMENT_LENGTH + 1.6})`}>
          <rect width={2.5} height={0.35} />
          <rect x={2.5} width={2.5} height={0.35} className="alt" />
          <text y={1.4}>0</text>
          <text x={5} y={1.4} textAnchor="end">5 m</text>
        </g>
        <text x={0} y={SEGMENT_LENGTH + 2.1} className="pl-dim">20 m segment · along-street {street.orientation}</text>
      </svg>
      <div className="zoom-ctl">
        <button className="icon-btn" onClick={() => zoom(1 / 1.25)} aria-label="Zoom in"><Icon name="plus" /></button>
        <button className="icon-btn" onClick={() => zoom(1.25)} aria-label="Zoom out"><Icon name="minus" /></button>
        <button className="icon-btn" onClick={() => setVb(base)} aria-label="Fit segment"><Icon name="fit" /></button>
      </div>
    </div>
  );
}
