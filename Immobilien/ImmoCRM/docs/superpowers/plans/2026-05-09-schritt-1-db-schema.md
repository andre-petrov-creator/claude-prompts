# Schritt 1 — DB-Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initiales ImmoCRM-Datenbank-Schema in Supabase als atomare Migration anlegen — 6 Tabellen, 1 Helper-Tabelle mit Seed, 2 SQL-Functions, 1 VIEW, RLS-Policies — gemäß ADR-003 bis ADR-008 entscheidungstreu.

**Architecture:** Eine Migration `supabase/migrations/001_initial_schema.sql`, atomar via Supabase MCP gegen Live-Project `ofejtonrjyszujugxwwm` (eu-central-1, Postgres 17, leer) angewendet. Supabase CLI als devDep für npm-Workflow. `db:reset` via Custom-Script (kein Docker erforderlich).

**Tech Stack:** Postgres 17 · Supabase CLI 2.x · TypeScript · `pg` (Node-Driver)

---

## Context

**Warum:** Schritt 0 (Setup) ist live (Vite + React + Tailwind + shadcn + Supabase Free Tier in Frankfurt + Vercel-Deploy). ADR-003 bis ADR-008 sind durchentschieden — das Schema ist also vollständig spec'd, jetzt fehlt die Implementation.

**Ausgangslage (verifiziert via MCP):**
- `public`-Schema leer (keine Tabellen, keine Migrations)
- `pgcrypto` schon installiert in `extensions` → `gen_random_uuid()` verfügbar
- Project-ID: `ofejtonrjyszujugxwwm`, Region eu-central-1, Postgres 17.6, ACTIVE_HEALTHY
- `package.json`: keine db:* Scripts, keine `supabase`-CLI-Dep
- Kein `supabase/`-Ordner

**Critical ADRs:**
- **ADR-003:** Email-Unique via Generated Column `lower(trim(email))` — UNIQUE-Constraint darauf
- **ADR-004:** Soft-Delete (`deleted_at timestamptz NULL`) auf `contacts` + `deals` — KEINE Soft-Deletes auf `contact_comments`, `deal_notes`, `activity_log` (Audit-Trail-Charakter)
- **ADR-005:** `naechste_nachfass` als VIEW `deals_with_followup` mit `compute_followup()` und `next_business_day()` + `feiertage_nrw`-Tabelle
- **ADR-008:** RLS aktiv, `anon`-Role darf nur SELECT (active rows), `service_role` darf ALL — VIEW mit `WITH (security_invoker=true)`

---

## File Structure

| Aktion | Datei | Zweck |
|---|---|---|
| Create | `supabase/config.toml` | via `supabase init` — Project-Config |
| Create | `supabase/migrations/001_initial_schema.sql` | komplettes Schema |
| Create | `scripts/db-reset.mjs` | Custom-Reset-Script (DROP+REAPPLY ohne Docker) |
| Create | `src/types/supabase.ts` | generierte TS-Types |
| Modify | `package.json` | `supabase` + `pg` als devDep, 3 Scripts |
| Modify | `.env.example` | `DATABASE_URL` für Reset-Script |
| Modify | `.gitignore` | `supabase/.temp/`, `supabase/.branches/` (CLI-Artefakte) |
| Modify | `docs/04_progress.md` | Schritt 1 → ✅ |

---

## Tasks

### Task 1: Supabase CLI installieren + Project linken

**Files:** Create `supabase/config.toml`; Modify `package.json`, `.gitignore`

- [ ] **Step 1:** CLI als devDep installieren

```powershell
npm i -D supabase
```
Erwartung: `supabase` in `devDependencies`, lock-file aktualisiert.

- [ ] **Step 2:** CLI-Version verifizieren

```powershell
npx supabase --version
```
Erwartung: `2.x.x` (mind. 2.0).

- [ ] **Step 3:** Supabase-Folder anlegen

```powershell
npx supabase init
```
Erwartung: Erzeugt `supabase/config.toml`, `supabase/.gitignore`, evtl. weitere Defaults. Wenn Frage "generate VS Code settings": **No**.

