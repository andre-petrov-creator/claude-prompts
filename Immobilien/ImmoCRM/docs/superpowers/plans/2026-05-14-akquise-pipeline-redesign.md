# Akquise-Pipeline Redesign — Implementierungsplan

> **VORLAGE — ERSETZT am 2026-05-15.**
> Dieser Plan war die ursprüngliche B1-B9-Sequenz für den lokalen Watcher. Er wurde durch [`2026-05-15-akquise-pipeline-local-watcher-final.md`](2026-05-15-akquise-pipeline-local-watcher-final.md) ersetzt, der zusätzlich Playwright-Integration, At-log-on-Trigger und Lehren aus dem 2026-05-14-Trockentest enthält. Inhalte hier sind weiterhin nützlich als Vorlage, aber NICHT mehr maßgeblich.

**Primärer Plan-Pfad:** `c:\meine-projekte\Immobilien\ImmoCRM\docs\superpowers\plans\2026-05-14-akquise-pipeline-redesign.md`
(Diese Datei hier ist der Plan-Modus-Stub; der vollständige Plan wird gleich an den Primärpfad geschrieben. Inhalt ist identisch.)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

---

## Context

**Warum dieser Plan:** Schritt 7 der ImmoCRM-Implementierung (Akquise-Pipeline) wurde als vollautomatische Cloud-Pipeline gebaut, bricht aber am PDF-Parsen in der Vercel-Node-Runtime (`pdf-parse` braucht `DOMMatrix`, nicht vorhanden). Statt das PDF-Problem in der Cloud zu lösen, wird der Inhalts-Teil (PDF-Lesen, Adress-Extraktion, Quick-Check, Lead-Insert) auf den lokalen PC verlagert. Cloud wird zum reinen Briefträger.

**Spec:** `c:\meine-projekte\Immobilien\ImmoCRM\docs\superpowers\specs\2026-05-14-akquise-pipeline-redesign.md` (Status: abgenommen, Commit 26c9a67 auf main).

**Ergebnis nach Abschluss:** Mail in M365 CRM-Eingang → max 5 Min später Lead mit Score im ImmoCRM, ohne PC-Aktion (wenn PC läuft); bei PC-aus Stau-Abarbeitung beim nächsten Hochfahren. Aufteiler-Vollanalyse bleibt manueller Folge-Schritt über `.code-workspace`-Doppelklick.

**Detail-Entscheidungen aus Vorgespräch:**
1. Skill-Struktur: **Bestehender Modul-0-Skill (`aufteiler-modul-0-quickcheck`) wird um einen `akquise`-Modus erweitert** — kein zweiter Skill. Modus-Erkennung am Input (Ordnerpfad mit `.trigger` = akquise-Modus, `objekt_slug` = klassischer Aufteiler-Modus). Spec §5.6 wird damit zugunsten der Single-Source-of-Truth-Logik überstimmt.
2. Migration-Reihenfolge: **DB-Migration zuerst, dann Code-Umbau.** Saubere DB-Vorbedingung, keine Status-Konflikte.
3. Migration-Nummer: Spec sagt `005_mail_queue_status_extension.sql` — **echte nächste Nummer ist `016`** (013 ist bereits `mail_queue`, 014 ist `priority_score`, 015 ist View-Recompile). Datei heißt also `016_mail_queue_status_extension.sql`.

---

## Architektur in Kurzform

```
Mail → M365 CRM-Eingang
  → Webhook (Vercel, UNVERÄNDERT)
  → mail_queue.insert(status='pending') (UNVERÄNDERT)
  → /api/akquise/process (STARK ABGESPECKT: nur Files+Trigger in OneDrive)
  → uploadFiles to `_inbox/<sanitized-msg-id>/`
  → mail_queue.update(status='ready_for_quickcheck')
  → OneDrive synct auf PC
  → Task Scheduler (60s) → watch-inbox.ps1 findet .trigger
  → claude --skill aufteiler-modul-0-quickcheck --arg <folder>
  → Modul-0 akquise-Modus: PDFs lesen, Adresse extrahieren, Score, Lead-Insert
  → Ordner-Rename _inbox/<id>/ → Objekte/<adresse-slug>/
  → .code-workspace, quickcheck-log.md, state.json
  → mail_queue.update(status='done', deal_id=<id>)
```

---

## Tech Stack

- **Cloud:** TypeScript auf Vercel (Node 22), Microsoft Graph SDK, Supabase JS
- **DB:** Supabase (Postgres Free Tier)
- **Lokaler Watcher:** PowerShell 5.1, Windows Task Scheduler
- **Quick-Check:** Claude Code Headless-Modus (`claude --skill <name> ...`), Modul-0-Skill-Erweiterung in Markdown
- **Storage:** OneDrive-Ordner unter `001_AQUISE/_inbox/` und `001_AQUISE/Objekte/`

---

## File Structure (was wird angefasst)

### Cloud (`c:\meine-projekte\Immobilien\ImmoCRM\`)
- **Modify:** `api/akquise/process.ts` — Inhalt drastisch reduziert (kein PDF-Parsen, kein LLM, kein Lead-Insert)
- **Modify:** `api/_lib/uploadOneDrive.ts` — Ziel-Pfad-Konstante auf `_inbox/<msg-id>/`, Interface-Anpassung
- **Delete:** `api/_lib/extractAddress.ts`, `quickCheck.ts`, `insertLead.ts`, `classifyPdf.ts`, `extractContact.ts`, `writeWorkspace.ts`
- **Modify:** `package.json` + `package-lock.json` — `pdf-parse` raus
- **Create:** `supabase/migrations/016_mail_queue_status_extension.sql`

### Lokaler Watcher (neuer Subfolder)
- **Create:** `c:\meine-projekte\Immobilien\akquise-watcher\watch-inbox.ps1`
- **Create:** `c:\meine-projekte\Immobilien\akquise-watcher\task-scheduler.xml`
- **Create:** `c:\meine-projekte\Immobilien\akquise-watcher\README.md`
- **Create:** `c:\meine-projekte\Immobilien\akquise-watcher\.env.example`
- **Create:** `c:\meine-projekte\Immobilien\akquise-watcher\.gitignore`

### Aufteiler-Skill (`c:\meine-projekte\Immobilien\Aufteiler\`)
- **Modify:** `skills/aufteiler-modul-0-quickcheck/SKILL.md` — Akquise-Modus hinzufügen
- **Modify:** `docs/aufteiler-modul-0-quickcheck.md` (anlegen falls fehlt) — Akquise-Modus-Doku
- **Modify:** `CLAUDE.md` — Hinweis: Modul-0 hat zwei Modi (Aufteiler interaktiv vs Akquise vollautomatisch)

### Mono-Repo + ImmoCRM-Doku
- **Modify:** `c:\meine-projekte\README.md` — Eintrag `Immobilien/akquise-watcher/`
- **Modify:** `c:\meine-projekte\Immobilien\ImmoCRM\docs\03_decisions.md` — neuer ADR
- **Modify:** `c:\meine-projekte\Immobilien\ImmoCRM\docs\04_progress.md` — Schritt 7 Status
- **Modify:** `c:\meine-projekte\Immobilien\ImmoCRM\docs\02_implementierungsplan.md` — Querverweis-Aktualisierung (Plan-Pfad-Link)
- **Modify:** `c:\meine-projekte\Immobilien\ImmoCRM\docs\superpowers\specs\2026-05-11-akquise-pipeline-cloud-design.md` — Banner "ersetzt"

---

## Bauphilosophie (gemäß ImmoCRM 02_implementierungsplan.md)

1. Atomar (jeder Schritt in einer Coding-Session abschließbar, max 2-4 h)
2. Testbar (am Ende läuft etwas Sichtbares oder ein klarer Test passt)
3. Kein Lock-in (späterer Schritt überschreibt nichts kritisch von früherem)
4. Nach jedem Schritt Verifikation + Commit (auf Wunsch — Commits nur auf User-Auftrag, gemäß globaler CLAUDE.md)

---

## Vor-Verifikation (vor B1)

