# 06 — Pipeline Development Guidelines

> **Zweck:** Pipeline-spezifische Standards (Vercel Edge Functions, IMAP, Microsoft Graph, Stage-Worker). **Ergänzt** [`DEVELOPMENT_GUIDELINES.md`](../DEVELOPMENT_GUIDELINES.md) — die Frontend-Standards dort gelten weiterhin, dieses Dokument deckt nur den Backend-/Pipeline-Teil ab.
>
> **Geltungsbereich:** alles unter `app/api/akquise/*` und `app/api/cron/akquise-*`, plus die zugehörigen Migrations, Tests und Helper.

---

## 1. Grundregeln

- **Lies zuerst** [`DEVELOPMENT_GUIDELINES.md`](../DEVELOPMENT_GUIDELINES.md) — dieses Dokument ist additiv.
- **Spec ist verbindlich:** [`docs/superpowers/specs/2026-05-11-akquise-pipeline-cloud-design.md`](superpowers/specs/2026-05-11-akquise-pipeline-cloud-design.md). Bei Konflikt zwischen Spec und Code: Spec gewinnt. Wenn Code Recht hat, muss die Spec aktualisiert werden.
- **Plan ist verbindlich:** [`docs/superpowers/plans/2026-05-11-akquise-pipeline-cloud-plan.md`](superpowers/plans/2026-05-11-akquise-pipeline-cloud-plan.md). Reihenfolge der Schritte einhalten (außer dokumentierte austauschbare Stellen).
- **Council-Findings** in der Spec §6 (R1–R10) sind Pflicht-Lese vor jedem Bau-Schritt — die meisten Risiken sind dort schon kategorisiert.

---

## 2. Datei-Struktur

```
app/
├── api/
│   ├── cron/
│   │   ├── daily-mail/route.ts                  # ImmoCRM-Schritt 8 (bestehend)
│   │   └── akquise-poll/route.ts                # NEU — Poll-Endpoint
│   └── akquise/
│       ├── process/route.ts                     # NEU — Stage-Worker
│       └── _lib/                                # Interne Pipeline-Module
│           ├── imapClient.ts                    # IMAP-Connect-Wrapper
│           ├── mailQueue.ts                     # enqueue + isAlreadyProcessed
│           ├── parseEmail.ts                    # MIME → Anhänge + Links
│           ├── classifyPdf.ts                   # Filename → Typ
│           ├── extractAddress.ts                # Regex + LLM-Fallback
│           ├── anthropic.ts                     # Anthropic-Wrapper mit Caching
│           ├── resolveLink.ts                   # URL → PDF
│           ├── uploadOneDrive.ts                # MS Graph-Upload
│           ├── msGraphClient.ts                 # OAuth-Token-Management
│           ├── quickCheck.ts                    # Lead-Bewertung (TBD nach S2)
│           └── insertLead.ts                    # Lead-Upsert in Supabase
└── ...

tests/
├── akquise/
│   ├── mailQueue.test.ts
│   ├── parseEmail.test.ts
│   ├── classifyPdf.test.ts
│   ├── extractAddress.test.ts
│   ├── uploadOneDrive.test.ts
│   └── ... (eine Test-Datei pro _lib-Modul mit nicht-trivialer Logik)
├── e2e/
│   └── akquise-batch-protocol.md               # Stichprobe-Protokoll B10
└── fixtures/
    ├── mail-with-pdf.eml
    ├── mail-with-link.eml
    └── ...
```

**Konvention:** Underscore-Prefix `_lib` macht den Ordner für Vercel als nicht-routbar erkennbar. `_lib`-Files exportieren **reine Funktionen** mit klaren Inputs/Outputs — keine HTTP-Handler dort.

---

## 3. Naming

