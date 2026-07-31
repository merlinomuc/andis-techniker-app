import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { z } from 'zod';

const app = express();
const port = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../client/dist');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '18mb' }));

const requestSchema = z.object({
  query: z.string().trim().max(1000).optional().default(''),
  mode: z.enum(['identify', 'troubleshoot', 'documents', 'replacement']).optional().default('identify'),
  imageFocus: z.enum(['auto', 'device', 'label', 'display']).optional().default('auto'),
  images: z.array(z.string().startsWith('data:image/').max(7_000_000)).max(4).optional().default([])
}).refine((value) => value.query || value.images.length, { message: 'Bitte Text oder ein Bild übermitteln.' });

function extractSources(response) {
  const sources = new Map();
  for (const item of response.output || []) {
    if (item.type === 'web_search_call') {
      for (const source of item.action?.sources || []) if (source.url) sources.set(source.url, { title: source.title || source.url, url: source.url });
    }
    if (item.type === 'message') {
      for (const content of item.content || []) {
        for (const annotation of content.annotations || []) {
          const citation = annotation.url_citation;
          if (citation?.url) sources.set(citation.url, { title: citation.title || citation.url, url: citation.url });
        }
      }
    }
  }
  return [...sources.values()].slice(0, 10);
}

const emptyVision = () => ({
  imageType: 'Unbekannt', objectClass: 'Unbekannt', rawText: [], extractedIdentifiers: [],
  imageAssessment: null, recognitionBasis: []
});

function normalizeVision(value) {
  const base = emptyVision();
  if (!value || typeof value !== 'object') return base;
  return {
    imageType: typeof value.imageType === 'string' && value.imageType.trim() ? value.imageType.trim() : base.imageType,
    objectClass: typeof value.objectClass === 'string' && value.objectClass.trim() ? value.objectClass.trim() : base.objectClass,
    rawText: Array.isArray(value.rawText) ? value.rawText.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()).slice(0, 40) : [],
    extractedIdentifiers: Array.isArray(value.extractedIdentifiers) ? value.extractedIdentifiers.filter(x => x && typeof x.value === 'string' && x.value.trim()).map(x => ({
      label: typeof x.label === 'string' && x.label.trim() ? x.label.trim() : 'Sonstiges',
      value: x.value.trim(),
      confidence: ['hoch', 'mittel', 'niedrig'].includes(x.confidence) ? x.confidence : 'mittel'
    })).slice(0, 16) : [],
    imageAssessment: value.imageAssessment && typeof value.imageAssessment === 'object' ? {
      usable: Boolean(value.imageAssessment.usable),
      message: typeof value.imageAssessment.message === 'string' ? value.imageAssessment.message.trim() : '',
      nextPhoto: typeof value.imageAssessment.nextPhoto === 'string' ? value.imageAssessment.nextPhoto.trim() : ''
    } : null,
    recognitionBasis: Array.isArray(value.recognitionBasis) ? value.recognitionBasis.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()).slice(0, 8) : []
  };
}

