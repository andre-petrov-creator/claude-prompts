# Akquise-Pipeline (Cloud) — Design

**Status:** Spec (Phase: Brainstorming abgeschlossen, Implementierungsplan ausstehend)
**Datum:** 2026-05-11
**Autor:** André Petrov (mit Claude Code, Council-Methode für Architektur-Weiche)
**Verortung:** Teilprojekt im Mono-Repo `meine-projekte\Immobilien\`, Code lebt im ImmoCRM-Vercel-Projekt (Edge Functions), Spec hier dokumentiert

---

## 1. Zweck und Scope

Eingehende Makler-Mails sollen **automatisch** ins ImmoCRM einfließen — aber nur die, die der User für eingangswürdig hält. Der Mensch entscheidet **vor** der Pipeline (Mail in Outlook-Ordner sortieren), die Pipeline entscheidet **innerhalb** der Pipeline (QuickCheck-Score), und der Mensch entscheidet **nach** der Pipeline (welche Top-Leads gehen in den Aufteiler für volle Kalkulation).

**Drin im MVP:**

- Cloud-Trigger via IMAP-Poll auf `andre-petrov@web.de`, Filter = Outlook-Ordner "CRM-Eingang"
- Extraktion aus PDF-Anhang / Online-Link / Mailtext
- OneDrive-Upload der Mail-Inhalte (PDFs, Mailtext, Meta)
- QuickCheck-Bewertung (Logik separat zu definieren — siehe Open-Items §8)
- Lead-Anlage im ImmoCRM (Supabase) mit Priority-Score
- Erweiterung des Daily Briefing (ImmoCRM-Schritt 8) um die neuen Leads + Priorisierung
- Pfad-Kopier-Button im CRM für Aufteiler-Trigger (Browser-unabhängig)

**Raus aus dem MVP:**

- Automatischer Aufteiler-Trigger (manuell wie heute, MVP-Phase 2 optional)
- Custom URL-Scheme für 1-Klick-Ordner-Öffnen (Phase 2)
- Multi-Channel-Ingest (WhatsApp, Scraper, Voice — Council-Expansionist-Vision, nicht jetzt)
- Lernender Priority-Score auf Basis von gekauften Leads (Phase 3+)

---

## 2. Stand vor diesem Spec

Es existiert bereits ein lokales Python-Projekt `automatisierung-aquise` (Mono-Repo-Root, nicht unter `Immobilien\`), das:

- Mails via IMAP-IDLE auf **Gmail** abholt (User leitet web.de → Gmail weiter)
- Filter `FROM = andre-petrov@web.de`
- PDF-Anhänge + Links extrahiert, klassifiziert (Filename-Heuristik), Objekt-Adresse extrahiert
- In lokale Ordner unter `001_AQUISE\Objekte\<Adresse>\` ablegt
- Schritt 10 (Hardening) ist als done markiert, Health-Check läuft wöchentlich

**Schmerzen mit dem heutigen Stand** (vom User benannt):

1. Mail-Source via Gmail-Weiterleitung ist Umweg
2. Output endet bei Ordnern — kein CRM-Lead
3. Kein QuickCheck / keine Priorisierung
4. PC-Abhängigkeit (Daemon läuft nur wenn PC an) — Council bestätigt: bricht die "unterwegs"-Anforderung

**Konsequenz:** Die neue Cloud-Pipeline ersetzt funktional die alte Python-Pipeline. Der bestehende Code dient als Wissens-Referenz (Regex-Heuristiken, Adress-Extraktor, PDF-Klassifikator) für die TypeScript-Neuimplementierung.

---

## 3. Architektur (Cloud-Variante A + OneDrive)

```
┌──────────────────────────────────────────────────────────────────┐
│  USER-AKTION (am PC oder mobil per web.de-App)                   │
│  Mail aus web.de-Inbox → Outlook-Ordner "CRM-Eingang"            │
│  (IMAP-Server-Status, synct zu allen Clients)                    │
└─────────────────────────┬────────────────────────────────────────┘
                          │
                          │ (alle 5 Min)
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  TRIGGER:  cron-job.org                                          │
│  POST https://immo-crm-xi.vercel.app/api/cron/akquise-poll       │
│  Header: Authorization: Bearer ${CRON_SECRET}                    │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  VERCEL EDGE FUNCTION: /api/cron/akquise-poll (TypeScript)       │
│  1. IMAP-Connect → imap.web.de:993 (App-Passwort)                │
│  2. SELECT "CRM-Eingang"                                         │
│  3. SEARCH UNSEEN (oder UID > last_processed_uid)                │
│  4. Pro Mail: UID + Message-ID erfassen                          │
│  5. Idempotenz-Check via Supabase-State-Tabelle                  │
│  6. Für jede neue Mail: Stage-Worker triggern (siehe unten)      │
│  7. IMAP \Seen-Flag setzen + State markieren                     │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  STAGE-WORKER (zweiter Vercel-Endpoint, /api/akquise/process)    │
│  Wegen 60s-Limit: Poll-Function queued in `mail_queue` Tabelle,  │
│  Stage-Worker arbeitet pro Mail in eigener Function-Invocation.  │
│                                                                  │
│  Stages pro Mail:                                                │
│   m02 Email Parse:  PDF-Anhänge → Buffer, Links extrahieren      │
│   m03 Link Resolve: Online-Link → PDF (via fetch / pdf-render)   │
│   m04 PDF Classify: typ ∈ {expose, mieterliste, energie, ...}    │
│   m05 Address Extract: Regex + LLM-Fallback (Anthropic API)      │
│   m06 OneDrive Upload: Microsoft Graph API → Adress-Ordner       │
│   m07 QuickCheck Score: TBD-Modul (siehe Open-Items §8)          │
│   m08 CRM Lead Insert: Supabase, contacts + deals + score        │
│   m09 State Mark Done: mail_queue.status = 'done'                │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  IMMOCRM (lese Supabase wie heute)                               │
│  Lead-Liste sortierbar nach `priority_score` (neue Spalte)       │
│  Top-Score zuerst, Aufteiler-Pfad-Kopier-Button pro Lead         │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼ (8 Uhr Mo-Fr, ADR-007)
┌──────────────────────────────────────────────────────────────────┐
│  DAILY BRIEFING (ImmoCRM-Schritt 8, ERWEITERT)                   │
│  - Heute eingegangen: N Leads                                    │
│  - QuickCheck durchgelaufen: N → davon X "hot", Y "warm", Z "no" │
│  - Top 5 nach Priority-Score (Adresse, €/m², Score, Begründung)  │
│  - Restliches Briefing wie bisher (Nachfass, Besichtigungen, ...) │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Komponenten im Detail

