# Schritt 5: Gesamtreport

> Master: [`../SKILL.md`](../SKILL.md), Sektion `### Schritt 5: Gesamtreport`

## Zweck

Alle Erkenntnisse zu einem strukturierten Markdown-Report zusammenführen mit klarer Empfehlung (genau eines von 🟢 GO / 🟡 NACHVERHANDELN / 🔴 NO-GO), Risk-Score (0–100), To-Do-Liste auf Seite 1, Detail-Sektionen ab Seite 2. Output ist der eigentliche Deal-Verdict.

## Files

- `SKILL.md` Schritt 5 — Report-Skelett mit allen Sektionen + Risk-Score-Berechnung + Layout-Pflichten
- [`../references/begehung-checkliste.md`](../references/begehung-checkliste.md) — wird im Anhang gerendert mit risiko-spezifischen Markern

## Datenfluss

```
Output Schritt 1 (Inventur + Standort-Block)
  + Outputs Schritt 2 (Profi-Subagent-Einzelreports)
  + Output Schritt 3 (Quercheck-Tabelle)
  + Output Schritt 4 (Aufteiler-Risiken, falls aktiv)
  + Output Schritt 4.5 (Wirtschafts-Subagent B1–B9)
  → Risk-Score berechnen:
    Score = min(100, 15 × Anzahl 🔴 + 5 × Anzahl 🟡 + 3 × Anzahl Pflicht-Lücken)
  → Verdict ableiten: 0–30 GO / 31–65 NACHVERHANDELN / 66–100 NO-GO
  → Override bei eindeutigen Deal-Killern
  → Gesamtreport-Markdown mit:
    - Header (schlank, Adresse + Kerndaten, Verkäufer NUR bei Risiko)
    - Empfehlung + Risk-Score
    - To-Do (🔴/🟡/🟢, jeweils mit Anker auf Detail + file://-Link)
    - Inventur (alle 20 Soll-Positionen)
    - Standort-Live-Recherche
    - 🔴 Kritische Red Flags (Detail)
    - 🟡 Wichtige Red Flags (Detail)
    - Quercheck-Inkonsistenzen
    - Fehlende Unterlagen
    - Aufteiler-Risiken (falls relevant)
    - Wirtschaftliche Validierung (B1–B9)
    - Investoren-Perspektive
    - Banken-Perspektive
    - 🟢 Unkritische Befunde (Anhang)
    - Vor-Ort-Begehung (mit risiko-spezifischen Markern)
    - Anhang Einzelreports
    - Drei nächste Schritte
```

## Layout-Pflichten

- **Datum dynamisch** aus System
- **Verkäufer NICHT im Header** — nur als Red Flag, wenn risikobehaftet (Bankverwertung, Erbenverkauf, Insolvenz, Treuhand)
- **Wiederholungs-Verbot** zwischen To-Do und Detail: To-Do = nur Action-Satz mit Anker. Volle Begründung steht ausschließlich in Detail.
- **Vergleichsdaten ≥3 Zeilen** IMMER als Tabelle, nicht als Bullet-Liste
- **Genau eines** von 🟢/🟡/🔴 — keine Doppel-Verdicts wie "NACHVERHANDELN ODER NO-GO"
- **Risk-Score** prominent unter der Empfehlung

## Schnittstellen

- **Input**: Outputs aller vorherigen Schritte
- **Output**: vollständiger Gesamtreport-Markdown → wird User direkt präsentiert UND als Input für Schritt 6 (PDF-Export, optional) und Schritt 7 (Verkäufer-Anschreiben, optional) gespeichert

## Bekannte Limitierungen

- Anker-Links zwischen To-Do und Detail benötigen `id="..."` in den Detail-Headern, was Markdown nicht standardmäßig unterstützt (`{: #anker}` mit `attr_list`-Extension nötig — bereits konfiguriert in `tools/report_to_pdf.py`)
- Risk-Score-Berechnung ist Heuristik. Override-Logik bei eindeutigen Deal-Killern fängt Sonderfälle ab, kann aber subjektive Kalibrierung erfordern
