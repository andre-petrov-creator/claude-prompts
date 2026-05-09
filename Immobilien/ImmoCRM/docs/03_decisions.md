# ImmoCRM — Architecture Decisions (ADRs)

Laufendes Log aller architektur-relevanten Entscheidungen während des Baus. Format pro Eintrag: kurz, datiert, mit Begründung. Eine Entscheidung wird nie still rückgängig gemacht — sie wird durch einen neuen Eintrag mit Status "Superseded by ADR-NNN" ersetzt.

---

## Eintrags-Template

```
## ADR-NNN — <Titel>

- **Datum:** YYYY-MM-DD
- **Status:** Accepted | Superseded by ADR-NNN | Deprecated
- **Schritt:** <Bauschritt aus 02_implementierungsplan.md>

### Kontext
Was war das Problem / die Frage?

### Entscheidung
Was wurde entschieden?

### Begründung
Warum so und nicht anders? Welche Alternativen wurden verworfen?

### Konsequenzen
Was zieht das nach sich (Konfiguration, Code-Stellen, Folge-Entscheidungen)?
```

---

## ADR-001 — Tech-Stack festgezurrt

- **Datum:** 2026-04-30
- **Status:** Accepted (partiell ergänzt durch ADR-008 hinsichtlich Mutations-Pfad)
- **Schritt:** Phase 1 (Sparring)

### Kontext
Wahl des Stacks für ein Single-User-Tool mit DB, Cron-Mail und Workflow-Integration.

### Entscheidung
Vite + React + TS · Tailwind + shadcn/ui · TanStack Table · Supabase · Vercel · Gmail SMTP. Details siehe [01_projektbeschreibung.md](01_projektbeschreibung.md) Abschnitt 2.

### Begründung
- Vite statt Next.js: kein SSR/SEO nötig, schnellerer DX
- Supabase: Cloud-DB + REST API für Workflow-Integration ohne eigenen Server
- Vercel: Free-Tier reicht, integrierter Cron für Tages-Mail
- shadcn/ui: editierbare Components, kein Lock-in

### Konsequenzen
- Keine Backend-API zu pflegen — Logik liegt im Frontend + DB-Triggers
- Workflow-Integration via Supabase REST direkt aus Cloud Code

---

## ADR-002 — Keine PDF-Speicherung

- **Datum:** 2026-04-30
- **Status:** Accepted
- **Schritt:** Phase 1

### Kontext
Sollen Exposé-PDFs zentral im System abgelegt werden?

### Entscheidung
Nein. PDFs bleiben lokal (PC/OneDrive). Im CRM nur Verweis-Strings (`expose_url`, `expose_local_path`).

### Begründung
- Supabase Free-Storage spart sich auf Wesentliches (DB)
- Kein Sync-Problem zwischen lokal und Cloud
- DSGVO-Footprint minimiert

### Konsequenzen
- Beim PDF-Drag-Drop (Schritt 5): in-memory parsen, dann verwerfen
- `expose_local_path` ist freier String, keine Validierung der Existenz

---

<!-- Ab hier folgen ADRs aus dem Bau. Pro Schritt eine Sektion mit ADR-003, ADR-004 … -->

---

## ADR-003 — Email-Unique via Generated Column

- **Datum:** 2026-05-09
- **Status:** Accepted
- **Schritt:** 1 (DB-Schema)

### Kontext
Der Aufteiler-Workflow schreibt Makler-Kontakte automatisch ins CRM. Der Duplikat-Check erfolgt über `email`. Ohne Normalisierung gelten `Foo@x.de`, `foo@x.de`, ` foo@x.de ` als drei verschiedene Einträge — der Aufteiler wird Duplikate erzeugen, sobald derselbe Makler in zwei Exposés mit unterschiedlich getippter Email auftaucht.

### Entscheidung
**Option (a) — Generated Column `email_normalized = lower(trim(email))` mit `UNIQUE` darauf.**

