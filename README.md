# Andis Techniker-App v2.0

Version 2.0 trennt erstmals die visuelle Erkennung vollständig von der Produktrecherche.

## Neuer Ablauf

1. **Bild lesen** – Fotos werden ohne Websuche analysiert.
2. **Daten prüfen** – Hersteller, Produktfamilie, Bestellnummer, Modell und Seriennummer sind bearbeitbar.
3. **Produkt recherchieren** – Erst nach Bestätigung startet die Websuche.

Ein Recherchefehler kann dadurch kein bereits erkanntes Typenschild mehr überschreiben.

## Neue Funktionen

- Kamera, Galerie und QR-/Barcodescanner
- bis zu vier Bilder
- Bilder links/rechts drehen
- frei wählbarer Etikettenausschnitt
- getrennte API-Endpunkte `/api/vision/read` und `/api/research/product`
- eindeutige Fehlercodes statt falschem „Unbekannt“
- Hersteller-Provider für Siemens und Shimano
- sichtbare technische Diagnose
- Siemens-Testfoto und Unit-Tests
- PWA für Android und iPhone

## Render Deployment

1. Projekt nach GitHub hochladen.
2. In Render als Blueprint importieren oder vorhandenen Dienst verbinden.
3. `OPENAI_API_KEY` setzen.
4. **Manual Deploy → Clear build cache & deploy**.

Build Command:

```text
npm run build
```

Start Command:

```text
npm start
```

Health Check:

```text
https://DEINE-URL.onrender.com/api/health
```

Erwartet wird `version: "2.0"` und `architecture: "split-pipeline"`.

## Bekannter Siemens-Testfall

Das Testbild liegt unter `server/tests/fixtures/siemens-label.jpg`.

Erwartete Angaben:

- Hersteller: Siemens
- Produktfamilie: SIMATIC S7-300
- Bestellnummer: 6ES7 318-3FL01-0AB0

## Lokale Entwicklung

```bash
npm run install:all
cp server/.env.example server/.env
npm run build
npm start
```

Tests:

```bash
npm test
```

## Kostenlogik

Die Websuche startet erst nach der Bestätigung. Bildrotation, Zuschneiden, Vorschau und Fortschrittsanzeige laufen lokal und verursachen keine API-Tokens. Der automatische zweite Bildleseversuch erfolgt nur, wenn der erste keine verwertbaren Angaben liefert.
