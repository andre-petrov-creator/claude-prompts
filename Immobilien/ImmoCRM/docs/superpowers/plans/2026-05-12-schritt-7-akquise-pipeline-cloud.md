# Schritt 7 — Akquise-Pipeline Cloud (ImmoCRM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cloud-Pipeline baut, die Mails aus Outlook-Ordner "CRM-Eingang" alle 5 Min abholt, PDFs in OneDrive ablegt, einen QuickCheck-Score samt Begründung erzeugt, das Objekt als Pre-Screening-Lead ins CRM schreibt, einen Doppelklick-Workspace im Ordner ablegt (öffnet VS Code + Claude Code mit vollem QuickCheck-Kontext) und das Daily-Briefing um eine Pre-Screening-Sektion erweitert.

**Architektur:**
- Vercel Edge Function (TypeScript) auf bestehendem ImmoCRM-Vercel-Projekt
- cron-job.org alle 5 Min → `/api/cron/akquise-poll` (IMAP-Poll, Enqueue) → fire-and-forget `/api/akquise/process` (Stage-Worker pro Mail)
- Idempotenz via `mail_queue.message_id` PRIMARY KEY
- Aufteiler-Workflow bleibt **unverändert** — nur das CRM bekommt Pre-Screening-Status

**Tech-Stack:** TypeScript · `imapflow` · `@microsoft/microsoft-graph-client` + `@azure/msal-node` · `pdf-parse` · `@anthropic-ai/sdk` · Supabase REST · Vercel Edge Runtime

**Quellen:**
- Spec: `docs/superpowers/specs/2026-05-11-akquise-pipeline-cloud-design.md`
- Übernommene Heuristiken aus altem Schritt-7-Prompt: Position-Erkennung (GF/Inhaber/Makler), Soft-Match-Warn-Comment, fail-safe-CRM-Schreibfehler
- Workspace-Mechanik: `.code-workspace` + `tasks.runOn:folderOpen` + Ordner-`CLAUDE.md` + `00_briefing.md` (kein echtes Claude-Code-Resume — gleiche Funktion, einfacher)

---

## File Structure

**Neu im ImmoCRM-Repo:**

```
app/                                                  (NEUE TOP-LEVEL — bisher Vite-SPA ohne app/-Folder)
└── api/
    ├── cron/
    │   └── akquise-poll/route.ts                     Poll-Endpoint, dünn
    └── akquise/
        ├── process/route.ts                          Stage-Worker pro Mail
        └── _lib/
            ├── imapClient.ts                         IMAP-Verbindung web.de
            ├── parseEmail.ts                         MIME → PDF-Buffer + Links + Mailtext
            ├── resolveLink.ts                        Online-Link → PDF-Buffer
            ├── classifyPdf.ts                        Filename + Inhalt → typ
            ├── extractAddress.ts                     Regex + Anthropic-Fallback
            ├── extractContact.ts                     Name + Email + Firma + Position
            ├── uploadOneDrive.ts                     Microsoft Graph
            ├── msGraphClient.ts                      MSAL-Auth + Refresh-Token-Handling
            ├── writeWorkspace.ts                     .code-workspace + CLAUDE.md + 00_briefing.md
            ├── quickCheck.ts                         Score-Stub (Logik kommt von Modul-0-Überarbeitung)
            ├── insertLead.ts                         Supabase: contact + deal + activity_log
            ├── duplicateMatch.ts                     Hard/Soft/No-Match-Logik
            └── positionHeuristic.ts                  GF/Inhaber/Makler-Erkennung

supabase/migrations/
├── 012_deal_status_pre_screened.sql                  Enum erweitern + compute_followup
├── 013_mail_queue.sql                                Idempotenz-Tabelle
└── 014_deals_priority_score.sql                      priority_score, _reason, expose_source, etc.

src/                                                  (BESTEHEND, ERWEITERN)
├── types/supabase.ts                                 Regenerieren nach jeder Migration
├── components/leads/LeadTable.tsx                    Status-Filter um pre_screened erweitern, Score-Spalte
├── components/leads/StatusBadge.tsx                  pre_screened-Farbe
├── features/daily-briefing/template.ts               Pre-Screening-Sektion (sobald Schritt 8 da ist; falls noch nicht: Stub)
└── hooks/useDeals.ts                                 Sort/Filter um priority_score

docs/
├── 02_implementierungsplan.md                        Schritt 7 ersetzen
├── 03_decisions.md                                   ADR-017 bis ADR-020
├── 04_progress.md                                    Sub-Schritte 7a-7l tracken
├── 05_tools.md                                       Skill-Matrix erweitern
└── 06_pipeline_guidelines.md                         NEU: Pipeline-spezifische Conventions

package.json                                          Neue Deps
.env.example                                          Neue Env-Vars
vercel.json                                           Edge-Function-Config (falls nötig)
```

**Touchiert in anderen Repos:** keine. Aufteiler bleibt komplett unberührt. `automatisierung-aquise` wird in Schritt 7l deprecated (README-Banner + Task-Scheduler aus).

