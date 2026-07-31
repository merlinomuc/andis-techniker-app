import { getOpenAI } from './openai.js';
import { normalizeIdentifiers } from '../providers/index.js';
import { AppError } from '../utils/errors.js';

function sourcesFrom(response, tier='additional') {
  const out=new Map();
  for(const item of response.output||[]){
    if(item.type==='web_search_call') for(const s of item.action?.sources||[]) if(s.url) out.set(s.url,{title:s.title||s.url,url:s.url,tier});
    if(item.type==='message') for(const c of item.content||[]) for(const a of c.annotations||[]){
      const s=a.url_citation;if(s?.url) out.set(s.url,{title:s.title||s.url,url:s.url,tier});
    }
  }
  return [...out.values()];
}
function mergeSources(...groups){const map=new Map();for(const group of groups)for(const s of group||[])if(s.url&&!map.has(s.url))map.set(s.url,s);return[...map.values()].slice(0,10);}
function seedText(d,input){return [`Freitext/Typ: ${input.query||''}`,`Hersteller: ${d.manufacturer||''}`,`Produktfamilie: ${d.productFamily||''}`,`Bestellnummer: ${d.partNumber||''}`,`Modell/Typ: ${d.model||''}`,`Seriennummer: ${d.serialNumber||''}`,`Fehlercode: ${d.errorCode||''}`,input.rawText?`Gelesener Rohtext: ${input.rawText}`:''].filter(Boolean).join('\n');}
function isTokenLimit(response){return response?.status==='incomplete'&&response?.incomplete_details?.reason==='max_output_tokens';}
function textFrom(response){return response?.output_text?.trim()||'';}

async function executeSearch({input,instructions,domains=[],context='medium',max=2200}){
  const openai=getOpenAI();
  const tool={type:'web_search',search_context_size:context};
  if(domains.length) tool.filters={allowed_domains:domains};
  return openai.responses.create({
    model:process.env.OPENAI_RESEARCH_MODEL||'gpt-5-mini',store:false,tools:[tool],instructions,input,max_output_tokens:max
  });
}

async function runSearch({input,instructions,domains=[],context='medium',max=2200,phase='research'}){
  let response=await executeSearch({input,instructions,domains,context,max});
  let retried=false;
  let acceptedPartial=false;

  if(isTokenLimit(response)){
    retried=true;
    const compactInstructions=`${instructions}\n\nWICHTIGER WIEDERHOLUNGSVERSUCH: Antworte sehr kompakt. Maximal 6 kurze Abschnitte, höchstens 5 Stichpunkte je Abschnitt, keine Wiederholungen, maximal 5 wichtigste Quellen. Priorisiere eindeutige Produktidentifikation, offizielle Dokumente und konkrete Technikerhinweise.`;
    response=await executeSearch({
      input:`${input}\n\nDie vorherige Antwort war zu lang. Fasse die Recherche jetzt streng priorisiert und kurz zusammen.`,
      instructions:compactInstructions,
      domains,
      context:context==='high'?'medium':context,
      max:4000
    });
  }

  if(response?.status==='failed') throw new AppError('RESEARCH_FAILED_RESPONSE','Die Produktsuche konnte nicht abgeschlossen werden.',502,response.error);
  if(response?.status==='incomplete'){
    const partial=textFrom(response);
    if(partial.length>=250){acceptedPartial=true;}
    else throw new AppError('RESEARCH_INCOMPLETE_RESPONSE','Die Recherche wurde trotz eines zweiten Versuchs nicht vollständig abgeschlossen.',502,response.incomplete_details);
  }

  const answer=textFrom(response);
  if(!answer)throw new AppError('RESEARCH_EMPTY_RESPONSE','Die Produktsuche lieferte keinen verwertbaren Inhalt.',502);
  return{
    answer:acceptedPartial?`${answer}\n\n> Hinweis: Die Rechercheantwort wurde gekürzt. Die wichtigsten gefundenen Angaben wurden übernommen.`:answer,
    response,
    sources:sourcesFrom(response,domains.length?'official':'additional').slice(0,5),
    meta:{phase,retried,acceptedPartial,status:response.status||'completed',reason:response.incomplete_details?.reason||null}
  };
}

