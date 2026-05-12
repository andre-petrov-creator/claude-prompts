---
name: aufteiler-modul-2-rnd-afa
description: Modul 2 der Aufteiler-Analyse — Restnutzungsdauer und AfA (ImmoWertV-basiert, mit rnd_frozen-Mechanik). Wird ausschließlich vom aufteiler-Orchestrator aufgerufen.
---

# Modul 2 — Restnutzungsdauer und AfA

Regelbasierte Vorprüfung der RND und des AfA-Korridors nach ImmoWertV 2021 Anlage 2. Hybrid-Architektur: Formel deterministisch im Modul (siehe Sektion 3), Werte (a/b/c, Punkte, Tabellen) aus Notion-Regelwerk. Setzt `rnd_frozen=true` nach Lauf — Modul 3/5 dürfen `rnd_jahre` nicht überschreiben.

Ersetzt KEIN Gutachten und keine sachverständige Einzelfall-Würdigung (BFH IX R 7/23). Steuerberater einbinden vor Kauf-Entscheidung.

## 1. State laden (Pflicht — erste Aktion)

1. Vom Orchestrator bekomme ich `objekt_slug`. Pfad: `runs/<objekt_slug>/state.json`.
2. State einlesen mit `Read`.
3. Pflicht-Vorgänger-Felder prüfen. Wenn etwas fehlt → STOPP, Antwort an Orchestrator:
   `"Modul 2: Pflichtfeld <pfad> fehlt. Bitte Modul 1 erneut laufen lassen."`

**Pflicht-Vorgänger:** `modul_1.we_liste` (mindestens 1 WE).

**Re-Run-Sperre:** Wenn `modul_2.rnd_frozen === true` bereits gesetzt → STOPP: `"Modul 2 wurde bereits gelaufen, RND ist gefroren. Re-Run nur via Orchestrator nach explizitem Reset des modul_2-Blocks (manuell aus state.json entfernen)."`

## 2. Inputs erheben

Per `AskUserQuestion` einzeln:

1. **Baujahr des Gebäudes** — Format: einzelne Zahl, z.B. `1968`. Plausi: zwischen 1850 und aktuelles Jahr.
2. **Modernisierungsstand pro Gewerk** — User liefert pro Gewerk: Sanierungsjahr (oder `keine`/`unbekannt`). Eine Zeile pro Gewerk, Format:
   `<Gewerk>: <Jahr>` oder `<Gewerk>: keine`.
   Gewerk-Liste (8 Stück, aus ImmoWertV Anlage 2 Tab 1):
   - `Dach inkl. Daemmung` (max 4 Punkte)
   - `Fassade / Aussenwaende` (max 4 Punkte)
   - `Fenster / Aussentueren` (max 2 Punkte)
   - `Leitungssysteme (Strangsanierung)` (max 2 Punkte)
   - `Heizungsanlage` (max 2 Punkte)
   - `Baeder` (max 2 Punkte)
   - `Innenausbau (Decken, Boeden, Treppen)` (max 2 Punkte)
   - `Grundrissverbesserung` (max 2 Punkte)
   User darf alle 8 Zeilen auf einmal liefern. **R02 (Hauptregel):** Fehlende Angabe = 0 Punkte = Baujahr-Stand. NIE positiv schätzen.

3. **Aufteiler-Massnahmen 2026 (geplant)** — falls bereits aus Sparring-Phase bekannt, sonst leer lassen (kommt erst in Modul 3 final). Format wie Modernisierungsstand, Jahr = `2026`. Aufteiler-Massnahme 2026 zählt volle Max-Punkte (R: Sanierungsjahr neu, kein Abzug). Bei gleichzeitiger Bestand-Sanierung gewinnt das jüngere Jahr.

## 3. Berechnung / Logik

**3a) Tiefenstufen-Wahl:**

| Stufe | Eingang vorhanden | Output |
|-------|-------------------|--------|
| 1 | Baujahr | Standard-RND nach ImmoWertV Anlage 2 (Basis-Formel) |
| 2 | + Modernisierungsstand pro Gewerk | Mod-Score, Mod-Formel angewendet, AfA-Korridor |
| 3 | + Aufteiler-Massnahmen 2026 + Dach/Heizung/Fenster-Alter detailliert | Post-Sanierungs-AfA, differenzierte Punkte |

