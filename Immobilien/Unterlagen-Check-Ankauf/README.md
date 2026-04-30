# Unterlagen-Check Ankauf (MFH Due Diligence)

Skill für die systematische Prüfung kompletter Unterlagenpakete bei MFH-Ankäufen (Bankenpaket, Datenraum, Exposé). Einzelprüfung läuft parallel über Subagents (Task-Tool), danach Cross-Checks und Red-Flag-Report mit Risk-Score, Export als PDF.

## Master-Pfad

Diese Quelle ist **die einzige Master-Version**:

- **Lokal:** `C:\meine-projekte\Immobilien\Unterlagen-Check-Ankauf\`
- **GitHub:** `github.com/andre-petrov-creator/meine-projekte` → `Immobilien/Unterlagen-Check-Ankauf/`

Der Skill wird zur Laufzeit über eine Junction unter `~/.claude/skills/unterlagen-check-ankauf` eingebunden — **dort niemals direkt editieren**, alle Änderungen passieren hier im Mono-Repo und werden auf GitHub gespiegelt.

## Inhalt

| Datei | Zweck |
|---|---|
| [`SKILL.md`](SKILL.md) | Skill-Definition (Frontmatter + 6-Schritte-Workflow inkl. Parallel-Subagents) |
| [`tools/pdf_split.py`](tools/pdf_split.py) | Splittet PDFs > 25 MB in Subagent-Häppchen |
| [`tools/report_to_pdf.py`](tools/report_to_pdf.py) | Konvertiert Markdown-Report nach PDF (Layout-Regeln R1–R13) |

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