- [ ] **V0a:** Microsoft-Graph-Subscription-Status prüfen. Spec §14 R10: Expiry 2026-05-16.
  - Run: in Vercel-Logs nach letztem `setup-graph-subscription`-Lauf suchen, oder `node scripts/setup-graph-subscription.mjs --check` (sofern Check-Flag existiert; sonst Subscription-ID `935c3625-...` in Graph Explorer GET `/subscriptions/{id}` abfragen).
  - Erwartet: Subscription gültig bis ≥ 2026-05-15. Falls < 2 Tage Restzeit: Renew **vor** B1 ausführen (`node scripts/setup-graph-subscription.mjs`).
- [ ] **V0b:** `mail_queue`-Tabelle inspizieren.
  - Run: Supabase SQL-Editor `SELECT status, count(*) FROM mail_queue GROUP BY status;`
  - Erwartet: Bestätigung über aktuelle Inhalte (1 pending laut Spec §3.2). User sieht das vor B1 und entscheidet, ob DELETE in B1 OK ist.

---

## Task B1: DB-Migration `016_mail_queue_status_extension.sql`

**Files:**
- Create: `c:\meine-projekte\Immobilien\ImmoCRM\supabase\migrations\016_mail_queue_status_extension.sql`

**Voraussetzung:** V0b durchgeführt, User hat bestätigt, dass `mail_queue` geleert werden darf.

- [ ] **Step 1: Migration-Datei schreiben**

Inhalt von `016_mail_queue_status_extension.sql`:

```sql
-- 016_mail_queue_status_extension.sql
-- Erweitert mail_queue.status um 'ready_for_quickcheck' (lokaler Quick-Check-Übergabepunkt)

ALTER TABLE mail_queue DROP CONSTRAINT IF EXISTS mail_queue_status_check;

ALTER TABLE mail_queue ADD CONSTRAINT mail_queue_status_check
  CHECK (status IN ('pending', 'processing', 'ready_for_quickcheck', 'done', 'error'));
```

- [ ] **Step 2: Migration im Supabase SQL-Editor ausführen**

Im Supabase Dashboard → SQL Editor → New Query → Inhalt der Datei einfügen → "Run".
Erwartet: `Success. No rows returned.`

- [ ] **Step 3: Constraint verifizieren**

Im Supabase SQL-Editor:

```sql
SELECT conname, pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'mail_queue' AND conname = 'mail_queue_status_check';
```

Erwartet: Eine Zeile mit `CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'ready_for_quickcheck'::text, 'done'::text, 'error'::text])))`.

- [ ] **Step 4: mail_queue aufräumen**

Im Supabase SQL-Editor:

```sql
DELETE FROM mail_queue WHERE status IN ('pending', 'processing', 'error');
SELECT status, count(*) FROM mail_queue GROUP BY status;
```

Erwartet: 0 Zeilen mit `pending`/`processing`/`error`. `done`-Einträge bleiben (Historie).

- [ ] **Step 5: Commit (auf User-Auftrag)**

Auf User-Bestätigung:
```bash
git add ImmoCRM/supabase/migrations/016_mail_queue_status_extension.sql
git commit -m "feat(akquise): mail_queue status 'ready_for_quickcheck' freigeschaltet"
```

**Verifikation B1:** `mail_queue_status_check` enthält den neuen Wert; Tabelle ist leer bis auf Historie. Cloud-Code läuft weiter mit alten Werten — keine Disruption.

---

## Task B2: Cloud-Code abspecken (`process.ts` + Lib-Files)

**Files:**
- Modify: `c:\meine-projekte\Immobilien\ImmoCRM\api\akquise\process.ts`
- Delete: `c:\meine-projekte\Immobilien\ImmoCRM\api\_lib\extractAddress.ts`
- Delete: `c:\meine-projekte\Immobilien\ImmoCRM\api\_lib\quickCheck.ts`
- Delete: `c:\meine-projekte\Immobilien\ImmoCRM\api\_lib\insertLead.ts`
- Delete: `c:\meine-projekte\Immobilien\ImmoCRM\api\_lib\classifyPdf.ts`
- Delete: `c:\meine-projekte\Immobilien\ImmoCRM\api\_lib\extractContact.ts`
- Delete: `c:\meine-projekte\Immobilien\ImmoCRM\api\_lib\writeWorkspace.ts`
- Modify: `c:\meine-projekte\Immobilien\ImmoCRM\package.json`
- Modify: `c:\meine-projekte\Immobilien\ImmoCRM\package-lock.json`

- [ ] **Step 1: Inboxname-Sanitizer-Helper inline definieren (in process.ts)**

Wird im neuen `process.ts` (Step 3) inline benutzt:

```typescript
function sanitizeMessageId(id: string): string {
  return id.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100);
}
```

Begründung: Spec §5.3, max 100 Zeichen, nur `[A-Za-z0-9._-]`.

- [ ] **Step 2: Sechs Lib-Files löschen**

Run:
```powershell
Remove-Item c:\meine-projekte\Immobilien\ImmoCRM\api\_lib\extractAddress.ts
Remove-Item c:\meine-projekte\Immobilien\ImmoCRM\api\_lib\quickCheck.ts
Remove-Item c:\meine-projekte\Immobilien\ImmoCRM\api\_lib\insertLead.ts
Remove-Item c:\meine-projekte\Immobilien\ImmoCRM\api\_lib\classifyPdf.ts
Remove-Item c:\meine-projekte\Immobilien\ImmoCRM\api\_lib\extractContact.ts
Remove-Item c:\meine-projekte\Immobilien\ImmoCRM\api\_lib\writeWorkspace.ts
```

- [ ] **Step 3: `api/akquise/process.ts` komplett neu schreiben**

Kompletter Inhalt (überschreibt die alte Datei):

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchMail, fetchAttachments } from '../_lib/fetchMail.js';
import { parseEmail } from '../_lib/parseEmail.js';
import { resolveLink } from '../_lib/resolveLink.js';
import { uploadFiles } from '../_lib/uploadOneDrive.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

