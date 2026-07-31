import { getOpenAI, inspectResponse } from './openai.js';
import { normalizeIdentifiers } from '../providers/index.js';
import { AppError } from '../utils/errors.js';

function sourcesFrom(response, tier='additional') { const out=new Map(); for(const item of response.output||[]){ if(item.type==='web_search_call') for(const s of item.action?.sources||[]) if(s.url) out.set(s.url,{title:s.title||s.url,url:s.url,tier}); if(item.type==='message') for(const c of item.content||[]) for(const a of c.annotations||[]){const s=a.url_citation;if(s?.url) out.set(s.url,{title:s.title||s.url,url:s.url,tier});}} return [...out.values()]; }
function mergeSources(...groups){const map=new Map();for(const group of groups)for(const s of group||[])if(s.url&&!map.has(s.url))map.set(s.url,s);return[...map.values()].slice(0,16);}
function seedText(d,input){return [`Freitext/Typ: ${input.query||''}`,`Hersteller: ${d.manufacturer||''}`,`Produktfamilie: ${d.productFamily||''}`,`Bestellnummer: ${d.partNumber||''}`,`Modell/Typ: ${d.model||''}`,`Seriennummer: ${d.serialNumber||''}`,`Fehlercode: ${d.errorCode||''}`,input.rawText?`Gelesener Rohtext: ${input.rawText}`:''].filter(Boolean).join('\n');}
async function runSearch({input,instructions,domains=[],context='medium',max=1200}){
  const openai=getOpenAI();
  const tool={type:'web_search',search_context_size:context};
  if(domains.length) tool.filters={allowed_domains:domains};
  const response=await openai.responses.create({model:process.env.OPENAI_RESEARCH_MODEL||'gpt-5-mini',store:false,tools:[tool],instructions,input,max_output_tokens:max});
  const answer=inspectResponse(response);if(!answer)throw new AppError('RESEARCH_EMPTY_RESPONSE','Die Produktsuche lieferte keinen Inhalt.',502);
  return{answer,response,sources:sourcesFrom(response,domains.length?'official':'additional')};
}

export async function researchProduct(input){
  const normalized=normalizeIdentifiers({...input,query:input.query||'',rawText:input.rawText||''});const d=normalized.data;
  if(!d.manufacturer&&!d.partNumber&&!d.model&&!d.productFamily&&!d.query)throw new AppError('RESEARCH_MISSING_IDENTIFIERS','Bitte Hersteller, Typ, Modell oder Bestellnummer eingeben.',400);
  const seed=seedText(d,input);const phases=[];let official=null;

  if(normalized.domains.length){
    official=await runSearch({domains:normalized.domains,context:'high',max:1300,input:`Suche ausschließlich in den zugelassenen offiziellen Herstellerdomains nach diesem technischen Produkt.\n\n${seed}`,instructions:`Du bist die offizielle Hersteller-Recherchephase. ${normalized.officialHint} Suche exakt nach Typ, Modell und Bestellnummer. Liefere auf Deutsch: ## Offizieller Treffer, ## Gesicherte technische Daten, ## Offizielle Dokumente, ## Status/Abkündigung/Nachfolger. Sage klar, wenn ein Punkt offiziell nicht belegt ist.`});
    phases.push({id:'manufacturer',label:'Herstellerquellen',status:'completed',domains:normalized.domains,sourceCount:official.sources.length});
  } else {
    official=await runSearch({context:'medium',max:900,input:`Ermittle zuerst den wahrscheinlichsten Hersteller und die offizielle Produktbezeichnung für diese technische Eingabe. Suche nach einer offiziellen Herstellerseite oder einem Originaldokument.\n\n${seed}`,instructions:`Du bist die Hersteller-Ermittlungsphase. Identifiziere zuerst Hersteller, Produktfamilie und exakten Typ. Bevorzuge offizielle Herstellerseiten und Originaldokumente. Gib auf Deutsch knapp an: ## Wahrscheinlicher Hersteller, ## Exakter Suchbegriff, ## Offizielle Anhaltspunkte, ## Unsicherheit.`});
    phases.push({id:'manufacturer',label:'Hersteller ermitteln',status:'completed',domains:[],sourceCount:official.sources.length});
  }

  const broad=await runSearch({context:'high',max:1700,input:`Recherchiere das technische Produkt stufenweise. Ausgangsdaten:\n${seed}\n\nBereits gefundene Herstellerinformationen:\n${official?.answer||'Kein bestätigter offizieller Treffer vorhanden.'}`,instructions:`Du bist die zweite Recherchephase von Andis Techniker-App. Gehe von innen nach außen vor: 1) Hersteller und offizielle Unterlagen bestätigen, 2) autorisierte Distributoren und seriöse technische Kataloge, 3) erst danach weitere belastbare Quellen. Ergänze fehlende Informationen, aber widersprich offiziellen Daten nicht. Kennzeichne jede unsichere Zuordnung. Antworte auf Deutsch mit ## Produktidentifikation, ## Technische Daten, ## Dokumente und Anleitungen, ## Ersatzteile/Nachfolger, ## Hinweise für Techniker, ## Unsicherheiten. Bevorzuge Originaldokumente, Datenblätter und Handbücher. Aufgabe des Nutzers: ${input.mode||'identify'}.`});
  phases.push({id:'extended',label:'Erweiterte Internetsuche',status:'completed',domains:[],sourceCount:broad.sources.length});

  const combined=[official?.answer?`# Herstellerrecherche\n${official.answer}`:'',`# Erweiterte Recherche\n${broad.answer}`].filter(Boolean).join('\n\n');
  return{status:'success',answer:combined,sources:mergeSources(official?.sources,broad.sources),officialSources:official?.sources||[],additionalSources:broad.sources,provider:normalized.provider,normalized:d,searchPhases:phases,debug:{model:process.env.OPENAI_RESEARCH_MODEL||'gpt-5-mini',officialResponseId:official?.response.id||null,broadResponseId:broad.response.id,usage:{official:official?.response.usage||null,broad:broad.response.usage||null}}};
}

export async function researchText(input){
  const normalized=normalizeIdentifiers({query:input.query,manufacturer:input.manufacturer||'',model:input.model||input.query,partNumber:input.partNumber||'',productFamily:input.productFamily||'',rawText:input.query});
  return researchProduct({...normalized.data,query:input.query,mode:input.mode||'identify',rawText:input.query});
}
