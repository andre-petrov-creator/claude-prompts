# Excel-Handoff-Vertrag

Pro Excel-Sheet eine Tabelle. Jede Zeile beschreibt **eine Zelle**, die von einem Modul-Skill geschrieben wird, mit:
- `Sheet!Zelle`: exakte Adresse im Template `Kalkulation_Aufteiler_mit_VK_CF.xlsx`
- `Inhalt`: was steht drin
- `Quelle (Schema-Pfad)`: woher kommt der Wert in `state.json`
- `Liefer-Modul`: welcher Modul-Skill schreibt diese Zelle (in der Praxis: alle Excel-Writes erfolgen durch Modul 5, das den State konsumiert; „Liefer-Modul" bezeichnet das Modul, das den State-Wert produziert)

**Vertrag:** wenn eine Zelle hier steht, darf kein anderes Modul sie überschreiben.

Konvention: `N` = `len(modul_1.we_liste)` (Anzahl WE). `i` = WE-Index 0..N-1. Excel-Zeilen 8..7+N für WE-bezogene Daten (außer VERKAUFSMATRIX, dort 6..5+N).

---

## Architektur: Wer rechnet was?

Die Excel ist **die zentrale Rechen-Maschine**. Sie ist als selbst-konsistente Datei aufgebaut, in der **`BESICHTIGUNG` die Eingabe-Maske ist** und alle anderen Sheets per Formel davon abgeleitet werden:

```
BESICHTIGUNG (Eingabe-Maske, User-Inputs)
    │
    ├─► KALKU (zieht via Formeln: =BESICHTIGUNG!B6, B7, B8, B9, B13, B28, B34)
    │       ├─► RENO (via KALKU!C13 als Wohnfläche, KALKU!P37 als Faktor)
    │       ├─► VK_CF (zieht aus MIETER + KALKU)
    │       └─► VERKAUFSMATRIX (zieht aus MIETER + KALKU)
    │
    └─► MIETER (Stamm-Daten WE, Mieter, IST-Mieten, Y8..Y27 Mietspiegel-Obergrenze)
            ├─► VK_CF (Spalten F, G via Formel)
            └─► VERKAUFSMATRIX (Spalten F, K via Formel)
```

**Konsequenz für Modul 5:** Excel-Werte werden vorwiegend in **`BESICHTIGUNG`** (zentrale Eingabe-Maske) und **`MIETER`** (WE-Stamm + Y-Spalte) + **`RENO`** (Mengen) geschrieben. KALKU/VK_CF/VERKAUFSMATRIX werden **NICHT** beschrieben — sie rechnen sich automatisch über Formeln.

Die einzige Ausnahme in KALKU sind die **AfA-relevanten Eingangs-Werte** (Modul 2 RND/AfA), die in der aktuellen Template-Version nicht vorgesehen sind — sie werden als Excel-**Comments** (Notizen) auf den passenden Zellen abgelegt, ohne die Formel-Struktur zu zerstören.

---

## Sheet `BESICHTIGUNG` (zentrale Eingabe-Maske)

| Sheet!Zelle | Inhalt | Quelle (Schema-Pfad) | Liefer-Modul |
|-------------|--------|----------------------|--------------|
| `BESICHTIGUNG!B6` | Anschrift (vollständig) | `objekt.adresse` | Orchestrator |
| `BESICHTIGUNG!B7` | Wohnfläche gesamt m² | Σ `modul_1.we_liste[].wohnflaeche_qm` | Modul 1 |
| `BESICHTIGUNG!B8` | Baujahr | `modul_2.baujahr` | Modul 2 |
| `BESICHTIGUNG!B9` | Anzahl WE | `len(modul_1.we_liste)` | Modul 1 |
| `BESICHTIGUNG!B10` | Hausgeld pro Monat | (User-Input, optional) — Modul 5 fragt einmalig | Modul 5 |
| `BESICHTIGUNG!B11` | Rücklagen des Hauses | (User-Input, optional) — Modul 5 fragt einmalig | Modul 5 |
| `BESICHTIGUNG!B13` | Inseratspreis | `modul_0.angebotspreis_eur` | Modul 0 |
| `BESICHTIGUNG!B28` | Schmerzgrenze (Verhandlungs-Untergrenze) | (User-Input optional, Default = `angebotspreis × 0.85`) | Modul 5 |
| `BESICHTIGUNG!B33` | IST-JNKM (Jahresnetto-Kaltmiete) | Σ `modul_4.we_mieten[].ist_miete_eur_pro_qm × wohnflaeche_qm × 12` | Modul 4 |
| `BESICHTIGUNG!B34` | Kappungsgrenze (0.15 oder 0.20) | NRW-Default 0.15; Modul-4-State (sobald als Feld eingeführt) | Modul 4 |
| `BESICHTIGUNG!B18..B23` | Zustand Dach/Fassade/Fenster/Stellplatz/Heizung/Elektrik (Text) | aus `modul_2.begruendung` + `modul_3.massnahmen_liste[]` (Zustands-Texte) | Modul 3 |

**Wichtig:** `BESICHTIGUNG!B7..B9` werden in KALKU per Formel referenziert (`KALKU!C12..C15 = =BESICHTIGUNG!B6..B9`). Schreiben in BESICHTIGUNG genügt — KALKU rechnet automatisch nach.

---

## Sheet `MIETER`

Header in Zeile 7: `Haus-Nr | WHG-Nr | Etage | Lage | Zimmer | Wohnfläche | Name Mieter | Beginn Miete | letz. Erhöhung | Kaltmiete IST | Stellplätze`.

Daten ab Zeile 8 (i = 0..N-1, Zeile = 8+i).

| Sheet!Zelle | Inhalt | Quelle (Schema-Pfad) | Liefer-Modul |
|-------------|--------|----------------------|--------------|
| `MIETER!A<8+i>` | Haus-Nr (z.B. immer leer oder 1 wenn Single-Haus) | konstant `1` für MFH ohne Haus-Untergliederung | Modul 1 |
| `MIETER!B<8+i>` | WHG-Nr | `modul_1.we_liste[i].we_nr` | Modul 1 |
| `MIETER!C<8+i>` | Etage (z.B. `EG`, `1.OG`, `2.OG`, `DG`) | abgeleitet aus `modul_1.we_liste[i].lage_im_haus` (Mapping `EG`→`EG`, `OG_links`/`OG_rechts`→`OG`, `DG_*`→`DG`) | Modul 1 |
| `MIETER!D<8+i>` | Lage (z.B. `links`, `rechts`, `Mitte`) | abgeleitet aus `modul_1.we_liste[i].lage_im_haus` (Mapping `OG_links`→`links`, `OG_rechts`→`rechts`, sonst leer) | Modul 1 |
| `MIETER!E<8+i>` | Zimmer-Anzahl | `modul_1.we_liste[i].zimmer_anzahl` | Modul 1 |
| `MIETER!F<8+i>` | Wohnfläche m² | `modul_1.we_liste[i].wohnflaeche_qm` | Modul 1 |
| `MIETER!G<8+i>` | Name Mieter (oder leer bei Leerstand) | (optional, kein State-Feld) — leer lassen oder via User-Input | – |
| `MIETER!H<8+i>` | Beginn Mietverhältnis (ISO-Datum) | (optional, kein State-Feld) — leer lassen | – |
| `MIETER!I<8+i>` | Letzte Mieterhöhung (ISO-Datum) | (optional, kein State-Feld) — leer lassen | – |
| `MIETER!J<8+i>` | Kaltmiete IST €/Monat | `modul_4.we_mieten[i].ist_miete_eur_pro_qm × modul_1.we_liste[i].wohnflaeche_qm` | Modul 4 |
| `MIETER!K<8+i>` | Stellplätze (Anzahl oder leer) | (optional, kein State-Feld) — leer lassen | – |
| `MIETER!M6` | Mietspiegel-Mittelwert €/m² | gewichteter Mittelwert über `modul_4.we_mieten[].sollmiete_eur_pro_qm × wohnflaeche_qm` / Σ wohnflaeche | Modul 4 |
| `MIETER!P6` | Kappungsgrenze (Dezimal 0.15 NRW) | NRW-Default 0.15 | Modul 4 |
| `MIETER!Y<8+i>` | Mietspiegel-Obergrenze €/m² pro WE | `modul_4.we_mieten[i].mietspiegel_obergrenze_eur_pro_qm` | Modul 4 |

**Hinweis:** WE-Eigenschaften wie Balkon/Keller sind in der aktuellen MIETER-Tabelle **nicht vorgesehen**. Sie bleiben im State (`modul_1.we_liste[].balkon`, `.keller`), werden aber nicht in Excel geschrieben — sie fließen über Modul 5 PDF-Output und können bei künftigen Template-Erweiterungen ergänzt werden.

---

## Sheet `KALKU` — NICHT direkt beschreiben (rechnet aus BESICHTIGUNG)

KALKU ist eine **reine Rechen-Schicht** ohne dedizierte Eingabe-Zellen für die Aufteiler-Skill-Suite. Werte fließen automatisch:
- `KALKU!C12..C19` per Formel aus `BESICHTIGUNG!B6..B11, B13, B28`
- `KALKU!I13..I17` Portalpreise — können von **Modul 0** als ETW-Konsens-Quellen genutzt werden (User-Inputs in Modul 0)
- `KALKU!E35..F40` Wohnwert-Auf/Abschläge — können von **Modul 2 / Modul 3** als Bestand-Modernisierung gefüttert werden (Heizungsart, Baujahr Heizung, Fassade gedämmt, Zählerschrank, Treppenhaus)

| Sheet!Zelle | Inhalt | Quelle (Schema-Pfad) | Liefer-Modul | Schreib-Status |
|-------------|--------|----------------------|--------------|----------------|
| `KALKU!I13` | Portalpreis Homeday €/m² | aus `modul_0` ETW-Konsens-Quellen | Modul 0 | nur wenn User Quellen liefert |
| `KALKU!I14` | Portalpreis IS24 €/m² | aus `modul_0` | Modul 0 | optional |
| `KALKU!I15` | Portalpreis Pricehubble/Check24 €/m² | aus `modul_0` | Modul 0 | optional |
| `KALKU!I16` | Portalpreis InterHyp €/m² | aus `modul_0` | Modul 0 | optional |
| `KALKU!I17` | Portalpreis Wohnungsmarktbericht €/m² | aus `modul_0` | Modul 0 | optional |
| `KALKU!E35` | Art der Heizung (`Gas`/`Öl`/`Elektro`/`Pellet`/`Wärmepumpe`) | abgeleitet aus `modul_3.massnahmen_liste[]` (Heizung-Eintrag) | Modul 3 | optional |
| `KALKU!E36` | Baujahr Heizung | abgeleitet aus `modul_2.begruendung` (Heizung-Mod-Jahr) oder User-Input | Modul 2 | optional |
| `KALKU!E37` | Fassade wird/ist gedämmt (`Ja`/`Nein`) | aus `modul_3.massnahmen_liste[]` (Fassade-Eintrag) | Modul 3 | optional |
| `KALKU!E38` | Zählerschrank wird/wurde erneuert (Jahr) | aus `modul_3.massnahmen_liste[]` (Elektrik-Eintrag) | Modul 3 | optional |
| `KALKU!E39` | Treppenhaus wird/wurde renoviert (`Ja`/`Nein`) | aus `modul_3.massnahmen_liste[]` (Innenausbau-Eintrag) | Modul 3 | optional |

**AfA-Werte aus Modul 2 (RND, AfA-Empfehlung, Mod-Score):** im aktuellen Template **kein dediziertes KALKU-Feld**. Sie werden als **Excel-Comment** auf `KALKU!H10` („VORKALKULATION DER IMMOBILIE") abgelegt — sichtbar beim Hover, ohne Formel-Struktur zu zerstören. Alternative: PDF-Sektion 6 im Modul-5-Output.

---

## Sheet `RENO` — Mengen-Tabelle (User trägt Mengen, Excel rechnet Preise)

RENO ist eine **Mengen-Tabelle mit 94 vordefinierten Positionen** (Zeilen 12–105). Pro Zeile:
- Spalte `F`: Massnahmen-Name (Default, vom Template gesetzt)
- Spalte `I`: **Menge** (vom Modul/User einzutragen) — Default `0`, dann `0` Total
- Spalte `J`: Einheit (`Stk`, `m²`, `m² Wfl.`, `Raum`, `psch`, …, vom Template gesetzt)
- Spalte `K`: Preis pro Einheit netto (vom Template gesetzt — diese **NICHT überschreiben**)
- Spalten `L..O`: Berechnet (Zeit, Lohn, Material)
- Spalte `P` (intern): Total netto pro Position
- Zeile 106: `Gesamtsumme = O106` → fließt via `O8` (mit Puffer + USt + Aufschlag) nach `KALKU!J29`

**USt-Brutto-Aufschlag** läuft automatisch über `RENO!I7 = 0.19`:
- `RENO!O4 = O6_netto × (1 + I6_puffer)` (Netto mit Puffer)
- `RENO!O6 = O4 × (1 + I7)` (Brutto inkl. 19% USt)
- `RENO!O8 = O6 × (1 + L8_aufschlag)` (Brutto inkl. Individual-Aufschlag)

### Konvention: Modul 3 liefert immer Netto

Pro Modul-3-`massnahmen_liste`-Eintrag wird die **Menge** ermittelt und in die passende RENO-Zeile geschrieben. Wenn der User einen **Brutto-Preis** nennt (z.B. „15.000 € WEG-Teilung brutto"), wird in Modul 3 vor dem State-Write **rückgerechnet**: `kosten_netto_eur = kosten_brutto_eur / 1.19`. Damit ist `kosten_netto_eur` im State und in `RENO!K<zeile>` konsistent **netto**.

**Konkrete Pflicht-Positionen:**

| Modul-3-Eintrag (`geplant` enthält…) | RENO-Zeile | RENO-Default-Preis K | Modul-3-Schreib-Verhalten |
|--------------------------------------|------------|----------------------|---------------------------|
| `RND-Gutachten` | Zeile 102 oder als **Neueintrag** unter „Sonstiges" (Zeile 102 ist Einbauküche — RND-Gutachten passt nicht 1:1) | – | Modul 5 schreibt **Pauschal-Position** in eine freie Sonstiges-Zeile oder als **Excel-Comment** auf Zeile 106 |
| `WEG-Teilung Einmalkosten` | **Zeile 104** (`WEG Aufteilung`, K104=12.000) | 12.000 €/Stk | Modul 5: `RENO!I104 = 1` (Menge 1 Pauschal), `RENO!K104` bleibt 12.000 (Default), oder wenn User-Wert abweicht: `K104 = modul_3.weg_teilung_netto_eur` |
| `Mietsubvention` | **Zeile 105** (`Miet Subvention`, K105=0) | wird gesetzt von Modul 5 | `RENO!I105 = 1` (bereits Default), `RENO!K105 = modul_4.mietsubventionen_summe_eur_pro_monat × 12 × <Reach-Time-Faktor>` — siehe unten |

**Mietsubvention RENO!K105 — exakter Wert:** Modul 4 liefert `mietsubventionen_summe_eur_pro_monat` (Durchschnitts-Wert über Reach-Time). Total-Summe über Reach-Time = `summe_eur_pro_monat × reach_time_monate`. Für RENO einmalig als Pauschal-Position: `K105 = Σ subv_we_eur` (Total über alle Stufen, alle WE). Wird in Modul 4 vor State-Write zusätzlich berechnet und im State unter `modul_4.mietsubventionen_total_eur` gehalten (Schema-Erweiterung TODO — Phase 5).

**Einzelne Modernisierungs-Massnahmen (z.B. Dach, Fassade WDVS, Fenster):** Modul 5 mapped `modul_3.massnahmen_liste[].kategorie` auf die passende RENO-Zeile:

| Modul-3-Kategorie | RENO-Zeile(n) | Bemerkung |
|-------------------|---------------|-----------|
| `Dach` | 25 (Dach neu decken), 27 (Dachdämmung) | je nach Massnahme |
| `Fassade` | 18 (WDVS), 19 (Gewebespachtel), 20 (verputzen), 22 (streichen) | Stack aus mehreren Zeilen für komplettes WDVS-Paket |
| `Fenster` | 50 (Fenster komplett), 51 (Balkontür), 49 (einstellen) | |
| `Heizung` | 78 (Gas-Zentral), 79 (Wärmepumpe), 77 (Pellet) | je nach Heizungs-Typ |
| `Elektrik` | 68 (Zählerschrank pro WE), 69 (Neuinstallation pro m²), 64 (FI nachrüsten) | |
| `Sanitaer` | 93 (Bad-Komplettsanierung), 94 (Wasserleitungen) | |
| `Boeden` | 37 (Laminat), 38 (Laminat+Trittschall), 39 (Parkett) | |
| `Grundriss` | 30 (Wand einziehen), 31 (Decke abhängen) | |
| `Sonstiges` | 102 (Einbauküche), 104 (WEG), 105 (Subvention) | je nach Inhalt |

Mengen-Berechnung pro Zeile: aus Wohnfläche, Anzahl WE, Bauteil-Spezifikation. Genaue Mapping-Logik wird in Modul 5 als Code-Block dokumentiert.

---

## Sheet `VK_CF` — NICHT direkt beschreiben (rechnet aus MIETER + KALKU)

VK_CF berechnet pro WE den maximalen Käufer-Kaufpreis aus Käufer-Cashflow-Sicht. Alle Felder sind Formeln:
- `VK_CF!C5` (Zins Käufer), `C6` (Tilgung), `C7` (Grenzsteuer), `C8` (Bewirtschaftung), `C9` (AfA-Satz), `C10` (Gebäudeanteil), `C11` (Ziel-Cashflow): **User-editierbar** in Excel direkt, kein Modul-Schreib-Vertrag.

Wenn Modul-2-AfA-Empfehlung in Excel sichtbar werden soll: als **Comment** auf `VK_CF!C9` ablegen mit Wert + Begründung. Der Excel-User entscheidet, ob er die Empfehlung übernimmt.

---

## Sheet `VERKAUFSMATRIX` — NICHT direkt beschreiben (rechnet aus MIETER + KALKU)

VERKAUFSMATRIX bezieht alle WE-Daten per Formel aus MIETER und Portalpreise aus KALKU. WE-Daten landen automatisch nach Modul-1+Modul-4-Schreibvorgängen in MIETER. Spalte `V` (Preis Garage/Stellplatz) ist User-Input in Excel direkt.

**Asset-Trennung (verbindlich):**
- **Rücklage** und **Mietsubvention** gehören in **`RENO`-Sonstiges-Zeilen** (Zeile 105 für Subvention) und damit in den Cashflow-Block, NICHT in andere Modernisierungs-Zeilen. Grund: Steuerbasis darf nicht verfälscht werden — `RENO!K105` ist separat von den anderen Reno-Positionen ausgewiesen.
- **Wohnungen / Garagen / Stellplätze** NIE im selben Cashflow-Block mischen — Spalte `K` in MIETER ist die Stellplatz-Anzahl, Spalte `V` in VERKAUFSMATRIX ist der separate Stellplatz-VK-Preis.

---

## Brutto/Netto-Konvention

**Verbindlich:** Modul 3 liefert in `modul_3.massnahmen_liste[].kosten_netto_eur` und in `modul_3.rnd_gutachten_netto_eur`, `modul_3.weg_teilung_netto_eur` **immer Netto-Werte**. Wenn der User Brutto nennt: vor State-Write durch `1.19` teilen.

Das `RENO`-Sheet rechnet selbst Brutto: `O4 = O_netto × (1 + I6=0.10 Puffer)`, `O6 = O4 × (1 + I7=0.19 USt)`. Der Wert in `RENO!K<zeile>` ist immer **netto**.

Modul-3-`summen.modernisierung_brutto_eur` ist im State als Convenience-Feld geführt (= `_netto × 1.19`); für die Excel-Befüllung ist es nicht erforderlich — die Excel rechnet selbst.

---

## Komplette Schreib-Reihenfolge in Modul 5

```python
# 1. BESICHTIGUNG (Eingabe-Maske; alles andere zieht sich darüber)
besichtigung['B6']  = state['objekt']['adresse']
besichtigung['B7']  = sum(we['wohnflaeche_qm'] for we in state['modul_1']['we_liste'])
besichtigung['B8']  = state['modul_2']['baujahr']
besichtigung['B9']  = len(state['modul_1']['we_liste'])
besichtigung['B13'] = state['modul_0']['angebotspreis_eur']
besichtigung['B34'] = 0.15  # NRW Kappungsgrenze

# 2. MIETER (WE-Stamm aus Modul 1, IST-Mieten aus Modul 4, Y aus Modul 4)
for i, we in enumerate(state['modul_1']['we_liste']):
    row = 8 + i
    mieter[f'A{row}'] = 1                             # Haus-Nr (Single-Haus)
    mieter[f'B{row}'] = we['we_nr']                   # WHG-Nr
    mieter[f'C{row}'] = etage_aus_lage(we['lage_im_haus'])   # 'EG'/'1.OG'/'2.OG'/'DG'
    mieter[f'D{row}'] = lage_aus_lage(we['lage_im_haus'])    # 'links'/'rechts'/''
    mieter[f'E{row}'] = we['zimmer_anzahl']
    mieter[f'F{row}'] = we['wohnflaeche_qm']
    # G..K leer lassen (kein State-Feld)
    miete = state['modul_4']['we_mieten'][i]
    mieter[f'J{row}'] = miete['ist_miete_eur_pro_qm'] * we['wohnflaeche_qm']
    mieter[f'Y{row}'] = miete['mietspiegel_obergrenze_eur_pro_qm']

mieter['M6'] = round(gewichteter_mietspiegel_mittelwert, 2)
mieter['P6'] = 0.15  # NRW

# 3. RENO (Mengen aus Modul 3, Pauschal-Werte für Subvention/Gutachten/WEG)
reno = wb['RENO']
# WEG-Teilung
if state['modul_3']['weg_teilung_netto_eur'] > 0:
    reno['I104'] = 1
    if state['modul_3']['weg_teilung_netto_eur'] != 12000:  # nur überschreiben wenn User abweicht
        reno['K104'] = state['modul_3']['weg_teilung_netto_eur']
# Mietsubvention
reno['I105'] = 1
reno['K105'] = state['modul_4'].get('mietsubventionen_total_eur', 
                                     state['modul_4']['mietsubventionen_summe_eur_pro_monat'] * 60)  # 5-J-Default

# Massnahmen-Mengen (vereinfachter Mapper)
for m in state['modul_3']['massnahmen_liste']:
    zeile = map_kategorie_zu_reno_zeile(m['kategorie'], m['geplant'])
    if zeile:
        menge = berechne_menge(m, state['modul_1']['we_liste'])
        reno[f'I{zeile}'] = menge

# 4. Excel-Comments für nicht-direkt-schreibbare Werte
from openpyxl.comments import Comment
kalku = wb['KALKU']
kalku['H10'].comment = Comment(
    f"AfA-Empfehlung (Modul 2): {state['modul_2']['afa_empfehlung_prozent']:.2f}%\n"
    f"RND: {state['modul_2']['rnd_jahre']} Jahre (gefroren)\n"
    f"Mod-Score: {state['modul_2']['mod_score']}/20\n"
    f"Begründung: {state['modul_2']['begruendung'][:200]}",
    "Aufteiler-Skill"
)
```
