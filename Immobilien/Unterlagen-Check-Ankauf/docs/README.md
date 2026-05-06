# docs/ — Workflow-Dokumentation

Pro Workflow-Schritt eine Datei. Jede Datei folgt dem gleichen Schema (Zweck, Files, Datenfluss, Schnittstellen, Bekannte Limitierungen).

**Master-Definition** der Schritte ist [`../SKILL.md`](../SKILL.md). Diese docs sind die **Pflege-Sicht**: was greift wo ein, wo sind Schwächen, wo sollte erweitert werden.

## Index

| Schritt | Datei | Modus | SKILL.md-Anker |
|---|---|---|---|
| 1 | [`01_inventur.md`](01_inventur.md) | sequenziell | Schritt 1: Inventur + Standort-Live-Recherche |
| 1.5 | [`02_pdf_split.md`](02_pdf_split.md) | sequenziell, bedingt | Schritt 1.5: Große PDFs splitten |
| 2 | [`03_einzelpruefung.md`](03_einzelpruefung.md) | **parallel** (Profi-Subagents) | Schritt 2: Parallele Profi-Subagent-Einzelprüfung |
| 3 | [`04_synthese_quercheck.md`](04_synthese_quercheck.md) | sequenziell | Schritt 3: Synthese & Quercheck (Wechselwirkungs-Matrix) |
| 4 | [`05_aufteiler_risiken.md`](05_aufteiler_risiken.md) | sequenziell, bedingt | Schritt 4: Aufteiler-Risiken |
| 4.5 | [`06_wirtschaftliche_validierung.md`](06_wirtschaftliche_validierung.md) | sequenziell (eigener Subagent) | Schritt 4.5: Wirtschafts-Subagent |
| 5 | [`07_gesamtreport.md`](07_gesamtreport.md) | sequenziell | Schritt 5: Gesamtreport (Risk-Score 0–100) |
| 6 | [`08_pdf_export.md`](08_pdf_export.md) | sequenziell, **nur auf Anfrage** | Schritt 6: PDF-Export (mit Umbruch-Regeln) |
| 7 | *(in SKILL.md, ohne eigene docs-Datei)* | sequenziell, **nur auf Anfrage** | Schritt 7: Verkäufer-Anschreiben (optional) |

## Pflege

Bei Änderung eines Schritts in SKILL.md:
1. Entsprechende `docs/NN_<name>.md` aktualisieren (Datenfluss, Schnittstellen, Limitierungen)
2. Falls Schritt-Schnittstelle ändert: nachgelagerte Schritte mitprüfen (Inputs könnten brechen)
3. Bei neuem Schritt: neue Datei anlegen, diesen Index ergänzen
