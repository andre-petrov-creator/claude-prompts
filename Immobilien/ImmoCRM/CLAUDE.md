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

Bestehender Cloud-Code-Workflow `Automation Akquise` wird um Subagent **"CRM Befüllen"** ergänzt (Schritt 7). Der Subagent schreibt nach erfolgreicher Kalkulation direkt via Supabase REST API ins CRM (Duplikat-Check Email + Name).

---

## Was nicht im MVP

Käufer-Suchprofile · Investments-Tracking · Multi-User/Auth · Mobile App (PWA reicht) · Excel-Export · Off-Market-Outreach-Modul (separater Bau).

---

## Git-Konventionen (siehe globale `~/.claude/CLAUDE.md`)

- Commits nur auf User-Auftrag
- Push direkt auf `main` (Default für eigene Repos im Mono-Repo `meine-projekte`)
- Bei Struktur-/Inhalts-Änderung: Eintrag in `C:\meine-projekte\README.md` ergänzen/aktualisieren
- Keine destruktiven Operationen ohne Bestätigung
