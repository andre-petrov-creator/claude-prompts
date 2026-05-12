---
name: aufteiler-modul-4-miete
description: Modul 4 der Aufteiler-Analyse — Mietsituation (Mietspiegel, §558-Heberecht, Mietsubvention). Tiefenstufen 1–6. Wird ausschließlich vom aufteiler-Orchestrator aufgerufen.
---

# Modul 4 — Mietsituation

Pro WE: Ist-Miete, Sollmiete (Mietspiegel-Algorithmus), Mietspiegel-Obergrenze, §558-Heberecht, Mietsubvention bis Sollmiete erreicht ist. Architektur **Option C** (aus altem XML v2.0): M6 = VOR Aufteiler-Sanierung; Aufteiler-Massnahmen 2026 fließen NICHT in den Mietspiegel-Mittelwert, sondern in Excel `MIETER!T4` als §559-Modernisierungsumlage. Mietsubvention ist eine **separate Cashflow-Position**, NICHT im Reno-Block (Asset-Trennung).

## 1. State laden (Pflicht — erste Aktion)

1. Vom Orchestrator bekomme ich `objekt_slug`. Pfad: `runs/<objekt_slug>/state.json`.
2. State einlesen mit `Read`.
3. Pflicht-Vorgänger-Felder prüfen. Wenn etwas fehlt → STOPP, Antwort an Orchestrator:
   `"Modul 4: Pflichtfeld <pfad> fehlt. Bitte Modul 1 erneut laufen lassen."`

**Pflicht-Vorgänger:** `modul_1.we_liste` (mindestens 1 WE).

Modul 3 ist nicht zwingend Vorgänger (Modul 4 kann theoretisch unabhängig laufen), aber bei Vollanalyse läuft 3 vor 4.

## 2. Inputs erheben

Per `AskUserQuestion` einzeln:

1. **Mietspiegel-Daten aus Notion-DB** (Page-ID `8b000923-d5ee-45a4-8f6a-e7f3bf81f20e` — Mietspiegel NRW) für Stadt `objekt.stadt`. Falls Stadt nicht in DB oder MCP-Notion nicht verfügbar: User-Hand-Eingabe abfragen:
   - Basis-Wert €/m² je Baujahres-Klasse (aus Mietspiegel-Tabelle)
   - Lage-Korrektur €/m² (Wohnlage einfach/mittel/gut)
   - Kappungsgrenze in % (NRW Standard 15 oder 20 %)
   - Mietpreisbremse ja/nein
2. **Ist-Miete pro WE** — eine Zeile pro WE, Format: `<WE-Nr>: <Ist-Miete €/Monat kalt>`. Beispiel: `1: 380.40`.
3. **Bestand-Sanierungsstand** — aus `modul_2.mod_score` und altem-XML-Logik: User kann Bestand-Aufzählung pro Gewerk hinzufügen für Mietspiegel-Zuschläge 4.3–4.10. Default: keine Zuschläge, wenn nichts belegt (analog R02 Modul 2).

**Wichtig — Option C:**
- Aufteiler-Massnahmen 2026 aus `modul_3.massnahmen_liste` werden für Mietspiegel-Zuschläge IGNORIERT. Sie wirken nur über `MIETER!T4` (Excel rechnet §559-Umlage). Modul 4 setzt T4 NICHT selbst, prüft aber `modul_3.summen.modernisierung_netto_eur` als Hinweis.
- **Doppelrechnung-Safety-Check** (Pflicht vor State-Write): kein Aufteiler-2026-Element aus `modul_3` als Mietspiegel-Zuschlag in `modul_4.we_mieten[]` eingeflossen.

## 3. Berechnung / Logik

**3a) Tiefenstufen-Wahl:**

