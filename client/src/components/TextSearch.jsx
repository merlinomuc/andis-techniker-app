import {FileSearch,Search,Factory,Hash} from 'lucide-react';
export default function TextSearch({values,setValues,mode,setMode,loading,onSearch}){
 const modes=[['identify','Identifizieren'],['troubleshoot','Fehler suchen'],['documents','Dokumente'],['replacement','Ersatzteil']];
 const set=(key,value)=>setValues(v=>({...v,[key]:value}));
 return <section className="card"><div className="section-head"><div><span className="eyebrow">TYP- UND TEXTSUCHE</span><h2>Hersteller, Typ oder Nummer suchen</h2></div><FileSearch/></div>
 <p className="intro-copy">Die Suche beginnt bei bekannten Herstellerquellen und erweitert sich anschließend auf seriöse technische Kataloge und weitere Internetquellen.</p>
 <label className="searchbox main-search"><Search/><input value={values.query||''} onChange={e=>set('query',e.target.value)} placeholder="z. B. Siemens 6ES7 151-3BA23-0AB0 oder Fehler F30021"/></label>
 <div className="field-grid text-fields"><label><span><Factory size={14}/> Hersteller, falls bekannt</span><input value={values.manufacturer||''} onChange={e=>set('manufacturer',e.target.value)} placeholder="z. B. Siemens"/></label><label><span><Hash size={14}/> Typ / Modell / Bestellnummer</span><input value={values.model||''} onChange={e=>set('model',e.target.value)} placeholder="z. B. 6ES7 151-3BA23-0AB0"/></label></div>
 <div className="choice-title">Was wird benötigt?</div><div className="choices">{modes.map(([k,l])=><button type="button" className={mode===k?'active':''} onClick={()=>setMode(k)} key={k}>{l}</button>)}</div>
 <div className="search-strategy"><b>Suchstrategie</b><ol><li>Hersteller und offizielle Dokumente</li><li>Autorisierte Distributoren und technische Kataloge</li><li>Weitere belastbare Quellen für fehlende Informationen</li></ol></div>
 <button className="primary wide" disabled={loading||!(values.query||values.model||values.manufacturer)} onClick={onSearch}><Search/>{loading?'Hersteller und Internet werden durchsucht …':'Typ jetzt suchen'}</button></section>;
}
