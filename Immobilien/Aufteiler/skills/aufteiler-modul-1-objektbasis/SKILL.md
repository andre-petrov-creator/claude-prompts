---
name: aufteiler-modul-1-objektbasis
description: Modul 1 der Aufteiler-Analyse — Objektbasis (BRW, Gebäudeanteil, WE-Liste). Wird ausschließlich vom aufteiler-Orchestrator aufgerufen.
---

# Modul 1 — Objektbasis

Zentrale Erfassung der zwei Datenstrukturen, die alle anderen Module brauchen: WE-Liste (für Modul 2/3/4/5) und Boden/Gebäude-Aufteilung (für AfA-Bemessungsgrundlage in Modul 2/5). Keine Mietberechnung, keine Sanierungsplanung, keine AfA-Logik hier.

## 1. State laden (Pflicht — erste Aktion)

1. Vom Orchestrator bekomme ich `objekt_slug`. Pfad: `runs/<objekt_slug>/state.json`.
2. State einlesen mit `Read`.
3. Pflicht-Vorgänger-Felder prüfen. Wenn etwas fehlt → STOPP, Antwort an Orchestrator:
   `"Modul 1: Pflichtfeld <pfad> fehlt. Bitte Modul 0 erneut laufen lassen."`

**Pflicht-Vorgänger:** `modul_0.status` (Quick-Check muss gelaufen sein).

## 2. Inputs erheben

Per `AskUserQuestion` einzeln (eine Frage pro Aufruf):

1. **Adresse für BRW-Lookup** — falls nicht aus `objekt.adresse` ableitbar, präzisieren (PLZ + Straße + Hausnummer).
2. **Bodenrichtwert (BRW) in €/m²** — User hat selbst auf https://www.boris.nrw.de/borisplus geschaut oder Notion-Preisdatenbank konsultiert. Format: einzelne Zahl, z.B. `380`.
3. **Grundstücksfläche in m²** — aus Exposé, Grundbuch oder Flurkarte. Format: einzelne Zahl, z.B. `420`.
4. **Anzahl Wohneinheiten (WE)** — Format: einzelne Zahl, z.B. `5`.
5. **WE-Liste** — pro WE eine Zeile, Format pro WE: `<WE-Nr>, <Lage>, <Wohnfläche m²>, <Zimmer>, <Balkon ja/nein>, <Keller ja/nein>`. Beispiel für eine Zeile:
   `1, EG, 92.98, 3, ja, ja`
   Lage-Schlüssel: `EG`, `OG_links`, `OG_rechts`, `DG_links`, `DG_rechts`, `Souterrain`, `Maisonette` (frei wählbar, lesbar).
   User darf mehrere Zeilen auf einmal liefern.

**Falls Mieterliste/Wohnflächen unvollständig:** Schätzwerte erlaubt, in Zone C unter „Risiken" notieren. Lieber Schätzung als blockieren.

## 3. Berechnung / Logik

**3a) Tiefenstufen-Wahl:**

| Stufe | Eingang vorhanden | Output |
|-------|-------------------|--------|
| 1 | BRW + Grundstück + Anzahl WE + gleichmäßig verteilte Wohnflächen | WE-Liste pauschal, Gebäudeanteil grob aus BRW |
| 2 | + individuelle Wohnflächen je WE | WE-Liste detailliert |
| 3 | + Lage/Zimmer/Balkon/Keller je WE | WE-Liste komplett |
| 4 | + BGF + NHK_2010 + BKI-Index + Sachwertfaktor | Gebäudeanteil per Sachwertverfahren ImmoWertV Anlage 4 |
| 5 | + dokumentierter Sachwertfaktor aus GMB Stadt-Subpage | FA-konforme AfA-Bemessungsgrundlage |

**`tiefenstufe_max` = 5.** Default-Ziel: Stufe 3. Stufe 4/5 nur wenn User Sachwertverfahren-Inputs aktiv liefert.

**3b) Berechnung in fester Reihenfolge:**

```
bodenwert_eur = brw_eur_pro_qm × grundstuecksflaeche_qm
kaufpreis_eur = modul_0.angebotspreis_eur  (Verhandlungsbasis; kein Re-Fragen)

# Stufe 1–3 (Fallback, vereinfachte Methode):
gebaeude_anteil_eur = kaufpreis_eur − bodenwert_eur
gebaeude_anteil_prozent = (gebaeude_anteil_eur / kaufpreis_eur) × 100

# Stufe 4–5 (Sachwertverfahren ImmoWertV Anlage 4):
#   NHK_2010_indexiert = NHK_2010 × (BKI_2026 / BKI_2010)
#   Alterswertminderung = (Alter / GND) × (1 − Modpunkte/20)
#   Gebäudesachwert_vorlaeufig = NHK_indexiert × BGF × (1 − Alterswertminderung) × Mod_Faktor
#   Vorlaeufiger_Sachwert = bodenwert + Gebäudesachwert_vorlaeufig
#   Marktangepasst = Vorlaeufiger × Sachwertfaktor
#   Gebäude_KP_Anteil = Kaufpreis × Gebäudesachwert_vorlaeufig / Vorlaeufiger_Sachwert
#   gebaeude_anteil_prozent = (Gebäude_KP_Anteil / Kaufpreis) × 100
```

In Stufe 4–5 sind die Modpunkte und GND noch nicht aus Modul 2 verfügbar (Modul 2 läuft nach Modul 1). Default-Annahmen `GND=80`, `Modpunkte=0`. Modul 2 kann später nachjustieren — kein Re-Schreiben von Modul 1, sondern Hinweis in Modul 2 Zone C.

