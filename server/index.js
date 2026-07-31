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

function parseModelPayload(text) {
  try {
    const clean = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    return JSON.parse(clean);
  } catch {
    return { answer: text, imageAssessment: null, recognitionBasis: [], imageType: 'Unbekannt', extractedIdentifiers: [] };
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true, configured: Boolean(process.env.OPENAI_API_KEY), version: '1.5' }));

app.post('/api/analyze', async (req, res) => {
  try {
    const input = requestSchema.parse(req.body);
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY ist auf dem Server noch nicht eingerichtet.' });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
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

    const visionResponse = await openai.responses.create({
      model,
      instructions: `Du bist ein präziser technischer Bildleser. Antworte ausschließlich mit gültigem JSON ohne Codeblock:\n{\n  "imageType":"Gerät/Bauteil | Typenschild | Verpackungsetikett | Display/Fehlercode | Technische Zeichnung | Unbekannt",\n  "objectClass":"kurze Objektklasse oder Unbekannt",\n  "rawText":["jede tatsächlich sichtbare Textzeile"],\n  "extractedIdentifiers":[{"label":"Hersteller|Produktfamilie|Bestellnummer|Modell|Seriennummer|Fehlercode|Sonstiges","value":"...","confidence":"hoch|mittel|niedrig"}],\n  "imageAssessment":{"usable":true,"message":"ehrliche kurze Beurteilung","nextPhoto":"konkrete gewünschte Ansicht oder leer"},\n  "recognitionBasis":["2 bis 5 direkt beobachtbare Merkmale"]\n}\nKeine Webrecherche, keine Produktkenntnisse ergänzen und keine Nummern vervollständigen.`,
      input: [{ role: 'user', content: visionContent }],
      max_output_tokens: 700
    });

    const vision = parseModelPayload(visionResponse.output_text || '');
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
        model,
        tools: [{ type: 'web_search' }],
        instructions: `Du bist der Recherche-Assistent in Andis Techniker-App. Verwende ausschließlich die übermittelten, visuell gelesenen Angaben. Erfinde keine fehlenden Zeichen. Bevorzuge offizielle Herstellerquellen. Antworte als gut lesbares Markdown mit den Abschnitten ## Erkannt, ## Technische Einordnung, ## Dokumente und ## Nächste Schritte. Kennzeichne Unsicherheit deutlich.`,
        input: `${modeLabels[input.mode]}\n\nVisuell gelesene Angaben:\n${searchSeed}\n\nBildtyp: ${vision.imageType || 'Unbekannt'}\nObjektklasse: ${vision.objectClass || 'Unbekannt'}`,
        max_output_tokens: 1100
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
      pipeline: 'two-pass'
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
app.listen(port, () => console.log(`Andis Techniker-App v1.5 läuft auf Port ${port}`));
