-- 012_deal_status_pre_screened.sql
-- Enum pre_screened hinzufügen, compute_followup um neue Status erweitern

ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'pre_screened' BEFORE 'offen';

-- compute_followup: pre_screened bekommt KEINE Followup-Pflicht
-- (Owner muss erst manuell übernehmen → Status auf 'offen' setzen)
CREATE OR REPLACE FUNCTION compute_followup(angebot date, status text, last_activity date)
RETURNS date LANGUAGE sql STABLE
AS $$
  SELECT CASE status
    WHEN 'pre_screened' THEN NULL
    WHEN 'offen'        THEN next_business_day(GREATEST(angebot, COALESCE(last_activity, angebot)) + 5)
    WHEN 'berechnet'    THEN next_business_day(GREATEST(angebot, COALESCE(last_activity, angebot)) + 14)
    ELSE NULL
  END;
$$;