- [ ] **Step 4:** Login (einmalig, browser-flow)

```powershell
npx supabase login
```
Erwartung: Browser öffnet sich, OAuth-Flow, "Logged in successfully" im Terminal.

- [ ] **Step 5:** Project linken

```powershell
npx supabase link --project-ref ofejtonrjyszujugxwwm
```
Erwartung: Frage nach DB-Passwort (aus Supabase-Dashboard → Settings → Database). Output: "Linked project successfully".

- [ ] **Step 6:** `.gitignore` ergänzen (Root-Level oder im supabase-Ordner)

```
# am Ende der bestehenden .gitignore:
supabase/.temp/
supabase/.branches/
```

- [ ] **Step 7:** Smoke-Verifikation

```powershell
npx supabase status --linked
```
Erwartung: Ausgabe zeigt `Linked project: ofejtonrjyszujugxwwm`.

- [ ] **Step 8:** Commit

```powershell
git add package.json package-lock.json supabase/config.toml supabase/.gitignore .gitignore
git commit -m "chore(db): supabase cli installiert + project linked"
```

---

### Task 2: NPM-Scripts + db:reset-Helper

**Files:** Modify `package.json`, `.env.example`; Create `scripts/db-reset.mjs`

- [ ] **Step 1:** `pg`-Driver als devDep für Custom-Reset-Script installieren

```powershell
npm i -D pg
npm i -D @types/pg
```

- [ ] **Step 2:** `scripts/db-reset.mjs` anlegen (DROP+REAPPLY, ohne Docker)

```javascript
// scripts/db-reset.mjs
// Drop public schema in linked Supabase project + re-apply all SQL migrations.
// Requires DATABASE_URL in .env.local (Supabase: Settings → Database → Connection string → URI, mode "Session").

import { Client } from 'pg'
import fs from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL not set in .env.local')
  process.exit(1)
}

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()

console.log('▶ DROP SCHEMA public CASCADE')
await client.query(`
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO postgres;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
`)

const dir = 'supabase/migrations'
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
for (const f of files) {
  const sql = fs.readFileSync(path.join(dir, f), 'utf8')
  console.log(`▶ Apply ${f} (${sql.length} bytes)`)
  await client.query(sql)
}

await client.end()
console.log('✓ db reset complete')
```

- [ ] **Step 3:** `dotenv` als devDep installieren (für das Script)

```powershell
npm i -D dotenv
```

- [ ] **Step 4:** `package.json`-Scripts erweitern

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "db:push": "supabase db push --linked",
    "db:reset": "node scripts/db-reset.mjs",
    "types:generate": "supabase gen types typescript --linked --schema public > src/types/supabase.ts"
  }
}
```

- [ ] **Step 5:** `.env.example` erweitern

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

- [ ] **Step 6:** User trägt echten `DATABASE_URL`-Wert in `.env.local` ein (Supabase Dashboard → Project Settings → Database → Connection string → URI, mode "Session")

- [ ] **Step 7:** Commit

```powershell
git add package.json package-lock.json scripts/db-reset.mjs .env.example
git commit -m "chore(db): scripts db:push, db:reset, types:generate"
```

---

### Task 3: Migration-Skeleton — pgcrypto + ENUMs

**Files:** Create `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1:** Migration-File mit Header + Extensions + Enums anlegen

```sql
-- ImmoCRM — initiales Schema
-- ADRs: 003 (email_normalized), 004 (soft-delete), 005 (followup view), 008 (RLS)

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TYPE contact_status AS ENUM ('kalt', 'warm', 'heiß', 'nr1');
CREATE TYPE deal_status    AS ENUM ('offen', 'berechnet', 'absage');
CREATE TYPE activity_type  AS ENUM ('new_lead', 'anruf', 'besichtigung', 'angebot');
```

- [ ] **Step 2:** Smoke-Test via MCP — Block standalone gegen leere DB ausführen

