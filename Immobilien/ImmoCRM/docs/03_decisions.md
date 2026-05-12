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

---

## ADR-011 — Tiptap als Rich-Text-Editor + RLS pragmatisch für Single-User-Mutations

- **Datum:** 2026-05-11
- **Status:** Accepted (partielle Lockerung von ADR-008)
- **Schritt:** 3 (Lead-Interaktionen)

### Kontext

Schritt 3 ist der erste Bauschritt mit Schreib-Operationen aus dem Frontend (Notizen anlegen/editieren/löschen, `letzter_anruf` updaten). Zwei Entscheidungen fallen zusammen:

1. **Rich-Text-Editor:** Tiptap oder Lexical für deal_notes.
2. **Mutations-Pfad:** ADR-008 erlaubt nur SELECT für anon. Wie werden Schreib-Operationen abgesichert?

### Entscheidung

**(a) Tiptap** als Rich-Text-Editor. StarterKit + Underline-Extension. Toolbar: Bold, Italic, Underline, BulletList, OrderedList. HTML in `deal_notes.content_html`.

**(b) RLS pragmatisch erweitern** statt Edge-Function-Layer aufzubauen: Anon-Key bekommt INSERT/UPDATE/DELETE auf `deal_notes` und UPDATE auf `deals` (USING/WITH CHECK = `deleted_at IS NULL`). Frontend-Hook (`useUpdateDealField`) kontrolliert per Whitelist welche Spalten geändert werden — Postgres hat keine column-level RLS, daher Convention statt Constraint.

### Begründung

**Tiptap:**
- Maintained, ProseMirror-basiert (Industriestandard)
- Lexical ist Meta-spezifisch, weniger Drittanbieter-Extensions
- StarterKit deckt Bold/Italic/Listen/Heading/HardBreak ab
- HTML-Output direkt speicherbar, kein JSON-Serialization-Overhead

**RLS pragmatisch statt Edge Functions:**
- Single-User-Tool. André ist der einzige, der die URL kennt. Vercel-Domain ist nicht öffentlich indexiert.
- Soft-Delete (ADR-004) schützt vor versehentlichem Datenverlust auch bei kompromittiertem Zugriff
- Edge-Function-Layer wäre +2–3h pro Mutation-Schritt × Schritte 3, 4, 6, 7 = realistisch +10h Bau ohne Single-User-Value
- YAGNI: wenn das Tool jemals „öffentlich" wird (Team-Erweiterung, Public-Beta), führen wir Supabase-Auth ein und stellen RLS auf `auth.uid() IS NOT NULL` um — ~1h Migration

**Verworfen:**
- Edge-Function-Layer für jede Mutation: vollständiger ADR-008-Compliance, aber 10× der Aufwand gegenüber dem realen Sicherheitsgewinn
- Supabase Anonymous Auth + RLS auf `TO authenticated`: minimal stärker (Bot-Crawler-resistent), aber wer im Browser ist, hat trotzdem alles. Komplexität nicht gerechtfertigt.

### Konsequenzen

**Code-Stellen Schritt 3:**
- Migration `002_step3_writes.sql` öffnet die Policies (ADR-008 für SELECT bleibt, INSERT/UPDATE/DELETE neu für `deal_notes` + UPDATE für `deals`)
- Hooks (`useDealNoteMutations`, `useUpdateDealField`) gehen direkt gegen Supabase via Anon-Client
- Tiptap-Bundle wächst ~80 KB gzipped (Bundle steigt von ~190 KB auf ~340 KB gzipped) — akzeptabel ohne Mobile-First-Anforderung; Lazy-Load via `React.lazy()` auf das Sheet beschränkbar in Schritt 10

**Migrations-Pfad zu Auth (falls jemals nötig):**
1. Supabase Auth aktivieren (Magic-Link oder Email/Pwd)
2. Login-Page anlegen, App in `<RequireAuth>` wrappen
3. Migration `003_auth.sql`: alle bestehenden Policies `TO anon` → `TO authenticated`, USING-Klauseln optional auf `auth.uid()` einschränken
4. ADR-011 auf "Superseded by ADR-XXX" setzen

