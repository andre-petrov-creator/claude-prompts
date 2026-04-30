# Unterlagen-Check Ankauf — Maintenance-Steuerung

Diese Datei steuert die **Pflege und Weiterentwicklung des Skills**, nicht seine Ausführung. Der Skill wird über `SKILL.md` aktiviert; was hier steht, gilt nur wenn an SKILL.md, tools/ oder docs/ gearbeitet wird.

## Vor jeder Änderung am Skill

1. Lies [`DEVELOPMENT_GUIDELINES.md`](DEVELOPMENT_GUIDELINES.md) — Konventionen für Workflow-Aufbau, Output-Format, Subagent-Pattern
2. Lies die betroffene Datei in [`docs/`](docs/) — was macht der Schritt, welche Schnittstellen, welche bekannten Limitierungen
3. Prüfe Querverweise: ein Schritt ändert oft Inputs/Outputs eines anderen

## Nach jeder Änderung

1. Aktualisiere die betroffene Datei in `docs/` (Datenfluss, Schnittstellen, Limitierungen)
2. Wenn ein neuer Workflow-Schritt: neue `docs/NN_<name>.md` anlegen + `docs/README.md` (Index) ergänzen
3. Konventionen aus `DEVELOPMENT_GUIDELINES.md` einhalten (Output-Format, Tabellen-Style, Risk-Score-Skala)
4. Bei Tool-Änderung (`tools/*.py`): Header-Doku im Script aktualisieren
5. Commit + Push (Master liegt im Mono-Repo, GitHub ist Backup)

## Stack

- **Skill-Format:** Markdown mit YAML-Frontmatter (`name`, `description`)
- **Subagents:** Task-Tool mit `subagent_type: general-purpose` für parallele Einzelprüfung
- **Tools:** Python 3 (`tools/pdf_split.py`, `tools/report_to_pdf.py`)
- **Output:** Markdown-Report → PDF via `report_to_pdf.py`

## Architektur-Prinzipien

- **Sequenziell + Parallel gemischt:** Schritt 1, 1.5, 3, 4, 4.5, 5, 6 sequenziell — Schritt 2 parallel via Subagents
- **Inventur first:** Nichts inhaltlich prüfen ohne Soll-Ist-Abgleich
- **Cross-Checks zwingend:** Jeder Einzelreport ist nur wert was die Quercheck bestätigt
- **Investoren- + Bankensicht parallel:** beide Perspektiven in jedem Report
- **Risk-Score am Ende:** ohne Score keine Deal-Empfehlung

## Skill-Referenzen

Wenn am Skill gearbeitet wird, sind ggf. relevant:
- `superpowers:writing-skills` — Skill-Format-Validierung
- `superpowers:test-driven-development` — bei tools/-Änderungen
- `claude-code-blueprint` — wenn neue Module nach gleichem Pattern aufgebaut werden
