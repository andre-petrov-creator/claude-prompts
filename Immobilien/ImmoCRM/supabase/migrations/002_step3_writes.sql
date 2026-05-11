-- Schritt 3 — Frontend-Mutations
-- ADR-011: Single-User-Pragmatik. Anon-Key darf gezielt schreiben.
-- Wenn jemals Multi-User: zurückrollen, Auth einführen, USING auf auth.uid().

-- deal_notes: vollständiges CRUD für anon
CREATE POLICY "anon_insert" ON deal_notes
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update" ON deal_notes
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_delete" ON deal_notes
  FOR DELETE TO anon USING (true);

-- deals: UPDATE für anon, beschränkt auf aktive (nicht-gelöschte) Zeilen.
-- Frontend-Hook kontrolliert welche Spalten geändert werden (letzter_anruf,
-- besichtigung_datum). Spalten-Restriktion auf DB-Ebene ist in Postgres-RLS
-- nicht ohne Function möglich; bei Multi-User-Bedarf via Edge Function ersetzen.
CREATE POLICY "anon_update_deals" ON deals
  FOR UPDATE TO anon
  USING (deleted_at IS NULL)
  WITH CHECK (deleted_at IS NULL);
