-- Schritt 4: Manuelles Lead-Anlegen
-- ADR-011/012: Single-User-Pragmatik — Anon darf gezielt INSERT auf
-- contacts, deals und activity_log. Wenn Multi-User: zurückrollen,
-- USING/WITH CHECK auf auth.uid() umstellen.
--
-- contacts UPDATE-Policy + GRANT existieren bereits aus Migration 004
-- (anon_update_contacts), wird hier NICHT erneut angelegt.

CREATE POLICY "anon_insert_contacts" ON contacts
  FOR INSERT TO anon WITH CHECK (deleted_at IS NULL);

CREATE POLICY "anon_insert_deals" ON deals
  FOR INSERT TO anon WITH CHECK (deleted_at IS NULL);

CREATE POLICY "anon_insert_activity_log" ON activity_log
  FOR INSERT TO anon WITH CHECK (true);

GRANT INSERT ON contacts TO anon;
GRANT INSERT ON deals TO anon;
GRANT INSERT ON activity_log TO anon;
