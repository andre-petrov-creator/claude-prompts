# `portals/interhyp/` — Interhyp-Immobilienbewertungs-Adapter

## Zweck

Interhyp liefert für eine Adresse einen **Marktwert** (Untergrenze, Schätzwert,
Obergrenze) plus **EUR/m²** je Ausstattungsklasse (Einfach, Gehoben, Luxus)
plus einen **2-Jahres-Wertentwicklungstrend** im Wertentwicklung-Tab.

Anders als CHECK24 (Pipe-Format, iframe) und Homeday (Deep-Link, kein
Marktwert) hat Interhyp einen **9-Schritt-Wizard**, der vom Adapter komplett
durchgeklickt wird (kein Deep-Link). Output: alle Interhyp-Werte landen im
`RunResult.extra`-Slot (Homeday-Pattern), die Standard-Marktwert-Felder
bleiben `null`.

## Files

- [portals/interhyp/selectors.py](../portals/interhyp/selectors.py) — Konstanten,
  Wizard-Labels, Mapping `ausstattung → Karten-Text`
- [portals/interhyp/parsers.py](../portals/interhyp/parsers.py) — Body-Text-Regex
  + Ampel-Logik
- [portals/interhyp/portal.py](../portals/interhyp/portal.py) — `InterhypPortal`
  (PortalBase-Subklasse), Multi-Strategie-Locators, `fill_form` für alle
  9 Wizard-Steps, `extract_extra` mit Wertentwicklung-Tab-Navigation
- [tests/test_portals_interhyp_parsers.py](../tests/test_portals_interhyp_parsers.py)
  — 18 Parser-Tests
- [tests/test_portals_interhyp_importable.py](../tests/test_portals_interhyp_importable.py)
  — 5 Smoke-Tests

## Architektur-Eigenheiten

### 1. 9-Schritt-Wizard mit Multi-Strategie-Locators

Interhyp nutzt Material-UI-Style-Komponenten (Floating-Labels, Karten-Radios)
plus einen Footer-Bereich „Sind Sie mit dem Rechner zufrieden? Ja/Nein", der
mit Wizard-Karten-Texten kollidieren kann.

Der Adapter probiert pro Element mehrere Selektor-Strategien in fester
Reihenfolge:

**Inputs** (`_fill_input`):
1. `get_by_label(text, exact=True)`
2. `get_by_label(text)` (fuzzy)
3. `get_by_placeholder(text)`
4. `input[aria-label*=...]`

**Klicks** (`_click_text`):
1. `label:has-text("…")`  ← Wizard-Karten haben meist `<label>`-Wrapper
2. `[role="radio"]:has-text("…")`
3. `button:has-text("…")`
4. `get_by_role("radio", name=…)`
5. `get_by_role("button", name=…)`

