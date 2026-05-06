# Schritt 4.5: Wirtschaftliche Validierung (Wirtschafts-Subagent)

> Master: [`../SKILL.md`](../SKILL.md), Sektion `### Schritt 4.5: Wirtschaftliche Validierung (eigener Profi-Subagent)`

## Zweck

Die geprüften Dokumente in Zahlen übersetzen: Gebäudeanteil (Restwertmethode), Vermieter-Nebenkosten effektiv, Aufteiler-Kosten (WEG-Verwaltung), Rücklagen-Empfehlung, Mieter-Nebenkosten + Marktbenchmark, BK-Lücken-Hebel, Mietsteigerungs-Hebepotenzial, CapEx Best/Real/Worst, Cashflow-Kurve. Liefert Kalkulations-Grundlage für Investorensicht und Bankensicht.

**Wichtig**: Schritt 4.5 ist ein **eigener Profi-Subagent** (Investmentprüfer + Banken-Risikoanalyst), nicht Hauptagent-Logik. Definition in `references/wirtschaftliche-validierung.md`.

## Files

- `SKILL.md` Schritt 4.5 — orchestriert + Subagent-Aufruf
- [`../references/wirtschaftliche-validierung.md`](../references/wirtschaftliche-validierung.md) — Profi-Subagent-Protokoll + Berechnungs-Pflichtblöcke B1–B9

## Datenfluss

```
Standort-Block (Schritt 1) + Subagent-Outputs (Schritt 2) + Quercheck-Tabelle (Schritt 3)
  + User-Inputs: KAUFPREIS, GRUNDSTUECKSFLAECHE, EXPOSE_RENDITE_ANNAHME, BESTAND_RUECKLAGE
  → Wirtschafts-Subagent (Task-Tool, eigener Aufruf):
    - B1 Gebäudeanteil (Bodenwert-Restwertmethode + Sensitivität BRW±20%)
    - B2 Vermieter-NK effektiv (BK-Position-Tabelle + Eigenanteil)
    - B3 Aufteiler-Kosten (WEG-Verwaltung, falls Aufteiler)
    - B4 Rücklagen-Empfehlung 1,5–2,5 % vom KP + Entwicklung 5–10 J. + Cashflow-Impact + Realitätscheck
    - B5 Mieter-NK warm + BetrKV-Spiegel-Benchmark + § 560-Anpassungspotenzial
    - B6 BK-Lücken-Hebel (Quercheck W10)
    - B7 Mietsteigerungs-Hebepotenzial pro WE (Mietspiegel + Kappung)
    - B8 CapEx Best/Real/Worst (aus Subagent-Befunden)
    - B9 Cashflow-Kurve pro Strategie-Szenario
  → Output: strukturierter Wirtschafts-Bericht → Input für Schritt 5
```

## Schnittstellen

- **Input**: Standort-Block + alle Subagent-Outputs + Quercheck-Tabelle + User-Inputs
- **Output**: Wirtschafts-Block (B1–B9) → Schritt 5 (Gesamtreport)

## Bekannte Limitierungen

- Marktbenchmarks (BetrKV-Spiegel, Versicherungs-€/m², Mietspiegel) per Live-Recherche; bei Nichtverfügbarkeit Annahmen mit Markierung
- BORIS-Bodenrichtwert ist je Bundesland anders strukturiert — Live-URL-Pattern muss vom Hauptagent ermittelt werden, sonst BRW als Annahme
- Cashflow-Kurve B9 schließt Finanzierungsanteil aus (Käufer-Konditionen unbekannt). Wenn User Konditionen mitliefert: separate Annuitätstabelle möglich
- Best-/Real-/Worst-Spannen bei CapEx (B8) sind Schätzungen — keine Sicherheits-Aufschläge automatisch dazurechnen
