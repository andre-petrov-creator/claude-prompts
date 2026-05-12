# Template — Modul-Skill

Vorlage für `skills/aufteiler-modul-N-<thema>/SKILL.md`. Sektionen 1, 5, 6, 7 sind **byte-identisch** über alle Module (außer Modul-Nummer/Felder). Sektionen 2, 3, 4 sind modul-spezifisch.

````markdown
---
name: aufteiler-modul-N-<thema>
description: <Ein Satz: Was macht das Modul, wann wird es aufgerufen, wer ruft auf>
---

# Modul N — <Name>

## 1. State laden (Pflicht — erste Aktion)

1. Vom Orchestrator bekomme ich `objekt_slug`. Pfad: `runs/<objekt_slug>/state.json`.
2. State einlesen mit `Read`.
3. Pflicht-Vorgänger-Felder prüfen (siehe Tabelle unten). Wenn etwas fehlt → STOPP, Antwort an Orchestrator:
   `"Modul N: Pflichtfeld <pfad> fehlt. Bitte Modul <M> erneut laufen lassen."`

**Pflicht-Vorgänger pro Modul:**
- Modul 0: keine
- Modul 1: `modul_0.status`
- Modul 2: `modul_1.we_liste`
- Modul 3: `modul_1.we_liste`, `modul_2.rnd_jahre`, `modul_2.rnd_frozen=true`
- Modul 4: `modul_1.we_liste`
- Modul 5: `modul_0` … `modul_4` alle gesetzt

## 2. Inputs erheben

Modul-spezifisch. Regeln:
- Eine User-Frage pro `AskUserQuestion`-Aufruf (keine Multi-Inputs).
- Notion-DB-Lookups (Mietspiegel, BRW, ImmoWertV) hier.
- Externe Quellen (BORIS.NRW): User-Hand-Eingabe abfragen.

## 3. Berechnung / Logik

**3a) Tiefenstufen-Wahl:** Eingangs-Check → höchste vollständig erreichbare Stufe wählen (siehe Tabelle im Modul).
**3b) Berechnung** in fester Reihenfolge ausführen. Keine Improvisation.
**3c) Plausibilitäts-Prüfung** vor State-Write.

## 4. Output erzeugen (Drei Zonen)

**Zone A — Daten-Block (pixel-identisch über alle Objekte):**
- Tabellen mit fixen Spalten und Reihenfolge (siehe Modul-spezifischen Block unten).
- Nicht-ermittelbare Werte: `"n/a"`, nicht weglassen.

**Zone B — Tiefenstufen-Deklaration (genau zwei Zeilen, byte-identisches Format):**
```
Tiefenstufe: <N> von <MAX> (<Begründung wenn nicht max>)
Konfidenz: <hoch|mittel|niedrig>
```

**Zone C — Begründungs-Block (Struktur fix, Formulierung frei):**
1. **Wichtigste Annahmen** (Bullet-Liste, max 5)
2. **Risiken / Unsicherheiten** (Bullet-Liste, max 5)
3. **Empfehlung** (1–3 Sätze)

## 5. State persistieren

1. `modul_N`-Block bauen (siehe Schema in `docs/state-schema.md`).
2. State validieren: `python tools/validate_state.py runs/<slug>/state.json` als Trockenlauf (auf einer temporären Kopie). Wenn rot → kein Schreiben, an Orchestrator zurück.
3. `state.json` schreiben (komplettes Objekt, nicht patchen).
4. `runs/<slug>/modul-N-output.md` schreiben (Zone A/B/C als lesbarer Audit-Trail).
5. `objekt.letzter_modul_lauf` auf `modul_N` setzen.

## 6. Self-Check (Pflicht vor Übergabe)

- [ ] Alle Pflichtfelder im Schema befüllt
- [ ] Werte in Plausibilitätsgrenzen (siehe Modul-spezifische Grenzen)
- [ ] Asset-Trennung eingehalten (für M3: keine `subvention`/`rücklage` in `massnahmen_liste`)
- [ ] Excel-Transfer-Block vollständig (für Module die in Excel schreiben — siehe `docs/excel_handoff.md`)
- [ ] `modul-N-output.md` erzeugt
- [ ] Validator-CLI exit 0

Bei rot → kein state.json-Schreiben, an Orchestrator zurück mit Fehlertext.

## 7. Übergabe an Orchestrator

Eine Zeile:
```
Modul N grün. Werte in runs/<slug>/state.json, Audit in runs/<slug>/modul-N-output.md. Freigabe für Modul <N+1>?
```
````
