# Unterlagen-Check Ankauf (MFH Due Diligence)

Skill für die systematische Prüfung kompletter Unterlagenpakete bei MFH-Ankäufen (Bankenpaket, Datenraum, Exposé). Einzelprüfung läuft parallel über Subagents (Task-Tool), danach Cross-Checks und Red-Flag-Report mit Risk-Score, Export als PDF.

## Master-Pfad

Diese Quelle ist **die einzige Master-Version**:

- **Lokal:** `C:\meine-projekte\Immobilien\Unterlagen-Check-Ankauf\`
- **GitHub:** `github.com/andre-petrov-creator/meine-projekte` → `Immobilien/Unterlagen-Check-Ankauf/`

Der Skill wird zur Laufzeit über eine Junction unter `~/.claude/skills/unterlagen-check-ankauf` eingebunden — **dort niemals direkt editieren**, alle Änderungen passieren hier im Mono-Repo und werden auf GitHub gespiegelt.

## Inhalt

| Datei / Ordner | Zweck |
|---|---|
| [`SKILL.md`](SKILL.md) | Skill-Definition (Frontmatter + 6-Schritte-Workflow inkl. Parallel-Subagents) — **Master, vor Änderung CLAUDE.md + docs/ lesen** |
| [`CLAUDE.md`](CLAUDE.md) | Maintenance-Steuerung: Vor-/Nach-Aufgabe-Regeln für Skill-Pflege |
| [`DEVELOPMENT_GUIDELINES.md`](DEVELOPMENT_GUIDELINES.md) | Konventionen: Workflow-Aufbau, Output-Format, Subagent-Pattern, Tool-Nutzung |
| [`docs/`](docs/) | Pro Workflow-Schritt eine Doku-Datei (Zweck, Datenfluss, Schnittstellen, Limitierungen) |
| [`references/`](references/) | **20 Prüfprotokolle**, eines pro Dokumenttyp — Subagent-Anleitung für Schritt 2 (aktuell Skeleton, Inhalt wird inkrementell gefüllt) |
| [`tools/pdf_split.py`](tools/pdf_split.py) | Splittet PDFs > 25 MB in Subagent-Häppchen |
| [`tools/report_to_pdf.py`](tools/report_to_pdf.py) | Konvertiert Markdown-Report nach PDF (Layout-Regeln R1–R13) |

## Pflege-Workflow

Wenn am Skill **gearbeitet** wird (nicht: wenn er ausgeführt wird):

1. [`CLAUDE.md`](CLAUDE.md) + relevante [`docs/`](docs/) lesen
2. Änderung in SKILL.md / tools/ machen
3. Betroffene `docs/<schritt>.md` aktualisieren
4. Commit + Push

## Junction neu anlegen (nach Recovery / Rechnerwechsel)

```cmd
cmd /c rmdir "%USERPROFILE%\.claude\skills\unterlagen-check-ankauf"
cmd /c mklink /J "%USERPROFILE%\.claude\skills\unterlagen-check-ankauf" "C:\meine-projekte\Immobilien\Unterlagen-Check-Ankauf"
```

## Update-Regel

Bei **jeder Änderung** an SKILL.md oder tools/:
1. Hier im Mono-Repo editieren
2. Commit + Push auf GitHub (`c:/meine-projekte` Root)
3. README aktualisieren falls Struktur betroffen