function sanitizeMessageId(id: string): string {
  return id.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const expected = process.env.MS_GRAPH_WEBHOOK_CLIENT_STATE;
  if (!expected || req.headers.authorization !== `Bearer ${expected}`) {
    res.status(401).send('Unauthorized');
    return;
  }

  const { messageId, graphMessageId } = (req.body ?? {}) as {
    messageId?: string;
    graphMessageId?: string;
  };
  if (!messageId || !graphMessageId) {
    res.status(400).json({ error: 'messageId and graphMessageId required' });
    return;
  }

  const supa = supabaseAdmin();

  await supa
    .from('mail_queue')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('message_id', messageId);

  try {
    const [graphMail, graphAttachments] = await Promise.all([
      fetchMail(graphMessageId),
      fetchAttachments(graphMessageId),
    ]);
    const mail = parseEmail(graphMail, graphAttachments);

    const linkAttachments: Array<{ name: string; buffer: Buffer; contentType: string }> = [];
    for (const link of mail.links) {
      const resolved = await resolveLink(link);
      if (resolved) linkAttachments.push({ ...resolved, contentType: 'application/pdf' });
    }
    const allFiles = [...mail.attachments, ...linkAttachments];

    const inboxFolder = sanitizeMessageId(messageId);

    const meta = {
      messageId,
      graphMessageId,
      subject: mail.subject,
      from: mail.from,
      to: mail.to,
      date: mail.date,
      inReplyTo: mail.inReplyTo,
      text: mail.text,
      links: mail.links,
      files: allFiles.map((f) => ({ name: f.name, size: f.buffer.length, contentType: f.contentType })),
      schemaVersion: 1,
    };

    const trigger = {
      messageId,
      enqueuedAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    // WICHTIG: .trigger als LETZTE Datei (siehe Spec §5.5 R1 — Watcher-Signal "alles da")
    const uploadInput = [
      ...allFiles,
      {
        name: '_meta.json',
        buffer: Buffer.from(JSON.stringify(meta, null, 2)),
        contentType: 'application/json',
      },
      {
        name: '.trigger',
        buffer: Buffer.from(JSON.stringify(trigger, null, 2)),
        contentType: 'application/json',
      },
    ];

    const upload = await uploadFiles({ folderName: inboxFolder, files: uploadInput });

    await supa
      .from('mail_queue')
      .update({
        status: 'ready_for_quickcheck',
        done_at: null,
      })
      .eq('message_id', messageId);

    res.status(200).json({
      ok: true,
      inboxFolder,
      webUrl: upload.webUrl,
      localPath: upload.localPath,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supa
      .from('mail_queue')
      .update({ status: 'error', error_msg: msg })
      .eq('message_id', messageId);
    res.status(500).json({ ok: false, error: msg });
  }
}
```

**Wichtige Änderungen ggü. alt:**
- Kein `pdf-parse`-Import mehr.
- Keine LLM-Calls (`extractAddress`, `quickCheck`, `extractContact`).
- Kein `insertLead` mehr (das macht der lokale Skill).
- `uploadFiles` wird mit neuem Interface (`folderName` statt `addressFolder`) aufgerufen — siehe B3.
- `_meta.json` enthält jetzt auch `text`, `links`, `to`, `inReplyTo` damit der lokale Skill alles hat was er braucht ohne Re-Fetch der Mail.
- Neuer Status `ready_for_quickcheck` wird gesetzt (B1 hat das DB-seitig vorbereitet).

- [ ] **Step 4: `pdf-parse` aus package.json entfernen**

In `c:\meine-projekte\Immobilien\ImmoCRM\package.json`:
- Aus `dependencies` die Zeile `"pdf-parse": "^1.x.x"` entfernen (und ggf. `@types/pdf-parse` aus `devDependencies`).
- Run: `npm install` (im ImmoCRM-Ordner). Erwartet: `package-lock.json` aktualisiert, `node_modules/pdf-parse` weg.

- [ ] **Step 5: Type-Check + Build lokal**

Run im ImmoCRM-Ordner:
```bash
npx tsc --noEmit
```
Erwartet: Keine Errors. (Insbesondere keine "Cannot find module pdf-parse" mehr, da auch der Import aus `process.ts` weg ist.)

Falls Build-Skript existiert:
```bash
npm run build
```
Erwartet: erfolgreicher Build.

- [ ] **Step 6: Commit (auf User-Auftrag)**

```bash
git add ImmoCRM/api/akquise/process.ts ImmoCRM/api/_lib ImmoCRM/package.json ImmoCRM/package-lock.json
git commit -m "feat(akquise): cloud auf briefträger-rolle reduziert (kein pdf-parse, kein LLM)"
```

**Verifikation B2:** TypeScript-Check passt, sechs Lib-Files weg, `process.ts` enthält keinen `pdf-parse`-Import mehr.

---

## Task B3: `uploadOneDrive.ts` Pfad-Konstante anpassen + Vercel-Deploy

**Files:**
- Modify: `c:\meine-projekte\Immobilien\ImmoCRM\api\_lib\uploadOneDrive.ts`

- [ ] **Step 1: Interface und Pfad-Konstante umbauen**

Aktuelles File hat:
- Konstante `BASE = '/Immobilien/001_AQUISE/Objekte'`
- Interface `UploadInput { addressFolder: string; files: ... }`
- Interface `UploadResult { folderPath: string; webUrl: string; localPath: string; uploadedFiles: ... }`

Komplett neu schreiben mit:

```typescript
import { graphClient, getMailbox, getLocalPathPrefix } from './msGraphClient.js';

// BASE muss als Ordnerkette im OneDrive-Mailbox-Drive bereits existieren.
// Pipeline legt nur den inbox-Unterordner an, nicht die Basis-Hierarchie.
const BASE = process.env.ONEDRIVE_BASE_PATH || '/Immobilien/001_AQUISE/_inbox';

export interface UploadInput {
  folderName: string;
  files: Array<{ name: string; buffer: Buffer; contentType: string }>;
}

export interface UploadResult {
  folderPath: string;
  webUrl: string;
  localPath: string;
  uploadedFiles: Array<{ name: string; itemId: string; size: number }>;
}

export async function uploadFiles(input: UploadInput): Promise<UploadResult> {
  const client = await graphClient();
  const mailbox = getMailbox();
  const folder = sanitizeFolderName(input.folderName);
  const folderUrl = `${BASE}/${folder}`;
  const driveRoot = `/users/${mailbox}/drive/root`;

  try {
    await client
      .api(`${driveRoot}:${BASE}:/children`)
      .post({
        name: folder,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      });
  } catch (err: any) {
    if (err?.statusCode !== 409) throw err;
  }

  const uploaded: UploadResult['uploadedFiles'] = [];
  for (const file of input.files) {
    if (file.buffer.length < 4 * 1024 * 1024) {
      const item = await client
        .api(`${driveRoot}:${folderUrl}/${file.name}:/content`)
        .put(file.buffer);
      uploaded.push({ name: file.name, itemId: item.id, size: file.buffer.length });
    } else {
      const session = await client
        .api(`${driveRoot}:${folderUrl}/${file.name}:/createUploadSession`)
        .post({ '@microsoft.graph.conflictBehavior': 'replace' });
      const res = await fetch(session.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(file.buffer.length),
          'Content-Range': `bytes 0-${file.buffer.length - 1}/${file.buffer.length}`,
        },
        body: new Uint8Array(file.buffer),
      });
      if (!res.ok) throw new Error(`Upload-Session-PUT failed: ${res.status}`);
      const item = (await res.json()) as { id: string };
      uploaded.push({ name: file.name, itemId: item.id, size: file.buffer.length });
    }
  }

  const folderItem = await client.api(`${driveRoot}:${folderUrl}`).get();

  return {
    folderPath: folderUrl,
    webUrl: folderItem.webUrl,
    localPath: `${getLocalPathPrefix()}\\${folder}`,
    uploadedFiles: uploaded,
  };
}

function sanitizeFolderName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 200);
}
```

**Änderungen:**
- `BASE` zeigt auf `_inbox/` statt `Objekte/`.
- `UploadInput.addressFolder` → `UploadInput.folderName` (passt zum Call aus `process.ts`).
- Logik sonst unverändert.

- [ ] **Step 2: ENV-Variable in Vercel prüfen**

Falls `ONEDRIVE_BASE_PATH` in Vercel-ENV gesetzt war (Override): in Vercel-Dashboard → Settings → Environment Variables.
- Wenn vorhanden und alter Wert: auf `/Immobilien/001_AQUISE/_inbox` setzen oder ganz löschen (Code-Default greift).
- Wenn nicht vorhanden: nichts tun.

- [ ] **Step 3: OneDrive-Basis-Ordner anlegen (falls nicht vorhanden)**

Manuell im OneDrive-Web oder Explorer:
- `Immobilien/001_AQUISE/_inbox/` (anlegen falls nicht vorhanden)
- `Immobilien/001_AQUISE/Objekte/` (anlegen falls nicht vorhanden — wird vom Skill in B5 verwendet)

- [ ] **Step 4: Type-Check**

Run im ImmoCRM-Ordner:
```bash
npx tsc --noEmit
```
Erwartet: Keine Errors.

- [ ] **Step 5: Commit (auf User-Auftrag)**

```bash
git add ImmoCRM/api/_lib/uploadOneDrive.ts
git commit -m "feat(akquise): upload-pfad auf _inbox/<msg-id>/ umgestellt"
```

- [ ] **Step 6: Vercel-Deploy auslösen**

Push auf main (auf User-Auftrag):
```bash
git push origin main
```
Erwartet: Vercel-Deploy-Webhook löst Deploy aus, Vercel-Dashboard zeigt nach ~1 Min "Ready".

- [ ] **Step 7: Smoke-Test Webhook-Endpoint**

Run (lokal):
```bash
curl -i "https://immo-crm-xi.vercel.app/api/akquise/webhook?validationToken=ping"
```
Erwartet: HTTP 200, Body `ping`. Bestätigt: Deploy läuft, Webhook erreichbar.

**Verifikation B3:** Cloud-Code ist deployt, OneDrive-Basisordner existieren, Webhook antwortet. Erst jetzt sind Test-Mails zulässig.

---

## Task B4: Akquise-Watcher anlegen

**Files:**
- Create: `c:\meine-projekte\Immobilien\akquise-watcher\watch-inbox.ps1`
- Create: `c:\meine-projekte\Immobilien\akquise-watcher\task-scheduler.xml`
- Create: `c:\meine-projekte\Immobilien\akquise-watcher\README.md`
- Create: `c:\meine-projekte\Immobilien\akquise-watcher\.env.example`
- Create: `c:\meine-projekte\Immobilien\akquise-watcher\.gitignore`

- [ ] **Step 1: Watcher-Ordner anlegen**

Run:
```powershell
New-Item -ItemType Directory -Path c:\meine-projekte\Immobilien\akquise-watcher
```

- [ ] **Step 2: `watch-inbox.ps1` schreiben**

Vollständiger Inhalt:

```powershell
# Akquise-Watcher: scannt OneDrive _inbox alle 60 Sek nach .trigger-Dateien
# und startet Claude Code mit dem aufteiler-modul-0-quickcheck-Skill im Akquise-Modus.

