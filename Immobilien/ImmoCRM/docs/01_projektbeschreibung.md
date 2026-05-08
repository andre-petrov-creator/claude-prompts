# ImmoCRM - Projektbeschreibung

**Projektname:** ImmoCRM
**Owner:** André Petrov / Petrov Wohnen
**Erstellt:** 30. April 2026
**Phase:** Phase 1 (Sparring-Output)

---

## 1. Ziel und Vision

ImmoCRM ersetzt die bestehende Excel-basierte Lead- und Kontaktliste (Google Sheets `IMMO-CRM`) durch ein modernes, schnelles, persönlich genutztes Web-Tool. Es bildet die zentrale Datenbasis für die Akquise von Mehrfamilienhäusern (MFH) und Wohnungen im Ruhrgebiet/NRW und integriert sich nahtlos in den bestehenden automatisierten Aufteiler-Workflow (Cloud Code).

**Kernziele:**

1. Übersichtlichere und schnellere Bearbeitung von Leads als in Excel
2. Single Source of Truth für Kontakte (Makler) und Deals (Objekte)
3. Automatisierte Befüllung über bestehenden Aufteiler-Workflow (PDF-Scan, Kalkulation, Ordneranlage)
4. Tägliches automatisiertes Briefing per Mail für Action-Steuerung und Performance-Tracking
5. Modular erweiterbar für zukünftige Akquisemodule (Off-Market-Outreach, Foreclosure, Brokerage)

---

## 2. Tech-Stack

| Layer | Technologie | Begründung |
|-------|------------|------------|
| Frontend | Vite + React + TypeScript | Schneller als Next.js für Single-User Tool, keine SSR/SEO nötig |
| UI Library | Tailwind + shadcn/ui | Schnelle, professionelle Oberflächen, etabliert |
| Tabellen-Komponente | TanStack Table | Sortierung, Filter, Spalten-Management out of the box |
| Backend / DB | Supabase (Postgres) | Cloud-DB, Realtime, REST + GraphQL API für Workflow-Integration |
| Hosting | Vercel | Custom Domain möglich, Vercel Cron für Tages-Mail, Free Tier reicht |
| Mail-Versand | Gmail SMTP (gymmotivationtv@gmail.com) | App-Password-Auth, einfaches Setup |
| Editor | Tiptap oder Lexical | Rich-Text für Notizen (fett, Listen, Bullets) |

**Supabase Free Tier reicht aus:** 500 MB DB, 50.000 MAU. File Storage wird nicht genutzt (PDFs werden nicht gespeichert, siehe Abschnitt 4.3). Auto-Pause nach 7 Tagen Inaktivität ist kein Problem, weil tägliche Cron-Jobs aktiv halten.

---

## 3. Datenmodell

### Tabellen-Struktur (Supabase / Postgres)

```sql
contacts (Makler / Personen)
  id                uuid PK
  name              text NOT NULL
  email             text (unique normalized)
  phone             text
  company           text
  position          text  -- Default "Makler", Heuristik bei GF/Inhaber
  status            enum  -- kalt | warm | heiß | nr1
  lead_source       text  -- Online, Off-Market, Entrümpler, Direktkontakt, Auktion
  created_at        timestamptz
  updated_at        timestamptz

deals (Objekte / Leads)
  id                uuid PK
  contact_id        uuid FK → contacts.id
  status            enum  -- offen (orange) | berechnet (grün) | absage (rot)
  object_type       text  -- WHG, MFH, REH, Bungalow, etc.
  einheiten         int   -- Pflicht bei MFH
  address           text
  city              text
  zip               text
  wohnflaeche_m2    numeric
  preis_kauf        numeric
  preis_pro_m2      numeric (computed)
  kalk_verkaufspreis numeric
  kalk_pro_m2       numeric (computed)
  mein_angebot      numeric
  angebot_datum     date
  besichtigung_datum date
  letzter_anruf     date
  naechste_nachfass date  -- computed aus angebot_datum + Schema
  expose_url        text  -- Online-Exposé URL (ImmoScout, etc.)
  expose_local_path text  -- optional lokaler Pfad (z.B. OneDrive), nur Stringverweis, kein File-Upload
  notes_link        text  -- z.B. OneDrive-Ordner-Link
  created_at        timestamptz
  updated_at        timestamptz

contact_comments (Chat-Stream pro Kontakt, WhatsApp-Style)
  id                uuid PK
  contact_id        uuid FK → contacts.id
  text              text
  created_at        timestamptz
  updated_at        timestamptz  -- für Edit-Tracking

deal_notes (Notiz-Einträge pro Deal, zeitgestempelt)
  id                uuid PK
  deal_id           uuid FK → deals.id
  content_html      text  -- Rich-Text (fett, Listen, Bullets)
  created_at        timestamptz
  updated_at        timestamptz

activity_log (für Performance-Tracking in Mail)
  id                uuid PK
  type              enum  -- new_lead, anruf, besichtigung, angebot
  contact_id        uuid FK
  deal_id           uuid FK
  created_at        timestamptz
```