**`tiefenstufe` ist im Schema 1–3.** Default-Ziel: Stufe 2.

**3b) Berechnung in fester Reihenfolge — RND-Formel deterministisch im Modul:**

Konstanten (NICHT aus Notion, fest im Modul):

```
GND = 80                         # MFH, ImmoWertV Anlage 1
Mindestquote = 0.30              # 30 % von GND, unterer Plausi-Floor
Maximumquote_normal = 0.70       # 70 % GND, Cap normal
Maximumquote_kernsanierung = 0.90  # 90 % GND, Cap bei Kernsanierung
```

Werte aus Notion-Regelwerk (Page-ID `3360ae59-38e4-81a6-a632-f0715b46ead4`, falls über MCP erreichbar; sonst Fallback-Default-Tabelle siehe unten):

| Punkte (Mod-Score) | a | b | c | Schwellen-% | Modernisierungsgrad |
|--------------------|------|-------|--------|-------------|--------------------|
| 0–1 | 1.00 | 0.00 | 0.00 | — | nicht modernisiert (Basis-Formel) |
| 2–5 | 0.96 | 0.59 | 0.49 | 30 % | kleine Modernisierungen |
| 6–10 | 0.92 | 1.10 | 0.85 | 35 % | mittlerer Grad |
| 11–17 | 0.73 | 1.577 | 1.1133 | 40 % | überwiegend modernisiert |
| 18–20 | 0.20 | 0.44 | 0.942 | 10 % | umfassend / kernsanierungsnah |

(Diese Default-Tabelle ist die im alten XML dokumentierte ImmoWertV-Standardform aus Modul 3 v1.1. Wenn Notion-MCP verfügbar: dort lookup, sonst diese Defaults verwenden + Hinweis in Zone C.)

**Schritt 1 — Mod-Score (Punkte) berechnen:**

Pro Gewerk:
```
if aufteiler_2026 für gewerk vorhanden:
    punkte_gewerk = max_punkte_gewerk        # volle Punkte (Sanierungsjahr 2026)
elif bestand_jahr vorhanden:
    alter_massnahme = 2026 − bestand_jahr
    if alter_massnahme <= 15:
        punkte_gewerk = max_punkte_gewerk
    elif alter_massnahme <= 25:
        punkte_gewerk = max_punkte_gewerk / 2     # R03
    else:
        punkte_gewerk = 0                          # R04
else:
    punkte_gewerk = 0                              # R02: fehlt = 0
```

```
mod_score = Σ punkte_gewerk  # 0..20
```

**Schritt 2 — Modernisierungsgrad + Variablen-Lookup:**

`(a, b, c, schwellen_prozent)` per `mod_score` aus Tabelle oben.

**Schritt 3 — Basis-Werte:**

```
alter = 2026 − baujahr
basis_rnd = max(0, GND − alter)
mindestalter = (schwellen_prozent / 100) × GND
```

**Schritt 4 — R05-Prüfung (Modernisierungseffekt nur ab Mindestalter):**

```
if alter <= mindestalter or mod_score <= 1:
    rnd_jahre = basis_rnd               # Basis-Formel
    rnd_basis = "Basis-Formel (R05 oder Punkte ≤ 1)"
else:
    # Modernisierungs-Formel (Schritt 5)
```

**Schritt 5 — Modernisierungs-Formel (nur wenn R05 nicht greift):**

```
x = (alter − mindestalter) / (GND − mindestalter)
F_x = 1 − a × x³ + b × x² − c × x
rnd_roh = GND × F_x
```

**Schritt 6 — Caps:**

```
ist_kernsanierung = (mod_score >= 18)   # nur Aufteiler-Skill-internes Flag, nicht in modul_2-State
max_cap = GND × Maximumquote_kernsanierung if ist_kernsanierung else GND × Maximumquote_normal
min_floor = GND × Mindestquote

rnd_jahre = max(min_floor, min(rnd_roh, max_cap))
rnd_basis = "Modernisierungs-Formel (Mod-Score {mod_score}, F(x)={F_x:.3f})"
```