| Was | Konvention | Beispiel |
|---|---|---|
| API-Routen-Files | `route.ts` (Next.js App Router) | `app/api/akquise/process/route.ts` |
| Pipeline-Module unter `_lib/` | camelCase, ein-Wort-pro-Verantwortung | `parseEmail.ts`, `extractAddress.ts` |
| Public-Functions | Verb + Objekt | `enqueueMail`, `extractAddress`, `uploadOneDriveFolder` |
| Test-Files | spiegeln Modul-Name | `parseEmail.test.ts` |
| Test-Fixtures | beschreibender Name | `mail-with-pdf.eml`, `expose-talstr-10.pdf` |
| Migration-Files | `NNN_<thema>.sql` aufsteigend | `003_mail_queue.sql`, `004_deals_priority_score.sql` |
| Env-Vars | SCREAMING_SNAKE_CASE, Service-Prefix | `WEBDE_IMAP_USER`, `MS_GRAPH_REFRESH_TOKEN`, `CRON_SECRET_AKQUISE` |

---

## 4. Vercel Edge Functions / API-Routen

### 4.1 Runtime

- **`runtime = 'nodejs'`** für alle Akquise-Funktionen — `imapflow`, `mailparser`, `pdf-parse`, `@azure/msal-node` sind **nicht edge-kompatibel** (nutzen Node-spezifische Module wie `net`, `crypto`).
- **`maxDuration = 60`** (Hobby-Tier-Limit). Wenn ein Verarbeitungsschritt nicht in 60s machbar ist → in eigene Function trennen (siehe Stage-Worker-Pattern §7).

```ts
export const runtime = 'nodejs';
export const maxDuration = 60;
```

### 4.2 Auth — alle Endpoints durch Bearer-Token geschützt

Jeder Endpoint, der vom externen Cron (cron-job.org) oder von einem anderen Endpoint aufgerufen wird, prüft das Bearer-Token gegen einen pro-Endpoint-Secret:

```ts
function authOk(req: Request, expectedSecret: string): boolean {
  return req.headers.get('authorization') === `Bearer ${expectedSecret}`;
}

export async function POST(req: Request) {
  if (!authOk(req, process.env.CRON_SECRET_AKQUISE!))
    return new Response('Unauthorized', { status: 401 });
  // ...
}
```

- **Separate Secrets** pro Endpoint-Familie (`CRON_SECRET_AKQUISE` ≠ `CRON_SECRET_BRIEFING`) — Leak eines Cron-Secrets kompromittiert nicht alle Endpoints.
- **Niemals** Service-Role-Key als Auth-Token verwenden — der ist nur für Supabase-DB-Operationen.

### 4.3 Response-Format

- Erfolg: `Response.json({ ok: true, ...resultData })` mit Status 200
- Erwartete Fehler (z.B. Mail nicht parsebar): `Response.json({ ok: false, reason: '...' })` mit Status 200 — Cron würde sonst Failure-Alert auslösen, obwohl nichts kaputt ist
- Unerwartete Fehler (Throw): Status 500 — Cron-Alert ist gewollt
- Auth-Fehler: Status 401

---

## 5. IMAP-Pattern (imapflow)

### 5.1 Connection-Lifecycle

Immer mit `withImap()`-Wrapper (siehe `app/api/akquise/_lib/imapClient.ts`). Stellt sicher, dass Verbindungen sauber geschlossen werden — auch bei Errors.

```ts
const result = await withImap(async (client) => {
  const lock = await client.getMailboxLock('CRM-Eingang');
  try {
    // ... Mailbox-Operationen
    return data;
  } finally {
    lock.release();
  }
});
```

- **`getMailboxLock()`** für jeden Ordner-Zugriff — Concurrency-Safety, auch wenn wir Single-User sind (defensive Practice).
- **`finally` für `lock.release()` UND `client.logout()`** — kein "happy path"-Leak.

### 5.2 Idempotenz via IMAP-Flag + DB-State

Doppelter Schutz:
1. **IMAP `\Seen`-Flag** wird beim Enqueue gesetzt → bei nächstem Poll fällt die Mail aus `search({ seen: false })` raus.
2. **`mail_queue.message_id` als PRIMARY KEY** — auch wenn IMAP-Flag aus irgendwelchen Gründen nicht persistent ist, blockt der Unique-Constraint Duplikate.

