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
| ✅ | Supabase-Projekt anlegen (Free Tier) | 2026-05-08 — `immo-crm` in Frankfurt (eu-central-1) |
| ✅ | Supabase Client (`@supabase/supabase-js`) + Singleton (`src/lib/supabase.ts`) | 2026-05-08 |
| ✅ | `.env.example` + lokale `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) | 2026-05-08 |
| ✅ | Smoke-Build (`npm run build`) grün | 2026-05-08 — 36 Module, 2,98 s |
| ✅ | Smoke-Test lokal (`npm run dev`) — Button + Alert + keine Console-Errors | 2026-05-08 |
| ✅ | Git-Repo (Mono-Repo `meine-projekte`) — Schritt-0-Commit gepusht | 2026-05-08 — `6d79606` |
| ✅ | Vercel-Deployment Hello World | 2026-05-08 — https://immo-crm-xi.vercel.app (HTTP 200) |

---

## Phase 3 — Bauschritte

| # | Schritt | Status | Datum | ADRs | Bemerkung |
|---|---------|--------|-------|------|-----------|
| 1 | Datenbank-Schema | ✅ | 2026-05-09 | 003-008 | Migration applied via MCP, RLS+GRANTs verifiziert, Types generiert |
| 2 | Lead-Liste UI (read-only) | ✅ | 2026-05-11 | — | TanStack Table mit 21 Spalten, 3 Sektionen, Status-Badges, Sortierung, globale Suche, Spalten-Sichtbarkeit, react-query, Router (Leads/Kontakte). Demo-Seed: 3 Makler + 5 Deals (1 überfällig). Visual-Akzeptanz 10/10 bestätigt. Schritt-2-Polish (spaltenspezifische Filter) auf Schritt 10 verschoben. |
| 3 | Lead-Liste Interaktionen | ✅ | 2026-05-11 | 011 | Quick-Info-Popover (Tel/Email/Firma/Position + 1-Click-Copy mit Toast), Slide-In-Panel (Sheet) mit Tiptap-Editor (Bold/Italic/Underline/BulletList/OrderedList), Edit/Delete pro Notiz mit Hover-Icons + `window.confirm`, Exposé-Icon blau/grau + file:// Copy-Fallback, Anruf-Hover-Button (1s-Timer mit useEffect-Cleanup) + Rechtsklick-Datepicker. Migration 002: RLS für deal_notes-CRUD + deals-UPDATE geöffnet (ADR-011). shadcn-Calendar selbst geschrieben für react-day-picker v9. |
| 4 | Manueller Lead | ✅ | 2026-05-11 | 012 | Modal mit Tabs (Schnell aktiv, PDF disabled), shadcn dialog/tabs/alert-dialog/label-Wrapper, react-hook-form+zod, Combobox-Pattern aus EditableComboboxCell wiederverwendet. Duplikat-Check zweistufig: Hard (Email) → non-destruktiver Merge, Soft (Name + keine Email) → 3-Wege-AlertDialog, Deal-Dup auf address+zip(+m²) → User-Choice "trotzdem anlegen". Activity-Log-Eintrag "new_lead". Status-Default berechnet/offen via pure-function. Migration 008 öffnet RLS+GRANTs für anon-INSERT auf contacts/deals/activity_log. Pure Logic in `src/features/lead-create/leadCreateLogic.ts` (testbar wenn Vitest kommt). Bundle 340→377 KB gzipped. |
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

## Offene Punkte — am MVP-Ende abhaken

- [ ] **Nachfass-Logik gegen Excel 1.2.1 prüfen** (Aufgenommen 2026-05-11). ADR-005 definiert: `offen` +5 Werktage, `berechnet` +14 Werktage, jeweils ab `MAX(angebot_datum, last_comment_date)`, mit NRW-Werktagslogik. Vor MVP-Done verifizieren, ob das Excel-Schema 1.2.1 die gleiche Logik (Offset-Tage, Basis-Datum, Werktagsregel) hat — sonst Schema in `compute_followup()` anpassen.

## Update-Routine

Nach Abschluss eines Schritts:

1. Status-Spalte hier auf ✅ setzen + Datum
2. Falls ADR getroffen: Eintrag in [03_decisions.md](03_decisions.md), Referenz in der ADRs-Spalte
3. Falls Schritt teilweise fertig (🟡): Bemerkung-Spalte konkretisieren ("Teil A fertig, Teil B verschoben weil …")
4. Commit: `docs(progress): Schritt N abgeschlossen`
