import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { marked } from 'marked';
import { Camera, ScanLine, Search, Wrench, FileText, RefreshCw, ShieldAlert, X, History, Trash2 } from 'lucide-react';

const modes = [
  ['identify', 'Identifizieren', Search],
  ['troubleshoot', 'Fehler suchen', Wrench],
  ['documents', 'Dokumente', FileText],
  ['replacement', 'Ersatzteil', RefreshCw]
];

function App() {
  const [mode, setMode] = useState('identify');
  const [query, setQuery] = useState('');
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('andi-history') || '[]'));
  const videoRef = useRef(null);
  const controlsRef = useRef(null);

  useEffect(() => () => controlsRef.current?.stop(), []);

  async function fileToDataUrl(file) {
    if (file.size > 9 * 1024 * 1024) throw new Error('Das Bild ist größer als 9 MB. Bitte kleiner aufnehmen.');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function chooseImage(file) {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setImage(dataUrl); setPreview(dataUrl); setError('');
    } catch (e) { setError(e.message); }
  }

  async function openScanner() {
    setScannerOpen(true); setError('');
    setTimeout(async () => {
      try {
        const reader = new BrowserMultiFormatReader();
        controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current, (scanResult) => {
          if (scanResult) {
            setQuery(scanResult.getText());
            controlsRef.current?.stop();
            setScannerOpen(false);
          }
        });
      } catch {
        setScannerOpen(false);
        setError('Kamera konnte nicht geöffnet werden. Bitte Kameraberechtigung und HTTPS prüfen.');
      }
    }, 80);
  }

  function closeScanner() { controlsRef.current?.stop(); setScannerOpen(false); }

  async function analyze() {
    if (!query.trim() && !image) return setError('Bitte Foto, Code oder Bezeichnung hinzufügen.');
    setLoading(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), mode, imageDataUrl: image || undefined })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analyse fehlgeschlagen.');
      setResult(data);
      const entry = { id: Date.now(), query: query || 'Fotoanalyse', mode, answer: data.answer, sources: data.sources, date: new Date().toLocaleString('de-DE') };
      const next = [entry, ...history].slice(0, 8);
      setHistory(next); localStorage.setItem('andi-history', JSON.stringify(next));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function reset() { setQuery(''); setImage(null); setPreview(''); setResult(null); setError(''); }
  function openHistory(item) { setQuery(item.query === 'Fotoanalyse' ? '' : item.query); setMode(item.mode); setResult(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function clearHistory() { setHistory([]); localStorage.removeItem('andi-history'); }

  return <>
    <header><div className="brand"><div className="logo"><Wrench /></div><div><h1>Andis Techniker-App</h1><p>Erkennen · Verstehen · Reparieren</p></div></div></header>
    <main>
      <section className="hero card">
        <span className="eyebrow">Technischer Assistent</span>
        <h2>Was möchtest du untersuchen?</h2>
        <p>Fotografiere Typenschild oder Bauteil, scanne einen Code oder gib Hersteller und Typ ein.</p>

        <div className="modes">{modes.map(([key, label, Icon]) => <button key={key} className={mode === key ? 'active' : ''} onClick={() => setMode(key)}><Icon size={19}/><span>{label}</span></button>)}</div>

        <label className="text-input"><Search size={20}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="z. B. Siemens 6ES7..., Fehler E17 oder Barcode" /></label>

        <div className="capture-grid">
          <label className="capture-button"><Camera/><strong>Foto aufnehmen</strong><span>Kamera oder Galerie</span><input type="file" accept="image/*" capture="environment" onChange={e => chooseImage(e.target.files?.[0])}/></label>
          <button className="capture-button" onClick={openScanner}><ScanLine/><strong>Code scannen</strong><span>QR- oder Barcode</span></button>
        </div>

        {preview && <div className="preview"><img src={preview} alt="Ausgewähltes Bauteil"/><button onClick={() => {setImage(null);setPreview('')}}><X size={18}/></button></div>}
        {error && <div className="error">{error}</div>}
        <button className="analyze" onClick={analyze} disabled={loading}>{loading ? <><span className="spinner"/> Analyse läuft …</> : 'Jetzt analysieren'}</button>
        {(query || image || result) && <button className="reset" onClick={reset}>Eingabe zurücksetzen</button>}
      </section>

      {loading && <section className="card status"><div className="pulse"/><div><strong>Bauteil wird ausgewertet</strong><p>Bildmerkmale, Bezeichnungen und passende Quellen werden geprüft.</p></div></section>}

      {result && <section className="card result">
        <div className="result-head"><div><span className="eyebrow">Analyseergebnis</span><h2>Technische Auswertung</h2></div><ShieldAlert size={28}/></div>
        <div className="markdown" dangerouslySetInnerHTML={{ __html: marked.parse(result.answer) }}/>
        {result.sources?.length > 0 && <div className="sources"><h3>Gefundene Quellen</h3>{result.sources.map((s, i) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer"><span>{i + 1}</span><div><strong>{s.title}</strong><small>{new URL(s.url).hostname}</small></div></a>)}</div>}
      </section>}

      <section className="safety card"><ShieldAlert/><div><strong>Sicher arbeiten</strong><p>KI-Angaben prüfen. Herstellerunterlagen, Freischaltregeln und betriebliche Vorgaben haben Vorrang.</p></div></section>

      {history.length > 0 && <section className="history card"><div className="history-head"><div><History size={20}/><h2>Letzte Analysen</h2></div><button onClick={clearHistory}><Trash2 size={17}/> Löschen</button></div>{history.map(item => <button className="history-item" key={item.id} onClick={() => openHistory(item)}><strong>{item.query}</strong><span>{item.date}</span></button>)}</section>}
    </main>

    {scannerOpen && <div className="scanner"><div className="scanner-top"><strong>Code in den Rahmen halten</strong><button onClick={closeScanner}><X/></button></div><video ref={videoRef}/><div className="scan-frame"/><p>QR-Code, EAN, Data Matrix und viele weitere Formate</p></div>}
  </>;
}

export default App;