function fallbackFromText(text) {
  const result = emptyVision();
  const clean = String(text || '').replace(/```(?:json)?/gi, '').trim();
  if (!clean) return result;
  const lines = clean.split(/\r?\n/).map(x => x.replace(/^[-*•\s]+/, '').trim()).filter(Boolean);
  const identifiers = [];
  const patterns = [
    ['Bestellnummer', /\b(?:6ES7|6SL|3RT|7ML)[A-Z0-9 .\-]{5,25}\b/gi],
    ['Modell', /\b(?:RD|FD|SL|BR|FC)-[A-Z0-9-]{2,15}\b/gi],
    ['Fehlercode', /\b(?:F|E|A)\d{2,6}\b/gi]
  ];
  for (const [label, regex] of patterns) {
    for (const match of clean.match(regex) || []) identifiers.push({ label, value: match.replace(/\s+/g, ' ').trim(), confidence: 'mittel' });
  }
  if (/SIEMENS/i.test(clean)) identifiers.unshift({ label: 'Hersteller', value: 'Siemens', confidence: 'hoch' });
  if (/SIMATIC\s*S7[- ]?300/i.test(clean)) identifiers.push({ label: 'Produktfamilie', value: 'SIMATIC S7-300', confidence: 'hoch' });
  result.rawText = lines.slice(0, 30);
  result.extractedIdentifiers = [...new Map(identifiers.map(x => [`${x.label}:${x.value}`, x])).values()].slice(0, 12);
  result.objectClass = result.extractedIdentifiers.length ? 'Technisches Produkt oder Produktetikett' : 'Unbekannt';
  result.imageType = /barcode|etikett|label|bestellnummer|seriennummer|SIEMENS/i.test(clean) ? 'Verpackungsetikett' : 'Unbekannt';
  result.imageAssessment = { usable: result.extractedIdentifiers.length > 0, message: 'Die strukturierte Ausgabe war nicht vollständig. Verwertbare Angaben wurden aus der Rohantwort gerettet.', nextPhoto: '' };
  result.recognitionBasis = result.extractedIdentifiers.map(x => `${x.label}: ${x.value}`).slice(0, 5);
  return result;
}

function parseVisionPayload(text) {
  const raw = String(text || '').trim();
  if (!raw) return { vision: emptyVision(), parseStatus: 'empty', parseError: 'Leere Modellantwort' };
  const candidates = [raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '')];
  const first = raw.indexOf('{'); const last = raw.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(raw.slice(first, last + 1));
  for (const candidate of candidates) {
    try { return { vision: normalizeVision(JSON.parse(candidate)), parseStatus: 'json', parseError: '' }; }
    catch (error) { /* nächsten Kandidaten versuchen */ }
  }
  return { vision: fallbackFromText(raw), parseStatus: 'fallback', parseError: 'Antwort war kein gültiges JSON' };
}

function responseStatusInfo(response) {
  return {
    status: response?.status || 'unknown',
    incompleteReason: response?.incomplete_details?.reason || '',
    outputTypes: Array.isArray(response?.output) ? response.output.map(item => item?.type || 'unknown') : [],
    usage: response?.usage || null
  };
}

function extractAnyResponseText(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) return response.output_text.trim();
  const parts = [];
  for (const item of response?.output || []) {
    if (item?.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
      if (content?.type === 'refusal' && typeof content.refusal === 'string') parts.push(content.refusal);
    }
  }
  return parts.join('\n').trim();
}

function assertUsableResponse(response, stage) {
  const info = responseStatusInfo(response);
  const text = extractAnyResponseText(response);
  if (info.status === 'incomplete' && !text) {
    const error = new Error(`${stage} wurde unvollständig beendet${info.incompleteReason ? `: ${info.incompleteReason}` : '.'}`);
    error.code = 'INCOMPLETE_MODEL_RESPONSE';
    error.responseInfo = info;
    throw error;
  }
  if (!text) {
    const error = new Error(`${stage} lieferte keinen auswertbaren Text. Bitte erneut versuchen.`);
    error.code = 'EMPTY_MODEL_RESPONSE';
    error.responseInfo = info;
    throw error;
  }
  return { text, info };
}

const visionSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    imageType: { type: 'string', enum: ['Gerät/Bauteil', 'Typenschild', 'Verpackungsetikett', 'Display/Fehlercode', 'Technische Zeichnung', 'Unbekannt'] },
    objectClass: { type: 'string' },
    rawText: { type: 'array', items: { type: 'string' } },
    extractedIdentifiers: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      label: { type: 'string', enum: ['Hersteller', 'Produktfamilie', 'Bestellnummer', 'Modell', 'Seriennummer', 'Fehlercode', 'Sonstiges'] },
      value: { type: 'string' }, confidence: { type: 'string', enum: ['hoch', 'mittel', 'niedrig'] }
    }, required: ['label', 'value', 'confidence'] } },
    imageAssessment: { type: 'object', additionalProperties: false, properties: {
      usable: { type: 'boolean' }, message: { type: 'string' }, nextPhoto: { type: 'string' }
    }, required: ['usable', 'message', 'nextPhoto'] },
    recognitionBasis: { type: 'array', items: { type: 'string' } }
  },
  required: ['imageType', 'objectClass', 'rawText', 'extractedIdentifiers', 'imageAssessment', 'recognitionBasis']
};

app.get('/api/health', (_req, res) => res.json({ ok: true, configured: Boolean(process.env.OPENAI_API_KEY), version: '1.7', visionModel: process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini', researchModel: process.env.OPENAI_MODEL || 'gpt-5-mini' }));

app.post('/api/analyze', async (req, res) => {
  try {
    const input = requestSchema.parse(req.body);
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY ist auf dem Server noch nicht eingerichtet.' });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const researchModel = process.env.OPENAI_MODEL || 'gpt-5-mini';
    const visionModel = process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini';
    const focusLabels = {
      auto: 'Automatisch entscheiden, ob Gerät, Bauteil, Typenschild, Verpackungsetikett oder Display zu sehen ist.',
      device: 'Das sichtbare Gerät oder Bauteil priorisieren und Beschriftungen vollständig lesen.',
      label: 'Typenschild oder Verpackungsetikett priorisieren. Artikelnummern, MLFB, P/N, Modellcodes und Seriennummern exakt transkribieren.',
      display: 'Display, Messwert oder Fehlercode priorisieren und Zeichen exakt transkribieren.'
    };

    // Stufe 1: reine Bilderkennung ohne Websuche. Dadurch kann die Recherche
    // die visuelle Transkription nicht überlagern.
    const visionContent = [{
      type: 'input_text',
      text: `Analysiere die Bilder ausschließlich visuell. Bildfokus: ${focusLabels[input.imageFocus]}\nZusätzliche Nutzereingabe: ${input.query || '(keine)'}\n\nPflichtablauf:\n1. Bestimme den Bildtyp. Auch ein Karton mit Etikett ist ein gültiges technisches Identifikationsziel.\n2. Lies zuerst sämtlichen sichtbaren Klartext. Drehe seitlichen Text gedanklich.\n3. Suche besonders nach Hersteller, Produktfamilie, Bestellnummer, MLFB, P/N, TYPE, MODEL, Seriennummer und Fehlercode.\n4. Bei Siemens sind Formate wie 6ES7..., 6SL..., 3RT... und 7ML... oft Bestellnummern.\n5. Nichts ergänzen oder erraten. Unsichere Zeichen mit ? markieren.\n6. Selbst wenn das genaue Modell unklar bleibt, mindestens Objektklasse, sichtbare Wörter und das benötigte Zusatzfoto nennen.`
    }];
    const detail = input.imageFocus === 'label' || input.imageFocus === 'display' ? 'high' : 'auto';
    for (const image of input.images) visionContent.push({ type: 'input_image', image_url: image, detail });

    async function runVisionAttempt(extraInstruction = '') {
      return openai.responses.create({
        model: visionModel,
        instructions: `Du bist ein präziser technischer Bildleser. Keine Webrecherche und keine Produktdaten ergänzen. Lies sichtbaren Text exakt. ${extraInstruction}`,
        input: [{ role: 'user', content: visionContent }],
        text: { format: { type: 'json_schema', name: 'technical_image_readout', strict: true, schema: visionSchema } },
        max_output_tokens: 1800,
        store: false
      });
    }

    let visionResponse;
    let parsed;
    let retryUsed = false;
    try {
      visionResponse = await runVisionAttempt();
      const checked = assertUsableResponse(visionResponse, 'Die Bildanalyse');
      parsed = parseVisionPayload(checked.text);
      parsed.responseInfo = checked.info;
    } catch (structuredError) {
      // Kompatibilitäts-Fallback für ältere SDK-/Modellkonfigurationen.
      visionResponse = await openai.responses.create({
        model: visionModel,
        instructions: 'Antworte ausschließlich als gültiges JSON entsprechend dem im Nutzertext beschriebenen Schema. Keine Markdown-Codeblöcke.',
        input: [{ role: 'user', content: visionContent }],
        max_output_tokens: 1800,
        store: false
      });
      const checked = assertUsableResponse(visionResponse, 'Der kompatible Bildanalyse-Fallback');
      parsed = parseVisionPayload(checked.text);
      parsed.responseInfo = checked.info;
      parsed.parseError = `Structured Output nicht verfügbar: ${structuredError?.message || 'unbekannt'}. ${parsed.parseError || ''}`.trim();
    }

    let vision = parsed.vision;
    const hasUsefulVision = () => vision.rawText.length > 0 || vision.extractedIdentifiers.length > 0 || (vision.objectClass && vision.objectClass !== 'Unbekannt');
    if (input.images.length && !hasUsefulVision()) {
      retryUsed = true;
      const retryContent = [{ type: 'input_text', text: `Zweiter, besonders konservativer Leseversuch. Behandle das Bild zuerst als Dokument oder Verpackungsetikett. Suche den kleineren hellen Etikettenbereich im Gesamtbild, drehe ihn gedanklich und transkribiere besonders Siemens-/Industrie-Bestellnummern. Nutzereingabe: ${input.query || '(keine)'}` }];
      for (const image of input.images) retryContent.push({ type: 'input_image', image_url: image, detail: 'high' });
      const retryResponse = await openai.responses.create({
        model: visionModel,
        instructions: 'Lies nur sichtbar vorhandenen Text. Antworte ausschließlich im verlangten JSON-Schema. Nichts erraten.',
        input: [{ role: 'user', content: retryContent }],
        text: { format: { type: 'json_schema', name: 'technical_image_retry', strict: true, schema: visionSchema } },
        max_output_tokens: 1800,
        store: false
      });
      const retryChecked = assertUsableResponse(retryResponse, 'Der zweite Bild-Leseversuch');
      const retryParsed = parseVisionPayload(retryChecked.text);
      retryParsed.responseInfo = retryChecked.info;
      if (retryParsed.vision.rawText.length || retryParsed.vision.extractedIdentifiers.length) {
        visionResponse = retryResponse;
        parsed = retryParsed;
        vision = retryParsed.vision;
      }
    }

    const identifiers = Array.isArray(vision.extractedIdentifiers) ? vision.extractedIdentifiers.slice(0, 12) : [];
    const rawText = Array.isArray(vision.rawText) ? vision.rawText.slice(0, 30) : [];
    const searchSeed = [input.query, ...identifiers.map(x => `${x.label}: ${x.value}`), ...rawText].filter(Boolean).join('\n');

    let answer = '';
    let sources = [];
    let researchResponseId = null;

    // Stufe 2: nur mit den bereits gelesenen Angaben recherchieren.
    // Kein zweiter Bild-Upload, daher bleibt der Zusatzverbrauch begrenzt.
    if (searchSeed.trim()) {
      const modeLabels = {
        identify: 'Identifiziere das Produkt und erkläre die wichtigsten technischen Kerndaten.',
        troubleshoot: 'Ordne das Fehlerbild ein und nenne sichere, logisch sortierte Prüfschritte.',
        documents: 'Finde bevorzugt offizielle Datenblätter, Handbücher, Anschlusspläne und Herstellerunterlagen.',
        replacement: 'Vergleiche Originalteil, offiziellen Nachfolger und mögliche kompatible Ersatzprodukte.'
      };
      const research = await openai.responses.create({
        model: researchModel,
        tools: [{ type: 'web_search' }],
        instructions: `Du bist der Recherche-Assistent in Andis Techniker-App. Verwende ausschließlich die übermittelten, visuell gelesenen Angaben. Erfinde keine fehlenden Zeichen. Bevorzuge offizielle Herstellerquellen. Antworte als gut lesbares Markdown mit den Abschnitten ## Erkannt, ## Technische Einordnung, ## Dokumente und ## Nächste Schritte. Kennzeichne Unsicherheit deutlich.`,
        input: `${modeLabels[input.mode]}\n\nVisuell gelesene Angaben:\n${searchSeed}\n\nBildtyp: ${vision.imageType || 'Unbekannt'}\nObjektklasse: ${vision.objectClass || 'Unbekannt'}`,
        max_output_tokens: 1400,
        reasoning: { effort: 'minimal' },
        store: false
      });
      answer = research.output_text || '';
      sources = extractSources(research);
      researchResponseId = research.id;
    }

    if (!answer) {
      const idLines = identifiers.map(x => `- **${x.label}:** ${x.value} (${x.confidence || 'mittel'})`).join('\n');
      answer = `## Visuelle Erkennung\n${vision.objectClass ? `**Objektklasse:** ${vision.objectClass}\n\n` : ''}${idLines || 'Es konnten keine eindeutigen Kennzeichnungen gelesen werden.'}\n\n## Nächste Schritte\n${vision.imageAssessment?.nextPhoto || 'Bitte eine gerade, helle Nahaufnahme der Beschriftung oder Modellnummer ergänzen.'}`;
    }

    res.json({
      answer,
      imageType: vision.imageType || 'Unbekannt',
      objectClass: vision.objectClass || 'Unbekannt',
      rawText,
      extractedIdentifiers: identifiers,
      imageAssessment: input.images.length ? (vision.imageAssessment || null) : null,
      recognitionBasis: Array.isArray(vision.recognitionBasis) ? vision.recognitionBasis.slice(0, 6) : [],
      sources,
      responseId: researchResponseId || visionResponse.id,
      visionResponseId: visionResponse.id,
      pipeline: retryUsed ? 'two-pass-with-vision-retry' : 'two-pass',
      diagnostics: {
        parseStatus: parsed.parseStatus,
        parseError: parsed.parseError || '',
        retryUsed,
        visionRawResponse: extractAnyResponseText(visionResponse).slice(0, 6000),
        responseStatus: responseStatusInfo(visionResponse),
        visionModel,
        researchModel
      }
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0]?.message || 'Ungültige Eingabe.' });
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    res.status(status).json({ error: error?.message || 'Die Analyse ist fehlgeschlagen.' });
  }
});

app.use(express.static(clientDist));
app.use((_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
app.listen(port, () => console.log(`Andis Techniker-App v1.7 läuft auf Port ${port}`));
