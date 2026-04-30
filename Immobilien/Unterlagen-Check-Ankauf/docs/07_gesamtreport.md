# Schritt 5: Gesamtreport

> Master: [`../SKILL.md`](../SKILL.md), Sektion `### Schritt 5: Gesamtreport`

## Zweck

Alle Erkenntnisse zu einem strukturierten Markdown-Report zusammenführen: Empfehlung, Inventur, Red Flags, Quercheck, fehlende Unterlagen, Aufteiler-Risiken, Wirtschaftliche Validierung, Investoren- und Bankensicht, Anhang Einzelreports. Output ist der eigentliche Deal-Verdict.

## Files

- `SKILL.md` — Report-Template mit allen Sektionen + Risk-Score-Skala

## Datenfluss

```
Output aus Schritt 1 (Inventur)
  + Outputs aus Schritt 2 (Einzelreports)
  + Output aus Schritt 3 (Quercheck-Inkonsistenzen, Konsens)
  + Output aus Schritt 4 (Aufteiler-Risiken, falls aktiv)
  + Output aus Schritt 4.5 (Wirtschafts-Kennzahlen)
  → Gesamtreport-Markdown:
    - To-Do (🔴 sofort / 🟡 vor Notar / 🟢 unkritisch)
    - Empfehlung (Deal: ja/nachverhandeln/nein)
    - Inventur
    - Red Flags
    - Quercheck-Inkonsistenzen
    - Fehlende Unterlagen
    - Aufteiler-Risiken (falls relevant)
    - Wirtschaftliche Validierung
    - Investoren-Perspektive
    - Banken-Perspektive
    - Anhang: Einzelreports
```

## Schnittstellen

- **Input:** Outputs aller vorherigen Schritte
- **Output:** vollständiger Gesamtreport-Markdown → wird User direkt präsentiert UND als Input für Schritt 6 (PDF-Export, optional) gespeichert

## Bekannte Limitierungen

- TODO
