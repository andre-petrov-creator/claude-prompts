# Schritt 7 — Akquise-Pipeline Cloud (ImmoCRM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cloud-Pipeline baut, die Mails aus dem M365-Ordner "CRM-Eingang" in Echtzeit via Microsoft-Graph-Webhook empfängt, PDFs in OneDrive ablegt, einen QuickCheck-Score samt Begründung erzeugt, das Objekt als Pre-Screening-Lead ins CRM schreibt, einen Doppelklick-Workspace im Ordner ablegt (öffnet VS Code + Claude Code mit vollem QuickCheck-Kontext) und das Daily-Briefing um eine Pre-Screening-Sektion erweitert.

**Architektur:**
- Vercel Edge Function (TypeScript) auf bestehendem ImmoCRM-Vercel-Projekt
- web.de leitet Akquise-Mails automatisch an `appv@appv7878.onmicrosoft.com` weiter → Outlook-Regel verschiebt nach Ordner `CRM-Eingang`
- Microsoft-Graph-Subscription auf `CRM-Eingang` → Echtzeit-POST an `/api/akquise/webhook` → fire-and-forget `/api/akquise/process` (Stage-Worker pro Mail)
- Subscription-Renewal täglich via Vercel-Cron (`/api/cron/renew-subscription`)
- Idempotenz via `mail_queue.message_id` PRIMARY KEY
- Aufteiler-Workflow bleibt **unverändert** — nur das CRM bekommt Pre-Screening-Status

**Tech-Stack:** TypeScript · `@microsoft/microsoft-graph-client` + `@azure/msal-node` · `pdf-parse` · `@anthropic-ai/sdk` · Supabase REST · Vercel Edge Runtime

**Quellen:**
- Spec: `docs/superpowers/specs/2026-05-11-akquise-pipeline-cloud-design.md`
- **Hinweis 2026-05-12:** Spec 2026-05-11 beschrieb IMAP-Polling auf web.de. Plan wurde am 2026-05-12 auf Microsoft Graph Webhook umgestellt (Mailbox `appv@appv7878.onmicrosoft.com`, web.de leitet weiter). Siehe ADR-021.
- Übernommene Heuristiken aus altem Schritt-7-Prompt: Position-Erkennung (GF/Inhaber/Makler), Soft-Match-Warn-Comment, fail-safe-CRM-Schreibfehler
- Workspace-Mechanik: `.code-workspace` + `tasks.runOn:folderOpen` + Ordner-`CLAUDE.md` + `00_briefing.md` (kein echtes Claude-Code-Resume — gleiche Funktion, einfacher)

---

## File Structure

**Neu im ImmoCRM-Repo:**

