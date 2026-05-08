# ImmoCRM — Progress-Tracker

Status pro Bauschritt aus [02_implementierungsplan.md](02_implementierungsplan.md). Wird nach **jedem** Schritt aktualisiert.

**Legende:** ⬜ offen · 🟡 in Arbeit · ✅ fertig · ❌ blockiert

---

## Phase 2 — Setup

| Status | Aufgabe | Notiz |
|--------|---------|-------|
| ✅ | Ordner-Struktur (`docs/`, `src/`, CLAUDE.md, GUIDELINES.md, ADRs, Progress, .gitignore) | 2026-05-08 |
| ✅ | Vite + React + TS initialisieren (strict mode) | 2026-05-08 — Vite 5.4, React 18.3, TS 5.6 |
| ✅ | Tailwind + shadcn/ui Setup (Theme default, Base color zinc) | 2026-05-08 — Button-Component installiert |
| ⬜ | Supabase-Projekt anlegen (Free Tier) | manuell durch User |
| ✅ | Supabase Client (`@supabase/supabase-js`) + Singleton (`src/lib/supabase.ts`) | 2026-05-08 |
| ✅ | `.env.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) | 2026-05-08 — `.env` durch User füllen |
| ✅ | Smoke-Build (`npm run build`) grün | 2026-05-08 — 36 Module, 2,98 s |
| ⬜ | Git-Repo initialisieren (Sub-Repo unter `meine-projekte`) | Mono-Repo `meine-projekte` ist bereits initialisiert; nur Commit nötig |
| ⬜ | Erstes Vercel-Deployment (Hello World) | manuell durch User (siehe Checkliste am Ende dieses Schritts) |

---

## Phase 3 — Bauschritte

| # | Schritt | Status | Datum | ADRs | Bemerkung |
|---|---------|--------|-------|------|-----------|
| 1 | Datenbank-Schema | ⬜ | — | — | Migrations + Test-Daten |
| 2 | Lead-Liste UI (read-only) | ⬜ | — | — | TanStack Table, Sektionen, Filter |
| 3 | Lead-Liste Interaktionen | ⬜ | — | — | Quick-Info, Notiz-Panel, Anruf-Hover |
| 4 | Manueller Lead | ⬜ | — | — | Schnell-Tab, Duplikat-Check |
| 5 | PDF-Drag-Drop | ⬜ | — | — | In-Memory-Parsing, Subagent-Extraktion |
| 6 | CRM-Tabelle | ⬜ | — | — | Kontakt-Liste + Chat-Stream |
| 7 | Aufteiler-Workflow-Integration | ⬜ | — | — | Subagent "CRM Befüllen" via Supabase REST |
| 8 | Tägliches Mail-Briefing | ⬜ | — | — | Vercel Cron, SMTP, HTML-Template |
| 9 | Daten-Migration aus Excel | ⬜ | — | — | ~80 Leads + Kontakte |
| 10 | Polish & Production-Readiness | ⬜ | — | — | Loading, Errors, PWA, Backup |

---

## Definition of Done — MVP

- [ ] Lead-Liste zeigt alle Excel-Daten
- [ ] Aufteiler-Workflow schreibt automatisch ins CRM (duplikat-frei)
- [ ] Manuelles Anlegen funktioniert (Schnell + PDF)
- [ ] CRM-Chat pro Kontakt funktioniert mit Edit/Delete
- [ ] Tägliche Mail kommt 8:00 mit korrekten Daten
- [ ] Performance-Tracking zeigt korrekten Wochenvergleich
- [ ] Pipeline-Wert wird korrekt berechnet
- [ ] PWA installierbar in Taskleiste
- [ ] Keine offenen kritischen Bugs

---

## Update-Routine

Nach Abschluss eines Schritts:

1. Status-Spalte hier auf ✅ setzen + Datum
2. Falls ADR getroffen: Eintrag in [03_decisions.md](03_decisions.md), Referenz in der ADRs-Spalte
3. Falls Schritt teilweise fertig (🟡): Bemerkung-Spalte konkretisieren ("Teil A fertig, Teil B verschoben weil …")
4. Commit: `docs(progress): Schritt N abgeschlossen`
