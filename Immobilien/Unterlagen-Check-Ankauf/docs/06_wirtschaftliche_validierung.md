# Schritt 4.5: Wirtschaftliche Validierung (Wirtschafts-Subagent)

> Master: [`../SKILL.md`](../SKILL.md), Sektion `### Schritt 4.5: Wirtschaftliche Validierung (eigener Profi-Subagent)`

## Zweck

Die geprüften Dokumente in Zahlen übersetzen: Gebäudeanteil (Restwertmethode), Vermieter-Nebenkosten effektiv, **Bewirtschaftungskosten Hausgesamt + pro WE (B2.5)**, Aufteiler-Kosten (WEG-Verwaltung), Rücklagen-Empfehlung, Mieter-Nebenkosten + Marktbenchmark, BK-Lücken-Hebel, Mietsteigerungs-Hebepotenzial, CapEx Best/Real/Worst, Cashflow-Kurve. Liefert Kalkulations-Grundlage für Investorensicht (Hausgesamt) und für Kapitalanleger im späteren Wiederverkaufs-Exposé (pro WE).

**Wichtig**: Schritt 4.5 ist ein **eigener Profi-Subagent** (Investmentprüfer + Banken-Risikoanalyst), nicht Hauptagent-Logik. Definition in `references/wirtschaftliche-validierung.md`.

## Files

- `SKILL.md` Schritt 4.5 — orchestriert + Subagent-Aufruf
- [`../references/wirtschaftliche-validierung.md`](../references/wirtschaftliche-validierung.md) — Profi-Subagent-Protokoll + Berechnungs-Pflichtblöcke B1, B2, B2.5, B3, B4, B5, B6, B7, B8, B9

## Datenfluss

```
Standort-Block (Schritt 1) + Subagent-Outputs (Schritt 2) + Quercheck-Tabelle (Schritt 3)
  + User-Inputs: KAUFPREIS, GRUNDSTUECKSFLAECHE, EXPOSE_RENDITE_ANNAHME, BESTAND_RUECKLAGE
  + Mieten-Soll-Basis (Schritt 1):
      MIETEN_SOLL_QUELLE  (Aufteiler-Output Kalkulation_*.xlsx / Aufteiler_*.pdf
                           oder uebergebene Mietaufstellung)
      MIETEN_SOLL_PRO_WE  (Tabelle: WE | Wohnflaeche | Soll-Kalt €/Mt | €/Jahr)
      MIETEN_IST_PRO_WE   (Tabelle aus Subagent 06-mietvertrag, nur Quercheck)
  → Wirtschafts-Subagent (Task-Tool, eigener Aufruf):
    - B1 Gebäudeanteil (Bodenwert-Restwertmethode + Sensitivität BRW±20%)
    - B2 Vermieter-NK effektiv (BK-Position-Tabelle + Eigenanteil)
    - B2.5 Bewirtschaftungskosten in zwei Sichten:
        Sicht A — Hausgesamt (Investor): drei Buckets (Rücklage, umlagefähige BK,
          nicht umlagefähig), drei Cases Best/Real/Worst, Σ + Quoten
          gegen Soll-Kalt p.a. (ohne Garagen)
        Sicht B — pro WE (Kapitalanleger): drei Block-Tabellen Best/Real/Worst,
          alle WE als Zeilen, Verteilerschlüssel zwingend aus BK-/Heizkosten-
          Abrechnung. Garagen separat.
        + Verbindung Mieter-Umlage ↔ Vermieter-Eigenanteil (Pflicht-Tabelle
          mit Σ-Zeile, verlinkt zu B6)
        + Headline-Kennzahlen: Bewirtschaftungs-Quote, Vermieter-Quote
          nicht umlagefähig (Hausgesamt + pro WE)
    - B3 Aufteiler-Kosten (WEG-Verwaltung, falls Aufteiler)
    - B4 Rücklagen-Empfehlung 1,5–2,5 % vom KP + Entwicklung 5–10 J. + Cashflow-Impact
        (Hinweis: ehemaliger Realitätscheck B4c ist in B2.5 absorbiert)
    - B5 Mieter-NK warm + BetrKV-Spiegel-Benchmark + § 560-Anpassungspotenzial
    - B6 BK-Lücken-Hebel (Quercheck W10) — Σ-Zeile aus B2.5-Pflicht-Tabelle
    - B7 Mietsteigerungs-Hebepotenzial pro WE (Mietspiegel + Kappung)
    - B8 CapEx Best/Real/Worst (aus Subagent-Befunden)
    - B9 Cashflow-Kurve pro Strategie-Szenario
  → Output: strukturierter Wirtschafts-Bericht → Input für Schritt 5
    (mit zwei Sub-Sektionen: Hausgesamt-Sicht + Pro WE-Sicht)
```

## Schnittstellen

- **Input**: Standort-Block + alle Subagent-Outputs + Quercheck-Tabelle + User-Inputs + Mieten-Soll-Basis
- **Output**: Wirtschafts-Block (B1, B2, B2.5, B3, B4, B5, B6, B7, B8, B9) → Schritt 5 (Gesamtreport mit Hausgesamt- + Pro-WE-Sub-Sektion)

## Bekannte Limitierungen

- Marktbenchmarks (BetrKV-Spiegel, Versicherungs-€/m², Mietspiegel) per Live-Recherche; bei Nichtverfügbarkeit Annahmen mit Markierung
- BORIS-Bodenrichtwert ist je Bundesland anders strukturiert — Live-URL-Pattern muss vom Hauptagent ermittelt werden, sonst BRW als Annahme
- Cashflow-Kurve B9 schließt Finanzierungsanteil aus (Käufer-Konditionen unbekannt). Wenn User Konditionen mitliefert: separate Annuitätstabelle möglich
- Best-/Real-/Worst-Spannen bei CapEx (B8) sind Schätzungen — keine Sicherheits-Aufschläge automatisch dazurechnen
- **B2.5 Verteilerschlüssel**: zwingend aus BK-Abrechnung und Heizkostenabrechnung. Wenn Schlüssel pro Position fehlt, Status `nicht_pruefbar` und Hinweis im Verdict — keine Eigenkonstruktion
- **B2.5 Soll-Mieten-Quelle**: Aufteiler-Output (`Kalkulation_*.xlsx`, `Aufteiler_*.pdf`) oder Mietaufstellung. Ist-Mieten nur als Quercheck-Spalte. Bei fehlender Quelle: User-Rückfrage in Schritt 1 vor Start des Subagents
- **B2.5 WEG/SEV-Defaults**: nicht hardcoden — Live-Recherche für `OBJEKT_GEMEINDE`, Fallback DDIV-Honorartabelle bundesweit mit Stand-Datum + URL
