# Akquise-Pipeline Cloud-Anthropic — Design

**Status:** Spec (Brainstorming abgeschlossen 2026-05-14, Implementierungsplan ausstehend)
**Datum:** 2026-05-14
**Autor:** André Petrov (mit Claude Code, Brainstorming-Skill)
**Verortung:** ImmoCRM-Schritt 7 (`docs/02_implementierungsplan.md` §7)
**Ersetzt:** `2026-05-14-akquise-pipeline-redesign.md` (lokaler Watcher, lokaler Skill — verworfen am 2026-05-14)

---

## 1. Status & Verortung

Diese Spec definiert die **finale Architektur** für Schritt 7 der ImmoCRM-Implementierung (Akquise-Pipeline). Sie ersetzt die vorige Redesign-Spec vom 2026-05-14, die einen lokalen Watcher + lokalen Quick-Check-Skill vorsah.

**Erkenntnis hinter dem Wechsel:** Das ursprüngliche Cloud-Problem (`pdf-parse@2` braucht `DOMMatrix`) wurde gelöst, indem wir Claude selbst die PDFs lesen lassen — Sonnet 4.6 akzeptiert PDFs nativ als Document-Blocks via Anthropic-API. Damit entfällt der Grund, warum der Quick-Check lokal laufen sollte. Architektur wird komplett cloud-basiert, der PC ist nicht mehr involviert.

---

## 2. Zweck & Scope

**Drin im MVP:**

- Microsoft-Graph-Webhook empfängt Notification (UNVERÄNDERT, läuft heute)
- Vercel-Function lädt Mail + PDFs nach OneDrive (`001_AQUISE/_inbox/<message-id>/`) und setzt `mail_queue.status = ready_for_quickcheck`
- Externer Cron-Service (cron-job.org, kostenlos) ruft alle 1 Min einen Vercel-Endpoint `/api/akquise/process-queue` auf
- Process-Queue-Endpoint arbeitet wartende Einträge ab:
  - Sonnet 4.6 liest alle PDFs gemeinsam, extrahiert strukturiertes JSON
  - Opus 4.7 analysiert das JSON gemäß Quick-Check-Skill, liefert JSON + Markdown
  - Vercel schreibt Markdown nach OneDrive `Objekte/<Adresse>/quickcheck.md`
  - Vercel benennt Ordner `_inbox/<msg-id>/` → `Objekte/<Adresse>/` um (via Graph-API)
  - Vercel macht Supabase-Insert (contacts, deals, activity_log)
  - mail_queue.status = done
- Quick-Check-Skill bleibt **eine Datei** auf GitHub (raw-URL), wird sowohl lokal (Aufteiler-Vollanalyse) als auch cloud-seitig (Akquise) verwendet
- Skill enthält Modus-Check am Anfang — erkennt anhand des Aufruf-Kontexts (state.json vs. PDFs), welcher Workflow läuft

**Raus aus dem MVP:**

- Lokaler Watcher (verworfen am 2026-05-14, siehe `2026-05-14-akquise-pipeline-redesign.md`)
- Lokaler Quick-Check-Skill als eigenständige Datei (verworfen — derselbe Skill macht beide Modi)
- Automatischer Aufteiler-Vollanalyse-Trigger nach Akquise-Quick-Check (bleibt manueller Doppelklick auf `.code-workspace`)
- Multi-Channel-Ingest (WhatsApp, Scraper, Voice)
- Reaktivierung der 13 wartenden Mails im M365-Ordner `CRM-Eingang` (Entscheidung nach erstem grünen Lauf)

---

## 3. Stand vor Redesign-v2

### 3.1 Was läuft

- ✅ Webhook-Endpoint `https://immo-crm-xi.vercel.app/api/akquise/webhook`
- ✅ Microsoft-Graph-Subscription aktiv (Expiry 2026-05-16 — Renew-Pflicht vor erster Test-Mail)
- ✅ `mail_queue`-Insert läuft
- ✅ ENV-Vars in Vercel-Production gesetzt
- ✅ Cloud-Code lädt aktuell Mail + PDFs nach `_inbox/<msg-id>/` (Commits 5e13ffa, 69dffd4, 9d59f98)
- ✅ Outlook-QuickStep schickt forwarded Mails in M365-Ordner `CRM-Eingang`
- ✅ Aufteiler-Skill-Suite läuft lokal
- ✅ Supabase Free Tier mit `contacts`, `deals`, `mail_queue`, `activity_log`

### 3.2 Was bisher gebaut, jetzt obsolet