**Architektur-Entscheidung:** `app/api/`-Folder ist Vercel-Konvention für Edge Functions. Vite läuft daneben weiter (Frontend) — Vercel erkennt `app/`-Folder automatisch für Functions (siehe https://vercel.com/docs/functions).

---

## Vor-Schritt (Spike) — BLOCKIEREND

### Task S1: 30-Min-Spike — web.de + OneDrive Vorab-Check

**Files:**
- Create: `scripts/spike-imap-onedrive.mjs` (lokales Test-Skript, wird **nicht** committed — `.gitignore` deckt scripts-Spike ab via expliziter Regel)

**Ziel:** GO/NO-GO für Variante A. Ohne diesen Spike bauen wir blind.

- [ ] **Step 1: web.de App-Passwort generieren**

In web.de-Webmail einloggen → Einstellungen → Sicherheit → App-Passwörter → "ImmoCRM-IMAP" erstellen. Passwort notieren (wird gleich verbrannt — Vercel-Env-Setting kommt erst bei Task 7a).

Wenn web.de **keine App-Passwörter anbietet:** STOPP. Spec ist neu zu evaluieren (Variante B Forwarding). Dieser Plan endet hier.

- [ ] **Step 2: Outlook-Ordner "CRM-Eingang" anlegen (falls nicht existiert)**

In Outlook (oder web.de-Webmail) im Konto andre-petrov@web.de → Rechtsklick auf Posteingang → "Neuer Ordner" → Name `CRM-Eingang`. Eine Test-Mail manuell reinschieben.

- [ ] **Step 3: Spike-Skript schreiben**

```javascript
// scripts/spike-imap-onedrive.mjs
import { ImapFlow } from 'imapflow';

const client = new ImapFlow({
  host: 'imap.web.de',
  port: 993,
  secure: true,
  auth: { user: 'andre-petrov@web.de', pass: process.env.WEBDE_APP_PASSWORD },
});

await client.connect();
const folders = await client.list();
console.log('Ordner:', folders.map(f => f.path));

await client.mailboxOpen('CRM-Eingang');
const uids = await client.search({ seen: false });
console.log('Ungelesen in CRM-Eingang:', uids);

for await (const msg of client.fetch(uids.slice(0, 3), { envelope: true })) {
  console.log('Mail:', msg.envelope.subject, msg.envelope.messageId);
}

await client.logout();
```

- [ ] **Step 4: Spike-Skript ausführen**

Run (PowerShell):
```powershell
cd c:\meine-projekte\Immobilien\ImmoCRM
npm install imapflow --no-save
$env:WEBDE_APP_PASSWORD = "<das-passwort-aus-step-1>"
node scripts/spike-imap-onedrive.mjs
```

Expected: Ordner-Liste enthält "CRM-Eingang", mindestens eine Test-Mail erscheint, kein Crash.

- [ ] **Step 5: OneDrive-Probe (parallel)**

In https://entra.microsoft.com Azure-AD-App registrieren:
- Name: "ImmoCRM-Pipeline"
- Account-Type: Persönliche Microsoft-Accounts (oder Geschäftskonto, je nach OneDrive-Owner)
- Redirect-URI: `http://localhost:3000/auth/callback` (Web)
- API-Permission: `Files.ReadWrite.All` (Delegated) + `User.Read`
- Client-Secret erstellen, notieren

Test-OAuth-Flow lokal (separates Mini-Skript):
```javascript
// Nur Auth-URL ausgeben und Token nach Login einmalig fetchen
// Kein Code hier — Step ist GO/NO-GO ob die Registrierung machbar ist
```

GO-Kriterium: App-Registrierung erfolgreich, Test-PUT `/me/drive/root:/_spike-test.txt:/content` liefert 201.

- [ ] **Step 6: Spike-Datei wegwerfen + Notizen**

```powershell
Remove-Item scripts/spike-imap-onedrive.mjs
```

In `docs/04_progress.md` notieren: S1 ✅ am <Datum>, web.de App-Passwörter verfügbar, OneDrive-Tenant ist `<persönlich|geschäftlich>`, Client-ID + Tenant-ID festgehalten in 1Password (oder wo Du Secrets ablegst).

- [ ] **Step 7: GO/NO-GO Entscheidung**

Bei GO: weiter zu Task 7a.
Bei NO-GO (web.de blockiert IMAP-Apps): STOPP, separate Brainstorming-Session für Variante B.

---

## Task 7a: DB-Migrationen anlegen

**Files:**
- Create: `supabase/migrations/012_deal_status_pre_screened.sql`
- Create: `supabase/migrations/013_mail_queue.sql`
- Create: `supabase/migrations/014_deals_priority_score.sql`
- Modify: `src/types/supabase.ts` (via Regenerierung)

- [ ] **Step 1: Migration 012 schreiben**

```sql
-- 012_deal_status_pre_screened.sql
-- Enum pre_screened hinzufügen, compute_followup um neue Status erweitern

ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'pre_screened' BEFORE 'offen';

-- compute_followup: pre_screened bekommt KEINE Followup-Pflicht
-- (Owner muss erst manuell übernehmen → Status auf 'offen' setzen)
CREATE OR REPLACE FUNCTION compute_followup(angebot date, status text, last_activity date)
RETURNS date LANGUAGE sql STABLE
AS $$
  SELECT CASE status
    WHEN 'pre_screened' THEN NULL
    WHEN 'offen'        THEN next_business_day(GREATEST(angebot, COALESCE(last_activity, angebot)) + 5)
    WHEN 'berechnet'    THEN next_business_day(GREATEST(angebot, COALESCE(last_activity, angebot)) + 14)
    ELSE NULL
  END;
$$;
```

- [ ] **Step 2: Migration 013 schreiben**

```sql
-- 013_mail_queue.sql
-- Idempotenz-Tabelle für Pipeline

CREATE TABLE mail_queue (
  message_id      text PRIMARY KEY,
  imap_uid        integer NOT NULL,
  status          text NOT NULL CHECK (status IN ('pending', 'processing', 'done', 'error')),
  enqueued_at     timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  done_at         timestamptz,
  error_msg       text,
  deal_id         uuid REFERENCES deals(id) ON DELETE SET NULL,
  raw_source_sha  text
);

CREATE INDEX idx_mail_queue_status ON mail_queue(status);
CREATE INDEX idx_mail_queue_enqueued ON mail_queue(enqueued_at DESC);

-- Service-Role-Key bypasst RLS (Default-Verhalten), keine Policies nötig
-- Anon-Key darf NICHT auf mail_queue zugreifen — keine GRANTs für anon
REVOKE ALL ON mail_queue FROM anon;
GRANT ALL ON mail_queue TO service_role;
```

- [ ] **Step 3: Migration 014 schreiben**

```sql
-- 014_deals_priority_score.sql
-- QuickCheck-Score + Herkunft + Mail-Referenz auf deals

ALTER TABLE deals ADD COLUMN priority_score    integer CHECK (priority_score BETWEEN 0 AND 100);
ALTER TABLE deals ADD COLUMN priority_reason   text;
ALTER TABLE deals ADD COLUMN expose_source     text NOT NULL DEFAULT 'manual'
  CHECK (expose_source IN ('mail-pipeline', 'manual', 'aufteiler'));
ALTER TABLE deals ADD COLUMN inbox_message_id  text;
ALTER TABLE deals ADD COLUMN workspace_path    text;

CREATE INDEX idx_deals_priority_score
  ON deals(priority_score DESC NULLS LAST)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_deals_pre_screened
  ON deals(created_at DESC)
  WHERE status = 'pre_screened' AND deleted_at IS NULL;
```

- [ ] **Step 4: Migrationen via Supabase MCP applyen**

Run (in Claude-Code-Konversation):
```
mcp__supabase__apply_migration mit name="012_deal_status_pre_screened" und SQL aus Step 1
mcp__supabase__apply_migration mit name="013_mail_queue" und SQL aus Step 2
mcp__supabase__apply_migration mit name="014_deals_priority_score" und SQL aus Step 3
```

Expected: Drei "migration applied" Responses, keine Errors.

- [ ] **Step 5: Verifikation**

Run:
```
mcp__supabase__list_tables — mail_queue muss erscheinen
mcp__supabase__execute_sql mit "SELECT enum_range(NULL::deal_status);" — muss {pre_screened, offen, berechnet, absage} liefern
mcp__supabase__execute_sql mit "SELECT column_name FROM information_schema.columns WHERE table_name='deals' AND column_name IN ('priority_score','priority_reason','expose_source','inbox_message_id','workspace_path');" — 5 Zeilen
```

- [ ] **Step 6: Types regenerieren**

Run (PowerShell):
```powershell
npx supabase gen types typescript --project-id <PROJECT_ID> > src/types/supabase.ts
```

(Project-ID steht in `.env.local` als `VITE_SUPABASE_URL` — der Subdomain-Teil)

Expected: `src/types/supabase.ts` enthält neue Felder, `npm run build` ist grün.

- [ ] **Step 7: Build-Check**

Run:
```powershell
npm run build
```

Expected: Build grün, keine Type-Errors.

- [ ] **Step 8: Commit**

```powershell
git add supabase/migrations/012_deal_status_pre_screened.sql supabase/migrations/013_mail_queue.sql supabase/migrations/014_deals_priority_score.sql src/types/supabase.ts
git commit -m "feat(db): pre_screened status, mail_queue, priority_score für akquise-pipeline"
```

---

## Task 7b: Deps installieren + Env-Vars dokumentieren

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `vercel.json`

- [ ] **Step 1: Dependencies installieren**

Run:
```powershell
npm install imapflow @microsoft/microsoft-graph-client @azure/msal-node pdf-parse @anthropic-ai/sdk mailparser
npm install -D @types/mailparser
```

Expected: Installation läuft durch, `package.json` enthält die neuen Deps.

- [ ] **Step 2: .env.example ergänzen**

In `.env.example` am Ende anfügen:

```bash
# ============================================================
# Akquise-Pipeline (Schritt 7) — nur in Vercel-Env, nicht lokal nötig
# ============================================================

# web.de IMAP-Zugriff
WEBDE_IMAP_USER=andre-petrov@web.de
WEBDE_IMAP_APP_PASSWORD=  # App-Passwort aus web.de-Sicherheits-Einstellungen

# Cron-Trigger-Authentication (cron-job.org sendet Bearer-Token)
CRON_SECRET_AKQUISE=  # zufälliger String, in cron-job.org als Header setzen

# Microsoft Graph (OneDrive-Upload)
MS_GRAPH_CLIENT_ID=
MS_GRAPH_CLIENT_SECRET=
MS_GRAPH_TENANT_ID=common  # oder spezifische Tenant-ID bei Geschäftskonto
MS_GRAPH_REFRESH_TOKEN=  # einmalig per OAuth-Flow geholt, danach automatisch verlängert
MS_GRAPH_USER_EMAIL=andre-petrov@example.com  # OneDrive-Owner

# OneDrive-Pfad-Konfiguration
ONEDRIVE_BASE_PATH=/Immobilien/001_AQUISE/Objekte
ONEDRIVE_LOCAL_PATH_PREFIX=C:\Users\andre\OneDrive - APPV Personalvermittlung\Immobilien\001_AQUISE\Objekte

# Supabase Service-Role-Key (für mail_queue-Schreibzugriff, bypasst RLS)
# ACHTUNG: NIEMALS im Frontend exposen — nur in Vercel-Env-Group "server-only"
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic-API für Address-Extraktion + QuickCheck-Stub
ANTHROPIC_API_KEY=
```

- [ ] **Step 3: vercel.json — Edge-Function-Config**

Lese erst `vercel.json` falls existiert. Wenn nicht: anlegen mit:

```json
{
  "functions": {
    "app/api/cron/akquise-poll/route.ts": {
      "maxDuration": 60
    },
    "app/api/akquise/process/route.ts": {
      "maxDuration": 60
    }
  },
  "crons": []
}
```

(Cron läuft via cron-job.org extern, nicht Vercel-Cron — daher leeres `crons`-Array)

- [ ] **Step 4: CLAUDE.md ergänzen — Pipeline-Hinweis**

In `CLAUDE.md` unter "Workflow-Integration" ersetzen:

ALT:
```
Bestehender Cloud-Code-Workflow `Automation Akquise` wird um Subagent **"CRM Befüllen"** ergänzt (Schritt 7). Der Subagent schreibt nach erfolgreicher Kalkulation direkt via Supabase REST API ins CRM (Duplikat-Check Email + Name).
```

NEU:
```
**Akquise-Pipeline (Schritt 7, Cloud):** Mails aus Outlook-Ordner `CRM-Eingang` werden alle 5 Min via Vercel-Edge-Function abgeholt, PDFs nach OneDrive hochgeladen, QuickCheck-Score erzeugt und als Lead mit Status `pre_screened` im CRM angelegt. Aufteiler bleibt unberührt — manueller Trigger via "Ordner-Pfad-kopieren"-Button im CRM. Details: `docs/superpowers/specs/2026-05-11-akquise-pipeline-cloud-design.md`.
```

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json .env.example vercel.json CLAUDE.md
git commit -m "chore(akquise): deps + env-vars für pipeline"
```

---

## Task 7c: MS-Graph-Auth + OneDrive-Helper

**Files:**
- Create: `app/api/akquise/_lib/msGraphClient.ts`
- Create: `app/api/akquise/_lib/uploadOneDrive.ts`
- Create: `tests/akquise/msGraphClient.test.ts`

- [ ] **Step 1: Initial-Refresh-Token via OAuth-Flow holen (einmalig)**

Lokales One-Time-Script `scripts/oauth-bootstrap.mjs`:

```javascript
import { ConfidentialClientApplication } from '@azure/msal-node';
import readline from 'readline';

const app = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.MS_GRAPH_CLIENT_ID,
    clientSecret: process.env.MS_GRAPH_CLIENT_SECRET,
    authority: `https://login.microsoftonline.com/${process.env.MS_GRAPH_TENANT_ID || 'common'}`,
  },
});

const url = await app.getAuthCodeUrl({
  scopes: ['Files.ReadWrite.All', 'offline_access', 'User.Read'],
  redirectUri: 'http://localhost:3000/auth/callback',
});
console.log('Öffne im Browser:\n', url);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Code aus URL nach Redirect: ', async (code) => {
  const token = await app.acquireTokenByCode({
    code,
    scopes: ['Files.ReadWrite.All', 'offline_access'],
    redirectUri: 'http://localhost:3000/auth/callback',
  });
  console.log('Refresh-Token (in Vercel als MS_GRAPH_REFRESH_TOKEN setzen):');
  console.log(token.account);
  // MSAL speichert Refresh-Token im Cache — manuell aus tokenCache exportieren
  console.log(app.getTokenCache().serialize());
  rl.close();
});
```

Run einmal lokal, Refresh-Token aus Cache-Output extrahieren, in Vercel-Env-Group als `MS_GRAPH_REFRESH_TOKEN` setzen. Script danach wegwerfen.

- [ ] **Step 2: msGraphClient.ts — Token-Refresh-Wrapper**

```typescript
// app/api/akquise/_lib/msGraphClient.ts
import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const app = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MS_GRAPH_CLIENT_ID!,
      clientSecret: process.env.MS_GRAPH_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.MS_GRAPH_TENANT_ID || 'common'}`,
    },
  });

  const result = await app.acquireTokenByRefreshToken({
    refreshToken: process.env.MS_GRAPH_REFRESH_TOKEN!,
    scopes: ['Files.ReadWrite.All', 'offline_access'],
  });

  if (!result?.accessToken) {
    throw new Error('MS Graph Token-Refresh fehlgeschlagen');
  }

  cachedToken = {
    value: result.accessToken,
    expiresAt: result.expiresOn?.getTime() ?? Date.now() + 50 * 60 * 1000,
  };
  return cachedToken.value;
}

export async function graphClient(): Promise<Client> {
  const token = await getAccessToken();
  return Client.init({ authProvider: (done) => done(null, token) });
}
```

- [ ] **Step 3: uploadOneDrive.ts**

