---
name: aufteiler
description: Orchestrator für die MFH-Aufteiler-Analyse (NRW/Ruhrgebiet). Trigger bei "Aufteiler", "Vollanalyse MFH", "Quick-Check MFH", "Mietsituation prüfen", "RND prüfen", "Massnahmen kalkulieren", "Deal-Bewertung", "PDF-Export Aufteiler". Erkennt Modus deterministisch, legt State pro Objekt an, dispatcht Modul-Sub-Skills mit Freigabe-Gate nach jedem Modul. Rechnet selbst NICHTS.
---

# Aufteiler-Orchestrator

Stumpfer Dispatcher. Je dümmer, desto reproduzierbarer.

## 1. Modus-Erkennung (deterministisch — keine Vermutung)

Erste Aktion bei jedem Aufruf: User-Aussage gegen Tabelle matchen.

| User sagt … (Substring-Match, case-insensitive) | Modus | Sequenz |
|-------------------------------------------------|-------|---------|
| "vollanalyse", "komplette analyse", "alles", "ganze analyse" | `vollanalyse` | 0 → 1 → 2 → 3 → 4 |
| "quick-check", "quickcheck", "schnellcheck" | `nur_quickcheck` | 0 |
| "objektbasis", "we-liste", "we liste" | `nur_basis` | 1 |
| "rnd", "restnutzungsdauer", "afa" | `nur_rnd` | 2 |
| "massnahmen", "sanierung", "modernisierung" | `nur_massnahmen` | 3 |
| "miete", "mietspiegel", "mietsituation" | `nur_miete` | 4 |
| "deal-bewertung", "pdf-export", "pdf export", "endbericht", "verdict" | `nur_export` | 5 |

**Bei unklarem Input** (kein Match oder mehrere Matches): EINE Rückfrage via `AskUserQuestion` mit allen plausiblen Modi als Optionen. Niemals raten.

## 2. TodoWrite VOR Start

Sobald Modus erkannt, sofort `TodoWrite` aufrufen mit einer Aufgabe pro Modul der Sequenz + zwei Klammer-Aufgaben:
- "State init / laden für Objekt <slug>"
- "Modul 0 — Quick-Check"
- … (gemäß Sequenz)
- "Vollanalyse abgeschlossen"

Damit ist State auch nach Compression sichtbar, und Claude kann nicht „springen".

## 3. Objekt-Slug + State-Init

1. **Adresse erfragen** via `AskUserQuestion`, falls nicht im Input enthalten:
   "Adresse des Objekts? (z.B. Prosperstr. 59, 45356 Essen-Dellwig)"
2. **Slug bilden:** kebab-case aus Straße + Hausnummer + Stadt(teil), Umlaute ersetzen (`ä→ae`, `ö→oe`, `ü→ue`, `ß→ss`), Sonderzeichen weg, Whitespace zu `-`. Beispiel:
   `Prosperstr. 59, 45356 Essen-Dellwig` → `prosperstr-59-essen-dellwig`.
3. **Bestehenden State suchen:** `runs/<slug>/state.json` lesen. Wenn vorhanden:
   - `objekt.letzter_modul_lauf` melden: `"State für <slug> existiert, letzter Lauf: <modul_N>. Weiter ab Modul <N+1>? (ja = weiter, neu = State frisch)"`
   - User-Antwort `neu` → existierenden Ordner zu `runs/<slug>_<timestamp>_archiv/` umbenennen, frischen anlegen.
4. **Frischen State init** (falls neu oder nach Archiv):
   ```bash
   mkdir -p runs/<slug>/eingangs-daten
   ```
   `runs/<slug>/state.json` mit Minimal-Objekt:
   ```json
   {
     "schema_version": "1.0",
     "objekt": {
       "slug": "<slug>",
       "adresse": "<adresse>",
       "stadt": "<stadt>",
       "bundesland": "NRW",
       "erstellt_am": "<heute ISO>",
       "letzter_modul_lauf": "modul_0"
     }
   }
   ```
5. Validieren: `python tools/validate_state.py runs/<slug>/state.json` → exit 0.

## 4. Sub-Skill-Aufruf pro Modul (Sequenz abarbeiten)

Pro Sequenz-Schritt:

1. Todo-Item auf `in_progress` setzen.
2. Sub-Skill via `Skill`-Tool aufrufen:
   - Modul 0: `Skill(skill="aufteiler-modul-0-quickcheck", args="<objekt_slug>")`
   - Modul 1: `Skill(skill="aufteiler-modul-1-objektbasis", args="<objekt_slug>")`
   - Modul 2: `Skill(skill="aufteiler-modul-2-rnd-afa", args="<objekt_slug>")`
   - Modul 3: `Skill(skill="aufteiler-modul-3-massnahmen", args="<objekt_slug>")`
   - Modul 4: `Skill(skill="aufteiler-modul-4-miete", args="<objekt_slug>")`
   - Modul 5: `Skill(skill="aufteiler-modul-5-deal-bewertung", args="<objekt_slug>")`
3. Nach Sub-Skill-Rückkehr: State neu lesen, prüfen ob `objekt.letzter_modul_lauf` korrekt hochgesetzt wurde. Wenn nein → Fehler an User: "Modul N hat State nicht geschrieben."
4. Todo-Item auf `completed` setzen.
5. **Freigabe-Gate** (siehe 5).

## 5. Freigabe-Gate (Pflicht zwischen Modulen)

Nach jedem Modul-Lauf (außer letztem in Sequenz):

> `Modul N abgeschlossen. Weiter zu Modul <N+1>? (go/weiter/ja/ok = weiter, alles andere = Stopp)`

User-Antwort:
- `go`, `weiter`, `ja`, `ok` (case-insensitive Trim) → nächstes Modul laden
- Alles andere → Sequenz stoppen, Übersicht geben: "Stopp. State ist persistiert. Weiter mit `<objekt-slug> weiter` möglich."

**KEIN automatisches Weiterlaufen,** auch nicht bei „Vollanalyse machen".

## 6. Fragen nach Abschluss → Pflicht-Read

Wenn User nach Sequenz-Ende eine Frage stellt („Wie hoch war die Sollmiete für WE 3?"), NIE aus dem Chat antworten. Immer `Read runs/<slug>/state.json` oder `Read runs/<slug>/modul-N-output.md` ausführen und Wert daraus zitieren.

## 7. Was der Orchestrator NICHT macht

- Keine Berechnungen.
- Keine Excel-Befüllung (das macht Modul 5).
- Keine Interpretation von Modul-Outputs.
- Keine Modus-Schätzung bei mehrdeutigem Input.
- Kein Override von Modul-Status (wenn Modul rot meldet, Sequenz stoppt).
