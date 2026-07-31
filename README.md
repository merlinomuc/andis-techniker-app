# Andis Techniker-App – Version 1.2

Mobile-first PWA zur Identifikation technischer Bauteile per Foto, QR-/Barcode oder Texteingabe.

## Funktionen der ersten Version

- Foto aufnehmen oder aus der Galerie wählen
- QR- und Barcode mit der Handykamera scannen
- Hersteller/Typ/Artikelnummer manuell eingeben
- KI-Analyse mit technischer Zusammenfassung
- Websuche nach Datenblättern, Handbüchern und Herstellerinformationen
- Quellenlinks und Sicherheitshinweise
- Letzte Analysen lokal auf dem Gerät speichern
- Als PWA auf Android/iPhone zum Home-Bildschirm hinzufügen

## Lokal starten

```bash
npm install
npm run install:all
cp server/.env.example server/.env
# OPENAI_API_KEY in server/.env eintragen
# Terminal 1
npm run dev --prefix server

# Terminal 2
npm run dev --prefix client
```

Frontend: http://localhost:5173  
Backend: http://localhost:3001

## Auf Render bereitstellen

1. Repository zu GitHub hochladen.
2. In Render **New > Blueprint** wählen.
3. GitHub-Repository verbinden.
4. Umgebungsvariable `OPENAI_API_KEY` setzen.
5. Deployment starten.

Alternativ einen Web Service erstellen:

- Build Command: `npm install && npm run install:all && npm run build`
- Start Command: `npm start`

## Sicherheit

Der OpenAI API-Key liegt ausschließlich im Render-Backend und niemals im Browser. Technische KI-Antworten sind Hinweise, kein Ersatz für Herstellerunterlagen, Freischaltverfahren oder Elektrofachkräfte.

## Render-Fehler `vite: not found`

Diese Version installiert die Abhängigkeiten von `server` und `client` ausdrücklich vor dem Build. In Render muss als Build-Befehl `npm run build` und als Start-Befehl `npm start` verwendet werden. Falls Render noch einen alten Build-Befehl gespeichert hat, im Render-Dashboard unter **Settings → Build & Deploy** aktualisieren und anschließend **Clear build cache & deploy** ausführen.


## Neu in Version 1.2

- leichte Fortschrittsanzeige ohne zusätzliche API-Aufrufe
- Bildqualitätsprüfung mit konkretem Hinweis für ein besseres Foto
- stufenweise Erkennung von Objektklasse, Logo, Serie und Modellnummer
- mögliche Kandidaten statt komplettem Abbruch bei Unsicherheit
- aufklappbare Erklärung „Warum dieses Ergebnis?“
- Bilddetail `auto` und kürzere Maximalantwort zur Reduzierung des Verbrauchs

## Version 1.3

- getrennte Schaltflächen für Kamera und Galerie
- Auswahl von bis zu vier Bildern
- Kombination aus Gesamtansicht, Typenschild und Rückseite
- lokale Bildverkleinerung vor dem Upload
- technische, dunkle Benutzeroberfläche
- weiterhin nur ein Analyseaufruf pro Vorgang
