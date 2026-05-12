-- Schritt 6 follow-up: "Letzter Kontakt" ist ein manuell setzbares Datum
-- auf contacts, kein computed-MAX mehr. Begründung: User-Erwartung — Klick auf
-- die Zelle öffnet Datepicker.

ALTER TABLE contacts ADD COLUMN letzter_kontakt date NULL;