| Stufe | Eingang vorhanden | Output |
|-------|-------------------|--------|
| 1 | Ist-Mieten + Anzahl WE | Sollmiete als pauschaler Median des Stadtteils |
| 2 | + Mietspiegel-Basis pro Baujahr-Klasse | Sollmiete pro WE basisbasiert |
| 3 | + Lage-Korrektur | + Lage-Anpassung |
| 4 | + Bestand-Ausstattungs-Zuschläge (4.3–4.9) | + Ausstattungs-Zuschläge |
| 5 | + Bestand-Modernisierungs-Zuschläge mit Jahr (4.10) | + Modernisierungs-Zuschläge BESTAND |
| 6 | + Markt-Validation (Immometrika/IS24-Median + Vermarktungsdauer + Inseratsanzahl) | + Markt-Adjustment |

`tiefenstufe` 1–6, Schema-Max 6. Default-Ziel: Stufe 4.

**3b) Berechnung pro WE in fester Reihenfolge:**

```
# Schritt 1: Basis-Sollmiete €/m² aus Baujahr-Klasse (Mietspiegel)
sollmiete_basis_eur_pro_qm = lookup(mietspiegel_db, stadt, baujahres_klasse(modul_2.baujahr))

# Schritt 2: Lage-Korrektur addieren
sollmiete_mit_lage = sollmiete_basis_eur_pro_qm + lage_korrektur

# Schritt 3: Bestand-Ausstattungs-Zuschläge (4.3–4.9) — NUR aus BESTAND, nicht aus modul_3!
zuschlaege_bestand = Σ ausstattungs_zuschlaege_belegt
sollmiete_mit_zuschlaegen = sollmiete_mit_lage + zuschlaege_bestand

# Schritt 4: Bestand-Modernisierungs-Zuschläge 4.10 mit Jahr (nur aus modul_2 Bestand!)
mod_zuschlaege = Σ mod_zuschlaege_bestand_mit_jahr
sollmiete_eur_pro_qm = sollmiete_mit_zuschlaegen + mod_zuschlaege

# Schritt 5: Mietspiegel-Obergrenze (üblicher Cap +18 % auf Spanne)
mietspiegel_obergrenze_eur_pro_qm = sollmiete_eur_pro_qm × 1.18

# Schritt 6: §558-Heberecht pro WE
# Kappungsgrenze (k) wirkt: alte Miete × (1+k), aber gecapped auf sollmiete
neue_miete_eur_pro_monat = min(
    ist_miete_eur_pro_qm × wohnflaeche_qm × (1 + k),
    (mietspiegel_obergrenze_eur_pro_qm + sollmiete_eur_pro_qm) / 2 × wohnflaeche_qm
)
paragraph_558_heberecht_eur = max(0, neue_miete_eur_pro_monat − ist_miete_eur_pro_monat)
```

**3c) Mietsubvention berechnen (Step 8 aus altem XML, deterministische Stufen-Formel):**

```
# Pro WE:
k = kappungsgrenze (z.B. 0.15 für NRW)
SOLL_we = mietspiegel_obergrenze_eur_pro_qm × wohnflaeche_qm
IST_we = ist_miete_eur_pro_qm × wohnflaeche_qm

# Stufen:
#   Stufe 0: Anlauf 3 Monate, Stufenmiete = IST_we
#   Stufe n>0: Dauer 36 Monate (Kappungsgrenze-Intervall NRW), Stufenmiete = IST × (1+k)^n, gecapped auf SOLL_we
# n_voll = AUFRUNDEN(LOG(SOLL_we / IST_we) / LOG(1+k) − 1; 0)

n_voll = ceil(log(SOLL_we / IST_we) / log(1+k) − 1)
reach_time_monate = 3 + n_voll × 36

# Subvention je Stufe:
for n in 0..n_voll:
    stufenmiete_n = min(IST_we × (1+k)**n, SOLL_we)
    diff_n = SOLL_we − stufenmiete_n
    dauer_mo = 3 if n == 0 else 36
    subv_stufe_n = diff_n × dauer_mo

subv_we_eur = Σ subv_stufe_n
subv_we_pro_monat_eur = subv_we_eur / reach_time_monate    # Durchschnitt über Reach-Time
```

