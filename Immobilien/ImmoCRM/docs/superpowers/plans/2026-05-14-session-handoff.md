# Session-Handoff — Task 7l 2026-05-14 13:00

## Was 100% läuft

- ✅ Webhook-Endpoint `https://immo-crm-xi.vercel.app/api/akquise/webhook`
  - GET mit `?validationToken=X` → returnt `X` als plain-text 200
  - POST mit Graph-Notification + korrektem clientState → returnt `{ok:true}`
- ✅ Microsoft-Graph-Subscription aktiv (ID `935c3625-3c12-4a83-920e-64c18d046388`, Expiry 2026-05-16)
- ✅ mail_queue-Insert funktioniert (mehrere echte Mail-IDs schon erfolgreich enqueued)
- ✅ Webhook ruft `/api/akquise/process` mit korrektem Bearer-Auth auf
- ✅ Process-Endpoint wird tatsächlich getriggert (Vercel-Logs zeigen Request-Path-Hits)
- ✅ Alle ENV-Vars in Vercel-Production gesetzt (MS_GRAPH_*, SUPABASE_SERVICE_ROLE_KEY, ONEDRIVE_BASE_PATH, MS_GRAPH_WEBHOOK_CLIENT_STATE, ANTHROPIC_API_KEY, SITE_URL)
- ✅ 13 echte Mails im M365-Ordner `CRM-Eingang` warten

## Aktueller Blocker

**`/api/akquise/process` returnt HTTP 500 wegen pdf-parse-Load-Error**

Vercel-Logs zeigen:
```
Warning: Cannot load "@napi-rs/canvas" package: "Error: Cannot find module '@napi-rs/canvas'..."
ReferenceError: DOMMatrix is not defined
at file:///var/task/node_modules/pdfjs-dist/legacy/build/pdf.mjs:15620:22
```

Das ist `pdf-parse@2` (das intern `pdfjs-dist` lädt, das DOMMatrix braucht — Browser-API, in Node-Vercel-Runtime nicht vorhanden).

**Letzter Fix-Versuch:** Downgrade auf `pdf-parse@1.1.1` + Code-Anpassung in `api/akquise/process.ts`. Commits `8412ce6`. Build lokal grün, aber Vercel-Bundle scheint noch alten Code zu enthalten (Error-Log zeigt `pdf-parse@2`-Stack).

## Sofortige nächste Schritte (für neue Session)

1. **Prüfen:** Welche pdf-parse-Version ist tatsächlich im aktuellen Vercel-Bundle?
   ```
   npx vercel logs --since 5m --expand --json | grep -i "pdf-parse\|pdfjs"
   ```
2. **Falls noch v2:** package-lock.json prüfen, ob die v1.1.1 tatsächlich resolved ist. Ggf. `rm -rf node_modules package-lock.json; npm install`, dann committen.
3. **Falls v1 aktiv aber trotzdem Error:** Alternative — pdf-parse komplett raus, pdf-Text-Extraktion durch externen Service oder einfach erstmal weglassen (Stage-Worker erlaubt fehlende PDF-Texte und macht weiter mit `classifyPdf` auf Filename-Basis).

## Hardcoded Test-Trigger für sofortigen Re-Test

```bash
curl -X POST -H "content-type: application/json" -d '{"value":[{"clientState":"88487bf5a6d80714bc6c997afc9d925216f93d62895f2b0c3bab45b7e0398b6a","changeType":"created","resourceData":{"id":"AAMkADAzMzZkYjU5LWZkNmItNDFjOS04ZTI0LTMzYWE4MmE4MWYzYgBGAAAAAADIqEt3QBpITaWyumwoQhApBwAbDJIJMo08Sb_fv_P1XAW6AAW_6lmHAAAbDJIJMo08Sb_fv_P1XAW6AAXARAZ5AAA="}}]}' "https://immo-crm-xi.vercel.app/api/akquise/webhook"
```
(neueste echte Mail in CRM-Eingang, `WG: Welperstraße 39, 41 und 43 in Hattingen`)

Danach: `mail_queue.status` checken (pending → processing → done | error).

## Verfügbare Helfer

- `scripts/spike-check-folder.mjs` — listet CRM-Eingang-Inhalt (gitignored)
- `scripts/spike-list-folders.mjs` — listet alle Mail-Folder
- `scripts/setup-graph-subscription.mjs` — neue Subscription anlegen

## DB-State

mail_queue hat 1 pending-Eintrag (`<025e01dce38d$aeb76260$0c262720$@web.de>` enqueued 10:51 UTC).
deals + contacts: keine pipeline-Einträge bisher (groupingKind=new würde ersten Lead anlegen sobald process-endpoint durchläuft).

## Commit-Trail Task 7l

```
8412ce6 fix(akquise): downgrade pdf-parse to v1 (v2 needs DOMMatrix not in node) ← LATEST
a5755c0 fix(akquise): await process-trigger + log base url
4735254 debug(akquise): add try/catch + console.log to webhook for live diagnosis
0baf44b feat(akquise): restore full pipeline logic with vercel-node signatures
763c4b3 fix(akquise): use vercel-node (req,res) signature instead of web Request/Response
... weitere fixes davor
```

Ende.