**`expose_local_path`-Klick:** Browser blockieren `file://` aus `https://`-Origin (Chrome strikt, Firefox per Default-Policy). `ExposeLink.tsx` zeigt für lokale Pfade zusätzlich einen Copy-Button — User kopiert Pfad und öffnet in Explorer/OneDrive.

**ADR-008 wird durch ADR-011 partiell präzisiert.** ADR-008 bleibt Master-Doc für die Architektur-Intention; ADR-011 dokumentiert die pragmatische Realität für die MVP-Phase.

### Folge-Items (nicht ADR-blockierend)
- Bei späterer Auth-Migration: ADR-008 Status auf "Superseded by ADR-XXX" setzen
- Wenn Tiptap-Bundle in Schritt 10 (Polish) als Performance-Problem auffällt: Lazy-Load via `React.lazy()` auf das Sheet-Panel beschränken
- shadcn-Calendar-Variante minimal selbst geschrieben (react-day-picker v9 statt v10) — falls Calendar weitere Features braucht (Range-Picker, Time-Picker), prüfen ob shadcn-CLI-Output zu v9 passt

---

## ADR-012 — Lead-Anlegen-UI: Combobox-Pattern, non-destruktiver Hard-Match, Deal-Duplikat-Check

- **Datum:** 2026-05-11
- **Status:** Accepted
- **Schritt:** 4 (Manueller Lead)

### Kontext
Schritt 4 baut die manuelle Lead-Anlage als Modal mit Tabs. Mehrere Sub-Entscheidungen fallen zusammen, statt einzelner Mini-ADRs.

### Entscheidung

1. **Combobox** für Kontakt-Suche: Wiederverwendung des bestehenden Popover-basierten Patterns aus `EditableComboboxCell`. Kein `cmdk`-Package — Konsistenz und kein zusätzlicher Bundle-Overhead.
2. **Hard-Match (Email exact)**: non-destruktiver Merge — name + email werden NIE überschrieben, nur leere DB-Felder (phone, company, position, lead_source) werden mit Form-Werten gefüllt. Toast macht den Pfad transparent ("ergänzt" / "verwendet").
3. **Soft-Match (Name + keine Email)**: AlertDialog mit 3-Wege-Choice (Merge mit Kandidat / Neu anlegen / Abbrechen). Triggert nur, wenn Form-Email leer ist — sonst ist der Pfad eindeutig (Hard-Match oder No-Match).
4. **Deal-Duplikat-Check (NEU vs. Spec)**: Spec sagte nur "Duplikat-Check Email + Name", aber derselbe Makler kann mehrere Objekte haben — reiner Contact-Match deckt das nicht ab. Daher zusätzlicher Check auf normalize(address) + zip pro Contact, mit ±1m²-Toleranz wenn beide wohnflaeche_m2 gesetzt. Bei Match: AlertDialog "Trotzdem anlegen / Abbrechen".
5. **AlertDialog-Implementierung**: minimaler Wrapper auf `@radix-ui/react-dialog` (schon installiert für Sheet) — kein neues Radix-Package. Eigener Wrapper, weil 3-Wege-Choice nicht mit `window.confirm` funktioniert.
6. **Frontend-Transaktion ohne Rollback**: useCreateLead macht 3 sequentielle Calls (contact-resolve/insert → deal-insert → activity_log-insert). Bei Fehler nach erfolgreichem Contact-Insert bleibt der Contact bestehen (= "Contact-Leak"). Akzeptiert für Single-User — User kann erneut versuchen, der Contact wird beim 2. Versuch via Hard/Soft-Match wiederverwendet. RPC würde Schritt-7-Aufwand (Service-Role-Aufteiler) duplizieren.
7. **Position-Default "Makler"** nur bei NEUEM Contact, nicht bei Hard-Match-Update.

