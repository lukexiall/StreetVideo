import { SPECIES, SPECIES_BY_ID, SPECIES_BY_NAME, SHADE_CLASSES, crownDiameter } from '../data/species.js';
import { canopyCover, gviProxy, attributeSummary, checkPlacement, levelLabel, zoneAt } from '../lib/metrics.js';
import { uid } from '../lib/store.js';
import { PlanCanvas } from './PlanCanvas.jsx';
import { FeedbackPanel, ScenarioPanel, MethodPanel } from './Panels.jsx';
import { SpeciesIcon } from './TreeGlyph.jsx';
import { Icon, Chip, Modal, CopyBox, fmt } from './ui.jsx';

const { useState, useMemo, useEffect, useCallback } = React;

function Library({ armed, setArmed, crownSize }) {
  const [q, setQ] = useState('');
  const list = SPECIES.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="library">
      <div className="lib-head">
        <h3>{armed ? <>Planting <b>{SPECIES_BY_ID[armed].name}</b> · click the street, Esc to stop</> : 'Pick a tree, then click the street'}</h3>
        <input id="lib-search" className="lib-search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search species" />
      </div>
      <div className="lib-row">
        {list.map((sp) => (
          <button key={sp.id} className={`sp-card ${armed === sp.id ? 'is-armed' : ''}`} onClick={() => setArmed(armed === sp.id ? null : sp.id)} aria-pressed={armed === sp.id}
            title={`${sp.name}: ${sp.shade} canopy (${SHADE_CLASSES[sp.shade].range}) · water ${sp.water} · climate ${sp.climate} · preference ${sp.overall.toFixed(2)}`}>
            <SpeciesIcon sp={sp} size={34} />
            <span className="sp-body">
              <span className="sp-name">{sp.name}</span>
              <span className="sp-meta">{sp.shade} · ⌀{fmt(crownDiameter(sp, crownSize), 0)} m</span>
            </span>
          </button>
        ))}
        {!list.length && <p className="fine">No species match.</p>}
      </div>
    </div>
  );
}