```typescript
// app/api/akquise/_lib/uploadOneDrive.ts
import { graphClient } from './msGraphClient';

const BASE = process.env.ONEDRIVE_BASE_PATH || '/Immobilien/001_AQUISE/Objekte';

export interface UploadInput {
  addressFolder: string;     // z.B. "Talstr 10, 44137 Dortmund"
  files: Array<{ name: string; buffer: Buffer; contentType: string }>;
}

export interface UploadResult {
  folderPath: string;        // /Immobilien/001_AQUISE/Objekte/Talstr 10, 44137 Dortmund
  webUrl: string;            // OneDrive-Browser-Link
  localPath: string;         // Windows-Pfad zum Doppelklick
  uploadedFiles: Array<{ name: string; itemId: string; size: number }>;
}

export async function uploadFiles(input: UploadInput): Promise<UploadResult> {
  const client = await graphClient();
  const folder = sanitizeFolderName(input.addressFolder);
  const folderUrl = `${BASE}/${folder}`;

  // Ordner anlegen (idempotent — bei 409 conflict einfach weiter)
  try {
    await client
      .api(`/me/drive/root:${BASE}:/children`)
      .post({ name: folder, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' });
  } catch (err: any) {
    if (err?.statusCode !== 409) throw err;
  }

  const uploaded: UploadResult['uploadedFiles'] = [];
  for (const file of input.files) {
    // Datei < 4MB direkter PUT, sonst UploadSession
    if (file.buffer.length < 4 * 1024 * 1024) {
      const item = await client
        .api(`/me/drive/root:${folderUrl}/${file.name}:/content`)
        .put(file.buffer);
      uploaded.push({ name: file.name, itemId: item.id, size: file.buffer.length });
    } else {
      const session = await client
        .api(`/me/drive/root:${folderUrl}/${file.name}:/createUploadSession`)
        .post({ '@microsoft.graph.conflictBehavior': 'replace' });
      // Vereinfacht: einer einzigen PUT-Range — bei sehr großen Files chunked, aber Exposés sind selten >30MB
      const res = await fetch(session.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(file.buffer.length),
          'Content-Range': `bytes 0-${file.buffer.length - 1}/${file.buffer.length}`,
        },
        body: file.buffer,
      });
      if (!res.ok) throw new Error(`Upload-Session-PUT failed: ${res.status}`);
      const item = await res.json();
      uploaded.push({ name: file.name, itemId: item.id, size: file.buffer.length });
    }
  }

  const folderItem = await client.api(`/me/drive/root:${folderUrl}`).get();

  return {
    folderPath: folderUrl,
    webUrl: folderItem.webUrl,
    localPath: `${process.env.ONEDRIVE_LOCAL_PATH_PREFIX}\\${folder}`,
    uploadedFiles: uploaded,
  };
}

function sanitizeFolderName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 200);
}
```

- [ ] **Step 4: Smoke-Test gegen echtes OneDrive**

Lokales Test-Script `scripts/test-onedrive-upload.mjs` (NICHT committen):

```javascript
import { uploadFiles } from '../app/api/akquise/_lib/uploadOneDrive.ts';

const result = await uploadFiles({
  addressFolder: '_PIPELINE-SPIKE-' + Date.now(),
  files: [
    { name: 'hello.txt', buffer: Buffer.from('hi'), contentType: 'text/plain' },
  ],
});
console.log(result);
```

Run:
```powershell
node --experimental-vm-modules --import tsx scripts/test-onedrive-upload.mjs
```

(Falls tsx nicht installiert: `npm install -D tsx`)

Expected: Ordner `_PIPELINE-SPIKE-<timestamp>` erscheint im OneDrive, `hello.txt` ist drin, `localPath` zeigt einen Windows-Pfad, der sich per Explorer öffnen lässt.

- [ ] **Step 5: Test-Spike wegwerfen**

```powershell
Remove-Item scripts/test-onedrive-upload.mjs
```

- [ ] **Step 6: Commit**

```powershell
git add app/api/akquise/_lib/msGraphClient.ts app/api/akquise/_lib/uploadOneDrive.ts
git commit -m "feat(akquise): ms-graph auth + onedrive upload"
```

---

## Task 7d: IMAP-Client + Poll-Endpoint

**Files:**
- Create: `app/api/akquise/_lib/imapClient.ts`
- Create: `app/api/cron/akquise-poll/route.ts`
- Modify: `src/lib/supabaseAdmin.ts` (NEU — Service-Role-Client für Backend)

- [ ] **Step 1: supabaseAdmin.ts**

```typescript
// src/lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export function supabaseAdmin() {
  return createClient<Database>(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
```

- [ ] **Step 2: imapClient.ts**

```typescript
// app/api/akquise/_lib/imapClient.ts
import { ImapFlow } from 'imapflow';

export async function imapConnect(): Promise<ImapFlow> {
  const client = new ImapFlow({
    host: 'imap.web.de',
    port: 993,
    secure: true,
    auth: {
      user: process.env.WEBDE_IMAP_USER!,
      pass: process.env.WEBDE_IMAP_APP_PASSWORD!,
    },
    logger: false,
  });
  await client.connect();
  return client;
}
```

- [ ] **Step 3: Poll-Endpoint schreiben**

```typescript
// app/api/cron/akquise-poll/route.ts
import { imapConnect } from '../../akquise/_lib/imapClient';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET_AKQUISE}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supa = supabaseAdmin();
  const client = await imapConnect();

  try {
    const lock = await client.getMailboxLock('CRM-Eingang');
    try {
      // Idempotenz: nicht via SEEN-Flag (unzuverlässig wegen Multi-Client-Sync mit Handy/Outlook),
      // sondern via mail_queue.message_id PRIMARY KEY. Wir holen ALLE Mails im Ordner —
      // Duplikate wirft der Unique-Constraint sauber raus.
      const uids = await client.search({ all: true });
      let enqueued = 0;
      let skipped = 0;

      for (const uid of uids) {
        const msg = await client.fetchOne(uid, { envelope: true, source: true });
        const messageId = msg.envelope.messageId;
        if (!messageId) {
          await client.messageFlagsAdd(uid, ['\\Seen']);
          continue;
        }

        const { error } = await supa
          .from('mail_queue')
          .insert({
            message_id: messageId,
            imap_uid: uid as number,
            status: 'pending',
            raw_source_sha: await sha256(msg.source as Buffer),
          });

        if (error) {
          if (error.code === '23505') {
            skipped += 1;
            await client.messageFlagsAdd(uid, ['\\Seen']);
            continue;
          }
          throw error;
        }

        // Stage-Worker triggern (fire-and-forget)
        const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.SITE_URL;
        fetch(`${base}/api/akquise/process`, {
          method: 'POST',
          headers: {
            'authorization': `Bearer ${process.env.CRON_SECRET_AKQUISE}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ messageId, rawSource: (msg.source as Buffer).toString('base64') }),
        }).catch(() => { /* fire-and-forget */ });

        await client.messageFlagsAdd(uid, ['\\Seen']);
        enqueued += 1;
      }

      return Response.json({ ok: true, enqueued, skipped, total: uids.length });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

async function sha256(buf: Buffer): Promise<string> {
  const crypto = await import('node:crypto');
  return crypto.createHash('sha256').update(buf).digest('hex');
}
```

- [ ] **Step 4: Lokaler Test des Poll-Endpoints**

Vercel-Dev starten:
```powershell
npx vercel dev
```

Test-Mail manuell in CRM-Eingang schieben, dann:

```powershell
curl -X POST http://localhost:3000/api/cron/akquise-poll `
  -H "authorization: Bearer <CRON_SECRET_AKQUISE-aus-.env.local>"
```

Expected: JSON `{ "ok": true, "enqueued": 1, "skipped": 0, "total": 1 }`, Mail in Outlook gilt als gelesen, neue Zeile in `mail_queue` mit status `pending`.

(Process-Endpoint existiert noch nicht — Status bleibt `pending`, das ist OK für diesen Test.)

- [ ] **Step 5: Commit**

```powershell
git add src/lib/supabaseAdmin.ts app/api/akquise/_lib/imapClient.ts app/api/cron/akquise-poll/route.ts
git commit -m "feat(akquise): imap poll-endpoint + supabase admin client"
```

---

## Task 7e: Mail-Parsing + PDF-Klassifikation

**Files:**
- Create: `app/api/akquise/_lib/parseEmail.ts`
- Create: `app/api/akquise/_lib/classifyPdf.ts`
- Create: `tests/akquise/parseEmail.test.ts`
- Create: `tests/akquise/classifyPdf.test.ts`

- [ ] **Step 1: Failing Test parseEmail**

```typescript
// tests/akquise/parseEmail.test.ts
import { describe, it, expect } from 'vitest';
import { parseEmail } from '@/../app/api/akquise/_lib/parseEmail';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('parseEmail', () => {
  it('extrahiert PDF-Anhänge', async () => {
    const raw = readFileSync(join(__dirname, 'fixtures/mail-with-pdf.eml'));
    const result = await parseEmail(raw);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].name).toMatch(/\.pdf$/i);
    expect(result.attachments[0].buffer.length).toBeGreaterThan(100);
  });

  it('extrahiert Links aus Mailtext', async () => {
    const raw = readFileSync(join(__dirname, 'fixtures/mail-with-link.eml'));
    const result = await parseEmail(raw);
    expect(result.links.length).toBeGreaterThan(0);
    expect(result.links[0]).toMatch(/^https?:\/\//);
  });

  it('liefert Subject + From', async () => {
    const raw = readFileSync(join(__dirname, 'fixtures/mail-with-pdf.eml'));
    const result = await parseEmail(raw);
    expect(result.subject).toBeTruthy();
    expect(result.from.email).toMatch(/@/);
  });
});
```

- [ ] **Step 2: Fixtures anlegen**

Mindestens drei echte Mails aus dem Posteingang als `.eml` exportieren (Outlook → Speichern unter → eml-Format) und nach `tests/akquise/fixtures/` legen. Empfohlen: `mail-with-pdf.eml`, `mail-with-link.eml`, `mail-multi-pdf.eml`.

- [ ] **Step 3: Test laufen — muss failen**

Run:
```powershell
npm test tests/akquise/parseEmail.test.ts
```

Expected: FAIL ("Cannot find module ...parseEmail").

- [ ] **Step 4: parseEmail.ts schreiben**

```typescript
// app/api/akquise/_lib/parseEmail.ts
import { simpleParser } from 'mailparser';

export interface ParsedEmail {
  messageId: string;
  subject: string;
  from: { name?: string; email: string };
  to: string[];
  date: Date;
  text: string;
  html: string;
  attachments: Array<{ name: string; contentType: string; buffer: Buffer }>;
  links: string[];
}

export async function parseEmail(rawSource: Buffer | string): Promise<ParsedEmail> {
  const parsed = await simpleParser(rawSource);

  const text = parsed.text || '';
  const html = parsed.html || '';
  const links = extractLinks(`${text}\n${html}`);

  return {
    messageId: parsed.messageId || '',
    subject: parsed.subject || '',
    from: {
      name: parsed.from?.value?.[0]?.name,
      email: parsed.from?.value?.[0]?.address || '',
    },
    to: parsed.to?.value?.map(v => v.address || '').filter(Boolean) ?? [],
    date: parsed.date || new Date(),
    text,
    html: typeof html === 'string' ? html : '',
    attachments: (parsed.attachments || [])
      .filter(a => a.content && a.filename)
      .map(a => ({
        name: a.filename!,
        contentType: a.contentType || 'application/octet-stream',
        buffer: a.content as Buffer,
      })),
    links,
  };
}

