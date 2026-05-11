-- ADR-011 follow-up: alle Cells inline-editierbar.
-- contacts UPDATE für anon (Name, Firma, Tel, Email, Lead-Source, Position).

CREATE POLICY "anon_update_contacts" ON contacts
  FOR UPDATE TO anon
  USING (deleted_at IS NULL)
  WITH CHECK (deleted_at IS NULL);

GRANT UPDATE ON contacts TO anon;
