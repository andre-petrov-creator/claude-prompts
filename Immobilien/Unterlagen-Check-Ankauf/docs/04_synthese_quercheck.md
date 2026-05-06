# Schritt 3: Synthese & Quercheck

> Master: [`../SKILL.md`](../SKILL.md), Sektion `### Schritt 3: Synthese & Quercheck (sequentiell)`

## Zweck

Cross-Document-Logik: Manche Risiken werden erst sichtbar, wenn man mehrere Unterlagen nebeneinander liest. Ein Mietvertrag wirkt sauber, ein Grundbuchauszug wirkt sauber — erst beim Abgleich fällt die Förderbindung auf, die in beiden ein Indiz hinterlassen hat.

Hauptagent wendet die Wechselwirkungs-Matrix (`references/quercheck-matrix.md`) Zeile für Zeile auf die parallel erzeugten Einzelreports an.

## Files

- `SKILL.md` Schritt 3 — orchestriert
- [`../references/quercheck-matrix.md`](../references/quercheck-matrix.md) — Matrix mit aktuell ~20 Wechselwirkungen (W1–W20)

## Datenfluss

```
Map aller Einzelreports (aus Schritt 2)
  → Datenpunkte sammeln (alle "→ W<Nr>"-Markierungen aus Kerndaten)
  → für jede Matrix-Zeile (W1, W2, ..., W20):
     - geforderte Quellen vorhanden?
     - Werte konsistent? (Toleranz aus Matrix)
     - Konflikt-Indikator triggert?
     - Fix-Empfehlung ableiten
  → Klassifikation: ✅ konsistent / ⚠️ klärungsbedürftig / 🔴 Konflikt
  → Output: Quercheck-Tabelle (Datenpunkt | Quellen | Konsistent? | Hinweis | Fix)
```

## Schnittstellen

- **Input**: alle Einzelreports aus Schritt 2 (mit Wechselwirkungs-Hooks)
- **Output**: Quercheck-Tabelle → Input für Schritt 4 (Aufteiler-Risiken), Schritt 4.5 (Wirtschafts-Subagent), Schritt 5 (Gesamtreport)

## Bekannte Limitierungen

- Matrix v0.1 ist aus Domain-Wissen + Befunden Iteration 01 gebaut. Iteration 02 sollte einen Web-Recherche-Sub-Agent starten, der die Matrix gegen aktuelle Rechtsprechung + Marktbenchmarks verifiziert
- Bei `nicht_pruefbar`-Status der Subagent-Outputs kann eine Matrix-Zeile nicht ausgewertet werden — wird als "Datenlücke" im Report markiert
