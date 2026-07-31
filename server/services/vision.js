import { getOpenAI, inspectResponse } from './openai.js';
import { AppError } from '../utils/errors.js';
import { normalizeIdentifiers } from '../providers/index.js';

const schema = {
  type:'object', additionalProperties:false,
  properties:{
    imageType:{type:'string',maxLength:80},
    objectClass:{type:'string',maxLength:120},
    rawText:{type:'array',maxItems:16,items:{type:'string',maxLength:180}},
    identifiers:{type:'object',additionalProperties:false,properties:{
      manufacturer:{type:'string',maxLength:100},productFamily:{type:'string',maxLength:120},
      partNumber:{type:'string',maxLength:100},model:{type:'string',maxLength:100},
      serialNumber:{type:'string',maxLength:100},errorCode:{type:'string',maxLength:80}
    },required:['manufacturer','productFamily','partNumber','model','serialNumber','errorCode']},
    confidence:{type:'string',enum:['hoch','mittel','niedrig']},
    imageAssessment:{type:'object',additionalProperties:false,properties:{
      usable:{type:'boolean'},message:{type:'string',maxLength:180},nextPhoto:{type:'string',maxLength:180}
    },required:['usable','message','nextPhoto']},
    recognitionBasis:{type:'array',maxItems:4,items:{type:'string',maxLength:160}}
  },
  required:['imageType','objectClass','rawText','identifiers','confidence','imageAssessment','recognitionBasis']
};

const baseInstructions = `Du liest technische Fotos präzise und knapp. Transkribiere nur identifikationsrelevanten Klartext, auch seitlich oder gedreht. Ein Karton mit Produktetikett ist ein gültiges Ziel. Priorisiere Hersteller, Produktfamilie, MLFB/Bestellnummer, P/N, TYPE, MODEL, Seriennummer, Fehlercode und sichtbare Displaywerte. Ergänze niemals fehlende Zeichen. Unsichere Zeichen mit ? kennzeichnen. Bei Siemens erkenne insbesondere Nummern, die mit 6ES7, 6SL, 3RT, 6EP oder 7ML beginnen. Halte alle Textfelder kurz. Gib höchstens 16 wichtige Rohtextzeilen und höchstens 4 Erkennungsmerkmale zurück.`;

async function requestVision({images, focus, query, retry=false}) {
  const openai = getOpenAI();
  const retryNote = retry
    ? 'Kompakter Wiederholungsversuch: Lies ausschließlich Hersteller, Produktfamilie, Bestell-/Modellnummer, Seriennummer, Fehlercode und wenige wichtige Rohtextzeilen. Keine Erklärungen außerhalb des JSON.'
    : 'Erster Leseversuch: Antworte äußerst kompakt und ausschließlich im vorgegebenen JSON.';
  const content = [{type:'input_text', text:`${baseInstructions}\nBildfokus: ${focus}. Nutzereingabe: ${query || '(keine)'}. ${retryNote}`}];
  images.forEach(image => content.push({type:'input_image', image_url:image, detail: focus === 'label' || focus === 'display' || retry ? 'high' : 'auto'}));
  return openai.responses.create({
    model: process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini',
    store:false,
    input:[{role:'user',content}],
    text:{format:{type:'json_schema',name:'technical_vision_read',strict:true,schema}},
    max_output_tokens: retry ? 4000 : 2800
  });
}

function parseVision(text) {
  try { return JSON.parse(text.replace(/^```json\s*/i,'').replace(/\s*```$/,'')); }
  catch (error) { throw new AppError('VISION_PARSE_FAILED','Die Bildantwort konnte nicht strukturiert ausgewertet werden.',502,{preview:text.slice(0,800),reason:error.message}); }
}
function hasUseful(v) {
  const i=v?.identifiers||{};
  return Boolean(v?.rawText?.length || Object.values(i).some(Boolean) || (v?.objectClass && !/^unbekannt$/i.test(v.objectClass)));
}
function isTokenLimit(response) {
  return response?.status === 'incomplete' && response?.incomplete_details?.reason === 'max_output_tokens';
}

export async function readVision(input) {
  let retry=false;
  let retryReason='';
  let response = await requestVision(input);

  if (isTokenLimit(response)) {
    retry=true;
    retryReason='max_output_tokens';
    response = await requestVision({...input,retry:true});
  }

  let text = inspectResponse(response);
  if (!text) throw new AppError('VISION_EMPTY_RESPONSE','Die Bilderkennung lieferte keinen Text.',502);
  let vision = parseVision(text);

  if (!hasUseful(vision) && !retry) {
    retry=true;
    retryReason='no_useful_identifiers';
    response=await requestVision({...input,retry:true});
    text=inspectResponse(response);
    if (!text) throw new AppError('VISION_EMPTY_RETRY','Auch der zweite Leseversuch war leer.',502);
    vision=parseVision(text);
  }

  const rawText = (vision.rawText || []).join('\n');
  const normalized = normalizeIdentifiers({...vision.identifiers, rawText});
  vision.identifiers = normalized.data;
  return {
    status:hasUseful(vision)?'success':'needs_better_image',
    ...vision,
    provider:normalized.provider,
    debug:{
      retry,
      retryReason,
      model:process.env.OPENAI_VISION_MODEL||'gpt-4.1-mini',
      responseStatus:response.status,
      usage:response.usage||null,
      responseId:response.id,
      outputLimit: retry ? 4000 : 2800
    }
  };
}
