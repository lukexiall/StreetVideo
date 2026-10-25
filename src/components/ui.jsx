const { useState, useEffect } = React;

export function Chip({ tone = 'neutral', children, title }) {
  return (
    <span className={`chip chip-${tone}`} title={title}>
      {children}
    </span>
  );
}

// Provenance tag shown next to every number.
const SOURCE_TONE = { thesis: 'thesis', derived: 'derived', estimate: 'estimate', assumption: 'assumption', missing: 'missing', demo: 'demo' };
const SOURCE_TEXT = { thesis: 'Thesis', derived: 'Derived from thesis', estimate: 'Design estimate', assumption: 'App assumption', missing: 'Not in thesis', demo: 'Demo geometry' };
export function Src({ kind, refText }) {
  return (
    <span className={`src src-${SOURCE_TONE[kind]}`} title={refText || SOURCE_TEXT[kind]}>
      {SOURCE_TEXT[kind]}
      {refText ? <span className="src-ref"> · {refText}</span> : null}
    </span>
  );
}

export function Icon({ name, size = 18 }) {
  const p = {
    undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
    redo: 'm15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
    trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
    cursor: 'm5 3 14 8-6 2-2 6z',
    tree: 'M12 22v-6M7 16a5 5 0 0 1-1-9.9A6 6 0 0 1 17.5 6 4.5 4.5 0 0 1 17 16z',
    copy: 'M8 8h12v12H8zM4 16V4h12',
    close: 'M6 6l12 12M18 6 6 18',
    save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    back: 'M19 12H5M11 6l-6 6 6 6',
    upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
    info: 'M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    layers: 'm12 3 9 5-9 5-9-5zM3 13l9 5 9-5',
    target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    drop: 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  }[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={p} />
    </svg>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.tone || 'info'}`} role="status">
      {toast.text}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.ms || 2600);
    return () => clearTimeout(t);
  }, [toast]);
  return [toast, (text, tone, ms) => setToast({ text, tone, ms, k: Math.random() })];
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function CopyBox({ text, id }) {
  const [state, setState] = useState('Copy');
  const copy = () => {
    const done = () => setState('Copied');
    const fail = () => {
      const el = document.getElementById(id);
      if (el) { el.focus(); el.select(); }
      setState('Press Ctrl/⌘ + C');
    };
    try {
      navigator.clipboard.writeText(text).then(done, fail);
    } catch (e) {
      fail();
    }
  };
  return (
    <div className="copybox">
      <textarea id={id} readOnly value={text} spellCheck="false" />
      <button className="btn btn-primary" onClick={copy}>
        <Icon name="copy" size={16} /> {state}
      </button>
    </div>
  );
}

export const fmt = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toFixed(d));
