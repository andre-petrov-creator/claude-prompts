# State-Schema (`runs/<slug>/state.json`)

**Schema-Version:** 1.0
**Validator-Datei:** `docs/state.schema.json` (JSON Schema Draft 2020-12)
**Validator-CLI:** `python tools/validate_state.py runs/<slug>/state.json`

Pro Objekt eine `state.json` unter `runs/<slug>/`. Jedes Modul liest die Vorgänger-Felder und schreibt seinen eigenen Block. Asset-Trennung und RND-Freeze sind im Schema verankert.

---

## Top-Level

| Feld | Typ | Pflicht | Bedeutung |
|------|-----|---------|-----------|
| `schema_version` | string | ✓ | aktuell `"1.0"` |
| `objekt` | object | ✓ | Stammdaten |
| `modul_0` … `modul_5` | object | optional | je gefülltes Modul |

## `objekt`

| Feld | Typ | Pflicht | Bedeutung |
|------|-----|---------|-----------|
| `slug` | string (kebab-case) | ✓ | aus Adresse erzeugt |
| `adresse` | string | ✓ | Vollständig |
| `stadt` | string | ✓ |  |
| `stadtteil` | string | – | optional |
| `bundesland` | string | ✓ | z.B. `"NRW"` |
| `erstellt_am` | string (ISO 8601 Datum) | ✓ |  |
| `letzter_modul_lauf` | string | ✓ | z.B. `"modul_2"` |

## `modul_0` (Quick-Check)

| Feld | Typ | Pflicht | Bedeutung |
|------|-----|---------|-----------|
| `status` | enum: `gruen`/`gelb`/`rot` | ✓ |  |
| `tiefenstufe` | int 1–5 | ✓ |  |
| `konfidenz` | enum: `hoch`/`mittel`/`niedrig` | ✓ |  |
| `ausgefuehrt_am` | string ISO | ✓ |  |
| `angebotspreis_eur` | number ≥ 0 | ✓ |  |
| `etw_konsens_eur` | number ≥ 0 | ✓ | ETW-Konsens (Marktwert pro WE × Anzahl) |
| `gap_prozent` | number | ✓ | `(angebot − konsens) / konsens × 100` |
| `ueber_schwelle` | bool | ✓ | `gap_prozent > 5` |

## `modul_1` (Objektbasis)

| Feld | Typ | Pflicht |
|------|-----|---------|
| `status` | enum | ✓ |
| `tiefenstufe` | int 1–5 | ✓ |
| `tiefenstufe_max` | int 1–5 | ✓ |
| `konfidenz` | enum | ✓ |
| `brw_eur_pro_qm` | number > 0 | ✓ |
| `gebaeude_anteil_prozent` | number 0–100 | ✓ |
| `we_liste` | array of `we_eintrag` | ✓, min 1 |

`we_eintrag`:
- `we_nr` (int ≥ 1), `lage_im_haus` (string: `EG`/`OG_links`/`OG_rechts`/`DG_links`/`DG_rechts`/…),
- `wohnflaeche_qm` (number 10–250), `zimmer_anzahl` (number 1–8),
- `balkon` (bool), `keller` (bool).

## `modul_2` (RND und AfA)

| Feld | Typ | Pflicht |
|------|-----|---------|
| `status` | enum | ✓ |
| `tiefenstufe` | int 1–3 | ✓ |
| `konfidenz` | enum | ✓ |
| `baujahr` | int 1850–<aktuelles Jahr> | ✓ |
| `rnd_jahre` | int 20–80 | ✓ |
| `rnd_frozen` | bool, immer `true` nach M2-Lauf | ✓ |
| `rnd_basis` | string (Erläuterung) | ✓ |
| `mod_score` | number 0–100 | ✓ |
| `afa_korridor_prozent` | object `{min, max}` (z.B. `{2.0, 3.5}`) | ✓ |
| `afa_empfehlung_prozent` | number | ✓ |
| `begruendung` | string | ✓ |

**Freeze-Regel:** Sobald `rnd_frozen=true`, weisen Modul 3/5 Schreibversuche auf `modul_2.rnd_jahre` zurück (durch Validator + Modul-Check).

## `modul_3` (Massnahmen)

| Feld | Typ | Pflicht |
|------|-----|---------|
| `status` | enum | ✓ |
| `tiefenstufe` | int 1–5 | ✓ |
| `konfidenz` | enum | ✓ |
| `ist_kernsanierung` | bool | ✓ |
| `massnahmen_liste` | array of `massnahme` | ✓ |
| `rnd_gutachten_netto_eur` | number ≥ 0 | ✓ | Pflicht-Position, default `1000 × anzahl_we` |
| `weg_teilung_netto_eur` | number ≥ 0 | ✓ |
| `enev_klasse` | string (`A+` … `H` oder `unbekannt`) | ✓ |
| `summen` | object | ✓ |

`massnahme`:
- `kategorie` (enum: `Dach`/`Fassade`/`Fenster`/`Heizung`/`Elektrik`/`Sanitaer`/`Boeden`/`Grundriss`/`Sonstiges`),
- `ist_zustand` (string), `geplant` (string), `kosten_netto_eur` (number ≥ 0).

`summen`:
- `modernisierung_netto_eur`, `modernisierung_brutto_eur`,
- `nebenkosten_netto_eur`, `nebenkosten_brutto_eur` — alle `number ≥ 0`.

**Asset-Trennung:** Kein Eintrag in `massnahmen_liste` darf in `kategorie` oder `geplant` die Wörter `subvention` oder `rücklage`/`ruecklage` enthalten (Self-Check in M3).

## `modul_4` (Miete)

| Feld | Typ | Pflicht |
|------|-----|---------|
| `status` | enum | ✓ |
| `tiefenstufe` | int 1–6 | ✓ |
| `tiefenstufe_max` | int 1–6 | ✓ |
| `konfidenz` | enum | ✓ |
| `we_mieten` | array of `we_miete` (1 pro WE) | ✓ |
| `mietsubventionen_summe_eur_pro_monat` | number ≥ 0 | ✓ |
| `begruendung_je_we` | object (`we_nr` → string) | ✓ |

`we_miete`:
- `we_nr` (int), `ist_miete_eur_pro_qm` (number ≥ 0), `sollmiete_eur_pro_qm` (number ≥ 0),
- `mietspiegel_obergrenze_eur_pro_qm` (number ≥ 0),
- `paragraph_558_heberecht_eur` (number ≥ 0),
- `mietsubvention_eur_pro_monat` (number ≥ 0).

## `modul_5` (Deal-Bewertung)

| Feld | Typ | Pflicht |
|------|-----|---------|
| `status` | enum | ✓ |
| `bewertungs_score` | number 0–100 | ✓ |
| `pdf_pfad` | string (Pfad relativ zu `runs/<slug>/`) | ✓ |
| `excel_pfad` | string | ✓ |

---

## Plausibilitäts-Grenzen (Validator-Constraints)

Werden im JSON-Schema als `minimum`/`maximum`/`enum` durchgesetzt. Wenn Modul-Berechnung außerhalb landet → Status `rot`, kein Schreiben.