function Inspector({ tree, street, crownSize, onReplace, onDelete, onClose }) {
  const sp = SPECIES_BY_ID[tree.speciesId];
  const zone = zoneAt(street, tree.u);
  return (
    <div className="inspector" role="region" aria-label="Selected tree">
      <div className="insp-head">
        <span className="sw" style={{ background: sp.color }} />
        <b>{sp.name}</b>
        <button className="icon-btn" onClick={onClose} aria-label="Deselect"><Icon name="close" size={16} /></button>
      </div>
      <p className="fine">{zone ? zone.label : ''} · crown ⌀{fmt(crownDiameter(sp, crownSize))} m</p>
      <label className="field">
        <span>Change species</span>
        <select id="insp-replace" value={tree.speciesId} onChange={(e) => onReplace(tree.id, e.target.value)}>
          {SPECIES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <button className="btn btn-danger" onClick={() => onDelete(tree.id)}><Icon name="trash" size={16} /> Delete tree</button>
      <p className="fine">Drag the tree to move it.</p>
    </div>
  );
}

export function computeMetrics(street, trees, crownSize, viewSide) {
  return {
    canopy: canopyCover(street, trees, SPECIES_BY_ID, crownSize),
    gvi: gviProxy(street, trees, SPECIES_BY_ID, crownSize, viewSide),
    attrs: attributeSummary(trees, SPECIES_BY_ID),
  };
}

function schemeSummary(s) {
  const a = s.metrics.attrs;
  return {
    where: `${s.streetName} ${s.segId}`,
    trees: s.trees.length,
    species: a.species.join(', ') || '—',
    canopy: `${fmt(s.metrics.canopy.pct)}%`,
    gvi: `≈ ${fmt(Math.min(100, s.existingGvi + s.metrics.gvi.pct))}%`,
    water: s.trees.length ? levelLabel(a.waterMean) : '—',
    climate: s.trees.length ? `${a.climate.High}/${s.trees.length} High` : '—',
    pref: fmt(a.overall, 2),
    crown: s.crownSize,
  };
}

export function exportMarkdown(current, schemes) {
  const rows = [['Current', current], ...['A', 'B', 'C'].filter((k) => schemes[k]).map((k) => [`Scheme ${k}`, schemes[k]])];
  const L = [];
  L.push('# StreetTree Studio – design summary', '');
  L.push(`Generated ${new Date().toLocaleString('en-AU')}`, '');
  L.push('| | Location | Trees | Canopy (design est.) | GVI (indicative) | Water demand | Climate suitability | Public preference (C3.1) |');
  L.push('|---|---|---|---|---|---|---|---|');
  rows.forEach(([n, s]) => {
    const m = schemeSummary(s);
    L.push(`| ${n} | ${m.where} | ${m.trees} | ${m.canopy} | ${m.gvi} | ${m.water} | ${m.climate} | ${m.pref} |`);
  });
  rows.forEach(([n, s]) => {
    L.push('', `## ${n}: ${s.streetName} ${s.segId}`, '');
    L.push(`Measured warm-season GVI ${s.existingGvi}% and 2022 canopy ${s.existingCanopy}% (thesis Table D.2). Crown size setting: ${s.crownSize}.`, '');
    if (!s.trees.length) L.push('No trees placed.');
    s.trees.forEach((t, i) => {
      const sp = SPECIES_BY_ID[t.speciesId];
      L.push(`${i + 1}. ${sp.name} – ${t.u.toFixed(1)} m across, ${t.v.toFixed(1)} m along; water ${sp.water}, climate ${sp.climate}, preference ${sp.overall.toFixed(3)}`);
    });
  });
  L.push('', '## Notes', '');
  L.push('- Species attributes and ratings: thesis Tables 6.1, C2.1–C2.4, C3.1, 8.5.');
  L.push('- Canopy and GVI are design estimates from the app model (crown area from the Table 6.1 shade class; four-view ray-cast GVI proxy). They are not measurements.');
  L.push('- Carriageway layout is demonstration geometry.');
  return L.join('\n');
}

function SchemesPanel({ current, schemes, setSchemes, onLoad, notify, openExport }) {
  const save = (k) => {
    setSchemes({ ...schemes, [k]: { ...current, savedAt: new Date().toISOString() } });
    notify(`Saved as Scheme ${k}`, 'good');
  };
  const keys = ['A', 'B', 'C'];
  const sums = Object.fromEntries(keys.map((k) => [k, schemes[k] ? schemeSummary(schemes[k]) : null]));
  const fields = [['where', 'Segment'], ['trees', 'Trees'], ['canopy', 'Canopy'], ['gvi', 'GVI ≈'], ['water', 'Water'], ['climate', 'Climate'], ['pref', 'Preference']];
  return (
    <div className="schemes">
      <div className="scheme-slots">
        {keys.map((k) => (
          <div key={k} className={`slot ${schemes[k] ? 'is-full' : ''}`}>
            <div className="slot-head"><b>Scheme {k}</b>{schemes[k] && <span className="fine">{new Date(schemes[k].savedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span>}</div>
            <button className="btn btn-sm btn-primary" onClick={() => save(k)}><Icon name="save" size={14} /> {schemes[k] ? 'Overwrite' : 'Save current'}</button>
            {schemes[k] && (
              <div className="slot-actions">
                <button className="btn btn-sm" onClick={() => onLoad(schemes[k])}>Load</button>
                <button className="btn btn-sm btn-ghost" onClick={() => { const n = { ...schemes }; delete n[k]; setSchemes(n); }}>Clear</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="table-wrap">
        <table className="data compare">
          <thead><tr><th /><th>Current</th>{keys.map((k) => <th key={k}>{k}</th>)}</tr></thead>
          <tbody>
            {fields.map(([f, label]) => {
              const cur = schemeSummary(current)[f];
              return (
                <tr key={f}><th scope="row">{label}</th><td>{cur}</td>{keys.map((k) => <td key={k}>{sums[k] ? sums[k][f] : <span className="muted">—</span>}</td>)}</tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button className="btn btn-primary" onClick={openExport}><Icon name="copy" size={16} /> Export design summary</button>
      
    </div>
  );
}

export function Designer({ street, seg, trees, setTrees, crownSize, setCrownSize, schemes, setSchemes, notify, goSegment, openStreet }) {
  const [armed, setArmed] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('feedback');
  const [aboutOpen, setAboutOpen] = useState(false);
  const [viewSide, setViewSide] = useState(0);
  const [showLabels, setShowLabels] = useState(false);
  const [showViewpoint, setShowViewpoint] = useState(false);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => { setPast([]); setFuture([]); setSelectedId(null); }, [seg.id]);

  const commit = useCallback((next, prev = trees) => {
    setPast((p) => [...p.slice(-60), prev]);
    setFuture([]);
    setTrees(next);
  }, [trees, setTrees]);

  const undo = () => { if (!past.length) return; setFuture((f) => [trees, ...f]); setTrees(past[past.length - 1]); setPast(past.slice(0, -1)); };
  const redo = () => { if (!future.length) return; setPast((p) => [...p, trees]); setTrees(future[0]); setFuture(future.slice(1)); };
  const del = (id) => { commit(trees.filter((t) => t.id !== id)); setSelectedId(null); notify('Tree removed'); };
  const replace = (id, speciesId) => {
    const t = trees.find((x) => x.id === id);
    const chk = checkPlacement(street, t.u, t.v, trees, id, SPECIES_BY_ID[speciesId], crownSize);
    commit(trees.map((x) => (x.id === id ? { ...x, speciesId } : x)));
    notify(`Replaced with ${SPECIES_BY_ID[speciesId].name}${chk.warnings.length ? ` · ${chk.warnings[0]}` : ''}`);
  };

  useEffect(() => {
    const k = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'Escape') { setArmed(null); setSelectedId(null); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); del(selectedId); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const metrics = useMemo(() => computeMetrics(street, trees, crownSize, viewSide), [street, trees, crownSize, viewSide]);
  const warnings = useMemo(() => {
    const w = [];
    trees.forEach((t, i) => {
      const chk = checkPlacement(street, t.u, t.v, trees, t.id, SPECIES_BY_ID[t.speciesId], crownSize);
      (chk.warnings || []).forEach((x) => w.push(`Tree ${i + 1} (${SPECIES_BY_ID[t.speciesId].name}): ${x}`));
      if (!chk.ok) w.push(`Tree ${i + 1}: ${chk.reason}`);
    });
    return w;
  }, [street, trees, crownSize]);

  const current = { streetId: street.id, streetName: street.name, segId: seg.id, existingGvi: seg.gvi, existingCanopy: seg.canopy, trees, crownSize, metrics };
  const selected = trees.find((t) => t.id === selectedId);
  const idx = street.segments.findIndex((s) => s.id === seg.id);

  return (
    <div className="designer">
      <div className="d-main">
        <div className="toolbar">
          <div className="tb-group">
            <button className="btn btn-ghost btn-sm" onClick={openStreet}><Icon name="back" size={16} /> {street.name}</button>
            <div className="seg-nav">
              <button className="icon-btn" disabled={idx <= 0} onClick={() => goSegment(street.segments[idx - 1].id)} aria-label="Previous segment">‹</button>
              <b>{seg.id}</b>
              <button className="icon-btn" disabled={idx >= street.segments.length - 1} onClick={() => goSegment(street.segments[idx + 1].id)} aria-label="Next segment">›</button>
            </div>
            {seg.decision && SPECIES_BY_NAME[seg.decision.species] && (
              <button className="chip chip-thesis chip-btn" title={`Thesis decision record (Table D.1): ${seg.decision.action}. ${seg.decision.rationale}`}
                onClick={() => { setArmed(SPECIES_BY_NAME[seg.decision.species].id); setSelectedId(null); }}>
                Thesis suggests {seg.decision.species}
              </button>
            )}
          </div>
          <div className="tb-group">
            <button className="icon-btn" onClick={undo} disabled={!past.length} aria-label="Undo" title="Undo"><Icon name="undo" /></button>
            <button className="icon-btn" onClick={redo} disabled={!future.length} aria-label="Redo" title="Redo"><Icon name="redo" /></button>
            <button className="btn btn-sm btn-ghost" disabled={!trees.length} onClick={() => { commit([]); setSelectedId(null); notify('All trees cleared · Undo restores them'); }}>Clear all</button>
          </div>
        </div>
        <div className="canvas-area">
          <PlanCanvas street={street} species={SPECIES} speciesById={SPECIES_BY_ID} trees={trees} selectedId={selectedId} armed={armed} crownSize={crownSize}
            showLabels={showLabels} showViewpoint={showViewpoint} viewSide={viewSide} notify={notify}
            onSelect={(id) => { setSelectedId(id); if (id) setArmed(null); }}
            onAdd={(u, v, w) => {
              const t = { id: uid(), speciesId: armed, u, v };
              commit([...trees, t]);
              notify(`${SPECIES_BY_ID[armed].name} planted${w.length ? ` · ${w[0]}` : ''}`, w.length ? 'warn' : 'good');
            }}
            onMoveLive={(id, u, v) => setTrees(trees.map((t) => (t.id === id ? { ...t, u, v } : t)))}
            onMoveEnd={(id, start) => { setPast((p) => [...p, trees.map((t) => (t.id === id ? { ...t, ...start } : t))]); setFuture([]); }}
          />
          {selected && <Inspector tree={selected} street={street} crownSize={crownSize} onReplace={replace} onDelete={del} onClose={() => setSelectedId(null)} />}
        </div>
        <Library armed={armed} setArmed={(id) => { setArmed(id); if (id) setSelectedId(null); }} crownSize={crownSize} />
      </div>
      <aside className="d-side" aria-label="Design feedback">
        <div className="tabs" role="tablist">
          {[['feedback', 'Results'], ['scenarios', 'Targets'], ['schemes', 'Schemes A · B · C']].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
          <button className="icon-btn tabs-info" onClick={() => setAboutOpen(true)} aria-label="Settings and method" title="Settings and method"><Icon name="info" /></button>
        </div>
        <div className="side-body">
          {tab === 'feedback' && <FeedbackPanel street={street} seg={seg} trees={trees} metrics={metrics} crownSize={crownSize} viewSide={viewSide} setViewSide={setViewSide} warnings={warnings} openAbout={() => setAboutOpen(true)} />}
          {tab === 'scenarios' && <ScenarioPanel street={street} seg={seg} crownSize={crownSize} viewSide={viewSide} currentTotal={Math.min(100, seg.gvi + metrics.gvi.pct)}
            onApply={(ts, sp) => { commit(ts); setTab('feedback'); notify(`Applied ${ts.length} × ${sp.name} · Undo to go back`, 'good'); }} />}
          {tab === 'schemes' && <SchemesPanel current={current} schemes={schemes} setSchemes={setSchemes} notify={notify} openExport={() => setExportOpen(true)}
            onLoad={(s) => { if (s.segId !== seg.id) goSegment(s.segId, s.streetId, s.trees); else commit(s.trees); setCrownSize(s.crownSize); notify(`Loaded scheme for ${s.streetName} ${s.segId}`); }} />}
        </div>
      </aside>
      {aboutOpen && (
        <Modal title="Settings and method" onClose={() => setAboutOpen(false)} wide>
          <MethodPanel crownSize={crownSize} setCrownSize={setCrownSize} showLabels={showLabels} setShowLabels={setShowLabels} showViewpoint={showViewpoint} setShowViewpoint={setShowViewpoint} />
        </Modal>
      )}
      {exportOpen && (
        <Modal title="Design summary" onClose={() => setExportOpen(false)} wide>
          <p className="fine">Markdown text with the current design and saved schemes. Copy it into a document, email or report.</p>
          <CopyBox id="export-text" text={exportMarkdown(current, schemes)} />
        </Modal>
      )}
    </div>
  );
}