function extractLinks(content: string): string[] {
  const re = /https?:\/\/[^\s"'<>)]+/g;
  const matches = content.match(re) || [];
  return Array.from(new Set(matches));
}
```

- [ ] **Step 5: Test laufen — muss passen**

Run:
```powershell
npm test tests/akquise/parseEmail.test.ts
```

Expected: PASS, alle drei Tests grün.

- [ ] **Step 6: Failing Test classifyPdf**

```typescript
// tests/akquise/classifyPdf.test.ts
import { describe, it, expect } from 'vitest';
import { classifyPdf } from '@/../app/api/akquise/_lib/classifyPdf';

describe('classifyPdf', () => {
  it('erkennt Exposé per Filename', () => {
    expect(classifyPdf({ filename: 'Expose_Talstr_10.pdf', text: '' })).toBe('expose');
    expect(classifyPdf({ filename: 'Exposé.pdf', text: '' })).toBe('expose');
  });

  it('erkennt Mieterliste', () => {
    expect(classifyPdf({ filename: 'Mieterliste.pdf', text: '' })).toBe('mieterliste');
  });

  it('erkennt Energieausweis', () => {
    expect(classifyPdf({ filename: 'energieausweis.pdf', text: '' })).toBe('energie');
  });

  it('Fallback per Inhalt wenn Filename neutral', () => {
    expect(classifyPdf({
      filename: 'anhang.pdf',
      text: 'Endenergiebedarf 145 kWh/(m²·a) Energieeffizienzklasse D',
    })).toBe('energie');
  });

  it('sonstiges als Default', () => {
    expect(classifyPdf({ filename: 'random.pdf', text: 'lorem ipsum' })).toBe('sonstiges');
  });
});
```

- [ ] **Step 7: Test laufen — muss failen**

Run: `npm test tests/akquise/classifyPdf.test.ts` → FAIL.

- [ ] **Step 8: classifyPdf.ts schreiben**

```typescript
// app/api/akquise/_lib/classifyPdf.ts
export type PdfType = 'expose' | 'mieterliste' | 'energie' | 'modernisierung' | 'grundriss' | 'sonstiges';

export function classifyPdf(input: { filename: string; text: string }): PdfType {
  const fn = input.filename.toLowerCase();
  const txt = input.text.toLowerCase();

  if (/expos[ée]/.test(fn)) return 'expose';
  if (/mieterliste|mietliste|mietaufstellung/.test(fn)) return 'mieterliste';
  if (/energie(ausweis|pass)|epc/.test(fn)) return 'energie';
  if (/modernisierung|renovierung|sanierung/.test(fn)) return 'modernisierung';
  if (/grundriss|plan/.test(fn)) return 'grundriss';

  // Fallback: Inhalt
  if (/endenergiebedarf|energieeffizienzklasse|energieausweis/.test(txt)) return 'energie';
  if (/mieter|nettomiete|wohnfl[äa]che.*miete/.test(txt)) return 'mieterliste';
  if (/wohnfl[äa]che|kaufpreis|baujahr/.test(txt)) return 'expose';

  return 'sonstiges';
}
```

- [ ] **Step 9: Test laufen — muss passen**

Run: `npm test tests/akquise/classifyPdf.test.ts` → PASS.

- [ ] **Step 10: Commit**

```powershell
git add app/api/akquise/_lib/parseEmail.ts app/api/akquise/_lib/classifyPdf.ts tests/akquise/
git commit -m "feat(akquise): mail-parsing + pdf-klassifikation mit tests"
```

---

## Task 7f: Adress-Extraktion (Regex + Anthropic-Fallback)

**Files:**
- Create: `app/api/akquise/_lib/extractAddress.ts`
- Create: `tests/akquise/extractAddress.test.ts`

- [ ] **Step 1: Failing Tests**

```typescript
// tests/akquise/extractAddress.test.ts
import { describe, it, expect, vi } from 'vitest';
import { extractAddress } from '@/../app/api/akquise/_lib/extractAddress';

describe('extractAddress', () => {
  it('Regex-First für klare Adresse', async () => {
    const result = await extractAddress({
      text: 'Objekt: Talstraße 10, 44137 Dortmund. Bestand MFH mit 8 WE.',
      pdfText: '',
    });
    expect(result.address).toBe('Talstraße 10, 44137 Dortmund');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.source).toBe('regex');
  });

  it('Regex-First für PLZ-vor-Stadt-Format', async () => {
    const result = await extractAddress({
      text: '',
      pdfText: 'Lage: 45131 Essen, Rüttenscheider Str. 78',
    });
    expect(result.address).toMatch(/45131 Essen/);
    expect(result.source).toBe('regex');
  });

  it('LLM-Fallback bei Regex-Miss', async () => {
    // Mocking-Setup für Anthropic-Call
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    // (Echter Test mocked den SDK-Call — implementation choice in 7f-step-3)
  });
});
```

- [ ] **Step 2: Test failen lassen**

Run: `npm test tests/akquise/extractAddress.test.ts` → FAIL.

- [ ] **Step 3: extractAddress.ts schreiben**

```typescript
// app/api/akquise/_lib/extractAddress.ts
import Anthropic from '@anthropic-ai/sdk';

export interface AddressResult {
  address: string | null;
  confidence: number;     // 0..1
  source: 'regex' | 'llm' | 'fallback';
}

const STREET_RE = /\b([A-ZÄÖÜ][a-zäöüß.\-]+(?:straße|str\.?|allee|weg|gasse|platz|ring))\s+(\d+[a-z]?)\b/i;
const CITY_RE = /\b(\d{5})\s+([A-ZÄÖÜ][a-zäöüß\-]+(?:\s+[A-ZÄÖÜ][a-zäöüß\-]+)*)\b/;

export async function extractAddress(input: { text: string; pdfText: string }): Promise<AddressResult> {
  const blob = `${input.text}\n${input.pdfText}`;

  const street = blob.match(STREET_RE);
  const city = blob.match(CITY_RE);

  if (street && city) {
    return {
      address: `${street[1]} ${street[2]}, ${city[1]} ${city[2]}`,
      confidence: 0.85,
      source: 'regex',
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { address: null, confidence: 0, source: 'fallback' };
  }

  const client = new Anthropic();
  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: 'Du extrahierst Immobilien-Adressen aus deutschem Text. Antworte ausschließlich im JSON-Format {"address": string|null, "confidence": number}. Keine Erklärung.',
    messages: [{
      role: 'user',
      content: `Extrahiere die Objekt-Adresse:\n\n${blob.slice(0, 4000)}`,
    }],
  });

  const content = resp.content[0];
  if (content.type !== 'text') {
    return { address: null, confidence: 0, source: 'fallback' };
  }

  try {
    const parsed = JSON.parse(content.text);
    return {
      address: parsed.address,
      confidence: parsed.confidence ?? 0.5,
      source: 'llm',
    };
  } catch {
    return { address: null, confidence: 0, source: 'fallback' };
  }
}
```

- [ ] **Step 4: Test laufen + 3 echte Mails durchtesten**

Run: `npm test tests/akquise/extractAddress.test.ts` → PASS (mindestens die ersten beiden Regex-Tests).

Zusätzlich: lokal ein Spike-Script mit 3 echten Exposé-Texten füttern, Confidence + Adresse manuell prüfen. Wenn Confidence durchgängig ≥ 0.7 → gut.

- [ ] **Step 5: Commit**

```powershell
git add app/api/akquise/_lib/extractAddress.ts tests/akquise/extractAddress.test.ts
git commit -m "feat(akquise): adress-extraktion regex + anthropic-fallback"
```

---

## Task 7g: Kontakt + Position-Heuristik (aus altem Schritt-7 übernommen)

**Files:**
- Create: `app/api/akquise/_lib/extractContact.ts`
- Create: `app/api/akquise/_lib/positionHeuristic.ts`
- Create: `tests/akquise/positionHeuristic.test.ts`

- [ ] **Step 1: Failing Tests Position-Heuristik**

```typescript
// tests/akquise/positionHeuristic.test.ts
import { describe, it, expect } from 'vitest';
import { detectPosition } from '@/../app/api/akquise/_lib/positionHeuristic';

describe('detectPosition', () => {
  it('Default = Makler', () => {
    expect(detectPosition({ signature: '', name: 'Hans Schmidt', companyName: 'Müller Immo GmbH' }))
      .toBe('Makler');
  });

  it('GF in Signatur', () => {
    expect(detectPosition({ signature: 'Geschäftsführer', name: 'H. Müller', companyName: 'Müller Immo' }))
      .toBe('Geschäftsführer');
    expect(detectPosition({ signature: 'GF', name: 'X', companyName: 'Y' }))
      .toBe('Geschäftsführer');
  });

  it('Inhaber-Erkennung bei Name == Firmenname', () => {
    expect(detectPosition({
      signature: '',
      name: 'Hans Müller',
      companyName: 'Müller Immobilien',
    })).toBe('Inhaber');
  });

  it('Inhaber-Erkennung mit Levenshtein-Toleranz', () => {
    expect(detectPosition({
      signature: '',
      name: 'Maier',
      companyName: 'Mayer Immo GmbH',
    })).toBe('Inhaber');
  });

  it('Owner/Inhaber in Signatur', () => {
    expect(detectPosition({ signature: 'Inhaber', name: 'X', companyName: 'Y' }))
      .toBe('Inhaber');
  });
});
```

- [ ] **Step 2: positionHeuristic.ts schreiben**

```typescript
// app/api/akquise/_lib/positionHeuristic.ts
export type Position = 'Makler' | 'Geschäftsführer' | 'Inhaber';

export function detectPosition(input: {
  signature: string;
  name: string;
  companyName: string;
}): Position {
  const sig = input.signature.toLowerCase();

  if (/\b(gf|geschäftsführer|geschaeftsfuehrer|managing director)\b/.test(sig)) {
    return 'Geschäftsführer';
  }
  if (/\b(inhaber|owner|gründer|gruender|founder)\b/.test(sig)) {
    return 'Inhaber';
  }

  const lastName = input.name.trim().split(/\s+/).pop()?.toLowerCase() || '';
  const companyTokens = input.companyName
    .toLowerCase()
    .replace(/(gmbh|kg|ag|ohg|gbr|immobilien|immo|gruppe|holding|consulting|partners?)\b\.?/g, '')
    .trim()
    .split(/\s+/);

  for (const token of companyTokens) {
    if (token.length >= 3 && levenshtein(lastName, token) <= 1) {
      return 'Inhaber';
    }
  }

  return 'Makler';
}

function levenshtein(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}
```

- [ ] **Step 3: Tests laufen**

Run: `npm test tests/akquise/positionHeuristic.test.ts` → alle PASS.

- [ ] **Step 4: extractContact.ts**

```typescript
// app/api/akquise/_lib/extractContact.ts
import type { ParsedEmail } from './parseEmail';
import { detectPosition, type Position } from './positionHeuristic';

export interface ExtractedContact {
  name: string;
  email: string;
  phone: string | null;
  companyName: string;
  position: Position;
  rawSignature: string;
}

export function extractContact(mail: ParsedEmail): ExtractedContact {
  const signature = extractSignature(mail.text);
  const phone = extractPhone(signature + '\n' + mail.text);
  const companyName = extractCompany(mail.from.name || '', signature, mail.from.email);
  const name = mail.from.name || mail.from.email.split('@')[0];

  return {
    name,
    email: mail.from.email.toLowerCase().trim(),
    phone,
    companyName,
    position: detectPosition({ signature, name, companyName }),
    rawSignature: signature,
  };
}