- ❌ `akquise-watcher/` (PowerShell + Task Scheduler XML) — am 2026-05-14 begonnen, nicht committed, wird verworfen
- ❌ Plan, Modul-0-Skill als zweiten "akquise-quickcheck"-Skill zu duplizieren — entfällt, ein Skill mit Modus-Check

### 3.3 Warum Cloud-Anthropic statt lokaler Watcher

| Option | Token-Quelle | Latenz Mail→Lead | PC nötig | Skill-Pflege |
|---|---|---|---|---|
| Lokaler Watcher (verworfen) | Claude-Code-Abo (Pauschale) | ~75 Sek (OneDrive-Sync + Poll) | Ja, PC muss an sein | 2 Skill-Dateien |
| **Cloud-Anthropic (gewählt)** | **Anthropic-API (Pay-per-Use)** | **~60-90 Sek (Cron + Sonnet/Opus)** | **Nein** | **1 Skill-Datei** |

Kosten Cloud-Anthropic: ~15 Cent/Mail (Sonnet ~10c Extract + Opus ~5c Analyse). Bei 10 Mails/Tag = ~45 €/Monat. Bei tatsächlichem Akquise-Volumen unter 5 Mails/Tag = ~20 €/Monat.

User-Entscheidung 2026-05-14: Qualität wichtiger als Sparen, Cloud-Variante akzeptiert.

---

## 4. Architektur

```
┌──────────────────────────────────────────────────────────────────┐
│  USER-AKTION (PC oder mobil per Outlook-App)                     │
│  Mail → M365-Ordner "CRM-Eingang"                                │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  CLOUD: Microsoft Graph Webhook                                  │
│  POST /api/akquise/webhook (UNVERÄNDERT)                         │
│  → Validation Token / Notification-Empfang                       │
│  → mail_queue.insert(status='pending')                           │
│  → fetch /api/akquise/process intern (Stage 1)                   │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  CLOUD: /api/akquise/process (Stage 1 — Mail-Ingest)             │
│   1. mail_queue.update(status='processing')                      │
│   2. fetchMail + fetchAttachments                                │
│   3. parseEmail (MIME-Anhänge extrahieren)                       │
│   4. resolveLink für jeden Online-Link → PDF                     │
│   5. uploadOneDrive in `_inbox/<message-id>/`                    │
│   6. _meta.json + .pending → in den Ordner                       │
│   7. mail_queue.update(status='ready_for_quickcheck')            │
│   → Antwort an Webhook, fertig in <10 Sek                        │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
                  ⋯⋯ asynchron ⋯⋯
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  EXTERN: cron-job.org (alle 1 Min)                               │
│  GET https://immo-crm-xi.vercel.app/api/akquise/process-queue    │
│  Mit Bearer-Token als Auth                                       │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  CLOUD: /api/akquise/process-queue (Stage 2 — Quick-Check)       │
│   1. SELECT * FROM mail_queue WHERE status='ready_for_quickcheck'│
│      ORDER BY received_at LIMIT 1                                │
│      (Sequenzielle Abarbeitung — 1 Mail pro Cron-Lauf,           │
│       Vercel-Hobby-Timeout 10 Sek)                               │
│   2. Wenn leer → 204 No Content, exit                            │
│   3. mail_queue.update(status='processing_quickcheck')           │
│   4. Skill von GitHub-raw-URL laden (mit 5-Min-Cache)            │
│   5. PDFs aus OneDrive runterladen (Graph-API)                   │
│   6. Sonnet 4.6 Call: PDFs + System-Prompt → strukturiertes JSON │
│   7. Opus 4.7 Call: JSON + Skill-Prompt → JSON + Markdown        │
│   8. CRM-Insert: contacts upsert, deals insert, activity_log     │
│   9. Markdown → OneDrive `Objekte/<Adresse>/quickcheck.md`       │
│  10. Ordner-Rename: `_inbox/<msg-id>/` → `Objekte/<Adresse>/`    │
│  11. mail_queue.update(status='done', deal_id=<id>)              │
│  ALARM-FALL: Wenn alles länger als 270 Sek (Vercel-Pro-Timeout)  │
│  oder 10 Sek (Hobby-Timeout) braucht: Job timeout-out, bleibt    │
│  auf 'processing_quickcheck', Cron versucht es nicht nochmal     │
│  (Stuck-Job-Detector siehe §6.4).                                │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  IMMOCRM (Lead sichtbar)                                         │
│  Lead-Liste zeigt neuen Eintrag mit Score, sortiert nach         │
│  priority_score DESC NULLS LAST                                  │
└──────────────────────────────────────────────────────────────────┘

   ⋮  SPÄTER: manueller Wiedereinstieg
   ⋮
┌──────────────────────────────────────────────────────────────────┐
│  Doppelklick auf <Adresse>.code-workspace (in OneDrive)          │
│   → VS Code öffnet Objekt-Ordner als Workspace                   │
│   → Claude Code startet im Terminal                              │
│   → User startet Aufteiler-Vollanalyse manuell                   │
└──────────────────────────────────────────────────────────────────┘
```

