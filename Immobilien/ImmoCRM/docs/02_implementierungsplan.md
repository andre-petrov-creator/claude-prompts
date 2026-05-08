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

## Schritt 5: PDF-Drag-Drop für Lead-Anlegen

**Ziel:** Tab 2 (Smart-Mode) mit PDF-Extraktion (ohne Speicherung)

**Aufgaben:**
1. Tab 2: Drag & Drop Zone (react-dropzone)
2. PDF in-memory parsen (kein Upload, kein Storage, PDF wird nach Verarbeitung verworfen)
3. Subagent-Call (Claude API) für Feld-Extraktion
4. Extracted Fields in Form-Felder vorbefüllen
5. User-Verifikation und Korrektur möglich
6. Optional: User trägt manuell einen lokalen Pfad oder OneDrive-Link in `expose_local_path` ein
7. Speichern-Logik wie in Schritt 4

**Output:** PDF rein, Felder kommen automatisch raus, PDF bleibt lokal auf dem PC.

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

## Schritt 7: Aufteiler-Workflow Integration

**Ziel:** Subagent "CRM Befüllen" in bestehendem Cloud Code Workflow

**Aufgaben:**
1. Supabase REST API Endpunkte definieren (Lese: contacts via email, Schreib: contacts + deals + activity_log)
2. API-Token in Cloud Code Workflow konfigurieren
3. Subagent-Logik nach erfolgreicher Kalkulation:
   - Duplikat-Check via API
   - Hard/Soft/No-Match Branching
   - Position-Heuristik (Default Makler, GF/Inhaber-Erkennung, Name=Firma-Match)
   - Status-Default-Logik (berechnet/offen)
   - Activity Log Event schreiben
4. Test mit echtem PDF-Eingang
5. Error-Handling und Logging

**Output:** Workflow schreibt automatisch ins CRM.

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
Schritt 3 (Lead-Interaktionen)  ───┐
       │                            │
       ▼                            │
Schritt 4 (Manueller Lead)          │
       │                            │
       ▼                            │
Schritt 6 (CRM-Tabelle)             │
       │                            │
       ▼                            │
Schritt 5 (PDF-Drag-Drop)  ◄────────┘ (kann parallel zu 3-6)
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
| 5 PDF-Drag-Drop | 3 h |
| 6 CRM-Tabelle | 3 h |
| 7 Workflow-Integration | 3 h |
| 8 Tages-Mail | 4 h |
| 9 Daten-Migration | 2 h |
| 10 Polish | 4 h |
| **Total** | **~34 h** |

Bei 1-2 Schritten pro Abend: ~2-3 Wochen bis MVP.

---

## Definition of Done für MVP

- [ ] Lead-Liste zeigt alle Excel-Daten
- [ ] Aufteiler-Workflow schreibt automatisch ins CRM (Duplikat-frei)
- [ ] Manuelles Anlegen funktioniert (Schnell + PDF)
- [ ] CRM-Chat pro Kontakt funktioniert mit Edit/Delete
- [ ] Tägliche Mail kommt 8 Uhr mit korrekten Daten
- [ ] Performance-Tracking zeigt korrekten Wochenvergleich
- [ ] Pipeline-Wert (Mein Angebot, Verkaufspreis, Gewinn) wird korrekt berechnet
- [ ] PWA installierbar in Taskleiste
- [ ] Keine offenen kritischen Bugs