$ErrorActionPreference = "Stop"

# --- Config aus .env laden (Pfad relativ zum Skript) ---
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $scriptDir ".env"
if (-not (Test-Path $envFile)) {
  Write-Host "FATAL: .env nicht gefunden: $envFile"
  exit 1
}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.*?)\s*$') {
    Set-Item -Path "env:$($matches[1])" -Value $matches[2]
  }
}

$inboxBase = $env:AKQUISE_INBOX_PATH
if (-not $inboxBase) {
  Write-Host "FATAL: AKQUISE_INBOX_PATH nicht gesetzt"
  exit 1
}
if (-not (Test-Path $inboxBase)) {
  Write-Host "INFO: Inbox-Pfad existiert noch nicht (OneDrive-Sync hat noch keinen Ordner): $inboxBase"
  exit 0
}

$logFile = Join-Path $scriptDir "watcher.log"
$lockFile = Join-Path $inboxBase ".lock"

function Write-Log($msg) {
  $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $logFile -Value "$ts $msg"
}

# --- Stale-Lock-Schutz: Lock älter 15 Min → ignorieren ---
if (Test-Path $lockFile) {
  $age = (Get-Date) - (Get-Item $lockFile).LastWriteTime
  if ($age.TotalMinutes -gt 15) {
    Write-Log "Stale lock entdeckt (Alter $($age.TotalMinutes) min), entferne"
    Remove-Item $lockFile -Force
  } else {
    Write-Log "Lock aktiv (Alter $($age.TotalMinutes) min), exit"
    exit 0
  }
}

# --- Trigger-Dateien suchen ---
$triggers = Get-ChildItem -Path $inboxBase -Filter ".trigger" -Recurse -ErrorAction SilentlyContinue
if (-not $triggers -or $triggers.Count -eq 0) {
  exit 0
}

Write-Log "Gefunden: $($triggers.Count) Trigger"
New-Item -Path $lockFile -ItemType File -Force | Out-Null

try {
  foreach ($trigger in $triggers) {
    $folder = $trigger.Directory.FullName
    Write-Log "Starte Quick-Check für: $folder"
    # Headless Claude-Code-Aufruf
    # --print: nicht-interaktiv
    # --skill: konkreten Skill auswählen
    # --arg: Ordnerpfad als Argument (Modul-0 erkennt: Pfad mit .trigger → Akquise-Modus)
    $claudeOutput = & claude --print --skill aufteiler-modul-0-quickcheck --arg "$folder" 2>&1
    $claudeOutput | Out-File -FilePath $logFile -Append -Encoding utf8
    Write-Log "Quick-Check fertig für: $folder"
  }
} catch {
  Write-Log "FEHLER: $($_.Exception.Message)"
} finally {
  if (Test-Path $lockFile) {
    Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
  }
}
```

**Hinweise:**
- `claude --print --skill <name> --arg <value>` ist die Headless-Aufrufsignatur. Falls Claude-Code-CLI das in der konkreten Version nicht so unterstützt: alternativer Weg im B4-Step-5-Verifikationsschritt prüfen (Fallback: `claude --print "Verwende den Skill aufteiler-modul-0-quickcheck mit Argument $folder"`).
- Stale-Lock bei 15 Min (Spec §5.5).
- Logging in `watcher.log` (gitignored).

- [ ] **Step 3: `.env.example` schreiben**

```
# Pfad zum OneDrive-Akquise-Inbox-Ordner
# Beispiel: C:\Users\andre\OneDrive\Immobilien\001_AQUISE\_inbox
AKQUISE_INBOX_PATH=C:\Users\andre\OneDrive\Immobilien\001_AQUISE\_inbox

# Pfad zum OneDrive-Akquise-Objekte-Ordner (wird vom Quick-Check-Skill für Ordner-Rename benutzt)
AKQUISE_OBJEKTE_PATH=C:\Users\andre\OneDrive\Immobilien\001_AQUISE\Objekte

# Supabase-Credentials (Skill schreibt direkt via REST)
SUPABASE_URL=https://<projekt>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

- [ ] **Step 4: `.gitignore` schreiben**

```
.env
*.log
.lock
```

- [ ] **Step 5: `README.md` schreiben**

```markdown
# Akquise-Watcher

Lokaler Watcher (PowerShell + Windows Task Scheduler), der den OneDrive-`_inbox`-Ordner alle 60 Sek auf `.trigger`-Dateien scannt und für jeden Treffer den `aufteiler-modul-0-quickcheck`-Skill im Akquise-Modus startet.

## Einmaliges Setup

1. `.env.example` nach `.env` kopieren und Werte setzen:
   - `AKQUISE_INBOX_PATH` — OneDrive-Pfad zum `_inbox`-Ordner (PC-lokal)
   - `AKQUISE_OBJEKTE_PATH` — OneDrive-Pfad zum `Objekte`-Ordner
   - `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` — aus Supabase-Dashboard

2. Task Scheduler einrichten:
   - Run: `schtasks /Create /XML task-scheduler.xml /TN "Akquise-Watcher"` (Admin-PowerShell)
   - Alternativ: Task Scheduler GUI → Importieren → `task-scheduler.xml`.

3. Manueller Probelauf:
   - Run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<pfad>\watch-inbox.ps1"`
   - Erwartet: kein Output (keine Trigger da), `watcher.log` wird angelegt sobald erste Trigger kommt.

## Logs

`watcher.log` im Watcher-Ordner. Wird bei jedem Lauf angehängt.

## Stale-Lock

`.lock` im `_inbox/`-Ordner. Wird bei Lauf-Start gesetzt, bei Ende entfernt. Falls Lock älter 15 Min → automatisch ignoriert.

## Aktive Spec

Siehe [`ImmoCRM/docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md`](../ImmoCRM/docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md).
```

- [ ] **Step 6: `task-scheduler.xml` schreiben**

```xml
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Author>André Petrov</Author>
    <Description>Akquise-Pipeline: Watcher für OneDrive _inbox, scannt alle 60 Sek nach .trigger-Dateien und startet Claude-Code mit dem Quick-Check-Skill.</Description>
    <URI>\Akquise-Watcher</URI>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <Repetition>
        <Interval>PT1M</Interval>
        <Duration>P1D</Duration>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
      <StartBoundary>2026-05-14T06:00:00</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay>
        <DaysInterval>1</DaysInterval>
      </ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT1H</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>-NoProfile -ExecutionPolicy Bypass -File "C:\meine-projekte\Immobilien\akquise-watcher\watch-inbox.ps1"</Arguments>
    </Exec>
  </Actions>
