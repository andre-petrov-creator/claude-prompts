# Schritt 4.5: Wirtschaftliche Validierung

> Master: [`../SKILL.md`](../SKILL.md), Sektion `### Schritt 4.5: Wirtschaftliche Validierung`

## Zweck

Die geprüften Dokumente in Zahlen übersetzen: Gebäudeanteil, Vermieter-Nebenkosten effektiv, Aufteiler-Kosten (WEG-Verwaltung), Rücklagen-Empfehlung, Mieter-Nebenkosten. Liefert Kalkulations-Grundlage für Investorensicht und Bankensicht.

## Files

- `SKILL.md` — Berechnungs-Templates (Gebäudeanteil, Rücklagen-Empfehlung, NK-Aufschlüsselung)

## Datenfluss

```
Konsens-Werte aus Schritt 3
  + Aufteiler-Risiko (falls Schritt 4 aktiv)
  → Berechnung:
    - Gebäudeanteil (BRW × Grundstücksfläche → Bodenwert → Restwert = Gebäude)
    - Vermieter-NK effektiv (Betriebskostenabrechnung minus umlagefähige Posten)
    - Aufteiler-Kosten WEG-Verwaltung (€/WE/Jahr)
    - Rücklagen-Empfehlung (€/m²/Jahr je nach Baujahr / Zustand)
    - Mieter-NK (umlagefähig vs. nicht-umlagefähig)
  → Output: Kalkulations-Tabellen → Input für Gesamtreport
```

## Schnittstellen

- **Input:** Konsens-Werte (Schritt 3), Aufteiler-Risiko-Score (Schritt 4 falls aktiv)
- **Output:** strukturierte Wirtschafts-Kennzahlen → konsumiert von Schritt 5 (Gesamtreport)

## Bekannte Limitierungen

- TODO