export async function researchProduct(input){
  const normalized=normalizeIdentifiers({...input,query:input.query||'',rawText:input.rawText||''});const d=normalized.data;
  if(!d.manufacturer&&!d.partNumber&&!d.model&&!d.productFamily&&!d.query)throw new AppError('RESEARCH_MISSING_IDENTIFIERS','Bitte Hersteller, Typ, Modell oder Bestellnummer eingeben.',400);
  const seed=seedText(d,input);const phases=[];let official=null;

  if(normalized.domains.length){
    official=await runSearch({phase:'manufacturer',domains:normalized.domains,context:'medium',max:2200,input:`Suche ausschließlich in den zugelassenen offiziellen Herstellerdomains nach diesem technischen Produkt.\n\n${seed}`,instructions:`Du bist die offizielle Hersteller-Recherchephase. ${normalized.officialHint} Suche exakt nach Typ, Modell und Bestellnummer. Antworte auf Deutsch und kompakt mit: ## Offizieller Treffer, ## Wichtigste technische Daten, ## Offizielle Dokumente, ## Status oder Nachfolger. Nenne nur belegte Angaben und sage klar, wenn etwas nicht offiziell bestätigt ist.`});
    phases.push({id:'manufacturer',label:'Beim Hersteller gesucht',status:'completed',domains:normalized.domains,sourceCount:official.sources.length,retried:official.meta.retried});
  } else {
    official=await runSearch({phase:'manufacturer-discovery',context:'medium',max:1800,input:`Ermittle zuerst den wahrscheinlichsten Hersteller und die offizielle Produktbezeichnung für diese technische Eingabe. Suche nach einer offiziellen Herstellerseite oder einem Originaldokument.\n\n${seed}`,instructions:`Identifiziere zuerst Hersteller, Produktfamilie und exakten Typ. Bevorzuge offizielle Herstellerseiten und Originaldokumente. Antworte auf Deutsch und knapp mit: ## Wahrscheinlicher Hersteller, ## Exakter Suchbegriff, ## Offizielle Anhaltspunkte, ## Unsicherheit.`});
    phases.push({id:'manufacturer',label:'Hersteller ermittelt',status:'completed',domains:[],sourceCount:official.sources.length,retried:official.meta.retried});
  }

  const broad=await runSearch({phase:'extended',context:'medium',max:2800,input:`Recherchiere das technische Produkt stufenweise. Ausgangsdaten:\n${seed}\n\nBereits gefundene Herstellerinformationen:\n${official?.answer||'Kein bestätigter offizieller Treffer vorhanden.'}`,instructions:`Du bist die zweite Recherchephase von Andis Techniker-App. Gehe von innen nach außen vor: 1) Hersteller und offizielle Unterlagen bestätigen, 2) autorisierte Distributoren und seriöse technische Kataloge, 3) erst danach weitere belastbare Quellen. Antworte auf Deutsch, kompakt und praxisnah mit: ## Produktidentifikation, ## Wichtigste technische Daten, ## Dokumente, ## Ersatzteile oder Nachfolger, ## Nächster sinnvoller Schritt. Höchstens 5 Stichpunkte pro Abschnitt, keine Wiederholungen. Aufgabe: ${input.mode||'identify'}.`});
  phases.push({id:'extended',label:'Weitere Fachquellen geprüft',status:'completed',domains:[],sourceCount:broad.sources.length,retried:broad.meta.retried});

  const combined=[official?.answer?`# Herstellerangaben\n${official.answer}`:'',`# Ergänzende Recherche\n${broad.answer}`].filter(Boolean).join('\n\n');
  return{status:'success',answer:combined,sources:mergeSources(official?.sources,broad.sources),officialSources:official?.sources||[],additionalSources:broad.sources,provider:normalized.provider,normalized:d,searchPhases:phases,notice:(official.meta.retried||broad.meta.retried)?'Eine zu lange Recherche wurde automatisch kompakter wiederholt.':'',debug:{model:process.env.OPENAI_RESEARCH_MODEL||'gpt-5-mini',officialResponseId:official?.response.id||null,broadResponseId:broad.response.id,officialMeta:official.meta,broadMeta:broad.meta,usage:{official:official?.response.usage||null,broad:broad.response.usage||null}}};
}

export async function researchText(input){
  const normalized=normalizeIdentifiers({query:input.query,manufacturer:input.manufacturer||'',model:input.model||input.query,partNumber:input.partNumber||'',productFamily:input.productFamily||'',rawText:input.query});
  return researchProduct({...normalized.data,query:input.query,mode:input.mode||'identify',rawText:input.query});
}
