# claude-code-blueprint

Skill für das saubere Aufsetzen eines neuen Coding-Projekts mit Claude Code (Sparring → Implementierungsplan → Schritt-für-Schritt-Prompts → /docs-Pflege).

## Master-Pfad

- **Lokal:** `C:\meine-projekte\skills\claude-code-blueprint\`
- **GitHub:** `github.com/andre-petrov-creator/meine-projekte` → `skills/claude-code-blueprint/`

Eingebunden in Claude Code via Junction unter `~/.claude/skills/claude-code-blueprint`. Beide Pfade zeigen auf dieselben Files — Editieren passiert hier, GitHub bekommt es automatisch mit.

## Inhalt

| Datei | Zweck |
|---|---|
| [`SKILL.md`](SKILL.md) | Skill-Definition (Phasen 1–5, Templates für CLAUDE.md / DEVELOPMENT_GUIDELINES.md, Session-Handoff via handoff.md) |
| [`templates/handoff.md`](templates/handoff.md) | Skelett für das Session-Übergabe-Dokument (Phase 5). Wird ins Projekt-Root des jeweiligen Coding-Projekts kopiert und bei jedem Schrittwechsel überschrieben. |

## Junction neu anlegen (nach Recovery)

```cmd
cmd /c rmdir "%USERPROFILE%\.claude\skills\claude-code-blueprint"
cmd /c mklink /J "%USERPROFILE%\.claude\skills\claude-code-blueprint" "C:\meine-projekte\skills\claude-code-blueprint"
```