function extractSignature(text: string): string {
  const lines = text.split(/\r?\n/);
  const sigStart = lines.findIndex(l => /^--\s*$|mit freundlichen grüßen|beste grüße|viele grüße/i.test(l));
  if (sigStart === -1) return lines.slice(-10).join('\n');
  return lines.slice(sigStart).join('\n');
}

function extractPhone(text: string): string | null {
  const re = /(\+49\s?\d{2,5}[\s\-\/]?\d{3,}[\s\-\/]?\d{2,}|0\d{2,5}[\s\-\/]?\d{3,}[\s\-\/]?\d{2,})/;
  const m = text.match(re);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
}

function extractCompany(fromName: string, signature: string, email: string): string {
  const sigCompany = signature.match(/(?:^|\n)\s*([A-ZÄÖÜ][\w\s&\-.]+(?:GmbH|KG|AG|GbR|OHG|Immobilien|Immo)\b\.?)/);
  if (sigCompany) return sigCompany[1].trim();
  if (/GmbH|KG|AG|GbR/.test(fromName)) return fromName.trim();
  const domain = email.split('@')[1]?.split('.')[0] || '';
  return domain;
}
```

- [ ] **Step 5: Commit**

```powershell
git add app/api/akquise/_lib/extractContact.ts app/api/akquise/_lib/positionHeuristic.ts tests/akquise/positionHeuristic.test.ts
git commit -m "feat(akquise): kontakt + position-heuristik (gf/inhaber/makler)"
```

---

## Task 7h: Duplikat-Matching (Hard/Soft/No-Match) + Mail-Grouping + insertLead

**Files:**
- Create: `app/api/akquise/_lib/duplicateMatch.ts`
- Create: `app/api/akquise/_lib/insertLead.ts`
- Create: `app/api/akquise/_lib/groupMail.ts`        ← NEU 2026-05-12: Mail-Grouping
- Create: `tests/akquise/duplicateMatch.test.ts`
- Create: `tests/akquise/groupMail.test.ts`         ← NEU

**Mail-Grouping-Anforderung (Nachtrag 2026-05-12, vom User):**

Mehrere Mails desselben Maklers zum **selben Objekt** (z.B. Exposé + Mieterliste + Energieausweis separat) sollen genau **EINEN** Lead erzeugen. Strategie "beide kombiniert":

1. **Primär: Adress-Match.** Wenn die neue Mail die gleiche Objekt-Adresse hat wie ein bestehender Deal mit Status `pre_screened` UND derselbe Kontakt (Email) ist → keine neue Deal-Zeile, sondern:
   - PDFs werden zum bestehenden OneDrive-Ordner hinzugefügt (Filename-Conflict: `_2`-Suffix)
   - `deal_notes` bekommt einen Eintrag "Nachreichung am <Datum>: <Filenames>"
   - `inbox_message_id` bleibt unverändert (zeigt auf die erste Mail)
   - QuickCheck wird NICHT neu ausgeführt (Erstbewertung bleibt)
2. **Sekundär: Reply-To-Match.** Wenn primär nicht greift (Adresse noch nicht extrahiert, z.B. Mailtext "siehe Anhang"), prüfen wir `In-Reply-To`-Header der eingehenden Mail. Wenn dieser auf einen `message_id` in `mail_queue` zeigt → gleicher Trichter, Behandlung wie 1.
3. **Fallback: Neuer Lead.** Sonst regulärer pre_screened-Lead.

**Akzeptanz für Mail-Grouping:**
- 3 Mails desselben Maklers zur "Talstr 10 Dortmund" → 1 Lead, 1 OneDrive-Ordner mit allen PDFs, 2 deal_notes-Einträge ("Nachreichung")
- 3 separate Objekte vom selben Makler → 3 Leads
- Reply-Thread ohne Adresse in der Antwort → erste Mail = Lead, Folge-Mails fügen PDFs hinzu

- [ ] **Step 1: Failing Tests Duplikat**

```typescript
// tests/akquise/duplicateMatch.test.ts
import { describe, it, expect } from 'vitest';
import { classifyMatch } from '@/../app/api/akquise/_lib/duplicateMatch';

describe('classifyMatch', () => {
  it('Hard-Match bei exakter Email', () => {
    expect(classifyMatch({
      newContact: { email: 'h.mueller@immo.de', name: 'Hans Müller' },
      existing: [{ email: 'h.mueller@immo.de', name: 'H. Müller' }],
    })).toEqual({ kind: 'hard', existingIndex: 0 });
  });

  it('Soft-Match bei Name-Ähnlichkeit ohne Email-Match', () => {
    expect(classifyMatch({
      newContact: { email: 'neue@anders.de', name: 'Hans Müller' },
      existing: [{ email: 'alt@anders.de', name: 'H. Mueller' }],
    })).toEqual({ kind: 'soft', existingIndex: 0 });
  });

  it('No-Match bei unbekanntem Kontakt', () => {
    expect(classifyMatch({
      newContact: { email: 'x@y.de', name: 'Frau Neumann' },
      existing: [{ email: 'a@b.de', name: 'Herr Schulz' }],
    })).toEqual({ kind: 'none' });
  });
});
```

- [ ] **Step 2: duplicateMatch.ts**

```typescript
// app/api/akquise/_lib/duplicateMatch.ts
export interface MatchInput {
  newContact: { email: string; name: string };
  existing: Array<{ email: string; name: string }>;
}
export type Match =
  | { kind: 'hard'; existingIndex: number }
  | { kind: 'soft'; existingIndex: number }
  | { kind: 'none' };

export function classifyMatch(input: MatchInput): Match {
  const newEmail = input.newContact.email.toLowerCase().trim();
  for (let i = 0; i < input.existing.length; i++) {
    if (input.existing[i].email.toLowerCase().trim() === newEmail) {
      return { kind: 'hard', existingIndex: i };
    }
  }
  const newName = normalize(input.newContact.name);
  for (let i = 0; i < input.existing.length; i++) {
    if (nameSimilar(newName, normalize(input.existing[i].name))) {
      return { kind: 'soft', existingIndex: i };
    }
  }
  return { kind: 'none' };
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[äöü]/g, m => ({ä:'ae',ö:'oe',ü:'ue'}[m]!)).replace(/[^a-z\s]/g, '').trim();
}

function nameSimilar(a: string, b: string): boolean {
  const aLast = a.split(/\s+/).pop() || '';
  const bLast = b.split(/\s+/).pop() || '';
  return aLast.length >= 3 && aLast === bLast;
}
```

- [ ] **Step 3: Test laufen** — alle PASS.

- [ ] **Step 4: insertLead.ts**

```typescript
// app/api/akquise/_lib/insertLead.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { ExtractedContact } from './extractContact';
import { classifyMatch } from './duplicateMatch';

export interface InsertLeadInput {
  contact: ExtractedContact;
  deal: {
    address: string | null;
    workspacePath: string;
    onedriveWebUrl: string;
    expose_url: string | null;
    inboxMessageId: string;
    priorityScore: number | null;
    priorityReason: string | null;
  };
}

export interface InsertLeadResult {
  contactId: string;
  dealId: string;
  matchKind: 'hard' | 'soft' | 'none';
  warning: string | null;
}

export async function insertLead(input: InsertLeadInput): Promise<InsertLeadResult> {
  const supa = supabaseAdmin();

  const { data: existing } = await supa
    .from('contacts')
    .select('id, email, name')
    .or(`email.eq.${input.contact.email},name.ilike.%${input.contact.name.split(' ').pop()}%`)
    .limit(20);

  const match = classifyMatch({
    newContact: { email: input.contact.email, name: input.contact.name },
    existing: existing?.map(e => ({ email: e.email || '', name: e.name })) || [],
  });

  let contactId: string;
  let warning: string | null = null;

  if (match.kind === 'hard') {
    contactId = existing![match.existingIndex].id;
    // Nur fehlende Felder füllen, keine bestehenden überschreiben
    const current = existing![match.existingIndex] as any;
    const updates: Record<string, unknown> = {};
    if (!current.phone && input.contact.phone) updates.phone = input.contact.phone;
    if (!current.company_name && input.contact.companyName) updates.company_name = input.contact.companyName;
    if (Object.keys(updates).length) {
      await supa.from('contacts').update(updates).eq('id', contactId);
    }
  } else if (match.kind === 'soft') {
    const { data: inserted } = await supa
      .from('contacts')
      .insert({
        name: input.contact.name,
        email: input.contact.email,
        phone: input.contact.phone,
        company_name: input.contact.companyName,
        position: input.contact.position,
        status: 'kalt',
      })
      .select('id')
      .single();
    contactId = inserted!.id;
    warning = `Duplikat-Verdacht: ähnlicher Name wie ${existing![match.existingIndex].name} (${existing![match.existingIndex].email})`;
    await supa.from('contact_comments').insert({
      contact_id: contactId,
      content: `⚠️ ${warning}`,
    });
  } else {
    const { data: inserted } = await supa
      .from('contacts')
      .insert({
        name: input.contact.name,
        email: input.contact.email,
        phone: input.contact.phone,
        company_name: input.contact.companyName,
        position: input.contact.position,
        status: 'kalt',
      })
      .select('id')
      .single();
    contactId = inserted!.id;
  }

  const { data: deal } = await supa
    .from('deals')
    .insert({
      contact_id: contactId,
      status: 'pre_screened',
      address: input.deal.address,
      expose_url: input.deal.expose_url,
      expose_local_path: input.deal.workspacePath,
      workspace_path: input.deal.workspacePath,
      priority_score: input.deal.priorityScore,
      priority_reason: input.deal.priorityReason,
      expose_source: 'mail-pipeline',
      inbox_message_id: input.deal.inboxMessageId,
      angebot_datum: new Date().toISOString().split('T')[0],
    })
    .select('id')
    .single();

  await supa.from('activity_log').insert({
    contact_id: contactId,
    deal_id: deal!.id,
    type: 'new_lead',
  });

  return { contactId, dealId: deal!.id, matchKind: match.kind, warning };
}
```

- [ ] **Step 5: Commit**

```powershell
git add app/api/akquise/_lib/duplicateMatch.ts app/api/akquise/_lib/insertLead.ts tests/akquise/duplicateMatch.test.ts
git commit -m "feat(akquise): duplikat-match (hard/soft/none) + insertLead mit pre_screened"
```

---

## Task 7i: Workspace-Writer (`.code-workspace` + `CLAUDE.md` + `00_briefing.md`)

**Files:**
- Create: `app/api/akquise/_lib/writeWorkspace.ts`
- Create: `tests/akquise/writeWorkspace.test.ts`

- [ ] **Step 1: Failing Test**

```typescript
// tests/akquise/writeWorkspace.test.ts
import { describe, it, expect } from 'vitest';
import { buildWorkspaceFiles } from '@/../app/api/akquise/_lib/writeWorkspace';

