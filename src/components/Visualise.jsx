import { Icon } from './ui.jsx';

const { useState } = React;

export function Visualise() {
  const [img, setImg] = useState(null);
  const [err, setErr] = useState('');
  const onFile = (f) => {
    setErr('');
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('Choose a JPG or PNG photo of a street.'); return; }
    const r = new FileReader();
    r.onload = () => setImg({ src: r.result, name: f.name });
    r.readAsDataURL(f);
  };
  return (
    <div className="visualise">
      <header className="page-head">
        <p className="eyebrow">AI street visualisation · planned</p>
        <h1>Photo-based planting previews</h1>
        <p className="lede">The next version will take a real street photo and a saved scheme, and generate an image of the street with the proposed trees, following the controlled image-editing approach used for the Chapter 6 survey videos. Image generation is not connected yet, so nothing is sent anywhere.</p>
      </header>
      <div className="vis-grid">
        <label className={`drop ${img ? 'has-img' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
          <input id="vis-upload" type="file" accept="image/*" onChange={(e) => onFile(e.target.files[0])} />
          {img ? <img src={img.src} alt={`Uploaded street photo ${img.name}`} /> : (
            <span className="drop-empty"><Icon name="upload" size={28} /><b>Add a street photo</b><span>Drop a JPG or PNG here, or click to choose. It stays in this browser.</span></span>
          )}
        </label>
        <div className="panel">
          <h3>Planned workflow</h3>
          <ol className="steps">
            <li>Upload a street-level photo of the segment.</li>
            <li>Choose Scheme A, B or C from the designer.</li>
            <li>Mark tree positions on the photo.</li>
            <li>Generate a preview and compare it with the original.</li>
          </ol>
          <button className="btn btn-primary" disabled title="Image generation is not connected in this version">Generate preview (coming soon)</button>
          {err && <p className="err">{err}</p>}
          {img && <p className="fine">Loaded {img.name}. Generation will be available once an image service is connected.</p>}
        </div>
      </div>
    </div>
  );
}
