---
name: aufteiler-modul-3-massnahmen
description: Modul 3 der Aufteiler-Analyse — Sanierungs-/Modernisierungskosten inkl. RND-Gutachten und WEG-Teilung als Reno-Positionen. Wird ausschließlich vom aufteiler-Orchestrator aufgerufen.
---

# Modul 3 — Massnahmen

Sanierungs- und Modernisierungskosten je Gewerk, plus zwei Pflicht-Positionen RND-Gutachten und WEG-Teilung. Energetische Massnahmen-Wirkung (Klassen-Sprünge G→F, F→E, …) aus Notion-DB EnEV. Asset-Trennung enforced: **keine** Mietsubvention/Rücklage in `massnahmen_liste` — die gehören nach Modul 4 bzw. in die VERKAUFSMATRIX-Extra-Spalten.

## 1. State laden (Pflicht — erste Aktion)

1. Vom Orchestrator bekomme ich `objekt_slug`. Pfad: `runs/<objekt_slug>/state.json`.
2. State einlesen mit `Read`.
3. Pflicht-Vorgänger-Felder prüfen. Wenn etwas fehlt → STOPP, Antwort an Orchestrator:
   `"Modul 3: Pflichtfeld <pfad> fehlt. Bitte Modul <M> erneut laufen lassen."`

**Pflicht-Vorgänger:**
- `modul_1.we_liste` (Anzahl + Wohnflächen für WE-Renovierung)
- `modul_2.rnd_jahre` und `modul_2.rnd_frozen === true` (RND darf hier NICHT verändert werden)

Wenn `modul_2.rnd_frozen !== true` → STOPP: `"Modul 3: Modul 2 nicht abgeschlossen (rnd_frozen fehlt). Bitte Modul 2 erneut laufen lassen."`

## 2. Inputs erheben

**2a) Brutto/Netto-Konvention (VERBINDLICH):**

Modul 3 liefert **immer Netto-Werte** in `modul_3.massnahmen_liste[].kosten_netto_eur` sowie `modul_3.rnd_gutachten_netto_eur` und `modul_3.weg_teilung_netto_eur`. Die Excel `RENO`-Tabelle rechnet die 19 % USt automatisch via `RENO!I7 = 0.19` auf alle Positionen hoch — Modul 3 muss nichts brutto liefern.

**Wenn der User einen Brutto-Preis nennt** (z.B. „Gutachter kostet 1.190 € brutto/WE" oder „WEG-Teilung 17.850 € brutto"): vor dem State-Write **rückrechnen**:
```
kosten_netto_eur = kosten_brutto_eur / 1.19
```

Konkrete Default-Annahmen:
- **RND-Gutachten:** 1.000 €/WE **netto** (entspricht ~1.190 € brutto/WE; im alten XML stand „1.000 €/WE", konsistent als Netto übernehmen).
- **WEG-Teilung:** Excel-Template Default `RENO!K104 = 12.000 €/Stk netto`. Wenn User abweicht, immer netto liefern.

**2b) Massnahmen pro Kategorie abfragen (eine `AskUserQuestion` pro Kategorie):**

Acht Kategorien (Schema-Enum `modul_3.massnahmen_liste[].kategorie`):
1. `Dach`
2. `Fassade`
3. `Fenster`
4. `Heizung`
5. `Elektrik`
6. `Sanitaer`
7. `Boeden`
8. `Grundriss`
9. `Sonstiges` (Reserve)

Pro Kategorie eine User-Frage:
> `<Kategorie>: Welche Massnahme geplant 2026? Format: <Ist-Zustand> | <Geplant> | <Kosten netto €>. Mehrere Zeilen erlaubt. 'keine' wenn nichts geplant.`

Beispiel-Antwort:
```
Dach: Eindeckung 1978, undicht | WDVS + Neueindeckung | 38000
Fassade: keine
Fenster: 2-fach 1995 | 3-fach Wärmeschutz | 22000
```

**2c) Pflicht-Positionen (automatisch ergänzen, keine User-Frage):**

- **RND-Gutachten**: `rnd_gutachten_netto_eur = 1000 × len(modul_1.we_liste)` (1.000 €/WE pauschal). Eintrag in `massnahmen_liste` als `kategorie="Sonstiges"`, `ist_zustand="—"`, `geplant="RND-Gutachten (1.000 EUR/WE)"`, `kosten_netto_eur=<Summe>`.
- **WEG-Teilung**: User-Frage mit Default-Vorschlag 15.000 € (NRW-Erfahrungswert für 1 Haus). Eintrag als `kategorie="Sonstiges"`, `ist_zustand="—"`, `geplant="WEG-Teilung Einmalkosten"`, `kosten_netto_eur=<Wert>`.

**2d) Asset-Trennung (Pflicht-Check vor State-Write):**

Weder `kategorie` noch `ist_zustand` noch `geplant` darf das Wort `subvention`, `rücklage` oder `ruecklage` enthalten (case-insensitive Substring-Match). Validator enforced das ohnehin, aber das Modul muss explizit darauf prüfen und User-freundlich abweisen, bevor State geschrieben wird.