```
app/                                                  (NEUE TOP-LEVEL — bisher Vite-SPA ohne app/-Folder)
└── api/
    ├── cron/
    │   └── renew-subscription/route.ts               Täglicher Cron: Graph-Subscription erneuern
    └── akquise/
        ├── webhook/route.ts                          Empfängt Graph-Notifications (POST + Validation-GET)
        ├── process/route.ts                          Stage-Worker pro Mail
        └── _lib/
            ├── fetchMail.ts                          Lädt Mail + Attachments via Graph API
            ├── parseEmail.ts                         Graph-Mail-JSON → PDF-Buffer + Links + Mailtext
            ├── resolveLink.ts                        Online-Link → PDF-Buffer
            ├── classifyPdf.ts                        Filename + Inhalt → typ
            ├── extractAddress.ts                     Regex + Anthropic-Fallback
            ├── extractContact.ts                     Name + Email + Firma + Position
            ├── uploadOneDrive.ts                     Microsoft Graph
            ├── msGraphClient.ts                      MSAL-Auth + Refresh-Token-Handling (OneDrive + Mail.Read)
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
├── 03_decisions.md                                   ADR-017 bis ADR-021
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

> **Hinweis 2026-05-12:** S1 ist historisch (ursprünglich IMAP-Variante-A-Validierung). Mit dem Refactor auf Microsoft Graph Webhook (ADR-021) ist der IMAP-Teil dieses Spikes obsolet — das OneDrive-Bootstrapping (Steps 5-6) bleibt aber relevant und wird im Refactor durch das erweiterte msGraphClient-Smoke-Test in Task 7c-Step-4 mitabgedeckt. Falls Spike noch nicht ausgeführt wurde: direkt zu Task S2 + Task 7c springen.

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

Bei GO: weiter zu Task S2.
Bei NO-GO (web.de blockiert IMAP-Apps): STOPP, separate Brainstorming-Session für Variante B.

---

### Task S2: web.de → M365 Auto-Forward + Outlook-Regel einrichten (manuell, blockierend)

**Files:** keine — manuelle Konfiguration in web.de Webmail + Outlook

**Ziel:** Akquise-Mails landen physisch im M365-Postfach im Ordner `CRM-Eingang`, damit Microsoft-Graph-Webhook abonniert werden kann.

- [ ] **Step 1: web.de Auto-Forward konfigurieren**

In https://web.de einloggen → Einstellungen → E-Mail → Filterregeln (oder "Weiterleitung") → Neue Regel:
- Bedingung: "Alle eingehenden Mails"
- Aktion: "Weiterleiten an `appv@appv7878.onmicrosoft.com`"
- Option: "Kopie im web.de-Posteingang behalten" AKTIVIEREN (so dass web.de auch noch die Mail hat)

- [ ] **Step 2: M365-Ordner `CRM-Eingang` anlegen**

In Outlook (Desktop oder web.outlook.com) im M365-Postfach `appv@appv7878.onmicrosoft.com`:
Rechtsklick auf Posteingang → "Neuer Ordner" → Name `CRM-Eingang` → Enter

- [ ] **Step 3: Outlook-Regel anlegen**

In Outlook → Regeln → Neue Regel:
- Bedingung: "From-Adresse enthält `andre-petrov@web.de`"
- Aktion: "Verschieben in Ordner CRM-Eingang"
- Aktion: "Als gelesen markieren" NICHT aktivieren (Pipeline filtert per Idempotenz, nicht per Gelesen-Status)

- [ ] **Step 4: Test-Mail**

Test-Mail an `andre-petrov@web.de` schicken (z.B. von einer anderen Adresse). Innerhalb von 30s sollte sie in M365 → CRM-Eingang erscheinen.

Wenn nicht: web.de-Forward-Regel + Outlook-Regel-Bedingungen debuggen.

- [ ] **Step 5: Tenant-ID + Mailbox-ID notieren**

Für spätere Verwendung in Task 7c:
- Tenant-ID: aus entra.microsoft.com → Übersicht → Verzeichnis-ID
- Mailbox-Email: `appv@appv7878.onmicrosoft.com`

Akzeptanz: Mail an web.de landet via Forward + Outlook-Regel innerhalb 30s in M365-Ordner CRM-Eingang.

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
  message_id        text PRIMARY KEY,
  graph_message_id  text,
  status            text NOT NULL CHECK (status IN ('pending', 'processing', 'done', 'error')),
  enqueued_at       timestamptz NOT NULL DEFAULT now(),
  started_at        timestamptz,
  done_at           timestamptz,
  error_msg         text,
  deal_id           uuid REFERENCES deals(id) ON DELETE SET NULL
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
npm install @microsoft/microsoft-graph-client @azure/msal-node pdf-parse @anthropic-ai/sdk mailparser
npm install -D @types/mailparser
```

(`mailparser` bleibt als Toolbox-Dep für etwaige eml-Spezialfälle, primäres Mail-Parsing läuft aber über Graph-JSON in Task 7e.)

Expected: Installation läuft durch, `package.json` enthält die neuen Deps.

- [ ] **Step 2: .env.example ergänzen**

In `.env.example` am Ende anfügen:

```bash
# ============================================================
# Akquise-Pipeline (Schritt 7) — nur in Vercel-Env, nicht lokal nötig
# ============================================================

# Microsoft Graph Webhook-Validation (clientState für Graph-Subscription, ersetzt CRON_SECRET_AKQUISE)
MS_GRAPH_WEBHOOK_CLIENT_STATE=  # zufälliger String, wird beim Subscription-Erstellen mitgegeben und mit jedem Webhook-Push zurückgesendet

# Microsoft Graph (OneDrive-Upload + Mail-Read)
MS_GRAPH_CLIENT_ID=
MS_GRAPH_CLIENT_SECRET=
MS_GRAPH_TENANT_ID=  # spezifische Tenant-ID aus entra.microsoft.com (NICHT 'common', wir sind Single-Tenant)
MS_GRAPH_REFRESH_TOKEN=  # einmalig per OAuth-Flow geholt, danach automatisch verlängert
MS_GRAPH_USER_EMAIL=andre-petrov@example.com  # OneDrive-Owner
MS_GRAPH_MAILBOX_EMAIL=appv@appv7878.onmicrosoft.com  # M365-Postfach, auf dessen CRM-Eingang-Ordner Subscription läuft

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
    "app/api/akquise/webhook/route.ts": {
      "maxDuration": 30
    },
    "app/api/akquise/process/route.ts": {
      "maxDuration": 60
    },
    "app/api/cron/renew-subscription/route.ts": {
      "maxDuration": 30
    }
  },
  "crons": [
    { "path": "/api/cron/renew-subscription", "schedule": "0 6 * * *" }
  ]
}
```

(Vercel-internen Cron für Subscription-Renewal täglich 6 Uhr UTC = 7 Uhr Berlin-Zeit; Push-Eingang läuft via Microsoft-Graph-Webhook, kein externer Cron-Provider nötig.)

- [ ] **Step 4: CLAUDE.md ergänzen — Pipeline-Hinweis**

