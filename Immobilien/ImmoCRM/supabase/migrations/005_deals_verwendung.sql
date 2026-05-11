-- Spalte für Geschäftsmodell pro Deal (B&H, F&F, etc.)
-- "Verwendung" war bisher mit object_type vermischt; jetzt klar getrennt:
--   object_type → Gebäudetyp (MFH, ETW, REH, EFH, …)
--   verwendung  → Strategie (B&H = Buy and Hold, F&F = Fix and Flip)

ALTER TABLE deals ADD COLUMN verwendung text;
