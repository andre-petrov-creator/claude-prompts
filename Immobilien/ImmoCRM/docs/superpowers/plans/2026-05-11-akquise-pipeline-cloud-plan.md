# Akquise-Pipeline (Cloud) — Implementierungsplan

> **Für agentic worker:** Nutze `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans` zur Schritt-für-Schritt-Ausführung. Checkboxen-Syntax (`- [ ]`) für Tracking.

**Goal:** Eingehende Makler-Mails aus `andre-petrov@web.de` (Outlook-Subfolder "CRM-Eingang") werden automatisch in OneDrive abgelegt, mit einem QuickCheck-Score bewertet und im ImmoCRM als Lead angelegt — auch wenn der PC aus ist und der User mobil sortiert.

**Architecture:** Cloud-Variante A (siehe Spec §3): cron-job.org tickt alle 5 Min → Vercel Edge Function pollt web.de IMAP → enqueued in Supabase `mail_queue` → Stage-Worker (separate Vercel Function) verarbeitet pro Mail seriell (parse, classify, extract address, OneDrive-upload, QuickCheck, Lead-Insert). Trennung Poll vs. Stage-Worker wegen 60s-Vercel-Hobby-Limit.

**Tech Stack:** TypeScript (strict), Vercel Edge Functions, Supabase (Postgres + Service-Role-Key), `imapflow` (IMAP), `@microsoft/microsoft-graph-client` + `@azure/msal-node` (OneDrive), `pdf-parse` (PDF-Text), Anthropic SDK (Adress-Extract + QuickCheck), Vitest.

**Spec-Referenz:** [`docs/superpowers/specs/2026-05-11-akquise-pipeline-cloud-design.md`](../specs/2026-05-11-akquise-pipeline-cloud-design.md) (14 Sektionen, Council-Verdict integriert).

---

## Bauphilosophie (übernommen aus ImmoCRM-CLAUDE.md)

- **Atomar** — jeder Schritt 2–4 h, in einer Coding-Session abschließbar
- **TDD wo Logik nicht-trivial** — Tests zuerst (red), dann Implementation (green)
- **Conventional Commits** — `feat(akquise): ...`, `fix(akquise): ...`, `chore(akquise): ...`
- **Nach jedem Schritt:** `04_progress.md` markieren ✅ + Datum, ADRs in `03_decisions.md` ergänzen, Doku in `06_pipeline_guidelines.md` aktuell halten
- **Keine Schein-Robustheit** — nur Fehlerpfade, die real auftreten können
- **Bestand editieren** statt parallel anlegen (z.B. Lead-Liste-Component erweitern, nicht neue Component bauen)

---

## Schritt-Übersicht

| # | Schritt | Aufwand | Blocker | Output |
|---|---|---|---|---|
| **S1** | Spike: web.de IMAP + MS-Graph-Probe | 30 min – 1 h | — | GO/NO-GO Variante A, App-Passwort + Refresh-Token in Vercel Env |
| **S2** | QuickCheck + Priorisierung Brainstorming | 1–2 h (separate Session) | — | Spec-Erweiterung §8.1, B7 implementierbar |
| **S3** | DSGVO-Update ADR-009 | 30 min | — | Eintrag in `03_decisions.md` |
| **B1** | DB-Migrationen + Type-Regeneration | 1 h | S1 ✅ | `mail_queue` + `priority_score`-Spalten, `src/types/supabase.ts` aktuell |
| **B2** | Poll-Endpoint MVP | 2 h | B1 ✅ | IMAP-Login web.de funktioniert, Mails landen in `mail_queue` |
| **B3** | Stage-Worker Skeleton | 2 h | B2 ✅ | parseEmail + classifyPdf + Lead-Stub, E2E-Skeleton steht |
| **B4** | Adress-Extraktor (Regex + LLM-Fallback) | 3 h | B3 ✅ | Adresse landet in `deal.address`, Vitest-Tests grün |
| **B5** | OneDrive-Upload | 3 h | S1 ✅, B3 ✅ | PDFs landen in `001_AQUISE/Objekte/<Adresse>/` |
| **B6** | Link-Resolver | 2–3 h | B3 ✅ | Online-Exposé-Links werden zu PDFs |
| **B7** | QuickCheck-Modul | 3 h | S2 ✅, B4 ✅ | Score + Reason in `deals.priority_score` |
| **B8** | UI: Priority-Spalte + Pfad-Kopier-Button | 2 h | B1 ✅ (Migration B4 für score) | Lead-Liste sortiert nach Priority, Button kopiert OneDrive-Pfad |
| **B9** | Briefing-Erweiterung (Schritt 8 ImmoCRM) | 2 h | B7 ✅, B8 ✅ | Briefing-Mail enthält "Heute eingegangen" + "Top-5" |
| **B10** | E2E-Test mit 20 echten Mails | 2–3 h | B1–B9 ✅ | 17/20 Mails korrekt verarbeitet, Council-R1 abgedeckt |
| **B11** | Migration & Deaktivierung Altsystem | 30 min | B10 grün | Gmail-Forwarding aus, Task-Scheduler disabled, Repos sauber |

**Reihenfolge ist verbindlich** außer B5/B6 austauschbar. **B7 wartet auf S2** — bis dahin Stub.

---

# Vor-Spike-Schritte

## Schritt S1: Spike — web.de IMAP + MS-Graph-Probe

**Voraussetzung:** Keine — das ist der erste Schritt überhaupt.

**Ziel:** GO/NO-GO für Architektur-Variante A. Wenn web.de kein App-Passwort für IMAP anbietet, fällt die ganze Architektur — dann Spec auf Variante B (Forwarding) re-evaluieren.

**Files:**
- Create (lokal, nicht committen): `scratch/spike-imap.ts`, `scratch/spike-msgraph.ts`
- Modify: `docs/03_decisions.md` (ADR-011 anlegen)
- Modify: `docs/04_progress.md` (S1 ✅)

### Teil A — web.de IMAP

- [ ] **A.1: web.de App-Passwort generieren**
  - Browser → web.de Einstellungen → Sicherheit → App-Passwörter → Neu
  - Name: `ImmoCRM Pipeline`
  - Passwort in Passwort-Manager speichern (NICHT in `.env` commiten!)

- [ ] **A.2: Outlook-Ordner "CRM-Eingang" anlegen**
  - In Outlook (am PC): rechtsklick auf INBOX → Neuer Ordner → "CRM-Eingang"
  - Outlook syncen lassen (1–2 Min via IMAP)
  - Verifikation: in web.de-Webmail einloggen → Ordner muss dort sichtbar sein

- [ ] **A.3: Test-Script schreiben**
  ```ts
  // scratch/spike-imap.ts
  import { ImapFlow } from 'imapflow';

  const client = new ImapFlow({
    host: 'imap.web.de',
    port: 993,
    secure: true,
    auth: { user: 'andre-petrov@web.de', pass: process.env.WEBDE_APP_PASSWORD! },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock('CRM-Eingang');
  try {
    console.log('Mailbox-Status:', client.mailbox);
    for await (const msg of client.fetch('1:*', { envelope: true, uid: true, flags: true })) {
      console.log(msg.uid, msg.envelope.subject, [...msg.flags]);
    }
  } finally {
    lock.release();
    await client.logout();
  }
  ```

- [ ] **A.4: Ausführen**
  ```bash
  cd c:\meine-projekte\Immobilien\ImmoCRM
  npm i -D imapflow tsx
  WEBDE_APP_PASSWORD="<das app-passwort>" npx tsx scratch/spike-imap.ts
  ```
  Erwartung: Liste der Mails im Ordner (oder leer, wenn nichts drin). Login darf nicht fehlschlagen.

- [ ] **A.5: Bei Fehler dokumentieren**
  - `AUTHENTICATIONFAILED` → App-Passwort falsch oder web.de erlaubt App-Passwörter nicht
  - `NO Mailbox does not exist` → Ordner-Name falsch oder noch nicht via IMAP synct
  - **Wenn nicht lösbar in 30 Min → ADR-011 mit "Variante A blockiert" eintragen und auf Variante B-Brainstorming gehen**

### Teil B — Microsoft Graph (OneDrive)

- [ ] **B.1: Azure-AD-App-Registration**
  - https://portal.azure.com → Microsoft Entra ID → App registrations → New registration
  - Name: `ImmoCRM Pipeline`
  - Supported account types: "Personal Microsoft accounts only" (für privates OneDrive)
  - Redirect URI: `http://localhost:3000/auth/callback` (web)
  - **Client-ID, Tenant-ID** notieren
  - Certificates & secrets → New client secret → 24 Monate Gültigkeit → **Client-Secret** notieren
  - API permissions → Add: `Microsoft Graph` → Delegated → `Files.ReadWrite`, `offline_access` → Grant admin consent