**Wichtig zum Vercel-Hobby-Timeout (10 Sek):**

Sonnet-Call + Opus-Call + OneDrive-Operationen passen **nicht** in 10 Sek. Lösungswege (zu entscheiden im Implementierungsplan):

- **L1:** Vercel-Pro-Upgrade (~20 €/Monat, 300 Sek Timeout, einfacher Code)
- **L2:** process-queue läuft auf **externem Worker** (z.B. Cloudflare Workers Free Tier, Render Free Tier) und ruft Anthropic + Supabase + Graph-API von dort. Vercel bleibt Hobby. Komplexer.
- **L3:** Splitten in 3 Sub-Endpoints (`extract`, `analyse`, `finalize`), Cron triggert sequenziell. Jeder Sub-Endpoint passt in 10 Sek. Komplex, fragil bei Mid-Step-Crashes.

**User-Vorgabe 2026-05-14:** Hobby-Plan beibehalten. Damit fallen L1 und L2 aus, bleibt L3 oder eine **vierte Option L4: Worker auf Cloudflare/Render**. Implementierungsplan wählt L3 oder L4 nach Detail-Recherche.

---

## 5. Komponenten im Detail

### 5.1 Webhook (`api/akquise/webhook.ts`) — UNVERÄNDERT

Akzeptiert Graph-Validation-Token + Change-Notifications, schreibt Eintrag in `mail_queue` mit `status='pending'`, ruft `/api/akquise/process` intern auf.

### 5.2 Process-Endpoint (`api/akquise/process.ts`) — STAGE 1

**Heutiger Stand** (Commit 5e13ffa): bereits abgespeckt auf Briefträger-Rolle, lädt Mail + PDFs nach `_inbox/<msg-id>/`, setzt `mail_queue.status='ready_for_quickcheck'`. **Bleibt so**, nur eine kleine Änderung:

- Bisheriger Status `ready_for_quickcheck` bleibt, aber semantisch interpretiert als "wartet auf Cloud-Quick-Check" statt "wartet auf lokalen Watcher"
- `.trigger`-Datei wird **nicht mehr geschrieben** (lokaler Watcher entfällt) — stattdessen reicht der DB-Status

### 5.3 Process-Queue-Endpoint (`api/akquise/process-queue.ts`) — STAGE 2, NEU

Hauptarbeit. Folgende Aufgaben:

**5.3.1 Auth & Single-Item-Pick**

```typescript
// Auth
if (req.headers.authorization !== `Bearer ${process.env.CRON_BEARER_TOKEN}`) {
  return res.status(401).end();
}

// 1 Item pro Cron-Lauf (Hobby-Timeout-Safety)
const { data: jobs } = await supabaseAdmin
  .from('mail_queue')
  .select('*')
  .eq('status', 'ready_for_quickcheck')
  .order('received_at', { ascending: true })
  .limit(1);

if (!jobs.length) return res.status(204).end();

const job = jobs[0];
await supabaseAdmin
  .from('mail_queue')
  .update({ status: 'processing_quickcheck', quickcheck_started_at: new Date().toISOString() })
  .eq('id', job.id);
```

**5.3.2 Skill von GitHub laden (5-Min-Cache)**

```typescript
const SKILL_RAW_URL = 'https://raw.githubusercontent.com/andre-petrov-creator/meine-projekte/main/Immobilien/Aufteiler/skills/aufteiler-modul-0-quickcheck/SKILL.md';

let skillCache: { content: string; ts: number } | null = null;

async function loadSkill(): Promise<string> {
  if (skillCache && Date.now() - skillCache.ts < 5 * 60_000) return skillCache.content;
  const content = await fetch(SKILL_RAW_URL).then(r => r.text());
  skillCache = { content, ts: Date.now() };
  return content;
}
```

Hinweis: Cache lebt nur in Vercel-Function-Instanz. Bei Cold-Start neu geladen. Akzeptabel.

**5.3.3 PDFs aus OneDrive laden**

OneDrive-API (Graph) → für jede PDF im `_inbox/<msg-id>/`-Ordner einen `GET /content`-Call. Buffer in Memory halten.

Skip: `_meta.json`, `.trigger`, `.pending`, `.error` (Non-PDF-Files).