**3c) Plausibilitäts-Prüfung:**

- `brw_eur_pro_qm > 0`, typisch 50–2000 €/m² in NRW.
- `gebaeude_anteil_prozent` zwischen 50 % und 90 % → grün. Außerhalb → Warnung in Zone C, kein Hard-Stop.
- Wohnfläche pro WE zwischen 10 und 250 m² (Schema-Grenze).
- Zimmer-Anzahl zwischen 1 und 8 (Schema-Grenze).
- Summe Wohnflächen WE-Liste muss zur Gesamt-Wohnfläche (falls separat angegeben) im Rahmen ±5 % passen.

## 4. Output erzeugen (Drei Zonen)

**Zone A — Daten-Block (pixel-identisch über alle Objekte):**

Block 1 — Objekt-Eckdaten:
```
| Position                           | Wert                                          |
|------------------------------------|-----------------------------------------------|
| Adresse                            | <objekt.adresse>                              |
| Stadt                              | <objekt.stadt>                                |
| Anzahl WE                          | <N>                                           |
| Grundstück                         | <grundstuecksflaeche_qm> m²                   |
| BRW                                | <brw_eur_pro_qm> €/m²                         |
| Bodenwert                          | <bodenwert_eur> €                             |
| Kaufpreis (aus Modul 0)            | <kaufpreis_eur> €                             |
| Gebäude-KP-Anteil                  | <gebaeude_eur> €                              |
| Gebäudeanteil %                    | <gebaeude_anteil_prozent> %                   |
| Methodik Gebäudeanteil             | Sachwertverfahren / Fallback (vereinfacht)    |
| Plausibilitäts-Check Gebäudeanteil | ok / warnung                                  |
```

Block 2 — WE-Liste:
```
| WE-Nr | Lage          | Wohnfläche m² | Zimmer | Balkon | Keller |
|-------|---------------|---------------|--------|--------|--------|
| 1     | EG            | 92.98         | 3      | ja     | ja     |
| …     | …             | …             | …      | …      | …      |
| Summe |               | <Σ qm>        |        |        |        |
```

Nicht-ermittelbare Werte: `"n/a"`, nicht weglassen.

**Zone B — Tiefenstufen-Deklaration (genau zwei Zeilen, byte-identisches Format):**

```
Tiefenstufe: <N> von 5 (<Begründung wenn nicht 5>)
Konfidenz: <hoch|mittel|niedrig>
```

**Zone C — Begründungs-Block (Struktur fix, Formulierung frei):**

1. **Wichtigste Annahmen** (max 5 Bullets) — z.B. „BRW aus BORIS.NRW PLZ 45356 Stand 2024", „WE-Flächen aus Exposé Seite 3".
2. **Risiken / Unsicherheiten** (max 5 Bullets) — z.B. „WE 3 Wohnfläche nur geschätzt (Mieterliste fehlt)", „Gebäudeanteil bei 92 % → BRW evtl. zu niedrig".
3. **Empfehlung** (1–3 Sätze) — z.B. „Stufe 3 reicht für Modul 2/4. Vor Modul 5 BGF + Sachwertfaktor nachreichen für FA-konforme AfA."

## 5. State persistieren

1. `modul_1`-Block bauen (gemäß `docs/state-schema.md`):
   ```json
   {
     "status": "<gruen|gelb|rot>",
     "tiefenstufe": <int 1-5>,
     "tiefenstufe_max": 5,
     "konfidenz": "<hoch|mittel|niedrig>",
     "brw_eur_pro_qm": <number>,
     "gebaeude_anteil_prozent": <number>,
     "we_liste": [
       {
         "we_nr": <int>,
         "lage_im_haus": "<string>",
         "wohnflaeche_qm": <number>,
         "zimmer_anzahl": <number>,
         "balkon": <bool>,
         "keller": <bool>
       }
     ]
   }
   ```
2. `objekt.letzter_modul_lauf` auf `"modul_1"` setzen.
3. State schreiben (komplettes Objekt, nicht patchen).
4. `runs/<slug>/modul-1-output.md` mit Zonen A/B/C schreiben (Audit-Trail).
5. Validator-Lauf: `python tools/validate_state.py runs/<slug>/state.json`. Exit 0 = OK; ≠0 → state.json zurückrollen, Fehlertext an Orchestrator.

## 6. Self-Check (Pflicht vor Übergabe)

- [ ] Alle Pflichtfelder im Schema befüllt (status, tiefenstufe, tiefenstufe_max, konfidenz, brw_eur_pro_qm, gebaeude_anteil_prozent, we_liste)
- [ ] `we_liste` enthält mindestens 1 Eintrag, jeder Eintrag schemakonform
- [ ] `brw_eur_pro_qm > 0`, Wohnflächen im Bereich 10–250 m², Zimmer 1–8
- [ ] `gebaeude_anteil_prozent` zwischen 0 und 100 (Plausi-Warnung 50–90 ggf. in Zone C)
- [ ] Excel-Transfer-Block ausgefüllt (siehe `docs/excel_handoff.md` Sheet MIETER + KALKU)
- [ ] `modul-1-output.md` erzeugt
- [ ] Validator-CLI exit 0

Bei rot → kein state.json-Schreiben, an Orchestrator zurück mit Fehlertext.

## 7. Übergabe an Orchestrator

Eine Zeile:
```
Modul 1 grün. WE-Liste mit <N> Einträgen, Gebäudeanteil <X> %. Werte in runs/<slug>/state.json, Audit in runs/<slug>/modul-1-output.md. Freigabe für Modul 2?
```
