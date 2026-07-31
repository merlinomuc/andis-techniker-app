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
function taskLabel(mode){return({identify:'Produkt identifizieren',troubleshoot:'Fehlerbild und sichere Prüfschritte erklären',documents:'offizielle Unterlagen und Anschlussinformationen finden',replacement:'Originalteil, Nachfolger und Ersatzmöglichkeiten prüfen'})[mode]||'Produkt identifizieren';}

async function executeSearch({input,instructions,domains=[],context='medium',max=2600}){
  const openai=getOpenAI();
  const tool={type:'web_search',search_context_size:context};
  if(domains.length) tool.filters={allowed_domains:domains};
  return openai.responses.create({model:process.env.OPENAI_RESEARCH_MODEL||'gpt-5-mini',store:false,tools:[tool],instructions,input,max_output_tokens:max});
}

async function runSearch({input,instructions,domains=[],context='medium',max=2600,phase='research'}){
  let response=await executeSearch({input,instructions,domains,context,max});
  let retried=false;let acceptedPartial=false;
  if(isTokenLimit(response)){
    retried=true;
    response=await executeSearch({
      input:`${input}\n\nDie vorige Antwort war zu lang. Liefere jetzt ausschließlich die wichtigsten belegten Ergebnisse.`,
      instructions:`${instructions}\n\nWIEDERHOLUNGSVERSUCH: maximal 5 kurze Abschnitte, maximal 4 Stichpunkte je Abschnitt, keine Wiederholungen, höchstens 5 Quellen. Produktidentifikation, offizielle Dokumente und der nächste praktische Schritt haben Vorrang.`,
      domains,context:context==='high'?'medium':context,max:5200
    });
  }
  if(response?.status==='failed')throw new AppError('RESEARCH_FAILED_RESPONSE','Die Produktsuche konnte nicht abgeschlossen werden.',502,response.error);
  if(response?.status==='incomplete'){
    const partial=textFrom(response);
    if(partial.length>=160)acceptedPartial=true;
    else throw new AppError('RESEARCH_INCOMPLETE_RESPONSE','Die Recherche wurde trotz eines zweiten Versuchs nicht vollständig abgeschlossen.',502,response.incomplete_details);
  }
  const answer=textFrom(response);
  if(!answer)throw new AppError('RESEARCH_EMPTY_RESPONSE','Die Produktsuche lieferte keinen verwertbaren Inhalt.',502);
  return {answer:acceptedPartial?`${answer}\n\n> Hinweis: Die Antwort wurde technisch gekürzt; die wichtigsten verfügbaren Angaben wurden übernommen.`:answer,response,sources:sourcesFrom(response,domains.length?'official':'additional').slice(0,5),meta:{phase,retried,acceptedPartial,status:response.status||'completed',reason:response.incomplete_details?.reason||null}};
}

async function safePhase(options){
  try{return {ok:true,value:await runSearch(options)};}
  catch(error){return {ok:false,error};}
}