**5.3.4 Sonnet-Call (Extraction)**

```typescript
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const extractResponse = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 4096,
  system: `Du bist Daten-Extraktor für Immobilien-Akquise. Aus den mitgelieferten PDFs (Exposé, Mietaufstellung, Energieausweis und ggf. weitere) extrahiere strukturierte Felder. Wähle selbst welche PDFs du für welche Felder brauchst. Antworte nur mit JSON, kein Markdown, kein erklärender Text.`,
  messages: [{
    role: 'user',
    content: [
      ...pdfBuffers.map(pdf => ({
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf', data: pdf.base64 }
      })),
      { type: 'text', text: 'Extrahiere als JSON: angebotspreis_eur, anzahl_we, adresse (straße, hausnummer, plz, stadt), stadtteil, baujahr, energieeffizienzklasse, gesamtflaeche_qm, jahresmieteinnahmen_eur (aus Mietaufstellung), exposetext (kurzer Originalauszug oder Zusammenfassung des Verkaufstexts), besonderheiten (Sanierungsbedarf, Lage, sonstiges)' }
    ]
  }]
});

const extractedJson = JSON.parse(extractTextBlock(extractResponse));
```

**5.3.5 Opus-Call (Analyse)**

```typescript
const skillContent = await loadSkill();

const analyseResponse = await anthropic.messages.create({
  model: 'claude-opus-4-7',
  max_tokens: 4096,
  system: `${skillContent}

  HINWEIS: Du läufst im Akquise-Modus (NICHT im Orchestrator-Modus). Die Inputs liegen als JSON vor, kein AskUserQuestion. Antworte mit JSON folgender Struktur:
  {
    "modul_0_json": { ... wie in Abschnitt 5 des Skills beschrieben ... },
    "markdown_report": "... Zonen A/B/C als Markdown gemäß Abschnitt 4 ..."
  }`,
  messages: [{
    role: 'user',
    content: `Quick-Check für folgendes Objekt:\n\n${JSON.stringify(extractedJson, null, 2)}`
  }]
});

const { modul_0_json, markdown_report } = JSON.parse(extractTextBlock(analyseResponse));
```

**Hinweis zum Skill-Modus-Check:** Skill wird in Sub-Step 5.7 angepasst — Abschnitt 1 (State laden) und Abschnitt 2 (AskUserQuestion) bekommen einen Modus-Check, der im Akquise-Modus diese Schritte überspringt. Berechnungs-Logik (Abschnitt 3) bleibt unverändert.

**5.3.6 CRM-Insert (Supabase REST)**

- `contacts` upsert (Email-Match aus `_meta.json.from`)
- `deals` insert mit `priority_score = modul_0_json.score`, `priority_reason`, `expose_source='mail-pipeline'`, `inbox_message_id=<msg-id>`, `expose_local_path=<finaler Ordnerpfad>`
- `activity_log` insert (type=`new_lead`)

**5.3.7 Markdown + Ordner-Rename**

- Adress-Slug aus `extractedJson.adresse` (Konvention aus `Aufteiler/CLAUDE.md`)
- Duplikat-Check OneDrive: existiert `Objekte/<slug>/` → Suffix `_2`, `_3`
- Move `_inbox/<msg-id>/` → `Objekte/<finalSlug>/` via Graph-API
- `quickcheck.md` in den umbenannten Ordner schreiben (Inhalt: `markdown_report`)
- `<finalSlug>.code-workspace` schreiben (Inhalt siehe §5.6)

**5.3.8 Cleanup**

- `mail_queue.update(status='done', deal_id, done_at=now())`

### 5.4 mail_queue Status-Erweiterung

Aktuelle Status (Migration 003): `pending`, `processing`, `done`, `error`. Spec vom 2026-05-14 hatte `ready_for_quickcheck` ergänzt (Migration 005). Cloud-Variante braucht zusätzlich `processing_quickcheck`.

**Migration `006_mail_queue_processing_quickcheck.sql`:**

```sql
-- Bestehender Check-Constraint (aus 005) erweitern um 'processing_quickcheck'
ALTER TABLE mail_queue DROP CONSTRAINT IF EXISTS mail_queue_status_check;
ALTER TABLE mail_queue ADD CONSTRAINT mail_queue_status_check
  CHECK (status IN ('pending', 'processing', 'ready_for_quickcheck', 'processing_quickcheck', 'done', 'error'));

-- Audit-Spalte
ALTER TABLE mail_queue ADD COLUMN IF NOT EXISTS quickcheck_started_at timestamptz;
```