</Task>
```

**Hinweise:**
- `InteractiveToken` (statt `Password`) = "Run only when user is logged on" (Spec §5.5).
- `WakeToRun=false` (PC-aus-Stau ist akzeptabel).
- `Repetition` = jede Minute, `Duration` = 1 Tag, `StopAtDurationEnd=false` = läuft endlos.

- [ ] **Step 7: Manueller Probelauf des Skripts (ohne Trigger-Datei)**

`.env` aus `.env.example` kopieren und Werte setzen.
Run:
```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "c:\meine-projekte\Immobilien\akquise-watcher\watch-inbox.ps1"
```
Erwartet: kein Output (keine Trigger im `_inbox`-Ordner). Datei `watcher.log` wird (noch) nicht erstellt, weil Skript früh exitet — das ist OK.

Validiere mindestens die Erreichbarkeit:
```powershell
Test-Path $env:AKQUISE_INBOX_PATH
```
(nach manuellem Setzen der ENV-Var in der aktuellen Session). Erwartet: True.

- [ ] **Step 8: Commit (auf User-Auftrag)**

```bash
git add Immobilien/akquise-watcher
git commit -m "feat(akquise): lokaler watcher (PowerShell + Task Scheduler XML)"
```

**Verifikation B4:** Watcher-Ordner ist im Repo, Skript läuft ohne Crash (auch ohne Trigger), `.env` lokal vorhanden. Task Scheduler-Eintrag noch nicht aktiv — kommt in B6.

---

## Task B5: Modul-0-Skill um Akquise-Modus erweitern

**Files:**
- Modify: `c:\meine-projekte\Immobilien\Aufteiler\skills\aufteiler-modul-0-quickcheck\SKILL.md`
- Modify (oder Create): `c:\meine-projekte\Immobilien\Aufteiler\docs\aufteiler-modul-0-quickcheck.md`
- Modify: `c:\meine-projekte\Immobilien\Aufteiler\CLAUDE.md`

**Konzept:** Der Skill bekommt einen neuen Block am Anfang, der den Modus erkennt:
- **Aufteiler-Modus (alt):** Aufruf via Orchestrator, Input ist `objekt_slug` → bestehende Logik unverändert.
- **Akquise-Modus (neu):** Aufruf via Watcher mit Ordnerpfad-Argument, der Ordner enthält `.trigger` + `_meta.json` + PDFs → neuer Workflow.

Modul-0-Logik (Gap-Formel, Schwellen, Status) ist **identisch** in beiden Modi — sie steht weiterhin nur einmal in Abschnitt 3.

- [ ] **Step 1: SKILL.md Frontmatter-Beschreibung erweitern**

Aktuell:
```yaml
---
name: aufteiler-modul-0-quickcheck
description: Modul 0 der Aufteiler-Analyse — Quick-Check. Vergleicht Angebotspreis gegen ETW-Konsens (Marktwert pro WE × Anzahl WE), prüft Gap-Schwelle 5%. Wird ausschließlich vom aufteiler-Orchestrator aufgerufen, NICHT direkt durch User.
---
```

Neu:
```yaml
---
name: aufteiler-modul-0-quickcheck
description: Modul 0 der Aufteiler-Analyse — Quick-Check. Vergleicht Angebotspreis gegen ETW-Konsens (Marktwert pro WE × Anzahl WE), prüft Gap-Schwelle 5%. Zwei Modi - (1) Aufteiler-Modus (Standard, vom Orchestrator aufgerufen mit objekt_slug, interaktiv via AskUserQuestion); (2) Akquise-Modus (vom Watcher aufgerufen mit Ordnerpfad-Argument, vollautomatisch ohne User-Interaktion, schreibt Lead direkt ins ImmoCRM).
---
```

- [ ] **Step 2: SKILL.md — neuer Abschnitt 0 "Modus-Erkennung" vor Abschnitt 1**

Direkt nach dem H1-Titel (`# Modul 0 — Quick-Check`) und vor `## 1. State laden`:

```markdown
## 0. Modus-Erkennung (Pflicht — allererste Aktion)

Modul 0 hat zwei Modi. Erkennungs-Regel:

| Input | Modus | Workflow |
|---|---|---|
| Argument ist ein Ordnerpfad UND der Ordner enthält `.trigger` | **Akquise-Modus** | Vollautomatisch, siehe Abschnitt 8 |
| Argument ist ein `objekt_slug` (kein Pfad-Trenner darin) | **Aufteiler-Modus** | Interaktiv via Orchestrator, siehe Abschnitte 1–7 |

**Akquise-Modus springt nach Modus-Erkennung direkt zu Abschnitt 8. Aufteiler-Modus folgt der bisherigen Reihenfolge (Abschnitte 1–7).**

Die Berechnungs-Logik (Abschnitt 3) ist in beiden Modi identisch und wird nur einmal beschrieben.
```

- [ ] **Step 3: SKILL.md — neuer Abschnitt 8 "Akquise-Modus" am Ende**

Nach Abschnitt 7 ("Übergabe") anhängen:

```markdown
## 8. Akquise-Modus (vollautomatischer Lauf via Watcher)

### 8.1 Inputs

- **Argument:** absoluter Pfad zum Inbox-Ordner (z.B. `C:\Users\andre\OneDrive\Immobilien\001_AQUISE\_inbox\025e01dce38d_aeb76260_0c262720__web.de\`).
- **Im Ordner vorhanden:**
  - `.trigger` (JSON: messageId, enqueuedAt, schemaVersion)
  - `_meta.json` (JSON: messageId, subject, from, to, date, text, links, files, schemaVersion)
  - PDFs (Exposé, ggf. Mieterliste etc.)
- **ENV (vom Watcher übergeben):**
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `AKQUISE_OBJEKTE_PATH` (Ziel-Pfad für Ordner-Rename)

Falls einer dieser ENVs fehlt → STOPP, an Watcher: "Akquise-Modus: ENV-Variable <name> fehlt."

### 8.2 Workflow

**8.2.1) Eingaben laden**
1. `Read` auf `.trigger` (JSON parsen).
2. `Read` auf `_meta.json` (JSON parsen). Felder verwendbar: `messageId`, `subject`, `from.email`, `from.name`, `text`, `links`, `files`.
3. PDF-Liste aus `_meta.json.files`. Bevorzugung: zuerst Exposé-PDF (Filename-Heuristik: enthält `expose`, `exposé`, `exposee`, `objektdaten`, `verkauf`); andere PDFs nur lesen falls Exposé keine Adresse/Preis ergibt.

**8.2.2) PDFs lesen**
- `Read` auf Exposé-PDF (Claude Code kann PDFs direkt lesen).
- Falls Exposé < 80 % der nötigen Felder liefert (Preis ODER Adresse ODER WE-Anzahl fehlt): zusätzlich nächstgrößere PDF lesen.
- Token-Budget-Limit: max 3 PDFs lesen pro Lauf. Rest nur via Filename loggen.

**8.2.3) Adresse extrahieren**
- Aus Exposé-Text (LLM-Schluss): vollständige Adresse `Straße Hausnummer, PLZ Stadt` (z.B. `Welperstraße 39, 41 und 43, 45525 Hattingen`).
- Falls Exposé keine Adresse: aus Mail-Subject (`_meta.json.subject`) + Mail-Body (`_meta.json.text`) ableiten.
- Falls weiterhin keine Adresse: setze `address = "_unbekannt_<msgIdShort>"` (Subject wird Fallback-Identifier).
- Slug erzeugen: kebab-case, `ä→ae`, `ö→oe`, `ü→ue`, `ß→ss`, andere Sonderzeichen raus. Beispiel: `welperstr-39-41-43-hattingen`.

**8.2.4) Quick-Check-Berechnung**

**Inputs aus PDF:**
- `angebotspreis_eur` (aus Exposé)
- `anzahl_we` (aus Exposé)
- Stadtteil/Stadt für ETW-Konsens-Schätzung (Tiefenstufe 1 reicht — siehe Spec §5.6)

**ETW-Konsens-Schätzung (Tiefenstufe 1):**
- Falls Stadtteil-Kontext aus PDF/Mail erkennbar: grobe LLM-Schätzung `etw_konsens_pro_we_eur` basierend auf Stadtteil und Objekt-Beschreibung. Konfidenz `niedrig` oder `mittel`.
- Falls nicht erkennbar: Default-Schätzung für mittlere Lage im Stadt-Cluster (z.B. NRW-Ruhrgebiet 180.000 €/WE).

**Berechnung (identisch zu Abschnitt 3):**
```
etw_konsens_eur = etw_konsens_pro_we_eur × anzahl_we
gap_eur = angebotspreis_eur − etw_konsens_eur
gap_prozent = (gap_eur / etw_konsens_eur) × 100
ueber_schwelle = (gap_prozent > 5)
```

**Status-Ableitung (identisch zu Abschnitt 3):**
- `gap_prozent ≤ 0` → `gruen`
- `0 < gap_prozent ≤ 5` → `gelb`
- `gap_prozent > 5` → `rot`

**Score-Mapping für ImmoCRM (priority_score 0–100):**
- `gruen`, `gap_prozent ≤ -10`: 90
- `gruen`, `gap_prozent ≤ 0`: 75
- `gelb`: 55
- `rot`, `gap_prozent ≤ 15`: 30
- `rot`, `gap_prozent > 15`: 10

**Begründung (priority_reason):** 1 Satz, z.B. `"Gap 4,2 % unter ETW-Konsens, grün, Stadtteil Hattingen"`.

**8.2.5) Kontakt aus Mail-Header ableiten**
- `email` = `_meta.json.from.email`
- `name` = `_meta.json.from.name` (oder Display-Part vor `<email>`)
- `firma`/`position` per Heuristik aus Mail-Signatur (`_meta.json.text` letzte 10 Zeilen): RegEx auf Muster wie `Geschäftsführer`, `Vermittler`, `Immobilien GmbH` etc. Falls nicht ableitbar: leer lassen, User korrigiert manuell.

**8.2.6) ImmoCRM-Schreibweg (Supabase REST)**

ENV: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

Reihenfolge (alle via `Bash` mit `curl`):

```bash
# (a) Contact upsert (Email-Unique-Constraint, Prefer-Header für Merge)
curl -X POST "$SUPABASE_URL/rest/v1/contacts" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates,return=representation" \
  -d '{"email":"<email>","name":"<name>","firma":"<firma>","position":"<position>","status":"kalt","lead_herkunft":"mail-pipeline"}'
