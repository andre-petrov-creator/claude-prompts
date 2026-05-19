# ImmoCRM — Projekt-Memory für Claude Code

**Owner:** André Petrov / Petrov Wohnen
**Repo-Pfad:** `C:\meine-projekte\Immobilien\ImmoCRM\`
**Status:** Phase 2 (Setup), MVP-Bau steht bevor

---

## Was ist das Projekt?

ImmoCRM ersetzt die Excel-basierte Lead-/Kontaktliste (`Google Sheets IMMO-CRM`) durch ein Single-User-Web-Tool für die MFH-/Wohnungs-Akquise im Ruhrgebiet/NRW. Zentrale Datenbasis für Makler-Kontakte und Deals, befüllt sowohl manuell als auch automatisch über den bestehenden **Aufteiler-Workflow** (Cloud Code).

**Kern-Pflicht-Reads vor jedem Coding-Schritt:**

- [docs/01_projektbeschreibung.md](docs/01_projektbeschreibung.md) — Funktions-Spec, Datenmodell, UI
- [docs/02_implementierungsplan.md](docs/02_implementierungsplan.md) — Schritt-für-Schritt-Bauplan
- [DEVELOPMENT_GUIDELINES.md](DEVELOPMENT_GUIDELINES.md) — Coding-Standards
- [docs/03_decisions.md](docs/03_decisions.md) — laufende Architektur-Entscheidungen
- [docs/04_progress.md](docs/04_progress.md) — was ist gebaut, was nicht
- [docs/05_tools.md](docs/05_tools.md) — Skill/Modell/Effort/Mode pro Bau-Schritt

---

## Tech-Stack (verbindlich)

| Layer | Tech |
|-------|------|
| Frontend | Vite + React + TypeScript |
| UI | Tailwind + shadcn/ui |
| Tabelle | TanStack Table |
| Forms | react-hook-form + zod |
| Editor | Tiptap (Rich-Text für Notizen) |
| DB / Backend | Supabase (Postgres, Free Tier) |
| Hosting | Vercel (inkl. Cron für Tages-Mail) |
| Mail | Gmail SMTP (`gymmotivationtv@gmail.com` → `andre-petrov@web.de`) |

**Nicht abweichen ohne ADR in `docs/03_decisions.md`.**

---

## Bauphilosophie

- Ein Schritt aus `02_implementierungsplan.md` pro Coding-Session (atomar, max. 2-4 h)
- Nach jedem Schritt: `04_progress.md` updaten + Commit
- Keine Schein-Robustheit (keine Fallbacks für unmögliche Fälle, keine Feature Flags ohne Grund)
- Keine Kommentare im Code außer bei nicht-offensichtlichem WHY
- Bestehende Files editieren statt neue anlegen
- Keine Dummy-Doku/READMEs ohne Auftrag

---

## Datenmodell-Kernpunkte (Spec siehe `01_*.md` Abschnitt 3)

- `contacts` (Makler) — `status: kalt|warm|heiß|nr1`
- `deals` (Objekte) — `status: offen|berechnet|absage`
- `contact_comments` (Chat-Stream pro Kontakt)
- `deal_notes` (Rich-Text-Notizen pro Deal)
- `activity_log` (Performance-Tracking für Tages-Mail)

PDFs werden **nicht** gespeichert — nur Verweise (`expose_url`, `expose_local_path`).

---

## Workflow-Integration

**Akquise-Pipeline (Schritt 7, lokaler Watcher mit Cloud-Briefträger):** Mails landen via Outlook-QuickStep-Forward im M365-Postfach `appv@appv7878.onmicrosoft.com` Ordner `CRM-Eingang`. Microsoft Graph Webhook → Vercel-Function `/api/akquise/process` (Mail-Ingest, PDFs + body.txt + _meta.json + .trigger → OneDrive `_inbox/<msg-id>/`, `mail_queue.status='ready_for_quickcheck'`). OneDrive synct auf PC, lokaler Task-Scheduler-Job `Akquise-Watcher` (`At log on` + `Every 1 minute`) ruft `watch-inbox.ps1` auf, das `.trigger`-Files findet und headless Claude Code (`claude --print --permission-mode acceptEdits --add-dir Aufteiler`) startet. Skill `aufteiler-modul-0-quickcheck` läuft im Akquise-Modus (siehe SKILL.md Abschnitt 0): liest PDFs + body.txt, ruft CHECK24-Python-Tool für Marktwert (Stub), berechnet Gap, schreibt Lead in Supabase + `quickcheck.md` in OneDrive + benennt Ordner um. Wiedereinstieg via Doppelklick auf `<slug>.code-workspace`. Spec: [`docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md`](docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md) (mit Revision-Block 2026-05-15). Plan: [`docs/superpowers/plans/2026-05-15-akquise-pipeline-local-watcher-final.md`](docs/superpowers/plans/2026-05-15-akquise-pipeline-local-watcher-final.md). ADR: [ADR-017](docs/03_decisions.md#adr-017--akquise-pipeline-mit-lokalem-watcher-final).

---

## Was nicht im MVP

Käufer-Suchprofile · Investments-Tracking · Multi-User/Auth · Mobile App (PWA reicht) · Excel-Export · Off-Market-Outreach-Modul (separater Bau).

---

## Kommunikation mit dem Owner (Pflicht — bei jedem Dialog)

Owner ist kein Programmierer. Bei jedem Satz, den der Owner liest, gilt:

**Verbotene Wörter ohne sofortige Erklärung in derselben Zeile:**

- "Ordner-Hygiene", "Hygiene" → richtig: "die Dateien in passende Unterordner einsortieren"
- "Downstream-Mehrwert", "downstream" → richtig: "wir nutzen das später für X" (mit konkretem X)
- "State-Eintrag", "in den State schreiben" → richtig: "in die Datei `state.json` reinschreiben"
- "Score-Anreicherung" → richtig: "der Lead bekommt mehr Punkte wenn X"
- "Idempotenz" → richtig: "wenn der Skill 2x läuft, passiert nichts doppelt"
- "Pipeline-Step" → richtig: "Schritt im Ablauf"
- "Edge-Case" → richtig: "Sonderfall, der seltener vorkommt (z.B. ...)"
- "Persistierung" → richtig: "abspeichern, damit es nach dem Skill-Ende noch da ist"
- "Granular" → richtig: "fein aufgeteilt" / "grob aufgeteilt"
- "Trade-off" allein → richtig: "Vorteil X, dafür Nachteil Y"

**Pflicht-Check vor jeder AskUserQuestion:**

1. Frage Wort für Wort durchgehen, jedes Tech-Wort markieren
2. Tech-Wort ersetzen oder in derselben Zeile in einfachen Worten erklären
3. Option-Labels: **maximal 5 Wörter Alltagssprache**, kein Englisch, keine Tech-Wörter
4. Option-Beschreibung erklärt: was passiert + warum + konkrete Folgen (Sekunden, Euro, Aufwand)
5. Eine Option pro Frage trägt **(Empfohlen)** am Ende des Labels — mit klarer 1-Satz-Begründung

**Wenn Owner sagt "ich verstehe nicht" oder "erklär das anders":**
- **Neu** erklären mit anderen Worten, nicht dieselben Begriffe noch mal
- Vergleich mit Alltags-Beispiel hilft (Aktenordner statt Datenbank, Bilderrahmen statt UI-Komponente)

**Verstärkung:**
- Diese Regel wiederholt sich in jeder Spec-/Plan-Datei als erster Block ("User-Kommunikation")
- Bei Subagent-Aufrufen: Subagent-Prompt enthält diese Regel

---

## Git-Konventionen (siehe globale `~/.claude/CLAUDE.md`)

- Commits nur auf User-Auftrag
- Push direkt auf `main` (Default für eigene Repos im Mono-Repo `meine-projekte`)
- Bei Struktur-/Inhalts-Änderung: Eintrag in `C:\meine-projekte\README.md` ergänzen/aktualisieren
- Keine destruktiven Operationen ohne Bestätigung
