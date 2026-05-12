-- Schritt 6 follow-up: Zähler wie oft "Letzter Kontakt"-Datum gesetzt wurde.
-- Increment passiert im Frontend bei jedem letzter_kontakt-Save mit
-- Nicht-Null-Wert. Single-User: Race-Conditions irrelevant.

ALTER TABLE contacts
  ADD COLUMN kontakt_count integer NOT NULL DEFAULT 0;
