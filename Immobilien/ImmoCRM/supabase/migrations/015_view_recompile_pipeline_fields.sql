-- View deals_with_followup neu kompilieren, damit Pipeline-Felder
-- (priority_score, priority_reason, expose_source, inbox_message_id, workspace_path)
-- aus Migration 014 via d.* sichtbar werden.
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