### 4.1 Cron-Trigger (cron-job.org)

- Schedule: `*/5 * * * *` (alle 5 Min, Mo–So 0–24, anders als Briefing-Cron der nur Mo–Fr 8 Uhr läuft)
- Timezone: `Europe/Berlin` (egal, weil 5-Min-Intervall)
- Method: `POST`, Header `Authorization: Bearer ${CRON_SECRET}`
- Failure-Notification: bei HTTP-non-200 Mail an `andre-petrov@web.de` (cron-job.org native Funktion)

**Konfiguration zentral in `03_decisions.md` als ADR-011** (anlegen bei Bau).

### 4.2 Vercel Edge Function — Poll-Endpoint

**Datei:** `app/api/cron/akquise-poll/route.ts`

**Verantwortung:** dünner Poll-Wrapper, kein PDF-Processing.

**Pseudocode:**

```typescript
export async function POST(req: Request) {
  if (!authBearerOk(req)) return new Response('Unauthorized', { status: 401 });

  const client = await imapClient(IMAP_WEBDE_USER, IMAP_WEBDE_APP_PASSWORD);
  await client.mailboxOpen('CRM-Eingang');
  const newUids = await client.search({ seen: false });

  for (const uid of newUids) {
    const mail = await client.fetchOne(uid, { envelope: true, source: true });
    if (await isAlreadyProcessed(mail.envelope.messageId)) {
      await client.messageFlagsAdd(uid, ['\\Seen']);
      continue;
    }
    await enqueueForProcessing({
      messageId: mail.envelope.messageId,
      uid,
      rawSource: mail.source,
    });
    await client.messageFlagsAdd(uid, ['\\Seen']);
  }
  await client.logout();
  return new Response('OK', { status: 200 });
}
```

**Constraints:**

- 60s-Vercel-Hobby-Limit: bei 20 Mails Backlog (Worst-Case) muss der Poll-Endpoint nur Metadaten + raw_source in die Queue schreiben. Schwere Arbeit macht der Stage-Worker.
- IMAP-Connection-Pool: web.de erlaubt typischerweise 5 parallele Connections. Bei einem User unkritisch.

### 4.3 Vercel Function — Stage-Worker

**Datei:** `app/api/akquise/process/route.ts`

**Verantwortung:** alle Stages pro Mail. Wird vom Poll-Endpoint nach jedem Enqueue aufgerufen (`fetch` im Hintergrund, `waitUntil` Pattern) — ODER vom zweiten Cron-Job ("`process-queue`", alle 2 Min) als Robustheits-Pfad.

**Stages** (als isolierte Module unter `app/api/akquise/_lib/`):

- `parseEmail.ts` — entpackt MIME, PDF-Buffer + Links
- `resolveLink.ts` — Online-Link → PDF via Headless-Fetch oder pdf-render-Service (wenn HTML-Exposé)
- `classifyPdf.ts` — Filename-Heuristik (`expose|mieterliste|energie|modernisierung|sonstiges`)
- `extractAddress.ts` — Regex-First mit Trigger-Heuristik ("Lage", "Objekt", "Anschrift") + Anthropic-Fallback bei Confidence < 0.7
- `uploadOneDrive.ts` — Microsoft Graph API (siehe §4.5)
- `quickCheck.ts` — **TBD** (Stub bis Open-Item §8 entschieden ist, returns `{ score: 50, reason: 'placeholder' }`)
- `insertLead.ts` — Supabase Upsert auf `contacts` (Email-Unique via ADR-003 generated column) + Insert `deals` mit `priority_score`

**60s-Limit:**

- LLM-Call für Adress-Extract: ~5–10s
- LLM-Call QuickCheck: ~5–15s
- OneDrive-Upload (PDFs ~2–10 MB): ~3–8s
- Total Worst-Case: ~30s pro Mail — gut innerhalb 60s