### 5.5 Skill-Anpassung (`aufteiler-modul-0-quickcheck/SKILL.md`)

**Eine Datei für beide Modi.** Abschnitt 1+2 bekommen Modus-Check am Anfang:

```markdown
## 0. Modus-Check (NEU — erste Aktion)

- Wenn als Aufruf-Kontext **JSON mit extrahierten Feldern** geliefert wurde (`{angebotspreis_eur, anzahl_we, adresse, ...}`) → **Akquise-Modus**:
  - Überspringe Abschnitt 1 (kein state.json)
  - Überspringe Abschnitt 2 (keine AskUserQuestion — Inputs sind im JSON)
  - Springe direkt zu Abschnitt 3 (Berechnung)
  - Output: Statt state.json-Write → JSON-Antwort mit `modul_0_json` + `markdown_report`
- Sonst → **Orchestrator-Modus** (bisheriger Workflow):
  - Abschnitte 1, 2, 5 wie bisher
```

Abschnitt 3 (Berechnung), 4 (Zonen A/B/C), 6 (Self-Check) bleiben **vollständig unverändert** — die Logik gilt für beide Modi.

### 5.6 Wiedereinstiegs-Datei (`<slug>.code-workspace`)

Inhalt wie in §5.9 der vorigen Spec (`2026-05-14-akquise-pipeline-redesign.md`) — unverändert übernommen. Wird ab jetzt **von Vercel** geschrieben statt vom lokalen Skill.

### 5.7 Externer Cron-Trigger (cron-job.org)

**Setup:**
- Account-Anlage: `https://cron-job.org/de/signup` (kostenlos)
- Nach Account-Anlage: 1 Cron-Job konfigurieren
  - **URL:** `https://immo-crm-xi.vercel.app/api/akquise/process-queue`
  - **Methode:** GET
  - **Header:** `Authorization: Bearer <CRON_BEARER_TOKEN>` (eigener UUID-Token, in Vercel-ENV setzen)
  - **Schedule:** `* * * * *` (jede Minute)
  - **Timeout:** 15 Sek (kürzer als Vercel-Hobby-10-Sek-Limit ist nicht möglich, aber cron-job.org wartet halt 15 Sek bis es als failed gilt)
- Job zunächst **deaktiviert** lassen, bis Endpoint deployt ist

**Sicherheit:** Endpoint prüft Bearer-Token. Bei Mismatch → 401. Token nicht im Repo, nur in Vercel-ENV + cron-job.org-Job-Config.

---

## 6. Fehlerbehandlung & Edge Cases

### 6.1 PDF nicht lesbar / extrahierbare Daten fehlen

Sonnet liefert teilweise `null`-Felder. Skill (Opus) entscheidet:
- Fehlt `angebotspreis_eur` → status=error, Markdown: "Akquise-Quick-Check fehlgeschlagen: Angebotspreis nicht extrahierbar."
- Fehlt `adresse` → Ordner-Slug = `unbekannt-<msg-id>`, Lead trotzdem angelegt mit Subject als Pseudo-Adresse

### 6.2 OneDrive-Move-Konflikt (Ordner existiert schon)

Duplikat-Check via Graph-API `GET /drive/root:/Immobilien/001_AQUISE/Objekte/<slug>:/`:
- 404 → frei, move
- 200 → Suffix `_2`, `_3`, ... bis frei

### 6.3 Stuck-Job-Detector

Wenn ein Job 10+ Min auf `processing_quickcheck` steht (Vercel-Function gecrasht oder timeout): bei nächstem Cron-Lauf reset auf `ready_for_quickcheck` mit `quickcheck_started_at IS NULL OR < now() - interval '10 minutes'`. Maximal 3 Retries (neue Spalte `quickcheck_attempts int default 0`).

Migration `006` erweitern um:
```sql
ALTER TABLE mail_queue ADD COLUMN IF NOT EXISTS quickcheck_attempts int default 0;
```

### 6.4 Anthropic-API-Fehler

- Sonnet/Opus überlastet → automatisches Retry mit `--fallback-model`? **Nein**, hier explizit nicht — wir wollen wissen, wenn API hakt. Stattdessen: bei Fehler `mail_queue.status='error'`, `error_msg=<Stacktrace>`, manueller Re-Trigger.

### 6.5 Idempotenz

Wenn Graph denselben `messageId` doppelt liefert: `mail_queue.message_id` ist UNIQUE → Webhook-Insert schlägt fehl → Webhook ignoriert. Lead wird nicht doppelt angelegt.

---

## 7. Datenfluss-Sequenz (Happy Path)

