# Andis Techniker-App – Version 1.6

Mobile-first PWA zur Identifikation technischer Geräte, Bauteile, Typenschilder, Verpackungsetiketten, Displays sowie QR- und Barcodes.

## Neu in Version 1.6

- eigener Bildfokus: **Automatisch**, **Gerät**, **Etikett / Typenschild** oder **Display / Fehlercode**
- Verpackungskartons und Produktetiketten gelten ausdrücklich als Identifikationsziel
- Bildtyp wird im Ergebnis sichtbar ausgewiesen
- Hersteller, Modell-, Bestell-, Typ- und Seriennummern werden separat dargestellt
- Vertrauensstufe für jede gelesene Kennzeichnung
- Etiketten- und Displaymodus senden Bilder mit hoher Detailstufe
- Bilder werden mit bis zu 2.400 Pixeln und höherer JPEG-Qualität vorbereitet
- gedrehte oder schräge Beschriftungen werden im Analyseauftrag ausdrücklich berücksichtigt
- Klartext neben Barcodes wird gegenüber einem erratenen Barcode-Inhalt priorisiert
- Recherche startet bevorzugt mit exakter Hersteller- und Bestellnummer
- weiterhin nur ein KI-Analyseaufruf pro Vorgang

Ein Foto eines Siemens-Verpackungsetiketts sollte nun beispielsweise als **Verpackungsetikett** klassifiziert und anhand einer sichtbaren Bestellnummer wie `6ES7 ...` identifiziert werden, auch wenn das Gerät selbst nicht auf dem Foto zu sehen ist.

## Weitere Funktionen

- Foto direkt mit der Handykamera aufnehmen
- ein oder mehrere Bilder aus der Galerie auswählen
- bis zu vier Ansichten gemeinsam analysieren
- QR- und Barcode mit der Kamera scannen
- Hersteller, Typ, Artikelnummer oder Fehlercode manuell eingeben
- Identifikation, Fehlersuche, Dokumentensuche und Ersatzteilsuche
- Quellenlinks und Sicherheitshinweise
- lokale Historie
- als PWA auf Android und iPhone zum Home-Bildschirm hinzufügen

## Render-Deployment

1. Inhalt dieses Ordners in das GitHub-Repository übernehmen.
2. Änderungen committen und pushen.
3. In Render folgende Befehle verwenden:

```text
Build Command: npm run build
Start Command: npm start
```

4. `OPENAI_API_KEY` als geheime Umgebungsvariable setzen.
5. Danach **Manual Deploy → Clear build cache & deploy** ausführen.

Die mitgelieferte `render.yaml` enthält diese Konfiguration bereits.

## Lokal starten

```bash
npm run install:all
cp server/.env.example server/.env
# OPENAI_API_KEY in server/.env eintragen
npm run dev --prefix server
npm run dev --prefix client
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:3001`

## Empfohlene Aufnahme

Für kleine Typenschilder oder Verpackungslabels den Modus **Etikett / Typenschild** wählen. Das Schild möglichst groß, gerade und ohne Spiegelung fotografieren. Ein zweites Gesamtfoto kann zusätzlich hochgeladen werden.

## Sicherheit

Der OpenAI-API-Schlüssel liegt ausschließlich im Backend. KI-Angaben müssen mit offiziellen Herstellerunterlagen und betrieblichen Vorgaben abgeglichen werden.


## Neu in Version 1.6

- echte zweistufige Analyse: zuerst reine Bilderkennung, danach Recherche
- Websuche kann die visuelle Texterkennung nicht mehr überlagern
- erkannter Rohtext kann zur Kontrolle aufgeklappt werden
- sichtbarer Button **Neue Suche** nach jedem Ergebnis
- Button **Weiteres Foto ergänzen**
- speziell robuster für Verpackungsetiketten und seitlich fotografierte Typenschilder


## Neu in Version 1.6

- Structured Outputs mit strengem JSON-Schema für die visuelle Erkennung
- Fallback-Auswertung, falls eine Modellantwort trotzdem kein gültiges JSON ist
- automatischer zweiter Leseversuch bei leerer Erkennung; nur dann entsteht ein zusätzlicher API-Aufruf
- zweiter Versuch behandelt das Bild gezielt als Dokument oder Verpackungsetikett und nutzt hohe Bilddetails
- Diagnosebereich mit Parse-Status, Retry-Status, Pipeline und technischer Rohantwort
- erkannte Siemens- und weitere typische Industrienummern werden im Fallback aus Freitext gerettet
- `Neue Suche` bleibt direkt im Ergebnis verfügbar

### Testfall Siemens-Verpackung

Beim mitgelieferten Analyseablauf wird ein seitlich aufgenommenes Verpackungsetikett gezielt nach Hersteller, Produktfamilie und Bestellnummer untersucht. Erwartete sichtbare Angaben des Testfotos sind unter anderem `SIEMENS`, `SIMATIC S7-300` und `6ES7 318-3FL01-0AB0`.

### Diagnose

Nach einer Analyse kann der Bereich **Diagnoseinformationen** geöffnet werden. `Auswertung: json` bedeutet, dass das Structured Output korrekt verarbeitet wurde. `Zweiter Leseversuch: Ja` bedeutet, dass der erste Versuch leer war und automatisch ein engerer, hochauflösender Leseversuch ausgeführt wurde.