### 4.4 Idempotenz und State

**Neue Supabase-Tabelle:** `mail_queue`

```sql
CREATE TABLE mail_queue (
  message_id      text PRIMARY KEY,           -- Mail Envelope Message-ID, eindeutig
  imap_uid        integer NOT NULL,
  status          text NOT NULL,              -- pending | processing | done | error
  enqueued_at     timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  done_at         timestamptz,
  error_msg       text,
  deal_id         uuid REFERENCES deals(id)   -- gesetzt nach insertLead
);
CREATE INDEX idx_mail_queue_status ON mail_queue(status);
```

**Garantien:**

- Pro `message_id` exakt ein Lead (Webhook-Retries blockt der Unique-PK)
- Crash während `processing` → State bleibt auf `processing` mit `started_at < now() - 10min` → vom zweiten Cron als "stale" erkannt und retried
- Fehler beim QuickCheck-LLM-Call → Lead trotzdem angelegt mit `priority_score = NULL` + `error_msg`, manuell prüfbar
- Council-Reviewer-5-Empfehlung: Message-ID-Unique-Constraint ist die Idempotenz-Garantie

### 4.5 OneDrive-Anbindung (Microsoft Graph API)

**Setup:**

1. App in Azure AD registrieren (Microsoft Entra) — App-Type "Web App"
2. API-Permission: `Files.ReadWrite.All` (delegated) für persönliches OneDrive
3. OAuth 2.0 Authorization Code Flow:
   - Einmaliger Browser-Login (`andre-petrov@...`)
   - Refresh-Token in Vercel Env speichern (`MS_GRAPH_REFRESH_TOKEN`)
   - Access-Token wird aus Refresh-Token bei jedem Pipeline-Lauf neu geholt (1h TTL)
4. Ordner-Pfad: `/me/drive/root:/Immobilien/001_AQUISE/Objekte/<Adresse>/`

**Upload-Strategie:**

```typescript
// PUT /me/drive/root:/Immobilien/001_AQUISE/Objekte/{Adresse}/{Filename}:/content
// Body: PDF-Buffer
// Headers: Content-Type: application/pdf
```

- Bei großen PDFs (> 4 MB) `createUploadSession` statt direkter PUT
- Datei-Naming wie heute: `Exposé.pdf`, `Mieterliste.pdf`, ..., `_meta.json` mit `{ message_id, von, subject, timestamp, files: [...] }`
- Duplikat-Ordner: `_2`, `_3` Suffix wie heute

**Pfad-String fürs CRM:**

- Microsoft Graph liefert `webUrl` (OneDrive-Web-Link) und einen lokalen Sync-Pfad-Hinweis
- `expose_local_path` im CRM-Schema wird befüllt mit dem Windows-Pfad: `C:\Users\andre\OneDrive - APPV Personalvermittlung\Immobilien\001_AQUISE\Objekte\<Adresse>\`
- Hardcoded `BASE_LOCAL_PATH` in Pipeline-Config; `<Adresse>`-Teil dynamisch

### 4.6 Pfad-Kopier-Button im CRM

**Datei:** Erweiterung des Schritt-3-Notiz-Panels (`features/leads/lead-detail-panel.tsx` oder ähnlich)

**Funktion:**

```tsx
<Button onClick={() => navigator.clipboard.writeText(deal.expose_local_path)}>
  📋 Ordner-Pfad kopieren
</Button>
```

- Toast: "Pfad kopiert. Drücke Win+E → Strg+V → Enter"
- Browser-unabhängig (Clipboard-API funktioniert in allen modernen Browsern auf HTTPS)

**Optionaler Phase-2-Upgrade:** Custom URL-Scheme `immocrm://open?path=...` mit `.reg`-Datei + PowerShell-Helper. Nicht im MVP.

### 4.7 ImmoCRM-DB-Erweiterungen

**Neue Spalten auf `deals`:**

```sql
ALTER TABLE deals ADD COLUMN priority_score    integer;        -- 0..100, NULL bis QuickCheck lief
ALTER TABLE deals ADD COLUMN priority_reason   text;           -- 1-Satz-Begründung vom QuickCheck
ALTER TABLE deals ADD COLUMN expose_source     text;           -- 'mail-pipeline' | 'manual' | 'aufteiler' (Herkunft)
ALTER TABLE deals ADD COLUMN inbox_message_id  text;           -- Verweis auf mail_queue (NULL bei manual/aufteiler)
CREATE INDEX idx_deals_priority_score ON deals(priority_score DESC NULLS LAST) WHERE deleted_at IS NULL;
```

**Lead-Liste-UI (ImmoCRM-Schritt 2 wird ergänzt):**

- Neue Spalte "Priorität": Badge mit Score + Tooltip-Begründung
- Default-Sort: `priority_score DESC NULLS LAST, created_at DESC`
- Filter: Score-Range-Slider (0..100)

### 4.8 Daily-Briefing-Erweiterung

**Schritt 8 ImmoCRM** wird ergänzt um eine neue Sektion **vor** Performance:

```
🆕 HEUTE EINGEGANGEN (4)
   Davon QuickCheck durchgelaufen: 3 (1 ausstehend)

🔥 TOP-5 NACH PRIORITÄT
   1. (Score 89)  Talstr 10, 44137 Dortmund  | 2.150 €/m² | 8 WE
                  "MFH Bestand, unter Marktpreis, gute Lage"
   2. (Score 76)  ...
   ...

⚠️ AUSSORTIERT (Score < 30)
   2 Leads — siehe CRM-Liste mit Filter "Score < 30"
```

Rest des Briefings (Überfällig / Heute Fällig / Performance / Pipeline) bleibt wie in `01_projektbeschreibung.md` §4.5 spezifiziert.

---

## 5. Datenfluss-Sequenz (Happy Path)

```
14:23:00  User mobil per web.de-App: Mail "Exposé MFH Dortmund" → Ordner "CRM-Eingang"
14:25:00  cron-job.org POST /api/cron/akquise-poll
14:25:01  Edge Function: IMAP-Connect, SELECT CRM-Eingang, SEARCH UNSEEN → 1 Mail
14:25:02  isAlreadyProcessed('<msg-id>') → false
14:25:02  Enqueue in mail_queue (status='pending')
14:25:03  Trigger /api/akquise/process via internal fetch (waitUntil)
14:25:03  IMAP \Seen-Flag gesetzt, Poll-Function fertig (200 OK)
14:25:04  Stage-Worker startet:
14:25:04    parseEmail → 1 PDF (Exposé), 0 Links
14:25:05    classifyPdf → 'expose'
14:25:07    extractAddress → "Talstr 10, 44137 Dortmund" (LLM, Confidence 0.92)
14:25:12    uploadOneDrive → /Immobilien/001_AQUISE/Objekte/Talstr 10, 44137 Dortmund/Exposé.pdf
14:25:14    quickCheck → { score: 78, reason: "Bestand MFH, gute Lage, 1.950 €/m²" }
14:25:15    insertLead → deals row mit priority_score=78
14:25:15    mail_queue.status = 'done'
14:25:15  Lead sichtbar im CRM, Top-Position der Liste
08:00:00  (nächster Morgen, ADR-007 Briefing-Cron)
          Daily Briefing zeigt Lead in "Top-5 nach Priorität"
```

---

## 6. Risiken und Council-Findings

Aus der Council-Sitzung 2026-05-11 (5 Advisors + 5 Peer-Reviews):

| # | Risiko / Finding | Mitigation in dieser Spec |
|---|---|---|
| R1 | **Parser-Qualität ist der eigentliche Engpass** (nicht Pipeline-Plumbing). Bei 30 % LLM-Fehlerquote ist die Latenz egal. | Mitigation: 20-Mail-Stichprobe vor Bauakzeptanz (siehe §10 Akzeptanzkriterien). LLM-Fallback bei Adress-Confidence < 0.7. `_meta.json` enthält Original-Mail-Header zum manuellen Audit. |
| R2 | **web.de IMAP-App-Passwort verfügbar?** | 30-Min-Spike (siehe §13 First Step und §8.2) — wenn web.de kein App-Passwort für IMAP anbietet, fällt Variante A. Fallback: Variante B (Forwarding) mit DSGVO-Hinweis. |
| R3 | **IMAP-Connection-Limits web.de** | Pro Poll 1 Connection, sofort `logout()`. Bei Connection-Refused: Exponential Backoff im Poll-Endpoint, kein Crash. |
| R4 | **60s-Vercel-Hobby-Limit** | Trennung Poll vs. Stage-Worker. Poll = nur Enqueue. Stage-Worker = pro Mail eine Invocation. Bei Worst-Case 20 Mails Backlog: 20 separate Invocations seriell oder parallel. |
| R5 | **Idempotenz bei Webhook-Retries** | `mail_queue.message_id` als PRIMARY KEY (Unique-Constraint). Duplikat-Insert wirft sauberen `unique_violation`, wird vom Poll-Endpoint als "schon verarbeitet" interpretiert. |
| R6 | **OneDrive-OAuth-Token-Refresh schlägt fehl** (Refresh-Token expired oder revoked) | Health-Check täglich (Erweiterung Health-Check-Mail Dienstag-9-Uhr-Routine): Probe-Call gegen Graph API, bei 401 → Alarm-Mail an User mit Re-Auth-Link. |
| R7 | **DSGVO bei Cloud-Verarbeitung** (Anthropic-API in US, OneDrive in EU/MS-Tenant) | Bestehende ADR-009-Skizze (ImmoCRM) deckt es teilweise ab. **Erweitern um Pipeline-Datenfluss** (zusätzlicher Eintrag in ADR-009 als ADR-012 oder Update). |
| R8 | **QuickCheck-Logik undefiniert** | Explizit als Open-Item §8 markiert. Pipeline läuft mit Stub-QuickCheck (Score = 50), bis Logik definiert ist. |
| R9 | **Premature Automation** (Council-Contrarian) — manuelle Lead-Anlage bei 5–20 Mails/Tag wäre 10 Min/Tag | Akzeptiert als Hypothese-vs-Realität: nach 4 Wochen MVP-Betrieb evaluieren, ob Pipeline-Bau sich amortisiert. |
| R10 | **Multi-Channel-Ingest-Vision** (Council-Expansionist) — WhatsApp, Scraper, Voice | Bewusst nicht im MVP. Architektur lässt es zu (`expose_source`-Feld erlaubt neue Kanäle ohne Schema-Change). |

