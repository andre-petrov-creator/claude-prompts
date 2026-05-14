-- 014_deals_priority_score.sql
-- QuickCheck-Score + Herkunft + Mail-Referenz auf deals

ALTER TABLE deals ADD COLUMN priority_score    integer CHECK (priority_score BETWEEN 0 AND 100);
ALTER TABLE deals ADD COLUMN priority_reason   text;
ALTER TABLE deals ADD COLUMN expose_source     text NOT NULL DEFAULT 'manual'
  CHECK (expose_source IN ('mail-pipeline', 'manual', 'aufteiler'));
ALTER TABLE deals ADD COLUMN inbox_message_id  text;
ALTER TABLE deals ADD COLUMN workspace_path    text;

CREATE INDEX idx_deals_priority_score
  ON deals(priority_score DESC NULLS LAST)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_deals_pre_screened
  ON deals(created_at DESC)
  WHERE status = 'pre_screened' AND deleted_at IS NULL;