### Beziehungen

- 1 Contact hat n Deals
- 1 Contact hat n Comments (persönlicher Chat-Stream)
- 1 Deal hat n Notes (objektspezifische Notizen)
- Activity Log trackt Performance-Events für Mail-Reporting

---

## 4. Hauptfunktionen

### 4.1 Lead-Liste (Hauptansicht)

**Spalten von links nach rechts (analog Excel):**

```
Status | Name (Makler) | Firma | Telefon | E-Mail | Anruf | Besichtigung |
Lead-Herkunft | Objekt | Adresse | Verwendung | Wohnfläche | Preis | €/m² |
Kalk Verkaufspreis | €/m² | Mein Angebot | Angebot gültig |
Nächste Nachfass | Exposé | Notiz
```

**Status-Anzeige:**

| Status | Farbe | Bedeutung |
|--------|-------|-----------|
| offen | Orange | Unterlagen fehlen, kann nicht kalkulieren |
| berechnet | Grün | Aktiv verfolgt, Kalkulation komplett |
| absage | Rot | Stoppt Nachfass-Loop |

**Sektionen (kollabierbar als großes Dropdown):**

- Berechnet/Aktiv (Default ausgeklappt)
- Offen
- Absage (Default eingeklappt)

Jede Sektion zeigt Lead-Counter. Gesamtzahl aller Leads oben sichtbar.

**Tabellen-Features:**

- Sortierung per Spalten-Klick
- Filter nach allen Spalten (Datum, Makler, Status, Lead-Herkunft, etc.)
- Spalten ein-/ausblendbar
- Globale Suche

### 4.2 Lead-Interaktionen

**Klick auf Name (Makler):**
Öffnet Quick-Info-Popover mit Telefon, E-Mail, Firma, Position. 1-Klick-Copy-Icons neben jedem Wert. Schließt automatisch bei Klick außerhalb.

**Klick auf Notiz-Spalte oder Zeile:**
Öffnet Slide-In-Panel rechts mit zeitgestempelten Notizen-Einträgen (analog CRM-Chat). Edit/Delete via Hover-Icons oder Rechtsklick.

