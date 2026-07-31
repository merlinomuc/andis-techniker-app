import {FileSearch,Search,Factory,Hash} from 'lucide-react';
export default function TextSearch({values,setValues,mode,setMode,loading,onSearch}){
 const modes=[['identify','Was ist das?'],['troubleshoot','Fehler finden'],['documents','Unterlagen finden'],['replacement','Ersatzteil suchen']];
 const set=(key,value)=>setValues(v=>({...v,[key]:value}));
 return <section className="card"><div className="section-head"><div><span className="eyebrow">TYP SUCHEN</span><h2>Bezeichnung oder Nummer eingeben</h2></div><FileSearch/></div>
 <p className="intro-copy">Meist reicht eine Typ- oder Bestellnummer. Hersteller und Modell kannst du optional ergänzen.</p>
 <label className="searchbox main-search"><Search/><input value={values.query||''} onChange={e=>set('query',e.target.value)} placeholder="z. B. 6ES7 151-3BA23-0AB0"/></label>
 <details className="optional-fields"><summary>Hersteller oder Modell zusätzlich angeben</summary><div className="field-grid text-fields"><label><span><Factory size={14}/> Hersteller</span><input value={values.manufacturer||''} onChange={e=>set('manufacturer',e.target.value)} placeholder="z. B. Siemens"/></label><label><span><Hash size={14}/> Typ / Modell</span><input value={values.model||''} onChange={e=>set('model',e.target.value)} placeholder="z. B. SITOP 24 V / 20 A"/></label></div></details>
 <div className="choice-title">Was möchtest du wissen?</div><div className="choices">{modes.map(([k,l])=><button type="button" className={mode===k?'active':''} onClick={()=>setMode(k)} key={k}>{l}</button>)}</div>
 <div className="search-strategy simple"><b>So sucht die App</b><p><span>1</span> Hersteller und Originalunterlagen</p><p><span>2</span> Seriöse Fachquellen für fehlende Angaben</p></div>
 <button className="primary wide" disabled={loading||!(values.query||values.model||values.manufacturer)} onClick={onSearch}><Search/>Jetzt suchen</button></section>;
}