In `CLAUDE.md` unter "Workflow-Integration" ersetzen:

ALT:
```
Bestehender Cloud-Code-Workflow `Automation Akquise` wird um Subagent **"CRM Befüllen"** ergänzt (Schritt 7). Der Subagent schreibt nach erfolgreicher Kalkulation direkt via Supabase REST API ins CRM (Duplikat-Check Email + Name).
```

NEU:
```
**Akquise-Pipeline (Schritt 7, Cloud):** Mails aus M365-Ordner `CRM-Eingang` (Postfach `appv@appv7878.onmicrosoft.com`, gespeist via web.de-Auto-Forward + Outlook-Regel) werden in Echtzeit via Microsoft-Graph-Webhook empfangen, PDFs nach OneDrive hochgeladen, QuickCheck-Score erzeugt und als Lead mit Status `pre_screened` im CRM angelegt. Aufteiler bleibt unberührt — manueller Trigger via "Ordner-Pfad-kopieren"-Button im CRM. Details: `docs/superpowers/specs/2026-05-11-akquise-pipeline-cloud-design.md`, ADR-021.
```

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json .env.example vercel.json CLAUDE.md
git commit -m "chore(akquise): deps + env-vars für pipeline"
```

---

## Task 7c: MS-Graph-Auth + OneDrive-Helper + Mail-Read

**Files:**
- Create: `app/api/akquise/_lib/msGraphClient.ts`
- Create: `app/api/akquise/_lib/uploadOneDrive.ts`
- Create: `tests/akquise/msGraphClient.test.ts`

- [ ] **Step 1: Initial-Refresh-Token via OAuth-Flow holen (einmalig)**

Lokales One-Time-Script `scripts/oauth-bootstrap.mjs`:

```javascript
import { ConfidentialClientApplication } from '@azure/msal-node';
import readline from 'readline';

const SCOPES = ['Files.ReadWrite.All', 'Mail.Read', 'offline_access', 'User.Read'];

const app = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.MS_GRAPH_CLIENT_ID,
    clientSecret: process.env.MS_GRAPH_CLIENT_SECRET,
    authority: `https://login.microsoftonline.com/${process.env.MS_GRAPH_TENANT_ID}`,
  },
});

const url = await app.getAuthCodeUrl({
  scopes: SCOPES,
  redirectUri: 'http://localhost:3000/auth/callback',
});
console.log('Öffne im Browser:\n', url);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Code aus URL nach Redirect: ', async (code) => {
  const token = await app.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: 'http://localhost:3000/auth/callback',
  });
  console.log('Refresh-Token (in Vercel als MS_GRAPH_REFRESH_TOKEN setzen):');
  console.log(token.account);
  // MSAL speichert Refresh-Token im Cache — manuell aus tokenCache exportieren
  console.log(app.getTokenCache().serialize());
  rl.close();
});
```

**Wichtig:**
- Authority MUSS auf den spezifischen Tenant lauten (`https://login.microsoftonline.com/<TENANT_ID>`, NICHT `common`), weil wir Single-Tenant-App machen
- Redirect-URI bleibt `http://localhost:3000/auth/callback`
- `Mail.Read` deckt das Lesen einzelner Mails + Subscription-Bezug auf Mailfolder ab (für Mail-Body + Attachments)

Run einmal lokal, Refresh-Token aus Cache-Output extrahieren, in Vercel-Env-Group als `MS_GRAPH_REFRESH_TOKEN` setzen. Script danach wegwerfen.

- [ ] **Step 2: msGraphClient.ts — Token-Refresh-Wrapper**