**Klick auf Exposé-Icon:**
Blau wenn `expose_url` oder `expose_local_path` vorhanden, grau wenn nicht. Klick öffnet URL extern (https://) oder lokalen Pfad (file://) im Browser. PDFs liegen lokal auf dem PC oder OneDrive, das Tool speichert nur den Verweis-String.

**Anruf erfassen (Hover-Button):**
Maus 1 Sekunde auf Anruf-Spalte stehen lassen → Button "Anruf eintragen" erscheint → Klick setzt Datum heute. Rechtsklick öffnet Datepicker für andere Daten.

### 4.3 Manuelles Lead-Anlegen

**Button "+ Neuer Lead" oben rechts in Lead-Liste**

Modal mit zwei Tabs:

**Tab 1: SCHNELL**
- Kontakt-Feld mit Autocomplete-Dropdown (live-Filter aus DB)
  - Existierender Kontakt: 1 Klick, alle Daten verlinkt
  - Neuer Kontakt: durchtippen, wird beim Speichern angelegt
- Pflichtfelder: Adresse, Objekttyp, Lead-Herkunft
- Bei Objekttyp = MFH: Einheiten Pflicht
- Optional: Preis, Wohnfläche, Notizen

**Tab 2: MIT PDF (Smart-Mode)**
- Drag & Drop Exposé-PDF (nur in-memory parsen, NICHT speichern)
- Subagent extrahiert Felder automatisch (Wiederverwendung der Aufteiler-Logik)
- User verifiziert/korrigiert, klickt Speichern
- PDF wird nach Extraktion verworfen, nur extrahierte Daten landen in DB
- User kann optional manuell einen lokalen Pfad oder OneDrive-Link in `expose_local_path` eintragen

**Beim Speichern:**
- Duplikat-Check auf Email + Name
- Hard Match (Email gleich): Update existing Contact, Deal anhängen
- Soft Match (nur Name gleich): Warnung, User entscheidet Merge oder Neu
- Status-Default: berechnet wenn alle Daten da, offen wenn unvollständig

### 4.4 CRM-Tabelle (Kontakte)

Separate Ansicht (Tab oder Sidebar-Navigation). Zeigt alle Kontakte mit:

```
Name | Firma | Funktion | Telefon | Email | Letzter Kontakt | Status (kalt/warm/heiß) |
Lead-Herkunft | Anzahl Deals | Notizen-Counter
```

**Klick auf Kontakt-Zeile:**
Slide-In-Panel rechts mit WhatsApp-Style-Chat. Zeitgestempelte Einträge. Edit/Delete via Hover-Icons oder Rechtsklick. Eingabe per Enter sendet, Shift+Enter für Zeilenumbruch.

**Klick auf Anzahl-Deals-Zelle:**
Filtert Lead-Liste auf nur diesen Makler.

### 4.5 Tägliches Mail-Briefing

**Trigger:** Vercel Cron Job, täglich 8:00 Uhr Berlin-Zeit
**Versand:** gymmotivationtv@gmail.com → andre-petrov@web.de
**Format:** Mobile-fähiges HTML

**Inhalt-Struktur:**

```
🔥 ÜBERFÄLLIG / HEUTE FÄLLIG
   (sortiert nach Nachfass-Datum, älteste zuerst)
   - Ramon Agsten (Talstr 10) | 2 Tage überfällig
   - Maria Bauer (Kolmarer 6) | heute fällig

📅 BESICHTIGUNGEN HEUTE
   - 14:00 Hansjürgen Potthoff (Koppelstr 29)

⏭️ DIESE WOCHE
   Mi: 1 Nachfass | Do: 2 Nachfass + 1 Besichtigung | Fr: 0

📊 PERFORMANCE (diese Woche vs letzte)
   Neue Leads:        5  | 7   (-29%)
   Anrufe:           12  | 8   (+50%)
   Besichtigungen:    3  | 2   (+50%)
   Angebote raus:     2  | 1   (+100%)

📈 PIPELINE
   Aktive (berechnet):  23
   Offen:                4
   Mein Angebot ges:    EUR 2.8 Mio
   Verkaufspreis kalk:  EUR 4.2 Mio
   Potentieller Gewinn: EUR 1.4 Mio
```

### 4.6 Workflow-Integration (Aufteiler-Workflow)

Bestehender Cloud-Code-Workflow `Automation Akquise` wird ergänzt um Subagent **"CRM Befüllen"**:

**Trigger-Punkt:** Nach erfolgreicher PDF-Extraktion + Kalkulation
**Aktion:**
1. Duplikat-Check via Supabase REST API (Email + Name)
2. Bei Hard Match: Update Contact, neuer Deal angehängt
3. Bei Soft Match: Deal mit `duplicate_warning_flag` anlegen, User-Notiz in Chat-Stream
4. Bei No Match: Contact + Deal anlegen
5. Status-Default: `berechnet` wenn alle Felder da, sonst `offen`
6. Activity Log Event: `new_lead`

**Position-Heuristik im Subagent:**
- Default: "Makler"
- Wenn PDF/Mail-Signatur "GF", "Geschäftsführer", "Inhaber" → übernehmen
- Wenn Nachname == Firmenname → "Inhaber"

---

## 5. Status-Lifecycle

```
[Workflow-Import]
       │
       ▼
   berechnet ─────────────→ absage  (du oder Verkäufer abgesagt)
       │ ▲
       ▼ │
     offen (manuell)
   (User schiebt rein wenn Unterlagen fehlen,
    schiebt zurück nach berechnet wenn komplett)
```

**Nachfass-Schema (automatisch berechnet):**

```
Tag 0 (angebot_datum): Angebot raus
+7 Tage:  Nachfassen 1
+7 Tage:  Nachfassen 2
+14 Tage: Nachfassen 3
+14 Tage: Nachfassen 4 (Loop +14 Tage bis Status = absage)
```

Anzeige: nur das nächste fällige Datum sichtbar. Rot wenn überschritten. Manuelle Override möglich (Datepicker).

---

## 6. Was nicht im MVP

Aus Scope ausgeschlossen, eventuell spätere Module:

- Käufer-Suchprofile (Verkaufs-Modul)
- Investments-Tracking-Tabelle (gekaufte Objekte)
- Multi-User / Auth (single-user lokal)
- Mobile App (PWA installierbar reicht)
- Excel-Export (Cloud Code kann direkt aus Supabase ziehen)
- Off-Market-Outreach-Modul (separater Bau, nutzt aber dieselbe DB)

---

## 7. Erfolgskriterien MVP

Das MVP ist erfolgreich, wenn:

1. Lead-Liste vollständig aus Excel migriert (~80 aktive Leads)
2. Aufteiler-Workflow schreibt automatisch ins CRM (Duplikat-frei)
3. Tägliche Mail kommt pünktlich um 8:00 mit korrekten Daten
4. Notizen pro Deal und Kommentare pro Kontakt funktionieren mit Edit/Delete
5. Performance-Tracking zeigt Wochenvergleich korrekt

---

## 8. Risiken und Annahmen

**Risiken:**
- Supabase Free Tier könnte limitieren wenn Datenmenge wächst (aktuell: total unkritisch)
- Vercel Cron darf nur 2x pro Tag im Free Plan triggern (1x täglich = ok)
- Subagent-Integration im Aufteiler-Workflow braucht saubere API-Keys-Verwaltung

**Annahmen:**
- Cloud Code bleibt das primäre Automatisierungs-Tool
- Gmail SMTP bleibt verfügbar mit App-Password
- Keine Multi-User-Anforderung in den nächsten 12 Monaten
