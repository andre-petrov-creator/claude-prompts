# Excel-Handoff-Vertrag

Pro Excel-Sheet eine Tabelle. Jede Zeile beschreibt **eine Zelle**, die von einem Modul-Skill geschrieben wird, mit:
- `Sheet!Zelle`: exakte Adresse im Template `Kalkulation_Aufteiler_mit_VK_CF.xlsx`
- `Inhalt`: was steht drin
- `Quelle (Schema-Pfad)`: woher kommt der Wert in `state.json`
- `Liefer-Modul`: welcher Modul-Skill schreibt diese Zelle

Wird pro Modul beim Bau befüllt. **Vertrag** — wenn eine Zelle hier steht, darf kein anderes Modul sie überschreiben.

---

## Sheet `MIETER`

| Sheet!Zelle | Inhalt | Quelle (Schema-Pfad) | Liefer-Modul |
|-------------|--------|----------------------|--------------|
| _(wird in Modul 1 + Modul 4 befüllt)_ | | | |

## Sheet `VK_CF`

| Sheet!Zelle | Inhalt | Quelle (Schema-Pfad) | Liefer-Modul |
|-------------|--------|----------------------|--------------|
| _(wird in Modul 5 befüllt)_ | | | |

## Sheet `VERKAUFSMATRIX`

| Sheet!Zelle | Inhalt | Quelle (Schema-Pfad) | Liefer-Modul |
|-------------|--------|----------------------|--------------|
| _(wird in Modul 4 + Modul 5 befüllt)_ | | | |

## Sonstige Sheets

_Werden ergänzt, sobald Modul-Skills sie ansprechen._

---

## Asset-Trennung (verbindlich)

- **Rücklage** und **Mietsubvention** gehören in zwei **Extra-Spalten unter der Verkaufsmatrix** (siehe `VERKAUFSMATRIX`), NICHT in den Modernisierungskosten-Block (`VK_CF`-Reno-Bereich). Grund: Steuerbasis darf nicht verfälscht werden.
- **Wohnungen / Garagen / Stellplätze** NIE im selben Cashflow-Block mischen — siehe `archive/orchestrator.xml` v2.2 Header.
