import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { marked } from 'marked';
import { Camera, Images, ScanLine, Search, Wrench, FileText, RefreshCw, ShieldAlert, X, History, Trash2, Check, LoaderCircle, CircleAlert, ImagePlus, Cpu, Gauge, ChevronRight, Tags, PackageSearch, MonitorDot } from 'lucide-react';

const modes = [
  ['identify', 'Identifizieren', Search], ['troubleshoot', 'Fehler suchen', Wrench],
  ['documents', 'Dokumente', FileText], ['replacement', 'Ersatzteil', RefreshCw]
];
const progressSteps = [
  ['upload', 'Bilder und Angaben werden übermittelt'], ['quality', 'Bildqualität wird geprüft'],
  ['object', 'Objektart, Logos und Texte werden erkannt'], ['model', 'Hersteller und Modell werden eingegrenzt'],
  ['sources', 'Technische Quellen werden geprüft']
];
const MAX_IMAGES = 4;
const focusOptions = [
  ['auto', 'Automatisch', PackageSearch],
  ['device', 'Gerät', Wrench],
  ['label', 'Etikett / Typenschild', Tags],
  ['display', 'Display / Fehlercode', MonitorDot]
];

function App() {
  const [mode, setMode] = useState('identify');
  const [query, setQuery] = useState('');
  const [imageFocus, setImageFocus] = useState('auto');
  const [images, setImages] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [error, setError] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('andi-history') || '[]'));
  const videoRef = useRef(null); const controlsRef = useRef(null); const progressTimerRef = useRef(null);
  const cameraRef = useRef(null); const galleryRef = useRef(null);

  useEffect(() => () => { controlsRef.current?.stop(); clearInterval(progressTimerRef.current); }, []);

  async function compressImage(file) {
    if (!file.type.startsWith('image/')) throw new Error('Bitte nur Bilddateien auswählen.');
    if (file.size > 15 * 1024 * 1024) throw new Error('Ein Bild ist größer als 15 MB.');
    const raw = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = raw; });
    const max = 2400; const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .9);
  }

  async function addImages(fileList) {
    try {
      const remaining = MAX_IMAGES - images.length;
      const files = [...(fileList || [])].slice(0, remaining);
      if (!files.length) return;
      const data = await Promise.all(files.map(compressImage));
      setImages(prev => [...prev, ...data].slice(0, MAX_IMAGES)); setError(''); setResult(null);
    } catch (e) { setError(e.message); }
  }

  async function openScanner() {
    setScannerOpen(true); setError('');
    setTimeout(async () => {
      try {
        const reader = new BrowserMultiFormatReader();
        controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current, scanResult => {
          if (scanResult) { setQuery(scanResult.getText()); controlsRef.current?.stop(); setScannerOpen(false); }
        });
      } catch { setScannerOpen(false); setError('Kamera konnte nicht geöffnet werden. Bitte Kameraberechtigung und HTTPS prüfen.'); }
    }, 80);
  }
  function closeScanner() { controlsRef.current?.stop(); setScannerOpen(false); }
  function startProgress() { setProgressIndex(0); clearInterval(progressTimerRef.current); progressTimerRef.current = setInterval(() => setProgressIndex(i => Math.min(i + 1, progressSteps.length - 1)), 1250); }

  async function analyze() {
    if (!query.trim() && images.length === 0) return setError('Bitte Foto, Code oder Bezeichnung hinzufügen.');
    setLoading(true); setError(''); setResult(null); startProgress();
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: query.trim(), mode, imageFocus, images }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Analyse fehlgeschlagen.');
      setProgressIndex(progressSteps.length); setResult(data);
      const entry = { id: Date.now(), query: query || 'Fotoanalyse', mode, imageFocus, ...data, date: new Date().toLocaleString('de-DE') };
      const next = [entry, ...history].slice(0, 8); setHistory(next); localStorage.setItem('andi-history', JSON.stringify(next));
    } catch (e) { setError(e.message); } finally { clearInterval(progressTimerRef.current); setLoading(false); }
  }

  function reset() { setQuery(''); setImages([]); setImageFocus('auto'); setResult(null); setError(''); }
  function openHistory(item) { setQuery(item.query === 'Fotoanalyse' ? '' : item.query); setMode(item.mode); setImageFocus(item.imageFocus || 'auto'); setResult(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function clearHistory() { setHistory([]); localStorage.removeItem('andi-history'); }

  return <>
    <header><div className="brand"><div className="logo"><Wrench /></div><div><h1>ANDIS</h1><p>TECHNIKER-APP</p></div></div><span className="version">V1.4</span></header>
    <main>
      <section className="hero card tech-grid">
        <div className="system-line"><Cpu size={15}/> TECHNISCHER ASSISTENT <span>ONLINE</span></div>
        <h2>Was möchtest du untersuchen?</h2>
        <p>Gesamtansicht und Detailfotos gemeinsam liefern meist die beste Erkennung.</p>
        <div className="modes">{modes.map(([key,label,Icon]) => <button key={key} className={mode===key?'active':''} onClick={()=>setMode(key)}><Icon size={19}/><span>{label}</span></button>)}</div>
        <label className="text-input"><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Hersteller, Typ, Code oder Fehler eingeben"/></label>

        <div className="focus-block">
          <div className="focus-title"><Tags size={17}/><div><strong>Was ist hauptsächlich auf dem Bild?</strong><span>„Automatisch“ passt meistens. Bei kleinen Schildern Etikettenmodus wählen.</span></div></div>
          <div className="focus-options">{focusOptions.map(([key,label,Icon]) => <button key={key} className={imageFocus===key?'active':''} onClick={()=>setImageFocus(key)}><Icon size={17}/><span>{label}</span></button>)}</div>
        </div>

        <div className="capture-grid three">
          <button className="capture-button" onClick={()=>cameraRef.current?.click()}><Camera/><strong>Foto aufnehmen</strong><span>Kamera öffnen</span></button>
          <button className="capture-button" onClick={()=>galleryRef.current?.click()}><Images/><strong>Galerie</strong><span>Bilder auswählen</span></button>
          <button className="capture-button" onClick={openScanner}><ScanLine/><strong>Code scannen</strong><span>QR oder Barcode</span></button>
        </div>
        <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={e=>{addImages(e.target.files); e.target.value='';}}/>
        <input ref={galleryRef} hidden type="file" accept="image/*" multiple onChange={e=>{addImages(e.target.files); e.target.value='';}}/>

        {images.length > 0 && <div className="image-panel"><div className="image-panel-head"><strong>{images.length} von {MAX_IMAGES} Bildern</strong><span>Gesamtansicht · Typenschild · Rückseite</span></div><div className="previews">{images.map((src,i)=><div className="preview" key={i}><img src={src} alt={`Technisches Detail ${i+1}`}/><span>{i+1}</span><button aria-label="Bild entfernen" onClick={()=>setImages(v=>v.filter((_,n)=>n!==i))}><X size={17}/></button></div>)}{images.length<MAX_IMAGES&&<button className="add-more" onClick={()=>galleryRef.current?.click()}><ImagePlus/><span>Weiteres Bild</span></button>}</div></div>}
        {error && <div className="error"><CircleAlert size={18}/>{error}</div>}
        <button className="analyze" onClick={analyze} disabled={loading}>{loading ? <><span className="spinner"/> Analyse läuft …</> : <><Gauge size={20}/> Jetzt analysieren <ChevronRight size={20}/></>}</button>
        {(query||images.length||result)&&<button className="reset" onClick={reset}>Eingabe zurücksetzen</button>}
      </section>

      {loading&&<section className="card progress-card"><div className="progress-title"><LoaderCircle className="rotating"/><div><strong>Analyse läuft</strong><p>Nur echte Arbeitsschritte – keine zusätzlichen KI-Aufrufe.</p></div></div><div className="progress-list">{progressSteps.map(([key,label],index)=>{const done=index<progressIndex,active=index===progressIndex;return <div className={`progress-row ${done?'done':''} ${active?'active':''}`} key={key}><span className="progress-icon">{done?<Check size={15}/>:active?<LoaderCircle size={15} className="rotating"/>:<span/>}</span><span>{label}</span></div>})}</div></section>}

      {result&&<>{result.imageAssessment&&<section className={`card assessment ${result.imageAssessment.usable?'good':'warning'}`}>{result.imageAssessment.usable?<Check/>:<CircleAlert/>}<div><strong>{result.imageAssessment.usable?'Bilder sind auswertbar':'Bilder reichen nicht für eine sichere Erkennung'}</strong><p>{result.imageAssessment.message}</p>{result.imageAssessment.nextPhoto&&<p className="next-photo"><ImagePlus size={16}/><b>Nächstes Foto:</b> {result.imageAssessment.nextPhoto}</p>}</div></section>}
      <section className="card result"><div className="result-head"><div><span className="eyebrow">ANALYSEERGEBNIS</span><h2>Technische Auswertung</h2></div><ShieldAlert size={28}/></div>
      {(result.imageType || result.extractedIdentifiers?.length>0) && <div className="label-readout"><div className="label-readout-head"><Tags size={18}/><div><span>ERKANNTER BILDTYP</span><strong>{result.imageType || 'Unbekannt'}</strong></div></div>{result.extractedIdentifiers?.length>0&&<div className="identifier-grid">{result.extractedIdentifiers.map((item,i)=><div className="identifier" key={`${item.label}-${i}`}><span>{item.label}</span><strong>{item.value}</strong><small className={`confidence ${item.confidence||'mittel'}`}>{item.confidence||'mittel'}</small></div>)}</div>}</div>}
      <div className="markdown" dangerouslySetInnerHTML={{__html:marked.parse(result.answer)}}/>{result.recognitionBasis?.length>0&&<details className="recognition"><summary>Warum dieses Ergebnis?</summary><ul>{result.recognitionBasis.map((x,i)=><li key={i}>{x}</li>)}</ul></details>}{result.sources?.length>0&&<div className="sources"><h3>Gefundene Quellen</h3>{result.sources.map((s,i)=><a key={s.url} href={s.url} target="_blank" rel="noreferrer"><span>{i+1}</span><div><strong>{s.title}</strong><small>{new URL(s.url).hostname}</small></div><ChevronRight size={17}/></a>)}</div>}</section></>}
      <section className="safety card"><ShieldAlert/><div><strong>Sicher arbeiten</strong><p>KI-Angaben prüfen. Herstellerunterlagen und betriebliche Vorgaben haben Vorrang.</p></div></section>
      {history.length>0&&<section className="history card"><div className="history-head"><div><History size={20}/><h2>Letzte Analysen</h2></div><button onClick={clearHistory}><Trash2 size={17}/> Löschen</button></div>{history.map(item=><button className="history-item" key={item.id} onClick={()=>openHistory(item)}><strong>{item.query}</strong><span>{item.date}</span></button>)}</section>}
    </main>
    {scannerOpen&&<div className="scanner"><div className="scanner-top"><strong>Code in den Rahmen halten</strong><button onClick={closeScanner}><X/></button></div><video ref={videoRef}/><div className="scan-frame"/><p>QR-Code, EAN, Data Matrix und weitere Formate</p></div>}
  </>;
}
export default App;