```typescript
// app/api/akquise/_lib/msGraphClient.ts
import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';

// Zentrale Scope-Definition — OneDrive-Upload + Mail-Read teilen sich denselben Token
export const GRAPH_SCOPES = ['Files.ReadWrite.All', 'Mail.Read', 'offline_access'];

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const app = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MS_GRAPH_CLIENT_ID!,
      clientSecret: process.env.MS_GRAPH_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.MS_GRAPH_TENANT_ID}`,
    },
  });

  const result = await app.acquireTokenByRefreshToken({
    refreshToken: process.env.MS_GRAPH_REFRESH_TOKEN!,
    scopes: GRAPH_SCOPES,
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
import { graphClient } from '../app/api/akquise/_lib/msGraphClient.ts';

// OneDrive-Upload-Probe
const result = await uploadFiles({
  addressFolder: '_PIPELINE-SPIKE-' + Date.now(),
  files: [
    { name: 'hello.txt', buffer: Buffer.from('hi'), contentType: 'text/plain' },
  ],
});
console.log('OneDrive:', result);

// Mail-Read-Probe: bestätigt, dass der gleiche Token auch Mail.Read kann
const client = await graphClient();
const mailbox = process.env.MS_GRAPH_MAILBOX_EMAIL;
const messages = await client.api(`/users/${mailbox}/messages?$top=1`).get();
console.log('Mail-Probe (eine Mail-ID erwartet):', messages.value?.[0]?.id);
```

Run:
```powershell
node --experimental-vm-modules --import tsx scripts/test-onedrive-upload.mjs
```

(Falls tsx nicht installiert: `npm install -D tsx`)

Expected:
- Ordner `_PIPELINE-SPIKE-<timestamp>` erscheint im OneDrive, `hello.txt` ist drin, `localPath` zeigt einen Windows-Pfad, der sich per Explorer öffnen lässt.
- Mail-Probe gibt eine Mail-ID (`AAMkAG...`) aus → bestätigt Mail.Read-Scope auf der Mailbox.

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

## Task 7d: Graph-Webhook-Endpoint + Subscription-Renewal

**Files:**
- Create: `app/api/akquise/webhook/route.ts`            ← Empfängt Graph-Notifications
- Create: `app/api/akquise/_lib/fetchMail.ts`           ← Lädt eine Mail per Graph API
- Create: `app/api/cron/renew-subscription/route.ts`    ← Vercel-Cron: täglich Subscription erneuern
- Modify: `src/lib/supabaseAdmin.ts` (NEU)

### Wie Microsoft Graph Webhooks funktionieren (Kurz-Briefing)

1. Wir registrieren EINMALIG eine "Subscription" via Graph API: "Sag mir Bescheid wenn eine neue Mail im Ordner CRM-Eingang von Mailbox X kommt, schick die Benachrichtigung an URL Y"
2. Graph schickt POST an unsere Webhook-URL mit JSON wie:
   `{ "value": [{ "subscriptionId": "...", "changeType": "created", "resource": "users/.../messages/AAMkAG...", "resourceData": { "id": "AAMkAG..." } }] }`
3. **WICHTIG: Validation-Request beim Erstellen.** Bei Subscription-Anlage schickt Graph einmal einen GET mit `validationToken`-Query-Param. Endpoint muss diesen Token als Plain-Text mit 200 zurückgeben innerhalb 10s.
4. Subscription läuft max. 3 Tage für `/me/messages`, danach muss sie via PATCH erneuert werden. Daher der Renewal-Cron.

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

- [ ] **Step 2: fetchMail.ts**

```typescript
// app/api/akquise/_lib/fetchMail.ts
import { graphClient } from './msGraphClient';

export interface GraphMail {
  id: string;
  internetMessageId: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  toRecipients: Array<{ emailAddress: { name?: string; address: string } }>;
  receivedDateTime: string;
  body: { contentType: 'html' | 'text'; content: string };
  hasAttachments: boolean;
  inReplyTo?: string;
}

export interface GraphAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes: string; // base64
}

export async function fetchMail(mailboxEmail: string, messageId: string): Promise<GraphMail> {
  const client = await graphClient();
  return client.api(`/users/${mailboxEmail}/messages/${messageId}`).get();
}

export async function fetchAttachments(mailboxEmail: string, messageId: string): Promise<GraphAttachment[]> {
  const client = await graphClient();
  const res = await client.api(`/users/${mailboxEmail}/messages/${messageId}/attachments`).get();
  return res.value || [];
}
```

- [ ] **Step 3: Webhook-Endpoint**

```typescript
// app/api/akquise/webhook/route.ts
import { fetchMail } from '../_lib/fetchMail';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Graph-Subscription-Validation: bei Anlage einer Subscription macht Graph
// einen GET mit ?validationToken=...
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('validationToken');
  if (token) {
    return new Response(token, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  return new Response('Missing validationToken', { status: 400 });
}

// Eigentlicher Push: Graph schickt JSON mit value[]
export async function POST(req: Request) {
  // Validation-POST hat ?validationToken= im Query-String (mit text/plain Body)
  const url = new URL(req.url);
  const token = url.searchParams.get('validationToken');
  if (token) {
    return new Response(token, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const body = await req.json();
  if (!Array.isArray(body.value)) {
    return new Response('Invalid payload', { status: 400 });
  }

  const supa = supabaseAdmin();
  const mailbox = process.env.MS_GRAPH_MAILBOX_EMAIL!;

  for (const notification of body.value) {
    if (notification.clientState !== process.env.MS_GRAPH_WEBHOOK_CLIENT_STATE) {
      console.warn('Unauthorized webhook notification (clientState mismatch)');
      continue;
    }
    if (notification.changeType !== 'created') continue;

    const graphMessageId = notification.resourceData?.id;
    if (!graphMessageId) continue;

    const mail = await fetchMail(mailbox, graphMessageId);
    const messageId = mail.internetMessageId;

    const { error } = await supa.from('mail_queue').insert({
      message_id: messageId,
      graph_message_id: graphMessageId,
      status: 'pending',
    });

    if (error) {
      if (error.code === '23505') continue; // schon verarbeitet, idempotent skip
      throw error;
    }

    // Stage-Worker triggern (fire-and-forget)
    const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.SITE_URL;
    fetch(`${base}/api/akquise/process`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${process.env.MS_GRAPH_WEBHOOK_CLIENT_STATE}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ messageId, graphMessageId }),
    }).catch(() => {});
  }

  return Response.json({ ok: true });
}
```

- [ ] **Step 4: Subscription-Renewal-Cron**

```typescript
// app/api/cron/renew-subscription/route.ts
import { graphClient } from '../../akquise/_lib/msGraphClient';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.MS_GRAPH_WEBHOOK_CLIENT_STATE}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const client = await graphClient();
  const subs = await client.api('/subscriptions').get();

  const newExpiry = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const renewed: string[] = [];

  for (const sub of subs.value || []) {
    if (sub.notificationUrl?.includes('/api/akquise/webhook')) {
      await client.api(`/subscriptions/${sub.id}`).patch({ expirationDateTime: newExpiry });
      renewed.push(sub.id);
    }
  }

  return Response.json({ ok: true, renewed });
}
```

- [ ] **Step 5: vercel.json — Cron für Renewal**

Bereits in Task 7b/Step 3 konfiguriert (`crons`-Array enthält den Renewal-Eintrag mit `0 6 * * *`). Nochmals prüfen, dass die Datei den Stand aus 7b widerspiegelt.

- [ ] **Step 6: Lokaler Test des Webhook-Endpoints**

Webhook-Validation-Test:
```powershell
curl "http://localhost:3000/api/akquise/webhook?validationToken=abc123"
```
Expected: HTTP 200 mit Body `abc123` und Content-Type text/plain.

Webhook-POST-Test (fake payload):
```powershell
$body = '{"value":[{"subscriptionId":"test","changeType":"created","resourceData":{"id":"DUMMY-MSG-ID"},"clientState":"<dein-MS_GRAPH_WEBHOOK_CLIENT_STATE>"}]}'
curl -X POST http://localhost:3000/api/akquise/webhook -H "content-type: application/json" -d $body
```
Expected: 500 weil DUMMY-MSG-ID kein echtes Mail-ID ist — aber 401/403 darf NICHT kommen (das wäre clientState-Mismatch). Echter E2E-Test kommt in Task 7j.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/supabaseAdmin.ts app/api/akquise/_lib/fetchMail.ts app/api/akquise/webhook/route.ts app/api/cron/renew-subscription/route.ts vercel.json
git commit -m "feat(akquise): graph webhook endpoint + subscription renewal"
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

function loadFixture(name: string) {
  const raw = JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf-8'));
  // Attachment-contentBytes sind base64 — Test rekonstruiert nichts; parseEmail kümmert sich darum
  return raw;
}

describe('parseEmail', () => {
  it('extrahiert PDF-Anhänge', () => {
    const { mail, attachments } = loadFixture('graph-mail-with-pdf.json');
    const result = parseEmail(mail, attachments);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].name).toMatch(/\.pdf$/i);
    expect(result.attachments[0].buffer.length).toBeGreaterThan(100);
  });

  it('extrahiert Links aus Mailtext', () => {
    const { mail, attachments } = loadFixture('graph-mail-with-link.json');
    const result = parseEmail(mail, attachments);
    expect(result.links.length).toBeGreaterThan(0);
    expect(result.links[0]).toMatch(/^https?:\/\//);
  });

  it('liefert Subject + From', () => {
    const { mail, attachments } = loadFixture('graph-mail-with-pdf.json');
    const result = parseEmail(mail, attachments);
    expect(result.subject).toBeTruthy();
    expect(result.from.email).toMatch(/@/);
  });
});
```