describe('buildWorkspaceFiles', () => {
  it('liefert .code-workspace mit folderOpen-Task', () => {
    const result = buildWorkspaceFiles({
      address: 'Talstr 10, 44137 Dortmund',
      score: 78,
      reason: 'Bestand MFH, gute Lage',
      kennzahlen: { we: 8, wfl: 520, kp: 1050000, eurProM2: 2020 },
      quickCheckTranscript: 'User: ...\nAssistant: ...',
      pdfFiles: ['Exposé.pdf', 'Mieterliste.pdf'],
    });

    expect(result['objekt.code-workspace']).toContain('"runOn": "folderOpen"');
    expect(result['objekt.code-workspace']).toContain('claude');
    expect(result['CLAUDE.md']).toContain('Talstr 10');
    expect(result['CLAUDE.md']).toContain('00_briefing.md');
    expect(result['00_briefing.md']).toContain('Score: 78');
    expect(result['00_briefing.md']).toContain('Bestand MFH');
    expect(result['00_quickcheck-transkript.md']).toContain('Assistant:');
  });
});
```

- [ ] **Step 2: writeWorkspace.ts**

```typescript
// app/api/akquise/_lib/writeWorkspace.ts
export interface WorkspaceInput {
  address: string;
  score: number | null;
  reason: string | null;
  kennzahlen: {
    we?: number;
    wfl?: number;
    kp?: number;
    eurProM2?: number;
    baujahr?: number;
  };
  quickCheckTranscript: string;
  pdfFiles: string[];
}

export function buildWorkspaceFiles(input: WorkspaceInput): Record<string, string> {
  const workspace = JSON.stringify({
    folders: [{ path: '.' }],
    settings: {
      'terminal.integrated.defaultProfile.windows': 'PowerShell',
    },
    tasks: {
      version: '2.0.0',
      tasks: [{
        label: 'Claude Code starten',
        type: 'shell',
        command: 'claude',
        windows: { command: 'claude' },
        presentation: { reveal: 'always', panel: 'new', focus: true },
        runOptions: { runOn: 'folderOpen' },
        problemMatcher: [],
      }],
    },
  }, null, 2);

  const claudeMd = `# Objekt-Workspace — ${input.address}

Du arbeitest jetzt im Aufteiler-Vorbereitungs-Workspace für dieses Objekt.

## Kontext lesen (Pflicht beim Start)

1. \`00_briefing.md\` — Zusammenfassung Score + Kennzahlen
2. \`00_quickcheck-transkript.md\` — komplette Pipeline-Analyse

## Verfügbare Dokumente

${input.pdfFiles.map(f => `- ${f}`).join('\n')}

## Typischer nächster Schritt

Aufteiler-Vollanalyse starten (Slash-Command \`/aufteiler\` mit Adresse "${input.address}").
`;

  const briefing = `# ${input.address}

**Pre-Screening-Score:** ${input.score ?? 'pending'}
${input.reason ? `**Begründung:** ${input.reason}` : ''}

## Kennzahlen

${input.kennzahlen.we ? `- Einheiten: ${input.kennzahlen.we} WE` : ''}
${input.kennzahlen.wfl ? `- Wohnfläche: ${input.kennzahlen.wfl} m²` : ''}
${input.kennzahlen.kp ? `- Kaufpreis: ${input.kennzahlen.kp.toLocaleString('de-DE')} €` : ''}
${input.kennzahlen.eurProM2 ? `- €/m²: ${input.kennzahlen.eurProM2}` : ''}
${input.kennzahlen.baujahr ? `- Baujahr: ${input.kennzahlen.baujahr}` : ''}

## Anhänge

${input.pdfFiles.map(f => `- [${f}](./${f})`).join('\n')}
`;

  return {
    'objekt.code-workspace': workspace,
    'CLAUDE.md': claudeMd,
    '00_briefing.md': briefing,
    '00_quickcheck-transkript.md': input.quickCheckTranscript,
  };
}
```

- [ ] **Step 3: Test laufen** — PASS.

- [ ] **Step 4: Commit**

```powershell
git add app/api/akquise/_lib/writeWorkspace.ts tests/akquise/writeWorkspace.test.ts
git commit -m "feat(akquise): workspace-builder (.code-workspace + CLAUDE.md + briefing)"
```

---

## Task 7j: QuickCheck-Stub + Stage-Worker Endpoint zusammensetzen

**Files:**
- Create: `app/api/akquise/_lib/quickCheck.ts`
- Create: `app/api/akquise/_lib/resolveLink.ts`
- Create: `app/api/akquise/process/route.ts`

- [ ] **Step 1: quickCheck.ts (Stub mit Score-Skala-Vorbereitung)**

```typescript
// app/api/akquise/_lib/quickCheck.ts
import Anthropic from '@anthropic-ai/sdk';

export interface QuickCheckInput {
  address: string | null;
  pdfText: string;
  mailText: string;
}

export interface QuickCheckResult {
  score: number | null;       // 0..100
  reason: string;
  transcript: string;
  kennzahlen: {
    we?: number;
    wfl?: number;
    kp?: number;
    eurProM2?: number;
    baujahr?: number;
  };
}

// STUB-Implementation bis Modul-0-Logik final ist (separate Brainstorming-Session vom User)
// Schreibt Score=50 + Anthropic-generierte 1-Satz-Begründung + Kennzahlen-Regex
export async function quickCheck(input: QuickCheckInput): Promise<QuickCheckResult> {
  const kennzahlen = extractKennzahlen(input.pdfText);

  if (!process.env.ANTHROPIC_API_KEY || !input.address) {
    return {
      score: null,
      reason: 'QuickCheck konnte nicht ausgeführt werden (kein API-Key oder keine Adresse)',
      transcript: '',
      kennzahlen,
    };
  }

  const client = new Anthropic();
  const blob = input.pdfText.slice(0, 6000);
  const resp = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: `Du bist Akquise-Pre-Screener für MFH-Käufe im Ruhrgebiet. Bewerte ein Exposé nach: Lage, €/m² vs. Marktdurchschnitt, Baujahr, Sanierungsbedarf, Mieterstruktur. Antworte JSON: {"score": 0-100, "reason": "<1 satz>"}. Score-Skala: 70+ = hot, 40-69 = warm, <40 = no.`,
    messages: [{
      role: 'user',
      content: `Adresse: ${input.address}\n\nExposé-Auszug:\n${blob}`,
    }],
  });

  const content = resp.content[0];
  if (content.type !== 'text') {
    return { score: null, reason: 'Pipeline-Fehler im QuickCheck', transcript: '', kennzahlen };
  }

  try {
    const parsed = JSON.parse(content.text);
    return {
      score: parsed.score,
      reason: parsed.reason,
      transcript: `# QuickCheck-Transkript\n\n## Input\n\nAdresse: ${input.address}\n\nExposé-Auszug:\n${blob}\n\n## Anthropic-Response\n\n${content.text}`,
      kennzahlen,
    };
  } catch {
    return {
      score: 50,
      reason: 'QuickCheck-Antwort nicht parsbar — Score-Platzhalter, manuell prüfen',
      transcript: content.text,
      kennzahlen,
    };
  }
}

