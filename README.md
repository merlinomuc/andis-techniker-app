# Andis Techniker-App 3.0

Version 3.0 verbindet zwei gleichwertige Einstiege:

1. **Typ eingeben** – Hersteller, Modell, Bestellnummer oder Fehlercode direkt suchen.
2. **Foto analysieren** – Bild lesen, erkannte Daten bestätigen und anschließend recherchieren.

## Neue Recherchelogik

Die Recherche läuft stufenweise von innen nach außen:

1. Bekannten Hersteller aus Typ, Modell oder Bestellnummer ableiten.
2. Offizielle Herstellerdomains mit exakter Nummer durchsuchen.
3. Danach autorisierte Distributoren, technische Kataloge und weitere belastbare Internetquellen ergänzen.
4. Offizielle und zusätzliche Quellen getrennt darstellen.

Enthaltene Herstellerprofile: Siemens, Shimano, Pfeiffer Vacuum, HEIDENHAIN, Phoenix Contact, Schneider Electric/Telemecanique, Gossen Metrawatt und Siebert. Unbekannte Hersteller werden generisch recherchiert.

## Stabilität

- Bildanalyse und Webrecherche bleiben getrennt.
- Die Textsuche benötigt kein Foto.
- HTML statt JSON wird als `API_RETURNED_NON_JSON` verständlich gemeldet.
- Keine inkompatible Kombination aus `reasoning.effort` und Websuche.
- Testmanifeste für Bild- und Textfälle liegen unter `server/evals/`.

## Render

- Build Command: `npm run build`
- Start Command: `npm start`
- Root Directory: leer
- Umgebungsvariable: `OPENAI_API_KEY`
- Optional: `OPENAI_VISION_MODEL=gpt-4.1-mini`
- Optional: `OPENAI_RESEARCH_MODEL=gpt-5-mini`

Nach dem Upload **Manual Deploy → Clear build cache & deploy** ausführen.

Health-Check: `/api/health` muss `version: "3.0"` und `architecture: "split-vision-and-staged-research"` anzeigen.
