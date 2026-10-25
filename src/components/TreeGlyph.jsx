// Plan-view tree symbols. Each form has its own crown outline and texture so
// species read differently on the plan. Purely illustrative.

function seeded(seed) {
  let x = 0;
  for (const c of String(seed)) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

function lobed(r, n, amp, rnd, jitter = 0.04) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const rr = r * (1 - amp + rnd() * jitter);
    const am = (a0 + a1) / 2;
    const p0 = [Math.cos(a0) * rr, Math.sin(a0) * rr];
    const c = [Math.cos(am) * (r * (1 + amp * 0.6)), Math.sin(am) * (r * (1 + amp * 0.6))];
    pts.push({ p0, c });
  }
  let d = `M${pts[0].p0[0].toFixed(2)},${pts[0].p0[1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const nx = pts[(i + 1) % n].p0;
    d += `Q${pts[i].c[0].toFixed(2)},${pts[i].c[1].toFixed(2)} ${nx[0].toFixed(2)},${nx[1].toFixed(2)}`;
  }
  return d + 'Z';
}

export function crownShape(form, r, seed) {
  const rnd = seeded(seed);
  switch (form) {
    case 'eucalypt': {
      const blobs = [];
      const k = 6;
      for (let i = 0; i < k; i++) {
        const a = (i / k) * Math.PI * 2 + rnd() * 0.6;
        const dist = r * (0.42 + rnd() * 0.12);
        const br = r * (0.4 + rnd() * 0.14);
        blobs.push({ x: Math.cos(a) * dist, y: Math.sin(a) * dist, r: br });
      }
      blobs.push({ x: 0, y: 0, r: r * 0.45 });
      return { blobs };
    }
    case 'feathery':
      return { path: lobed(r, 26, 0.07, rnd, 0.08), fine: true };
    case 'weeping': {
      let d = '';
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = i % 2 ? r : r * (0.78 + rnd() * 0.06);
        d += `${i ? 'L' : 'M'}${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)}`;
      }
      return { path: d + 'Z', weeping: true };
    }
    case 'vase':
      return { path: lobed(r, 9, 0.1, rnd), rings: true };
    case 'oval':
      return { path: lobed(r, 12, 0.06, rnd) };
    default:
      return { path: lobed(r, 14, 0.09, rnd) };
  }
}

export function TreeGlyph({ tree, sp, r, selected, ghost, invalid, onPointerDown, labels }) {
  const shape = crownShape(sp.form, r, tree.id + sp.id);
  const fillId = `g-${sp.id}`;
  const cls = `tree ${selected ? 'is-selected' : ''} ${ghost ? 'is-ghost' : ''} ${invalid ? 'is-invalid' : ''}`;
  const body = shape.blobs ? (
    shape.blobs.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r={b.r} />)
  ) : (
    <path d={shape.path} />
  );
  return (
    <g className={cls} transform={`translate(${tree.u},${tree.v})`} onPointerDown={onPointerDown} data-tree={tree.id}>
      <g className="tree-shadow" transform={`translate(${r * 0.12},${r * 0.12})`}>{body}</g>
      <g className="tree-crown" fill={invalid ? 'var(--bad)' : `url(#${fillId})`} stroke={sp.color}>
        {body}
      </g>
      {shape.fine && (
        <g className="tree-texture">
          {[0.35, 0.62].map((k) => (
            <circle key={k} r={r * k} fill="none" strokeDasharray={`${r * 0.08} ${r * 0.12}`} />
          ))}
        </g>
      )}
      {shape.rings && <circle className="tree-texture" r={r * 0.5} fill="none" />}
      {shape.weeping && (
        <g className="tree-texture">
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return <line key={i} x1={0} y1={0} x2={Math.cos(a) * r * 0.75} y2={Math.sin(a) * r * 0.75} />;
          })}
        </g>
      )}
      <circle className="tree-trunk" r={0.35} />
      {selected && <circle className="tree-ring" r={r + 0.35} />}
      {labels && !ghost && (
        <text className="tree-label" y={-r - 0.5} textAnchor="middle">
          {sp.name}
        </text>
      )}
    </g>
  );
}

export function GlyphDefs({ species }) {
  return (
    <defs>
      {species.map((sp) => (
        <radialGradient key={sp.id} id={`g-${sp.id}`} cx="38%" cy="35%" r="75%">
          <stop offset="0%" stopColor={sp.color} stopOpacity="0.55" />
          <stop offset="70%" stopColor={sp.color} stopOpacity="0.82" />
          <stop offset="100%" stopColor={sp.color} stopOpacity="0.95" />
        </radialGradient>
      ))}
      <pattern id="hatch" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="1.2" className="hatch-line" />
      </pattern>
    </defs>
  );
}

// Small standalone icon used in the species library.
export function SpeciesIcon({ sp, size = 44 }) {
  const r = 9;
  return (
    <svg width={size} height={size} viewBox="-11 -11 22 22" aria-hidden="true" className="sp-icon">
      <GlyphDefs species={[sp]} />
      <TreeGlyph tree={{ id: 'icon', u: 0, v: 0 }} sp={sp} r={r} />
    </svg>
  );
}