---

## 7. Migration vom bestehenden `automatisierung-aquise`

**Status quo:** Lokales Python-Projekt unter `c:\meine-projekte\automatisierung-aquise\` mit Module m01–m08, voll funktional, läuft via Task Scheduler.

**Migration:**

1. **Code wird obsolet**, NICHT gelöscht. Das Projekt bleibt im Repo als historische Referenz für die TypeScript-Neuimplementierung (Regex-Heuristiken in `modules/m05_address_extractor.py`, PDF-Klassifikator-Patterns in `m04_pdf_classifier.py`).
2. **Task Scheduler-Aufgaben deaktivieren** sobald die Cloud-Pipeline produktiv ist (`Akquise-Pipeline` und `Akquise-Pipeline-HealthCheck`).
3. **Gmail-Forwarding von web.de abschalten** sobald die Cloud-Pipeline web.de direkt scannt (sonst doppelte Verarbeitung).
4. **Bestehende OneDrive-Ordner unter `001_AQUISE\Objekte\`** bleiben — die neue Pipeline schreibt in dieselbe Struktur weiter.
5. **README im alten Projekt** auf "Deprecated, ersetzt durch Cloud-Pipeline (siehe ImmoCRM/docs/superpowers/specs/2026-05-11)" updaten.

---

## 8. Open-Items (vor Pipeline-Bau zu klären)

### 8.1 QuickCheck-Logik + Priorisierung

**Status:** vom User explizit als später zu definieren markiert.

**Was zu definieren ist:**

- Eingangs-Daten aus dem Exposé: welche Felder zählen (€/m², Wohnfläche, Einheiten, Adresse/Lage, Miete-falls-bekannt, Baujahr-falls-bekannt, ...)
- Bewertungs-Methode: Aufteiler-Light (stripped-down) vs. eigenständige Formel vs. LLM-Bewertung mit Investment-Profil
- Score-Skala (0..100 empfohlen) und Schwellwerte ("hot" ≥ 70, "warm" 40-69, "no" < 40)
- Begründungs-Text (1 Satz pro Lead, vom LLM oder als Template)
- Priorisierung-Darstellung im CRM: Badge-Farbe, Sort-Default, Filter

**Abhängigkeiten:**

- Pipeline-Stub-QuickCheck (`quickCheck.ts` returns `{ score: 50, reason: 'placeholder' }`) erlaubt Pipeline-Bau parallel zur QuickCheck-Definition
- Schema-Spalten `priority_score` und `priority_reason` sind bereits jetzt im Spec (§4.7) — keine spätere Migration nötig

**Trigger für nächste Brainstorming-Session:** vor Implementierungs-Schritt "QuickCheck-Modul" (Schritt-Plan TBD).

### 8.2 30-Min-Spike: web.de App-Passwort + IMAP

**Was zu prüfen ist:**

1. Hat web.de Freemail (andre-petrov@web.de) App-Passwörter für IMAP/SMTP?
   - web.de-Einstellungen → Sicherheit → App-Passwörter
   - Wenn ja: App-Passwort generieren, in Vercel Env als `WEBDE_IMAP_APP_PASSWORD` setzen
2. Funktioniert IMAP-Login mit Standard-Library (z.B. `imapflow` für Node) gegen `imap.web.de:993`?
   - Test-Script lokal: Login, SELECT INBOX, LIST → Ordner-Liste ausgeben
3. Existiert der Ordner "CRM-Eingang" bereits in Outlook und wird er via IMAP-LIST gefunden?
   - Sonst Ordner in Outlook anlegen, IMAP-Sync abwarten, dann LIST erneut

**Wenn alle 3 ✅:** Variante A bestätigt, Bau kann starten.
**Wenn 1 ❌:** auf Variante B (Forwarding) ausweichen — Re-Design dieser Spec nötig, DSGVO-Check zwingend.

**Trigger:** vor Schritt 1 des Implementierungsplans.

### 8.3 OneDrive-OAuth-Setup

**Was zu prüfen ist:**

- Welcher Microsoft-Account besitzt das OneDrive? Persönlich (`@outlook.com`) oder Geschäfts-Tenant (`@petrov-wohnen.de`)?
- Azure-AD-App-Registrierung: Single-Tenant vs. Multi-Tenant
- Test-Upload: PUT auf `/me/drive/root:/test.txt:/content` mit Token → 201 Created?

**Trigger:** parallel zu Schritt 8.2, im selben Spike.

### 8.4 DSGVO-Datenfluss-Update

**Was zu prüfen ist:**

- ADR-009 (ImmoCRM) erweitern um den neuen Datenfluss: Mail-Inhalt → Vercel (Frankfurt-Region) → Anthropic (US) für Extraktion + QuickCheck → OneDrive (MS-Tenant-Region) → Supabase (Frankfurt)
- AVV mit Anthropic (Plus/Team/Enterprise-Plan)
- AVV mit Microsoft (Standard im 365-Plan)
- Auskunfts-/Löschrecht: Pipeline muss `mail_queue` + zugehörige OneDrive-Files + `deals/contacts`-Einträge auf Anfrage löschen können

**Trigger:** vor Produktivnahme der Pipeline (nicht vor Bau-Start).

---

## 9. Akzeptanzkriterien für MVP

| # | Kriterium | Verifikation |
|---|---|---|
| A1 | Mail aus "CRM-Eingang" → ≤ 5 Min später im CRM als Lead | E2E-Test mit Test-Mail (Subject "TEST", PDF-Anhang) |
| A2 | Mobile Sortierung funktioniert | Manuell: vom Handy aus web.de-App Mail in Ordner schieben → Lead im CRM sichtbar |
| A3 | OneDrive-Ordner wird angelegt mit korrektem Adress-Namen | Manuell: Explorer öffnen, `001_AQUISE\Objekte\` nach neuem Eintrag prüfen |
| A4 | PDF + `_meta.json` im OneDrive-Ordner | Datei-Inhalt prüfen, `_meta.json` enthält Mail-Header |
| A5 | Lead hat `expose_local_path` mit funktionierendem Windows-Pfad | Im CRM Lead öffnen, "Pfad kopieren" → in Explorer einfügen → Ordner geht auf |
| A6 | Idempotenz: dieselbe Mail (selbe Message-ID) → kein Duplikat-Lead | Test-Mail via "Erneut senden" doppelt zustellen, Lead-Count = 1 |
| A7 | Fehler in einer Stage (z.B. Adress-Extract fehlgeschlagen) → Lead wird mit Fallback-Marker angelegt, Pipeline crasht nicht | Test-Mail ohne erkennbare Adresse → Lead mit `address = NULL` + Error im `mail_queue.error_msg` |
| A8 | Stichprobe 20 echte Akquise-Mails durchlaufen | Mindestens 17/20 mit korrekt extrahierter Adresse + erkanntem PDF-Typ + ohne Crash |
| A9 | Briefing 8 Uhr enthält neue Sektion "Heute eingegangen" + "Top-5 nach Priorität" | Manueller Trigger der Briefing-Function, Mail prüfen |
| A10 | Bestehende Python-Pipeline ist deaktiviert (kein Doppel-Verarbeiten) | Task Scheduler-Status "Disabled" + Gmail-Forwarding aus |
| A11 | Kritische Logik mit Vitest-Tests abgesichert (gemäß DEVELOPMENT_GUIDELINES §Tests) | `extractAddress`, `classifyPdf`, Idempotenz-Check `mail_queue`, `quickCheck`-Schwellwerte sobald definiert |
| A12 | Doku-Pflege nach jedem Bau-Schritt | `04_progress.md` markiert Schritt ✅ mit Datum, neue ADRs in `03_decisions.md` (siehe §11), Commit-Message conventional-style (`feat(akquise): …`) |

---

## 10. Cross-Projekt-Eingriffe

Das Bauen dieser Pipeline berührt **mehrere Repos und Systeme** im Mono-Repo `meine-projekte`. Jede Berührung ist hier explizit aufgelistet, damit kein Schritt vergessen oder doppelt gemacht wird.

### 10.1 ImmoCRM-Repo (`c:\meine-projekte\Immobilien\ImmoCRM\`) — Haupt-Eingriff

| Bereich | Aktion |
|---|---|
| `app/api/cron/akquise-poll/route.ts` | NEU: Poll-Endpoint, ruft IMAP web.de auf, enqueued in `mail_queue` |
| `app/api/akquise/process/route.ts` | NEU: Stage-Worker für eine Mail (alle m02–m08-Stages) |
| `app/api/akquise/_lib/*.ts` | NEU: Module pro Stage (parse, classify, extract, upload, quickCheck-Stub, insertLead) |
| `supabase/migrations/003_mail_queue.sql` | NEU: Tabelle `mail_queue` (siehe §4.4) |
| `supabase/migrations/004_deals_priority_score.sql` | NEU: Spalten `priority_score`, `priority_reason`, `expose_source`, `inbox_message_id` (siehe §4.7) |
| `src/types/supabase.ts` | REGENERIEREN nach jeder Migration via `supabase gen types typescript --project-id <id> > src/types/supabase.ts` (gemäß GUIDELINES §TypeScript) |
| `src/components/leads/LeadTable.tsx` | ERWEITERN: neue Spalte "Priorität" (Badge + Tooltip), Default-Sort `priority_score DESC` |
| `src/components/leads/LeadDetailPanel.tsx` | ERWEITERN: Pfad-Kopier-Button (`navigator.clipboard.writeText`), Toast via shadcn `sonner` |
| `src/hooks/useDeals.ts` | ERWEITERN: Sort/Filter nach `priority_score` |
| `src/features/daily-briefing/template.ts` (oder Edge-Function-Inhalt von Schritt 8) | ERWEITERN: neue Sektion "Heute eingegangen" + "Top-5 nach Priorität" |
| `docs/02_implementierungsplan.md` | UPDATE: neue Schritte einreihen (vor Schritt 7 oder als Schritte 7a/7b) |
| `docs/03_decisions.md` | UPDATE: ADR-011 (cron-job.org-Akquise-Schedule), ADR-012 (Microsoft-Graph-Auth-Strategie), ADR-013 (DSGVO-Update vs. ADR-009) |
| `docs/04_progress.md` | UPDATE: pro abgeschlossener Schritt ✅ + Datum |
| `docs/05_tools.md` | UPDATE: neue Schritte in Skill-zu-Schritt-Matrix einreihen (Opus + max für Architektur-Schritte) |
| `package.json` | NEU-DEP: `imapflow` (IMAP-Client), `@microsoft/microsoft-graph-client` + `@azure/msal-node` (OneDrive), `pdf-parse` (TS-PDF-Reader) |
| `vercel.json` oder Env | NEU-ENV: `WEBDE_IMAP_USER`, `WEBDE_IMAP_APP_PASSWORD`, `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET`, `MS_GRAPH_REFRESH_TOKEN`, `MS_GRAPH_TENANT_ID`, `CRON_SECRET_AKQUISE` (separat vom Briefing-Secret) |

### 10.2 `automatisierung-aquise`-Repo (`c:\meine-projekte\automatisierung-aquise\`)

| Bereich | Aktion |
|---|---|
| `README.md` | UPDATE: Banner "**DEPRECATED ab 2026-MM-DD** — ersetzt durch Cloud-Pipeline (siehe `Immobilien\ImmoCRM\docs\superpowers\specs\2026-05-11-akquise-pipeline-cloud-design.md`). Code bleibt als historische Referenz." |
| Windows Task Scheduler | DEAKTIVIEREN: Aufgabe `Akquise-Pipeline` (Disabled, nicht löschen — Rollback möglich). Aufgabe `Akquise-Pipeline-HealthCheck` ebenfalls deaktivieren. |
| `data/state.db` + `data/temp/` + `logs/` | UNBERÜHRT — bleibt als Audit-Spur. Kann später (nach 30 Tagen Cloud-Betrieb erfolgreich) manuell archiviert/gelöscht werden. |

### 10.3 Externe Systeme

| System | Aktion |
|---|---|
| **Gmail** (`gymmotivationtv@gmail.com` als heutiger Akquise-Empfänger) | Filter für Auto-Forward von web.de → Gmail **abschalten**, sobald Cloud-Pipeline produktiv ist. Verifikation: 24 h kein neuer Eintrag in Gmail-INBOX mit Absender web.de. |
| **web.de** | Einstellungen → Sicherheit → App-Passwort generieren für IMAP-Zugriff. **Outlook-Ordner "CRM-Eingang" anlegen** und sicherstellen, dass er via IMAP-LIST sichtbar ist. |
| **cron-job.org** | NEUEN Cronjob anlegen: `*/5 * * * *`, URL `https://immo-crm-xi.vercel.app/api/cron/akquise-poll`, Header `Authorization: Bearer ${CRON_SECRET_AKQUISE}`, Failure-Alert an `andre-petrov@web.de`. **Bestehender Briefing-Cron bleibt parallel.** |
| **Microsoft Entra (Azure AD)** | Neue App-Registration anlegen, API-Permission `Files.ReadWrite.All` (delegated), Redirect-URI lokal für Initial-OAuth-Flow. Refresh-Token in Vercel Env. |
| **Anthropic-Konsole** | Keine neue API-Key-Pflege — bestehender Key wird wiederverwendet (siehe ADR-006-Pendant). Caching aktivieren wo möglich (gemäß `claude-api` Skill — Briefing-Prompt + Adress-Extract-Prompt sind wiederkehrend). |

