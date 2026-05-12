---
name: aufteiler-modul-5-deal-bewertung
description: Modul 5 der Aufteiler-Analyse — Deal-Bewertung mit PDF-Export und Excel-Befüllung. Konsumiert State aus Modul 0–4. Wird ausschließlich vom aufteiler-Orchestrator aufgerufen.
---

# Modul 5 — Deal-Bewertung

Aggregations- und Export-Modul. Konsumiert `modul_0` … `modul_4` aus `runs/<slug>/state.json`, rechnet **nichts** selbst neu (außer Platzhalter-Score), erzeugt PDF + befüllt Excel-Template. **Nie automatisch in Vollanalyse-Sequenz** — nur bei expliziter User-Anfrage.

Score-Logik ist **Platzhalter** — wird durch echte Methodik ersetzt sobald sie aus dem parallelen Optimierungs-Prozess kommt. State-Feld `modul_5.bewertungs_score` bleibt stabil, nur die Befüllungs-Logik wird getauscht (siehe `plans/2026-05-12-score-logik-modul-5-offen.md`).

## 1. State laden (Pflicht — erste Aktion)

1. Vom Orchestrator bekomme ich `objekt_slug`. Pfad: `runs/<objekt_slug>/state.json`.
2. State einlesen mit `Read`.
3. Pflicht-Vorgänger-Felder prüfen. Wenn etwas fehlt → STOPP, Antwort an Orchestrator:
   `"Modul 5: Pflichtfeld <pfad> fehlt. Bitte Modul <M> erneut laufen lassen."`

**Pflicht-Vorgänger:** alle Module 0–4 mit `status` gesetzt:
- `modul_0.status`
- `modul_1.status` + `modul_1.we_liste`
- `modul_2.status` + `modul_2.rnd_jahre` + `modul_2.rnd_frozen=true`
- `modul_3.status` + `modul_3.summen`
- `modul_4.status` + `modul_4.we_mieten`

Wenn eines fehlt: STOPP, exakte Fehlermeldung an Orchestrator (welches Modul nachholen).

## 2. Inputs erheben

**Keine User-Inputs.** Modul 5 konsumiert ausschließlich `state.json` und das Excel-Template.

Optional (falls nicht im State, dann User-Frage einmalig):
- **Bewirtschaftungs-Quote in %** für Sektion 8.5 PDF (Default 20 % von Soll-Kalt p.a., wenn nicht abgefragt).
- **Bestand-Heizungs-Rücklage** € (Default 0, wenn unbekannt).
- **Stichtags-Jahr für Heizungs-Pflichttausch** (Default `baujahr_heizung + 30`, sonst `2032` als Konvention).

Bei Default-Verwendung: in Zone C unter „Annahmen" notieren, dass User-Werte ausstehen.

## 3. Berechnung / Logik

**3a) Platzhalter-Score (Ampel-Aggregation aus Modul-Status + Konfidenz):**

```python
base_score = 70
for m in [modul_0, modul_1, modul_2, modul_3, modul_4]:
    if m["status"] == "rot":
        base_score -= 10
    elif m["status"] == "gelb":
        base_score -= 5
    konf = m.get("konfidenz", "mittel")
    if konf == "niedrig":
        base_score -= 5
    elif konf == "mittel":
        base_score -= 2
bewertungs_score = max(0, min(100, base_score))
```

**Hinweis im Skill-Output (Zone C Pflicht):**
```
HINWEIS: Diese Score-Logik ist ein PLATZHALTER. Echte Score-Methodik
folgt — siehe plans/2026-05-12-score-logik-modul-5-offen.md. Nur die
Befüllung wird ausgetauscht; State-Feld modul_5.bewertungs_score bleibt.
```

**3b) PDF generieren:**

Vor Build: PDF-Layout-Regeln aus Skill `aufteiler-pdf-export` laden und R1–R13 anwenden. Form-Skill liefert reportlab-Code-Bausteine, Modul 5 nutzt sie direkt.

PDF-Struktur (Reihenfolge wie alt `archive/modul_5_verdict.xml`):

