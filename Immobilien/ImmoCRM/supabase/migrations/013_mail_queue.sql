-- 013_mail_queue.sql
-- Idempotenz-Tabelle für Pipeline (Microsoft Graph Webhook)

CREATE TABLE mail_queue (
  message_id        text PRIMARY KEY,
  graph_message_id  text,
  status            text NOT NULL CHECK (status IN ('pending', 'processing', 'done', 'error')),
  enqueued_at       timestamptz NOT NULL DEFAULT now(),
  started_at        timestamptz,
  done_at           timestamptz,
  error_msg         text,
  deal_id           uuid REFERENCES deals(id) ON DELETE SET NULL
);

CREATE INDEX idx_mail_queue_status ON mail_queue(status);
CREATE INDEX idx_mail_queue_enqueued ON mail_queue(enqueued_at DESC);

-- Service-Role-Key bypasst RLS (Default-Verhalten), keine Policies nötig
-- Anon-Key darf NICHT auf mail_queue zugreifen — keine GRANTs für anon
REVOKE ALL ON mail_queue FROM anon;
GRANT ALL ON mail_queue TO service_role;