```ts
if (await isAlreadyProcessed(msg.envelope.messageId)) {
  await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
  continue;
}
await enqueueMail({ messageId: msg.envelope.messageId, imapUid: uid });
await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
```

Reihenfolge wichtig: erst DB-Insert (idempotent dank PK), dann IMAP-Flag setzen. Wenn IMAP-Flag fehlschlägt, ist die Mail trotzdem in der Queue und wird verarbeitet.

### 5.3 Was NICHT tun

- **Kein IMAP-IDLE in Serverless** — Functions sind kurzlebig (max 60s), IDLE blockiert für unbestimmte Zeit. Nur Polling oder Push-Forward.
- **Keine Long-Lived-Connections** — pro Poll eine neue Connection, dann Logout. web.de hat Connection-Limits (vermutlich ~5 parallel).
- **Kein Filter via FROM** — wir nutzen Outlook-Ordner als Filter, FROM wäre redundant und würde User-Bewegungen ignorieren.

---

## 6. Microsoft Graph / OneDrive-Pattern

### 6.1 Token-Caching

Refresh-Token in Vercel Env, Access-Token im Modul-Scope cachen (50 Min TTL, Token läuft nach 60 Min ab):

```ts
let cached: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  // ... msal.acquireTokenByRefreshToken
  cached = { token: result.accessToken, expiresAt: Date.now() + 50 * 60 * 1000 };
  return cached.token;
}
```

**Achtung:** Vercel-Function-Instanzen sind nicht persistent — der Cache lebt nur innerhalb einer Invocation. Für Multi-Mail-Batches reicht das (alle Mails einer Stage-Worker-Invocation teilen sich den Token).

### 6.2 Pfad-Konvention

OneDrive-Pfade immer absolut von `/me/drive/root:/`:

```
/me/drive/root:/Immobilien/001_AQUISE/Objekte/<Adresse>/<Dateiname>:/content
```

Adresse muss vor Verwendung sanitized werden (Windows-illegal-Chars escapen):

```ts
const safeAddress = address.replace(/[\\/:*?"<>|]/g, '_');
```

### 6.3 Lokaler-Pfad-String fürs CRM

Hardcoded Base-Path in Pipeline-Config, NICHT dynamisch aus Graph-Response ableiten:

```ts
const BASE_LOCAL = 'C:\\Users\\andre\\OneDrive - APPV Personalvermittlung\\Immobilien\\001_AQUISE\\Objekte';
const exposeLocalPath = `${BASE_LOCAL}\\${safeAddress}\\`;
```

Begründung: User-spezifisch, ändert sich nicht oft, wird beim Pfad-Kopier-Button-Klick im CRM verwendet. Wenn der User OneDrive-Synchronisations-Pfad ändert, ist das eine einmalige Config-Anpassung.

### 6.4 Upload-Strategie

- **Kleine Dateien (<4 MB):** direkter `PUT` auf `:/content`
- **Große Dateien (>4 MB):** Upload-Session via `createUploadSession` — sonst Timeout / Memory-Issues

```ts
if (content.length < 4 * 1024 * 1024) {
  await graph.api(`${basePath}:/content`).put(content);
} else {
  const session = await graph.api(`${basePath}:/createUploadSession`).post({});
  // Chunked upload (siehe MS-Graph-Docs)
}
```

---

## 7. Stage-Worker-Pattern (60s-Limit)

### 7.1 Trennung Poll vs. Worker

**Poll-Endpoint** macht NUR:
- IMAP-Connect + Login
- Search neue UIDs
- Pro UID: Envelope fetchen, Message-ID check, enqueue + IMAP-Flag setzen
- Fire-and-forget Stage-Worker-Trigger (`fetch` ohne `await`)
- Logout

Erwartete Dauer: ~5–15s bei 1–20 Mails. **NIEMALS** PDF-Parsing oder LLM-Calls im Poll-Endpoint.

**Stage-Worker** macht **eine** Mail komplett:
- Mail aus IMAP holen (full source)
- parseEmail → classifyPdf → extractAddress → resolveLink → uploadOneDrive → quickCheck → insertLead
- State-Updates in `mail_queue` (`processing` → `done` oder `error`)

