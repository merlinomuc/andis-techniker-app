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
app.use(express.json({ limit: '14mb' }));

const requestSchema = z.object({
  query: z.string().trim().max(1000).optional().default(''),
  mode: z.enum(['identify', 'troubleshoot', 'documents', 'replacement']).optional().default('identify'),
  imageDataUrl: z.string().startsWith('data:image/').max(12_000_000).optional()
}).refine((value) => value.query || value.imageDataUrl, { message: 'Bitte Text oder ein Bild übermitteln.' });

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
    return { answer: text, imageAssessment: null, recognitionBasis: [] };
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true, configured: Boolean(process.env.OPENAI_API_KEY), version: '1.2' }));

app.post('/api/analyze', async (req, res) => {
  try {
    const input = requestSchema.parse(req.body);
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY ist auf dem Server noch nicht eingerichtet.' });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const modeLabels = {
      identify: 'Bauteil oder Gerät identifizieren und technische Kerndaten erklären',
      troubleshoot: 'Fehlerbild einordnen und sichere, logisch sortierte Prüfschritte vorschlagen',
      documents: 'offizielle Datenblätter, Handbücher, Anschlusspläne und Herstellerunterlagen finden',
      replacement: 'Originalteil, Nachfolger und mögliche kompatible Ersatzprodukte vergleichen'
    };

    const userContent = [{
      type: 'input_text',
      text: `Aufgabe: ${modeLabels[input.mode]}\nNutzereingabe/gescannter Code: ${input.query || '(keine zusätzliche Eingabe)'}\nBild vorhanden: ${input.imageDataUrl ? 'ja' : 'nein'}\n\nArbeite von grob nach genau: Objektklasse, sichtbare Logos/Texte, Hersteller/Serie, Modellnummer, mögliche Kandidaten. Wenn das genaue Modell nicht sicher bestimmbar ist, liefere trotzdem die sicher erkennbare Objektklasse und bis zu drei klar als Vermutung bezeichnete Kandidaten. Sage konkret, welche Ansicht oder Kennzeichnung auf einem Zusatzfoto benötigt wird. Nutze Websuche nur, wenn eine konkrete Hersteller-, Modell-, Dokument-, Fehlercode- oder Ersatzteilsuche sinnvoll ist; bevorzuge offizielle Herstellerquellen.`
    }];

    if (input.imageDataUrl) userContent.push({ type: 'input_image', image_url: input.imageDataUrl, detail: 'auto' });

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      tools: [{ type: 'web_search' }],
      instructions: `Du bist der Analyse-Assistent in "Andis Techniker-App". Antworte ausschließlich als gültiges JSON-Objekt ohne Codeblock mit diesem Aufbau:
{
  "answer": "kompakte Markdown-Antwort",
  "imageAssessment": null oder {"usable": true/false, "message": "kurze ehrliche Beurteilung", "nextPhoto": "konkrete gewünschte Ansicht oder leer"},
  "recognitionBasis": ["2 bis 5 kurze, für Nutzer verständliche Beobachtungen"]
}

Die Markdown-Antwort nutzt passende Abschnitte wie ## Erkannt, ## Wahrscheinliche Zuordnung, ## Technische Hinweise, ## Dokumente, ## Nächste sichere Schritte. Unterscheide sichtbar/gesichert von wahrscheinlich/vermutet. Erfinde keine Teilenummern. Bei schlechtem, unscharfem, zu weitem, verdecktem oder spiegelndem Bild: nicht einfach scheitern; nenne die grobe Objektklasse, soweit möglich, und verlange ein konkretes besseres Foto. recognitionBasis enthält nur beobachtbare Merkmale und eine knappe Begründung, niemals interne Gedankengänge. Bei Gefahren sichere Hinweise geben.`,
      input: [{ role: 'user', content: userContent }],
      max_output_tokens: 1400
    });

    const payload = parseModelPayload(response.output_text || '');
    res.json({
      answer: payload.answer || 'Keine auswertbare Antwort erhalten.',
      imageAssessment: input.imageDataUrl ? payload.imageAssessment : null,
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
app.listen(port, () => console.log(`Andis Techniker-App v1.2 läuft auf Port ${port}`));
