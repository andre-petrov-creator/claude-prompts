-- ADR-011 follow-up: GRANTs für anon, die zu den RLS-Policies aus 002 passen.
-- Ohne diese GRANTs greift die Policy nicht — Postgres blockt auf Privilege-Ebene.

GRANT INSERT, UPDATE, DELETE ON deal_notes TO anon;
GRANT UPDATE ON deals TO anon;