# → liefert contact_id zurück
```

```bash
# (b) Deal insert
curl -X POST "$SUPABASE_URL/rest/v1/deals" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "contact_id":"<contact_id>",
    "adresse":"<address>",
    "status":"pre_screened",
    "lead_herkunft":"mail-pipeline",
    "priority_score":<score>,
    "priority_reason":"<reason>",
    "expose_source":"mail-pipeline",
    "inbox_message_id":"<messageId>",
    "expose_local_path":"<finaler-Ordnerpfad>",
    "expose_url":"<onedrive-webUrl-falls-vorhanden>"
  }'
# → liefert deal_id zurück
```

```bash
# (c) Activity-Log
curl -X POST "$SUPABASE_URL/rest/v1/activity_log" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"new_lead","deal_id":"<deal_id>","contact_id":"<contact_id>"}'
```

```bash
# (d) mail_queue auf done setzen
curl -X PATCH "$SUPABASE_URL/rest/v1/mail_queue?message_id=eq.<messageId-URL-encoded>" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"done","deal_id":"<deal_id>","done_at":"<jetzt-ISO>"}'
```

**Idempotenz-Schutz (Spec A7):**
- Vor `deals`-Insert: `GET /rest/v1/deals?inbox_message_id=eq.<messageId>&select=id` ausführen. Falls bereits Deal vorhanden → kein Re-Insert, `mail_queue` direkt auf `done` setzen und mit Dateisystem-Schritten fortfahren (aber kein Re-Rename, falls Ordner schon umbenannt ist).

**Fehlerbehandlung:**
- HTTP-Status ≠ 2xx → Fehler in `quickcheck-log.md` schreiben, `mail_queue` auf `error` setzen mit `error_msg`, `.trigger` BLEIBT liegen (kein Auto-Retry).
- User-Eingriff: nach Behebung Skill manuell auf den Ordner laufen lassen.

**8.2.7) Dateisystem-Operationen**

Ablauf:
1. **Ziel-Pfad berechnen:** `$AKQUISE_OBJEKTE_PATH\<slug>\`.
2. **Duplikat-Check:** Falls `<slug>\` existiert: `<slug>_2`, `<slug>_3` etc. (Aufteiler-Konvention).
3. **Ordner umbenennen:** `Move-Item` von `_inbox/<msg-id>/` nach `Objekte/<finaler-slug>/`. Bei OneDrive-Lock (`IOError`): 3× Retry mit 1 Sek Pause.
4. **`<slug>.code-workspace` schreiben** im neuen Objekt-Ordner:
   ```json
   {
     "folders": [{ "path": "." }],
     "settings": { "terminal.integrated.defaultProfile.windows": "PowerShell" },
     "tasks": {
       "version": "2.0.0",
       "tasks": [{
         "label": "Start Claude Code",
         "type": "shell",
         "command": "claude",
         "presentation": { "reveal": "always", "panel": "shared" },
         "runOptions": { "runOn": "folderOpen" },
         "problemMatcher": []
       }]
     }
   }
   ```
5. **`quickcheck-log.md`** im Objekt-Ordner schreiben (Audit-Spur):
   - Roh-Eingaben (Subject, From, Adresse, Angebotspreis, ETW-Konsens, WE-Anzahl)
   - Berechnete Werte (gap_eur, gap_prozent, status, score, reason)
   - Verwendete PDFs
   - LLM-Antworten (insbesondere Adress-Extraktion und ETW-Konsens-Schätzung — für späteren Audit)
6. **`state.json`** im Objekt-Ordner schreiben (gemäß `Aufteiler/docs/state-schema.md`):
   ```json
   {
     "schema_version": "1.0",
     "objekt": {
       "slug": "<slug>",
       "adresse": "<address>",
       "stadt": "<stadt>",
       "bundesland": "NRW",
       "erstellt_am": "<jetzt-ISO-Datum>",
       "letzter_modul_lauf": "modul_0"
     },
     "modul_0": {
       "status": "<gruen|gelb|rot>",
       "tiefenstufe": 1,
       "konfidenz": "<hoch|mittel|niedrig>",
       "ausgefuehrt_am": "<jetzt-ISO>",
       "angebotspreis_eur": <number>,
       "etw_konsens_eur": <number>,
       "gap_prozent": <number>,
       "ueber_schwelle": <bool>
     }
   }
   ```
   `modul_2.rnd_frozen` wird **nicht** gesetzt (Modul-2 ist noch nicht gelaufen).
7. **`.trigger` löschen** (aus dem umbenannten Ordner). Signal: erledigt.

**8.2.8) Übergabe ans Watcher-Log**

Output via `print`:
```
AKQUISE OK | messageId=<msgId> | slug=<slug> | score=<n> | dealId=<id>
```

Bei Fehler:
```
AKQUISE ERR | messageId=<msgId> | error=<msg>
```

### 8.3 Self-Check (Akquise-Modus)

- [ ] `.trigger` gelesen
- [ ] `_meta.json` gelesen
- [ ] Mind. 1 PDF gelesen
- [ ] Adresse extrahiert (oder Fallback gesetzt)
- [ ] Gap-Berechnung rechnerisch konsistent
- [ ] Idempotenz-Check vor Deal-Insert
- [ ] Contact + Deal + Activity-Log + mail_queue alle gesetzt
- [ ] Ordner umbenannt zu `Objekte/<slug>/`
- [ ] `.code-workspace`, `quickcheck-log.md`, `state.json` im neuen Ordner
- [ ] `.trigger` aus dem (alten) Ordner entfernt
- [ ] Watcher-Output gesetzt
```

- [ ] **Step 4: SKILL.md Versions-Hinweis am Body-Ende**

Letzte Zeile (nach Abschnitt 8):
```markdown
---
**Skill-Version:** 1.1 (2026-05-14: Akquise-Modus ergänzt, siehe Abschnitt 0 und 8). Vorgängerversion 1.0 hatte nur Aufteiler-Modus.
```

- [ ] **Step 5: `docs/aufteiler-modul-0-quickcheck.md` aktualisieren**

Existiert ggf. schon. Sicherstellen, dass darin steht:
- Modul-0 hat seit 2026-05-14 zwei Modi.
- Akquise-Modus: vollautomatisch, Watcher-getriggert, schreibt direkt ins ImmoCRM.
- Aufteiler-Modus: unverändert.
- Pflege-Regel: Berechnungslogik (Gap-Formel, Schwellen) ist single source — Änderungen wirken sich auf beide Modi aus.

Falls Datei nicht existiert: anlegen mit obigem Inhalt.

- [ ] **Step 6: `Aufteiler/CLAUDE.md` ergänzen**

Im Abschnitt "Architektur-Prinzipien" oder "Konventionen" einen Bullet ergänzen:

```markdown
- **Modul-0 zwei-modal:** `aufteiler-modul-0-quickcheck` hat seit 2026-05-14 zwei Modi (Aufteiler interaktiv, Akquise vollautomatisch). Berechnungslogik (Gap-Formel, Schwellen) ist single source in Abschnitt 3 — gilt für beide Modi. Akquise-Modus-Trigger: Ordnerpfad-Argument mit `.trigger`-Datei darin.
```

- [ ] **Step 7: Trockenlauf des Skills auf einem Test-Ordner**

