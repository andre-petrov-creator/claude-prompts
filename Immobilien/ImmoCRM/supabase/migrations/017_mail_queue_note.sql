-- 017_mail_queue_note.sql
-- Note-Spalte fuer Duplikat-Marker (z.B. "duplicate of <slug>") und sonstige Hinweise im Akquise-Pfad.
-- error_msg bleibt fuer echte Fehler reserviert, note fuer informelle Markierungen.

ALTER TABLE mail_queue ADD COLUMN note text;