```
mcp__supabase__execute_sql({
  project_id: 'ofejtonrjyszujugxwwm',
  query: '<obiger Block>'
})
```
Erwartung: erfolgreiche Ausführung, kein Error. (Falls ENUMs schon existieren weil Task wiederholt: `DROP TYPE IF EXISTS ... CASCADE` davorsetzen.)

- [ ] **Step 3:** Cleanup nach Test

```sql
DROP TYPE IF EXISTS contact_status, deal_status, activity_type CASCADE;
```
via MCP `execute_sql` — damit Task 12 (atomare Apply) auf saubere DB triff.

---

### Task 4: feiertage_nrw + Seed (22 Einträge)

**Files:** Append zu `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1:** Tabelle + Seed anhängen

```sql
CREATE TABLE feiertage_nrw (
  date date PRIMARY KEY,
  name text NOT NULL
);

INSERT INTO feiertage_nrw (date, name) VALUES
  ('2026-01-01', 'Neujahr'),
  ('2026-04-03', 'Karfreitag'),
  ('2026-04-06', 'Ostermontag'),
  ('2026-05-01', 'Tag der Arbeit'),
  ('2026-05-14', 'Christi Himmelfahrt'),
  ('2026-05-25', 'Pfingstmontag'),
  ('2026-06-04', 'Fronleichnam'),
  ('2026-10-03', 'Tag der Deutschen Einheit'),
  ('2026-11-01', 'Allerheiligen'),
  ('2026-12-25', '1. Weihnachtstag'),
  ('2026-12-26', '2. Weihnachtstag'),
  ('2027-01-01', 'Neujahr'),
  ('2027-03-26', 'Karfreitag'),
  ('2027-03-29', 'Ostermontag'),
  ('2027-05-01', 'Tag der Arbeit'),
  ('2027-05-06', 'Christi Himmelfahrt'),
  ('2027-05-17', 'Pfingstmontag'),
  ('2027-05-27', 'Fronleichnam'),
  ('2027-10-03', 'Tag der Deutschen Einheit'),
  ('2027-11-01', 'Allerheiligen'),
  ('2027-12-25', '1. Weihnachtstag'),
  ('2027-12-26', '2. Weihnachtstag');
```

- [ ] **Step 2:** Smoke-Test via MCP — Block ausführen

```
mcp__supabase__execute_sql({
  project_id: 'ofejtonrjyszujugxwwm',
  query: '<obiger Block>'
})
```

- [ ] **Step 3:** Counts verifizieren

```
mcp__supabase__execute_sql({
  project_id: 'ofejtonrjyszujugxwwm',
  query: 'SELECT count(*) AS n FROM feiertage_nrw;'
})
```
Erwartung: `n = 22`.

```
mcp__supabase__execute_sql({
  project_id: 'ofejtonrjyszujugxwwm',
  query: "SELECT name FROM feiertage_nrw WHERE date = '2026-04-03';"
})
```
Erwartung: `name = 'Karfreitag'`.

- [ ] **Step 4:** Cleanup

```sql
DROP TABLE feiertage_nrw;
```

---

### Task 5: contacts-Tabelle (Generated email_normalized + Soft-Delete)

**Files:** Append zu `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1:** Tabelle anhängen

```sql
CREATE TABLE contacts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  email             text,
  email_normalized  text GENERATED ALWAYS AS (lower(trim(email))) STORED UNIQUE,
  phone             text,
  company           text,
  position          text DEFAULT 'Makler',
  status            contact_status NOT NULL DEFAULT 'kalt',
  lead_source       text,
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2:** Smoke — die ENUMs aus Task 3 müssen existieren. Re-create für Test-Lauf:

```sql
CREATE TYPE contact_status AS ENUM ('kalt', 'warm', 'heiß', 'nr1');
```
via MCP, dann den CREATE TABLE ausführen.

- [ ] **Step 3:** Email-Unique-Test

```sql
INSERT INTO contacts (name, email) VALUES ('Anton', 'Foo@x.de');
INSERT INTO contacts (name, email) VALUES ('Berta', 'foo@x.de');
```
Erwartung: Erster Insert OK, zweiter wirft `unique_violation` mit Constraint-Name `contacts_email_normalized_key`.

- [ ] **Step 4:** Cleanup

```sql
DROP TABLE contacts;
DROP TYPE contact_status;
```

---

### Task 6: deals-Tabelle (Generated price-Spalten + Soft-Delete + FK)

**Files:** Append zu `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1:** Tabelle anhängen