**2e) Optional — Energieklasse:**

Falls Energieausweis vorhanden, abfragen: `enev_klasse` aus Enum `A+, A, B, C, D, E, F, G, H, unbekannt`. Default: `unbekannt`.

## 3. Berechnung / Logik

**3a) Tiefenstufen-Wahl:**

| Stufe | Eingang vorhanden | Output |
|-------|-------------------|--------|
| 1 | Adresse + WE-Liste | Pauschale Standard-Annahmen pro Kategorie (z.B. 350 €/m² WE-Reno) |
| 2 | + Bestand-Modernisierungsstand (aus Modul 2) | Zustands-Bewertung je Gewerk, gezielte Kosten |
| 3 | + Mod-Score aus M2 + Energieklasse | Korrigierte Kostenschätzung, EnEV-Massnahmen aus Notion-DB |
| 4 | + partielle Handwerker-Angebote | Eingerechnete Ist-Werte |
| 5 | + voll dokumentierte Massnahmen (Angebote pro Gewerk) | Pixel-genaue Reno-Tabelle |

`tiefenstufe` 1–5, Schema-Max 5. Default-Ziel: Stufe 2.

**3b) Kosten-Heuristiken (Default Stufe 1–3, wenn keine konkreten Werte vom User):**

Aus altem XML (Modul 2 v1.3):
- **WE-Renovierung Basis** (Böden, Wände, Decken, Türen, Bad-Refresh, Lichtschalter): `350 €/m² × Wohnfläche WE`
- **WE-Renovierung mit Elektrik komplett neu**: `450 €/m² × Wohnfläche WE`
- **WEG-Teilung pauschal pro Haus**: `15.000 €` (Notar Teilungserklärung, Grundbuch, Aufteilungsplan, Abgeschlossenheitsbescheinigung)
- **Energetische Massnahmen** (Dach, Fassade WDVS, Fenster, Heizungstausch): aus Notion-DB EnEV `Kosten €/m² WF` × Σ Wohnfläche, falls verfügbar; sonst Default-Korridor pro Bauteil (Dach 80–120 €/m² WF, Fassade WDVS 250–300 €/m² WF, Fenster 600–800 €/Stk, Heizung 15.000–25.000 € pro Haus).

User-Werte haben immer Vorrang vor Heuristiken.

**3c) Summen berechnen:**

```
modernisierung_netto_eur = Σ kosten_netto_eur über alle massnahmen_liste-Einträge
modernisierung_brutto_eur = modernisierung_netto_eur × 1.19   # USt 19 %

nebenkosten_netto_eur = modernisierung_netto_eur × 0.10        # Default 10 % Nebenkosten (Architekt, Statik, Genehmigung)
nebenkosten_brutto_eur = nebenkosten_netto_eur × 1.19
```

**3d) Kernsanierung-Flag:**

`ist_kernsanierung = (modernisierung_netto_eur > kaufpreis_eur × 0.5) OR (mod_score >= 18 AND viele Gewerke mit Aufteiler-Massnahme)`

Konkret: User kann beim Massnahmen-Erheben „Kernsanierung ja/nein" mit-angeben. Default: Modul leitet aus Kosten-Quote ab. Wenn `ist_kernsanierung=true`: Hinweis in Zone C, Modul 2 hatte ggf. schon 90 %-Cap angewendet.

**3e) Plausibilitäts-Prüfung:**

- `modernisierung_netto_eur > 0` (mindestens RND-Gutachten + WEG ergibt > 0).
- Plausi-Warnung wenn `modernisierung_netto_eur > modul_0.angebotspreis_eur` (mehr Reno als Kaufpreis → außergewöhnlich, in Zone C ausweisen).
- Asset-Trennung: keine `subvention`/`rücklage`/`ruecklage` in `massnahmen_liste`-Texten (Validator enforced).

## 4. Output erzeugen (Drei Zonen)

**Zone A — Daten-Block (pixel-identisch über alle Objekte):**

Block 1 — Massnahmen-Tabelle:
```
| Nr | Kategorie | Ist-Zustand                  | Geplant                       | Kosten netto € | Kosten brutto € |
|----|-----------|------------------------------|-------------------------------|----------------|-----------------|
| 1  | Dach      | Eindeckung 1978, undicht     | WDVS + Neueindeckung          | 38.000         | 45.220          |
| 2  | Fenster   | 2-fach 1995                  | 3-fach Wärmeschutz            | 22.000         | 26.180          |
| …  | …         | …                            | …                             | …              | …               |
| N-1| Sonstiges | —                            | RND-Gutachten (1.000 EUR/WE)  | <X>            | <X×1.19>        |
| N  | Sonstiges | —                            | WEG-Teilung Einmalkosten      | 15.000         | 17.850          |
| Σ  |           |                              |                               | <Σ netto>      | <Σ brutto>      |
```