**Wichtig — Schema-Mapping:**

Das Schema (state-schema.md) hat ein einzelnes Feld `mietsubvention_eur_pro_monat` pro WE (kein Stufen-Detail). Im State wird der **Durchschnitt über Reach-Time** geschrieben — der detaillierte Stufenplan landet im `modul-4-output.md` Zone A.

```
mietsubventionen_summe_eur_pro_monat = Σ subv_we_pro_monat_eur über alle WE
```

**3d) Plausibilitäts-Prüfung:**

- `ist_miete_eur_pro_qm`, `sollmiete_eur_pro_qm`, `mietspiegel_obergrenze_eur_pro_qm` ≥ 0.
- Wenn `IST_we >= SOLL_we`: `mietsubvention_eur_pro_monat = 0`, Hinweis „Miete bereits ≥ Soll".
- Wenn `SOLL_we / IST_we > 3.0`: Plausi-Warnung in Zone C („extreme Reach-Time, ggf. Mieterwechsel-Pfad realistischer").
- Wenn Reach-Time > 20 J: Hinweis in Zone C.
- **Doppelrechnung-Check:** kein `modul_3.massnahmen_liste`-Eintrag als Mietspiegel-Zuschlag in `we_mieten`-Berechnung verwendet.

**3e) Status-Ableitung:**

- Alle WE valide + Subvention im 5-stelligen €-Bereich: `status = "gruen"`
- Reach-Time > 15 J oder Subvention > 100k EUR-Range: `status = "gelb"`
- Mietsubvention nicht berechenbar (Y fehlt für ≥1 WE): `status = "rot"`

## 4. Output erzeugen (Drei Zonen)

**Zone A — Daten-Block (PIXEL-IDENTISCHE Reihenfolge, DREI Pflicht-Blöcke):**

**Block 1 — Mietsubventionen pro WE (Cashflow-Position für VERKAUFSMATRIX, NICHT für Reno):**
```
| WE-Nr | Wohnfläche m² | Ist-Miete €/m² | Sollmiete €/m² | Subvention €/Monat | Reach-Time Mo |
|-------|---------------|----------------|----------------|--------------------|---------------|
| 1     | 92.98         | 4.09           | 8.65           | 220.50             | 183           |
| …     | …             | …              | …              | …                  | …             |
| Σ     |               |                |                | <Σ €/Mo>           |               |
```

**Block 2 — Aktuelle Miete vs. Sollmiete (pro WE):**
```
| WE-Nr | Ist €/m² | Soll €/m² | Mietspiegel-Obergrenze €/m² | Delta €/m² | Delta % |
|-------|----------|-----------|------------------------------|------------|---------|
| 1     | 4.09     | 7.33      | 8.65                         | +3.24      | +79%    |
| …     | …        | …         | …                            | …          | …       |
```

**Block 3 — §558-Heberecht (pro WE):**
```
| WE-Nr | §558-Heberecht €/Monat | Aktiv? | Hinweis |
|-------|--------------------------|--------|---------|
| 1     | 245.00                   | ja     | Kappung 15 % greift |
| …     | …                        | …      | …       |
```

Nicht-ermittelbare Werte: `"n/a"`, nicht weglassen.

**Zone B:**
```
Tiefenstufe: <N> von 6 (<Begründung wenn nicht 6>)
Konfidenz: <hoch|mittel|niedrig>
```

**Zone C:**

1. **Wichtigste Annahmen** (max 5 Bullets) — z.B. „Mietspiegel Essen 2024, Baujahres-Klasse 1949–1977", „Lage Essen-Dellwig: mittel +0.20 €/m²", „Kappungsgrenze NRW 15 %".
2. **Risiken / Unsicherheiten** (max 5 Bullets) — z.B. „Reach-Time WE 3 mit 18 J grenzwertig", „Markt-Median nicht validiert (Tiefenstufe 5 statt 6)".
3. **Empfehlung** (1–3 Sätze) — z.B. „Subvention 5J über Reach-Time geplant. Vor Modul 5: Immometrika-Lookup für Markt-Validation (Stufe 6)."