```
14:23:00  User schiebt Mail in M365 CRM-Eingang
14:23:05  Microsoft Graph → Webhook
14:23:06  Vercel /api/akquise/webhook
14:23:07  mail_queue.insert(status='pending')
14:23:07  Webhook ruft /api/akquise/process
14:23:08  process: status='processing', fetchMail + Attachments
14:23:12  uploadOneDrive PDFs + _meta.json → _inbox/<msg-id>/
14:23:13  status='ready_for_quickcheck', HTTP 200
14:23:13  Stage 1 fertig.

14:24:00  cron-job.org → /api/akquise/process-queue
14:24:01  Endpoint: pick job, status='processing_quickcheck'
14:24:02  PDFs aus OneDrive laden
14:24:05  Sonnet-Call (Extract): ~3-8 Sek bei 3 PDFs á 20 Seiten
14:24:13  Opus-Call (Analyse): ~2-5 Sek
14:24:18  Skill von GitHub-raw-URL (gecached, ~0.1 Sek)
14:24:18  CRM-Insert (Supabase) parallel zu OneDrive-Operationen
14:24:21  Ordner-Rename + Markdown-Write + Workspace-Datei
14:24:23  status='done'
14:24:23  Stage 2 fertig.

14:24:24  Lead sichtbar in ImmoCRM, sortiert nach priority_score
```

**Latenz Mail → Lead:** ~60-90 Sek (abhängig von Cron-Timing + Anthropic-Antwortzeit). Vergleichbar zur lokalen Variante, aber ohne PC-Abhängigkeit.

**Warnung Hobby-Timeout:** Wenn Stage 2 länger als 10 Sek braucht (große PDFs, langsame Sonnet-Antwort), schlägt der Function-Call fehl. Lösung: Stuck-Job-Detector (§6.3) räumt auf, ABER der Quick-Check muss in eine andere Architektur (siehe §4 L3/L4-Diskussion). **Detail-Entscheidung im Implementierungsplan.**

---

## 8. Cloud-Code: Was bleibt, was kommt

### Files BLEIBEN (unverändert)

| Datei | Status |
|---|---|
| `api/akquise/webhook.ts` | unverändert |
| `api/akquise/process.ts` | unverändert (bereits in B1-B3 abgespeckt) |
| `api/_lib/fetchMail.ts` | unverändert |
| `api/_lib/parseEmail.ts` | unverändert |
| `api/_lib/resolveLink.ts` | unverändert |
| `api/_lib/uploadOneDrive.ts` | unverändert |
| `api/_lib/supabaseAdmin.ts` | unverändert |
| `scripts/setup-graph-subscription.mjs` | unverändert |

### Files NEU

| Datei | Inhalt |
|---|---|
| `api/akquise/process-queue.ts` | Stage-2-Endpoint (Auth, Item-Pick, Sonnet, Opus, CRM, OneDrive, Cleanup) |
| `api/_lib/loadSkill.ts` | GitHub-raw-URL-Fetcher mit 5-Min-Cache |
| `api/_lib/anthropicQuickCheck.ts` | Sonnet+Opus-Orchestrierung (zweistufig) |
| `api/_lib/onedriveOps.ts` | PDFs laden + Move-Operation + quickcheck.md schreiben |
| `api/_lib/crmInsert.ts` | Supabase contacts/deals/activity_log-Insert |
| `supabase/migrations/006_mail_queue_processing_quickcheck.sql` | Status + Audit-Spalten |

### Files RAUS

| Datei | Aktion |
|---|---|
| `Immobilien/akquise-watcher/*` | LÖSCHEN (uncommitted, sofort) |

### Files MODIFIZIERT

| Datei | Änderung |
|---|---|
| `Aufteiler/skills/aufteiler-modul-0-quickcheck/SKILL.md` | Abschnitt 0 (Modus-Check) hinzufügen, Abschnitte 1/2/5 mit Modus-Bedingung |
| `package.json` | `@anthropic-ai/sdk` als Dependency hinzufügen |

### Externe Systeme NEU

| System | Aktion |
|---|---|
| **cron-job.org** | Account anlegen, 1 Job (zunächst deaktiviert) konfigurieren |
| **Vercel ENV** | `ANTHROPIC_API_KEY`, `CRON_BEARER_TOKEN` hinzufügen |

---

## 9. Akzeptanzkriterien

