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

### 4. Wertentwicklung-Tab für Trend-%

Der Trend ist **nicht** auf dem Zusammenfassung-Tab — `extract_extra` klickt
nach dem Marktwert-Parse erst auf **Wertentwicklung**, dann **best-effort**
auf Zeitraum-Dropdown → „2 Jahre", liest dann den Body und parst „+X %" aus
der „Wertentwicklung"-Kachel.

**Bekannte Limitation:** Der Zeitraum-Dropdown ist ein Material-UI-Custom-Element
ohne stabilen Selektor — der Dropdown-Klick greift aktuell nicht zuverlässig.
**Folge: der gemeldete Trend-% bezieht sich auf den Default-Zeitraum (typ. 10 Jahre),
nicht auf 2 Jahre.** Felder im `extra`-Slot sind entsprechend benannt:
`wertentwicklung_pct`, `wertentwicklung_zeitraum: "default (typ. 10 Jahre)"`,
`wertentwicklung_ampel`, `wertentwicklung_ampel_label`.

Modul 0 kann das bei Aggregation berücksichtigen (10-J-Trend ist weniger
preisrelevant als 2-J-Trend für aktuelle Marktbewertung).

Bei Klick-Fehler (Tab nicht gefunden) bleibt `wertentwicklung_pct = None`
und die Ampel = „grau" — der Adapter ist immer noch funktional.

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
    "wertentwicklung_pct": 76.1,
    "wertentwicklung_zeitraum": "default (typ. 10 Jahre)",
    "wertentwicklung_ampel": "gruen",
    "wertentwicklung_ampel_label": "steigend (+76.1%)"
  }
}
```

**Wichtig**: Standard-`marktwert_eur_*`-Felder bleiben `null`. Modul 0 muss
für Interhyp den Wert aus `extra.marktwert_eur_mittel` lesen (analog Homeday,
das `extra.eur_per_qm * wohnflaeche` für Konsens nutzt).

## Ampel-Logik (2-Jahres-Trend)

| Bedingung | Ampel | Label |
|---|---|---|
| `> +1 %` | grün | „steigend (+x.x%)" |
| `\|x\| ≤ 1 %` | gelb | „stagnierend (±x.x%)" |
| `< -1 %` | rot | „fallend (-x.x%)" |
| `None` | grau | „— (keine Daten)" |

Identische Schwellen wie Homeday — Konsistenz für Modul-5-PDF-Ampel-Anzeige.

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

**Erwartung (Prosperstraße 59, 45357 Essen, Sanierungsjahr 2020,
Ausstattung Einfach):**
- `extra.marktwert_eur_mittel` ≈ 180.000 — 190.000 €
- `extra.marktwert_eur_min` ≈ 155.000 — 165.000 €
- `extra.marktwert_eur_max` ≈ 200.000 — 215.000 €
- `extra.eur_per_qm_einfach` ≈ 2.250 — 2.350 €/m²
- `extra.trend_2j_ampel` = `"gruen"` (Ruhrgebiet-Markt steigt seit 2024
  wieder)

**Hinweis**: Live-Verifikation muss vom User ausgeführt werden — der
Sparring-Lauf (2026-05-15) hat den Wizard live durchgeklickt und die
Ergebnisseite verifiziert, aber kein End-to-End-CLI-Lauf mit dem fertigen
Adapter.

## Tests

```bash
pytest tests/test_portals_interhyp_*.py -v
```

**23 Tests:**
- 18 Parser-Logik (`test_portals_interhyp_parsers.py`)
  - Marktwert-Min/Mittel/Max (4 Tests, inkl. partial-Match)
  - EUR/m² je Ausstattungsklasse (3 Tests)
  - Marktwert je Ausstattungsklasse (2 Tests)
  - Trend-2J% (4 Tests: positiv, negativ, Komma, fehlend)
  - Ampel-Logik (5 Tests: grün, gelb, rot, grau, Threshold)
- 5 Smoke (`test_portals_interhyp_importable.py`)
  - Importierbarkeit + PortalBase-Subklasse
  - Selectors-Konstanten vollständig
  - PORTAL_REGISTRY enthält interhyp
  - `extract_extra` liefert erwartete Keys aus Sample-Body
  - GeneralisierterDatensatz-Feld `sanierungsjahr_letztes` existiert