- [ ] **Step 2: Fixtures anlegen**

JSON-Fixtures (Graph-API-Response-Beispiele) nach `tests/akquise/fixtures/` legen:

```
tests/akquise/fixtures/graph-mail-with-pdf.json    — Beispiel-Response mit PDF-Attachment
tests/akquise/fixtures/graph-mail-with-link.json
tests/akquise/fixtures/graph-mail-multi-pdf.json
```

Format:
```json
{
  "mail": {
    "id": "AAMkAGIxxx",
    "internetMessageId": "<abc123@web.de>",
    "subject": "Exposé MFH Dortmund",
    "from": { "emailAddress": { "name": "Hans Müller", "address": "h.mueller@immo.de" } },
    "toRecipients": [{ "emailAddress": { "address": "andre-petrov@web.de" } }],
    "receivedDateTime": "2026-05-12T10:00:00Z",
    "body": { "contentType": "html", "content": "<p>...</p>" },
    "hasAttachments": true
  },
  "attachments": [
    { "id": "AAxxx", "name": "Exposé.pdf", "contentType": "application/pdf", "size": 12345, "contentBytes": "<base64>" }
  ]
}
```

User erstellt die Fixtures manuell aus echten Graph-API-Responses während Task 7j-Test (z.B. via `client.api('/users/.../messages/<id>').get()` + `/attachments`).

