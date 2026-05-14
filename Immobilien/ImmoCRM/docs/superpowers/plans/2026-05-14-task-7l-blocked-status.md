# Task 7l — Stand 2026-05-14, blockiert

## Was fertig ist

- Branch `main` enthält Pipeline-Code (alle Schritte 7a–7k)
- 36 Tests grün, lokaler Build grün
- Code committet bis `14c9218`
- Vercel-Deployment baut durch (Build-Phase grün)
- Env-Vars in Vercel-Dashboard gesetzt
- M365-Setup (Ordner CRM-Eingang, QuickStep) fertig

## Was blockiert

Webhook-Endpoint `https://immo-crm-xi.vercel.app/api/akquise/webhook` antwortet mit HTTP-Fehler beim Aufruf. Mehrere Iterationen gefixt:

- `161a015` Migration von Next.js-App-Router zu Vite-Vercel-Convention
- `604a56a` ESM-`.js`-Extensions zu Imports
- `8b1a6e3` `supabaseAdmin` nach `api/_lib/` verschoben
- `a8cf75d` TypeScript-Build-Errors gefixt
- `312966e` `new URL(req.url)` mit Base-URL ergänzt
- `14c9218` `validationToken`-Parsing ohne URL-Konstruktor (Vercel `req.url`-Quirk)

Letzter Test gegen `14c9218`: Request hängt 15s ohne Response (Function-Timeout statt Crash).

## Drei realistische Pfade

### A) Vercel-CLI lokal einloggen
PowerShell-Execution-Policy verhindert `npx vercel login`. Fix:
```
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```
Dann `npx vercel login`. Danach kann ich `vercel logs`, `vercel dev` direkt nutzen — schnelles Debugging ohne Manual-Dashboard-Klicks.

### B) Webhook auf Minimal-Echo reduzieren
Komplette Pipeline-Logik aus `webhook.ts` rausschneiden. Nur den 5-Zeiler:
```ts
export default async function handler(req: Request) {
  const m = req.url?.match(/validationToken=([^&]+)/);
  if (m) return new Response(decodeURIComponent(m[1]), { headers: { 'Content-Type': 'text/plain' } });
  return new Response('OK');
}
```
Wenn das funktioniert → Pipeline-Logik in `process.ts` einbauen statt in `webhook.ts`. Wenn das nicht funktioniert → Vercel-Project-Config-Problem.

### C) Pause + nächste Session
Stand hier dokumentiert lassen, später frisch ansetzen.

## Was ich NICHT mehr tue ohne Entscheidung

- Keine weiteren Code-Fixes auf Verdacht
- Keine weiteren Log-Anfragen
- Keine weiteren Vercel-Dashboard-Aktionen

## Entscheidung steht aus

User wählt: A, B, oder C.