Block 2 — Summen + Nebenkosten:
```
| Position                          | Netto €    | Brutto €   |
|-----------------------------------|------------|------------|
| Modernisierung Summe              | <Σ netto>  | <Σ brutto> |
| Nebenkosten (10 % von Mod.)       | <NK netto> | <NK brutto>|
| Gesamtinvestition                 | <ges netto>| <ges brutto>|
```

Block 3 — Eckdaten:
```
| Parameter                | Wert                              |
|--------------------------|-----------------------------------|
| Anzahl WE (aus Modul 1)  | <N>                               |
| RND-Gutachten netto      | <1000 × N> €                      |
| WEG-Teilung netto        | <Wert> €                          |
| Energieklasse Ist        | <A+..H / unbekannt>               |
| Kernsanierung-Flag       | ja / nein                         |
| Asset-Trennung-Check     | ok                                |
```

Nicht-ermittelbare Werte: `"n/a"`, nicht weglassen.

**Zone B:**
```
Tiefenstufe: <N> von 5 (<Begründung wenn nicht 5>)
Konfidenz: <hoch|mittel|niedrig>
```

**Zone C:**

1. **Wichtigste Annahmen** (max 5 Bullets) — z.B. „WE-Reno Basis 350 €/m² als Default-Heuristik", „EnEV-Klassensprung F→D durch Dach + Fassade".
2. **Risiken / Unsicherheiten** (max 5 Bullets) — z.B. „Heizung-Kosten geschätzt, Angebot fehlt", „Brutto/Netto-Excel-Verifikation noch offen — beide Summen geliefert".
3. **Empfehlung** (1–3 Sätze) — z.B. „Vor Modul 5: Heizung + Fassade Handwerker-Angebote holen, Stufe 4 erreichen."

## 5. State persistieren

1. `modul_3`-Block bauen:
   ```json
   {
     "status": "<gruen|gelb|rot>",
     "tiefenstufe": <int 1-5>,
     "konfidenz": "<hoch|mittel|niedrig>",
     "ist_kernsanierung": <bool>,
     "massnahmen_liste": [
       {
         "kategorie": "<Dach|Fassade|Fenster|Heizung|Elektrik|Sanitaer|Boeden|Grundriss|Sonstiges>",
         "ist_zustand": "<string>",
         "geplant": "<string>",
         "kosten_netto_eur": <number>
       }
     ],
     "rnd_gutachten_netto_eur": <number = 1000 × N_WE>,
     "weg_teilung_netto_eur": <number>,
     "enev_klasse": "<A+..H|unbekannt>",
     "summen": {
       "modernisierung_netto_eur": <number>,
       "modernisierung_brutto_eur": <number>,
       "nebenkosten_netto_eur": <number>,
       "nebenkosten_brutto_eur": <number>
     }
   }
   ```
2. **Asset-Trennung-Pflichtcheck** vor State-Write: kein `massnahmen_liste`-Eintrag enthält `subvention`/`rücklage`/`ruecklage` (Validator-Doppelcheck).
3. `objekt.letzter_modul_lauf` auf `"modul_3"` setzen.
4. **Modul 2 nicht anfassen** — `modul_2.rnd_jahre` und `modul_2.rnd_frozen` bleiben unverändert. (Schema-Constraint enforced ohnehin.)
5. State schreiben.
6. `runs/<slug>/modul-3-output.md` mit Zonen A/B/C schreiben.
7. Validator-Lauf: `python tools/validate_state.py runs/<slug>/state.json`. Exit 0 = OK; ≠0 → state.json zurückrollen, Fehlertext.

## 6. Self-Check (Pflicht vor Übergabe)

- [ ] Alle Pflichtfelder befüllt (status, tiefenstufe, konfidenz, ist_kernsanierung, massnahmen_liste, rnd_gutachten_netto_eur, weg_teilung_netto_eur, enev_klasse, summen)
- [ ] `massnahmen_liste` enthält RND-Gutachten-Eintrag und WEG-Teilung-Eintrag
- [ ] `rnd_gutachten_netto_eur == 1000 × len(modul_1.we_liste)`
- [ ] **Asset-Trennung**: in keinem `massnahmen_liste`-Eintrag steht `subvention`/`rücklage`/`ruecklage` in `kategorie`/`ist_zustand`/`geplant`
- [ ] `modul_2.rnd_frozen` unverändert auf `true`
- [ ] Summen rechnerisch korrekt (Stichprobe: `modernisierung_netto_eur ≈ Σ kosten_netto_eur`)
- [ ] `modernisierung_brutto_eur ≈ modernisierung_netto_eur × 1.19` (±1 €)
- [ ] Excel-Transfer-Block (RENO-Sheet) ausgefüllt — siehe `docs/excel_handoff.md`
- [ ] `modul-3-output.md` erzeugt
- [ ] Validator-CLI exit 0

Bei rot → kein state.json-Schreiben, an Orchestrator zurück mit Fehlertext.

## 7. Übergabe an Orchestrator

Eine Zeile:
```
Modul 3 grün. <K> Massnahmen, Mod-Summe <Σ> € netto. Werte in runs/<slug>/state.json, Audit in runs/<slug>/modul-3-output.md. Freigabe für Modul 4?
```
