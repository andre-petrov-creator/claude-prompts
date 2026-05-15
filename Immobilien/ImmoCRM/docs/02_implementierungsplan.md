# ImmoCRM - Implementierungsplan

**Version:** 1.0
**Datum:** 30. April 2026
**Methodik:** Modulares Bauen, ein Schritt pro Chat in Phase 3

---

## Bauphilosophie

Jeder Implementierungsschritt ist:

1. **Atomar** (in einer Coding-Session abschließbar, max. 2-4 Stunden)
2. **Testbar** (am Ende läuft etwas Sichtbares oder ein klarer Test passt)
3. **Kein Lock-in** (späterer Schritt überschreibt nichts kritisch von früherem)

Pro Schritt: Eigener Web-Claude-Chat für Sparring, dann finaler Claude-Code-Prompt mit Skill-Refs und Doku-Update. Nach jedem Schritt /docs aktualisieren.

---

## Kommunikation mit Claude bei Auswahl-Entscheidungen (verbindlich)

Owner ist kein Programmierer. Bei jeder Auswahl-Frage gilt das **4-Punkte-Schema** für jeden Fachbegriff (auch in Code-Schritt-Beschreibungen wenn relevant):

1. **Was es heißt** — kurze Definition in Alltagssprache
2. **Wozu es gut ist** — welchen Zweck es im System hat
3. **Wie es funktioniert** — der Mechanismus in 1-2 Sätzen
4. **Warum wir es (hier) brauchen** — konkreter Bezug zum Tool

Plus: jede Auswahl-Frage **mit klarer Empfehlung** (erste Option, markiert mit "(Empfohlen)") und mit konkreten Folgen (Kosten, Wartezeit, Aufwand, Risiko).

Verankert auch in [DEVELOPMENT_GUIDELINES.md](../DEVELOPMENT_GUIDELINES.md) Abschnitt "Kommunikation mit dem Owner".

---

## Schritt 0: Projekt-Setup (Phase 2)

**Ziel:** Saubere Projektstruktur mit Memory-Architektur für Claude Code

**Aufgaben:**
1. Ordner anlegen: `C:\Meine Projekte\ImmoCRM`
2. CLAUDE.md erstellen (Projekt-Kontext für Claude Code)
3. DEVELOPMENT_GUIDELINES.md erstellen (Coding-Standards, Naming, Patterns)
4. /docs anlegen mit:
   - 01_projektbeschreibung.md (diese Datei kopieren)
   - 02_implementierungsplan.md (diese Datei)
   - 03_decisions.md (für ADRs während Bau)
   - 04_progress.md (Status-Tracking pro Schritt)
5. Vite + React + TypeScript Projekt initialisieren
6. Tailwind + shadcn/ui setup
7. Supabase-Projekt erstellen (Free Tier)
8. .env-Datei mit Supabase-Keys (in .gitignore)
9. Git-Repo initialisieren
10. Erstes Deployment auf Vercel (leere App, nur Hello World)

**Output:** Lauffähige leere App auf Vercel-URL erreichbar.

---

## Schritt 1: Datenbank-Schema

**Ziel:** Supabase-Datenbank mit allen Tabellen + Migrations

**Aufgaben:**
1. SQL-Migrations schreiben für:
   - `contacts`
   - `deals`
   - `contact_comments`
   - `deal_notes`
   - `activity_log`
2. Indices für Performance (email_normalized, deal status, dates)
3. Row Level Security setup (auch wenn Single-User, für später)
4. Trigger für `updated_at`-Timestamps
5. Trigger für `naechste_nachfass`-Berechnung (oder als View)
6. Test-Daten: 5 Contacts, 5 Deals einfügen
7. Supabase-Client-Setup im Frontend (`src/lib/supabase.ts`)

**Output:** DB läuft, Test-Queries funktionieren, Frontend kann lesen.

---

## Schritt 2: Lead-Liste UI (read-only)

**Ziel:** Tabelle anzeigen, sortierbar, filterbar, ohne Edit

