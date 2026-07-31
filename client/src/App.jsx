import {useEffect,useMemo,useState} from 'react';
import {Cpu,Gauge,Search,ShieldAlert,Tags,Wrench,Camera,Keyboard,CheckCircle2,Factory,Globe2,LoaderCircle} from 'lucide-react';
import ImageUploader from './components/ImageUploader.jsx';
import RecognitionEditor from './components/RecognitionEditor.jsx';
import ResearchResult from './components/ResearchResult.jsx';
import TextSearch from './components/TextSearch.jsx';
import {useImageTools} from './hooks/useImageTools.js';
import {readVision,researchProduct,researchText} from './services/api.js';

const focuses=[['auto','Automatisch'],['device','Gerät'],['label','Etikett / Typenschild'],['display','Display / Fehlercode']];
const modes=[['identify','Was ist das?'],['troubleshoot','Fehler finden'],['documents','Unterlagen finden'],['replacement','Ersatzteil suchen']];
const friendlyErrors={
  RESEARCH_INCOMPLETE_RESPONSE:['Recherche nicht vollständig','Die Suche war ungewöhnlich umfangreich. Bitte starte sie noch einmal oder ergänze eine genauere Typ- oder Bestellnummer.'],
  RESEARCH_EMPTY_RESPONSE:['Keine verwertbaren Treffer','Die Suche hat noch keine brauchbaren Angaben geliefert. Prüfe bitte Hersteller oder Typnummer.'],
  OPENAI_NOT_CONFIGURED:['App noch nicht eingerichtet','Der API-Schlüssel fehlt auf dem Server.'],
  API_RETURNED_NON_JSON:['Veraltete App-Version erkannt','Bitte die App schließen, neu öffnen und gegebenenfalls den Browser-Cache leeren.'],
  VISION_EMPTY_RESPONSE:['Bild konnte nicht gelesen werden','Bitte versuche eine hellere, nähere Aufnahme des Typenschilds.']
};

function FriendlyError({error}){
  const [title,message]=friendlyErrors[error?.code]||['Das hat leider nicht geklappt',error?.message||'Bitte versuche es noch einmal.'];
  return <section className="error-card card"><ShieldAlert/><div><b>{title}</b><p>{message}</p><details><summary>Technische Details</summary><pre>{JSON.stringify(error,null,2)}</pre></details></div></section>;
}

function ResearchProgress({kind='search'}){
  const [index,setIndex]=useState(0);
  const steps=kind==='vision'
    ? ['Foto wird vorbereitet','Beschriftungen werden gelesen','Hersteller und Typ werden erkannt']
    : ['Zuerst beim Hersteller suchen','Offizielle Unterlagen prüfen','Weitere Fachquellen ergänzen'];
  useEffect(()=>{setIndex(0);const id=setInterval(()=>setIndex(i=>Math.min(i+1,steps.length-1)),1800);return()=>clearInterval(id)},[kind]);
  return <section className="card simple-progress"><div className="progress-heading"><LoaderCircle className="spin"/><div><b>{kind==='vision'?'Foto wird ausgewertet':'Wir suchen die passenden Informationen'}</b><span>Du musst nichts weiter tun.</span></div></div>{steps.map((s,i)=><div className={`simple-step ${i<index?'done':i===index?'active':''}`} key={s}>{i<index?<CheckCircle2/>:i===index?<LoaderCircle className="spin"/>:<span className="step-dot"/>}<span>{s}</span></div>)}</section>;
}