```sql
CREATE TABLE deals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id          uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  status              deal_status NOT NULL DEFAULT 'offen',
  object_type         text,
  einheiten           int,
  address             text,
  city                text,
  zip                 text,
  wohnflaeche_m2      numeric,
  preis_kauf          numeric,
  preis_pro_m2        numeric GENERATED ALWAYS AS (
    CASE WHEN wohnflaeche_m2 > 0 THEN preis_kauf / wohnflaeche_m2 ELSE NULL END
  ) STORED,
  kalk_verkaufspreis  numeric,
  kalk_pro_m2         numeric GENERATED ALWAYS AS (
    CASE WHEN wohnflaeche_m2 > 0 THEN kalk_verkaufspreis / wohnflaeche_m2 ELSE NULL END
  ) STORED,
  mein_angebot        numeric,
  angebot_datum       date,
  besichtigung_datum  date,
  letzter_anruf       date,
  expose_url          text,
  expose_local_path   text,
  notes_link          text,
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2:** Smoke — Re-create Dependencies (contacts + ENUMs) via MCP, dann CREATE TABLE deals testen.

- [ ] **Step 3:** Generated-Column-Test

```sql
INSERT INTO contacts (name) VALUES ('Test') RETURNING id;
-- captured: $cid
INSERT INTO deals (contact_id, wohnflaeche_m2, preis_kauf) VALUES ('<cid>', 100, 250000) RETURNING preis_pro_m2;
```
Erwartung: `preis_pro_m2 = 2500`.

- [ ] **Step 4:** Cleanup `DROP TABLE deals, contacts; DROP TYPE deal_status, contact_status;`

---

### Task 7: contact_comments + deal_notes + activity_log

**Files:** Append zu `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1:** Tabellen anhängen

```sql
CREATE TABLE contact_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  text        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE deal_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       uuid NOT NULL REFERENCES deals(id) ON DELETE RESTRICT,
  content_html  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        activity_type NOT NULL,
  contact_id  uuid REFERENCES contacts(id) ON DELETE RESTRICT,
  deal_id     uuid REFERENCES deals(id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2:** Smoke — Dependencies via MCP, dann CREATE TABLEs testen.

- [ ] **Step 3:** Cleanup analog Task 6.

---

### Task 8: updated_at-Trigger

**Files:** Append zu `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1:** Funktion + 4 Trigger anhängen

```sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_contact_comments_updated_at
  BEFORE UPDATE ON contact_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_deal_notes_updated_at
  BEFORE UPDATE ON deal_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- [ ] **Step 2:** Smoke — Function + Triggers testen

```sql
INSERT INTO contacts (name) VALUES ('Trigger-Test') RETURNING id, updated_at AS u1;
-- captured: $cid, $u1
SELECT pg_sleep(1);
UPDATE contacts SET name = 'Renamed' WHERE id = '<cid>' RETURNING updated_at AS u2;
```
Erwartung: `u2 > u1` (mind. 1 Sekunde später).

- [ ] **Step 3:** Cleanup analog Task 6.

---

### Task 9: Functions next_business_day + compute_followup

**Files:** Append zu `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1:** Functions anhängen (Wortlaut aus ADR-005)

```sql
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

CREATE OR REPLACE FUNCTION compute_followup(angebot date, status text, last_activity date)
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT CASE status
    WHEN 'offen'     THEN next_business_day(GREATEST(angebot, COALESCE(last_activity, angebot)) + 5)
    WHEN 'berechnet' THEN next_business_day(GREATEST(angebot, COALESCE(last_activity, angebot)) + 14)
    ELSE NULL
  END;
$$;
```