| # | Kriterium | Verifikation |
|---|---|---|
| A1 | Mail in M365 CRM-Eingang → ≤ 2 Min später Lead in ImmoCRM | Test-Mail, manuell Lead-Liste prüfen |
| A2 | PDFs landen in OneDrive `_inbox/<msg-id>/`, dann umbenannt nach `Objekte/<Adresse>/` | OneDrive-Browser |
| A3 | `quickcheck.md` im Objekt-Ordner, Zonen A/B/C gefüllt | OneDrive-Browser |
| A4 | CRM-Eintrag hat `priority_score`, `priority_reason`, `expose_local_path` | ImmoCRM oder Supabase-Konsole |
| A5 | Bei Adress-Extraktions-Fehler: Lead trotzdem angelegt mit Pseudo-Adresse, status=error | Test-Mail mit Off-Market-Anhang |
| A6 | Idempotenz: dieselbe Mail doppelt → 1 Lead | Test-Mail re-trigger via Graph-Re-Notification |
| A7 | Stuck-Job-Recovery: künstlich `processing_quickcheck` setzen, 11 Min warten, Cron tickt → reset auf `ready_for_quickcheck` | DB-Manipulation + Wartezeit |
| A8 | Skill-Änderung auf GitHub → bei nächstem Lauf (max 5 Min später) aktiv | Skill ändern, Test-Mail, Vergleichen |
| A9 | Cron-Bearer-Token-Schutz: GET ohne Token → 401 | curl ohne Header |
| A10 | Token-Verbrauch pro Mail < 30 Cent | Anthropic-Konsole nach 5 Test-Läufen |

---

## 10. Risiken

| # | Risiko | Mitigation |
|---|---|---|
| R1 | Vercel-Hobby-10-Sek-Timeout reicht nicht für Sonnet+Opus | Detail-Entscheidung im Implementierungsplan: L3 (Splitting) oder L4 (externer Worker auf Cloudflare/Render). Falls beide untragbar → Pro-Upgrade-Empfehlung. |
| R2 | Anthropic-API-Limits (Rate-Limit, Quota) | Sequenzielle Verarbeitung (1 Mail pro Cron-Lauf) hilft. Bei Quota-Exceeded: status=error, manueller Restart. |
| R3 | GitHub-Ausfall → Skill nicht ladbar | 5-Min-Cache überbrückt kurze Ausfälle. Bei längerem Ausfall: Skill-Fallback als hartcodierter String im Vercel-Code (TBD im Plan). |
| R4 | Skill-Format-Drift (Skill-Änderung bricht JSON-Parsing) | JSON-Schema-Validation der Opus-Antwort. Bei Mismatch: error mit klarer Meldung "Skill-Output entspricht nicht erwartetem Schema". |
| R5 | PDF zu groß für Sonnet-Context-Window (200k Tokens) | Bei 40-Seiten-PDFs noch im Limit. Bei extrem großen Mailpaketen (10+ PDFs): pre-filter im Implementierungsplan vorzusehen. |
| R6 | Adress-Extraktion uneindeutig (mehrere Adressen im Exposé) | Sonnet bekommt Hint "verwende Hauptobjekt-Adresse, ignoriere Vergleichsobjekt-Adressen". Bei Konflikt → Opus markiert in Markdown als "Adresse-Unsicherheit, manuelle Prüfung empfohlen". |
| R7 | Anthropic-API-Kosten explodieren bei Backlog (z.B. 13 wartende Mails reaktiviert) | Cron arbeitet 1 Mail/Min → 13 Min für Backlog, ~3 € total. Akzeptabel. |
| R8 | cron-job.org-Ausfall | Pipeline pausiert, Mails bleiben auf `ready_for_quickcheck`. Nach Wiederherstellung wird abgearbeitet. Kein Datenverlust. |
| R9 | Graph-Subscription läuft am 2026-05-16 ab | Renew vor erstem Test-Mail-Lauf (User-Aufgabe, bereits angesprochen). |
| R10 | Skill-Modus-Check bricht Aufteiler-Vollanalyse (Regression) | Vor Skill-Änderung: lokaler Aufteiler-Modul-2-Test, dann Skill-Änderung, dann Re-Test Modul-2 muss grün bleiben. |

---

## 11. Cross-Projekt-Eingriffe

### 11.1 ImmoCRM-Repo

| Bereich | Aktion |
|---|---|
| `api/akquise/process-queue.ts` | NEU |
| `api/_lib/{loadSkill,anthropicQuickCheck,onedriveOps,crmInsert}.ts` | NEU |
| `api/akquise/process.ts` | Minimal: `.trigger`-Schreibvorgang entfernen |
| `package.json` + lockfile | `@anthropic-ai/sdk` hinzufügen |
| `supabase/migrations/006_mail_queue_processing_quickcheck.sql` | NEU |
| `docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md` | BANNER: ersetzt durch diese Spec |
| `docs/superpowers/specs/2026-05-14-akquise-pipeline-cloud-anthropic.md` | NEU (diese Datei) |
| `docs/02_implementierungsplan.md` | UPDATE Schritt 7 (Verweis auf neue Spec) |
| `docs/03_decisions.md` | NEUER ADR: "Akquise-Pipeline Quick-Check via Anthropic-API in Cloud, lokal verworfen" |
| `docs/04_progress.md` | UPDATE Schritt 7 Status |