**Aufgaben:**
1. TanStack Table einbauen
2. Spalten definieren (alle 21 wie in Excel)
3. Daten von Supabase fetchen
4. Sortierung pro Spalte
5. Globale Suche
6. Filter pro Spalte (Datum, Status, Lead-Herkunft)
7. Spalten-Sichtbarkeit (Show/Hide-Menü)
8. Status-Badges mit Farbcodes (offen/orange, berechnet/grün, absage/rot)
9. Sektionen-Dropdown (kollabierbar): Berechnet, Offen, Absage
10. Lead-Counter pro Sektion + Gesamtzahl

**Output:** Lead-Liste sieht aus wie geplant, alle Test-Daten sichtbar.

---

## Schritt 3: Lead-Liste Interaktionen

**Ziel:** Quick-Info, Notiz-Panel, Exposé-Link, Anruf-Button

**Aufgaben:**
1. Quick-Info-Popover bei Klick auf Name (Telefon, Email, Firma, Position + Copy-Buttons)
2. Slide-In-Panel rechts (shadcn `Sheet`-Component)
3. Deal-Notes-Liste im Panel (zeitgestempelt, scrollbar)
4. Edit/Delete pro Notiz-Eintrag (Hover-Icons + Rechtsklick)
5. Eingabe-Feld für neue Notiz (Tiptap oder Lexical, Rich-Text)
6. Exposé-Spalte mit Icon (blau wenn Link, grau wenn nicht)
7. Klick auf Exposé öffnet PDF/URL
8. Anruf-Spalte mit Hover-Button "Anruf eintragen"
9. Rechtsklick auf Anruf-Spalte: Datepicker

**Output:** Vollständige Interaktion mit Lead-Liste, alle Notizen änderbar.

---

## Schritt 4: Manueller Lead-Anlegen

**Ziel:** Off-Market-Leads schnell erfassen

**Aufgaben:**
1. Button "+ Neuer Lead" oben rechts
2. Modal mit Tabs (shadcn `Dialog` + `Tabs`)
3. Tab Schnell:
   - Kontakt-Feld mit Autocomplete-Dropdown (shadcn `Combobox`)
   - Live-Filter aus contacts-Tabelle
   - "Neuer Kontakt anlegen"-Option im Dropdown
   - Pflichtfelder: Adresse, Objekttyp, Lead-Herkunft
   - Conditional: Einheiten-Feld bei Objekttyp = MFH
   - Optional: Preis, Wohnfläche, Notiz
4. Form-Validation (react-hook-form + zod)
5. Duplikat-Check beim Speichern (Email + Name)
6. Soft-Match-Warnung-Dialog
7. Status-Default-Logik (berechnet wenn komplett, offen wenn nicht)
8. Activity-Log-Event `new_lead` schreiben

**Output:** Off-Market-Lead in 30 Sekunden im System.

---

## Schritt 5: PDF-Drag-Drop — VERWORFEN

**Status:** ❌ Nicht gebaut. Tab "Mit PDF" aus dem Lead-Anlegen-Modal entfernt.

**Begründung:** Aufwand-Nutzen ungünstig — der Aufteiler-Workflow (Schritt 7) deckt ~95% der Lead-Befüllung automatisch ab. Manueller PDF-Drop wäre nur für seltene Off-Market-Sonderfälle relevant (1-5×/Woche), bei denen 1-2 Minuten manuelle Tipparbeit im Schnell-Tab akzeptabel sind.