### 10.4 Mono-Repo-Root (`c:\meine-projekte\`)

| Bereich | Aktion |
|---|---|
| `README.md` | UPDATE: Eintrag "Akquise-Pipeline (Cloud)" als Teilprojekt unter Immobilien hinzufügen (gemäß globaler `CLAUDE.md` Workflow-Regel). Querverweis auf `automatisierung-aquise` als deprecated. |
| `.gitignore` | KEINE Änderung nötig — Env-Files bereits abgedeckt durch bestehende Root-`.gitignore` (gemäß ADR-006 Verifikation). |

---

## 11. Bauphilosophie & Schritte

Übernimmt die Bauphilosophie aus `ImmoCRM/CLAUDE.md` und `02_implementierungsplan.md`:

- **Atomar** — jeder Schritt in einer Coding-Session (max. 2–4 h) abschließbar
- **Testbar** — am Ende läuft etwas Sichtbares oder ein klarer Test passt
- **Kein Lock-in** — späterer Schritt überschreibt nichts kritisch von früherem
- **Pro Schritt eigener Web-Claude-Chat** für Sparring, dann finaler Claude-Code-Prompt
- **Nach jedem Schritt:** `04_progress.md` ✅ + Datum, Commit conventional-style, `03_decisions.md` bei ADR
- **DEVELOPMENT_GUIDELINES** gilt durchgehend (Naming, Sprache, Forms, react-query, Supabase-Singleton, shadcn, Toast für Errors)