export async function researchProduct(input){
  const normalized=normalizeIdentifiers({...input,query:input.query||'',rawText:input.rawText||''});const d=normalized.data;
  if(!d.manufacturer&&!d.partNumber&&!d.model&&!d.productFamily&&!d.query)throw new AppError('RESEARCH_MISSING_IDENTIFIERS','Bitte Hersteller, Typ, Modell oder Bestellnummer eingeben.',400);
  const seed=seedText(d,input);const phases=[];const warnings=[];

  const officialOptions=normalized.domains.length?{
    phase:'manufacturer',domains:normalized.domains,context:'medium',max:2600,
    input:`Suche ausschließlich in den zugelassenen offiziellen Herstellerdomains nach diesem technischen Produkt.\n\n${seed}`,
    instructions:`Du bist die Hersteller-Recherche von Andis Techniker-App. ${normalized.officialHint} Suche exakt nach Typ, Modell und Bestellnummer. Aufgabe: ${taskLabel(input.mode)}. Antworte auf Deutsch und kompakt mit ## Offizieller Treffer, ## Kerndaten, ## Offizielle Dokumente, ## Nächster Schritt. Nenne nur belegte Angaben.`
  }:{
    phase:'manufacturer-discovery',context:'medium',max:2300,
    input:`Ermittle zuerst den wahrscheinlichsten Hersteller und die offizielle Produktbezeichnung. Suche nach einer Herstellerseite oder einem Originaldokument.\n\n${seed}`,
    instructions:`Identifiziere Hersteller, Produktfamilie und exakten Typ. Bevorzuge offizielle Herstellerseiten. Aufgabe: ${taskLabel(input.mode)}. Antworte auf Deutsch und knapp mit ## Hersteller, ## Exakter Suchbegriff, ## Offizielle Anhaltspunkte, ## Unsicherheit.`
  };
  const officialRun=await safePhase(officialOptions);
  const official=officialRun.ok?officialRun.value:null;
  if(official){phases.push({id:'manufacturer',label:normalized.domains.length?'Beim Hersteller gesucht':'Hersteller ermittelt',status:'completed',domains:normalized.domains,sourceCount:official.sources.length,retried:official.meta.retried});}
  else {phases.push({id:'manufacturer',label:'Herstellersuche nicht abgeschlossen',status:'warning',domains:normalized.domains,sourceCount:0,retried:false});warnings.push('Die offizielle Herstellersuche war vorübergehend nicht vollständig. Die App hat mit weiteren Fachquellen weitergesucht.');}

  const broadRun=await safePhase({phase:'extended',context:'medium',max:3400,
    input:`Recherchiere das technische Produkt von innen nach außen. Ausgangsdaten:\n${seed}\n\nHerstellerinformationen:\n${official?.answer||'Noch kein bestätigter offizieller Treffer.'}`,
    instructions:`Du bist die ergänzende Recherche von Andis Techniker-App. Reihenfolge: 1) Hersteller und Originalunterlagen bestätigen, 2) autorisierte Distributoren und seriöse technische Kataloge, 3) weitere belastbare Quellen. Aufgabe: ${taskLabel(input.mode)}. Antworte auf Deutsch, kompakt und praxisnah mit ## Produktidentifikation, ## Kerndaten, ## Dokumente, ## Ersatzteil/Nachfolger, ## Nächster Schritt. Maximal 4 Stichpunkte je Abschnitt.`
  });
  const broad=broadRun.ok?broadRun.value:null;
  if(broad)phases.push({id:'extended',label:'Weitere Fachquellen geprüft',status:'completed',domains:[],sourceCount:broad.sources.length,retried:broad.meta.retried});
  else {phases.push({id:'extended',label:'Weitere Fachquellen nicht abgeschlossen',status:'warning',domains:[],sourceCount:0,retried:false});warnings.push('Die ergänzende Suche konnte nicht vollständig abgeschlossen werden. Vorhandene Herstellerangaben werden trotzdem angezeigt.');}

  if(!official&&!broad)throw (broadRun.error||officialRun.error||new AppError('RESEARCH_FAILED_RESPONSE','Die Recherche konnte nicht abgeschlossen werden.',502));
  const combined=[official?.answer?`# Herstellerangaben\n${official.answer}`:'',broad?.answer?`# Ergänzende Recherche\n${broad.answer}`:''].filter(Boolean).join('\n\n');
  const retried=Boolean(official?.meta.retried||broad?.meta.retried);
  const notices=[retried?'Eine zu lange Recherche wurde automatisch kompakter wiederholt.':'',...warnings].filter(Boolean);
  return {status:'success',answer:combined,sources:mergeSources(official?.sources,broad?.sources),officialSources:official?.sources||[],additionalSources:broad?.sources||[],provider:normalized.provider,normalized:d,searchPhases:phases,notice:notices.join(' '),debug:{model:process.env.OPENAI_RESEARCH_MODEL||'gpt-5-mini',officialResponseId:official?.response.id||null,broadResponseId:broad?.response.id||null,officialMeta:official?.meta||null,broadMeta:broad?.meta||null,usage:{official:official?.response.usage||null,broad:broad?.response.usage||null}}};
}

export async function researchText(input){
  const normalized=normalizeIdentifiers({query:input.query,manufacturer:input.manufacturer||'',model:input.model||input.query,partNumber:input.partNumber||'',productFamily:input.productFamily||'',rawText:input.query});
  return researchProduct({...normalized.data,query:input.query,mode:input.mode||'identify',rawText:input.query});
}
