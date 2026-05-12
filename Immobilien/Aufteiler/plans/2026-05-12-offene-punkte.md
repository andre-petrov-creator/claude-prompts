# Offene Punkte — 2026-05-12

Während Brainstorming zum Skill-Umbau (siehe `docs/superpowers/specs/2026-05-12-aufteiler-skill-umbau-design.md`, folgt) genannte inhaltliche Themen. Werden **separat** adressiert, nicht im Skill-Umbau selbst.

============================================================

## 1. Rücklage und Mietsubvention NICHT in Modernisierungskosten

**Symptom (Sitzung 2026-05-12):**
Im letzten Output sind die errechnete Rücklage und die Mietsubvention in der Reno-Tabelle (Modernisierungskosten-Block) gelandet.

**Soll-Verhalten:**
- Rücklage und Mietsubvention gehören in die **zwei Extra-Spalten unter der Verkaufsmatrix** (`VERKAUFSMATRIX`-Sheet) — nicht in den Modernisierungskosten-Block.
- Grund: Auf die Modernisierungskosten werden Steuern noch separat berechnet. Rücklage und Subvention dürfen darin nicht enthalten sein, sonst wird die Steuerbasis verfälscht.

**Was zu prüfen ist:**
- Welches Modul liefert aktuell die Werte? (Vermutlich Modul 4 Mietsituation für Subvention; Rücklage evtl. Modul 2 Massnahmen oder Excel-Formel.)
- Welche Excel-Zellen sind betroffen — wohin landet es heute, wohin soll es?
- Asset-Trennung (`CLAUDE.md`-Prinzip) wird verletzt: Modernisierungs-Block vs. Cashflow-Block werden vermischt.

**Fix-Pfad:**
- Beim Bau des neuen `aufteiler-modul-4-miete`-Skill (im Skill-Umbau): Mietsubvention klar in `VERKAUFSMATRIX`-Extra-Spalte schreiben, nicht in Reno-Tabelle.
- Rücklage analog im zuständigen Modul.
- Self-Check pro Modul: "Steht irgendein Wert im Reno-Block, der nicht reine Bau-/Modernisierungskosten ist?" → wenn ja, rot.

============================================================

## 2. RND-Gutachten und WEG-Teilung als Reno-Kosten ansetzen

**Anforderung:**
Zwei neue Positionen in der Reno-Tabelle (Modernisierungskosten-Block):

| Position | Ansatz | Hinweis |
|----------|--------|---------|
| Restnutzungsdauer-Gutachten | **1.000 €/WE netto** | Pauschal pro Wohneinheit |
| WEG-Teilung | Nettopreis (konkreter Betrag noch festzulegen / aus Erfahrungswerten) | Einmalkosten für die Aufteilung |

**Wichtig — Brutto/Netto-Logik prüfen:**
- Ansatz erfolgt **netto** in der Tabelle.
- Annahme: Die Tabelle rechnet selbst die USt drauf (19 %) und führt die Brutto-Summe weiter.
- **Vor Umsetzung verifizieren:** Tut die Excel das wirklich für *alle* Reno-Kosten-Zellen, oder nur für bestimmte? Wenn nicht durchgängig → Spalten-Vertrag anpassen oder Modul liefert direkt Brutto.

**Fix-Pfad:**
- Beim Bau des neuen `aufteiler-modul-3-massnahmen`-Skill: zwei Pflicht-Positionen "RND-Gutachten" und "WEG-Teilung" in den Massnahmen-Output aufnehmen, je netto, je WE bzw. einmalig.
- Schema-Feld in `state.json` ergänzen (`modul_3.rnd_gutachten_eur_netto`, `modul_3.weg_teilung_eur_netto`).
- Excel-Handoff-Vertrag dokumentieren: in welche Zellen, mit welcher Formel-Erwartung.

============================================================

## Status

- [ ] Beides offen
- Beide Punkte werden in die Spec `2026-05-12-aufteiler-skill-umbau-design.md` als **Anforderungen an die neuen Modul-Skills** verlinkt, damit beim Bau der Skills nicht vergessen.
- Verifikation des Brutto/Netto-Verhaltens der Excel-Tabelle: separate Mini-Session vor Modul-3-Skill-Bau.
