# Andis Techniker-App v1.7

Stabilitäts-Release für die visuelle Erkennung von technischen Geräten, Typenschildern, Verpackungsetiketten und Displays.

## Wichtigste Änderungen

- Eigenes Vision-Modell (`gpt-4.1-mini`) für Bild- und Texterkennung.
- Recherche weiterhin mit `gpt-5-mini`.
- Höheres Ausgabelimit für die strukturierte Bildanalyse.
- Unvollständige oder leere API-Antworten werden als technischer Fehler angezeigt und nicht mehr fälschlich als „Unbekannt“.
- API-Status, verwendetes Vision-Modell und Tokenverbrauch stehen in den Diagnoseinformationen.
- Fotos können vor der Analyse um 90 Grad nach links oder rechts gedreht werden.
- Automatischer zweiter Leseversuch bleibt erhalten und wird nur bei leerer Erkennung verwendet.
- „Neue Suche“ und „Weiteres Foto ergänzen“ bleiben enthalten.

## Render

Build Command:

```text
npm run build
```

Start Command:

```text
npm start
```

Erforderliche Umgebungsvariable:

```text
OPENAI_API_KEY=...
```

Voreinstellungen aus `render.yaml`:

```text
OPENAI_MODEL=gpt-5-mini
OPENAI_VISION_MODEL=gpt-4.1-mini
```

Nach dem Upload zu GitHub in Render **Manual Deploy → Clear build cache & deploy** ausführen.

Health-Check:

```text
/api/health
```

Erwartete Version: `1.7`.

## Empfohlener Test mit seitlichem Etikett

1. Foto aus Galerie auswählen.
2. Fokus **Etikett / Typenschild** wählen.
3. Das Foto mit dem Drehknopf so ausrichten, dass die Beschriftung waagerecht steht.
4. Analyse starten.
5. Falls ein Fehler erscheint, Diagnoseinformationen öffnen. Eine leere oder unvollständige Modellantwort wird jetzt ausdrücklich als technischer Fehler gemeldet.