export default function App(){
  const tools=useImageTools();
  const[source,setSource]=useState('text');
  const[query,setQuery]=useState('');
  const[textValues,setTextValues]=useState({query:'',manufacturer:'',model:''});
  const[focus,setFocus]=useState('auto');
  const[mode,setMode]=useState('identify');
  const[step,setStep]=useState('capture');
  const[vision,setVision]=useState(null);
  const[values,setValues]=useState({});
  const[research,setResearch]=useState(null);
  const[loading,setLoading]=useState(false);
  const[researching,setResearching]=useState(false);
  const[error,setError]=useState(null);
  const canRead=tools.images.length>0;

  async function read(){if(!canRead)return;setLoading(true);setError(null);try{const data=await readVision({images:tools.images,focus,query});setVision(data);setValues(data.identifiers||{});setStep('recognition');}catch(e){setError({message:e.message,code:e.code,details:e.details});}finally{setLoading(false)}}
  async function researchNow(){setResearching(true);setError(null);try{const data=await researchProduct({...values,query,rawText:vision?.rawText?.join('\n')||'',mode});setResearch(data);setStep('result');}catch(e){setError({message:e.message,code:e.code,details:e.details});}finally{setResearching(false)}}
  async function textSearch(){setLoading(true);setError(null);try{const data=await researchText({...textValues,query:textValues.query||textValues.model||textValues.manufacturer,mode});setResearch(data);setValues(data.normalized||textValues);setStep('result');}catch(e){setError({message:e.message,code:e.code,details:e.details});}finally{setLoading(false)}}
  function reset(){tools.clear();setQuery('');setTextValues({query:'',manufacturer:'',model:''});setFocus('auto');setMode('identify');setVision(null);setValues({});setResearch(null);setError(null);setStep('capture');window.scrollTo({top:0,behavior:'smooth'})}
  const status=useMemo(()=>step==='capture'?(source==='text'?'TYP SUCHEN':'FOTO LESEN'):step==='recognition'?'ANGABEN PRÜFEN':'ERGEBNIS',[step,source]);

  return <><header><div className="brand"><div className="logo"><Wrench/></div><div><h1>ANDIS</h1><p>TECHNIKER-APP</p></div></div><div className="release-badge"><strong>V3.2</strong><small>EINFACH & STABIL</small></div></header><main>
    <section className="hero card"><div className="system-line"><Cpu/> TECHNISCHER ASSISTENT <b>{status}</b></div><div className="release-strip"><span>NEU</span><b>Einfachere Bedienung und automatische Rettung zu langer Recherchen</b></div><h2>Technik erkennen – ohne Fachsuche.</h2><p>Typ eingeben oder Foto aufnehmen. Die App sucht zuerst beim Hersteller und ergänzt danach passende Fachquellen.</p>{step==='capture'&&<div className="source-switch"><button className={source==='text'?'active':''} onClick={()=>setSource('text')}><Keyboard/> Typ eingeben</button><button className={source==='image'?'active':''} onClick={()=>setSource('image')}><Camera/> Foto aufnehmen</button></div>}<div className="pipeline"><span className={step==='capture'?'active':''}>1 Eingeben</span><span className={step==='recognition'?'active':''}>2 Prüfen</span><span className={step==='result'?'active':''}>3 Ergebnis</span></div></section>
    {error&&<FriendlyError error={error}/>} 
    {(loading||researching)&&<ResearchProgress kind={loading&&source==='image'?'vision':'search'}/>} 
    {step==='capture'&&source==='text'&&!loading&&<TextSearch values={textValues} setValues={setTextValues} mode={mode} setMode={setMode} loading={loading} onSearch={textSearch}/>} 
    {step==='capture'&&source==='image'&&!loading&&<section className="card"><div className="section-head"><div><span className="eyebrow">FOTOANALYSE</span><h2>Gerät oder Typenschild fotografieren</h2></div><Tags/></div><p className="intro-copy">Ein Gesamtfoto plus eine Nahaufnahme der Beschriftung liefern meist das beste Ergebnis.</p><label className="searchbox"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Optional: Hersteller oder sichtbare Nummer"/></label><div className="choice-title">Was ist auf dem Foto?</div><div className="choices">{focuses.map(([k,l])=><button className={focus===k?'active':''} onClick={()=>setFocus(k)} key={k}>{l}</button>)}</div><div className="choice-title">Was möchtest du wissen?</div><div className="choices">{modes.map(([k,l])=><button className={mode===k?'active':''} onClick={()=>setMode(k)} key={k}>{l}</button>)}</div><ImageUploader tools={tools} onCode={code=>{setQuery(code);setTextValues(v=>({...v,query:code}))}}/><button className="primary wide" disabled={!canRead||loading} onClick={read}><Gauge/>Foto auswerten</button><p className="cost-note">Die Internetsuche startet erst, nachdem du die erkannten Angaben geprüft hast.</p></section>}
    {step==='recognition'&&!researching&&<RecognitionEditor vision={vision} values={values} setValues={setValues} researching={researching} onResearch={researchNow} onBack={()=>setStep('capture')}/>} 
    {step==='result'&&<ResearchResult research={research} recognition={values} onNew={reset}/>}<section className="safety card"><ShieldAlert/><div><b>Sicher arbeiten</b><p>KI-Angaben prüfen. Herstellerunterlagen und betriebliche Vorgaben haben Vorrang.</p></div></section></main></>;
}