- [ ] **Step 3: Test laufen — muss failen**

Run:
```powershell
npm test tests/akquise/parseEmail.test.ts
```

Expected: FAIL ("Cannot find module ...parseEmail").

- [ ] **Step 4: parseEmail.ts schreiben**

```typescript
// app/api/akquise/_lib/parseEmail.ts
import type { GraphMail, GraphAttachment } from './fetchMail';

export interface ParsedEmail {
  messageId: string;
  graphMessageId: string;
  subject: string;
  from: { name?: string; email: string };
  to: string[];
  date: Date;
  text: string;
  html: string;
  inReplyTo?: string;
  attachments: Array<{ name: string; contentType: string; buffer: Buffer }>;
  links: string[];
}

export function parseEmail(mail: GraphMail, attachments: GraphAttachment[]): ParsedEmail {
  const html = mail.body.contentType === 'html' ? mail.body.content : '';
  const text = mail.body.contentType === 'text' ? mail.body.content : htmlToText(html);
  const links = extractLinks(`${text}\n${html}`);

  return {
    messageId: mail.internetMessageId,
    graphMessageId: mail.id,
    subject: mail.subject || '',
    from: {
      name: mail.from?.emailAddress?.name,
      email: mail.from?.emailAddress?.address || '',
    },
    to: mail.toRecipients?.map(r => r.emailAddress.address) ?? [],
    date: new Date(mail.receivedDateTime),
    text,
    html,
    inReplyTo: mail.inReplyTo,
    attachments: attachments.map(a => ({
      name: a.name,
      contentType: a.contentType || 'application/octet-stream',
      buffer: Buffer.from(a.contentBytes, 'base64'),
    })),
    links,
  };
}

function htmlToText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractLinks(content: string): string[] {
  const re = /https?:\/\/[^\s"'<>)]+/g;
  return Array.from(new Set(content.match(re) || []));
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
import { fetchMail, fetchAttachments } from '../_lib/fetchMail';
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
  if (req.headers.get('authorization') !== `Bearer ${process.env.MS_GRAPH_WEBHOOK_CLIENT_STATE}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { messageId, graphMessageId } = await req.json();
  const mailbox = process.env.MS_GRAPH_MAILBOX_EMAIL!;
  const supa = supabaseAdmin();

  await supa.from('mail_queue').update({ status: 'processing', started_at: new Date().toISOString() }).eq('message_id', messageId);

  try {
    const [graphMail, attachments] = await Promise.all([
      fetchMail(mailbox, graphMessageId),
      fetchAttachments(mailbox, graphMessageId),
    ]);
    const mail = parseEmail(graphMail, attachments);

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

Test-Mail in CRM-Eingang verschieben (manuell in Outlook), Graph-Subscription (siehe Task 7l) muss live sein — Webhook trifft ein → 30s warten → in Supabase prüfen:

(Alternativ für lokales Mockup: Webhook-POST per curl mit echtem `graphMessageId` aus M365, siehe 7d-Step-6.)

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

## Task 7l: Graph-Subscription registrieren + automatisierung-aquise deprecaten

**Files:**
- Create: `scripts/setup-graph-subscription.mjs` (einmaliges Setup-Skript, gitignored über `scripts/setup-*.mjs`)
- Modify: `../automatisierung-aquise/README.md` (Deprecation-Banner)
- Modify: `c:/meine-projekte/README.md` (Mono-Repo-Index)

- [ ] **Step 0: Branch nach GitHub pushen für Vercel-Deploy**

```powershell
cd c:/meine-projekte
git push -u origin feat/schritt-7-akquise-pipeline
```

Vercel-GitHub-Integration deployt automatisch eine Preview-URL. Aus dem Vercel-Dashboard die Preview-URL kopieren (Format: `https://<projekt>-<hash>-<user>.vercel.app`).

- [ ] **Step 0a: Vercel-Env-Vars setzen**

Im Vercel-Dashboard → Projekt ImmoCRM → Settings → Environment Variables alle Variablen aus `.env.example`-Akquise-Block setzen (auch für Preview-Environment, nicht nur Production):

- `MS_GRAPH_CLIENT_ID`
- `MS_GRAPH_CLIENT_SECRET`
- `MS_GRAPH_TENANT_ID`
- `MS_GRAPH_MAILBOX_EMAIL` = `appv@appv7878.onmicrosoft.com`
- `MS_GRAPH_WEBHOOK_CLIENT_STATE` (zufälliger 64-Zeichen-String aus .env.local kopieren)
- `ONEDRIVE_BASE_PATH` = `/Immobilien/001_AQUISE/Objekte`
- `ONEDRIVE_LOCAL_PATH_PREFIX` (Windows-Pfad aus .env.local)
- `SUPABASE_SERVICE_ROLE_KEY` (aus Supabase-Dashboard → Project Settings → API → service_role key)
- `ANTHROPIC_API_KEY`

Werte aus `.env.local` per Copy-Paste übernehmen (Werte erscheinen NICHT in Logs).

- [ ] **Step 0b: Re-Deploy auslösen**

Nach Setzen der Env-Vars im Vercel-Dashboard: "Redeploy" auf den Preview-Build klicken, damit die neuen Variablen geladen werden.

- [ ] **Step 1: Subscription-Setup-Skript verfügbar machen**

Datei `scripts/setup-graph-subscription.mjs` ist Teil des Repos (aber gitignored — sie wurde lokal angelegt und ist nicht in Git). Falls die Datei fehlt (z.B. nach `git clone`): aus der Doku im Task-7l-Section des Plans kopieren oder über Claude Code neu erzeugen lassen.

Skript-Verhalten in 5 Stufen:
1. App-Only-Token holen (Client-Credentials, KEIN OAuth-Refresh-Token)
2. Folder-ID für `CRM-Eingang` per Graph-API lookup
3. Webhook-URL probe (validationToken-Echo)
4. Alte Subscriptions für dieselbe Notification-URL löschen
5. Neue Subscription mit 2 Tagen Laufzeit erstellen

- [ ] **Step 2: Vorbedingung — Vercel-Deployment muss live sein**

Bevor das Skript läuft, muss `app/api/akquise/webhook/route.ts` auf der Preview-URL deployed sein (sonst schlägt das interne Probe und Graphs Validation-Call fehl).

Verifiziere mit curl:
```powershell
curl "<vercel-preview-url>/api/akquise/webhook?validationToken=test"
```
Expected: HTTP 200 mit Body `test`.

- [ ] **Step 3: Subscription anlegen**

Im ImmoCRM-Repo-Root, PowerShell:

```powershell
$env:WEBHOOK_BASE_URL = "<die-vercel-preview-url>"
npx dotenv -e .env.local -- node scripts/setup-graph-subscription.mjs
```

Skript prüft Webhook-Erreichbarkeit, löscht alte Subscriptions für dieselbe Webhook-URL, legt neue an. Output: Subscription-ID + Expiration-Date.

Bei Fehler-Exit:
- `2`: Token-Abruf fehlgeschlagen → .env.local Werte prüfen
- `3-4`: Folder-Lookup fehlgeschlagen → CRM-Eingang-Ordner existiert nicht in `appv@`-Mailbox
- `5`: Webhook-URL antwortet nicht → Preview-Deploy noch nicht fertig oder Env-Vars fehlen
- `6`: Graph-API-Error → Body in Output lesen

- [ ] **Step 4: Live-Test**

Test-Mail an `andre-petrov@web.de` schicken → web.de forwarded → Outlook-Regel verschiebt nach CRM-Eingang → Graph schickt Webhook an Vercel → Lead erscheint im CRM (Status pre_screened).

Verifikation in Supabase:
```sql
SELECT message_id, graph_message_id, status, deal_id FROM mail_queue ORDER BY enqueued_at DESC LIMIT 5;
```

- [ ] **Step 5: automatisierung-aquise deaktivieren** (wenn Step 4 grün)

Windows Task Scheduler öffnen → `Akquise-Pipeline` rechtsklick → Deaktivieren. Genauso `Akquise-Pipeline-HealthCheck`.

In `../automatisierung-aquise/README.md` oben einfügen:
```markdown
> ## ⚠️ DEPRECATED ab 2026-MM-DD
>
> Ersetzt durch Cloud-Pipeline im ImmoCRM-Repo via Microsoft-Graph-Webhook.
> Siehe `Immobilien/ImmoCRM/docs/superpowers/specs/2026-05-11-akquise-pipeline-cloud-design.md`.
```

- [ ] **Step 6: Mono-Repo-README updaten**

In `c:/meine-projekte/README.md` Eintrag für `automatisierung-aquise` mit "(deprecated, siehe ImmoCRM-Pipeline)" markieren.

- [ ] **Step 7: Commit**

```powershell
git add ../automatisierung-aquise/README.md ../../README.md
git commit -m "chore(akquise): graph-webhook live, alte python-pipeline deprecated"
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

**Pipeline-Stages:** web.de-Auto-Forward + Outlook-Regel → M365-Ordner `CRM-Eingang` → Microsoft-Graph-Subscription → Webhook → mail_queue → Stage-Worker (fetchMail via Graph, parse, classify, extract address, extract contact, QuickCheck-Stub, OneDrive-Upload mit Workspace, insertLead mit pre_screened-Status). Subscription-Renewal täglich via Vercel-Cron.

**Sub-Schritte (siehe `docs/superpowers/plans/2026-05-12-schritt-7-akquise-pipeline-cloud.md`):** S1 Spike, S2 Forward+Outlook-Regel, 7a–7m Bauschritte.

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
- Microsoft Graph Webhook ermöglicht Echtzeit-Push (keine Polling-Latenz)
- Spec 2026-05-11 (Council-validiert)

### Konsequenzen
- `automatisierung-aquise` wird deprecated (siehe Task 7l)
- Gmail-Forwarding wird abgeschaltet
- Microsoft-Graph-Subscription auf M365-Postfach als neue Critical-Dependency (siehe ADR-021)

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

---

## ADR-021 — Microsoft Graph Webhook statt IMAP-Polling

- **Datum:** 2026-05-12
- **Status:** Accepted (ersetzt zwischenzeitliche Polling-Annahme aus Spec 2026-05-11)
- **Schritt:** 7d

### Kontext
Ursprünglich war IMAP-Polling auf web.de alle 5 Min via cron-job.org geplant. User hat eine M365-Business-Lizenz (Tenant appv7878.onmicrosoft.com) und will Echtzeit-Push.

### Entscheidung
Akquise-Mails werden via web.de-Auto-Forward + Outlook-Regel ins M365-Postfach in Ordner `CRM-Eingang` umgeleitet. Microsoft Graph Subscription auf diesen Ordner schickt Webhook bei neuer Mail an Vercel-Endpoint. Subscription wird täglich automatisch erneuert (3-Tages-Limit von Graph).

### Begründung
- Echtzeit-Reaktion (Sekunden statt 5 Min)
- Eine einzige Microsoft-Graph-Auth deckt OneDrive + Mail-Read ab
- Kein Drittanbieter (cron-job.org entfällt)
- Robuste Idempotenz via mail_queue.message_id PRIMARY KEY

### Konsequenzen
- web.de-Auto-Forward muss eingerichtet werden (Task S2)
- Outlook-Regel im M365-Postfach (Task S2)
- Graph-Subscription-Renewal-Cron täglich um 6 Uhr UTC (Vercel-internen Cron)
- imapflow-Dependency entfällt (Task 7b)
- mail_queue.imap_uid Spalte entfällt, mail_queue.graph_message_id Spalte hinzu (Task 7a)
```

- [ ] **Step 3: 04_progress.md — Schritt 7 auf ✅ setzen**

Zeile mit Schritt 7 anpassen:

```markdown
| 7 | Akquise-Pipeline (Cloud) | ✅ | 2026-MM-DD | 017-021 | Microsoft-Graph-Webhook + OneDrive-Upload + QuickCheck-Stub + Pre-Screening-Lead + Workspace-Datei. Stub-QuickCheck bis Modul-0-Überarbeitung. Stichprobe: 20/20 Mails verarbeitet, 17/20 mit Adresse, 0 Crashs. automatisierung-aquise deprecated, Gmail-Forwarding aus. |
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
- Pipeline-Fatal (kein Supabase-Connect) → mail_queue bleibt auf `processing`, in Vercel-Logs prüfen (oder Vercel-Log-Drain-Alert konfigurieren)
- Niemals OneDrive-Upload-Fail blockt CRM-Insert (Workaround: Workspace-Pfad bleibt null, User sieht in der UI dass Datei fehlt)

## Idempotenz-Garantie
`mail_queue.message_id` ist PRIMARY KEY (gefüttert aus `internetMessageId` der Graph-Mail). Doppelte Webhook-Notifications werfen `unique_violation` (PostgreSQL-Code 23505) → Webhook-Endpoint interpretiert als "schon verarbeitet" und überspringt das Enqueuen (siehe `app/api/akquise/webhook/route.ts`).

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
git commit -m "docs(schritt-7): pipeline cloud abgeschlossen, ADR-017-021, stichprobe 17/20"
```

---

## Self-Review

### Spec-Coverage
Alle Punkte aus Spec §4.1–§4.8 + User-Erweiterungen vom 2026-05-12 sind durch Tasks abgedeckt (Mail-Eingang via Microsoft-Graph-Webhook statt IMAP-Polling — siehe ADR-021):
- §4.1 Trigger → Task 7l (Graph-Subscription)
- §4.2 Eingangs-Endpoint → Task 7d (Webhook + Subscription-Renewal)
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
- Microsoft-Graph-Subscription läuft max. 3 Tage und wird täglich via Vercel-Cron erneuert. Bei Renewal-Fail (Token abgelaufen, Vercel-Cron-Outage): Subscription wird beim nächsten Lauf neu angelegt werden müssen (Skript aus Task 7l). Monitoring: Vercel-Logs auf `renew-subscription` checken.
- web.de-Auto-Forward + Outlook-Regel sind Konfigurations-Punkte außerhalb der Codebasis — bei Forward-Stop laufen keine Mails mehr in den CRM-Eingang-Ordner (Verifikation manuell durch User).
