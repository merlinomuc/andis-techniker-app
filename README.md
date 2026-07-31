# Andis Techniker-App v3.2

Version 3.2 ist ein Stabilitäts- und UX-Release für private Tests auf Android und iPhone.

## Neu

- Recherche-Retry bei `max_output_tokens`
- höherer Ausgabepuffer beim kompakten Wiederholungsversuch
- maximal fünf Quellen je Recherchephase
- kürzere, praxisnahe Erstantwort
- Herstellerquellen zuerst, anschließend weitere Fachquellen
- freundliche Fehlermeldungen statt technischer API-Texte
- sichtbare Fortschrittsanzeige in Alltagssprache
- vereinfachte Typensuche mit optionalen Zusatzfeldern
- Quellen standardmäßig platzsparend eingeklappt
- deutlich sichtbares `V3.2 EINFACH & STABIL`-Badge

## Render

Build Command:

```bash
npm run build
```

Start Command:

```bash
npm start
```

Danach in Render **Manual Deploy → Clear build cache & deploy**.

Health-Check:

```text
/api/health
```

Erwartet:

```json
{
  "ok": true,
  "version": "3.2",
  "architecture": "simple-ux-with-vision-and-research-retry"
}
```

## Umgebungsvariablen

- `OPENAI_API_KEY`
- optional `OPENAI_VISION_MODEL` (Standard: `gpt-4.1-mini`)
- optional `OPENAI_RESEARCH_MODEL` (Standard: `gpt-5-mini`)
