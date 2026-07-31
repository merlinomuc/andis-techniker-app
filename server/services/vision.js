import { getOpenAI, inspectResponse } from './openai.js';
import { AppError } from '../utils/errors.js';
import { normalizeIdentifiers } from '../providers/index.js';

const schema = {
  type:'object', additionalProperties:false,
  properties:{
    imageType:{type:'string'}, objectClass:{type:'string'}, rawText:{type:'array',items:{type:'string'}},
    identifiers:{type:'object',additionalProperties:false,properties:{manufacturer:{type:'string'},productFamily:{type:'string'},partNumber:{type:'string'},model:{type:'string'},serialNumber:{type:'string'},errorCode:{type:'string'}},required:['manufacturer','productFamily','partNumber','model','serialNumber','errorCode']},
    confidence:{type:'string',enum:['hoch','mittel','niedrig']},
    imageAssessment:{type:'object',additionalProperties:false,properties:{usable:{type:'boolean'},message:{type:'string'},nextPhoto:{type:'string'}},required:['usable','message','nextPhoto']},
    recognitionBasis:{type:'array',items:{type:'string'}}
  }, required:['imageType','objectClass','rawText','identifiers','confidence','imageAssessment','recognitionBasis']
};
const baseInstructions = `Du liest technische Fotos präzise. Transkribiere sichtbaren Klartext exakt, auch seitlich oder gedreht. Ein Karton mit Produktetikett ist ein gültiges Ziel. Priorisiere Hersteller, Produktfamilie, MLFB/Bestellnummer, P/N, TYPE, MODEL, Seriennummer und Fehlercode. Ergänze niemals fehlende Zeichen. Unsichere Zeichen mit ? kennzeichnen. Bei Siemens erkenne insbesondere Nummern, die mit 6ES7, 6SL, 3RT oder 7ML beginnen.`;

async function requestVision({images, focus, query, retry=false}) {
  const openai = getOpenAI();
  const content = [{type:'input_text', text:`${baseInstructions}\nBildfokus: ${focus}. Nutzereingabe: ${query || '(keine)'}. ${retry ? 'Zweiter Leseversuch: Behandle das Bild bevorzugt als Dokument/Etikett und lies Zeile für Zeile.' : ''}`}];
  images.forEach(image => content.push({type:'input_image', image_url:image, detail: focus === 'label' || retry ? 'high' : 'auto'}));
  return openai.responses.create({
    model: process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini', store:false,
    input:[{role:'user',content}],
    text:{format:{type:'json_schema',name:'technical_vision_read',strict:true,schema}},
    max_output_tokens:1600
  });
}
function parseVision(text) {
  try { return JSON.parse(text.replace(/^```json\s*/i,'').replace(/\s*```$/,'')); }
  catch (error) { throw new AppError('VISION_PARSE_FAILED','Die Bildantwort konnte nicht strukturiert ausgewertet werden.',502,{preview:text.slice(0,800),reason:error.message}); }
}
function hasUseful(v) { const i=v?.identifiers||{}; return Boolean(v?.rawText?.length || Object.values(i).some(Boolean) || (v?.objectClass && !/^unbekannt$/i.test(v.objectClass))); }
export async function readVision(input) {
  let response = await requestVision(input); let text = inspectResponse(response); let retry=false;
  if (!text) throw new AppError('VISION_EMPTY_RESPONSE','Die Bilderkennung lieferte keinen Text.',502);
  let vision = parseVision(text);
  if (!hasUseful(vision)) { retry=true; response=await requestVision({...input,retry:true}); text=inspectResponse(response); if (!text) throw new AppError('VISION_EMPTY_RETRY','Auch der zweite Leseversuch war leer.',502); vision=parseVision(text); }
  const rawText = (vision.rawText || []).join('\n');
  const normalized = normalizeIdentifiers({...vision.identifiers, rawText});
  vision.identifiers = normalized.data;
  return { status:hasUseful(vision)?'success':'needs_better_image', ...vision, provider:normalized.provider, debug:{retry,model:process.env.OPENAI_VISION_MODEL||'gpt-4.1-mini',responseStatus:response.status,usage:response.usage||null,responseId:response.id} };
}