### 11.2 Aufteiler-Repo

| Bereich | Aktion |
|---|---|
| `skills/aufteiler-modul-0-quickcheck/SKILL.md` | Modus-Check Abschnitt 0 hinzufügen |
| `docs/aufteiler-modul-0-quickcheck.md` | Modus-Erweiterung dokumentieren (falls Doku existiert) |
| `CLAUDE.md` | Hinweis ergänzen: Skill ist dual-mode |

### 11.3 Akquise-Watcher (wegwerfen)

| Bereich | Aktion |
|---|---|
| `c:\meine-projekte\Immobilien\akquise-watcher\` | LÖSCHEN (uncommitted) |

### 11.4 Mono-Repo-Root

| Bereich | Aktion |
|---|---|
| `c:\meine-projekte\README.md` | KEIN Eintrag `Immobilien/akquise-watcher/` |

### 11.5 Externe Systeme

| System | Aktion |
|---|---|
| **cron-job.org** | Account-Anlage + Job-Konfiguration (deaktiviert bis Endpoint live) |
| **Vercel ENV** | `ANTHROPIC_API_KEY`, `CRON_BEARER_TOKEN` setzen |
| **Supabase** | Migration `006` ausführen |
| **Microsoft Graph** | KEINE Änderung (Subscription bleibt) |
| **OneDrive** | KEINE Änderung (Struktur bleibt) |

---

## 12. Implementierungsplan-Skizze

Detail-Plan kommt separat via `superpowers:writing-plans`.

| # | Schritt | Aufwand | Hauptdateien |
|---|---|---|---|
| C1 | Wegwerfen: `akquise-watcher/`-Ordner löschen | 0.1 h | Filesystem |
| C2 | DB-Migration `006_mail_queue_processing_quickcheck.sql` | 0.5 h | supabase/migrations |
| C3 | Skill-Anpassung Abschnitt 0 (Modus-Check) | 1 h | `Aufteiler/skills/aufteiler-modul-0-quickcheck/SKILL.md` |
| C4 | Vercel-Helper-Libs (`loadSkill`, `anthropicQuickCheck`, `onedriveOps`, `crmInsert`) | 3 h | `api/_lib/*` |
| C5 | `process-queue.ts` Endpoint bauen | 2 h | `api/akquise/process-queue.ts` |
| C6 | Hobby-Timeout-Strategie entscheiden + bauen (L3-Split oder L4-Worker) | 2-4 h | je nach Wahl |
| C7 | Vercel-ENV setzen (`ANTHROPIC_API_KEY`, `CRON_BEARER_TOKEN`) + Deploy | 0.5 h | Vercel-Dashboard |
| C8 | cron-job.org Job aktivieren | 0.2 h | externe Web-UI |
| C9 | E2E-Test mit selbst geschickter Test-Mail | 1.5 h | Manual |
| C10 | Doku-Updates (banner alte Spec, decisions, progress) | 1 h | docs/* |
| C11 | Entscheidung 13 wartende Mails: reaktivieren? | 0-1 h | M365 |

**Gesamt: ~12-15 h**

---

## 13. The One Thing to Do First

**Sub-Punkt C6 vorab klären: passt Sonnet+Opus + OneDrive-Operationen in 10 Sek Vercel-Hobby-Timeout?**

Falls **nein** → L3 (Splitting in 3 Endpoints) oder L4 (externer Worker) entscheiden. Falls **ja** → einfacher Single-Endpoint reicht.

Empirisch zu messen mit einem Spike-Test in C5: einmal Sonnet + Opus + OneDrive-Move durchspielen, Zeit messen. Auf Hobby deployen, schauen ob's reicht.

Falls knapp (>8 Sek): L3 oder L4. Falls deutlich drüber (>15 Sek): Pro-Upgrade-Empfehlung trotz User-Vorgabe — Cron-Splitting auf Hobby bringt mehr Komplexität als ein 20-€-Upgrade.

---

## 14. Change-Log

| Datum | Änderung | Autor |
|---|---|---|
| 2026-05-14 | Initial Spec nach Brainstorming-Pivot (lokaler Watcher → Cloud-Anthropic) | André + Claude Code |
