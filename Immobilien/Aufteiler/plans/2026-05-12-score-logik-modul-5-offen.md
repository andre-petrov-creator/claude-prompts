# Score-Logik Modul 5 (Deal-Bewertung) — offen, wird separat gebaut

Status: offen, bewusst aus dem Skill-Umbau ausgegliedert (siehe `docs/superpowers/specs/2026-05-12-aufteiler-skill-umbau-design.md`).

============================================================

## Warum hier separat?

Die Score-Logik (wie aus den Outputs von Modul 0–4 eine Gesamt-Bewertung wird) gehört NICHT in den Skill-Umbau, weil:
- Parallel wird am gesamten Aufteiler-Optimierungs-Prozess gearbeitet (nicht nur am Skill).
- Score-Methodik kann sich noch ändern, bevor sie hartcodiert in einen Skill-Schritt wird.
- Skill-Umbau soll nicht warten, bis die Methodik final ist.

## Was im Skill-Umbau Phase 4 stattdessen passiert

Modul 5 (`aufteiler-modul-5-deal-bewertung`) bekommt eine **Platzhalter-Score-Logik**:
- Einfache Ampel-Aggregation aus den Tiefenstufen + Konfidenz-Werten der Module 0–4
- Reicht für PDF-Export + Excel-Notizen
- Wird später durch die echte Score-Logik ersetzt, ohne dass der Rest des Skills angefasst werden muss

`state.json` enthält schon das Feld `modul_5.bewertungs_score` — nur die Befüllungs-Logik wird später getauscht.

## Was geklärt werden muss (für die echte Score-Logik)

Sammlung offener Fragen — wird ergänzt, wenn aus dem parallelen Optimierungs-Prozess Input kommt:

- Welche Eingabe-Größen aus Modul 0–4 gehen in den Score?
- Gewichtung pro Größe?
- Score-Skala (0–100, A-F, Ampel?)
- Schwellen für Kauf-Empfehlung / Pass / Verhandeln?
- Sensitivität: wie reagiert der Score auf einzelne Modul-Werte?
- Soll der Score selbst Konfidenz tragen (Score 75 ± 5)?

## Wer macht was

- Andre: arbeitet im parallelen Prozess an Methodik
- Skill-Umbau: liefert Platzhalter + Daten-Anker (`state.json`-Feld)
- Wenn Methodik steht: separater Plan + Plan-Datei `plans/YYYY-MM-DD-modul-5-score-logik.md`, dann Modul-5-Skill angepasst

## Status

- [ ] Methodik wird parallel entwickelt
- [ ] Platzhalter im Skill-Umbau Phase 4 verbaut
- [ ] Echte Logik nach Methodik-Freigabe einbauen
