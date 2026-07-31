# Andis Techniker-App – Version 3.3.2

> **Upload-Hinweis:** Diese ZIP ist flach gepackt. Nach dem Entpacken müssen `client`, `server`, `package.json` und `render.yaml` direkt sichtbar sein. Lade genau diese Inhalte in den GitHub-Repository-Stamm hoch.

Mobile PWA für Android und iPhone. Technische Produkte lassen sich per Typ-/Bestellnummer, Foto, Galerie-Bild, QR-Code oder Barcode erfassen. Die App liest Bilder zunächst ohne Websuche, lässt erkannte Daten prüfen und recherchiert anschließend von offiziellen Herstellerquellen nach außen.

## Neu und konsolidiert in v3.3.2

- Typ- und Freitextsuche als eigener stabiler Ablauf
- Kamera **und deutlich sichtbare Galerie-Auswahl**
- QR-/Barcode-Scanner wechselt nach dem Scan automatisch in die Typensuche
- bis zu vier Bilder, Rotation und Etiketten-Zuschnitt
- getrennte Schritte: Bild lesen → Angaben prüfen → recherchieren
- Hersteller-zuerst-Suche, danach Fachhändler/Kataloge und weitere belastbare Quellen
- Recherche-Retry bei `max_output_tokens`, höchstens einmal je Phase
- vorhandene Teilantworten werden nach Möglichkeit angezeigt
- fällt die Herstellerphase aus, läuft die ergänzende Suche weiter; fällt die Ergänzung aus, bleiben Herstellerergebnisse sichtbar
- verständliche Meldungen für Nicht-ITler; technische Diagnose bleibt einklappbar
- Tokenverbrauch, Websuchphasen und Wiederholungen einklappbar sichtbar
- Bildanalyse und Recherche bleiben voneinander getrennt, damit Recherchefehler keine Erkennung löschen
- Provider-Regeln und Regressionstest-Manifeste für Siemens, Shimano, Phoenix Contact, HEIDENHAIN, Schneider/Telemecanique, Gossen Metrawatt, Pfeiffer Vacuum und Siebert

## Render-Deployment

Repository-Struktur auf oberster Ebene:

```text
client/
server/
package.json
render.yaml
README.md
```

Render:

```text
Build Command: npm run build
Start Command: npm start
```

Umgebungsvariablen:

```text
OPENAI_API_KEY=...
OPENAI_VISION_MODEL=gpt-4.1-mini
OPENAI_RESEARCH_MODEL=gpt-5-mini
```

Nach einem Update: **Manual Deploy → Clear build cache & deploy**.

Health-Check:

```text
https://andis-techniker-app.onrender.com/api/health
```

Erwartet:

```json
{
  "ok": true,
  "version": "3.3",
  "architecture": "consolidated-simple-ux-staged-research"
}
```

## Kostenkontrolle

- Die Websuche startet bei Bildern erst nach Bestätigung der erkannten Daten.
- Pro Recherche gibt es höchstens zwei Phasen: Hersteller und ergänzende Fachquellen.
- Jede Phase wird bei einer abgeschnittenen Antwort höchstens einmal kompakt wiederholt.
- Das höhere Tokenlimit ist nur eine Obergrenze; abgerechnet werden tatsächlich verwendete Tokens.
- Die App zeigt den gemeldeten Tokenverbrauch und die Zahl der Suchphasen einklappbar an.

## Sicherheit

Der OpenAI-API-Schlüssel befindet sich ausschließlich im Render-Backend. KI-Angaben müssen gegen Herstellerunterlagen und betriebliche Sicherheitsvorgaben geprüft werden.