# Akquise-Watcher

Lokaler Watcher (PowerShell + Windows Task Scheduler), der den OneDrive-`_inbox`-Ordner auf `.trigger`-Dateien scannt und für jeden Treffer den `aufteiler-modul-0-quickcheck`-Skill im Akquise-Modus startet (headless Claude Code).

## Einmaliges Setup

1. `.env.example` nach `.env` kopieren und Werte setzen:
   - `AKQUISE_INBOX_PATH` — OneDrive-Pfad zum `_inbox`-Ordner (PC-lokal)
   - `AKQUISE_OBJEKTE_PATH` — OneDrive-Pfad zum `Objekte`-Ordner
   - `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` — aus Supabase-Dashboard

2. Task Scheduler einrichten:
   - Run: `schtasks /Create /XML task-scheduler.xml /TN "Akquise-Watcher"` (Admin-PowerShell)
   - Alternativ: Task Scheduler GUI → Importieren → `task-scheduler.xml`.

3. Manueller Probelauf:
   - Run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<pfad>\watch-inbox.ps1"`
   - Erwartet: kein Output (keine Trigger da), `watcher.log` wird angelegt sobald erste Trigger kommt.

## Trigger

Der Task Scheduler ruft `watch-inbox.vbs` (VBScript-Wrapper) mit zwei Triggern:

1. **At log on** (30 Sek nach User-Login) — fängt Backlog ab, der während PC-aus angesammelt wurde.
2. **Every 1 minute** — laufender Betrieb für Mails, die während PC-an reinkommen.

Beide Trigger sind aktiv. `MultipleInstancesPolicy=IgnoreNew` stellt sicher, dass nicht zwei Instanzen parallel laufen.

## Warum VBScript-Wrapper

Direkter Aufruf von `powershell.exe` aus dem Task Scheduler erzeugt jede Minute ein **kurz sichtbares Konsolen-Fenster** (Fenster wird gestartet, dann ggf. versteckt — sichtbares Flash). `watch-inbox.vbs` umgeht das: das VBScript startet PowerShell mit `WindowStyle=0 (Hidden)`, sodass nichts blinkt. Microsoft-empfohlener Standard-Weg für unsichtbare PowerShell-Tasks.

## Verhalten pro Trigger

1. `.trigger` gefunden → globalen `.lock` im `_inbox` setzen (Doppellauf-Schutz)
2. Pro Ordner: `.trigger` → `.processing` umbenennen (Lock pro Ordner)
3. `claude --print --permission-mode acceptEdits "Verwende den Skill aufteiler-modul-0-quickcheck im Akquise-Modus mit dem Ordnerpfad: <folder>"` aufrufen
4. Bei Erfolg: `.processing` löschen
5. Bei Fehler: `.processing` → `.error` mit Stacktrace umbenennen
6. Am Ende des Laufs: globalen `.lock` entfernen

## Logs

`watcher.log` im Watcher-Ordner. Wird bei jedem Lauf angehängt. Gitignored.

## Stale-Lock

`.lock` im `_inbox/`-Ordner. Wird bei Lauf-Start gesetzt, bei Ende entfernt. Falls Lock älter 15 Min → automatisch ignoriert und neu gesetzt.

## Aktive Spec

Siehe [`ImmoCRM/docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md`](../ImmoCRM/docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md) (mit Revision-Block 2026-05-15) und Plan [`ImmoCRM/docs/superpowers/plans/2026-05-15-akquise-pipeline-local-watcher-final.md`](../ImmoCRM/docs/superpowers/plans/2026-05-15-akquise-pipeline-local-watcher-final.md).