Voraussetzung: ein Test-Ordner mit `.trigger`, `_meta.json` (mit Dummy-Mail-Daten), 1 Exposé-PDF.

Run (Headless):
```powershell
$env:SUPABASE_URL="https://<projekt>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<key>"
$env:AKQUISE_OBJEKTE_PATH="C:\temp\test-objekte"
claude --print --skill aufteiler-modul-0-quickcheck --arg "C:\temp\test-inbox\dummy-msg"
```

Erwartet: Skill erkennt Akquise-Modus, liest Files, schreibt Test-Lead nach Supabase. Falls Test-Daten echt ins CRM gehen sollen: vorher `lead_herkunft='mail-pipeline-test'` in den curl-Payloads setzen für leichtes nachträgliches Cleanup.

- [ ] **Step 8: Commit (auf User-Auftrag)**

```bash
git add Immobilien/Aufteiler/skills/aufteiler-modul-0-quickcheck Immobilien/Aufteiler/docs/aufteiler-modul-0-quickcheck.md Immobilien/Aufteiler/CLAUDE.md
git commit -m "feat(aufteiler): modul-0 um akquise-modus erweitert (vollautomatisch über watcher)"
```

**Verifikation B5:** Skill hat Akquise-Modus, Trockenlauf legt Test-Lead an, beide Modi laufen ohne Quereffekte (Aufteiler-Modus mit `objekt_slug` weiterhin OK — kurz im Orchestrator gegentesten).

---

## Task B6: Task Scheduler einrichten

**Files:** keine Repo-Files, nur Windows-System.

- [ ] **Step 1: Task Scheduler XML importieren**

Run (Admin-PowerShell):
```powershell
schtasks /Create /XML "c:\meine-projekte\Immobilien\akquise-watcher\task-scheduler.xml" /TN "Akquise-Watcher"
```
Erwartet: `SUCCESS: The scheduled task "Akquise-Watcher" has successfully been created.`

- [ ] **Step 2: Manueller Start auslösen**

Run:
```powershell
schtasks /Run /TN "Akquise-Watcher"
```
Erwartet: `SUCCESS: Attempted to run the scheduled task "Akquise-Watcher".`
Innerhalb von ~10 Sek im Task-Scheduler-GUI prüfen: "Last Run Result" = `0x0` (erfolgreich).

Falls Fehler: `watcher.log` lesen (in `akquise-watcher`-Ordner). Häufige Probleme:
- `.env` fehlt → angelegt?
- ExecutionPolicy → XML hat `Bypass`, sollte greifen.
- `AKQUISE_INBOX_PATH` falsch → in `.env` korrigieren.

- [ ] **Step 3: Trigger-Intervall verifizieren**

Im Task-Scheduler-GUI (`taskschd.msc`):
- "Akquise-Watcher" → "Triggers"-Tab → ein Eintrag "Daily, repeats every 1 minute for a duration of 1 day".
- "History"-Tab → Einträge sollten ~minütlich kommen.

**Verifikation B6:** Task läuft im Hintergrund, `watcher.log` wächst (falls Trigger gefunden) oder bleibt leer (falls kein Trigger).

---

## Task B7: E2E-Test mit Test-Mail

**Files:** keine Repo-Files, nur Manual-Test.

- [ ] **Step 1: Test-Mail vorbereiten**

Eigene Mail an `andre-petrov@web.de` mit:
- Subject: `Testobjekt Welperstraße 39, 41 und 43, 45525 Hattingen`
- 1 PDF-Anhang (ein echtes oder Dummy-Exposé mit Adresse + Preis + WE-Anzahl im Text).

- [ ] **Step 2: Mail nach M365 forwarden**

Outlook-Quickstep "CRM-Eingang" auf die Mail anwenden (oder manuell nach `appv@appv7878.onmicrosoft.com` weiterleiten, M365-Ordner `CRM-Eingang`).

- [ ] **Step 3: Cloud-Pipeline beobachten**

In Vercel-Dashboard → Functions → `api/akquise/webhook` → Live-Logs:
- Erwartet (innerhalb ~30 Sek nach Forward): Webhook-Hit, `mail_queue insert OK <msg-id>`, `process-trigger response 200`.

In Supabase SQL-Editor:
```sql
SELECT message_id, status, started_at, done_at, error_msg
FROM mail_queue
ORDER BY enqueued_at DESC LIMIT 5;
```
Erwartet: Neuer Eintrag mit `status='ready_for_quickcheck'`.

In OneDrive-Web:
- `Immobilien/001_AQUISE/_inbox/<sanitized-msg-id>/` existiert mit PDF + `_meta.json` + `.trigger`.

- [ ] **Step 4: Sync auf PC abwarten + Watcher beobachten**

Im Explorer:
- `C:\Users\andre\OneDrive\Immobilien\001_AQUISE\_inbox\<sanitized-msg-id>\` taucht auf (≤ 1 Min Latenz).

Spätestens beim nächsten Watcher-Lauf (60-Sek-Takt):
- `watcher.log` in `akquise-watcher`-Ordner: Eintrag "Starte Quick-Check für: ..."
- Im Task-Scheduler-History: erfolgreicher Lauf.

- [ ] **Step 5: Lead im ImmoCRM verifizieren**

ImmoCRM-URL öffnen, Lead-Liste:
- Neuer Eintrag mit Adresse `Welperstraße 39, 41 und 43, 45525 Hattingen` (oder ähnlich), `priority_score` gesetzt, sortiert nach Score.

In Supabase SQL-Editor:
```sql
SELECT id, adresse, status, priority_score, priority_reason, inbox_message_id, expose_local_path
FROM deals
WHERE expose_source = 'mail-pipeline'
ORDER BY created_at DESC LIMIT 5;
```
Erwartet: Test-Eintrag mit korrekten Feldern.

- [ ] **Step 6: Ordner-Rename verifizieren**

Im Explorer:
- `_inbox/<msg-id>/` ist weg.
- `Objekte/welperstr-39-41-43-hattingen/` (oder ähnlicher Slug) existiert.
- Im neuen Ordner: PDF, `_meta.json`, `<slug>.code-workspace`, `quickcheck-log.md`, `state.json`.
- `.trigger` NICHT mehr im Ordner.

- [ ] **Step 7: Wiedereinstiegs-Test (`.code-workspace`)**

Doppelklick auf `<slug>.code-workspace` im Explorer:
- VS Code öffnet den Workspace.
- Beim ersten Mal: Dialog "Allow automatic tasks in folder?" → "Manage Folder → Allow".
- Terminal-Panel öffnet sich automatisch mit `claude`-Prompt.

- [ ] **Step 8: Idempotenz-Test**

Dieselbe Mail nochmal forwarden (oder Graph-Subscription-Re-Notification simulieren). Erwartet:
- Kein zweiter Deal-Eintrag im ImmoCRM.
- `mail_queue` zeigt Eintrag mit `status='done'`, kein Duplikat.

**Verifikation B7:** Alle 12 Akzeptanzkriterien aus Spec §13 sind erfüllt. Falls einzelne fehlschlagen: einzeln triagieren (Spec §14 nennt für jedes Risiko die Mitigation).

---

## Task B8: Doku-Updates

**Files:**
- Modify: `c:\meine-projekte\Immobilien\ImmoCRM\docs\03_decisions.md`
- Modify: `c:\meine-projekte\Immobilien\ImmoCRM\docs\04_progress.md`
- Modify: `c:\meine-projekte\Immobilien\ImmoCRM\docs\02_implementierungsplan.md` (Plan-Link)
- Modify: `c:\meine-projekte\Immobilien\ImmoCRM\docs\superpowers\specs\2026-05-11-akquise-pipeline-cloud-design.md`
- Modify: `c:\meine-projekte\README.md` (Mono-Repo-Eintrag)

- [ ] **Step 1: ADR in `03_decisions.md` ergänzen**

Neue ADR-Sektion am Ende anhängen:

```markdown
## ADR-XXX — Akquise-Pipeline Quick-Check lokal statt Cloud