- [ ] **B.2: Initial-OAuth-Flow (manuell, einmalig)**
  - Authorization-URL bauen (siehe Spec §4.5), im Browser öffnen
  - Mit `andre-petrov@...`-Microsoft-Konto einloggen
  - Callback liefert `code`-Parameter
  - Token-Endpoint mit `code` aufrufen → erhält `access_token` + **`refresh_token`**
  - **Refresh-Token in Passwort-Manager** speichern

- [ ] **B.3: Test-Script: PDF nach OneDrive hochladen**
  ```ts
  // scratch/spike-msgraph.ts
  import { Client } from '@microsoft/microsoft-graph-client';
  import { ConfidentialClientApplication } from '@azure/msal-node';
  import { readFileSync } from 'fs';

  const msal = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MS_CLIENT_ID!,
      clientSecret: process.env.MS_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}`,
    },
  });

  const tokenResult = await msal.acquireTokenByRefreshToken({
    refreshToken: process.env.MS_REFRESH_TOKEN!,
    scopes: ['Files.ReadWrite', 'offline_access'],
  });

  const graph = Client.init({
    authProvider: (done) => done(null, tokenResult!.accessToken),
  });

  const pdfBuffer = readFileSync('scratch/test.pdf');
  const result = await graph
    .api('/me/drive/root:/Immobilien/001_AQUISE/Objekte/Spike-Test/Expose.pdf:/content')
    .put(pdfBuffer);

  console.log('Upload OK:', result.webUrl);
  ```

- [ ] **B.4: Ausführen**
  ```bash
  npm i -D @microsoft/microsoft-graph-client @azure/msal-node isomorphic-fetch
  MS_CLIENT_ID=... MS_CLIENT_SECRET=... MS_TENANT_ID=... MS_REFRESH_TOKEN=... \
    npx tsx scratch/spike-msgraph.ts
  ```
  Erwartung: PDF erscheint in OneDrive unter `Immobilien/001_AQUISE/Objekte/Spike-Test/Expose.pdf` (manuell im OneDrive-Webclient checken)

### Teil C — Abschluss

- [ ] **C.1: ADR-011 in `03_decisions.md` anlegen**
  - Titel: "Mail-Source: web.de IMAP direkt (Variante A bestätigt)"
  - Status: Accepted | NO-GO
  - Inhalt: was im Spike funktioniert hat, welche Hostnamen/Ports/Scopes, welche Pakete

- [ ] **C.2: `.env.example` aktualisieren**
  ```
  # Akquise-Pipeline (Spike S1)
  WEBDE_IMAP_USER=andre-petrov@web.de
  WEBDE_IMAP_APP_PASSWORD=...
  MS_GRAPH_CLIENT_ID=...
  MS_GRAPH_CLIENT_SECRET=...
  MS_GRAPH_TENANT_ID=...
  MS_GRAPH_REFRESH_TOKEN=...
  ```

- [ ] **C.3: Spike-Files aufräumen**
  ```bash
  rm -rf scratch/
  git rm --cached scratch/ 2>/dev/null || true
  ```
  `scratch/` zu `.gitignore` hinzufügen.

- [ ] **C.4: Commit**
  ```bash
  git add docs/03_decisions.md docs/04_progress.md .env.example .gitignore
  git commit -m "$(cat <<'EOF'
  chore(akquise): Spike S1 — web.de IMAP + MS-Graph bestätigt

  Variante A geht: App-Passwort funktioniert, Microsoft-Graph-PUT
  schreibt PDFs ins persönliche OneDrive. ADR-011 dokumentiert.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

**Akzeptanzkriterium:** A.4 + B.4 erfolgreich gelaufen, ADR-011 mit Accepted. Bei NO-GO: dieser Plan wird gestoppt, neues Brainstorming für Variante B.

---

## Schritt S2: QuickCheck + Priorisierung Brainstorming

**Voraussetzung:** Keine — kann parallel zu S1 laufen.

**Ziel:** Spec §8.1 schließen — wie wird der QuickCheck-Score berechnet, welche Inputs zählen, wie ist die Skala, wie sieht die Begründung aus.

**Files:** Diese Session erzeugt einen Spec-Anhang, kein Code.
- Create: `docs/superpowers/specs/2026-05-11-quickcheck-priorisierung-design.md`
- Modify: `docs/superpowers/specs/2026-05-11-akquise-pipeline-cloud-design.md` (§8.1 als gelöst markieren, auf neuen Spec verweisen)

**Vorgehen:**

- [ ] **S2.1: Brainstorming-Session öffnen** (separater Claude-Chat oder Web-Claude)
  - Eingangsfrage: "Welche Faktoren machen einen Lead für mich lukrativ — kannst du die in 5 Bullets formulieren?"
  - Folge-Frage: "Welche von diesen Faktoren stehen typischerweise im Exposé?"
  - Daraus Bewertungs-Methode ableiten: Aufteiler-Light vs. eigene Formel vs. LLM-Bauchgefühl
- [ ] **S2.2: Output strukturieren** (Spec-Datei)
  - §1 Input-Felder aus dem Exposé (Pflicht + optional)
  - §2 Bewertungs-Methode (eine der drei oben)
  - §3 Score-Skala 0–100 + Schwellwerte
  - §4 Begründungs-Format (1 Satz, Template oder LLM-frei)
  - §5 CRM-Darstellung (Badge-Farbe, Sort, Filter)

- [ ] **S2.3: Commit**
  ```bash
  git add docs/superpowers/specs/2026-05-11-quickcheck-priorisierung-design.md \
          docs/superpowers/specs/2026-05-11-akquise-pipeline-cloud-design.md
  git commit -m "docs(akquise): QuickCheck-Logik definiert (S2)"
  ```

**Akzeptanzkriterium:** Spec-Datei existiert, B7 kann implementiert werden ohne weitere Klärung.

---

## Schritt S3: DSGVO-Update ADR-009

**Voraussetzung:** Keine.

**Ziel:** ADR-009 (DSGVO-Datenfluss) erweitern um den Pipeline-Datenfluss: web.de → Vercel (Frankfurt) → Anthropic (US) → OneDrive (MS-Tenant) → Supabase (Frankfurt).

**Files:**
- Modify: `docs/03_decisions.md` — ADR-009 von "Open" auf "Accepted" hochsetzen, Inhalt ausarbeiten

- [ ] **S3.1: AVV-Status prüfen**
  - Anthropic-Konsole: AVV im Plus/Team-Plan vorhanden? Wenn nicht: Upgrade?
  - Microsoft-Konto: AVV automatisch beim Microsoft-365-Plan
  - Supabase: AVV im Dashboard self-service

- [ ] **S3.2: ADR-009 ausarbeiten** (Inhalt: AVV-Status, Datenfluss, Auskunfts-/Löschrecht-Prozess)

- [ ] **S3.3: Commit**
  ```bash
  git add docs/03_decisions.md docs/04_progress.md
  git commit -m "docs(decisions): DSGVO-Datenfluss für Akquise-Pipeline (ADR-009)"
  ```

**Akzeptanzkriterium:** ADR-009 Status = Accepted, Auskunfts-/Löschrecht-Prozess dokumentiert.

---

# Bau-Schritte

## Schritt B1: DB-Migrationen + Type-Regeneration

**Voraussetzung:** S1 ✅

**Ziel:** Neue Tabelle `mail_queue` für Idempotenz + neue Spalten auf `deals` für Priorisierung. Types in `src/types/supabase.ts` aktuell.

**Files:**
- Create: `supabase/migrations/003_mail_queue.sql`
- Create: `supabase/migrations/004_deals_priority_score.sql`
- Modify: `src/types/supabase.ts` (regeneriert via CLI)
- Modify: `docs/04_progress.md`

### TDD-Steps

- [ ] **B1.1: Migration `003_mail_queue.sql` schreiben**
  ```sql
  -- supabase/migrations/003_mail_queue.sql
  CREATE TABLE mail_queue (
    message_id   text PRIMARY KEY,
    imap_uid     integer NOT NULL,
    status       text NOT NULL CHECK (status IN ('pending', 'processing', 'done', 'error')),
    enqueued_at  timestamptz NOT NULL DEFAULT now(),
    started_at   timestamptz,
    done_at      timestamptz,
    error_msg    text,
    deal_id      uuid REFERENCES deals(id) ON DELETE SET NULL
  );

  CREATE INDEX idx_mail_queue_status ON mail_queue(status);
  CREATE INDEX idx_mail_queue_started_at ON mail_queue(started_at) WHERE status = 'processing';

  -- RLS gemäß ADR-008-Pattern: nur Service-Role schreibt, Anon liest nichts
  ALTER TABLE mail_queue ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "service_full" ON mail_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
  ```

