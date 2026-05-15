# ImmoCRM — Progress-Tracker

Status pro Bauschritt aus [02_implementierungsplan.md](02_implementierungsplan.md). Wird nach **jedem** Schritt aktualisiert.

**Legende:** ⬜ offen · 🟡 in Arbeit · ✅ fertig · ❌ verworfen / blockiert

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
| 5 | PDF-Drag-Drop | ❌ verworfen | 2026-05-12 | 013 | Nicht gebaut. Aufwand-Nutzen ungünstig — Aufteiler-Workflow (Schritt 7) deckt ~95% der Lead-Befüllung ab. Tab "Mit PDF" aus `LeadCreateModal.tsx` entfernt. Reaktivierung später möglich (Cloud ~3h / Lokal ~6h). Siehe ADR-013. |
| 6 | CRM-Tabelle | ✅ | 2026-05-12 | 014, 015, 016 | TanStack-Table mit 11 Spalten (Name/Firma/Funktion/Tel/Email/Letzter Kontakt/Anzahl/Status/Lead-Herkunft/Deals/Notizen). Migration 009: contact_comments-CRUD für anon. Migration 010: `letzter_kontakt` als manuell setzbares Datum. Migration 011: `kontakt_count` als Counter-Spalte (Plus/Minus-Buttons, Toast unterdrückt). ContactStatus-Badge (kalt/warm/heiß/nr1) mit Direkt-Klick-Dropdown. Chat-Panel öffnet nur via explizitem Klick auf Notizen-Spalte (kein Row-Klick mehr). Sortierung, globale Suche, Status- + Lead-Source-Filter, Spalten-Sichtbarkeit mit localStorage-Persistenz. Klick auf "Deals"-Counter navigiert zu `/leads?contact=<id>` mit Filter-Badge. Plain-Text-Chat (Enter sendet, Shift+Enter-Newline, Auto-Scroll, Edit/Delete via Hover-Icons). ADR-014: clientseitige Aggregation. ADR-015: Plain-Textarea statt Tiptap. ADR-016: UX-Polish nach Owner-Test (Direkt-Klick auf Status/Dropdown/Datum statt Hover-Pencil, manuelles letzter_kontakt + kontakt_count). Build grün, Bundle ~380 KB gzipped. |
| 7 | Akquise-Pipeline (lokaler Watcher) | 🟡 | 2026-05-15 | 017 | Architektur final via lokalem Watcher + Cloud-Briefträger (ADR-017). Cloud-Pfad end-to-end verifiziert (5 Bug-Fixes inkl. file.name URL-encoding für Sonderzeichen). body.txt-Persistierung wirkt. Watcher startet headless Claude mit Modul-0-Skill im Akquise-Modus, Skill liest PDFs + body.txt. **Offen für nächste Session:** Watcher `--allowedTools` Erweiterung (Bash für CHECK24-Aufruf) + deals-Schema-Mismatch (`label`-Spalte fehlt) + Phase 2 (KI-Klassifikation der Anhänge, Bilder-/Unterlagen-Sub-Ordner, Link-Pipeline). |
| 8 | Tägliches Mail-Briefing | ⬜ | — | — | Vercel Cron, SMTP, HTML-Template |
| 9 | Daten-Migration aus Excel | ⬜ | — | — | ~80 Leads + Kontakte |
| 10 | Polish & Production-Readiness | ⬜ | — | — | Loading, Errors, PWA, Backup |

---

## Definition of Done — MVP

- [ ] Lead-Liste zeigt alle Excel-Daten
- [ ] Aufteiler-Workflow schreibt automatisch ins CRM (duplikat-frei)
- [ ] Manuelles Anlegen funktioniert (Schnell-Tab)
- [ ] CRM-Chat pro Kontakt funktioniert mit Edit/Delete
- [ ] Tägliche Mail kommt 8:00 mit korrekten Daten
- [ ] Performance-Tracking zeigt korrekten Wochenvergleich
- [ ] Pipeline-Wert wird korrekt berechnet
- [ ] PWA installierbar in Taskleiste
- [ ] Keine offenen kritischen Bugs

---

## Offene Punkte — am MVP-Ende abhaken

- [ ] **Nachfass-Logik gegen Excel 1.2.1 prüfen** (Aufgenommen 2026-05-11). ADR-005 definiert: `offen` +5 Werktage, `berechnet` +14 Werktage, jeweils ab `MAX(angebot_datum, last_comment_date)`, mit NRW-Werktagslogik. Vor MVP-Done verifizieren, ob das Excel-Schema 1.2.1 die gleiche Logik (Offset-Tage, Basis-Datum, Werktagsregel) hat — sonst Schema in `compute_followup()` anpassen.
- [ ] **Anzahl WE-Spalte im CRM hinzufügen** (Aufgenommen 2026-05-13, Side-Quest aus Schritt 7). `deals.wohneinheiten_count integer` (oder Reuse von vorhandener `einheiten`-Spalte falls schon da — prüfen!). Spalte in Lead-Tabelle hinter Objekt/Adresse einblenden. Wird auch von der Akquise-Pipeline befüllt (QuickCheck extrahiert WE-Zahl aus Exposé in `quickCheck.ts:extractKennzahlen`). Migration nach Abschluss Schritt 7.

## Update-Routine

Nach Abschluss eines Schritts:

1. Status-Spalte hier auf ✅ setzen + Datum
2. Falls ADR getroffen: Eintrag in [03_decisions.md](03_decisions.md), Referenz in der ADRs-Spalte
3. Falls Schritt teilweise fertig (🟡): Bemerkung-Spalte konkretisieren ("Teil A fertig, Teil B verschoben weil …")
4. Commit: `docs(progress): Schritt N abgeschlossen`