**Datum:** 2026-05-14
**Status:** Aktiv
**Kontext:** Cloud-PDF-Parsing in Vercel-Node bricht (pdf-parse / DOMMatrix). Alternativen waren teurer Server-Betrieb (~55-110 €/Monat) oder externer PDF-Service (DSGVO-Aufwand).
**Entscheidung:** Cloud bleibt Briefträger (Mail-Empfang + OneDrive-Upload). Quick-Check + Adress-Extraktion + Lead-Insert wandern auf den PC, getriggert über lokalen Task-Scheduler-Watcher und Claude-Code-Headless-Aufruf des `aufteiler-modul-0-quickcheck`-Skills im neuen Akquise-Modus.
**Konsequenzen:**
- 0 €/Monat statt 55-110 €/Monat.
- Aufteiler-Modul-0-Logik bleibt single source (kein Logik-Duplikat).
- PC-aus-Latenz akzeptabel (Stau-Abarbeitung beim Hochfahren).
**Referenzen:**
- Spec: `docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md`
- Plan: `docs/superpowers/plans/2026-05-14-akquise-pipeline-redesign.md`
- Ersetzt alte Cloud-Vollautomatisierung aus Spec `2026-05-11-akquise-pipeline-cloud-design.md` (mit Banner markiert).
```

(ADR-Nummer beim Schreiben aus existierender Sequenz in `03_decisions.md` ableiten.)

- [ ] **Step 2: `04_progress.md` aktualisieren**

Schritt 7 Status auf "Abgeschlossen 2026-05-14" oder "Im Live-Betrieb" setzen (je nach Stand am Ende von B7). Verweise auf Spec + Plan.

- [ ] **Step 3: `02_implementierungsplan.md` aktualisieren**

In Schritt 7 (`docs/02_implementierungsplan.md` Zeile 198ff) den Hinweis ergänzen:
- Implementierungsplan: `docs/superpowers/plans/2026-05-14-akquise-pipeline-redesign.md`.

- [ ] **Step 4: Banner auf alter Spec setzen**

In `docs/superpowers/specs/2026-05-11-akquise-pipeline-cloud-design.md` ganz oben:

```markdown
> **HISTORISCHE REFERENZ — ERSETZT.**
> Diese Spec wurde am 2026-05-14 funktional ersetzt durch
> [`2026-05-14-akquise-pipeline-redesign.md`](2026-05-14-akquise-pipeline-redesign.md).
> Grund: PDF-Parsing in Vercel-Node-Runtime nicht stabil, Quick-Check + Adress-
> Extraktion wurden lokal verlagert. Webhook und Mail-Scraping-Logik aus dieser
> alten Spec bleiben jedoch im Einsatz.
```

- [ ] **Step 5: Mono-Repo-README**

`c:\meine-projekte\README.md` öffnen. Inhaltsverzeichnis um Eintrag erweitern:
- `Immobilien/akquise-watcher/` — Lokaler Watcher (PowerShell + Task Scheduler) für die Akquise-Pipeline, siehe Spec in `ImmoCRM/docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md`.

- [ ] **Step 6: Commit (auf User-Auftrag)**

```bash
git add ImmoCRM/docs README.md
git commit -m "docs(akquise): adr + progress + mono-repo-readme nach pipeline-redesign aktualisiert"
```

**Verifikation B8:** Alle 5 Doku-Dateien aktualisiert, ADR neu, Banner auf alter Spec.

---

## Task B9: Entscheidung über 13 wartende M365-Mails

**Files:** keine Repo-Files, nur Entscheidung + ggf. M365-Aktion.

**Kontext:** Spec §2 sagt: "Reaktivierung der 13 wartenden Mails im M365-Ordner CRM-Eingang (Entscheidung später, nach erstem erfolgreichen Test-Lauf)."

- [ ] **Step 1: Status quo prüfen**

In M365 Outlook-Web: Ordner `CRM-Eingang` — sind die 13 Mails noch da? Wie alt? Wie viele davon noch zeitlich relevant?

- [ ] **Step 2: Entscheidung mit User abstimmen**

Vor dem Auslösen: kurze Rückfrage mit AskUserQuestion-Tool zu drei Optionen:
1. Mails ignorieren (Verfallen lassen, manuell falls relevant).
2. Mails neu forwarden (eine nach der anderen → neue Notification → frische Pipeline-Läufe).
3. Mails als `\Unread` markieren (löst KEINE neue Notification aus — Graph erkennt nur `created`, nicht `updated`).

Wenn Option 2 gewählt: max 5 pro Stunde forwarden (Token-Budget-Schutz, Spec A12).

- [ ] **Step 3: Ergebnis dokumentieren**

In `04_progress.md` einen Eintrag setzen: "13 wartende M365-Mails: <Entscheidung + Datum>".

**Verifikation B9:** Klarer Eintrag in Doku, kein offener Backlog.

---

## Self-Review (vor ExitPlanMode)

**Spec-Coverage-Check (Abgleich Spec §16 Implementierungsplan-Skizze):**

| Spec-Punkt | Plan-Task | Coverage |
|---|---|---|
| B1 DB-Migration 005 | Task B1 (als 016 korrigiert) | ✓ |
| B2 Cloud-Code abspecken | Task B2 | ✓ |
| B3 uploadOneDrive Pfad + Re-Deploy | Task B3 | ✓ |
| B4 Akquise-Watcher | Task B4 | ✓ |
| B5 Akquise-Skill bauen | Task B5 (Modul-0-Erweiterung statt neuer Skill, abgestimmt) | ✓ |
| B6 Task Scheduler | Task B6 | ✓ |
| B7 E2E-Test | Task B7 | ✓ |
| B8 Doku-Updates | Task B8 | ✓ |
| B9 Entscheidung 13 Mails | Task B9 | ✓ |
| §17 The One Thing: Migration zuerst + DELETE | B1 Step 4 | ✓ |
| §14 R10 Graph-Subscription-Renewal | V0a Vor-Verifikation | ✓ |
| §13 A1-A12 Akzeptanzkriterien | B7 Steps 1-8 | ✓ |

**Placeholder-Scan:** Plan enthält keine "TBD", "TODO" oder "Add appropriate error handling" — alle Code-Blöcke vollständig.

**Type-Consistency-Check:**
- `UploadInput.folderName` in `uploadOneDrive.ts` (B3) ↔ `folderName: inboxFolder` in `process.ts` (B2 Step 3) — konsistent.
- `mail_queue.status='ready_for_quickcheck'` in `process.ts` (B2) ↔ Constraint in Migration (B1) — konsistent.
- `aufteiler-modul-0-quickcheck` Skill-Name in Watcher-PS1 (B4 Step 2) ↔ Skill-Frontmatter (B5 Step 1) — konsistent.
- ENV-Vars `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AKQUISE_OBJEKTE_PATH`, `AKQUISE_INBOX_PATH` durchgängig.

**Bauphilosophie-Check:** Jeder Task ist atomar (max 2-3 h), testbar (klarer Verifikations-Punkt), kein Lock-in (B1 ist additive Migration, B2/B3 lassen Webhook unverändert).

---

## Verification End-to-End

Wenn alle Tasks abgeschlossen sind, eine zweite Test-Mail durchschicken (anders als B7-Test, andere Adresse) und prüfen:
1. Innerhalb ≤ 5 Min taucht der Lead im ImmoCRM mit Score auf.
2. `watcher.log` zeigt sauberen Lauf.
3. `quickcheck-log.md` im Objekt-Ordner ist plausibel.
4. `.code-workspace`-Doppelklick öffnet VS Code + Claude Code.

Bei Erfolg: Task B9 (Entscheidung zu 13 wartenden Mails) auslösen.

---

## Risiken-Hinweis für Executor

Spec §14 listet R1-R10. Beim Bau besonders beachten:
- **R10** (Graph-Subscription-Expiry am 2026-05-16): vor B1 prüfen (V0a). Falls knapp, vorher renewen.
- **R5** (OneDrive-Datei-Locks): Move-Operation in B5 Step 3 (Workflow 8.2.7) mit Retry-Loop.
- **R3** (Claude-CLI-Syntax-Drift): Falls `--print --skill --arg` in der lokalen Claude-Code-Version nicht funktioniert, Watcher-Skript anpassen — alternative Aufrufform z.B. `claude --print "Verwende den Skill aufteiler-modul-0-quickcheck mit Argument <pfad>"`.

---

## Execution Choices

**Plan complete and saved.** Two execution options:

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration.
**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Entscheidung wird in der nächsten frischen Session getroffen (gemäß User-Briefing: "kein Code in dieser Session").
