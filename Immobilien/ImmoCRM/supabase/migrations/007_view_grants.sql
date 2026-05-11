-- DROP VIEW in 006 hat die GRANTs auf deals_with_followup verloren — wiederherstellen.
GRANT SELECT ON deals_with_followup TO anon, authenticated;