**Details:** siehe [ADR-013 in 03_decisions.md](03_decisions.md#adr-013--schritt-5-pdf-drag-drop-nicht-gebaut)

**Reaktivierung später möglich** (Cloud-Variante ~3h oder lokaler Server ~6h, wiederverwendet `automatisierung-aquise/modules/m05_address_extractor.py`) — Entscheidung dann mit echten Nutzungsdaten.

---

## Schritt 6: CRM-Tabelle

**Ziel:** Separate Ansicht für Kontakte mit Chat-Stream

**Aufgaben:**
1. Routing setup (Lead-Liste / CRM-Liste)
2. CRM-Tabelle mit allen Kontakten (TanStack Table)
3. Spalten: Name, Firma, Funktion, Telefon, Email, Letzter Kontakt, Status, Lead-Herkunft, Anzahl Deals
4. Klick auf Zeile öffnet Slide-In-Panel
5. WhatsApp-Style-Chat im Panel:
   - Liste der Comments mit Zeitstempel
   - Eingabe-Textarea unten
   - Enter sendet, Shift+Enter Zeilenumbruch
6. Edit/Delete pro Comment (Hover-Icons + Rechtsklick)
7. Klick auf "Anzahl Deals"-Zelle: filtert Lead-Liste auf diesen Makler

**Output:** Komplette CRM-Funktionalität.

---

## Schritt 7: Akquise-Pipeline (Cloud-Briefträger + Lokaler Quick-Check)

**Status:** 🟡 Phase 1 weitgehend durch (2026-05-15). Cloud-Pfad end-to-end verifiziert, Watcher + Skill (Akquise-Modus) laufen. **Offen:** Watcher-`--allowedTools` für CHECK24-Bash-Aufruf, `deals`-Schema-Mismatch, Phase 2.

**Aktive Spec:** [`docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md`](superpowers/specs/2026-05-14-akquise-pipeline-redesign.md) (mit Revision-Block 2026-05-15)

**Aktiver Plan:** [`docs/superpowers/plans/2026-05-15-akquise-pipeline-local-watcher-final.md`](superpowers/plans/2026-05-15-akquise-pipeline-local-watcher-final.md)

**ADR:** [ADR-017](03_decisions.md#adr-017--akquise-pipeline-mit-lokalem-watcher-final)

**Historische Spec (ersetzt):** [`docs/superpowers/specs/2026-05-11-akquise-pipeline-cloud-design.md`](superpowers/specs/2026-05-11-akquise-pipeline-cloud-design.md)

**Architektur in Kurzform:**

```
Mail → CRM-Eingang (M365)
  → Webhook (Vercel, läuft)
  → mail_queue (Supabase)
  → /api/akquise/process (Cloud-Briefträger: PDFs + body.txt + _meta.json + .trigger → OneDrive _inbox/<msg-id>/)
  → OneDrive synct auf PC
  → Task Scheduler (At log on + Every 1 minute) → PowerShell-Watcher findet .trigger
  → claude --print --permission-mode acceptEdits --add-dir Aufteiler [stdin: Skill-Prompt]
  → aufteiler-modul-0-quickcheck im Akquise-Modus
  → Lead im CRM mit Score, Ordner umbenannt, .code-workspace für späteren Wiedereinstieg
```

**Phase-1-Status (heute 2026-05-15):**

| Substep | Status |
|---|---|
| DB-Migration `mail_queue` | ✅ committed |
| Cloud-Code abgespeckt (process.ts) | ✅ |
| Cloud-Bug-Marathon (5 Fixes inkl. file.name URL-encoding) | ✅ |
| body.txt-Persistierung | ✅ |
| Akquise-Watcher (PowerShell + Task Scheduler XML) | ✅ |
| Modul-0-Skill Dual-Mode + Akquise-Modus Stub mit CHECK24 | ✅ |
| Skill Adress-Priorisierung (Sender-Adress-Falle entschärft) | ✅ |
| E2E bis Skill-Lauf | ✅ |
| Watcher-Allowed-Tools (Bash für CHECK24) | ⬜ |
| `deals`-Schema-Match | ⬜ |
| Lead landet im CRM-UI | ⬜ |

**Phase 2 (separater Plan, eigene Session):** KI-Klassifikation der Anhänge (Exposé, Mietaufstellung, Energieausweis, Bilder, Unterlagen), `bilder/`-/`unterlagen/`-Sub-Ordner, Link-Pipeline mit Playwright-Scraping (HTML-Exposé, Diashow-Bilder, Drucken-Button-PDF). Brainstorming-Prompt steht am Ende des aktiven Plans.

---

## Schritt 8: Tägliches Mail-Briefing

**Ziel:** 8 Uhr Mail mit Action-Items und Performance

**Aufgaben:**
1. Vercel Edge Function für Mail-Versand
2. SMTP-Setup (gymmotivationtv@gmail.com mit App-Password)
3. HTML-Template (mobile-responsive)
4. Datenabfragen:
   - Überfällige Nachfass-Deals (sortiert nach Datum)
   - Heute fällige Nachfass-Deals
   - Heute terminierte Besichtigungen
   - Wochenausblick (nächste 7 Tage)
   - Performance-Stats (Activity-Log diese vs. letzte Woche)
   - Pipeline-Wert (Mein Angebot, Verkaufspreis, Gewinn-Potential)
5. Vercel Cron Job (cron: `0 7 * * *` = 8 Uhr Berlin-Zeit, weil UTC)
6. Manuelle Trigger-URL für Tests
7. Error-Handling (wenn Mail nicht durchgeht: Logging)

**Output:** Mail kommt täglich pünktlich.

---

## Schritt 9: Daten-Migration aus Excel

**Ziel:** Bestehende ~80 Leads + Kontakte aus Google Sheets ins CRM

**Aufgaben:**
1. CSV-Export aus Google Sheets
2. Migrations-Skript (Python oder Node):
   - Contacts deduplizieren (Email + Name)
   - Deals an Contacts knüpfen
   - Datums-Parsing (deutsche Formate)
   - Notizen importieren
   - Status-Mapping (alte Werte → neue Enums)
3. Trockenlauf in lokaler DB
4. Validierungs-Report (Anzahl, Duplikate, Fehler)
5. Echter Import nach Supabase
6. Stichproben-Check im Frontend

**Output:** Komplette Excel im neuen System.

---

## Schritt 10: Polish & Production-Readiness

**Ziel:** UX-Feinschliff und Stabilität

**Aufgaben:**
1. Loading States (Skeletons statt Spinner)
2. Error-Boundaries (kein White-Screen-of-Death)
3. Toast-Notifications für Actions (Speichern, Löschen, Duplikat-Warnung)
4. Keyboard-Shortcuts (Cmd+N für neuer Lead, Esc zum Schließen, etc.)
5. Empty-States (was sehen wir wenn keine Leads da sind)
6. PWA-Manifest + Service Worker (installierbar in Taskleiste)
7. Performance-Optimierung (Pagination wenn >500 Leads)
8. Backup-Strategie (Supabase DB-Dump regelmäßig)
9. Final QA mit echten Workflow-Daten

**Output:** Tool fühlt sich production-ready an.

---

## Build-Reihenfolge / Abhängigkeiten

```
Schritt 0 (Setup)
       │
       ▼
Schritt 1 (DB-Schema)
       │
       ▼
Schritt 2 (Lead-Liste read-only)
       │
       ▼
Schritt 3 (Lead-Interaktionen)
       │
       ▼
Schritt 4 (Manueller Lead)
       │
       ▼
Schritt 5 (PDF-Drag-Drop) ❌ VERWORFEN — siehe ADR-013
       │
       ▼
Schritt 6 (CRM-Tabelle)
       │
       ▼
Schritt 7 (Workflow-Integration)
       │
       ▼
Schritt 8 (Tages-Mail)
       │
       ▼
Schritt 9 (Daten-Migration)
       │
       ▼
Schritt 10 (Polish)
```

---

## Zeitabschätzung

| Schritt | Aufwand realistisch |
|---------|---------------------|
| 0 Setup | 2 h |
| 1 DB-Schema | 2 h |
| 2 Lead-Liste read-only | 4 h |
| 3 Lead-Interaktionen | 4 h |
| 4 Manueller Lead | 3 h |
| 5 PDF-Drag-Drop | ❌ verworfen (ADR-013) |
| 6 CRM-Tabelle | 3 h |
| 7 Workflow-Integration | 3 h |
| 8 Tages-Mail | 4 h |
| 9 Daten-Migration | 2 h |
| 10 Polish | 4 h |
| **Total** | **~31 h** |

Bei 1-2 Schritten pro Abend: ~2-3 Wochen bis MVP.

---

## Definition of Done für MVP

- [ ] Lead-Liste zeigt alle Excel-Daten
- [ ] Aufteiler-Workflow schreibt automatisch ins CRM (Duplikat-frei)
- [ ] Manuelles Anlegen funktioniert (Schnell-Tab)
- [ ] CRM-Chat pro Kontakt funktioniert mit Edit/Delete
- [ ] Tägliche Mail kommt 8 Uhr mit korrekten Daten
- [ ] Performance-Tracking zeigt korrekten Wochenvergleich
- [ ] Pipeline-Wert (Mein Angebot, Verkaufspreis, Gewinn) wird korrekt berechnet
- [ ] PWA installierbar in Taskleiste
- [ ] Keine offenen kritischen Bugs