### Begründung
- Combobox-Pattern: 0 neue Abhängigkeiten, identische UX zu InlineEdit-Cells
- Non-destruktiv: schützt vor Tipp-Müll-Override (User-Anforderung "Mischmasch vermeiden")
- Deal-Dup-Check: User-Anforderung — verhindert versehentliche Doppel-Anlage desselben Objekts vom selben Makler. m²-Toleranz erlaubt 2 ETW im selben Haus als getrennte Deals.
- AlertDialog ohne Radix-Alert-Dialog: 1 Datei, ~50 Zeilen, kein Package = kein Wartungsoverhead
- Frontend-Transaktion: pragmatisch im Single-User-Setup, RPC kommt sowieso in Schritt 7 für den Aufteiler-Pfad

### Konsequenzen
- **Migration `008_step4_inserts.sql`**: RLS INSERT-Policies + GRANTs für anon auf `contacts`, `deals`, `activity_log`. UPDATE auf contacts war bereits aus Migration 004 vorhanden (`anon_update_contacts`).
- **Pure Logic in `src/features/lead-create/leadCreateLogic.ts`**: testbar, falls Vitest später kommt — aktuell kein Test-Setup im Repo (GUIDELINES erlaubt das im MVP, kritische Logik ist trotzdem isoliert).
- **`expose_local_path` aus dem Schnell-Tab raus**: nur `expose_url`. Lokaler Pfad kann via Inline-Edit später ergänzt werden — bzw. kommt erst im PDF-Tab (Schritt 5) sinnvoll rein.
- **Tab "Mit PDF"**: disabled mit Hover-Hint "Kommt in Schritt 5". UI-Versprechen sichtbar. *(Hinweis: Schritt 5 wurde später verworfen, Tab entfernt — siehe ADR-013.)*
- **Bestehender Inline-Edit-Pfad bleibt der Default für Korrekturen**: Modal ist nur für Neu-Anlage.
- **Bundle-Wachstum**: ~37 KB gzipped (rhf+zod+radix-tabs/label) — von 340 → 377 KB. Akzeptabel.

---

## ADR-014 — Kontakt-Aggregation clientseitig statt SQL-View

- **Datum:** 2026-05-12
- **Status:** Accepted
- **Schritt:** 6 (CRM-Tabelle)

### Kontext

CRM-Tabelle braucht pro Kontakt: `last_contact` (MAX aus `letzter_anruf` aller Deals und `created_at` aller Comments), `deals_count`, `comments_count`. Drei Optionen:

(a) SQL-View `contacts_aggregated` mit Subqueries — schöne Single-Source-of-Truth, aber Migration nötig + View-RLS-Setup
(b) Clientseitige Aggregation via drei `Promise.all`-Queries + Maps (analog `useDeals` aus Schritt 2)
(c) Stored Function — overkill für read-only Aggregation

### Entscheidung

**(b) Clientseitige Aggregation** in `src/hooks/useContacts.ts`.

```ts
const [contactsRes, dealsRes, commentsRes] = await Promise.all([
  supabase.from("contacts").select("*").is("deleted_at", null),
  supabase.from("deals").select("contact_id, letzter_anruf").is("deleted_at", null),
  supabase.from("contact_comments").select("contact_id, created_at"),
])
// Maps für counts + MAX-Aggregation
```

### Begründung

- **Konsistenz** mit `useDeals` (Schritt 2) — gleiches Pattern, gleiche Fehlerbehandlung, gleiche Cache-Strategie
- **Datenmengen unkritisch**: bei ~80 Kontakten + paar hundert Deals + paar hundert Comments sind das <1k Zeilen Network-Payload, sub-100ms RTT auf Free-Tier
- **Kein Migrations-Overhead** — keine View-RLS-Frage (ADR-008 macht View-RLS via `security_invoker`, jeder weitere View-Bau zwingt zur erneuten RLS-Entscheidung)
- **Reversibel**: bei 1k+ Kontakten kann später eine MView eingeführt werden, Hook-Interface bleibt gleich

**Verworfen:**
- (a) View: bei aktueller Datenmenge YAGNI; jede neue View frisst eine RLS-Iteration
- (c) Stored Function: nicht reaktiv invalidierbar via react-query — Hook-Schnittstelle wird komplexer