```sql
contacts:
  email             text,
  email_normalized  text GENERATED ALWAYS AS (lower(trim(email))) STORED UNIQUE,
```

### Begründung
- Postgres-native, deterministisch, kein Trigger, kein PL/pgSQL
- Original-Email bleibt für Anzeige im UI erhalten (André tippt `Foo@x.de` → wird so angezeigt, intern `foo@x.de` für Vergleich)
- Insert-Konflikte werfen sauberen `unique_violation`-Error mit Constraint-Name → vom Aufteiler-Workflow als "Duplikat" abfangbar
- Index auf Generated Column wird automatisch verwendet

**Verworfen:**
- (b) BEFORE-Trigger schreibt `email` direkt um → User sieht plötzlich Lowercase, irritierend
- (c) Frontend-only Normalisierung: bricht beim Aufteiler-Workflow (kein Frontend dazwischen)
- (d) CITEXT: nicht-Standard, schlechterer Postgres-Index-Support

### Konsequenzen
- Frontend-Suche kann `WHERE email_normalized = lower(trim($input))` nutzen — schneller als ILIKE
- Aufteiler-Subagent (Schritt 7) muss `unique_violation` mit Constraint-Namen abfangen für Duplikat-Branching
- NULL-Emails sind erlaubt (mehrere Kontakte ohne Email möglich) — Postgres `UNIQUE` ignoriert NULL by default

---

## ADR-004 — Soft-Delete für contacts und deals

- **Datum:** 2026-05-09
- **Status:** Accepted
- **Schritt:** 1 (DB-Schema)

### Kontext
Single-User-System ohne Undo. Versehentliche Löschung eines Kontakts/Deals ist unwiderrufbar, wenn hart gelöscht wird. Außerdem: DSGVO-Löschrecht vs. Datenintegrität bei Foreign-Key-Verknüpfungen (`contact_comments`, `deal_notes`).

### Entscheidung
**Soft-Delete via `deleted_at TIMESTAMPTZ NULL` auf `contacts` + `deals`. Hard-Delete nur via DSGVO-Admin-Skript.**

```sql
contacts.deleted_at  timestamptz NULL,  -- NULL = aktiv
deals.deleted_at     timestamptz NULL,
```

- Standard-Queries filtern `WHERE deleted_at IS NULL` (Helper `activeOnly()` im Frontend-Layer)
- UI hat einen "Papierkorb"-View mit `WHERE deleted_at IS NOT NULL` für 30-Tage-Wiederherstellung
- DSGVO-Löschung: separates Admin-Skript löscht hart auf Email-Anfrage (siehe ADR-009)
- Nach 30 Tagen Soft-Delete: optional `pg_cron`-Job hard-deletet automatisch (entscheiden in Schritt 10)

### Begründung
- Versehentliche Löschung in Single-User-System ohne Undo = irreversibler Datenverlust
- DSGVO-Löschrecht (ADR-009) braucht *separaten*, expliziten Hard-Delete-Pfad — nicht die Standard-UI
- Foreign-Key-Integrität bleibt erhalten: `contact_comments` und `deal_notes` zeigen weiter auf den (soft-deleted) Kontakt/Deal — sonst würden alle History-Einträge mit verschwinden

### Konsequenzen
- **`contact_comments`, `deal_notes`, `activity_log` bekommen KEIN `deleted_at`** (Audit-Trail-Charakter, dürfen nicht verschwinden — nur via DSGVO-Hard-Delete entfernbar)
- **RLS-Policies (ADR-008) müssen `deleted_at IS NULL` mitprüfen**, sonst leakt der Anon-Key Soft-Deleted-Daten an unauthorized Reader
- Frontend-Helper `supabase.from('contacts').select().is('deleted_at', null)` als Default-Pattern
- "Papierkorb"-UI als optional in Schritt 10 — MVP-DoD erlaubt es ohne