- [ ] **Step 2:** next_business_day-Test (Werktag-Verschiebung über NRW-Feiertag)

```sql
SELECT next_business_day('2026-04-03'::date) AS d;
```
Erwartung: `d = 2026-04-07` (3.4. Karfreitag → 4./5.4. Wochenende → 6.4. Ostermontag → 7.4. Dienstag).

- [ ] **Step 3:** compute_followup-Test (status = 'offen')

```sql
SELECT compute_followup('2026-05-08'::date, 'offen', NULL) AS d;
```
Erwartung: `d = 2026-05-13` (8.5.2026 ist Freitag. +5 Tage = 13.5. Mittwoch. 13.5. ist KEIN Feiertag, KEIN Wochenende → next_business_day liefert 13.5. zurück).

- [ ] **Step 4:** compute_followup-Test (status = 'berechnet', last_activity später)

```sql
SELECT compute_followup('2026-05-08'::date, 'berechnet', '2026-05-10'::date) AS d;
```
Erwartung: `GREATEST(2026-05-08, 2026-05-10) + 14 = 2026-05-24` (Sonntag) → next_business_day → 2026-05-25 ist Pfingstmontag (Feiertag) → 2026-05-26 (Dienstag). `d = 2026-05-26`.

- [ ] **Step 5:** compute_followup-Test (status = 'absage')

```sql
SELECT compute_followup('2026-05-08'::date, 'absage', NULL) AS d;
```
Erwartung: `d IS NULL`.

- [ ] **Step 6:** Cleanup

```sql
DROP FUNCTION compute_followup(date, text, date);
DROP FUNCTION next_business_day(date);
```

---

### Task 10: VIEW deals_with_followup + Index

**Files:** Append zu `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1:** Index + VIEW anhängen

```sql
CREATE INDEX idx_contact_comments_contact_created
  ON contact_comments(contact_id, created_at DESC);

CREATE VIEW deals_with_followup
  WITH (security_invoker = true) AS
  SELECT
    d.*,
    (SELECT MAX(c.created_at)::date
       FROM contact_comments c
       WHERE c.contact_id = d.contact_id) AS last_activity,
    compute_followup(
      d.angebot_datum,
      d.status::text,
      (SELECT MAX(c.created_at)::date
         FROM contact_comments c
         WHERE c.contact_id = d.contact_id)
    ) AS naechste_nachfass
  FROM deals d;
```

- [ ] **Step 2:** Smoke — Dependencies via MCP, dann VIEW + Insert testen

```sql
-- nach Setup von contacts/deals/comments + Functions:
INSERT INTO contacts (name) VALUES ('View-Test') RETURNING id;
-- $cid
INSERT INTO deals (contact_id, status, angebot_datum) VALUES ('<cid>', 'berechnet', '2026-05-08');
-- $did
SELECT id, status, angebot_datum, last_activity, naechste_nachfass
  FROM deals_with_followup WHERE contact_id = '<cid>';
```
Erwartung: 1 Zeile mit `last_activity = NULL`, `naechste_nachfass = 2026-05-22` (Freitag, kein Feiertag).

> **Hinweis:** GUIDELINES Zeile 86 fordert "Migrations als SQL-Files unter `supabase/migrations/`". Das einzelne Datei-Setup hier hält das ein.

- [ ] **Step 3:** Cleanup analog vorigen Tasks.

---

### Task 11: RLS aktivieren + Policies

**Files:** Append zu `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1:** RLS-Block anhängen (Wortlaut aus ADR-008)

