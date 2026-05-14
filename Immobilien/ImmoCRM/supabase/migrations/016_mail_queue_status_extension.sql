-- 016_mail_queue_status_extension.sql
-- Erweitert mail_queue.status um 'ready_for_quickcheck' (lokaler Quick-Check-Übergabepunkt)

ALTER TABLE mail_queue DROP CONSTRAINT IF EXISTS mail_queue_status_check;

ALTER TABLE mail_queue ADD CONSTRAINT mail_queue_status_check
  CHECK (status IN ('pending', 'processing', 'ready_for_quickcheck', 'done', 'error'));