- [ ] **B1.2: Migration `004_deals_priority_score.sql` schreiben**
  ```sql
  -- supabase/migrations/004_deals_priority_score.sql
  ALTER TABLE deals
    ADD COLUMN priority_score    integer CHECK (priority_score BETWEEN 0 AND 100),
    ADD COLUMN priority_reason   text,
    ADD COLUMN expose_source     text NOT NULL DEFAULT 'manual'
       CHECK (expose_source IN ('manual', 'mail-pipeline', 'aufteiler')),
    ADD COLUMN inbox_message_id  text REFERENCES mail_queue(message_id) ON DELETE SET NULL;

  CREATE INDEX idx_deals_priority_score
    ON deals(priority_score DESC NULLS LAST)
    WHERE deleted_at IS NULL;
  ```

- [ ] **B1.3: Migration anwenden** (Supabase MCP oder CLI)
  - Per MCP: `mcp__supabase__apply_migration` mit Inhalt aus B1.1 + B1.2
  - Oder CLI: `supabase db push`

- [ ] **B1.4: Smoke-Test mit MCP**
  - `mcp__supabase__execute_sql`: `SELECT * FROM mail_queue LIMIT 1;` → empty result, kein Error
  - `mcp__supabase__execute_sql`: `INSERT INTO deals (...) VALUES (...); SELECT priority_score FROM deals WHERE id = ...;` → NULL

- [ ] **B1.5: Types regenerieren**
  ```bash
  supabase gen types typescript --project-id <projekt-id> > src/types/supabase.ts
  ```
  Verifikation: `git diff src/types/supabase.ts` zeigt neue Tabelle `mail_queue` + neue Spalten auf `deals`.

- [ ] **B1.6: TypeScript-Compile-Check**
  ```bash
  npm run build
  ```
  Expected: kein Error. Wenn bestehende Code-Stelle die neuen NOT-NULL-Felder erwartet (`expose_source`), kurz adjustieren.

- [ ] **B1.7: Commit**
  ```bash
  git add supabase/migrations/003_*.sql supabase/migrations/004_*.sql src/types/supabase.ts docs/04_progress.md
  git commit -m "$(cat <<'EOF'
  feat(akquise): DB-Migrationen für mail_queue + priority_score (B1)

  Tabelle mail_queue für Idempotenz, Spalten priority_score +
  priority_reason + expose_source + inbox_message_id auf deals.
  Types regeneriert.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

**Akzeptanzkriterium:** Migrations angewendet, Types aktuell, Build grün, `04_progress.md` zeigt B1 ✅.

---

## Schritt B2: Poll-Endpoint MVP

**Voraussetzung:** B1 ✅

**Ziel:** Vercel Edge Function `/api/cron/akquise-poll` loggt sich auf web.de IMAP ein, liest Ordner "CRM-Eingang", enqueued neue Mails in `mail_queue`. Noch KEINE Stage-Worker-Aufrufe.

**Files:**
- Create: `app/api/cron/akquise-poll/route.ts`
- Create: `app/api/akquise/_lib/imapClient.ts`
- Create: `app/api/akquise/_lib/mailQueue.ts`
- Create: `tests/akquise/mailQueue.test.ts`
- Modify: `package.json` (imapflow dependency, falls noch nicht aus S1)
- Modify: `.env.local` (lokal) und Vercel Env (production)

### TDD-Steps

- [ ] **B2.1: Test für `enqueueMail` und `isAlreadyProcessed` schreiben**
  ```ts
  // tests/akquise/mailQueue.test.ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import { enqueueMail, isAlreadyProcessed } from '@/app/api/akquise/_lib/mailQueue';
  import { supabaseAdmin } from '@/lib/supabase-admin';

  describe('mailQueue', () => {
    beforeEach(async () => {
      await supabaseAdmin.from('mail_queue').delete().neq('message_id', 'KEEP');
    });

    it('enqueueMail inserts new row with status=pending', async () => {
      await enqueueMail({ messageId: '<test1@web.de>', imapUid: 42 });
      const { data } = await supabaseAdmin
        .from('mail_queue')
        .select('*')
        .eq('message_id', '<test1@web.de>')
        .single();
      expect(data?.status).toBe('pending');
      expect(data?.imap_uid).toBe(42);
    });

    it('isAlreadyProcessed returns true for done', async () => {
      await supabaseAdmin.from('mail_queue').insert({
        message_id: '<test2@web.de>', imap_uid: 43, status: 'done',
      });
      expect(await isAlreadyProcessed('<test2@web.de>')).toBe(true);
    });

    it('enqueueMail on existing message_id is idempotent (no duplicate)', async () => {
      await enqueueMail({ messageId: '<test3@web.de>', imapUid: 44 });
      await enqueueMail({ messageId: '<test3@web.de>', imapUid: 44 });
      const { data } = await supabaseAdmin
        .from('mail_queue')
        .select('*')
        .eq('message_id', '<test3@web.de>');
      expect(data?.length).toBe(1);
    });
  });
  ```

- [ ] **B2.2: Tests laufen lassen (red)**
  ```bash
  npm run test -- tests/akquise/mailQueue.test.ts
  ```
  Expected: FAIL (Module fehlen noch)

- [ ] **B2.3: `mailQueue.ts` implementieren**
  ```ts
  // app/api/akquise/_lib/mailQueue.ts
  import { supabaseAdmin } from '@/lib/supabase-admin';

  export async function enqueueMail(args: { messageId: string; imapUid: number }): Promise<void> {
    const { error } = await supabaseAdmin
      .from('mail_queue')
      .insert({ message_id: args.messageId, imap_uid: args.imapUid, status: 'pending' });
    if (error && error.code !== '23505') throw error; // 23505 = unique_violation (idempotent)
  }

  export async function isAlreadyProcessed(messageId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
      .from('mail_queue')
      .select('status')
      .eq('message_id', messageId)
      .maybeSingle();
    return data?.status === 'done' || data?.status === 'error';
  }
  ```

- [ ] **B2.4: Tests laufen lassen (green)**
  ```bash
  npm run test -- tests/akquise/mailQueue.test.ts
  ```
  Expected: PASS

- [ ] **B2.5: `imapClient.ts` schreiben** (Wrapper für imapflow)
  ```ts
  // app/api/akquise/_lib/imapClient.ts
  import { ImapFlow } from 'imapflow';

  export async function withImap<T>(fn: (client: ImapFlow) => Promise<T>): Promise<T> {
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
    try {
      return await fn(client);
    } finally {
      await client.logout();
    }
  }
  ```

- [ ] **B2.6: Poll-Endpoint schreiben**
  ```ts
  // app/api/cron/akquise-poll/route.ts
  import { withImap } from '@/app/api/akquise/_lib/imapClient';
  import { enqueueMail, isAlreadyProcessed } from '@/app/api/akquise/_lib/mailQueue';

  export const runtime = 'nodejs'; // imapflow nicht edge-kompatibel
  export const maxDuration = 60;

  function authOk(req: Request): boolean {
    const auth = req.headers.get('authorization');
    return auth === `Bearer ${process.env.CRON_SECRET_AKQUISE}`;
  }

  export async function POST(req: Request): Promise<Response> {
    if (!authOk(req)) return new Response('Unauthorized', { status: 401 });

    const result = await withImap(async (client) => {
      const lock = await client.getMailboxLock('CRM-Eingang');
      try {
        const uids = await client.search({ seen: false }, { uid: true });
        let enqueued = 0;
        for (const uid of uids) {
          const msg = await client.fetchOne(uid, { envelope: true });
          if (!msg.envelope.messageId) continue;
          if (await isAlreadyProcessed(msg.envelope.messageId)) {
            await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
            continue;
          }
          await enqueueMail({ messageId: msg.envelope.messageId, imapUid: uid as number });
          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
          enqueued++;
        }
        return { enqueued, scanned: uids.length };
      } finally {
        lock.release();
      }
    });

    return Response.json(result);
  }
  ```

- [ ] **B2.7: Vercel Env setzen**
  ```bash
  vercel env add WEBDE_IMAP_USER production
  vercel env add WEBDE_IMAP_APP_PASSWORD production
  vercel env add CRON_SECRET_AKQUISE production  # openssl rand -hex 32
  ```

- [ ] **B2.8: Manueller Test gegen Production**
  ```bash
  curl -X POST -H "Authorization: Bearer $CRON_SECRET_AKQUISE" \
    https://immo-crm-xi.vercel.app/api/cron/akquise-poll
  ```
  Expected: `{ "enqueued": <N>, "scanned": <N> }` mit korrekter Anzahl. Mail in Outlook in "CRM-Eingang" verschieben → erneut curl → `enqueued: 1`.

- [ ] **B2.9: Commit**
  ```bash
  git add app/api/cron/akquise-poll app/api/akquise/_lib/imapClient.ts \
          app/api/akquise/_lib/mailQueue.ts tests/akquise/mailQueue.test.ts \
          package.json package-lock.json docs/04_progress.md
  git commit -m "$(cat <<'EOF'
  feat(akquise): Poll-Endpoint mit IMAP-Zugriff auf web.de (B2)

  cron-job.org tickt /api/cron/akquise-poll, Function liest
  Outlook-Ordner "CRM-Eingang" und enqueued neue Mails in
  mail_queue. Idempotenz via Message-ID-PK. Stage-Worker folgt
  in B3.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