```sql
ALTER TABLE contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals             ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE feiertage_nrw     ENABLE ROW LEVEL SECURITY;

-- Anon-Key: nur SELECT, nur aktive Zeilen (siehe ADR-004)
CREATE POLICY "anon_read_active" ON contacts
  FOR SELECT TO anon USING (deleted_at IS NULL);
CREATE POLICY "anon_read_active" ON deals
  FOR SELECT TO anon USING (deleted_at IS NULL);

-- Tabellen ohne deleted_at: einfacher SELECT
CREATE POLICY "anon_read" ON contact_comments FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON deal_notes       FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON activity_log     FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON feiertage_nrw    FOR SELECT TO anon USING (true);

-- Service-Role: alles
CREATE POLICY "service_full" ON contacts          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full" ON deals             FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full" ON contact_comments  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full" ON deal_notes        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full" ON activity_log      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full" ON feiertage_nrw     FOR ALL TO service_role USING (true) WITH CHECK (true);
```

- [ ] **Step 2:** Smoke-Test via MCP — kompletter Block executable. Detail-Tests folgen in Task 13.

---

### Task 12: Komplette Migration atomar applizieren

**Files:** keine Änderungen (Live-Apply der zusammengebauten Migration)

- [ ] **Step 1:** Schema sauber droppen (Test-Cleanup-Reste der vorigen Tasks)

```
mcp__supabase__execute_sql({
  project_id: 'ofejtonrjyszujugxwwm',
  query: 'DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;'
})
```

- [ ] **Step 2:** Komplette Migration via MCP atomar applizieren

```
mcp__supabase__apply_migration({
  project_id: 'ofejtonrjyszujugxwwm',
  name: '001_initial_schema',
  query: '<gesamter Inhalt von supabase/migrations/001_initial_schema.sql>'
})
```
Erwartung: Success, kein SQL-Error. Bei Error → in der Migration-Datei reparieren, Step 1+2 wiederholen.

- [ ] **Step 3:** Tabellen verifizieren

```
mcp__supabase__list_tables({
  project_id: 'ofejtonrjyszujugxwwm',
  schemas: ['public'],
  verbose: true
})
```
Erwartung: 6 Tabellen (`contacts`, `deals`, `contact_comments`, `deal_notes`, `activity_log`, `feiertage_nrw`), inkl. Spalten + FKs.

- [ ] **Step 4:** Migration verifizieren

```
mcp__supabase__list_migrations({ project_id: 'ofejtonrjyszujugxwwm' })
```
Erwartung: `001_initial_schema` gelistet.

- [ ] **Step 5:** Seed verifizieren

```
mcp__supabase__execute_sql({
  project_id: 'ofejtonrjyszujugxwwm',
  query: 'SELECT count(*) AS n FROM feiertage_nrw;'
})
```
Erwartung: `n = 22`.

---

### Task 13: Akzeptanztests (Service-Role + Anon + VIEW + Soft-Delete)

**Files:** keine Änderungen (Live-Tests gegen applizierte Schema)

- [ ] **Step 1:** Service-Role-Insert je Tabelle (MCP läuft als Service-Role)

```sql
INSERT INTO contacts (name, email, status, lead_source) VALUES ('Test Makler', 'test@x.de', 'warm', 'Online') RETURNING id;
-- captured: $cid

INSERT INTO deals (contact_id, status, address, wohnflaeche_m2, preis_kauf, kalk_verkaufspreis, angebot_datum) VALUES ('<cid>', 'berechnet', 'Talstr 10', 100, 250000, 350000, '2026-05-08') RETURNING id, preis_pro_m2, kalk_pro_m2;
-- captured: $did, expect preis_pro_m2 = 2500, kalk_pro_m2 = 3500

INSERT INTO contact_comments (contact_id, text) VALUES ('<cid>', 'Erstkontakt am Telefon');
INSERT INTO deal_notes (deal_id, content_html) VALUES ('<did>', '<p>Verhandlungsspielraum 5%</p>');
INSERT INTO activity_log (type, contact_id, deal_id) VALUES ('new_lead', '<cid>', '<did>');
```
Erwartung: 5 erfolgreiche Inserts, kein RLS-Error, alle generated columns korrekt.

- [ ] **Step 2:** VIEW-Test (Werktag-Logik mit comment-basierter last_activity)