Erwartete Dauer pro Mail: ~30s. Bei 20 Mails Backlog: 20 separate Function-Invocations (Vercel skaliert horizontal).

### 7.2 Async-Trigger

Poll-Endpoint triggert Worker **ohne** `await` — sonst läuft die Poll-Funktion gegen das 60s-Limit:

```ts
// Fire-and-forget
void fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/akquise/process`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET_AKQUISE}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ messageId, imapUid }),
});
```

**Achtung:** `void fetch()` ohne `await` ist im Vercel-Function-Kontext riskant — die Funktion kann beendet werden, bevor der Request raus ist. Sauberer mit `waitUntil` (Vercel-Helper, falls verfügbar) oder dedizierte Queue-Tabelle + zweiter Cron-Job (alle 1 Min) als Backup-Worker.

### 7.3 Backup-Worker (Phase 2, optional)

Wenn Fire-and-forget unzuverlässig wird (z.B. wir sehen `mail_queue.status = 'pending'`-Einträge die nie zu `processing` werden):

- Zweiter cron-job.org-Eintrag, alle 2 Min, `/api/akquise/drain`
- Endpoint findet `WHERE status = 'pending' OR (status = 'processing' AND started_at < now() - interval '10 minutes')`
- Pro Eintrag: Stage-Worker-Logik inline ausführen (oder fetch zum process-Endpoint)

**Nicht im MVP.** Erst bauen, wenn Real-Betrieb Probleme zeigt.

---

## 8. Error-Handling & Logging

### 8.1 Stage-Worker-Fehler

Pro Stage `try/catch`, bei Fehler `mail_queue.status = 'error'` + `error_msg` setzen, **NICHT** rethrowen — sonst stoppt der Worker und die Mail bleibt in `processing` hängen:

```ts
try {
  // alle Stages
  await supabaseAdmin
    .from('mail_queue')
    .update({ status: 'done', done_at: new Date().toISOString(), deal_id })
    .eq('message_id', messageId);
  return Response.json({ ok: true });
} catch (err) {
  console.error('akquise/process failed:', err);
  await supabaseAdmin
    .from('mail_queue')
    .update({ status: 'error', error_msg: String(err) })
    .eq('message_id', messageId);
  return Response.json({ ok: false, error: String(err) }, { status: 200 });
}
```

**Wichtig:** Status 200 trotz Fehler — Cron würde sonst Alert auslösen für eine "erwartete" Fehlerart. Echte Fehler (Datenbank weg, OAuth-Token revoked) müssen explizit `throw` und 500 zurückgeben — diese Alerts sind gewollt.

### 8.2 Logging

- **`console.error('module-name failed:', err)`** für unerwartete Fehler (Vercel zeigt das in Logs)
- **`console.log('module-name: <action>', metadata)`** für wichtige Schritte (z.B. "OneDrive-Upload erfolgreich")
- **Keine** strukturierte Logging-Library im MVP — Vercel-Logs reichen. Bei Bedarf später `pino` oder `winston` nachziehen.
- **Keine Personenbezogenen-Daten** in Logs (Makler-Email, Adresse, PDF-Inhalt) — DSGVO. Nur Message-ID und Hash/Truncated-Werte.

### 8.3 Health-Check

- Briefing-Mail (8 Uhr) zeigt `mail_queue.status = 'error'`-Einträge der letzten 24 h
- Wenn `> 3 Errors / Tag` → manuelle Untersuchung der `error_msg`-Spalte
- ADR-014 dokumentiert Schwellwerte und Reaktions-Strategie

---

## 9. Idempotenz-Pattern

### 9.1 Drei-Schichten-Schutz

| Schicht | Mechanismus | Verteidigt gegen |
|---|---|---|
| **IMAP** | `\Seen`-Flag | Nächste Poll-Runde sieht die Mail nicht mehr |
| **DB-PK** | `mail_queue.message_id` UNIQUE | Selbe Mail wird doppelt enqueued (z.B. Race) |
| **Status-Check** | `isAlreadyProcessed()` vor Enqueue | Re-Run einer schon erfolgreichen Mail |

### 9.2 Bei Crash während `processing`

- `mail_queue.status` bleibt auf `processing`, `started_at` ist gesetzt
- **Manuelle Re-Run-Strategie** (MVP): SQL-Skript löscht den Eintrag, IMAP-Mail manuell unread markieren, nächster Poll greift sie wieder auf
- **Backup-Worker** (Phase 2, §7.3) würde stale `processing`-Einträge automatisch retried

---

## 10. Test-Strategie

### 10.1 Pflicht-Tests (gemäß Council-R1)

Diese Module **müssen** getestet sein:

- `parseEmail` — RFC-822-Parsing ist fehleranfällig, Fixtures decken Edge-Cases ab
- `classifyPdf` — Filename-Heuristik ist einfach, aber Regression bei Pattern-Änderung gefährlich
- `extractAddress` — **kritischster Punkt** (Council-R1). Mind. 10 Test-Cases mit echten Exposé-Texten als Fixtures, plus 1 LLM-Fallback-Test (gemockt)
- `mailQueue` — Idempotenz-Garantien
- `uploadOneDrive` — Pfad-Konstruktion, Sanitization
- `quickCheck` — Score-Schwellwerte, Reason-Format (sobald S2 fertig)

### 10.2 LLM-Calls in Tests

**Niemals echte Anthropic-API-Calls** in `tests/` ausführen. Stattdessen:

- `extractAddress` und `quickCheck` nehmen optional einen `deps: { llm }`-Parameter
- Default: echter Anthropic-Wrapper (`askAnthropic`)
- In Tests: `vi.fn()` mit erwartetem Output

```ts
const llmMock = vi.fn().mockResolvedValue({ address: 'Beispielstr 5, 44137 Dortmund' });
const result = await extractAddress(text, { llm: llmMock });
expect(llmMock).toHaveBeenCalledOnce();
```

### 10.3 E2E mit echten Mails (B10)

- Eigene Test-Klasse / Protokoll-Datei (`tests/e2e/akquise-batch-protocol.md`)
- **Nicht in CI** — wird manuell ausgeführt bei Stichprobe-Akzeptanz und nach jedem `extractAddress`/`quickCheck`-Update

### 10.4 Mock-Strategie für Microsoft Graph

- Test-Helper `mockGraphClient()` der `put`-Calls aufzeichnet
- Keine echten OneDrive-Uploads in Tests (würde Files in echtem OneDrive anlegen)
- Manuelle Verifikation in B5.5 (Spike) und B10 (Stichprobe)

---

## 11. Anthropic-Prompt-Caching

### 11.1 Wann cachen?

- **Immer** für wiederkehrende System-Prompts: `extractAddress`, `quickCheck`
- `cache_control: { type: 'ephemeral' }` auf dem System-Block

```ts
const SYSTEM_ADDRESS_EXTRACT = `Du extrahierst Objekt-Adressen aus deutschen Immobilien-Exposés.
[...]`;