**Schritt 7 — AfA-Korridor + Empfehlung:**

```
afa_oben = 100 / rnd_jahre              # kürzere RND = höherer AfA
afa_unten = 100 / (rnd_jahre × 1.10)    # Sachverständigen-Spielraum +10 %
afa_empfehlung = (afa_oben + afa_unten) / 2

afa_korridor_prozent = { "min": round(afa_unten, 2), "max": round(afa_oben, 2) }
afa_empfehlung_prozent = round(afa_empfehlung, 2)
```

**Schritt 8 — Status-Ableitung:**

- `afa_empfehlung_prozent >= 3.0` → `status = "gruen"` (starker Hebel, Gutachten lohnt)
- `2.0 <= afa_empfehlung_prozent < 3.0` → `status = "gelb"` (Standard, Gutachten prüfen)
- `afa_empfehlung_prozent < 2.0` → `status = "gelb"` (Standard 2 % reicht, kein Hebel)
- Wenn `rnd_jahre < 20` oder `rnd_jahre > 80` → `status = "rot"` (außerhalb Plausi-Grenzen, Schema lehnt ab)

**3c) Plausibilitäts-Prüfung:**

- `baujahr` zwischen 1850 und 2030 (Schema).
- `rnd_jahre` zwischen 20 und 80 (Schema-Grenze). Wenn raus → Status rot, kein Schreiben.
- `afa_empfehlung_prozent` zwischen 0 und 10 (Schema).
- `mod_score` zwischen 0 und 100 (Schema; effektiv 0–20).
- Selbstvalidierungs-Test (im Modul-Output dokumentieren): Wenn `mod_score == 0`, MUSS `rnd_jahre == basis_rnd == GND − alter`. Bei Abweichung → Bug, Status rot.

## 4. Output erzeugen (Drei Zonen)

**Zone A — Daten-Block (pixel-identisch über alle Objekte):**

Block 1 — Gewerk-Punkte:
```
| Gewerk                            | Max | Bestand-Jahr | Aufteiler-2026 | Punkte | Begründung |
|-----------------------------------|-----|--------------|----------------|--------|------------|
| Dach inkl. Daemmung               | 4   | <Jahr/—>     | ja/nein        | <P>    | R03/R04/R02/aufteiler-2026 |
| Fassade / Aussenwaende            | 4   | …            | …              | …      | … |
| Fenster / Aussentueren            | 2   | …            | …              | …      | … |
| Leitungssysteme (Strangsanierung) | 2   | …            | …              | …      | … |
| Heizungsanlage                    | 2   | …            | …              | …      | … |
| Baeder                            | 2   | …            | …              | …      | … |
| Innenausbau                       | 2   | …            | …              | …      | … |
| Grundrissverbesserung             | 2   | …            | …              | …      | … |
| Gesamt                            | 20  |              |                | <M>    |   |
```

Block 2 — AfA-Korridor:
```
| Parameter                            | Wert                                  |
|--------------------------------------|---------------------------------------|
| GND Gebäude (MFH)                    | 80 Jahre                              |
| Baujahr                              | <Jahr>                                |
| Alter (2026)                         | <Alter> Jahre                         |
| Modernisierungspunkte (mod_score)    | <M> von 20                            |
| Modernisierungsgrad                  | <Bezeichnung>                         |
| Variablen (a, b, c, Schwelle)        | a=<a>, b=<b>, c=<c>, Schwelle=<S>%    |
| Mindestalter (R05)                   | <X> Jahre                             |
| R05-Status                           | Formel greift / Basis-Formel          |
| Relatives Alter x                    | <x>                                   |
| F(x)                                 | <F_x>                                 |
| Basis-RND                            | <Basis> Jahre                         |
| RND_jahre (final, gefroren)          | <RND> Jahre                           |
| AfA-Korridor                         | <unten> % bis <oben> %                |
| AfA-Empfehlung (Mitte)               | <empf> %                              |
```

