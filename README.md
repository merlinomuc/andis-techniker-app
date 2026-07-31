# Andis Techniker-App 3.1 – Stability Release

Version 3.1 stabilisiert die Bildanalyse und ist im Layout eindeutig als **V3.1 STABILITY** erkennbar.

## Wichtigste Änderungen

- Kompakteres Structured-Output-Schema für die Bildlesung
- Höheres Ausgabelimit: 2800 Tokens im ersten Versuch
- Automatischer kompakter Retry mit 4000 Tokens bei `max_output_tokens`
- Retry auch dann, wenn keine brauchbaren Identifikatoren gefunden wurden
- Rohtext auf 16 relevante Zeilen begrenzt
- Erkennungsmerkmale auf 4 Einträge begrenzt
- Siemens-Muster um `6EP` erweitert
- Sichtbarer 3.1-Stabilitätsbanner und neue Kopfzeile
- Direkte Text-/Typensuche und herstellerzentrierte Recherche aus Version 3.0 bleiben erhalten

## Render

- Build Command: `npm run build`
- Start Command: `npm start`
- Danach: **Manual Deploy → Clear build cache & deploy**

Health-Check:

`/api/health`

Erwartet:

```json
{
  "ok": true,
  "version": "3.1",
  "architecture": "split-vision-staged-research-with-retry"
}
```
