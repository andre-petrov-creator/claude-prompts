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

**3c) Excel-Befüllung (gemäß `docs/excel_handoff.md`):**

Excel-Template `template/Kalkulation_Aufteiler_mit_VK_CF.xlsx` wird zu `runs/<slug>/Kalkulation_<Straßenkurz>.xlsx` kopiert. Schreib-Reihenfolge:

```python
from openpyxl import load_workbook
from openpyxl.comments import Comment
import shutil, json
from pathlib import Path

state = json.load(open(state_path, encoding="utf-8"))
slug = state["objekt"]["slug"]
strasse_kurz = "-".join(slug.split("-")[:2])  # z.B. "prosperstr-59"

src = Path("template/Kalkulation_Aufteiler_mit_VK_CF.xlsx")
dst = Path(f"runs/{slug}/Kalkulation_{strasse_kurz}.xlsx")
shutil.copyfile(src, dst)

wb = load_workbook(dst)

# ===== 1. BESICHTIGUNG (Eingabe-Maske; KALKU/VK_CF zieht sich daraus) =====
besichtigung = wb["BESICHTIGUNG"]
besichtigung["B6"]  = state["objekt"]["adresse"]
besichtigung["B7"]  = sum(we["wohnflaeche_qm"] for we in state["modul_1"]["we_liste"])
besichtigung["B8"]  = state["modul_2"]["baujahr"]
besichtigung["B9"]  = len(state["modul_1"]["we_liste"])
besichtigung["B13"] = state["modul_0"]["angebotspreis_eur"]
besichtigung["B34"] = 0.15  # NRW-Default Kappungsgrenze

# ===== 2. MIETER (WE-Stamm aus M1, IST aus M4, Y aus M4) =====
def etage_aus_lage(lage):
    """'EG' -> 'EG', 'OG_links'/'OG_rechts' -> '1.OG' (default), 'DG_*' -> 'DG'.
    Wenn '2.OG_*' im Lage-String: gibt '2.OG'. Heuristik."""
    L = lage.lower()
    if l := L.startswith("eg"):
        return "EG"
    if "dg" in L or "dachgeschoss" in L:
        return "DG"
    if "2.og" in L or "2_og" in L or "og2" in L:
        return "2.OG"
    if "og" in L:
        return "1.OG"
    return lage  # Fallback wie gegeben

def lage_aus_lage(lage):
    L = lage.lower()
    if "links" in L:
        return "links"
    if "rechts" in L:
        return "rechts"
    return ""

mieter = wb["MIETER"]
N = len(state["modul_1"]["we_liste"])
for i, we in enumerate(state["modul_1"]["we_liste"]):
    row = 8 + i
    mieter[f"A{row}"] = 1  # Haus-Nr (Single-Haus-MFH; bei Mehrhaus später anpassen)
    mieter[f"B{row}"] = we["we_nr"]
    mieter[f"C{row}"] = etage_aus_lage(we["lage_im_haus"])
    mieter[f"D{row}"] = lage_aus_lage(we["lage_im_haus"])
    mieter[f"E{row}"] = we["zimmer_anzahl"]
    mieter[f"F{row}"] = we["wohnflaeche_qm"]
    # G..K leer (kein State-Feld)
    miete = state["modul_4"]["we_mieten"][i]
    mieter[f"J{row}"] = round(miete["ist_miete_eur_pro_qm"] * we["wohnflaeche_qm"], 2)
    mieter[f"Y{row}"] = miete["mietspiegel_obergrenze_eur_pro_qm"]

# Mietspiegel-Mittelwert M6 (gewichtet)
m6 = sum(w["sollmiete_eur_pro_qm"] * we["wohnflaeche_qm"]
         for w, we in zip(state["modul_4"]["we_mieten"], state["modul_1"]["we_liste"])) \
     / sum(we["wohnflaeche_qm"] for we in state["modul_1"]["we_liste"])
mieter["M6"] = round(m6, 2)
mieter["P6"] = 0.15

# ===== 3. RENO (Mengen aus M3, Pauschal-Werte für Subvention/WEG) =====
reno = wb["RENO"]

# WEG-Teilung: Zeile 104
if state["modul_3"]["weg_teilung_netto_eur"] > 0:
    reno["I104"] = 1
    # Default K104=12000 nicht überschreiben, ausser User wich ab
    template_weg = 12000
    if abs(state["modul_3"]["weg_teilung_netto_eur"] - template_weg) > 100:
        reno["K104"] = state["modul_3"]["weg_teilung_netto_eur"]

# Mietsubvention: Zeile 105 (Pauschalbetrag total über alle Stufen)
# Aktuell im State: nur summe_eur_pro_monat (Durchschnitt). Total = pro_monat × reach_time
# Vereinfacht: 5-Jahres-Default (60 Monate) falls reach_time nicht im State
reach_time_default_mo = 60
total_subv = state["modul_4"]["mietsubventionen_summe_eur_pro_monat"] * reach_time_default_mo
reno["I105"] = 1
reno["K105"] = round(total_subv, 2)

# Massnahmen (Mengen-Mapper)
KATEGORIE_RENO_MAPPING = {
    "Dach":      [(25, "neu_decken", "dachflaeche")],   # Default: Dach neu decken
    "Fassade":   [(18, "wdvs", "fassadenflaeche")],     # WDVS
    "Fenster":   [(50, "komplett", "fenster_stk")],
    "Heizung":   [(78, "zentral", "anzahl_we")],
    "Elektrik":  [(69, "neu_pro_qm", "wohnflaeche_gesamt")],
    "Sanitaer":  [(93, "bad_komplett", "wohnflaeche_gesamt")],
    "Boeden":    [(37, "laminat", "wohnflaeche_gesamt")],
    "Grundriss": [(30, "wand_einziehen", "anzahl_we")],
}
# Schätzungs-Heuristik für Menge falls nicht explizit aus State ableitbar
wohnflaeche_gesamt = sum(we["wohnflaeche_qm"] for we in state["modul_1"]["we_liste"])
dachflaeche = wohnflaeche_gesamt * 0.6        # Heuristik
fassadenflaeche = wohnflaeche_gesamt * 0.8    # Heuristik
fenster_pro_we = 6                              # Heuristik
mengen_lookup = {
    "wohnflaeche_gesamt": wohnflaeche_gesamt,
    "dachflaeche": dachflaeche,
    "fassadenflaeche": fassadenflaeche,
    "fenster_stk": fenster_pro_we * len(state["modul_1"]["we_liste"]),
    "anzahl_we": len(state["modul_1"]["we_liste"]),
}

for m in state["modul_3"]["massnahmen_liste"]:
    kat = m["kategorie"]
    if kat == "Sonstiges":
        continue  # WEG/Subvention/RND-Gutachten separat behandelt
    if kat not in KATEGORIE_RENO_MAPPING:
        continue
    for zeile, _, mengen_key in KATEGORIE_RENO_MAPPING[kat]:
        # Wenn der Modul-3-Eintrag einen konkreten Netto-Wert hat, ggf. Default-K
        # überschreiben (Vorsicht: nur wenn User explizit Preis pro Einheit kennt)
        # Default-Verhalten: nur Menge eintragen, K (Preis pro Einheit) unverändert
        menge = mengen_lookup.get(mengen_key, 1)
        reno[f"I{zeile}"] = round(menge, 0)

# ===== 4. Excel-Comments (Werte die nicht in dedizierte Zellen passen) =====
kalku = wb["KALKU"]
# AfA-Empfehlung als Comment auf KALKU!H10 (Headline VORKALKULATION)
afa_text = (
    f"Aufteiler-Skill Modul 2 RND/AfA:\n"
    f"AfA-Empfehlung: {state['modul_2']['afa_empfehlung_prozent']:.2f}% (Korridor "
    f"{state['modul_2']['afa_korridor_prozent']['min']:.2f}–{state['modul_2']['afa_korridor_prozent']['max']:.2f}%)\n"
    f"RND: {state['modul_2']['rnd_jahre']} Jahre (rnd_frozen=true)\n"
    f"Mod-Score: {state['modul_2']['mod_score']}/20\n"
    f"BFH IX R 7/23: Gutachten zwingend, dies ist eine Vorprüfung."
)
kalku["H10"].comment = Comment(afa_text, "Aufteiler-Skill")

# Bewertungs-Score als Comment auf BESICHTIGUNG!A40
verdict_text = (
    f"Aufteiler-Skill Modul 5 Deal-Bewertung:\n"
    f"Score: {state['modul_5']['bewertungs_score']}/100 (Platzhalter-Logik)\n"
    f"Status: {state['modul_5']['status'].upper()}\n"
    f"PDF: {state['modul_5']['pdf_pfad']}"
)
besichtigung["A40"].comment = Comment(verdict_text, "Aufteiler-Skill")

# Mietsubvention-Berechnungs-Verweis auf RENO!K105
subv_text = (
    f"Aufteiler-Skill Modul 4 Mietsubvention:\n"
    f"Σ €/Monat (Durchschnitt über Reach-Time): "
    f"{state['modul_4']['mietsubventionen_summe_eur_pro_monat']:.2f} EUR/Mo\n"
    f"Gesamt-Pauschal (60-Mo-Default): {total_subv:.2f} EUR\n"
    f"Stufen-Details siehe runs/<slug>/modul-4-output.md."
)
reno["K105"].comment = Comment(subv_text, "Aufteiler-Skill")

wb.save(dst)
```

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
