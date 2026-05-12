-- Schritt 6 — CRM-Tabelle (Chat-Stream pro Kontakt)
-- ADR-011 Single-User-Pragmatik: anon darf gezielt CRUD auf contact_comments.
-- Bei Multi-User: zurückrollen, USING/WITH CHECK auf auth.uid() umstellen.
--
-- contacts UPDATE-Policy + GRANT existieren bereits aus Migration 004
-- (anon_update_contacts) und decken auch den Status-Inline-Edit (kalt|warm|heiß|nr1)
-- über useUpdateContactField mit ab.

CREATE POLICY "anon_insert" ON contact_comments
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update" ON contact_comments
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_delete" ON contact_comments
  FOR DELETE TO anon USING (true);

GRANT INSERT, UPDATE, DELETE ON contact_comments TO anon;
