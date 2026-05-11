-- View deals_with_followup neu kompilieren, damit verwendung via d.* drin ist
DROP VIEW IF EXISTS deals_with_followup;

CREATE VIEW deals_with_followup
  WITH (security_invoker=true) AS
  SELECT d.*,
    (SELECT MAX(c.created_at)::date FROM contact_comments c WHERE c.contact_id = d.contact_id) AS last_activity,
    compute_followup(
      d.angebot_datum,
      d.status::text,
      (SELECT MAX(c.created_at)::date FROM contact_comments c WHERE c.contact_id = d.contact_id)
    ) AS naechste_nachfass
  FROM deals d;
