# Excel-Handoff-Vertrag

Pro Excel-Sheet eine Tabelle. Jede Zeile beschreibt **eine Zelle**, die von einem Modul-Skill geschrieben wird, mit:
- `Sheet!Zelle`: exakte Adresse im Template `Kalkulation_Aufteiler_mit_VK_CF.xlsx`
- `Inhalt`: was steht drin
- `Quelle (Schema-Pfad)`: woher kommt der Wert in `state.json`
- `Liefer-Modul`: welcher Modul-Skill schreibt diese Zelle

Wird pro Modul beim Bau befüllt. **Vertrag** — wenn eine Zelle hier steht, darf kein anderes Modul sie überschreiben.

Konvention: `N` = `len(modul_1.we_liste)` (Anzahl WE). `i` = WE-Index 0..N-1. Excel-Zeilen 8..7+N für WE-bezogene Daten.

---

## Sheet `MIETER`

| Sheet!Zelle | Inhalt | Quelle (Schema-Pfad) | Liefer-Modul |
|-------------|--------|----------------------|--------------|
| `MIETER!A8:A<7+N>` | WE-Nr (durchnummeriert) | `modul_1.we_liste[].we_nr` | Modul 1 |
| `MIETER!B8:B<7+N>` | Lage im Haus | `modul_1.we_liste[].lage_im_haus` | Modul 1 |
| `MIETER!F8:F<7+N>` | Wohnfläche m² | `modul_1.we_liste[].wohnflaeche_qm` | Modul 1 |
| `MIETER!G8:G<7+N>` | Zimmer-Anzahl | `modul_1.we_liste[].zimmer_anzahl` | Modul 1 |
| `MIETER!H8:H<7+N>` | Balkon (ja/nein) | `modul_1.we_liste[].balkon` | Modul 1 |
| `MIETER!I8:I<7+N>` | Keller (ja/nein) | `modul_1.we_liste[].keller` | Modul 1 |
| `MIETER!M6` | Mietspiegel-Mittelwert €/m² (vor Sanierung) | `modul_4` (gewichteter Mittelwert über `we_mieten[].sollmiete_eur_pro_qm`) | Modul 4 |
| `MIETER!P6` | Kappungsgrenze (Dezimal, z.B. 0.15) | `modul_4` (stadtspezifisch) | Modul 4 |
| `MIETER!Y8:Y<7+N>` | Mietspiegel-Obergrenze €/m² pro WE | `modul_4.we_mieten[].mietspiegel_obergrenze_eur_pro_qm` | Modul 4 |

## Sheet `KALKU`

**Achtung — Zell-Adressen-Verifikation TODO (2026-05-12):**

Inspektion des echten Templates `template/Kalkulation_Aufteiler_mit_VK_CF.xlsx` ergab:
- `KALKU!C20` ist im Template eine **Formel-Zelle** (`=IFERROR(C19/C13,"")` — GIK pro m²), KEIN BRW-Eingangs-Feld.
- `KALKU!C23` ist **Zins B&H** (Default 0.04), KEIN Gebäudeanteil.
- `KALKU!C26` ist ein **Merged-Cell-Header** ("2. NEBENKOSTENRECHNER"), nicht schreibbar.

Die im alten `archive/modul_1_objektbasis.xml` v1.1 dokumentierten Zell-Adressen (C20/C21/C22/C23 für BRW/Bodenwert/Gebäude-KP/Gebäudeanteil) sind in der aktuellen Template-Version **nicht mehr gültig**.

**Aufgabe vor Modul-5-Live-Lauf:** Korrekte Eingangs-Zellen im Template ermitteln (vermutlich in einem separaten KALKU-Block unterhalb oder in einem dedizierten Sheet wie `BESICHTIGUNG`). Bis Verifikation: Modul 5 schreibt KALKU-Werte NICHT, sondern legt sie nur als Excel-Comments / Notiz-Zellen ab. Modul-5-State enthält die Werte (`modul_1.brw_eur_pro_qm` etc.) ohnehin im JSON.

| Sheet!Zelle | Inhalt | Quelle (Schema-Pfad) | Liefer-Modul | Status |
|-------------|--------|----------------------|--------------|--------|
| `KALKU!?` | Bodenrichtwert €/m² | `modul_1.brw_eur_pro_qm` | Modul 5 (in Modul-1-State persistiert) | TODO Zell-Adresse |
| `KALKU!?` | Gebäudeanteil % | `modul_1.gebaeude_anteil_prozent` | Modul 5 | TODO Zell-Adresse |
| `KALKU!?` | AfA-Empfehlung % | `modul_2.afa_empfehlung_prozent` | Modul 5 | TODO Zell-Adresse |
| `KALKU!?` | Modernisierungs-Score | `modul_2.mod_score` | Modul 5 | TODO Zell-Adresse |
| `KALKU!?` | RND Jahre | `modul_2.rnd_jahre` | Modul 5 | TODO Zell-Adresse |