- **Cover**: Headline „Analyse zur Aufteiler-Kalkulation <Straße>", Stammdaten, Hebel-Kaskade-Chart, GO/GRENZ/STOP-Verdict-Box (abgeleitet aus `bewertungs_score`)
- **Sektion 1** Stammdaten (aus `modul_1`)
- **Sektion 2** Bodenrichtwert (aus `modul_1.brw_eur_pro_qm`)
- **Sektion 3** Gebäudewert (aus `modul_1.gebaeude_anteil_prozent`) + Donut-Chart
- **Sektion 4** WE-Liste + IST-vs-SOLL-Chart (aus `modul_1.we_liste` + `modul_4.we_mieten`)
- **Sektion 5.1** Modernisierungsstand (aus `modul_2.begruendung` + `modul_3.massnahmen_liste`)
- **Sektion 5.2** Energieeffizienz (aus `modul_3.enev_klasse`)
- **Sektion 5.3** Massnahmen 2026 + GIK-Donut (aus `modul_3.summen`)
- **Sektion 6** RND + AfA-Gauge (aus `modul_2.afa_korridor_prozent`)
- **Sektion 7.1** Mietspiegel-Berechnung pro WE (aus `modul_4.we_mieten`)
- **Sektion 7.2** M6-Mittelwert + Markt-Validation
- **Sektion 8.1–8.4** Mietsubvention pro WE Stufentabellen + Aggregat-Treppe (aus `modul_4.mietsubventionen_summe_eur_pro_monat`)
- **Sektion 8.5** Bewirtschaftungs-Einschätzung + Rücklagen-Entwicklung + Profil für Anzeige (optional, basiert auf Bewirtschaftungs-Quote)
- **Sektion 9** Risiko-Heatmap + Risiko-Tabelle (10 Standard-Risiken aus altem XML, parametrisiert)
- **Sektion 10.1** Verdict-Box (aus `bewertungs_score`) + Marge-Sensitivitäts-Chart
- **Sektion 10.2** Pflicht-Schritte-Checkliste vor Notartermin (2 Always-Pflicht-Items aus altem XML: BORIS-Verifikation, Mietspiegel-Wohnlage)
- **Sektion 11** Anhang: Quellen + BFH-Pflichthinweis + MPB-Hinweis + Disclaimer

PDF-Pfad: `runs/<slug>/Aufteiler_<Straßenkurz>_<YYYY-MM-DD>.pdf` (Straßenkurz = Slug-Teil bis erster Bindestrich-Block, z.B. `Prosperstr-59`).

PDF-Build via `python -c` oder `python skripts/build_pdf_modul5.py runs/<slug>/state.json` (Skript optional, falls Skill-Inline-Build unhandlich wird; in Phase 4 zunächst inline).

**3c) Excel-Befüllung:**

Excel-Template `template/Kalkulation_Aufteiler_mit_VK_CF.xlsx` (Binary) wird zu `runs/<slug>/Kalkulation_<Straßenkurz>.xlsx` kopiert. Werte aus `state.json` werden via **openpyxl** gemäß `docs/excel_handoff.md` in die Zellen geschrieben:

```python
from openpyxl import load_workbook
import shutil, json
from pathlib import Path

state = json.load(open(state_path, encoding="utf-8"))
slug = state["objekt"]["slug"]
strasse_kurz = "-".join(slug.split("-")[:2])   # z.B. "prosperstr-59"

src = Path("template/Kalkulation_Aufteiler_mit_VK_CF.xlsx")
dst = Path(f"runs/{slug}/Kalkulation_{strasse_kurz}.xlsx")
shutil.copyfile(src, dst)

wb = load_workbook(dst)

# Modul 1 -> MIETER A8:I<7+N> + KALKU C20, C23
mieter = wb["MIETER"]
for i, we in enumerate(state["modul_1"]["we_liste"]):
    row = 8 + i
    mieter[f"A{row}"] = we["we_nr"]
    mieter[f"B{row}"] = we["lage_im_haus"]
    mieter[f"F{row}"] = we["wohnflaeche_qm"]
    mieter[f"G{row}"] = we["zimmer_anzahl"]
    mieter[f"H{row}"] = "ja" if we["balkon"] else "nein"
    mieter[f"I{row}"] = "ja" if we["keller"] else "nein"

kalku = wb["KALKU"]
kalku["C20"] = state["modul_1"]["brw_eur_pro_qm"]
kalku["C23"] = state["modul_1"]["gebaeude_anteil_prozent"]

# Modul 2 -> KALKU C26, C27, C28
kalku["C26"] = state["modul_2"]["afa_empfehlung_prozent"]
kalku["C27"] = state["modul_2"]["mod_score"]
kalku["C28"] = state["modul_2"]["rnd_jahre"]

# Modul 4 -> MIETER M6, P6, Y8:Y<7+N> + RENO!K105
mieter["M6"] = sum(w["sollmiete_eur_pro_qm"] * we["wohnflaeche_qm"]
                    for w, we in zip(state["modul_4"]["we_mieten"], state["modul_1"]["we_liste"])) \
                / sum(we["wohnflaeche_qm"] for we in state["modul_1"]["we_liste"])
mieter["P6"] = 0.15   # NRW-Default Kappungsgrenze
for i, we in enumerate(state["modul_4"]["we_mieten"]):
    mieter[f"Y{8+i}"] = we["mietspiegel_obergrenze_eur_pro_qm"]

reno = wb["RENO"]
reno["K105"] = state["modul_4"]["mietsubventionen_summe_eur_pro_monat"]
# Hinweis: K105 erwartet Pauschalpreis (siehe Modul 4 alt-XML); je nach Excel-Sheet evtl. ×12.

# Modul 3 -> RENO Blöcke (Block-Adressen aus Excel-Template noch finalisieren)
# Siehe docs/excel_handoff.md — TODO bis Brutto/Netto-Verifikation steht

wb.save(dst)
```

**Excel-Comments** (Notiz-Zellen, KEINE Werte überschreiben):

- `BESICHTIGUNG!A40` — 5-Zeilen-Verdict + Verhandlungsziel + Pflicht-Schritte
- `BESICHTIGUNG!A41` — Modernisierungsstand-Zusammenfassung (aus `modul_3.massnahmen_liste`)
- `KALKU H-Spalte unter Z40` — AfA-Begründung Substanz-Splitting + Käufer-ROI
- `RENO Comment auf K105` — Mietsubvention Berechnungs-Verweis (Stufen aus `modul-4-output.md`)
- `MIETER!U6` — Markt-Validation-Notiz (Quelle Immometrika/IS24, falls Tiefenstufe 6 erreicht)
- `VK_CF Comment auf C9` — AfA Festlegung BFH-Argument (`modul_2.begruendung`)

**3d) Plausibilitäts-Prüfung:**

- PDF-Datei existiert auf Platte nach Build.
- Excel-Datei existiert nach Save.
- `bewertungs_score` zwischen 0 und 100.
- Alle Pflicht-Zellen in Excel ≠ leer (Stichprobe: `MIETER!A8`, `KALKU!C20`, `KALKU!C26`).

## 4. Output erzeugen (Drei Zonen)

**Zone A — Daten-Block:**

```
| Position                | Wert                                              |
|-------------------------|---------------------------------------------------|
| Bewertungs-Score        | <0-100> / 100 (Platzhalter, siehe Hinweis)        |
| Verdict-Kategorie       | GO / GRENZWERTIG / STOP                           |
| PDF-Pfad                | Aufteiler_<Strassenkurz>_<YYYY-MM-DD>.pdf         |
| Excel-Pfad              | Kalkulation_<Strassenkurz>.xlsx                   |
| Module mit Status rot   | <Liste oder "—">                                  |
| Module mit Status gelb  | <Liste oder "—">                                  |
```

```
| Score-Aggregation       | Status | Konfidenz | Delta |
|-------------------------|--------|-----------|-------|
| Modul 0 Quick-Check     | <s>    | <k>       | <Δ>   |
| Modul 1 Objektbasis     | <s>    | <k>       | <Δ>   |
| Modul 2 RND/AfA         | <s>    | <k>       | <Δ>   |
| Modul 3 Massnahmen      | <s>    | <k>       | <Δ>   |
| Modul 4 Miete           | <s>    | <k>       | <Δ>   |
| Basis 70 + Summe Deltas | -      | -         | <Σ>   |
| Score (clamped 0-100)   |        |           | <X>   |
```

