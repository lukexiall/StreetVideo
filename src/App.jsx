import { STREETS, STREET_BY_ID } from './data/streets.js';
import { load, save } from './lib/store.js';
import { HomeMap } from './components/HomeMap.jsx';
import { StreetSelect } from './components/StreetSelect.jsx';
import { Designer } from './components/Designer.jsx';
import { SpeciesDB } from './components/SpeciesDB.jsx';
import { Visualise } from './components/Visualise.jsx';
import { Toast, useToast } from './components/ui.jsx';

const { useState, useEffect } = React;

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" className="logo">
      <rect x="1" y="1" width="26" height="26" rx="7" className="logo-bg" />
      <path d="M8 21h12" className="logo-line" />
      <circle cx="10" cy="12" r="4.2" className="logo-crown" />
      <circle cx="18" cy="11" r="5" className="logo-crown alt" />
      <path d="M10 16v5M18 16v5" className="logo-line" />
    </svg>
  );
}

export function App() {
  const [view, setView] = useState(() => load('view', 'home'));
  const [streetId, setStreetId] = useState(() => load('street', 'hindley'));
  const [segId, setSegId] = useState(() => load('seg', 'H21'));
  const [designs, setDesigns] = useState(() => load('designs', {}));
  const [schemes, setSchemes] = useState(() => load('schemes', {}));
  const [crownSize, setCrownSize] = useState(() => load('crown', 'lower'));
  const [toast, notify] = useToast();

  useEffect(() => save('view', view), [view]);
  useEffect(() => save('street', streetId), [streetId]);
  useEffect(() => save('seg', segId), [segId]);
  useEffect(() => save('designs', designs), [designs]);
  useEffect(() => save('schemes', schemes), [schemes]);
  useEffect(() => save('crown', crownSize), [crownSize]);

  const street = STREET_BY_ID[streetId] || STREETS[0];
  const seg = street.segments.find((s) => s.id === segId) || street.segments[0];
  const trees = designs[seg.id] || [];
  const setTrees = (t) => setDesigns((d) => ({ ...d, [seg.id]: t }));

  const goSegment = (id, sid = streetId, withTrees) => {
    setStreetId(sid);
    setSegId(id);
    if (withTrees) setDesigns((d) => ({ ...d, [id]: withTrees }));
    setView('design');
  };

  const nav = [['home', 'Australia'], ['streets', 'Streets'], ['design', 'Designer'], ['species', 'Species database'], ['visualise', 'AI visualisation']];
  const crumbs = [['home', 'Australia'], ['streets', 'South Australia · Adelaide']];
  if (view === 'streets' || view === 'design') crumbs.push(['streets', street.name]);
  if (view === 'design') crumbs.push(['design', `Segment ${seg.id}`]);

  return (
    <div className={`app view-${view}`}>
      <header className="topbar">
        <button className="brand" onClick={() => setView('home')} aria-label="StreetTree Studio home">
          <Logo />
          <span><b>StreetTree</b> Studio</span>
        </button>
        <nav className="mainnav" aria-label="Main">
          {nav.map(([id, label]) => (
            <button key={id} className={view === id ? 'is-on' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}</button>
          ))}
        </nav>
        <span className="version">v0.1 · research prototype</span>
      </header>
      {(view === 'streets' || view === 'design') && (
        <nav className="crumbs" aria-label="Breadcrumb">
          {crumbs.map(([v, l], i) => (
            <span key={i}>
              {i > 0 && <span className="crumb-sep">/</span>}
              <button onClick={() => setView(v)} className={i === crumbs.length - 1 ? 'is-last' : ''}>{l}</button>
            </span>
          ))}
        </nav>
      )}
      <main className="stage">
        {view === 'home' && <HomeMap onOpenSA={() => setView('streets')} />}
        {view === 'streets' && <StreetSelect initialStreet={streetId} onStreet={setStreetId} onDesign={(sid, id) => goSegment(id, sid)} />}
        {view === 'design' && (
          <Designer key={street.id} street={street} seg={seg} trees={trees} setTrees={setTrees} crownSize={crownSize} setCrownSize={setCrownSize}
            schemes={schemes} setSchemes={setSchemes} notify={notify} goSegment={goSegment} openStreet={() => setView('streets')} />
        )}
        {view === 'species' && <SpeciesDB />}
        {view === 'visualise' && <Visualise />}
      </main>
      <Toast toast={toast} />
    </div>
  );
}