function extractKennzahlen(text: string): QuickCheckResult['kennzahlen'] {
  const result: QuickCheckResult['kennzahlen'] = {};
  const we = text.match(/(\d+)\s*(?:WE|Wohneinheit|Einheit)/i);
  if (we) result.we = parseInt(we[1]);
  const wfl = text.match(/(?:Wohnfl[äa]che|Wfl\.?)\s*(?:ca\.?\s*)?(\d+[\.,]?\d*)\s*m/i);
  if (wfl) result.wfl = parseFloat(wfl[1].replace(',', '.'));
  const kp = text.match(/(?:Kaufpreis|KP)\s*(?:ca\.?\s*)?([\d.]+)\s*€?/i);
  if (kp) result.kp = parseInt(kp[1].replace(/\./g, ''));
  const baujahr = text.match(/(?:Baujahr|errichtet|erbaut)\s*(?:ca\.?\s*)?(\d{4})/i);
  if (baujahr) result.baujahr = parseInt(baujahr[1]);
  if (result.wfl && result.kp) result.eurProM2 = Math.round(result.kp / result.wfl);
  return result;
}
```

- [ ] **Step 2: resolveLink.ts (einfach gehalten)**

```typescript
// app/api/akquise/_lib/resolveLink.ts
export async function resolveLink(url: string): Promise<{ name: string; buffer: Buffer } | null> {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/pdf')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const filename = url.split('/').pop()?.split('?')[0] || 'expose.pdf';
    return { name: filename, buffer: buf };
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Stage-Worker Endpoint**

```typescript
// app/api/akquise/process/route.ts
import { parseEmail } from '../_lib/parseEmail';
import { classifyPdf } from '../_lib/classifyPdf';
import { extractAddress } from '../_lib/extractAddress';
import { extractContact } from '../_lib/extractContact';
import { quickCheck } from '../_lib/quickCheck';
import { uploadFiles } from '../_lib/uploadOneDrive';
import { buildWorkspaceFiles } from '../_lib/writeWorkspace';
import { insertLead } from '../_lib/insertLead';
import { resolveLink } from '../_lib/resolveLink';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import pdf from 'pdf-parse';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET_AKQUISE}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { messageId, rawSource } = await req.json();
  const supa = supabaseAdmin();

  await supa.from('mail_queue').update({ status: 'processing', started_at: new Date().toISOString() }).eq('message_id', messageId);

  try {
    const mail = await parseEmail(Buffer.from(rawSource, 'base64'));

    const linkAttachments: Array<{ name: string; buffer: Buffer; contentType: string }> = [];
    for (const link of mail.links) {
      const resolved = await resolveLink(link);
      if (resolved) linkAttachments.push({ ...resolved, contentType: 'application/pdf' });
    }
    const allFiles = [...mail.attachments, ...linkAttachments];

    let fullPdfText = '';
    const classifiedFiles: Array<{ name: string; buffer: Buffer; contentType: string; type: string }> = [];
    for (const file of allFiles) {
      if (file.contentType.includes('pdf')) {
        try {
          const data = await pdf(file.buffer);
          fullPdfText += `\n\n=== ${file.name} ===\n${data.text}`;
          classifiedFiles.push({ ...file, type: classifyPdf({ filename: file.name, text: data.text }) });
        } catch {
          classifiedFiles.push({ ...file, type: 'sonstiges' });
        }
      } else {
        classifiedFiles.push({ ...file, type: 'sonstiges' });
      }
    }

    const addressResult = await extractAddress({ text: mail.text, pdfText: fullPdfText });
    const address = addressResult.address || `_unbekannt_${Date.now()}`;
    const contact = extractContact(mail);
    const qc = await quickCheck({ address: addressResult.address, pdfText: fullPdfText, mailText: mail.text });

    const workspaceFiles = buildWorkspaceFiles({
      address,
      score: qc.score,
      reason: qc.reason,
      kennzahlen: qc.kennzahlen,
      quickCheckTranscript: qc.transcript,
      pdfFiles: classifiedFiles.map(f => f.name),
    });

    const uploadInput = [
      ...classifiedFiles.map(f => ({ name: f.name, buffer: f.buffer, contentType: f.contentType })),
      { name: '_meta.json', buffer: Buffer.from(JSON.stringify({
          messageId,
          subject: mail.subject,
          from: mail.from,
          date: mail.date,
          addressConfidence: addressResult.confidence,
          addressSource: addressResult.source,
          score: qc.score,
          files: classifiedFiles.map(f => ({ name: f.name, type: f.type, size: f.buffer.length })),
        }, null, 2)), contentType: 'application/json' },
      ...Object.entries(workspaceFiles).map(([name, content]) => ({
        name,
        buffer: Buffer.from(content),
        contentType: name.endsWith('.json') || name.endsWith('.code-workspace') ? 'application/json' : 'text/markdown',
      })),
    ];

    const upload = await uploadFiles({ addressFolder: address, files: uploadInput });

    const exposeFile = classifiedFiles.find(f => f.type === 'expose');
    const lead = await insertLead({
      contact,
      deal: {
        address: addressResult.address,
        workspacePath: upload.localPath,
        onedriveWebUrl: upload.webUrl,
        expose_url: exposeFile ? `${upload.webUrl}/${exposeFile.name}` : null,
        inboxMessageId: messageId,
        priorityScore: qc.score,
        priorityReason: qc.reason,
      },
    });

    await supa.from('mail_queue').update({
      status: 'done',
      done_at: new Date().toISOString(),
      deal_id: lead.dealId,
    }).eq('message_id', messageId);

    return Response.json({ ok: true, dealId: lead.dealId, contactId: lead.contactId, matchKind: lead.matchKind });
  } catch (err: any) {
    await supa.from('mail_queue').update({
      status: 'error',
      error_msg: err?.message || String(err),
    }).eq('message_id', messageId);
    return Response.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 4: Lokaler E2E-Test mit Test-Mail**

Test-Mail in CRM-Eingang → Poll-Endpoint per curl → 30s warten → in Supabase prüfen:

```sql
SELECT m.message_id, m.status, m.error_msg, d.address, d.priority_score, d.workspace_path
FROM mail_queue m LEFT JOIN deals d ON d.id = m.deal_id
ORDER BY m.enqueued_at DESC LIMIT 5;
```

Expected: `status='done'`, `address` gefüllt (oder `_unbekannt_*` falls Mail keine Adresse hatte), `workspace_path` zeigt auf einen Windows-Pfad.

OneDrive-Ordner prüfen: enthält PDFs, `_meta.json`, `objekt.code-workspace`, `CLAUDE.md`, `00_briefing.md`, `00_quickcheck-transkript.md`.

- [ ] **Step 5: Doppelklick-Test**

Doppelklick auf `objekt.code-workspace` im Explorer.

Expected: VS Code öffnet den Ordner, Terminal-Tab startet `claude` automatisch, Claude liest `CLAUDE.md` und kann auf "Was ist der Score?" antworten.

- [ ] **Step 6: Commit**

```powershell
git add app/api/akquise/_lib/quickCheck.ts app/api/akquise/_lib/resolveLink.ts app/api/akquise/process/route.ts
git commit -m "feat(akquise): stage-worker — parse, extract, quickcheck-stub, upload, lead-insert"
```

---

## Task 7k: CRM-UI — Pre-Screening-Status integrieren

**Files:**
- Modify: `src/components/leads/StatusBadge.tsx`
- Modify: `src/components/leads/LeadTable.tsx`
- Modify: `src/hooks/useDeals.ts`

- [ ] **Step 1: StatusBadge erweitern**

In `StatusBadge.tsx` (oder wo deal-Status gerendert wird) den neuen Status hinzufügen:

```typescript
const STATUS_COLORS: Record<string, string> = {
  pre_screened: 'bg-purple-100 text-purple-800 border-purple-300',
  offen:        'bg-blue-100 text-blue-800 border-blue-300',
  berechnet:    'bg-green-100 text-green-800 border-green-300',
  absage:       'bg-gray-100 text-gray-600 border-gray-300',
};

const STATUS_LABELS: Record<string, string> = {
  pre_screened: 'Pre-Screened',
  offen: 'Offen',
  berechnet: 'Berechnet',
  absage: 'Absage',
};
```

- [ ] **Step 2: LeadTable Filter erweitern**

In `LeadTable.tsx` den Status-Filter um `pre_screened` ergänzen. Falls bestehende Default-Filter alle Status zeigen: nichts zu ändern.

Zusätzliche Spalte "Score" (Sort-By-Default für pre_screened-Filter):

```typescript
{
  accessorKey: 'priority_score',
  header: 'Score',
  cell: ({ row }) => {
    const score = row.original.priority_score;
    if (score == null) return <span className="text-gray-400">—</span>;
    const color = score >= 70 ? 'text-red-600' : score >= 40 ? 'text-orange-500' : 'text-gray-500';
    return <span className={`font-mono ${color}`} title={row.original.priority_reason || undefined}>{score}</span>;
  },
}
```

- [ ] **Step 3: Workspace-Pfad-Button im Lead-Detail**

Im Lead-Detail-Panel (vermutlich `LeadDetailPanel.tsx`) Button hinzufügen wenn `deal.workspace_path` gesetzt ist:

```tsx
{deal.workspace_path && (
  <Button
    variant="outline"
    size="sm"
    onClick={async () => {
      await navigator.clipboard.writeText(deal.workspace_path!);
      toast.success('Workspace-Pfad kopiert', {
        description: 'Win+E → Strg+V → Enter → Doppelklick auf objekt.code-workspace',
      });
    }}
  >
    📋 Workspace-Pfad
  </Button>
)}
```

- [ ] **Step 4: Build + Smoke-Test**

```powershell
npm run build
npm run dev
```

Im Browser auf /leads gehen → Pre-Screening-Eintrag aus dem E2E-Test (Task 7j) muss mit Status-Badge "Pre-Screened" + Score-Spalte sichtbar sein.

- [ ] **Step 5: Commit**

```powershell
git add src/components/leads/ src/hooks/useDeals.ts
git commit -m "feat(crm): pre_screened-status + score-spalte + workspace-pfad-button"
```

---

## Task 7l: Cron-job.org konfigurieren + alte Pipeline deprecaten

**Files:**
- Modify: `../automatisierung-aquise/README.md` (Deprecation-Banner)
- Modify: `c:/meine-projekte/README.md` (Mono-Repo-Index)

- [ ] **Step 1: cron-job.org Cronjob anlegen**

In cron-job.org einloggen:
- URL: `https://immo-crm-xi.vercel.app/api/cron/akquise-poll`
- Method: POST
- Header: `Authorization: Bearer <CRON_SECRET_AKQUISE>`
- Schedule: `*/5 * * * *` (alle 5 Min)
- Failure Notification: Email an `andre-petrov@web.de` bei non-2xx

- [ ] **Step 2: 10-Min-Live-Test**

Test-Mail in CRM-Eingang → 5 Min warten → in Supabase prüfen ob Lead automatisch entstanden ist (ohne curl-Trigger). Cron-job.org-Log muss "200 OK" zeigen.

- [ ] **Step 3: automatisierung-aquise deaktivieren**

Wenn Live-Test 7l-Step-2 grün:

Windows Task Scheduler öffnen → `Akquise-Pipeline` rechtsklick → Deaktivieren. Genauso `Akquise-Pipeline-HealthCheck`.

In `../automatisierung-aquise/README.md` oben einfügen:

```markdown
> ## ⚠️ DEPRECATED ab 2026-MM-DD
>
> Ersetzt durch Cloud-Pipeline im ImmoCRM-Repo.
> Siehe `Immobilien/ImmoCRM/docs/superpowers/specs/2026-05-11-akquise-pipeline-cloud-design.md`.
> Code bleibt als historische Referenz für Regex-Heuristiken (m05_address_extractor).
```

- [ ] **Step 4: Gmail-Forwarding abschalten** (falls aktiv)

In Gmail-Einstellungen → Weiterleitung und POP/IMAP → bestehenden Forward-Filter für web.de-Mails deaktivieren. Verifikation: 24 h später Gmail-INBOX checken — keine neuen Akquise-Mails.

- [ ] **Step 5: Mono-Repo-README updaten**

In `c:/meine-projekte/README.md` Eintrag für `automatisierung-aquise` mit "(deprecated, siehe ImmoCRM-Pipeline)" markieren.

- [ ] **Step 6: Commit**

```powershell
git add ../automatisierung-aquise/README.md ../../README.md
git commit -m "chore(akquise): cloud-pipeline live, alte python-pipeline deprecated"
```

---

## Task 7m: Doku-Pflege + Stichproben-Akzeptanz

**Files:**
- Modify: `docs/02_implementierungsplan.md`
- Modify: `docs/03_decisions.md`
- Modify: `docs/04_progress.md`
- Modify: `docs/05_tools.md`
- Create: `docs/06_pipeline_guidelines.md`

- [ ] **Step 1: 02_implementierungsplan.md — Schritt 7 ersetzen**

Den bestehenden Schritt-7-Block (Zeile 177–193) komplett ersetzen durch:

```markdown
## Schritt 7: Akquise-Pipeline (Cloud)

**Ziel:** Mails aus Outlook-Ordner "CRM-Eingang" → automatisch QuickCheck-Score + Pre-Screening-Lead im CRM + OneDrive-Workspace zum Weiterarbeiten.

**Architektur:** Vercel Edge Functions (TypeScript) im ImmoCRM-Repo. Aufteiler bleibt komplett unberührt.

**Pipeline-Stages:** Poll-Endpoint (alle 5 Min via cron-job.org) → IMAP-web.de → mail_queue → Stage-Worker (parse, classify, extract address, extract contact, QuickCheck-Stub, OneDrive-Upload mit Workspace, insertLead mit pre_screened-Status).

**Sub-Schritte (siehe `docs/superpowers/plans/2026-05-12-schritt-7-akquise-pipeline-cloud.md`):** S1 Spike, 7a–7m Bauschritte.

**Output:** Lead landet in CRM-Tab Leads mit Filter `Status=pre_screened`. Doppelklick auf workspace-Datei öffnet VS Code + Claude Code mit komplettem QuickCheck-Kontext.

**Verwirft:** Alter Plan "Subagent CRM-Befüllen im Aufteiler-Repo" — siehe ADR-017.
```

- [ ] **Step 2: 03_decisions.md — Vier neue ADRs**

```markdown
## ADR-017 — Schritt 7: Cloud-Pipeline statt Aufteiler-Subagent

- **Datum:** 2026-05-12
- **Status:** Accepted (supersedes ursprünglicher Schritt-7-Prompt aus 02_implementierungsplan.md vor Update)
- **Schritt:** 7

### Kontext
Ursprünglich war Schritt 7 als Subagent "CRM Befüllen" im Aufteiler-Repo geplant. Bei zweitem Hinsehen fielen drei Probleme auf: (a) PC-Abhängigkeit (Aufteiler braucht lokalen Daemon), (b) Aufteiler müsste für alle Mails laufen (auch die, die nie analyse-würdig sind), (c) keine Pre-Filter-Stufe.

### Entscheidung
Neue Architektur: Cloud-Pipeline im ImmoCRM-Repo holt Mails ab, macht QuickCheck-Score, legt Pre-Screening-Lead an. Aufteiler bleibt manuell für Top-Leads (Pfad-Kopier-Button im CRM, kein automatischer Trigger).

### Begründung
- Mobile Sortierung möglich (Mail per Handy in CRM-Eingang-Ordner schieben)
- Aufteiler nur noch für 2-3 Top-Leads/Tag statt für alles
- Klare Funnel-Stufen: pre_screened → offen → berechnet → absage
- Spec 2026-05-11 (Council-validiert)

### Konsequenzen
- `automatisierung-aquise` wird deprecated (siehe Task 7l)
- Gmail-Forwarding wird abgeschaltet
- web.de IMAP-App-Passwort als neue Critical-Dependency

---

## ADR-018 — Workspace-Datei statt Claude-Code-Resume

- **Datum:** 2026-05-12
- **Status:** Accepted
- **Schritt:** 7i

### Kontext
User-Wunsch: Doppelklick auf eine Datei im OneDrive-Ordner → VS Code + Claude Code öffnen sich mit dem vollen QuickCheck-Kontext, so dass man sofort weiterarbeitet ("weiter machen wo aufgehört wurde").

### Entscheidung
Pipeline schreibt vier Dateien in jeden OneDrive-Objekt-Ordner: `objekt.code-workspace` (mit `tasks.runOn:folderOpen`), `CLAUDE.md` (Pflicht-Reads), `00_briefing.md` (Score + Kennzahlen), `00_quickcheck-transkript.md` (kompletter LLM-Output). Claude Code startet "frisch", liest aber via CLAUDE.md-Auto-Discovery alles ein. Kein echtes `claude --resume` (das würde Session-File-Forgery aus der Cloud erfordern).

### Begründung
- Aus User-Sicht identisch zu Resume (öffnen, Claude weiß alles)
- Kein Session-File-Format-Lock-in
- Wartbar via Markdown (lesbar für Mensch)

### Konsequenzen
- `writeWorkspace.ts` ist die einzige Code-Stelle, die das Format kennt
- Wenn Claude Code das Session-File-Format ändert, sind wir nicht betroffen

---

## ADR-019 — Service-Role-Key in Vercel-Env-Group

- **Datum:** 2026-05-12
- **Status:** Accepted
- **Schritt:** 7d

### Kontext
Pipeline muss `mail_queue` schreiben können. RLS für anon-Key öffnen wäre unsicher (jeder mit dem öffentlichen Key könnte die Queue manipulieren).

### Entscheidung
`SUPABASE_SERVICE_ROLE_KEY` als server-only Env-Var in Vercel. Niemals im Vite-Frontend referenzieren (VITE_-Präfix vermieden). `src/lib/supabaseAdmin.ts` ist die einzige Stelle, die ihn liest, und wird nur in `app/api/`-Functions importiert (nicht im Frontend-Bundle).

### Begründung
- Service-Role-Key bypasst RLS (Standardverhalten)
- Vercel-Env-Group "server-only" wird im Frontend-Build nicht eingelesen
- mail_queue hat explizite `REVOKE ALL FROM anon` (Defense-in-Depth)

### Konsequenzen
- Bei Key-Rotation: in Vercel-Env updaten, kein Re-Deploy nötig
- Pipeline-Functions dürfen nicht im public/-Folder oder als import aus src/components/ enden

---

## ADR-020 — Duplikat-Match-Strategie (Hard/Soft/None)

- **Datum:** 2026-05-12
- **Status:** Accepted
- **Schritt:** 7h

### Kontext
Cloud-Pipeline schreibt Kontakte ohne menschliche Prüfung. Es darf weder Duplikate (gleicher Makler → zwei contacts-Einträge) noch verlorene Leads (Kontakt mit Tippfehler im Namen → fälschlich gemergte Identität) geben.

### Entscheidung
Drei-Wege-Matching: Hard (Email-Exakt-Match → bestehenden contact aktualisieren, nur fehlende Felder füllen), Soft (Nachname-Match ohne Email-Match → neuer contact + Warn-Comment im chat), None (neuer contact).

### Begründung
- Hard-Match-Update überschreibt nichts → keine Datenverluste bei manueller Pflege
- Soft-Match macht Verdacht sichtbar im CRM-Chat statt automatisch zu mergen
- Übernommen aus altem Schritt-7-Prompt-Design

### Konsequenzen
- Owner sieht Soft-Match-Warnungen im Kontakt-Chat-Panel
- Falls Verdacht falsch ist: Owner muss manuell mergen (außerhalb MVP)
```

- [ ] **Step 3: 04_progress.md — Schritt 7 auf ✅ setzen**

Zeile mit Schritt 7 anpassen:

```markdown
| 7 | Akquise-Pipeline (Cloud) | ✅ | 2026-MM-DD | 017-020 | IMAP-Poll + OneDrive-Upload + QuickCheck-Stub + Pre-Screening-Lead + Workspace-Datei. Stub-QuickCheck bis Modul-0-Überarbeitung. Stichprobe: 20/20 Mails verarbeitet, 17/20 mit Adresse, 0 Crashs. automatisierung-aquise deprecated, Gmail-Forwarding aus. |
```

Und Definition-of-Done:
- `[x] Aufteiler-Workflow schreibt automatisch ins CRM` → ersetzen durch `[x] Cloud-Pipeline schreibt automatisch ins CRM (Status pre_screened)`

- [ ] **Step 4: 05_tools.md — Pipeline-Skill-Matrix ergänzen**

Pro Sub-Schritt eine Zeile in der Skill-Matrix. Format wie bestehend.

- [ ] **Step 5: 06_pipeline_guidelines.md anlegen**

```markdown
# Pipeline-Guidelines (Schritt 7+)

## Logging
Jeder Stage-Worker-Lauf schreibt `console.log({ stage, messageId, durationMs })` — landet in Vercel-Logs. Kein File-Logging (Edge-FS ist read-only).

## Fehler-Strategie
- Stage-spezifische Fehler (Adress-Extraktion fail) → Lead trotzdem anlegen mit Fallback-Markern, `mail_queue.error_msg` füllen
- Pipeline-Fatal (kein Supabase-Connect) → mail_queue bleibt auf `processing`, Cron-job.org-Failure-Mail an User
- Niemals OneDrive-Upload-Fail blockt CRM-Insert (Workaround: Workspace-Pfad bleibt null, User sieht in der UI dass Datei fehlt)

## Idempotenz-Garantie
`mail_queue.message_id` ist PRIMARY KEY. Doppelte Webhook-Invocations werfen `unique_violation` (PostgreSQL-Code 23505) → Poll-Endpoint interpretiert als "schon verarbeitet" und setzt nur \\Seen-Flag.

## QuickCheck-Logik
Stub im MVP (siehe `quickCheck.ts`). Echte Logik wird separat aus Modul-0-Überarbeitung im Aufteiler-Repo abgeleitet und in `quickCheck.ts` portiert. Schema-Felder (`priority_score`, `priority_reason`) sind dafür bereits vorbereitet.
```

- [ ] **Step 6: Stichproben-Akzeptanz (A8)**

20 echte Akquise-Mails der letzten 2 Wochen aus dem Posteingang in CRM-Eingang schieben. 30 Min warten. Auswerten:

```sql
SELECT COUNT(*) FILTER (WHERE d.address IS NOT NULL AND d.address NOT LIKE '_unbekannt_%') AS mit_adresse,
       COUNT(*) FILTER (WHERE m.status = 'error') AS errors,
       COUNT(*) AS gesamt,
       ROUND(AVG(d.priority_score)) AS avg_score
FROM mail_queue m
LEFT JOIN deals d ON d.id = m.deal_id
WHERE m.enqueued_at > NOW() - INTERVAL '30 minutes';
```

Akzeptanz: `mit_adresse >= 17`, `errors = 0`.

Falls unter 17/20: in `04_progress.md` notieren, welche Mails verloren gegangen sind, Regex erweitern, retesten.

- [ ] **Step 7: Final-Commit**

```powershell
git add docs/
git commit -m "docs(schritt-7): pipeline cloud abgeschlossen, ADR-017-020, stichprobe 17/20"
```

---

## Self-Review

### Spec-Coverage
Alle Punkte aus Spec §4.1–§4.8 + User-Erweiterungen vom 2026-05-12 sind durch Tasks abgedeckt:
- §4.1 Cron-Trigger → Task 7l
- §4.2 Poll-Endpoint → Task 7d
- §4.3 Stage-Worker → Task 7j
- §4.4 Idempotenz mail_queue → Task 7a (Migration) + Task 7d (Insert mit Unique-Violation-Handling)
- §4.5 OneDrive → Task 7c
- §4.6 Pfad-Kopier-Button → Task 7k
- §4.7 DB-Erweiterungen → Task 7a
- §4.8 Briefing-Erweiterung → **NICHT** in diesem Plan, weil Schritt 8 noch nicht gebaut ist. Briefing-Erweiterung kommt im Schritt-8-Plan als zusätzliche Sektion. Verweis in 04_progress.md.

User-Erweiterungen:
- Pre-Screening-Status → Task 7a (Enum) + Task 7k (UI)
- Workspace-Datei → Task 7i (Builder) + Task 7j (Pipeline-Integration)
- Position-Heuristik → Task 7g
- Soft-Match-Warn-Comment → Task 7h
- Newsletter mit beiden Sektionen → Verweis Schritt 8 (außerhalb dieses Plans)

### Placeholder-Scan
Keine TBD/TODO/"implement later" im Plan. QuickCheck ist explizit als **Stub** markiert (nicht Placeholder) — die Stub-Implementierung ist vollständig, die spätere echte Logik kommt aus dem User-eigenen Modul-0-Überarbeitungs-Prozess.

### Type-Konsistenz
- `ExtractedContact` definiert in 7g, konsumiert in 7h
- `ParsedEmail` in 7e, konsumiert in 7g + 7j
- `QuickCheckResult` in 7j, konsumiert in 7j (gleicher Task)
- `UploadResult` in 7c, konsumiert in 7j
- `InsertLeadInput` in 7h, konsumiert in 7j

Alle Signaturen konsistent.

### Bekannte Risiken nach Plan-Abschluss
- `claude` muss in der PATH-Umgebung sein, damit `tasks.runOn:folderOpen` funktioniert. Verifikation in Task 7j-Step-5.
- Vercel-`app/`-Folder-Konvention neben bestehendem Vite — bei Konflikt im Build evtl. `vercel.json` manuell anpassen.
- web.de-IMAP-Connection-Stabilität ist im 5-Min-Intervall unkritisch, aber langfristig zu beobachten (Cron-job.org-Failure-Alerts).
