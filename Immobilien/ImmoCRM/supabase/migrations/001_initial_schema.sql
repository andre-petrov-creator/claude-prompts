-- ImmoCRM — initiales Schema
-- ADRs: 003 (email_normalized), 004 (soft-delete), 005 (followup view), 008 (RLS)

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TYPE contact_status AS ENUM ('kalt', 'warm', 'heiß', 'nr1');
CREATE TYPE deal_status    AS ENUM ('offen', 'berechnet', 'absage');
CREATE TYPE activity_type  AS ENUM ('new_lead', 'anruf', 'besichtigung', 'angebot');

-- Feiertage NRW 2026/2027 (siehe ADR-005, jährlich pflegen)
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

-- updated_at-Trigger: setzt updated_at auf now() bei jedem UPDATE
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
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

-- Werktag-Logik (ADR-005): überspringt Sa/So + NRW-Feiertage
CREATE OR REPLACE FUNCTION next_business_day(d date)
RETURNS date LANGUAGE sql STABLE
SET search_path = public, pg_catalog
AS $$
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

-- Followup-Berechnung (ADR-005): offen +5 Werktage, berechnet +14, absage NULL
CREATE OR REPLACE FUNCTION compute_followup(angebot date, status text, last_activity date)
RETURNS date LANGUAGE sql STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT CASE status
    WHEN 'offen'     THEN next_business_day(GREATEST(angebot, COALESCE(last_activity, angebot)) + 5)
    WHEN 'berechnet' THEN next_business_day(GREATEST(angebot, COALESCE(last_activity, angebot)) + 14)
    ELSE NULL
  END;
$$;

-- FK-Indices: ohne diese sind JOINs langsam (Supabase-Linter-Empfehlung)
CREATE INDEX idx_contact_comments_contact_created ON contact_comments(contact_id, created_at DESC);
CREATE INDEX idx_deals_contact_id           ON deals(contact_id);
CREATE INDEX idx_deal_notes_deal_id         ON deal_notes(deal_id);
CREATE INDEX idx_activity_log_contact_id    ON activity_log(contact_id);
CREATE INDEX idx_activity_log_deal_id       ON activity_log(deal_id);

-- View für Frontend/Cron-Mail (ADR-005 + ADR-008): security_invoker = RLS des Aufrufers gilt
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

-- RLS (ADR-008): anon liest nur aktive Zeilen, service_role darf alles
ALTER TABLE contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals             ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE feiertage_nrw     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_active" ON contacts
  FOR SELECT TO anon USING (deleted_at IS NULL);
CREATE POLICY "anon_read_active" ON deals
  FOR SELECT TO anon USING (deleted_at IS NULL);

CREATE POLICY "anon_read" ON contact_comments FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON deal_notes       FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON activity_log     FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON feiertage_nrw    FOR SELECT TO anon USING (true);

CREATE POLICY "service_full" ON contacts          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full" ON deals             FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full" ON contact_comments  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full" ON deal_notes        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full" ON activity_log      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full" ON feiertage_nrw     FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Table/View/Function-GRANTs: ohne diese blockt Postgres vor RLS mit "permission denied"
GRANT SELECT ON contacts, deals, contact_comments, deal_notes, activity_log, feiertage_nrw TO anon;
GRANT SELECT ON deals_with_followup TO anon;
GRANT EXECUTE ON FUNCTION next_business_day(date), compute_followup(date, text, date) TO anon;

GRANT ALL ON contacts, deals, contact_comments, deal_notes, activity_log, feiertage_nrw TO service_role;
GRANT ALL ON deals_with_followup TO service_role;
GRANT EXECUTE ON FUNCTION next_business_day(date), compute_followup(date, text, date) TO service_role;