## Sheet `RENO`

| Sheet!Zelle | Inhalt | Quelle (Schema-Pfad) | Liefer-Modul |
|-------------|--------|----------------------|--------------|
| `RENO!<Block ENERGETISCH>` | Massnahmen + Kosten | `modul_3.massnahmen_liste[]` (filter `kategorie` ∈ {Dach,Fassade,Fenster,Heizung}) | Modul 3 |
| `RENO!<Block GEMEINSCHAFT>` | Massnahmen + Kosten | `modul_3.massnahmen_liste[]` (filter `kategorie` ∈ {Elektrik,Sanitaer}) | Modul 3 |
| `RENO!<Block JE_WE>` | WE-Renovierung + Kosten | `modul_3.massnahmen_liste[]` (filter `kategorie` ∈ {Boeden,Grundriss}) | Modul 3 |
| `RENO!Sonstiges_WEG` | WEG-Teilung Einmalkosten | `modul_3.weg_teilung_netto_eur` | Modul 3 |
| `RENO!Sonstiges_RND_Gutachten` | RND-Gutachten 1.000 €/WE | `modul_3.rnd_gutachten_netto_eur` | Modul 3 |
| `RENO!K105` | Mietsubvention pauschal (Summe €/Jahr ≈ 12 × €/Monat × Reach-Time) | `modul_4.mietsubventionen_summe_eur_pro_monat` | Modul 4 |

## Sheet `BESICHTIGUNG`

| Sheet!Zelle | Inhalt | Quelle (Schema-Pfad) | Liefer-Modul |
|-------------|--------|----------------------|--------------|
| `BESICHTIGUNG!A41` | Modernisierungsstand-Zusammenfassung (Fließtext) | abgeleitet aus `modul_2.begruendung` + `modul_3.massnahmen_liste` | Modul 3 |
| `BESICHTIGUNG!B33` | IST-Jahresnettokaltmiete | abgeleitet aus `modul_4.we_mieten[].ist_miete_eur_pro_qm × wohnflaeche × 12` | Modul 4 |
| `BESICHTIGUNG!B34` | Kappungsgrenze % (Anzeige) | wie `MIETER!P6` × 100 | Modul 4 |

## Sheet `VK_CF`

| Sheet!Zelle | Inhalt | Quelle (Schema-Pfad) | Liefer-Modul |
|-------------|--------|----------------------|--------------|
| _(wird in Modul 5 befüllt)_ | | | |

## Sheet `VERKAUFSMATRIX`

| Sheet!Zelle | Inhalt | Quelle (Schema-Pfad) | Liefer-Modul |
|-------------|--------|----------------------|--------------|
| `VERKAUFSMATRIX!<Extra-Spalte Subvention>` | Mietsubvention €/Monat (Audit, NICHT im Reno-Block) | `modul_4.mietsubventionen_summe_eur_pro_monat` | Modul 4 |
| _(weitere Zellen werden in Modul 5 befüllt)_ | | | |

---

## Brutto/Netto-Konvention

**Status: TODO — vor Modul-3-Live-Lauf einmalig verifizieren.**

Annahme bis Verifikation: Reno-Kosten werden **netto** in `modul_3.massnahmen_liste[].kosten_netto_eur` und `modul_3.rnd_gutachten_netto_eur`, `modul_3.weg_teilung_netto_eur` geliefert. `modul_3.summen.modernisierung_netto_eur` und `modul_3.summen.modernisierung_brutto_eur` werden beide vom Modul bereitgestellt (Brutto = Netto × 1,19, USt 19 %).

Excel-Template `RENO`-Sheet erwartet derzeit unbestimmt. Vor Live-Lauf prüfen:
- Rechnet Excel selbst Netto → Brutto auf den Reno-Block? Oder erwartet es bereits Brutto-Werte?
- Wenn Excel rechnet: Modul liefert Netto.
- Wenn Excel nicht rechnet: Modul liefert Brutto direkt in die Zellen.

Bis dahin schreibt Modul 3 **beide Summen** (`modernisierung_netto_eur` und `modernisierung_brutto_eur`) in den State; das passende Feld wird beim Excel-Schreiben durch Modul 5 ausgewählt.

---

## Asset-Trennung (verbindlich)

- **Rücklage** und **Mietsubvention** gehören in zwei **Extra-Spalten unter der Verkaufsmatrix** (siehe `VERKAUFSMATRIX`), NICHT in den Modernisierungskosten-Block (`VK_CF`-Reno-Bereich). Grund: Steuerbasis darf nicht verfälscht werden.
- **Wohnungen / Garagen / Stellplätze** NIE im selben Cashflow-Block mischen — siehe `archive/orchestrator.xml` v2.2 Header.
- Validator `tools/validate_state.py` enforced: keine `subvention`/`rücklage`/`ruecklage` in `modul_3.massnahmen_liste[].{kategorie,ist_zustand,geplant}`.