---

## ADR-005 — naechste_nachfass als VIEW

- **Datum:** 2026-05-09
- **Status:** Accepted
- **Schritt:** 1 (DB-Schema)
- **Methode:** LLM Council (5 Berater + Peer-Review + Chairman)

### Kontext
Pro `deals`-Eintrag soll `naechste_nachfass` (Datum für nächsten Anruf) berechnet werden, basierend auf `status` (offen/berechnet/absage) + `angebot_datum` + letzte Aktivität (`MAX(contact_comments.created_at)`). Wert steuert die Tages-Mail (Schritt 8) und Sortierung der Lead-Liste (Schritt 2).

### Entscheidung
**VIEW (Option b)** — `deals_with_followup` berechnet `naechste_nachfass` on-the-fly aus den Inputs. Frontend und Cron-Mail lesen die View statt der Tabelle.

**Berechnungsregel:**
| Status | Tage-Offset (Werktage) | von |
|---|---|---|
| `offen` | +5 | `MAX(angebot_datum, last_comment_date)` |
| `berechnet` | +14 | `MAX(angebot_datum, last_comment_date)` |
| `absage` | NULL (kein Follow-up) | — |

**Werktag-Logik:** `next_business_day()` — fällt das Datum auf Sa/So/NRW-Feiertag, wird auf den nächsten Werktag verschoben. Voraussetzung: Tabelle `feiertage_nrw(date PRIMARY KEY)` mit den NRW-Feiertagen für mind. 2 Jahre vorbefüllt (~22 Einträge), Wartung 1×/Jahr.

### Begründung
Council-Konvergenz: 3/5 Berater (Outsider, First-Principles, Executor) sprechen explizit für VIEW. 1/5 (Expansionist) für Trigger als Akquise-Engine-Fundament — von 4/5 Reviewern als YAGNI/Over-Engineering markiert. 1/5 (Contrarian) blockiert die Frage selbst und benennt die Spec-Lücken (Berechnungsregel, Feiertage), die hier oben mitgelöst sind.

Kern-Argumente pro VIEW:
- Single Source of Truth → kein Drift möglich
- Single-Dev (André) ohne DBA-Erfahrung → Cross-Table-Trigger sind 23-Uhr-Bug-Klasse
- Bei 2-5k Zeilen + 1 User + 1 Cron sind Read-Latenzen sub-ms (kein Performance-Problem)
- Reversibel: bei späterem Skalierungsbedarf → Materialized View mit `REFRESH` im Cron

Generated Column verworfen: kann nicht cross-table auf `MAX(contact_comments.created_at)` zugreifen.

### Konsequenzen

**Code-Stellen Schritt 1:**
```sql
-- Hilfs-Tabelle Feiertage NRW
CREATE TABLE feiertage_nrw (
  date date PRIMARY KEY,
  name text NOT NULL
);
-- (Befüllung 2026-2027 als Migration-Seed)

-- Werktag-Funktion
CREATE OR REPLACE FUNCTION next_business_day(d date)
RETURNS date LANGUAGE sql STABLE AS $$
  WITH RECURSIVE next_day AS (
    SELECT d AS candidate
    UNION ALL
    SELECT candidate + 1 FROM next_day
    WHERE EXTRACT(DOW FROM candidate) IN (0, 6)
       OR candidate IN (SELECT date FROM feiertage_nrw)
  )
  SELECT candidate FROM next_day
  WHERE EXTRACT(DOW FROM candidate) NOT IN (0, 6)
    AND candidate NOT IN (SELECT date FROM feiertage_nrw)
  LIMIT 1;
$$;

-- Followup-Funktion
CREATE OR REPLACE FUNCTION compute_followup(angebot date, status text, last_activity date)
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT CASE status
    WHEN 'offen'     THEN next_business_day(GREATEST(angebot, COALESCE(last_activity, angebot)) + 5)
    WHEN 'berechnet' THEN next_business_day(GREATEST(angebot, COALESCE(last_activity, angebot)) + 14)
    ELSE NULL
  END;
$$;

-- View
CREATE VIEW deals_with_followup AS
SELECT d.*,
  (SELECT MAX(c.created_at)::date FROM contact_comments c WHERE c.contact_id = d.contact_id) AS last_activity,
  compute_followup(
    d.angebot_datum,
    d.status::text,
    (SELECT MAX(c.created_at)::date FROM contact_comments c WHERE c.contact_id = d.contact_id)
  ) AS naechste_nachfass
FROM deals d;

-- Index für Performance der MAX-Subquery
CREATE INDEX idx_contact_comments_contact_created
  ON contact_comments(contact_id, created_at DESC);
```

