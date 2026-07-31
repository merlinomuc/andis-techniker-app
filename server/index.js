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

app.get('/api/health', (_req, res) => res.json({ ok: true, configured: Boolean(process.env.OPENAI_API_KEY), version: '1.4' }));

app.post('/api/analyze', async (req, res) => {
  try {
    const input = requestSchema.parse(req.body);
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY ist auf dem Server noch nicht eingerichtet.' });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const modeLabels = {
      identify: 'Bauteil, Gerät, Verpackung oder Typenschild identifizieren und technische Kerndaten erklären',
      troubleshoot: 'Fehlerbild einordnen und sichere, logisch sortierte Prüfschritte vorschlagen',
      documents: 'offizielle Datenblätter, Handbücher, Anschlusspläne und Herstellerunterlagen finden',
      replacement: 'Originalteil, Nachfolger und mögliche kompatible Ersatzprodukte vergleichen'
    };
    const focusLabels = {
      auto: 'Automatisch entscheiden, ob Gerät, Bauteil, Typenschild, Verpackungsetikett oder Display zu sehen ist.',
      device: 'Das sichtbare Gerät beziehungsweise Bauteil priorisieren; Beschriftungen trotzdem vollständig lesen.',
      label: 'Typenschild oder Verpackungsetikett priorisieren. Text, Bestellnummern, Modellcodes und Seriennummern exakt lesen.',
      display: 'Display, Messwert oder Fehlercode priorisieren und Zeichen exakt lesen.'
    };

    const userContent = [{
      type: 'input_text',
      text: `Aufgabe: ${modeLabels[input.mode]}\nBildfokus: ${focusLabels[input.imageFocus]}\nNutzereingabe/gescannter Code: ${input.query || '(keine zusätzliche Eingabe)'}\nAnzahl Bilder: ${input.images.length}\n\nWICHTIGE ANALYSEABFOLGE:\n1. Bestimme zuerst den Bildtyp: Gerät/Bauteil, Typenschild, Verpackungsetikett, Display/Fehlercode, technische Zeichnung oder unbekannt. Ein Gerät muss nicht sichtbar sein; eine Verpackung mit Etikett ist ein gültiges Identifikationsziel.\n2. Suche gezielt nach Etiketten, Barcodes und daneben gedruckten Klartextangaben. Drehe schrägen oder seitlichen Text gedanklich in Leserichtung.\n3. Lies Hersteller, Produktfamilie, Modell, Bestellnummer, P/N, MLFB, Type, Seriennummer und Fehlercode so exakt wie sichtbar. Barcodes nicht erraten; priorisiere den lesbaren Klartext daneben.\n4. Prüfe typische industrielle Nummernformate. Bei Siemens sind beispielsweise Zeichenfolgen wie 6ES7..., 6SL..., 3RT... oder 7ML... häufig Bestellnummern. Erfinde niemals fehlende Zeichen.\n5. Arbeite von grob nach genau und liefere auch bei Unsicherheit eine Objektklasse, sichtbare Texte und einen konkreten Vorschlag für ein besseres Foto.\n6. Nutze erst nach der Texterfassung eine Websuche. Suche bevorzugt mit der exakten Hersteller- und Bestellnummer und bevorzuge offizielle Herstellerquellen.`
    }];

    const detail = input.imageFocus === 'label' || input.imageFocus === 'display' ? 'high' : 'auto';
    for (const image of input.images) userContent.push({ type: 'input_image', image_url: image, detail });

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      tools: [{ type: 'web_search' }],
      instructions: `Du bist der Analyse-Assistent in "Andis Techniker-App". Antworte ausschließlich als gültiges JSON-Objekt ohne Codeblock:
{
  "answer": "kompakte Markdown-Antwort",
  "imageType": "Gerät/Bauteil | Typenschild | Verpackungsetikett | Display/Fehlercode | Technische Zeichnung | Unbekannt",
  "extractedIdentifiers": [
    {"label":"Hersteller", "value":"...", "confidence":"hoch|mittel|niedrig"},
    {"label":"Bestellnummer", "value":"...", "confidence":"hoch|mittel|niedrig"}
  ],
  "imageAssessment": null oder {"usable":true/false, "message":"kurze ehrliche Beurteilung", "nextPhoto":"konkrete gewünschte Ansicht oder leer"},
  "recognitionBasis": ["2 bis 5 kurze beobachtbare Merkmale"]
}

Die Markdown-Antwort nutzt passende Abschnitte wie ## Erkannt, ## Technische Einordnung, ## Dokumente und ## Nächste Schritte. extractedIdentifiers enthält ausschließlich tatsächlich lesbare oder sehr klar abgeleitete Angaben; keine erfundenen Teilenummern. Bei einem Karton oder einer Verpackung identifiziere anhand des Etiketts und sage transparent, dass das Gerät selbst nicht sichtbar ist. Wenn eine Nummer nur teilweise lesbar ist, verwende ? für unsichere Zeichen oder lasse sie weg. Unterscheide sichtbar/gesichert von wahrscheinlich/vermutet. recognitionBasis enthält keine internen Gedankengänge. Bei Gefahren sichere Hinweise geben.`,
      input: [{ role: 'user', content: userContent }],
      max_output_tokens: 1500
    });

    const payload = parseModelPayload(response.output_text || '');
    res.json({
      answer: payload.answer || 'Keine auswertbare Antwort erhalten.',
      imageType: payload.imageType || 'Unbekannt',
      extractedIdentifiers: Array.isArray(payload.extractedIdentifiers) ? payload.extractedIdentifiers.slice(0, 10) : [],
      imageAssessment: input.images.length ? payload.imageAssessment : null,
      recognitionBasis: Array.isArray(payload.recognitionBasis) ? payload.recognitionBasis.slice(0, 6) : [],
      sources: extractSources(response),
      responseId: response.id
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
app.listen(port, () => console.log(`Andis Techniker-App v1.4 läuft auf Port ${port}`));