Wichtig: Label-First-Reihenfolge verhindert, dass der Footer-Button „Ja"
(„Sind Sie zufrieden?") versehentlich getroffen wird, wenn das Wizard
ebenfalls „Ja" als Option hat (Step 7 Sanierung).

**Sanierungs-Klick** (`_click_sanierung_radio`): explizit mit
`:not(:has-text("zufrieden"))` als Schutz vor dem Footer-Button.

### 2. Adress-Autocomplete

Bei Step 2 muss man nach Eingabe der Straße einen Eintrag aus dem
Dropdown anklicken (Enter reicht nicht). Format: `"Prosperstraße, Essen"`
(Straße + Komma + Ort). Adapter probiert exakten Match zuerst, dann
Fallback auf den ersten Vorschlag mit der Straße.

### 3. Step-spezifische Eigenheiten

| Step | Element | Eingabe / Klick |
|---|---|---|
| 1 | Immobilienart | „Eigentumswohnung" (Auto-Advance) |
| 2 | Adresse | PLZ → Ort auto, Straße + Dropdown-Klick, Hausnr |
| 3 | Beweggrund | „Kauf (Kapitalanlage)" (Auto-Advance) |
| 4 | Kaufpreis + Miete | **beide leer lassen** — kein Einfluss auf Wert |
| 5 | Wohnfläche + Zimmer | `avg_wohnflaeche_qm`, `avg_zimmer` |
| 6 | Baujahr | `baujahr` |
| 7 | Sanierung | Ja wenn `sanierungsjahr_letztes ≠ None`, sonst Nein; inline-Jahr |
| 8 | Ausstattung | „Einfach" / „Gehoben" / „Luxus" (Auto-Advance, Mapping aus Datensatz) |
| 9 | Weitere Ausstattung | Parkplatz wenn `hat_garage OR hat_aussenstellplatz`; Submit |

### 4. 2-Jahres-Trend via SVG-Path-Daten (kein %-Wert)

User-Anforderung: **simple Ampel** (steigt/stagniert/fällt) ohne Prozent-Angaben.
Quelle: visuelle Auswertung des Wertentwicklungs-Chart-Verlaufs der letzten 2 Jahre.

Implementierung: nach Klick auf Wertentwicklung-Tab werden die SVG-Path-Daten
(`<path class="highcharts-graph" d="M x y L x y …">`) extrahiert. Algorithmus:

1. Wertentwicklungs-Tab klicken (Multi-Strategie: `[role="tab"]`, `a`, `button`, `label`, `div`)
2. Container des Charts via Anchor-Text "Marktwert YYYY" finden (filtert andere Tabs aus,
   z.B. Preiskarte mit eigenem Chart)
3. Innerhalb des Containers alle `path.highcharts-graph` holen, längsten Pfad nehmen
   (= Berechnete-Immobilie-Linie mit interpolierten Datenpunkten)
4. `parse_svg_path_points` extrahiert (x, y)-Paare aus dem `d`-String
5. `classify_trend_richtung` nimmt die letzten 20 % der Punkte (≈ letzte 2 Jahre bei
   10-J-Default-Zeitraum), vergleicht Y_start mit Y_end gegen 2 % des Gesamt-Y-Range
   (Mindest-Threshold 2 Pixel)
6. SVG-invertiert: Y wird kleiner = Linie geht nach oben = Preis steigt

**Output-Felder** im `extra`-Slot:
- `trend_2j_richtung`: `"steigt"` | `"stagniert"` | `"faellt"` | `None`
- `trend_2j_ampel`: `"gruen"` | `"gelb"` | `"rot"` | `"grau"`
- `trend_2j_ampel_label`: `"steigt"` | `"stagniert"` | `"faellt"` | `"— (keine Daten)"`

Bei Klick-Fehler oder zu wenig Daten: `trend_2j_richtung = None`, Ampel = „grau",
Adapter bleibt funktional.

**Hinweis zur 20-%-Annahme**: Highcharts zeichnet bei einem 10-J-Default-Zeitraum
ungefähr linear interpolierte Monatsdaten. Die letzten 20 % entsprechen ≈ den
letzten 2 Jahren. Wenn der Default-Zeitraum sich ändert (z.B. 5 Jahre statt 10),
wäre die Annahme anders — das ist eine bekannte Heuristik-Limitation, dokumentiert
in `inspectors/probe_interhyp_chart.py`.

### 5. Ausstattung-Mapping

Der `GeneralisierterDatensatz.ausstattung` kann `einfach | normal | gehoben |
luxus` sein. Mapping zu Interhyp-Karten:

| Datensatz | Interhyp |
|---|---|
| `einfach` | Einfach |
| `normal` | **Einfach** (häufigster MFH-Default) |
| `gehoben` | Gehoben |
| `luxus` | Luxus |

Begründung: „normal" im Aufteiler-Standardflow heißt „durchschnittliche
MFH-Wohnung" — bei Interhyp-Klassen ist das „Einfach" (Kunststoffböden,
Einfach-Fenster) am nächsten.

### 6. Schema-Erweiterung: `sanierungsjahr_letztes`

`core/datensatz.py` wurde um ein optionales Feld erweitert:

```python
sanierungsjahr_letztes: Optional[int] = None
```

Logik: Wenn nach Baujahr ein größeres Gewerk (Dach, Heizung, Fassade, Fenster)
erneuert wurde → Jahr des **jüngsten** Gewerks setzen. Sonst `None`.

Beispiel Prosperstr. 59: Baujahr 1965, Dach 2020 → `sanierungsjahr_letztes=2020`.

Andere Adapter (CHECK24, Homeday) ignorieren das Feld.

## Output-Schema (extra-Slot)

```json
{
  "status": "ok",
  "portal": "interhyp",
  "marktwert_eur_min": null,
  "marktwert_eur_mittel": null,
  "marktwert_eur_max": null,
  "trends": {"jahre_3": null, "jahr_1": null, "prognose": null},
  "trend_ampel": null,
  "extra": {
    "marktwert_eur_min": 140000,
    "marktwert_eur_mittel": 162000,
    "marktwert_eur_max": 198000,
    "eur_per_qm": 2025,
    "eur_per_qm_einfach": 2025,
    "eur_per_qm_gehoben": 2150,
    "eur_per_qm_luxus": 2388,
    "marktwert_einfach_eur": 162000,
    "marktwert_gehoben_eur": 172000,
    "marktwert_luxus_eur": 191000,
    "ausstattung_klasse_gewaehlt": "einfach",
    "trend_2j_richtung": "faellt",
    "trend_2j_ampel": "rot",
    "trend_2j_ampel_label": "faellt"
  }
}
```

**Wichtig**: Standard-`marktwert_eur_*`-Felder bleiben `null`. Modul 0 muss
für Interhyp den Wert aus `extra.marktwert_eur_mittel` lesen (analog Homeday,
das `extra.eur_per_qm * wohnflaeche` für Konsens nutzt).

## Ampel-Logik (2-Jahres-Trend, simple Richtung)

| Richtung | Ampel | Label |
|---|---|---|
| `steigt` | grün | „steigt" |
| `stagniert` | gelb | „stagniert" |
| `faellt` | rot | „faellt" |
| `None` | grau | „— (keine Daten)" |

User-Anforderung: simple Ampel ohne Prozent-Angaben — die visuelle Auswertung
des Chart-Verlaufs der letzten 2 Jahre reicht aus.

## CLI-Aufruf

```powershell
.\.venv\Scripts\python.exe m00_portal_pricer.py `
  --portal interhyp `
  --strasse "Prosperstraße" --hausnr 59 --plz 45357 --ort Essen `
  --baujahr 1965 --zustand gut --ausstattung normal `
  --anzahl-we 4 --gesamtwohnflaeche-qm 320 --gesamtzimmer 12 `
  --headless --verbose
```

Hinweis: Standard-CLI hat noch kein `--sanierungsjahr-letztes`-Arg. Bei Bedarf
direkt im Code setzen (oder CLI in einem späteren Step erweitern). Default
ohne Sanierungs-Info: Wizard wählt „Nein".

## Bekannte Stolpersteine

| Issue | Mitigation |
|---|---|
| Footer „Sind Sie zufrieden? Ja/Nein" kollidiert mit Sanierungs-Ja/Nein | `:not(:has-text("zufrieden"))`-Filter in `_click_sanierung_radio` |
| Cookie-Banner kommt mal/nicht (Session-State-abhängig) | `core/cookies.py` mit max_wait_s=12 toleriert das |
| PLZ → Ort auto-Befüllung braucht ~1.5s | `page.wait_for_timeout(1_500)` nach PLZ-Fill |
| Straßen-Autocomplete erfordert Klick, nicht Enter | `_click_strasse_dropdown_item` mit `li:has-text("…")` |
| „Größe des Parkplatzes" wird im Probe-Lauf nicht gefunden (anderes Label?) | Optional — wenn Feld fehlt, geht der Wizard trotzdem weiter |
| Wertentwicklung-Tab + Zeitraum-Dropdown sind Custom-Komponenten | Mehrere Selektor-Strategien; bei Fail → Trend = None |
| Material-UI Floating-Labels (`<label>`, nicht `placeholder`) | `get_by_label` vor `get_by_placeholder` priorisieren |

## Live-Verifikation

**Erwartung (Prosperstraße 59, 45357 Essen, OHNE Sanierungs-Info,
Ausstattung normal → Einfach):** (Stand End-to-End-Lauf 2026-05-15)
- `extra.marktwert_eur_min/mittel/max` = 140.000 / 162.000 / 198.000 €
- `extra.eur_per_qm_einfach` = 2.025 €/m²
- `extra.marktwert_einfach/gehoben/luxus_eur` = 162k / 172k / 191k
- `extra.trend_2j_richtung` = `"faellt"` (Ampel rot)

**Erwartung (gleiche Adresse MIT Sanierungsjahr 2020, im Sparring-Lauf
gesehen):**
- `extra.marktwert_eur_min/mittel/max` = 157.000 / 183.000 / 207.000 €
- `extra.eur_per_qm_einfach` = 2.288 €/m²

**Hinweis**: Trend-Richtung kann sich je nach Eingabe-Daten (mit/ohne
Sanierung) und Marktdynamik unterscheiden. Wert ist die echte
Interhyp-DOM-Antwort, nicht künstliche Annahme.

## Tests

```bash
pytest tests/test_portals_interhyp_*.py -v
```

**39 Tests:**
- 34 Parser-Logik (`test_portals_interhyp_parsers.py`)
  - Marktwert-Min/Mittel/Max (5 Tests, inkl. Live-Layout + partial-Match)
  - EUR/m² je Ausstattungsklasse (3 Tests, inkl. Live-Layout)
  - Marktwert je Ausstattungsklasse (3 Tests, inkl. Live-Layout)
  - Trend-2J% (4 Tests, Legacy für Übergang)
  - Ampel-Logik klassisch (5 Tests: grün, gelb, rot, grau, Threshold)
  - SVG-Path-Parsing (3 Tests: simple/real/invalid)
  - `classify_trend_richtung` (5 Tests: steigt, faellt, stagniert-flat, stagniert-below-threshold, last-fraction-only)
  - `trend_ampel_from_richtung` (4 Tests: steigt/stagniert/faellt/None)
  - 2 weitere Parser-Tests
- 5 Smoke (`test_portals_interhyp_importable.py`)
  - Importierbarkeit + PortalBase-Subklasse
  - Selectors-Konstanten vollständig
  - PORTAL_REGISTRY enthält interhyp
  - `extract_extra` liefert erwartete Keys aus Sample-Body
  - GeneralisierterDatensatz-Feld `sanierungsjahr_letztes` existiert
