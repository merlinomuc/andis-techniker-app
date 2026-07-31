import {marked} from 'marked';
import {ExternalLink,Search,ShieldAlert,Factory,Globe2,CheckCircle2,Sparkles} from 'lucide-react';
function SourceGroup({title,icon:Icon,sources}){if(!sources?.length)return null;return <details className="source-accordion"><summary><Icon size={18}/>{title}<span>{sources.length}</span></summary><div className="sources">{sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer"><div><b>{s.title}</b><small>{new URL(s.url).hostname}</small></div><ExternalLink/></a>)}</div></details>}
export default function ResearchResult({research,recognition,onNew}){return <section className="card result-card"><div className="section-head"><div><span className="eyebrow">ERGEBNIS</span><h2>Das wurde gefunden</h2></div><ShieldAlert/></div>
 <div className="confirmed"><b>{recognition?.manufacturer||research.normalized?.manufacturer||'Technisches Produkt'} {recognition?.productFamily||research.normalized?.productFamily||''}</b><span>{recognition?.partNumber||recognition?.model||research.normalized?.partNumber||research.normalized?.model||''}</span></div>
 {research.notice&&<div className="retry-notice"><Sparkles/><span>{research.notice}</span></div>}
 {research.searchPhases?.length>0&&<div className="phase-list">{research.searchPhases.map(p=><div key={p.id} className="done"><CheckCircle2/><span><b>{p.label}</b><small>{p.sourceCount} passende Quellen{p.retried?' · automatisch gekürzt':''}</small></span></div>)}</div>}
 <div className="markdown" dangerouslySetInnerHTML={{__html:marked.parse(research.answer)}}/>
 <SourceGroup title="Offizielle Herstellerquellen" icon={Factory} sources={research.officialSources}/><SourceGroup title="Weitere technische Quellen" icon={Globe2} sources={research.additionalSources}/>
 <button className="primary wide" onClick={onNew}><Search/>Neue Suche</button><details className="debug"><summary>Technische Diagnose</summary><pre>{JSON.stringify(research.debug,null,2)}</pre></details></section>}