const res = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 100,
  system: [
    { type: 'text', text: SYSTEM_ADDRESS_EXTRACT, cache_control: { type: 'ephemeral' } },
  ],
  messages: [{ role: 'user', content: userPrompt }],
});
```

### 11.2 Modell-Wahl

- **Adress-Extract (B4):** `claude-haiku-4-5-20251001` — schnell, günstig, ausreichend für Extraction
- **QuickCheck (B7):** Modell-Wahl in S2-Brainstorming festlegen. Vermutlich Haiku oder Sonnet je nach Bewertungs-Komplexität.

### 11.3 Kosten-Überwachung

- Pro Mail: ~1500 Input-Tokens (Exposé-Text-Auszug) + ~50 Output-Tokens
- Mit Cache: ~50 Tokens pro Anfrage abgerechnet (System wird gecached)
- Bei 20 Mails/Tag: <1 € / Monat. Unkritisch.

---

## 12. Supabase-Pattern

### 12.1 Service-Role-Client

Pipeline schreibt mit Service-Role-Key, niemals mit Anon-Key (Anon hat per RLS keine INSERT-Rechte):

```ts
// src/lib/supabase-admin.ts (falls noch nicht aus ADR-008)
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
```

**NIEMALS** `supabase-admin` im Frontend-Bundle importieren — der Service-Role-Key würde leaken. Strikte Trennung `src/lib/supabase.ts` (Anon, Frontend) vs. `src/lib/supabase-admin.ts` (Service-Role, nur Backend).

### 12.2 Migrations

- Pflicht: SQL-Files unter `supabase/migrations/NNN_<thema>.sql` (gemäß bestehender Convention)
- **NIEMALS** Schema im Supabase-Dashboard editieren — sonst Drift zwischen Code und DB
- Nach jeder Migration: `supabase gen types typescript --project-id <id> > src/types/supabase.ts` und in den Commit aufnehmen

### 12.3 RLS auch für interne Tabellen

`mail_queue` ist eine Pipeline-interne Tabelle — Anon-Frontend hat dort nichts zu suchen. Trotzdem RLS aktivieren (defensive Practice, gemäß ADR-008):

```sql
ALTER TABLE mail_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_full" ON mail_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Keine Anon-Policy — Anon kann nichts sehen/ändern.
```

---

## 13. Council-Findings als laufende Checkliste

Die zehn Risiken aus der Spec §6 müssen bei jedem Schritt vor Augen sein:

| ID | Risiko | Wo in der Code-Base addressiert |
|---|---|---|
| R1 | Parser-Qualität als Engpass | `tests/akquise/extractAddress.test.ts` (10+ Fixtures), B10 Stichprobe ≥17/20 |
| R2 | web.de App-Passwort verfügbar? | S1 Spike, ADR-011 |
| R3 | IMAP-Connection-Limits | `withImap()`-Wrapper mit sofortigem Logout, §5 |
| R4 | 60s-Vercel-Limit | Trennung Poll/Worker §7 |
| R5 | Webhook-Retries-Idempotenz | `mail_queue.message_id` PK §9 |
| R6 | OneDrive-Refresh-Token Expire | Health-Check-Probe-Call in B9, Alarm-Mail |
| R7 | DSGVO | ADR-009-Update via S3 |
| R8 | QuickCheck-Logik undefiniert | Stub in B7 bis S2 fertig |
| R9 | Premature Automation | Nach 4 Wochen Betrieb evaluieren (ADR-014) |
| R10 | Multi-Channel-Ingest-Vision | `expose_source`-Spalte erlaubt zukünftige Kanäle ohne Schema-Change |

---

## 14. Was wir nicht tun

- Kein lokaler Daemon mehr — die Pipeline ist Cloud-Only (Council-Verdict)
- Kein IMAP-IDLE in Serverless
- Kein PDF-Storage in Supabase Storage — OneDrive ist die Single Source of Truth für Dateien (gemäß User-Entscheidung)
- Keine Custom-URL-Schemes für Aufteiler-Trigger im MVP — Pfad-Kopier-Button reicht (Phase 2)
- Keine externe Forwarding-Adresse (Cloudflare Email Workers o.ä.) — Variante A direkt auf web.de gewählt
- Keine schwergewichtigen Test-Helper / Faktories — Vitest + simple `vi.fn()`-Mocks reichen für MVP
- Keine Eigen-Implementierung von IMAP-Parsing oder MIME-Decoding — `imapflow` + `mailparser` sind Industry-Standard

---

## 15. Wartung dieser Datei

- Bei neuem Pipeline-Module-Pattern: in §2 ergänzen
- Bei neuer Edge-Function-Convention: in §4 ergänzen
- Bei neuem Council-Finding aus Real-Betrieb: in §13 nachtragen
- Bei abgeschlossener "Phase 2"-Idee (z.B. Backup-Worker §7.3 implementiert): umetikettieren auf produktiv

---

## Change-Log

| Datum | Änderung | Autor |
|---|---|---|
| 2026-05-11 | Initial Guidelines parallel zum Plan | André + Claude Code |