**Akzeptanzkriterium:** Mail in "CRM-Eingang" verschieben → curl auf Poll-Endpoint → Mail erscheint in `mail_queue` mit `status='pending'`. IMAP-Flag `\Seen` auf der Mail gesetzt.

---

## Schritt B3: Stage-Worker Skeleton

**Voraussetzung:** B2 ✅

**Ziel:** Zweite Vercel Function `/api/akquise/process` arbeitet eine Mail aus `mail_queue` ab: parseEmail + classifyPdf + insertLead (mit Stub-Adresse). E2E-Skeleton steht, weitere Stages werden in B4–B7 angedockt.

**Files:**
- Create: `app/api/akquise/process/route.ts`
- Create: `app/api/akquise/_lib/parseEmail.ts`
- Create: `app/api/akquise/_lib/classifyPdf.ts`
- Create: `app/api/akquise/_lib/insertLead.ts`
- Create: `tests/akquise/parseEmail.test.ts`
- Create: `tests/akquise/classifyPdf.test.ts`
- Modify: `app/api/cron/akquise-poll/route.ts` (Trigger auf process-Endpoint)

### TDD-Steps

- [ ] **B3.1: Test für `parseEmail` schreiben**
  ```ts
  // tests/akquise/parseEmail.test.ts
  import { describe, it, expect } from 'vitest';
  import { parseEmail } from '@/app/api/akquise/_lib/parseEmail';
  import { readFileSync } from 'fs';

  describe('parseEmail', () => {
    it('extrahiert PDF-Anhänge', async () => {
      const raw = readFileSync('tests/fixtures/mail-with-pdf.eml');
      const result = await parseEmail(raw);
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].filename).toMatch(/expose/i);
      expect(result.attachments[0].contentType).toBe('application/pdf');
    });

    it('extrahiert Links aus HTML-Body', async () => {
      const raw = readFileSync('tests/fixtures/mail-with-link.eml');
      const result = await parseEmail(raw);
      expect(result.links).toContain('https://www.immobilienscout24.de/expose/12345');
    });

    it('Mail ohne PDF und ohne Link → leere Arrays', async () => {
      const raw = readFileSync('tests/fixtures/mail-text-only.eml');
      const result = await parseEmail(raw);
      expect(result.attachments).toEqual([]);
      expect(result.links).toEqual([]);
    });
  });
  ```

- [ ] **B3.2: Fixtures anlegen**
  - `tests/fixtures/mail-with-pdf.eml`, `mail-with-link.eml`, `mail-text-only.eml` — synthetische RFC-822-Mails (manuell oder via Mail-Client exportiert)

- [ ] **B3.3: Tests laufen lassen (red)**
  ```bash
  npm run test -- tests/akquise/parseEmail.test.ts
  ```

- [ ] **B3.4: `parseEmail.ts` implementieren**
  ```ts
  // app/api/akquise/_lib/parseEmail.ts
  import { simpleParser, ParsedMail } from 'mailparser';

  export interface ParsedAttachment {
    filename: string;
    contentType: string;
    content: Buffer;
  }

  export interface ParsedEmailResult {
    messageId: string;
    subject: string;
    from: string;
    date: Date;
    bodyText: string;
    bodyHtml: string;
    attachments: ParsedAttachment[];
    links: string[];
  }

  export async function parseEmail(rawSource: Buffer | string): Promise<ParsedEmailResult> {
    const parsed: ParsedMail = await simpleParser(rawSource);
    const linkRegex = /https?:\/\/[^\s"'<>]+/g;
    const bodyForLinks = (parsed.html || parsed.text || '') as string;
    const links = [...new Set((bodyForLinks.match(linkRegex) || []))];

    return {
      messageId: parsed.messageId || '',
      subject: parsed.subject || '',
      from: parsed.from?.text || '',
      date: parsed.date || new Date(),
      bodyText: parsed.text || '',
      bodyHtml: (parsed.html as string) || '',
      attachments: parsed.attachments
        .filter((a) => a.contentType === 'application/pdf')
        .map((a) => ({
          filename: a.filename || `unknown_${Date.now()}.pdf`,
          contentType: a.contentType,
          content: a.content,
        })),
      links,
    };
  }
  ```
  `npm i mailparser @types/mailparser`

- [ ] **B3.5: Tests grün → `classifyPdf` Test schreiben**
  ```ts
  // tests/akquise/classifyPdf.test.ts
  import { describe, it, expect } from 'vitest';
  import { classifyPdf } from '@/app/api/akquise/_lib/classifyPdf';

  describe('classifyPdf', () => {
    it.each([
      ['Exposé MFH Talstraße.pdf', 'expose'],
      ['Mieterliste_2025.pdf',     'mieterliste'],
      ['Energieausweis.pdf',       'energieausweis'],
      ['Modernisierung_2024.pdf',  'modernisierung'],
      ['Anhang.pdf',               'sonstiges'],
    ])('"%s" → %s', (filename, expected) => {
      expect(classifyPdf(filename).typ).toBe(expected);
    });
  });
  ```

- [ ] **B3.6: `classifyPdf.ts` implementieren** (Filename-Heuristik, gleich wie alter Python-`m04`)
  ```ts
  // app/api/akquise/_lib/classifyPdf.ts
  export type PdfTyp = 'expose' | 'mieterliste' | 'energieausweis' | 'modernisierung' | 'sonstiges';

  const PATTERNS: Array<[RegExp, PdfTyp]> = [
    [/expos[ée]/i,                       'expose'],
    [/miet(er)?(liste|matrix|auflist)/i, 'mieterliste'],
    [/energie(ausweis)?|epc/i,           'energieausweis'],
    [/modern|sanierung|renovierung/i,    'modernisierung'],
  ];

  export function classifyPdf(filename: string): { typ: PdfTyp; confidence: number } {
    for (const [pattern, typ] of PATTERNS) {
      if (pattern.test(filename)) return { typ, confidence: 1.0 };
    }
    return { typ: 'sonstiges', confidence: 0.5 };
  }
  ```

- [ ] **B3.7: `insertLead.ts` schreiben** (Stub — Adresse als Placeholder, wird in B4 ersetzt)
  ```ts
  // app/api/akquise/_lib/insertLead.ts
  import { supabaseAdmin } from '@/lib/supabase-admin';

  export interface LeadDraft {
    address: string | null;
    expose_local_path: string | null;
    expose_source: 'mail-pipeline';
    inbox_message_id: string;
    raw_subject: string;
    raw_from: string;
  }

  export async function insertLead(draft: LeadDraft): Promise<{ dealId: string }> {
    // Stub-Contact-Insert
    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .upsert({ name: draft.raw_from, email: draft.raw_from.match(/<(.+?)>/)?.[1] || draft.raw_from })
      .select()
      .single();

    const { data: deal, error } = await supabaseAdmin
      .from('deals')
      .insert({
        contact_id: contact!.id,
        status: 'offen',
        address: draft.address,
        expose_local_path: draft.expose_local_path,
        expose_source: draft.expose_source,
        inbox_message_id: draft.inbox_message_id,
      })
      .select()
      .single();

    if (error) throw error;
    return { dealId: deal.id };
  }
  ```