### Vor-Schritte (Spike-Phase, blockierend)

| # | Schritt | Aufwand | Output |
|---|---|---|---|
| S1 | **30-Min-Spike** — web.de App-Passwort + IMAP-Login + Ordner-LIST + Microsoft-Graph-Probe-Call (siehe §8.2 + §8.3) | 30 min – 1 h | GO/NO-GO für Variante A. Bei NO-GO: Spec auf Variante B re-evaluieren (separate Brainstorming-Session). |
| S2 | **QuickCheck + Priorisierung Brainstorming** (separate Session, siehe §8.1) | 1–2 h | Spec-Erweiterung, `quickCheck.ts`-Verhalten klar. Pipeline kann parallel mit Stub gebaut werden, QuickCheck-Modul ist letzter Bau-Schritt. |
| S3 | **DSGVO-Update** ADR-009 erweitern (siehe §8.4) | 30 min | Eintrag in `03_decisions.md`, nicht blockierend für Bau-Start aber vor Produktivnahme. |

### Bau-Schritte (Implementierungsplan-Skizze)

Detail-Plan kommt separat via `superpowers:writing-plans`. Hier nur Skizze der Atomarität:

| # | Schritt | Aufwand | Hauptdateien |
|---|---|---|---|
| B1 | **DB-Migrationen anlegen** — `003_mail_queue.sql`, `004_deals_priority_score.sql` + Types-Regenerierung | 1 h | `supabase/migrations/*`, `src/types/supabase.ts` |
| B2 | **Poll-Endpoint MVP** — IMAP-Connect + UNSEEN-Search + Enqueue (ohne Stages) | 2 h | `app/api/cron/akquise-poll/route.ts`, `app/api/akquise/_lib/imapClient.ts` |
| B3 | **Stage-Worker Skeleton** — parseEmail + classifyPdf + Lead-Insert mit Stub-Adresse | 2 h | `app/api/akquise/process/route.ts`, `_lib/parseEmail.ts`, `_lib/classifyPdf.ts`, `_lib/insertLead.ts` |
| B4 | **Adress-Extraktor** — Regex + LLM-Fallback (Anthropic SDK) | 3 h | `_lib/extractAddress.ts` + Vitest |
| B5 | **OneDrive-Upload** — Microsoft-Graph-Client + Auth + PUT | 3 h | `_lib/uploadOneDrive.ts`, `_lib/msGraphClient.ts` |
| B6 | **Link-Resolver** — Online-Link → PDF (fetch + HEAD + ggf. HTML-Render) | 2–3 h | `_lib/resolveLink.ts` |
| B7 | **QuickCheck-Modul** — Implementierung nach S2-Brainstorming | 3 h | `_lib/quickCheck.ts` + Vitest |
| B8 | **UI: Priority-Spalte + Pfad-Kopier-Button** | 2 h | `src/components/leads/LeadTable.tsx`, `LeadDetailPanel.tsx`, `src/hooks/useDeals.ts` |
| B9 | **Briefing-Erweiterung** — neue Sektionen "Heute eingegangen" + "Top-5" | 2 h | Briefing-Template (Schritt 8 ImmoCRM-Bereich) |
| B10 | **End-to-End-Test mit 20 echten Mails** — Stichprobe-Akzeptanz (siehe A8) + Pipeline-Polish | 2–3 h | Manual + Logs + ADR-Updates |
| B11 | **Migration & Deaktivierung** — `automatisierung-aquise` deprecated, Gmail-Forwarding aus, alte Task-Scheduler-Jobs disabled | 30 min | externe Systeme + README-Updates |

