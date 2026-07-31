import { getOpenAI, inspectResponse } from './openai.js';
import { normalizeIdentifiers } from '../providers/index.js';
import { AppError } from '../utils/errors.js';
function sourcesFrom(response) { const out=new Map(); for(const item of response.output||[]){ if(item.type==='web_search_call') for(const s of item.action?.sources||[]) if(s.url) out.set(s.url,{title:s.title||s.url,url:s.url}); if(item.type==='message') for(const c of item.content||[]) for(const a of c.annotations||[]){const s=a.url_citation;if(s?.url) out.set(s.url,{title:s.title||s.url,url:s.url});}} return [...out.values()].slice(0,10); }
export async function researchProduct(input) {
  const normalized=normalizeIdentifiers({...input,rawText:input.rawText||''}); const d=normalized.data;
  if(!d.manufacturer && !d.partNumber && !d.model && !d.productFamily) throw new AppError('RESEARCH_MISSING_IDENTIFIERS','Für die Recherche fehlen Hersteller, Modell oder Bestellnummer.',400);
  const openai=getOpenAI();
  const response=await openai.responses.create({
    model:process.env.OPENAI_RESEARCH_MODEL||'gpt-5-mini', store:false,
    tools:[{type:'web_search'}],
    instructions:`Du bist technischer Produktrechercheur. ${normalized.researchHint} Verwende nur die bestätigten Angaben. Erfinde keine Zeichen. Trenne gesicherte Herstellerangaben von Vermutungen. Antworte auf Deutsch in Markdown mit: ## Produkt, ## Technische Einordnung, ## Offizielle Dokumente, ## Nächste Schritte.`,
    input:`Hersteller: ${d.manufacturer}\nProduktfamilie: ${d.productFamily}\nBestellnummer: ${d.partNumber}\nModell: ${d.model}\nSeriennummer: ${d.serialNumber}\nAufgabe: ${input.mode||'identify'}`,
    max_output_tokens:1400
  });
  const answer=inspectResponse(response); if(!answer) throw new AppError('RESEARCH_EMPTY_RESPONSE','Die Produktrecherche lieferte keinen Inhalt.',502);
  return {status:'success',answer,sources:sourcesFrom(response),provider:normalized.provider,debug:{model:process.env.OPENAI_RESEARCH_MODEL||'gpt-5-mini',responseStatus:response.status,responseId:response.id,usage:response.usage||null}};
}