- [ ] **B3.8: Stage-Worker schreiben**
  ```ts
  // app/api/akquise/process/route.ts
  import { withImap } from '@/app/api/akquise/_lib/imapClient';
  import { parseEmail } from '@/app/api/akquise/_lib/parseEmail';
  import { insertLead } from '@/app/api/akquise/_lib/insertLead';
  import { supabaseAdmin } from '@/lib/supabase-admin';

  export const runtime = 'nodejs';
  export const maxDuration = 60;

  export async function POST(req: Request): Promise<Response> {
    if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET_AKQUISE}`)
      return new Response('Unauthorized', { status: 401 });

    const { messageId, imapUid } = await req.json();

    await supabaseAdmin
      .from('mail_queue')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('message_id', messageId);

    try {
      const rawSource = await withImap(async (client) => {
        const lock = await client.getMailboxLock('CRM-Eingang');
        try {
          const msg = await client.fetchOne(imapUid, { source: true }, { uid: true });
          return msg.source as Buffer;
        } finally { lock.release(); }
      });

      const parsed = await parseEmail(rawSource);
      // B4: extractAddress (jetzt: null als Stub)
      // B5: uploadOneDrive (jetzt: null als Stub)
      // B6: resolveLink (jetzt: skip)
      // B7: quickCheck (jetzt: null als Stub)

      const { dealId } = await insertLead({
        address: null, // B4 füllt
        expose_local_path: null, // B5 füllt
        expose_source: 'mail-pipeline',
        inbox_message_id: messageId,
        raw_subject: parsed.subject,
        raw_from: parsed.from,
      });

      await supabaseAdmin
        .from('mail_queue')
        .update({ status: 'done', done_at: new Date().toISOString(), deal_id: dealId })
        .eq('message_id', messageId);

      return Response.json({ ok: true, dealId });
    } catch (err) {
      await supabaseAdmin
        .from('mail_queue')
        .update({ status: 'error', error_msg: String(err) })
        .eq('message_id', messageId);
      throw err;
    }
  }
  ```

- [ ] **B3.9: Poll-Endpoint triggert Stage-Worker** (Erweiterung B2)
  ```ts
  // In app/api/cron/akquise-poll/route.ts, NACH dem Enqueue:
  void fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/akquise/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CRON_SECRET_AKQUISE}`,
    },
    body: JSON.stringify({ messageId: msg.envelope.messageId, imapUid: uid }),
  });
  ```

- [ ] **B3.10: Manueller E2E-Test**
  - Mail mit PDF in "CRM-Eingang" verschieben
  - cron-job.org tickt (oder curl manuell)
  - Within ~30s: Eintrag in `mail_queue` mit `status='done'` und `deal_id` gesetzt
  - Eintrag in `deals` mit `expose_source='mail-pipeline'`, address=NULL (B4 noch nicht da)