```sql
INSERT INTO contact_comments (contact_id, text) VALUES ('<cid>', 'Nachfass-Anruf') RETURNING created_at::date;
-- captured: $today (heute = 2026-05-09)

SELECT id, status, angebot_datum, last_activity, naechste_nachfass
  FROM deals_with_followup WHERE id = '<did>';
```
Erwartung: `last_activity` = heute, `naechste_nachfass = next_business_day(GREATEST(2026-05-08, today) + 14)`. Bei heute = 2026-05-09: GREATEST = 2026-05-09 → +14 = 2026-05-23 (Samstag) → 2026-05-25 ist Pfingstmontag (Feiertag) → 2026-05-26 (Dienstag).

- [ ] **Step 3:** VIEW absage-Test

```sql
UPDATE deals SET status = 'absage' WHERE id = '<did>';
SELECT naechste_nachfass FROM deals_with_followup WHERE id = '<did>';
```
Erwartung: `naechste_nachfass IS NULL`.

- [ ] **Step 4:** Anon-Key-Read-Test (REST, da MCP nur Service-Role)

```powershell
$ANON = (Get-Content .env.local | Select-String 'VITE_SUPABASE_ANON_KEY').ToString().Split('=')[1]
curl -H "apikey: $ANON" -H "Authorization: Bearer $ANON" "https://ofejtonrjyszujugxwwm.supabase.co/rest/v1/contacts?select=id,name,email"
```
Erwartung: HTTP 200, JSON-Array mit Test-Contact.

- [ ] **Step 5:** Anon-Key-Insert-Reject (REST)

```powershell
curl -X POST -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -H "Prefer: return=representation" -d '{"name":"Anon Hacker"}' "https://ofejtonrjyszujugxwwm.supabase.co/rest/v1/contacts"
```
Erwartung: HTTP 401 oder 403 mit RLS-Error-Body (`new row violates row-level security policy`).

- [ ] **Step 6:** Soft-Delete-Test

```sql
-- Service-Role:
UPDATE contacts SET deleted_at = now() WHERE id = '<cid>';
```

```powershell
curl -H "apikey: $ANON" -H "Authorization: Bearer $ANON" "https://ofejtonrjyszujugxwwm.supabase.co/rest/v1/contacts?select=id,name"
```
Erwartung: HTTP 200, leeres Array (Test-Contact ist soft-deleted, Anon sieht ihn nicht).

```sql
-- Service-Role: Restore
UPDATE contacts SET deleted_at = NULL WHERE id = '<cid>';
```

- [ ] **Step 7:** Test-Daten-Cleanup (für sauberen Start in Schritt 2)

```sql
DELETE FROM activity_log;
DELETE FROM deal_notes;
DELETE FROM contact_comments;
DELETE FROM deals;
DELETE FROM contacts;
```

---

### Task 14: TypeScript-Types generieren

**Files:** Create `src/types/supabase.ts`

- [ ] **Step 1:** Types generieren via npm-Script

```powershell
npm run types:generate
```
Erwartung: Exit-Code 0, `src/types/supabase.ts` ist nicht-leer (>2 KB).

> Falls Fehler "supabase login required": `npx supabase login` zuerst (sollte aus Task 1 schon geloggt sein).

- [ ] **Step 2:** Datei-Inhalt verifizieren

```powershell
Select-String -Path src/types/supabase.ts -Pattern 'contacts|deals|contact_comments|deal_notes|activity_log|feiertage_nrw|deals_with_followup' | Measure-Object | Select-Object Count
```
Erwartung: Alle 7 Identifier kommen vor (Tabellen + VIEW).

- [ ] **Step 3:** Build-Smoke

```powershell
npm run build
```
Erwartung: TypeScript-Compile durch, keine Errors. Vite-Build erfolgreich.

- [ ] **Step 4:** Optional — `src/lib/supabase.ts` mit Database-Type erweitern (sauberer Polish, nicht Akzeptanz-blocker):

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY müssen in .env gesetzt sein.')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

> Voraussetzung für `@/`-Import: `tsconfig.json` `paths`-Mapping muss existieren. Wenn nicht: relativen Import `'../types/supabase'` nutzen.