**Pflicht-Hinweis (immer in Zone C ergänzen):**

```
Asset-Trennung: Mietsubvention NICHT in modul_3.massnahmen_liste, sondern hier in modul_4
+ VERKAUFSMATRIX-Extra-Spalte. Mietpreisbremse-Hinweis: <ja/nein> für <Stadt>.
Aufteiler-Massnahmen 2026 wirken via Excel MIETER!T4 §559-Umlage, NICHT im
Mietspiegel-Mittelwert M6 (Option C, kein Doppelansatz).
```

## 5. State persistieren

1. `modul_4`-Block bauen (gemäß Schema):
   ```json
   {
     "status": "<gruen|gelb|rot>",
     "tiefenstufe": <int 1-6>,
     "tiefenstufe_max": 6,
     "konfidenz": "<hoch|mittel|niedrig>",
     "we_mieten": [
       {
         "we_nr": <int>,
         "ist_miete_eur_pro_qm": <number>,
         "sollmiete_eur_pro_qm": <number>,
         "mietspiegel_obergrenze_eur_pro_qm": <number>,
         "paragraph_558_heberecht_eur": <number>,
         "mietsubvention_eur_pro_monat": <number>
       }
     ],
     "mietsubventionen_summe_eur_pro_monat": <number = Σ über we_mieten>,
     "begruendung_je_we": {
       "1": "<kurz: Lage, Zuschläge, Auffälligkeiten>",
       "…": "…"
     }
   }
   ```
2. **Asset-Trennung-Pflichtcheck**: Mietsubvention NICHT in `modul_3.massnahmen_liste`. (Schema-Validator + Modul-3-Self-Check enforced.)
3. **Doppelrechnung-Check**: kein `modul_3`-Eintrag als Mietspiegel-Zuschlag verwendet.
4. `objekt.letzter_modul_lauf` auf `"modul_4"` setzen.
5. State schreiben.
6. `runs/<slug>/modul-4-output.md` mit Zonen A/B/C schreiben (alle drei Pflicht-Blöcke).
7. Validator-Lauf: `python tools/validate_state.py runs/<slug>/state.json`. Exit 0 = OK; ≠0 → state.json zurückrollen.

## 6. Self-Check (Pflicht vor Übergabe)

- [ ] Alle Pflichtfelder befüllt (status, tiefenstufe, tiefenstufe_max, konfidenz, we_mieten, mietsubventionen_summe_eur_pro_monat, begruendung_je_we)
- [ ] `we_mieten` enthält genau `len(modul_1.we_liste)` Einträge
- [ ] Jeder `we_mieten[]`-Eintrag schemakonform (alle 6 Felder)
- [ ] `mietsubventionen_summe_eur_pro_monat == Σ we_mieten[].mietsubvention_eur_pro_monat`
- [ ] **Asset-Trennung**: `modul_3.massnahmen_liste` enthält weiterhin KEIN `subvention`/`rücklage` (Modul 4 darf den Reno-Block nicht anfassen)
- [ ] **Doppelrechnung-Check**: kein Aufteiler-2026 als Mietspiegel-Zuschlag in `we_mieten`
- [ ] `modul_2.rnd_frozen` unverändert
- [ ] Drei Pflicht-Tabellen in `modul-4-output.md` in fixer Reihenfolge (Subventionen → Miete-Vergleich → §558)
- [ ] Excel-Transfer-Block (MIETER!M6, P6, Y8:Y, RENO!K105) im Output dokumentiert
- [ ] Validator-CLI exit 0

Bei rot → kein state.json-Schreiben, an Orchestrator zurück.

## 7. Übergabe an Orchestrator

Eine Zeile:
```
Modul 4 grün. <N> WE, Subventions-Summe <X> €/Monat. Werte in runs/<slug>/state.json, Audit in runs/<slug>/modul-4-output.md. Sequenz 0→4 abgeschlossen.
```