**Reihenfolge ist verbindlich** (außer B5/B6 austauschbar). B7 (QuickCheck) kann erst nach S2 gebaut werden — bis dahin Stub.

---

## 12. Verortung im Mono-Repo

```
c:\meine-projekte\Immobilien\ImmoCRM\
├── app/
│   └── api/
│       ├── cron/
│       │   ├── daily-mail/route.ts           (bereits geplant, ADR-007)
│       │   └── akquise-poll/route.ts         (NEU)
│       └── akquise/
│           ├── process/route.ts              (NEU, Stage-Worker)
│           └── _lib/
│               ├── parseEmail.ts             (NEU)
│               ├── resolveLink.ts            (NEU)
│               ├── classifyPdf.ts            (NEU)
│               ├── extractAddress.ts         (NEU)
│               ├── uploadOneDrive.ts         (NEU)
│               ├── quickCheck.ts             (NEU, Stub bis Open-Item §8.1)
│               └── insertLead.ts             (NEU)
├── supabase/
│   └── migrations/
│       ├── 003_mail_queue.sql                (NEU)
│       └── 004_deals_priority_score.sql      (NEU)
└── docs/
    └── superpowers/specs/
        └── 2026-05-11-akquise-pipeline-cloud-design.md   (DIESE DATEI)
```

**Bestehendes Python-Projekt** unter `c:\meine-projekte\automatisierung-aquise\` bleibt als historische Referenz (Code wird obsolet, nicht gelöscht).

---

## 13. The One Thing to Do First

**30-Min-Spike (§8.2): In web.de-Einstellungen prüfen, ob ein App-Passwort für IMAP generiert werden kann, und mit `imapflow` einen Test-Login auf `imap.web.de:993` mit `LIST` auf den Ordner "CRM-Eingang" ausführen.**

Das Ergebnis entscheidet, ob Variante A (diese Spec) gebaut werden kann oder ob auf Variante B (Forwarding) umgeschwenkt werden muss. **Alles andere wartet auf dieses Ergebnis.**

---

## 14. Change-Log

| Datum | Änderung | Autor |
|---|---|---|
| 2026-05-11 | Initial Spec nach Brainstorming + Council-Sitzung | André + Claude Code |