**Zone B:**
```
Tiefenstufe: 1 von 1 (Platzhalter-Score; echte Methodik folgt)
Konfidenz: niedrig (Platzhalter)
```

**Zone C — Begründung:**

1. **Wichtigste Annahmen** (max 5 Bullets) — z.B. „Score-Logik: Basis 70, je rot −10, je gelb −5, je Konfidenz −2/−5", „Bewirtschaftungs-Quote Default 20 %".
2. **Risiken / Unsicherheiten** (max 5 Bullets) — z.B. „Score-Methodik noch offen (Platzhalter)", „Brutto/Netto-Excel-Verifikation TODO".
3. **Empfehlung** (1–3 Sätze) — z.B. „PDF + Excel als Prüfungs-Dokumente vor Notartermin. Score ist Platzhalter — echte Methodik folgt."

**Pflicht-Hinweis (immer in Zone C anhängen):**

```
HINWEIS: bewertungs_score ist Platzhalter (Ampel-Aggregation Modul 0-4).
Echte Score-Methodik folgt aus parallelem Optimierungs-Prozess.
Siehe plans/2026-05-12-score-logik-modul-5-offen.md.
```

## 5. State persistieren

1. `modul_5`-Block bauen:
   ```json
   {
     "status": "<gruen|gelb|rot>",
     "bewertungs_score": <number 0-100>,
     "pdf_pfad": "Aufteiler_<Strassenkurz>_<YYYY-MM-DD>.pdf",
     "excel_pfad": "Kalkulation_<Strassenkurz>.xlsx"
   }
   ```
   Status-Ableitung aus Score:
   - `score >= 70` → `status = "gruen"` (GO)
   - `50 <= score < 70` → `status = "gelb"` (GRENZWERTIG)
   - `score < 50` → `status = "rot"` (STOP)
2. `objekt.letzter_modul_lauf` auf `"modul_5"` setzen.
3. State schreiben.
4. `runs/<slug>/modul-5-output.md` mit Zonen A/B/C schreiben.
5. Validator-Lauf: `python tools/validate_state.py runs/<slug>/state.json`. Exit 0 = OK.

## 6. Self-Check (Pflicht vor Übergabe)

- [ ] Alle Pflichtfelder befüllt (status, bewertungs_score, pdf_pfad, excel_pfad)
- [ ] PDF-Datei existiert auf Platte (`runs/<slug>/Aufteiler_*.pdf` ist eine echte Datei mit > 0 Bytes)
- [ ] Excel-Datei existiert auf Platte (`runs/<slug>/Kalkulation_*.xlsx` ist eine echte Datei mit > 0 Bytes)
- [ ] `bewertungs_score` zwischen 0 und 100
- [ ] Alle Module 0–4 unverändert im State (kein Modul-5-Schreiben in Modul-0-4-Blöcke)
- [ ] `modul_2.rnd_frozen` unverändert auf `true`
- [ ] Platzhalter-Hinweis in `modul-5-output.md` Zone C enthalten
- [ ] PDF-Skill-Regeln R1–R13 angewendet (Self-Check aus `aufteiler-pdf-export` Sektion 5)
- [ ] Excel: alle Pflicht-Zellen aus `docs/excel_handoff.md` befüllt
- [ ] Validator-CLI exit 0

Bei rot → kein state.json-Schreiben, an Orchestrator zurück.

## 7. Übergabe an Orchestrator

Eine Zeile:
```
Modul 5 grün. Score <X>/100 (Platzhalter). PDF: runs/<slug>/Aufteiler_<…>.pdf, Excel: runs/<slug>/Kalkulation_<…>.xlsx. Audit in runs/<slug>/modul-5-output.md.
```

Plus Pflicht-Hinweise:
- „PDF + Excel sind Prüfungs-Dokumente, kein Gutachten."
- „Score ist Platzhalter — echte Methodik folgt."