**Zone B — Tiefenstufen-Deklaration (genau zwei Zeilen):**

```
Tiefenstufe: <N> von 3 (<Begründung wenn nicht 3>)
Konfidenz: <hoch|mittel|niedrig>
```

**Zone C — Begründungs-Block:**

1. **Wichtigste Annahmen** (max 5 Bullets) — z.B. „GND 80 J für MFH (ImmoWertV Anlage 1)", „Variablen-Tabelle aus ImmoWertV Anlage 2 Tab 3 (Default, Notion-Lookup nicht durchgeführt)".
2. **Risiken / Unsicherheiten** (max 5 Bullets) — z.B. „Heizung-Sanierungsjahr unbekannt → 0 Punkte (R02)", „Aufteiler-Massnahmen 2026 noch nicht final aus Modul 3, Punkte können steigen".
3. **Empfehlung** (1–3 Sätze) — z.B. „AfA 3,1 % rechtfertigt Gutachten (~2.000 €) für Käufer. Standard 2 % reicht nicht. Steuerberater vor Kauf einbinden."

**BFH-Pflichthinweis (immer in Zone C am Ende anhängen, byte-identisch):**

```
WICHTIG: Diese Berechnung ist eine regelbasierte Vorprüfung nach ImmoWertV 2021 Anlage 2.
Sie ersetzt KEIN Gutachten eines öffentlich bestellten Sachverständigen
(BFH IX R 7/23). Steuerberater vor Kauf einbinden.
```

## 5. State persistieren

1. `modul_2`-Block bauen:
   ```json
   {
     "status": "<gruen|gelb|rot>",
     "tiefenstufe": <int 1-3>,
     "konfidenz": "<hoch|mittel|niedrig>",
     "baujahr": <int>,
     "rnd_jahre": <int 20-80>,
     "rnd_frozen": true,
     "rnd_basis": "<Erläuterung Basis/Formel + F(x)>",
     "mod_score": <number 0-100>,
     "afa_korridor_prozent": { "min": <number>, "max": <number> },
     "afa_empfehlung_prozent": <number>,
     "begruendung": "<Kurzfassung Zone C Annahmen+Empfehlung>"
   }
   ```
2. **`rnd_frozen` MUSS auf `true` gesetzt sein** (Schema-Constraint, sonst Validator-Fail).
3. `objekt.letzter_modul_lauf` auf `"modul_2"` setzen.
4. State schreiben.
5. `runs/<slug>/modul-2-output.md` mit Zonen A/B/C schreiben.
6. Validator-Lauf: `python tools/validate_state.py runs/<slug>/state.json`. Exit 0 = OK; ≠0 → state.json zurückrollen, Fehlertext.

## 6. Self-Check (Pflicht vor Übergabe)

- [ ] Alle Pflichtfelder befüllt (status, tiefenstufe, konfidenz, baujahr, rnd_jahre, rnd_frozen, rnd_basis, mod_score, afa_korridor_prozent, afa_empfehlung_prozent, begruendung)
- [ ] `rnd_frozen === true`
- [ ] `rnd_jahre` zwischen 20 und 80
- [ ] `afa_empfehlung_prozent` zwischen 0 und 10
- [ ] `afa_korridor_prozent.min <= afa_korridor_prozent.max`
- [ ] Selbstvalidierung: bei `mod_score <= 1` ist `rnd_jahre == max(0, 80 − alter)` (Basis-Formel)
- [ ] BFH-Pflichthinweis in `modul-2-output.md` enthalten
- [ ] Excel-Transfer-Block (KALKU!C26..C28) ausgefüllt
- [ ] Validator-CLI exit 0

Bei rot → kein state.json-Schreiben, an Orchestrator zurück mit Fehlertext.

## 7. Übergabe an Orchestrator

Eine Zeile:
```
Modul 2 grün. RND <X> Jahre (gefroren), AfA-Empfehlung <Y> %. Werte in runs/<slug>/state.json, Audit in runs/<slug>/modul-2-output.md. Freigabe für Modul 3?
```
