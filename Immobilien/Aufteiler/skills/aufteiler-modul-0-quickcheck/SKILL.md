---
name: aufteiler-modul-0-quickcheck
description: Modul 0 der Aufteiler-Analyse — Quick-Check. Vergleicht Angebotspreis gegen ETW-Konsens (Marktwert pro WE × Anzahl WE), prüft Gap-Schwelle 5%. Wird ausschließlich vom aufteiler-Orchestrator aufgerufen, NICHT direkt durch User.
---

# Modul 0 — Quick-Check

Erstes Gate: Lohnt sich der Deal überhaupt? Gap-Check Angebotspreis vs. ETW-Konsens.

## 1. State laden (Pflicht — erste Aktion)

1. Vom Orchestrator: `objekt_slug`. Pfad: `runs/<objekt_slug>/state.json`.
2. State einlesen mit `Read`.
3. Pflicht: `objekt.slug`, `objekt.adresse`, `objekt.stadt`. Wenn fehlt → STOPP, an Orchestrator: "Modul 0: objekt.adresse fehlt."

## 2. Inputs erheben

Per `AskUserQuestion` einzeln:
1. "Angebotspreis des Objekts (€)?"
2. "ETW-Konsens (Marktwert pro WE in €) und Anzahl WE? Format: `<Preis_pro_WE>, <Anzahl_WE>` (z.B. `180000, 6`)."

Falls User unsicher beim ETW-Konsens: Fallback-Hilfe — "ETW-Konsens schätzt du aus aktuellen Verkaufspreisen vergleichbarer Wohnungen im Stadtteil. Wenn unbekannt: bitte später nachreichen."

## 3. Berechnung / Logik

**3a) Tiefenstufen-Wahl:**

| Stufe | Eingang vorhanden | Berechnung |
|-------|-------------------|------------|
| 1 | Angebot + ETW-Konsens-Schätzung | Gap-% gegen Schätzung |
| 2 | + ETW-Konsens via Vergleichsobjekte | Gap-% gegen belastbare Vergleichsbasis |
| 3 | + Stadtteil-Marktdaten | Gap-% + Marktdaten-Kontext |
| 4 | + Vermarktungsdauer / Preisanpassungen | + Dynamik-Indikator |
| 5 | + voll dokumentierter Verkaufsprozess | + Verhandlungs-Hebel |

In Modul 0 reicht **Stufe 1 oder 2**.

**3b) Berechnung in fester Reihenfolge:**

```
etw_konsens_eur = etw_konsens_pro_we_eur × anzahl_we
gap_eur = angebotspreis_eur − etw_konsens_eur
gap_prozent = (gap_eur / etw_konsens_eur) × 100
ueber_schwelle = (gap_prozent > 5)
```

**3c) Status-Ableitung:**
- `gap_prozent ≤ 0` (Angebot unter Konsens) → `status = "gruen"`
- `0 < gap_prozent ≤ 5` → `status = "gelb"`
- `gap_prozent > 5` → `status = "rot"` (Empfehlung: Verhandeln oder skippen)

**Plausibilität:** `angebotspreis_eur` zwischen 50.000 und 5.000.000 (außerhalb → User-Rückfrage).

## 4. Output erzeugen

**Zone A — Daten-Block:**

```
| Position                  | Wert              |
|---------------------------|-------------------|
| Angebotspreis             | <X> €             |
| ETW-Konsens               | <Y> € (<W> WE × <P> €/WE) |
| Gap absolut               | <G> €             |
| Gap %                     | <G%> %            |
| Schwellen-Überschritt 5%? | ja/nein           |
| Status                    | grün/gelb/rot     |
```

**Zone B:**
```
Tiefenstufe: <N> von 5 (<wenn nicht 5: Begründung welche Daten fehlen>)
Konfidenz: <hoch|mittel|niedrig>
```

**Zone C:**
1. **Wichtigste Annahmen** (max 5 Bullets)
2. **Risiken / Unsicherheiten** (max 5 Bullets)
3. **Empfehlung** (1–3 Sätze, z.B. "Verhandeln auf <Y> €.")

## 5. State persistieren

1. `modul_0`-Block bauen:
   ```json
   {
     "status": "<gruen|gelb|rot>",
     "tiefenstufe": <int>,
     "konfidenz": "<hoch|mittel|niedrig>",
     "ausgefuehrt_am": "<jetzt ISO>",
     "angebotspreis_eur": <number>,
     "etw_konsens_eur": <number>,
     "gap_prozent": <number>,
     "ueber_schwelle": <bool>
   }
   ```
2. `objekt.letzter_modul_lauf` auf `"modul_0"` setzen.
3. State schreiben.
4. `runs/<slug>/modul-0-output.md` mit Zonen A/B/C schreiben.
5. Validator-Lauf: `python tools/validate_state.py runs/<slug>/state.json`. Exit 0 = OK; ≠0 → state.json zurückrollen, Fehlertext zurückgeben.

## 6. Self-Check

- [ ] Alle Pflichtfelder befüllt
- [ ] `gap_prozent` rechnerisch korrekt (Stichprobe: `(angebot − konsens)/konsens × 100`)
- [ ] Status passt zur Schwelle
- [ ] `modul-0-output.md` erzeugt
- [ ] Validator-Exit 0

Bei rot → kein State-Write, an Orchestrator: "Modul 0 rot, Grund: <Fehlertext>".

## 7. Übergabe

```
Modul 0 grün. Status: <gruen|gelb|rot>. Gap: <G%>%. Werte in runs/<slug>/state.json. Freigabe für Modul 1?
```