### Konsequenzen

- `useContacts.ts` macht 3 parallele Selects, aggregiert in Maps, returnt `ContactRow[]`
- Query-Key: `["contacts", "aggregated"]` — invalidiert bei jeder Contact-/Comment-Mutation
- `useUpdateContactField` invalidiert jetzt zusätzlich diesen Key (statt nur `["deals", "with-followup"]`)
- Wenn Performance bei Skalierung leidet (>1k Kontakte): MView `contacts_aggregated` einführen, `useContacts` selektiert daraus — Hook-Konsumer bleiben unverändert

---

## ADR-015 — Chat-Eingabe: Plain `<textarea>` statt Tiptap

- **Datum:** 2026-05-12
- **Status:** Accepted
- **Schritt:** 6 (CRM-Tabelle, Chat-Stream)

### Kontext

Pro Kontakt gibt es einen WhatsApp-Style-Chat-Stream (`contact_comments`). Deal-Notes nutzen aus Schritt 3 Tiptap (Rich-Text, Bold/Italic/Listen). Die naive Wiederverwendung wäre Tiptap auch für Chat — aber Chat braucht Enter-To-Send + Shift+Enter-Zeilenumbruch + sehr schnelle Eingabe.

### Entscheidung

**Plain `<textarea>`** für Eingabe + plain text (`contact_comments.text`) für Storage. Edit-Komponente nutzt ebenfalls `<textarea>` mit Enter-To-Save / Escape-To-Cancel.

### Begründung

- **Chat-UX**: Enter-To-Send ist Standard (WhatsApp, Slack, iMessage). Tiptap fängt Enter für `hardBreak`/`listItem` ab — würde aufwendige Keymap-Override brauchen
- **Datenmodell-Schema**: `contact_comments.text TEXT` (kein `content_html`) — Chat-Einträge sind Quick-Notes, keine formatierten Dokumente. Rich-Text-Markup im Plain-Text-Feld wäre unsauber
- **Bundle**: Tiptap-Editor-Instanz pro Item beim Edit-Mode = teuer; Textarea = 0 zusätzliche Dependencies
- **Lesbarkeit**: `whitespace-pre-wrap` reicht für Zeilenumbrüche — User schreibt 1-3 Sätze, kein Markdown nötig

### Konsequenzen

- `ChatInput.tsx`: `<textarea>` mit `onKeyDown`-Logik (Enter ohne Shift → send, Shift+Enter → newline)
- `ContactChatItem.tsx`: Display via `whitespace-pre-wrap`, Edit via `<textarea>` mit Enter/Escape
- Wenn jemals Rich-Text-Bedarf im Chat: separate Migration `content_html` + Editor-Switch — aber dann reden wir über ein anderes Produkt

---

## ADR-016 — UX-Polish nach Schritt-6-Test: Direkt-Klick + manueller Letzter-Kontakt

- **Datum:** 2026-05-12
- **Status:** Accepted (partielle Revision von ADR-014 + Schritt-3-Pattern)
- **Schritt:** 6 (Polish nach Owner-Test)

### Kontext

Nach erstem visuellen Test der CRM-Tabelle gab es vier Owner-Reklamationen:

1. Status/Dropdown/Datum-Cells öffneten erst nach 2 Sek Hover ein Stift-Icon → User erwartet Direkt-Klick.
2. Row-Klick öffnete den Chat-Panel auch wenn der User irgendwo in der Zeile klickte (z.B. „Letzter Kontakt"-Datum).
3. „Letzter Kontakt" war computed (MAX aus Anrufen + Comments) — User erwartet ein manuell setzbares Datum mit Datepicker.
4. „Anzahl Kontakte" sollte trackbar sein (wie oft hat der User Kontakt gehabt), inkl. manueller Korrektur bei Fehlklicks.

### Entscheidung

1. **Direkt-Klick** für `EditableSelectCell` + `EditableComboboxCell` + `AnrufCell` (linker Klick auf Datum). Hover-Pencil-Pattern bleibt nur noch für Text-/Number-Cells, wo freie Eingabe nötig ist.
2. **Row-Klick entfernt** in ContactTable. Chat-Panel öffnet nur noch via expliziten Klick auf die Notizen-Spalte (Sprechblasen-Icon).
3. **`contacts.letzter_kontakt` (date)** als neue, manuell setzbare Spalte (Migration 010). MAX-Aggregation aus `useContacts` entfernt — Wert kommt direkt aus dieser Spalte. Tabelle rendert als `ClickableDateCell`.
4. **`contacts.kontakt_count` (integer)** als Zähler (Migration 011). Inkrementiert im Frontend bei jedem Save mit Nicht-Null-Datum. Display als `CounterCell` mit Plus/Minus-Buttons für manuelle Korrekturen. Toast bei Counter-Updates unterdrückt, damit schnelles Klicken nicht zur Toast-Flut führt.

### Begründung

- **Direkt-Klick vs Hover-Pencil:** das 2-Sek-Hover-Pattern aus Schritt 3 (EditableCellShell) wurde für Felder mit freier Texteingabe entworfen, um versehentliches Aktivieren beim Lesen zu vermeiden. Bei diskreten Werten (Status, Dropdown, Datum) ist die Auswahl trivial reversibel — Direkt-Klick spart einen Schritt pro Edit. Text-Cells bleiben absichtlich beim Hover-Pencil-Pattern.
- **Row-Klick entfernt:** Spec sagte „Klick auf Kontakt-Zeile öffnet Slide-In-Panel". Im realen Gebrauch öffnet das aber unerwünscht beim Lesen einer Zelle oder dem Versuch, eine andere Aktion auszulösen. Notizen-Spalte hat ein eindeutiges Icon — das reicht als Trigger.
- **Manuelles `letzter_kontakt`** statt computed: Owner-Erwartung aus Excel-Workflow — das Datum ist eine Pflege-Information, kein Audit-Trail. MAX-Aggregation war meine Spec-Interpretation, nicht User-Anforderung. **Reversibel:** wenn später Automatik nötig, View einbauen, die `COALESCE(letzter_kontakt, MAX(...))` macht.
- **`kontakt_count` mit Counter-Cell:** simpler Integer, Frontend-Increment (Race-Conditions bei Single-User irrelevant). Plus/Minus-Buttons erlauben Korrektur ohne Edit-Modal. Toast unterdrückt — Counter-Update ist low-stakes Feedback, die Zahl selbst ist das Feedback.

**Verworfen:**
- View `contacts_aggregated` mit COALESCE — YAGNI für Single-User
- Separate `contact_check_ins`-Tabelle mit Historie — Spec verlangt nur Count, nicht Historie. Wenn Historie später nötig, ist die Migration einfach: Counter durch Historie + `COUNT(*)`-Aggregation ersetzen, Hook-Interface bleibt gleich.

### Konsequenzen

- **Migration 010:** `ALTER TABLE contacts ADD COLUMN letzter_kontakt date NULL`
- **Migration 011:** `ALTER TABLE contacts ADD COLUMN kontakt_count integer NOT NULL DEFAULT 0`
- **Bestehende RLS-Policies decken die neuen Spalten automatisch ab** (`anon_update_contacts` aus Migration 004 — UPDATE auf allen Spalten erlaubt solange `deleted_at IS NULL`)
- **`useContacts` vereinfacht:** statt 3-fach-Aggregation jetzt nur `dealsCount` + `commentsCount` clientseitig, `last_contact` direkt aus contact-row. ADR-014 bleibt für die counts gültig.
- **`useUpdateContactField.FieldValue`** akzeptiert jetzt `string | ContactStatus | number | null`
- **Neue Komponenten:** `src/components/crm/CounterCell.tsx`
- **Gelöscht:** `EditableDateCell.tsx` (unused)

### Folge-Items
- Wenn Owner später automatisches Update von `letzter_kontakt` bei neuem Anruf/Comment will: View `contacts_with_last_contact` mit `COALESCE`-Logik einführen, useContacts auf View umstellen.
- Wenn `kontakt_count` Multi-User-tauglich werden muss: SQL-Function `increment_kontakt_count(uuid)` mit atomic +1.

---

## ADR-013 — Schritt 5 (PDF-Drag-Drop) nicht gebaut

- **Datum:** 2026-05-12
- **Status:** Accepted
- **Schritt:** 5 (verworfen)

### Kontext

Schritt 5 war geplant als Tab 2 "Mit PDF" im Lead-Anlegen-Modal: Owner droppt ein Exposé-PDF, ein KI-Service extrahiert Felder automatisch, Form wird vorbefüllt. Architektur-Diskussion drehte sich um Wege gegen das Vercel-Free-Plan-Payload-Limit von 4,5 MB:

- Vercel-Cloud-Endpoint mit 4,5 MB Hard-Cap (deckt typische 1-3 MB-Exposés)
- Lokaler Python-Server im `automatisierung-aquise`-Repo (deckt 100% der PDFs, ~6h Bau + Wartung)
- Hybrid Cloud/Lokal (~+50% Aufwand, zwei Code-Pfade)
- Browser-Splitting + Multi-Cloud-Calls (Kontext-Verlust, 5× Latenz)

Bau-Schätzung Cloud-Variante: ~3h.

### Entscheidung

Schritt 5 wird **nicht gebaut**. Tab "Mit PDF" aus dem Modal entfernt. Lead-Anlage funktioniert nur noch über den Schnell-Tab (Schritt 4).

UI-Konsequenz: `LeadCreateModal.tsx` rendert `QuickLeadForm` direkt, ohne Tabs-Wrapper.

### Begründung

Aufwand-Nutzen ungünstig im Single-User-MVP:

- **Hauptdatenquelle ist der Aufteiler-Workflow (Schritt 7).** Schätzung: ~95% aller Leads kommen automatisch per PDF→Mail→Aufteiler→CRM. Schritt 5 deckt nur die Rest-1-5× pro Woche Off-Market-Sonderfälle ab.
- **Bei seltener Nutzung lohnt sich Bau-Aufwand × Wartung × API-Cost nicht.** Selbst die 3h-Cloud-Variante spart pro Lead nur 1-2 Minuten Tipparbeit.
- **Schritt 4 (Schnell-Tab) ist da und funktioniert.** Off-Market-Leads kommen über den manuellen Pfad rein — etwas mehr Tipparbeit, aber zuverlässig und ohne Sonderfälle.
- **YAGNI:** Schritt 5 war eine Komfort-Optimierung für einen Use Case, dessen tatsächliche Häufigkeit unklar ist. Erst bauen wenn nachweislich Bedarf.

### Konsequenzen

- **`LeadCreateModal.tsx`**: Tabs raus, `QuickLeadForm` direkt eingebettet. `DialogDescription` angepasst auf "Off-Market schnell erfassen. Automatische Befüllung läuft über den Aufteiler-Workflow."
- **`02_implementierungsplan.md`**: Schritt 5 als VERWORFEN markiert mit Verweis auf diesen ADR. Build-Reihenfolge: nach Schritt 4 direkt Schritt 6.
- **`04_progress.md`**: Schritt 5 auf ❌ verworfen, MVP-DoD-Item "Manuelles Anlegen (Schnell + PDF)" wird zu "Manuelles Anlegen (Schnell)".
- **Nicht entfernt**: `components/ui/tabs.tsx` + `@radix-ui/react-tabs` — generische UI-Komponente, evtl. später nützlich. Kein eigenes Refactor nötig.
- **Reaktivierungs-Pfad** (falls Bedarf später bestätigt wird):
  - Cloud-Variante: ~3h Bau, 4,5 MB Limit + Toast bei Übergröße
  - Lokal-Variante: ~6h Bau, ohne Größenlimit, wiederverwendet `automatisierung-aquise/modules/m05_address_extractor.py`
  - Entscheidung dann mit echten Nutzungsdaten ("wie oft droppe ich PDFs wirklich?")