- [ ] **B3.11: Commit**
  ```bash
  git add app/api/akquise/process app/api/akquise/_lib/parseEmail.ts \
          app/api/akquise/_lib/classifyPdf.ts app/api/akquise/_lib/insertLead.ts \
          tests/akquise/ app/api/cron/akquise-poll/route.ts \
          package.json package-lock.json docs/04_progress.md
  git commit -m "$(cat <<'EOF'
  feat(akquise): Stage-Worker Skeleton mit parseEmail + classifyPdf (B3)

  Stage-Worker /api/akquise/process konsumiert mail_queue,
  parsed Mail, legt Lead-Stub an (Address+OneDrive folgen in B4+B5).
  Poll-Endpoint triggert Worker async via fetch.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

**Akzeptanzkriterium:** Mail mit PDF verschoben → E2E-Lauf bis Lead in CRM-Tabelle (mit address=NULL). `mail_queue.status='done'`. Tests grün.

---

## Schritt B4: Adress-Extraktor (Regex + LLM-Fallback)

**Voraussetzung:** B3 ✅

**Ziel:** PDF-Text aus Exposé extrahieren, Objekt-Adresse via Regex+Heuristik finden, bei Confidence <0.7 LLM-Fallback (Anthropic). Council-R1 (Parser-Qualität = Engpass) wird hier am stärksten adressiert.

**Files:**
- Create: `app/api/akquise/_lib/extractAddress.ts`
- Create: `app/api/akquise/_lib/anthropic.ts` (Wrapper mit Prompt-Caching)
- Create: `tests/akquise/extractAddress.test.ts`
- Modify: `app/api/akquise/process/route.ts` (Adress-Stage einfügen)
- Modify: `app/api/akquise/_lib/insertLead.ts` (Address verwenden)

### TDD-Steps

- [ ] **B4.1: Tests schreiben** (mind. 5 Test-Cases mit echten Exposé-Texten als Fixtures)
  ```ts
  // tests/akquise/extractAddress.test.ts
  import { describe, it, expect, vi } from 'vitest';
  import { extractAddress } from '@/app/api/akquise/_lib/extractAddress';

  describe('extractAddress (regex-only path)', () => {
    it('findet Adresse hinter "Anschrift"', async () => {
      const text = 'Anschrift\nTalstr. 10\n44137 Dortmund';
      const r = await extractAddress(text);
      expect(r.address).toBe('Talstr. 10, 44137 Dortmund');
      expect(r.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('ignoriert Makler-Adresse mit Trigger "Anbieter"', async () => {
      const text = 'Anbieter\nVon Poll\nMarktplatz 1\n45127 Essen\n\nObjekt\nKoppelstr 29\n44135 Dortmund';
      const r = await extractAddress(text);
      expect(r.address).toContain('Koppelstr');
    });

    it('return null bei keinem Treffer', async () => {
      const text = 'Lorem ipsum dolor sit amet';
      const r = await extractAddress(text);
      expect(r.address).toBeNull();
    });
  });

  describe('extractAddress (LLM-Fallback path)', () => {
    it('ruft Anthropic bei Confidence <0.7', async () => {
      const llmMock = vi.fn().mockResolvedValue({ address: 'Beispielstr 5, 44137 Dortmund' });
      const text = 'Objekt: irgendwo in Dortmund'; // regex versagt
      const r = await extractAddress(text, { llm: llmMock });
      expect(llmMock).toHaveBeenCalledOnce();
      expect(r.address).toContain('Beispielstr');
    });
  });
  ```

- [ ] **B4.2: Tests laufen (red)**

- [ ] **B4.3: `extractAddress.ts` implementieren** (Regex-First mit Trigger-Heuristik wie im alten Python-`m05`)
  ```ts
  // app/api/akquise/_lib/extractAddress.ts
  import { askAnthropic } from './anthropic';

  const OBJEKT_TRIGGER = /\b(lage|objekt|anschrift|standort|adresse)\b/i;
  const MAKLER_TRIGGER = /\b(makler|anbieter|kontakt|telefon|tel\.|@)\b/i;
  const ADDRESS_RE = /([A-ZÄÖÜ][a-zäöüß.-]+(?:\s[A-ZÄÖÜ][a-zäöüß.-]+)*\s+\d{1,4}[a-z]?)[,\s]+(\d{5})\s+([A-ZÄÖÜ][a-zäöüß-]+(?:\s[A-ZÄÖÜ][a-zäöüß-]+)*)/g;

  export interface AddressResult {
    address: string | null;
    confidence: number;
    source: 'regex' | 'llm' | 'none';
  }

  export async function extractAddress(
    text: string,
    deps: { llm?: (prompt: string) => Promise<{ address: string | null }> } = {},
  ): Promise<AddressResult> {
    const llm = deps.llm || ((p) => askAnthropic(p));
    const matches = [...text.matchAll(ADDRESS_RE)];
    if (matches.length === 0) return { address: null, confidence: 0, source: 'none' };

    const scored = matches.map((m) => {
      const context = text.slice(Math.max(0, m.index! - 80), m.index! + m[0].length + 80);
      let score = 0.5;
      if (OBJEKT_TRIGGER.test(context)) score += 0.4;
      if (MAKLER_TRIGGER.test(context)) score -= 0.4;
      return { address: `${m[1]}, ${m[2]} ${m[3]}`, score };
    });
    const best = scored.sort((a, b) => b.score - a.score)[0];

    if (best.score >= 0.7) return { address: best.address, confidence: best.score, source: 'regex' };

    // LLM-Fallback
    const llmResult = await llm(
      `Welches ist die Objekt-Adresse (NICHT Makler) in folgendem Exposé-Text?\nGib NUR die Adresse zurück im Format "Straße Nr, PLZ Stadt", oder "NULL" wenn unklar.\n\n---\n${text.slice(0, 4000)}`,
    );
    if (!llmResult.address) return { address: null, confidence: 0, source: 'none' };
    return { address: llmResult.address, confidence: 0.85, source: 'llm' };
  }
  ```

- [ ] **B4.4: `anthropic.ts` schreiben** (mit Prompt-Caching für system-Prompt)
  ```ts
  // app/api/akquise/_lib/anthropic.ts
  import Anthropic from '@anthropic-ai/sdk';

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const SYSTEM_ADDRESS_EXTRACT = [
    'Du extrahierst Objekt-Adressen aus deutschen Immobilien-Exposés.',
    'Du gibst NUR die Adresse zurück im Format "Straße Nr, PLZ Stadt", oder "NULL" wenn unklar.',
    'Du unterscheidest Objekt-Adresse von Makler-Adresse. Triggerworte für Objekt: "Lage", "Anschrift", "Standort". Triggerworte für Makler: "Anbieter", "Kontakt".',
  ].join('\n');

  export async function askAnthropic(userPrompt: string): Promise<{ address: string | null }> {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001', // schnell + günstig, ausreichend für Extraktion
      max_tokens: 100,
      system: [
        { type: 'text', text: SYSTEM_ADDRESS_EXTRACT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });
    const block = res.content[0];
    const raw = block.type === 'text' ? block.text.trim() : '';
    return { address: raw === 'NULL' ? null : raw };
  }
  ```

- [ ] **B4.5: Stage-Worker erweitern** (B3.8 ändern: Address-Stage einbauen)
  ```ts
  // In app/api/akquise/process/route.ts NACH parseEmail:
  let address: string | null = null;
  for (const att of parsed.attachments) {
    const { classifyPdf } = await import('@/app/api/akquise/_lib/classifyPdf');
    if (classifyPdf(att.filename).typ !== 'expose') continue;
    const { default: pdfParse } = await import('pdf-parse');
    const pdf = await pdfParse(att.content);
    const result = await extractAddress(pdf.text);
    if (result.address) { address = result.address; break; }
  }
  ```

- [ ] **B4.6: Tests grün + manueller E2E**
  - Mail mit Exposé-PDF verschieben → Lead bekommt korrekte Adresse
  - 5 echte Exposés testen (Council-R1)

- [ ] **B4.7: Commit**
  ```bash
  git add app/api/akquise/_lib/extractAddress.ts app/api/akquise/_lib/anthropic.ts \
          tests/akquise/extractAddress.test.ts app/api/akquise/process/route.ts \
          package.json package-lock.json docs/04_progress.md
  git commit -m "feat(akquise): Adress-Extraktor mit Regex + LLM-Fallback (B4)"
  ```

**Akzeptanzkriterium:** 5/5 manuell getestete Exposés liefern korrekte Adresse. Vitest-Tests grün.

---

## Schritt B5: OneDrive-Upload

**Voraussetzung:** S1-Teil-B ✅, B3 ✅

**Ziel:** PDFs + `_meta.json` werden in `/me/drive/root:/Immobilien/001_AQUISE/Objekte/<Adresse>/` hochgeladen. `expose_local_path` im Lead wird mit dem lokalen Windows-Pfad befüllt.

**Files:**
- Create: `app/api/akquise/_lib/msGraphClient.ts`
- Create: `app/api/akquise/_lib/uploadOneDrive.ts`
- Create: `tests/akquise/uploadOneDrive.test.ts` (mit MSW-Mock für Graph API)
- Modify: `app/api/akquise/process/route.ts` (Upload-Stage einbauen)
- Modify: `app/api/akquise/_lib/insertLead.ts` (expose_local_path setzen)

### TDD-Steps

- [ ] **B5.1: Test mit Mock-Graph-API**
  ```ts
  // tests/akquise/uploadOneDrive.test.ts
  import { describe, it, expect, vi } from 'vitest';
  import { uploadOneDriveFolder } from '@/app/api/akquise/_lib/uploadOneDrive';

  describe('uploadOneDriveFolder', () => {
    it('lädt PDF + _meta.json hoch, gibt Windows-Pfad zurück', async () => {
      const putMock = vi.fn().mockResolvedValue({ webUrl: 'https://...' });
      const result = await uploadOneDriveFolder({
        address: 'Talstr 10, 44137 Dortmund',
        files: [{ name: 'Exposé.pdf', content: Buffer.from('PDF') }],
        meta: { messageId: '<x>', from: 'X', subject: 'Y', timestamp: new Date().toISOString() },
        deps: { graphPut: putMock },
      });
      expect(putMock).toHaveBeenCalledWith(
        expect.stringContaining('Immobilien/001_AQUISE/Objekte/Talstr 10, 44137 Dortmund/Exposé.pdf'),
        expect.any(Buffer),
      );
      expect(result.localPath).toMatch(/^C:\\Users\\andre\\OneDrive.*Talstr 10/);
    });
  });
  ```

- [ ] **B5.2: `msGraphClient.ts` schreiben** (Refresh-Token → Access-Token cachen)
  ```ts
  // app/api/akquise/_lib/msGraphClient.ts
  import { ConfidentialClientApplication } from '@azure/msal-node';
  import { Client } from '@microsoft/microsoft-graph-client';

  let cached: { token: string; expiresAt: number } | null = null;

  async function getAccessToken(): Promise<string> {
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const msal = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.MS_GRAPH_CLIENT_ID!,
        clientSecret: process.env.MS_GRAPH_CLIENT_SECRET!,
        authority: `https://login.microsoftonline.com/${process.env.MS_GRAPH_TENANT_ID}`,
      },
    });
    const result = await msal.acquireTokenByRefreshToken({
      refreshToken: process.env.MS_GRAPH_REFRESH_TOKEN!,
      scopes: ['Files.ReadWrite', 'offline_access'],
    });
    cached = { token: result!.accessToken, expiresAt: Date.now() + 50 * 60 * 1000 };
    return cached.token;
  }

  export async function graphClient(): Promise<Client> {
    const token = await getAccessToken();
    return Client.init({ authProvider: (done) => done(null, token) });
  }

  export async function graphPut(path: string, content: Buffer): Promise<{ webUrl: string }> {
    const client = await graphClient();
    return client.api(path).put(content);
  }
  ```

- [ ] **B5.3: `uploadOneDrive.ts` schreiben**
  ```ts
  // app/api/akquise/_lib/uploadOneDrive.ts
  import { graphPut } from './msGraphClient';

  const BASE_LOCAL = 'C:\\Users\\andre\\OneDrive - APPV Personalvermittlung\\Immobilien\\001_AQUISE\\Objekte';

  export async function uploadOneDriveFolder(args: {
    address: string;
    files: Array<{ name: string; content: Buffer }>;
    meta: { messageId: string; from: string; subject: string; timestamp: string };
    deps?: { graphPut?: typeof graphPut };
  }): Promise<{ localPath: string }> {
    const put = args.deps?.graphPut || graphPut;
    const safeAddress = args.address.replace(/[\\/:*?"<>|]/g, '_');
    const basePath = `/me/drive/root:/Immobilien/001_AQUISE/Objekte/${safeAddress}`;

    for (const file of args.files) {
      await put(`${basePath}/${file.name}:/content`, file.content);
    }
    await put(
      `${basePath}/_meta.json:/content`,
      Buffer.from(JSON.stringify(args.meta, null, 2)),
    );

    return { localPath: `${BASE_LOCAL}\\${safeAddress}\\` };
  }
  ```

- [ ] **B5.4: Stage-Worker erweitern** — nach Adress-Extraktion: Upload starten
  ```ts
  // In process/route.ts
  let exposeLocalPath: string | null = null;
  if (address && parsed.attachments.length > 0) {
    const { uploadOneDriveFolder } = await import('@/app/api/akquise/_lib/uploadOneDrive');
    const files = parsed.attachments.map((att) => {
      const typ = classifyPdf(att.filename).typ;
      const name = typ === 'sonstiges' ? att.filename : `${typ[0].toUpperCase() + typ.slice(1)}.pdf`;
      return { name, content: att.content };
    });
    const result = await uploadOneDriveFolder({
      address,
      files,
      meta: { messageId, from: parsed.from, subject: parsed.subject, timestamp: new Date().toISOString() },
    });
    exposeLocalPath = result.localPath;
  }
  ```

- [ ] **B5.5: Manueller E2E** + Vercel-Env-Setzen
- [ ] **B5.6: Commit** `feat(akquise): OneDrive-Upload via Microsoft Graph (B5)`

**Akzeptanzkriterium:** Mail mit PDF → Datei erscheint in OneDrive unter `Immobilien/001_AQUISE/Objekte/<Adresse>/`. `expose_local_path` im Lead zeigt Windows-UNC-Pfad.

---

## Schritt B6: Link-Resolver

**Voraussetzung:** B3 ✅ (austauschbar mit B5)

**Ziel:** Wenn Mail einen Link zu Online-Exposé enthält (ImmoScout, Immowelt, etc.), Link auflösen — direkter PDF-Download wenn möglich, sonst HTML-zu-PDF-Render.

**Files:**
- Create: `app/api/akquise/_lib/resolveLink.ts`
- Create: `tests/akquise/resolveLink.test.ts`
- Modify: `app/api/akquise/process/route.ts`

### TDD-Steps

- [ ] **B6.1: Tests** (Mock-fetch für direkter PDF + HTML-Fall)
- [ ] **B6.2: Implementation**
  ```ts
  // app/api/akquise/_lib/resolveLink.ts
  export async function resolveLink(url: string): Promise<{ pdfContent: Buffer; filename: string } | null> {
    const head = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    const ct = head.headers.get('content-type') || '';
    if (ct.includes('pdf')) {
      const res = await fetch(url);
      return { pdfContent: Buffer.from(await res.arrayBuffer()), filename: `link-${Date.now()}.pdf` };
    }
    // HTML-Render: MVP überspringt mit Warning. Phase 2: Browserless / Playwright Cloud.
    console.warn(`resolveLink: HTML-Exposé ${url} übersprungen (MVP)`);
    return null;
  }
  ```
- [ ] **B6.3: Stage-Worker erweitern** (vor extractAddress: alle Links resolven, PDFs zu attachments hinzufügen)
- [ ] **B6.4: Commit** `feat(akquise): Link-Resolver für direkte PDF-Links (B6)`

**Akzeptanzkriterium:** Mail mit Link zu PDF → PDF wird heruntergeladen und gleich behandelt wie Anhang. HTML-Links werden mit Warning übersprungen (Phase-2-TODO).

---

## Schritt B7: QuickCheck-Modul

**Voraussetzung:** S2 ✅, B4 ✅

**Ziel:** Score 0–100 + 1-Satz-Begründung pro Lead, basierend auf in S2 definierter Logik.

**Files:**
- Create: `app/api/akquise/_lib/quickCheck.ts`
- Create: `tests/akquise/quickCheck.test.ts`
- Modify: `app/api/akquise/process/route.ts` (QuickCheck-Stage einbauen, NACH insertLead — Score wird per UPDATE gesetzt)
- Modify: `app/api/akquise/_lib/insertLead.ts` (Erweitern um Score-Setter oder via Update)

### TDD-Steps

- [ ] **B7.1: Tests aus S2-Spec ableiten** (Test-Cases gemäß S2-definierten Schwellwerten)
- [ ] **B7.2: Implementation** gemäß S2-Spec (Aufteiler-Light ODER Formel ODER LLM-Bauchgefühl)
- [ ] **B7.3: Stage-Worker einbauen**
- [ ] **B7.4: Commit** `feat(akquise): QuickCheck-Modul mit Score + Begründung (B7)`

**Akzeptanzkriterium:** Score zwischen 0–100, Begründung als 1-Satz-Text, in `deals.priority_score` + `deals.priority_reason` gespeichert.

---

## Schritt B8: UI Priority-Spalte + Pfad-Kopier-Button

**Voraussetzung:** B1 ✅ (Migration), parallel zu B2–B7 möglich

**Ziel:** Lead-Liste im ImmoCRM zeigt neue Spalte "Priorität" (Badge), Default-Sort nach Score DESC. Lead-Detail-Panel hat Button "📋 Ordner-Pfad kopieren".

**Files:**
- Modify: `src/components/leads/LeadTable.tsx` (oder Pfad gemäß bestehender Struktur)
- Modify: `src/hooks/useDeals.ts`
- Modify: `src/components/leads/LeadDetailPanel.tsx` (oder Schritt-3-Sheet-Component)
- Create: `src/components/shared/PriorityBadge.tsx`
- Create: `tests/components/PriorityBadge.test.tsx`

### TDD-Steps

- [ ] **B8.1: Test für PriorityBadge**
  ```tsx
  // tests/components/PriorityBadge.test.tsx
  import { render, screen } from '@testing-library/react';
  import { PriorityBadge } from '@/components/shared/PriorityBadge';

  describe('PriorityBadge', () => {
    it('Score 89 → hot (rot)', () => {
      render(<PriorityBadge score={89} />);
      expect(screen.getByText('89')).toHaveClass('bg-red-500');
    });
    it('Score 50 → warm (gelb)', () => { /* ... */ });
    it('Score 20 → cold (grau)', () => { /* ... */ });
    it('Score null → "–"', () => { /* ... */ });
  });
  ```

- [ ] **B8.2: Component schreiben**
  ```tsx
  // src/components/shared/PriorityBadge.tsx
  import { Badge } from '@/components/ui/badge';

  export function PriorityBadge({ score }: { score: number | null }) {
    if (score === null) return <Badge variant="outline">–</Badge>;
    const color =
      score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-yellow-500' : 'bg-gray-400';
    return <Badge className={`${color} text-white`}>{score}</Badge>;
  }
  ```

- [ ] **B8.3: Spalte in LeadTable ergänzen** + Default-Sort
  ```tsx
  // src/components/leads/LeadTable.tsx (Auszug)
  const columns: ColumnDef<Deal>[] = [
    // ... bestehende Spalten
    {
      accessorKey: 'priority_score',
      header: 'Priorität',
      cell: ({ row }) => <PriorityBadge score={row.original.priority_score} />,
      sortingFn: 'basic',
    },
  ];

  // Default sort:
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'priority_score', desc: true },
  ]);
  ```

- [ ] **B8.4: Pfad-Kopier-Button im Detail-Panel**
  ```tsx
  // In LeadDetailPanel.tsx
  import { Button } from '@/components/ui/button';
  import { toast } from 'sonner';
  import { Clipboard } from 'lucide-react';

  function CopyPathButton({ path }: { path: string | null }) {
    if (!path) return null;
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(path);
          toast.success('Pfad kopiert', {
            description: 'Drücke Win+E → Strg+V → Enter im Explorer',
          });
        }}
      >
        <Clipboard className="mr-2 h-4 w-4" />
        Ordner-Pfad kopieren
      </Button>
    );
  }
  ```

- [ ] **B8.5: Lokaler Test** (`npm run dev`, Lead-Liste öffnen, Sortierung prüfen, Button klicken, Pfad in Explorer einfügen)

- [ ] **B8.6: Commit**
  ```bash
  git commit -m "feat(leads): Priority-Score-Spalte + Pfad-Kopier-Button (B8)"
  ```

**Akzeptanzkriterium:** Lead-Liste zeigt Spalte "Priorität", Default-Sort nach Score DESC. Klick auf Button kopiert OneDrive-Pfad. Manueller Test in Chrome: Pfad-Einfügen in Explorer öffnet den Ordner.

---

## Schritt B9: Briefing-Erweiterung

**Voraussetzung:** B7 ✅, B8 ✅, ImmoCRM-Schritt 8 (Daily Briefing) muss bestehen oder parallel aufgesetzt sein.

**Ziel:** Daily-Briefing-Mail 8 Uhr enthält neue Sektion "Heute eingegangen" + "Top-5 nach Priorität" (siehe Spec §4.8).

**Files:**
- Modify: ImmoCRM-Schritt-8-Edge-Function (Pfad TBD, vermutlich `app/api/cron/daily-mail/route.ts`)
- Modify: Briefing-Template (HTML)

### TDD-Steps

- [ ] **B9.1: Data-Fetch erweitern**
  ```ts
  // Neue Query
  const todaysNewLeads = await supabaseAdmin
    .from('deals')
    .select('address, priority_score, priority_reason, preis_pro_m2, einheiten')
    .eq('expose_source', 'mail-pipeline')
    .gte('created_at', startOfTodayBerlin())
    .is('deleted_at', null);

  const top5 = await supabaseAdmin
    .from('deals')
    .select('address, priority_score, priority_reason, preis_pro_m2, einheiten')
    .not('priority_score', 'is', null)
    .eq('status', 'offen')
    .is('deleted_at', null)
    .order('priority_score', { ascending: false })
    .limit(5);
  ```

- [ ] **B9.2: HTML-Template-Sektion**
  ```html
  <h2>🆕 HEUTE EINGEGANGEN ({{count}})</h2>
  <p>Davon QuickCheck durchgelaufen: {{checked}} ({{pending}} ausstehend)</p>

  <h2>🔥 TOP-5 NACH PRIORITÄT</h2>
  {{#each top5}}
    <p>
      <strong>(Score {{score}})</strong> {{address}}
      | {{pricePerSqm}} €/m² | {{units}} WE<br>
      <em>"{{reason}}"</em>
    </p>
  {{/each}}
  ```

- [ ] **B9.3: Test-Trigger der Briefing-Function manuell**, Mail in Postfach prüfen.

- [ ] **B9.4: Commit** `feat(briefing): Akquise-Sektionen 'Heute eingegangen' + 'Top-5' (B9)`

**Akzeptanzkriterium:** Manueller Trigger der Briefing-Function → Mail enthält neue Sektionen mit korrekten Daten. Bestehendes Briefing (Performance, Pipeline-Wert) bleibt erhalten.

---

## Schritt B10: E2E-Test mit 20 echten Mails

**Voraussetzung:** B1–B9 ✅

**Ziel:** Council-R1 (Parser-Qualität als Engpass) verifizieren. Mindestens 17/20 echte Akquise-Mails sauber durchlaufen — korrekte Adresse, OneDrive-Upload, Lead im CRM, Score gesetzt.

**Files:**
- Create: `tests/e2e/akquise-batch-protocol.md` (Test-Protokoll mit Ergebnis pro Mail)
- Modify: `04_progress.md` mit Resultaten

### Steps

- [ ] **B10.1: 20 echte Makler-Mails sammeln** (aus deinem Postfach, letzten 4 Wochen)

- [ ] **B10.2: Manuell in CRM-Eingang verschieben** (eine pro Stunde, um Backlog-Verhalten zu testen)

- [ ] **B10.3: Pro Mail Ergebnis im Protokoll festhalten:**
  - Adresse korrekt? (J/N)
  - PDF im OneDrive? (J/N)
  - Score sinnvoll? (J/N)
  - Lead-Eintrag korrekt? (J/N)
  - Fehler? (Beschreibung)

- [ ] **B10.4: Score auswerten**
  - 17/20 oder besser → ✅
  - Unter 17/20 → Failure-Analyse, ggf. extractAddress.ts oder quickCheck.ts verbessern, dann erneut

- [ ] **B10.5: ADR-014 anlegen** (E2E-Stichprobe-Ergebnis dokumentiert)

- [ ] **B10.6: Commit** `docs(akquise): E2E-Stichprobe 20 Mails, X/20 erfolgreich (B10)`

**Akzeptanzkriterium:** ≥17/20 erfolgreich, Protokoll dokumentiert, ADR-014 in `03_decisions.md`.

---

## Schritt B11: Migration & Deaktivierung Altsystem

**Voraussetzung:** B10 grün

**Ziel:** Bestehende lokale Python-Pipeline (`automatisierung-aquise`) wird deaktiviert. Gmail-Forwarding von web.de abgeschaltet. Keine Doppel-Verarbeitung mehr.

**Files:**
- Modify: `c:\meine-projekte\automatisierung-aquise\README.md` (Deprecated-Banner)
- Modify: `c:\meine-projekte\README.md` (Mono-Repo-Root, Akquise-Pipeline einreihen, automatisierung-aquise als deprecated markieren)

### Steps

- [ ] **B11.1: Task-Scheduler-Jobs deaktivieren**
  ```powershell
  schtasks /Change /TN "Akquise-Pipeline" /DISABLE
  schtasks /Change /TN "Akquise-Pipeline-HealthCheck" /DISABLE
  ```
  Verifikation: `schtasks /Query /TN "Akquise-Pipeline" /V /FO LIST` → Status "Disabled"

- [ ] **B11.2: Gmail-Forwarding abschalten**
  - Gmail → Einstellungen → Weiterleitung → web.de-Filter deaktivieren oder löschen
  - 24 h beobachten: kein neuer Eintrag in Gmail-INBOX mit Absender web.de

- [ ] **B11.3: Deprecated-Banner in `automatisierung-aquise/README.md`**
  ```markdown
  > ⚠️ **DEPRECATED ab 2026-MM-DD** — ersetzt durch Cloud-Pipeline.
  > Spec: `Immobilien/ImmoCRM/docs/superpowers/specs/2026-05-11-akquise-pipeline-cloud-design.md`
  > Plan: `Immobilien/ImmoCRM/docs/superpowers/plans/2026-05-11-akquise-pipeline-cloud-plan.md`
  > Code bleibt als historische Referenz. Task-Scheduler-Jobs disabled.
  ```

- [ ] **B11.4: Mono-Repo-Root-README updaten** (`c:\meine-projekte\README.md`)
  - Eintrag "Immobilien/Akquise-Pipeline (Cloud)" → Code lebt im ImmoCRM-Repo
  - `automatisierung-aquise` als deprecated mit Datum

- [ ] **B11.5: Commit (im automatisierung-aquise Repo + im Mono-Repo-Root)**
  ```bash
  cd c:\meine-projekte\automatisierung-aquise
  git add README.md
  git commit -m "chore: deprecated — ersetzt durch ImmoCRM Cloud-Pipeline"

  cd c:\meine-projekte
  git add README.md
  git commit -m "docs(repo): Akquise-Pipeline Cloud im ImmoCRM, automatisierung-aquise deprecated"
  ```

**Akzeptanzkriterium:** Task-Scheduler-Jobs disabled, Gmail-Forwarding aus, READMEs updated, 24 h beobachtet ohne Doppel-Verarbeitung.

---

# Cross-Projekt-Eingriffe-Checkliste

Zusammenfassung aller Touchpoints aus der Spec §10 — am Ende des Bau-Marathons alles ✅?

**ImmoCRM-Repo (`Immobilien\ImmoCRM\`):**

- [ ] `app/api/cron/akquise-poll/route.ts` (B2)
- [ ] `app/api/akquise/process/route.ts` (B3)
- [ ] `app/api/akquise/_lib/imapClient.ts` (B2)
- [ ] `app/api/akquise/_lib/mailQueue.ts` (B2)
- [ ] `app/api/akquise/_lib/parseEmail.ts` (B3)
- [ ] `app/api/akquise/_lib/classifyPdf.ts` (B3)
- [ ] `app/api/akquise/_lib/extractAddress.ts` (B4)
- [ ] `app/api/akquise/_lib/anthropic.ts` (B4)
- [ ] `app/api/akquise/_lib/uploadOneDrive.ts` (B5)
- [ ] `app/api/akquise/_lib/msGraphClient.ts` (B5)
- [ ] `app/api/akquise/_lib/resolveLink.ts` (B6)
- [ ] `app/api/akquise/_lib/quickCheck.ts` (B7)
- [ ] `app/api/akquise/_lib/insertLead.ts` (B3, mehrfach erweitert)
- [ ] `supabase/migrations/003_mail_queue.sql` (B1)
- [ ] `supabase/migrations/004_deals_priority_score.sql` (B1)
- [ ] `src/types/supabase.ts` (B1, regeneriert)
- [ ] `src/components/leads/LeadTable.tsx` (B8)
- [ ] `src/components/leads/LeadDetailPanel.tsx` (B8)
- [ ] `src/components/shared/PriorityBadge.tsx` (B8)
- [ ] `src/hooks/useDeals.ts` (B8)
- [ ] Briefing-Edge-Function (B9)
- [ ] `docs/02_implementierungsplan.md` — neue Schritte einreihen (im Anschluss an B11)
- [ ] `docs/03_decisions.md` — ADRs 011, 012, 013, 014
- [ ] `docs/04_progress.md` — alle Schritte ✅
- [ ] `docs/05_tools.md` — neue Schritte in Skill-Matrix
- [ ] `docs/06_pipeline_guidelines.md` — siehe separates Dokument
- [ ] `package.json`: imapflow, mailparser, @microsoft/microsoft-graph-client, @azure/msal-node, pdf-parse, @anthropic-ai/sdk
- [ ] Vercel Env: `WEBDE_IMAP_USER`, `WEBDE_IMAP_APP_PASSWORD`, `MS_GRAPH_*`, `CRON_SECRET_AKQUISE`, `ANTHROPIC_API_KEY`

**automatisierung-aquise-Repo:**

- [ ] `README.md` Deprecated-Banner (B11)
- [ ] Windows Task Scheduler Jobs disabled (B11)
- [ ] `data/state.db` + `logs/` unberührt (Audit-Spur)

**Externe Systeme:**

- [ ] Gmail-Forwarding aus (B11)
- [ ] web.de App-Passwort + Outlook-Ordner "CRM-Eingang" angelegt (S1)
- [ ] cron-job.org neuer Cronjob `*/5 * * * *` → Poll-Endpoint (B2)
- [ ] Azure-AD-App registriert, Refresh-Token in Vercel Env (S1)
- [ ] Anthropic-API-Key konfiguriert (vorhanden aus ADR-006)

**Mono-Repo-Root:**

- [ ] `c:\meine-projekte\README.md` (B11)
- [ ] `.gitignore` (kein Eingriff nötig, gemäß ADR-006)

---

# Definition of Done — Akquise-Pipeline MVP

- [ ] S1 grün (Variante A bestätigt)
- [ ] S2 abgeschlossen (QuickCheck-Logik definiert)
- [ ] S3 abgeschlossen (ADR-009 Accepted)
- [ ] B1–B11 alle ✅ in `04_progress.md`
- [ ] 17/20 Stichprobe-Mails erfolgreich (B10)
- [ ] Briefing 8 Uhr enthält Akquise-Sektionen (B9)
- [ ] Mobile Workflow getestet: web.de-App-Sortierung → ≤5 Min Lead im CRM
- [ ] OneDrive-Pfad-Kopier-Button funktioniert in Chrome
- [ ] Keine Doppel-Verarbeitung (Gmail-Forwarding aus, alter Python-Daemon disabled)
- [ ] `docs/02_implementierungsplan.md` updated mit neuen Schritten
- [ ] ADRs 011, 012, 013, 014 in `03_decisions.md`

---

## Change-Log

| Datum | Änderung | Autor |
|---|---|---|
| 2026-05-11 | Initial Plan nach Spec + Brainstorming + Council | André + Claude Code |