---

### Task 15: Doku-Update + Commit + Push

**Files:** Modify `docs/04_progress.md`

- [ ] **Step 1:** `docs/04_progress.md` Phase-3-Tabelle Schritt-1-Zeile aktualisieren:

```markdown
| 1 | Datenbank-Schema | ✅ | 2026-05-09 | 003-008 | Migration applied via MCP, RLS verifiziert, Types generiert |
```

- [ ] **Step 2:** Git-Status prüfen

```powershell
git status
```
Erwartung: Modifizierte / neue Files:
- `package.json`, `package-lock.json`
- `supabase/config.toml`, `supabase/.gitignore`
- `supabase/migrations/001_initial_schema.sql`
- `scripts/db-reset.mjs`
- `src/types/supabase.ts`
- `.env.example`
- `.gitignore`
- `docs/04_progress.md`
- (Optional aus Task 14 Step 4) `src/lib/supabase.ts`

- [ ] **Step 3:** Commit (Multi-File, gezielt)

```powershell
git add package.json package-lock.json supabase/ scripts/db-reset.mjs src/types/supabase.ts .env.example .gitignore docs/04_progress.md
# falls src/lib/supabase.ts geändert: git add src/lib/supabase.ts
git commit -m "feat(db): Schritt 1 — initiales DB-Schema mit RLS und Followup-View"
```

- [ ] **Step 4:** Push

```powershell
git push origin main
```

---

## Verification

### Automated (via MCP)

| Check | Erwartet |
|---|---|
| `list_tables` | 6 Tabellen in `public` |
| `list_migrations` | `001_initial_schema` gelistet |
| `SELECT count(*) FROM feiertage_nrw` | 22 |
| `SELECT next_business_day('2026-04-03')` | `2026-04-07` |
| `SELECT compute_followup('2026-05-08','berechnet','2026-05-10')` | `2026-05-26` |
| `SELECT compute_followup('2026-05-08','absage',NULL)` | `NULL` |
| Service-Role Insert (5 Tabellen) | alle 200 OK |
| Generated `preis_pro_m2` für 100m²/250k€ | `2500` |
| Email-Unique-Violation bei `Foo@x.de` + `foo@x.de` | `unique_violation` |
| VIEW `deals_with_followup` mit Test-Daten | 1 Zeile, korrekte `naechste_nachfass` |

### Manual (Terminal)

| Check | Erwartet |
|---|---|
| `npm run types:generate` | Exit 0, `src/types/supabase.ts` >2 KB |
| `npm run build` | TS-Compile + Vite-Build erfolgreich |
| Anon-REST `GET /contacts` | 200 OK, JSON-Array |
| Anon-REST `POST /contacts` | 401/403 RLS-Block |
| Soft-Delete via Service-Role + Anon-Read | Anon sieht Contact nicht mehr |

### Optional

- [ ] **`npm run db:reset`** lokal ausführen (vorausgesetzt `DATABASE_URL` in `.env.local` gesetzt). Erwartung: Schema wird gedroppt + Migration neu angewendet, Logs zeigen `✓ db reset complete`. **Nur wenn keine echten Daten in der DB** — sicher in Schritt 1.

---

## Anhang — Open Items für nächste Schritte (kein Block)

- **DSGVO-Hard-Delete-Skript** (ADR-009): wird in Schritt 5/7-Vorbereitung adressiert. Soft-Delete reicht für Schritt 1.
- **`metadata jsonb` auf activity_log**: derzeit nicht enthalten. Wird in Schritt 8 (Tages-Mail) ergänzt, falls `daily_mail_failed`-Events Payload brauchen — via `ALTER TABLE`.
- **`src/lib/supabase.ts` mit `Database`-Type**: optional in Task 14 Step 4, kein Akzeptanzblocker.
- **Backup-Strategie** (ADR-010): vor Schritt 9 (Excel-Migration). Schritt 1 hat noch keine echten Daten zum Sichern.
