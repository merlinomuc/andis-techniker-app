# Deployment-Checkliste für GitHub und Render

## Wichtig
Nach dem Entpacken müssen diese Einträge direkt sichtbar sein:

- `client/`
- `server/`
- `package.json`
- `render.yaml`
- `README.md`

Es darf **kein zusätzlicher Projekt-Unterordner** dazwischenliegen.

## GitHub
1. Neues oder bestehendes Repository öffnen.
2. Alte Projektdateien vollständig entfernen.
3. Den kompletten Inhalt dieser ZIP in den Repository-Stamm hochladen.
4. Prüfen, dass `render.yaml` direkt auf der Startseite des Repositorys sichtbar ist.
5. Commit erstellen.

## Render
- Root Directory: leer oder `.`
- Build Command: `npm run build`
- Start Command: `npm start`
- Environment Variable: `OPENAI_API_KEY`

Danach: **Manual Deploy → Clear build cache & deploy**.

## Kontrolle
Öffnen:

`https://andis-techniker-app.onrender.com/api/health`

Erwartet:

```json
{
  "ok": true,
  "version": "3.3.2",
  "architecture": "consolidated-simple-ux-staged-research"
}
```