**Folge-Entscheidungen / offene Backlog-Items:**
- **Cron-Health-Monitoring (Schritt 8):** Vercel Cron kann stillschweigend ausfallen → Dead-Man's-Switch nötig. Eigenes Tracking-Item für Schritt 8 (nicht ADR-blockierend).
- **Race Condition Aufteiler+Cron:** Aufteiler-Inserts während 8:00-Cron könnten Lead "verstecken". Da VIEW immer aktuell rechnet, ist das Risiko niedrig — aber dokumentiert für Schritt 7.
- **Frontend-API:** Lead-Liste liest `deals_with_followup`, nicht `deals`. Schreib-Operationen gehen weiter auf `deals`.
- **`naechste_nachfass` ist read-only (View-Spalte).** Manuelles Snooze-Feld später optional als separate `snooze_until date` Spalte auf `deals` ergänzbar — überschreibt dann die Computed-Logik via `COALESCE(snooze_until, naechste_nachfass)` in einer V2-View.

---

## ADR-006 — Supabase Service-Role-Key Storage

- **Datum:** 2026-05-09
- **Status:** Accepted
- **Schritt:** 7 (Aufteiler-Workflow-Integration)

### Kontext
Der Aufteiler-Workflow (`C:\meine-projekte\Immobilien\Aufteiler\`) muss schreibend auf die ImmoCRM-Supabase zugreifen, um Kontakte+Deals zu insertieren. Anon-Key reicht nicht (RLS, siehe ADR-008, blockt Insert). Service-Role-Key umgeht RLS — Leak = vollständiger DB-Zugriff für Angreifer.

### Entscheidung
**Lokale `.env` im Aufteiler-Repo (`C:\meine-projekte\Immobilien\Aufteiler\.env`), durch `.gitignore` geschützt + Backup-Eintrag im Windows Credential Manager.**

```bash
# C:\meine-projekte\Immobilien\Aufteiler\.env (NIE committen)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

Plus: parallel Backup im Windows Credential Manager (`cmdkey /add:supabase_service_role_imm /user:- /pass:eyJhbG...`) — falls Festplatte stirbt, ist der Key noch im OS-Keystore. Nicht für laufenden Workflow-Zugriff, nur Disaster-Recovery.

### Begründung
- Mono-Repo `meine-projekte` hat Root-`.gitignore` mit `.env`-Pattern (zu verifizieren vor Schritt 7)
- Cloud-Code-Workflow im Aufteiler liest die `.env` direkt — keine zusätzliche Auth-Schicht nötig
- Single-Dev, Festplatten-Verlust ist realistisches Risiko → Credential-Manager-Backup ist 30s Setup pro Key

**Verworfen:**
- (b) Nur Credential Manager: kompliziert aus Cloud-Code-Workflow zu lesen
- (c) Eigene Tabelle in Supabase: zirkulär (Service-Key nötig um an Service-Key zu kommen)
- (d) dotenv-vault: externe Dependency, Overkill
- (e) Auth-Microservice: Architektur-Bruch (kein eigener Backend-Server geplant)

### Konsequenzen

**Pflicht-Verifikation vor Schritt 7:**
```powershell
# Prüfen dass keine .env im Git-History liegt
cd C:\meine-projekte
git log --all --full-history --diff-filter=A -- "**/.env"
# Output muss leer sein. Wenn nicht: BFG-Repo-Cleaner + force-push (mit User-Bestätigung)

# Aktuell tracked .env-Files
git ls-files "**/.env"
# Output muss leer sein
```

**Key-Rotation-Prozess** (bei Verdacht auf Leak):
1. Supabase Dashboard → Settings → API → Service-Role-Key → Reveal → Rotate
2. Neue Key in `.env` + Credential Manager schreiben
3. Vercel Env aktualisieren falls dort genutzt (Schritt 8 Cron-Mail)
4. Git-History auf Leak prüfen (siehe oben)

**Folge-Item für `C:\meine-projekte\.gitignore`:** muss `.env`, `.env.local`, `.env.*.local` enthalten — vor Schritt 7 verifizieren.

---

## ADR-007 — Vercel Cron DST: Externer Trigger via cron-job.org

- **Datum:** 2026-05-09
- **Status:** Accepted
- **Schritt:** 8 (Tages-Mail)
- **Methode:** LLM Council (5 Berater + Peer-Review + Chairman) + User-Override

### Kontext
Vercel Cron läuft fix in UTC, kein TZ-Override. Tages-Mail muss **ganzjährig um 8:00 Europe/Berlin** kommen, ohne DST-Drift, ohne halbjährliche Wartung. UTC-Schedules driften halbjährlich um 1h zwischen CET (Winter, UTC+1) und CEST (Sommer, UTC+2).

### Entscheidung
**Option (e) — externer Cron-Trigger via cron-job.org mit nativer Europe/Berlin TZ-Support.**

Architektur:
- **cron-job.org** (Free Tier): Schedule `0 8 * * 1-5`, Timezone `Europe/Berlin`, Method `POST` → Vercel-Webhook
- **Vercel-Route**: `app/api/cron/daily-mail/route.ts`, geschützt via `Authorization: Bearer <CRON_SECRET>` Header
- **Mo-Fr only** — keine Wochenend-Mails, konsistent mit ADR-005-Werktag-Logik
- **Failure-Notification**: cron-job.org sendet bei HTTP-non-200 automatisch Mail an `andre-petrov@web.de`

### Begründung
User-Anforderung: "8 Uhr unabhängig von der Jahreszeit". Damit fällt jede Option mit Drift raus (a, b). Council-Konvergenz lag eigentlich bei (a) mit Akzeptanz-Fenster — User-Override priorisiert exakte Punkt-Zeit.

Verbleibende Optionen waren:
- (b) Zwei Cron-Lines manuell — Schein-Robustheit, vom User-Memory verboten
- (c) Edge-Function-Wait — anti-pattern, fragil bei Vercel-Cold-Starts (60s-Limit Hobby Tier)
- (e) Externer Cron — gewählt: nativer TZ-Support, 8 min Setup, eigene Failure-Notifications

Council-Blindspots, die hier mit-adressiert sind:
- **Wochenende/Feiertag**: Cron läuft nur Mo-Fr (`* * * * 1-5`) — keine Sonntag-Spam
- **Stille Failure-Detection**: cron-job.org hat eingebauten Email-Alert bei HTTP-non-200 (Free Tier)

Verbleibende Risiken (dokumentiert, nicht blockierend):
- Externe Dependency cron-job.org — Service-Ausfall = ein Tag ohne Mail, akzeptiert
- Gmail-SMTP-Fragilität (App-Password-Expiry, Throttling) — separat zu lösen in Schritt 8
- Bei späterer Akquise-Team-Erweiterung: Multi-User-Trigger-Fähigkeit ist gegeben (cron-job.org skaliert), Architektur nicht zu ersetzen

### Konsequenzen

**Code-Stellen Schritt 8:**

```typescript
// app/api/cron/daily-mail/route.ts
export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    await sendDailyMail();
    await logActivity('daily_mail_sent');
    return new Response('OK', { status: 200 });
  } catch (err) {
    await logActivity('daily_mail_failed', { error: String(err) });
    return new Response('Failed', { status: 500 });
  }
}
```

**Setup-Checkliste Schritt 8:**
1. Vercel Env: `CRON_SECRET=<openssl rand -hex 32>` setzen (Production scope)
2. cron-job.org Account anlegen → New Cronjob:
   - URL: `https://immo-crm-xi.vercel.app/api/cron/daily-mail`
   - Schedule: `0 8 * * 1-5` (Custom-Cron)
   - Timezone: `Europe/Berlin`
   - Method: `POST`
   - Header: `Authorization: Bearer <CRON_SECRET>`
   - Notifications: `On Failure` → `andre-petrov@web.de`
3. Test-Lauf manuell ausführen, Activity-Log + Mail-Eingang verifizieren

**Folge-Entscheidungen / offene Backlog-Items:**
- **Activity-Log-basierte Heartbeat-Anzeige**: Dashboard zeigt Banner, wenn letzter `daily_mail_sent` > 2 Werktage alt. Nicht ADR-blockierend, gehört in Schritt 8.
- **Gmail-SMTP-Robustheit**: separate Sub-Diskussion in Schritt 8 (Bounce-Handling, App-Password-Rotation, evtl Wechsel auf Resend/Postmark falls Throttling auftritt)
- **Vercel Cron Free Tier ungenutzt**: 2 Slots bleiben für andere UTC-feste Jobs (z.B. Backup, Re-Index in Schritt 10)

---

## ADR-008 — RLS-Policies: Anon-SELECT, Service-Role-Mutations

- **Datum:** 2026-05-09
- **Status:** Accepted
- **Schritt:** 1 (DB-Schema)
- **Supersedes (partiell):** ADR-001 hinsichtlich "Frontend → Supabase REST direkt" — Mutations gehen jetzt über Edge Functions

### Kontext
Supabase Anon-Key ist im Frontend-Bundle (`VITE_SUPABASE_ANON_KEY`) und damit öffentlich lesbar. Ohne RLS = jeder mit der Vercel-URL kann alle Daten sehen/ändern. Single-User-System ohne Auth — kein `auth.uid()`-Check möglich.

### Entscheidung
**Option (c) — Anon-Key darf SELECT (auf nicht-gelöschte Zeilen), Service-Role-Key darf INSERT/UPDATE/DELETE.**

```sql
ALTER TABLE deals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE feiertage_nrw ENABLE ROW LEVEL SECURITY;

-- Anon-Key: nur SELECT, nur aktive Zeilen (siehe ADR-004 Soft-Delete)
CREATE POLICY "anon_read_active" ON deals
  FOR SELECT TO anon
  USING (deleted_at IS NULL);

CREATE POLICY "anon_read_active" ON contacts
  FOR SELECT TO anon
  USING (deleted_at IS NULL);

-- Tabellen ohne deleted_at: einfacher SELECT
CREATE POLICY "anon_read" ON contact_comments FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON deal_notes       FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON activity_log     FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON feiertage_nrw    FOR SELECT TO anon USING (true);

-- Service-Role: alles (für Edge Functions + Aufteiler-Workflow)
CREATE POLICY "service_full" ON deals             FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full" ON contacts          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full" ON contact_comments  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full" ON deal_notes        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full" ON activity_log      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full" ON feiertage_nrw     FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### Begründung
- (a) Service-Role-only für alles: jedes UI-Read braucht Edge Function → Performance-Killer + Architektur-Komplexität
- (b) RLS aus + Anon-Vollzugriff: jeder mit `https://immo-crm-xi.vercel.app` kann alles ändern → explizites NEIN
- (d) Custom Token: Komplexität vs Standard-Setup nicht gerechtfertigt

Gewählt: (c) trifft den Sweet-Spot — Frontend liest schnell direkt, Mutations bleiben hinter Auth.

### Konsequenzen

**Architektur-Anpassung gegenüber ADR-001:**
- Lese-Operationen Frontend → Supabase REST direkt (Anon-Key)
- Schreib-Operationen Frontend → Vercel Edge Function → Supabase (Service-Role-Key in Vercel-Env)
- Es entsteht ein **minimaler Backend-Layer** (~5-7 Edge Functions): `createDeal`, `updateDealStatus`, `addContactComment`, `softDeleteDeal`, etc.

**Vercel-Env Schritt 1:**
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # NUR in Vercel Env, NIE im Frontend-Bundle
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...      # OK im Frontend-Bundle
```

**View `deals_with_followup` (ADR-005):** muss eigene RLS-Policy bekommen, weil Postgres-Views standardmäßig nicht RLS-prüfen — also `WITH (security_invoker=true)` setzen oder eigene Policies anlegen:
```sql
CREATE VIEW deals_with_followup
  WITH (security_invoker=true) AS
  SELECT ... FROM deals d ...
```

**Folge-Items:**
- Edge-Functions-Verzeichnis `app/api/...` als eigener Ordner-Konvention in DEVELOPMENT_GUIDELINES.md ergänzen (Schritt 1)
- Aufteiler-Workflow nutzt direkt Service-Role-Key (kein Edge-Function-Hop) — er ist trusted, lebt außerhalb des Browsers
- ADR-001 Status auf "Accepted, partiell ergänzt durch ADR-008" ändern

---

## ADR-009 — DSGVO-Datenfluss (Skizze)

- **Datum:** 2026-05-09
- **Status:** Open (finale Entscheidung vor Schritt 5)
- **Schritt:** 5 (PDF-Vision-Call) + 7 (Aufteiler-Integration)

### Kontext
Personenbezogene Daten von Maklern (Name, Email, Telefon) werden:
- in Supabase persistiert (Frankfurt-Region, eu-central-1 — innerhalb EU ✓)
- vorm Insert via Anthropic Claude API verarbeitet (Vision für Exposé-Parsing). API-Endpoint = US, kein EU-Pendant verfügbar (Stand 2026-05).

### Skizze (zu verifizieren)
- AVV mit Anthropic abschließen (verfügbar im Plus/Team/Enterprise-Plan)
- AVV mit Supabase abschließen (Self-Service in Dashboard)
- Auskunfts-/Löschrecht: dokumentierter Prozess auf Anfrage `<email>` → SQL-Skript
- Datenschutzhinweis im CRM-UI (Footer-Link auf eigene Hosted-Datenschutzerklärung)

### Entscheidung
_offen — finale Entscheidung mit Anwalt vor Schritt 5_

---

## ADR-010 — Backup-Strategie (Skizze)

- **Datum:** 2026-05-09
- **Status:** Open (finale Entscheidung vor Schritt 9)
- **Schritt:** 9 (Excel-Migration) + 10 (Production)

### Kontext
Daten leben **nur in Supabase** — nicht in Git. Festplatten-Tod oder Supabase-Account-Verlust = Datenverlust. Globale CLAUDE.md-Regel "GitHub ist die einzige Sicherung" greift hier nicht.

### Skizze (zu verifizieren)
- Tägliches `pg_dump` via Vercel Cron oder GitHub Action → SQL-File
- Storage-Ziel: separates privates GitHub-Repo `meine-projekte-backups` (verschlüsselt mit `gpg`) ODER Backblaze B2 mit eu-central-Region
- Frequenz: täglich, 14-Tage-Retention
- Restore-Test: vierteljährlich gegen Wegwerf-Supabase-Projekt

### Entscheidung
_offen — finale Entscheidung vor Daten-Migration_


