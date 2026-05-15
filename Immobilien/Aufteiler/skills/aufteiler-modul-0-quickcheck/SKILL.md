---
name: aufteiler-modul-0-quickcheck
description: Modul 0 der Aufteiler-Analyse — Quick-Check. Vergleicht Angebotspreis gegen Marktwert-Konsens, prüft Gap-Schwelle 5%. Zwei Modi (Abschnitt 0 entscheidet) Orchestrator-Modus (vom aufteiler-Skill aufgerufen, state.json + AskUserQuestion) und Akquise-Modus (vom lokalen Akquise-Watcher aufgerufen, Ordnerpfad mit PDFs als Eingabe, CHECK24-Python-Tool als Marktwert-Quelle, Lead-Insert in Supabase + Markdown in OneDrive).
---

# Modul 0 — Quick-Check

Erstes Gate: Lohnt sich der Deal überhaupt? Gap-Check Angebotspreis vs. ETW-Konsens.

## 0. Modus-Erkennung (erste Aktion — Pflicht)

Zuerst feststellen, in welchem Modus ich laufe.

**Aufruf-Indikatoren:**

| Indikator | Modus |
|---|---|
| User-Prompt enthält "im Akquise-Modus" + Ordnerpfad | Akquise-Modus |
| Ordnerpfad zeigt auf `.../001_AQUISE/_inbox/<msg-id>/` mit `_meta.json` + `.processing` | Akquise-Modus (sicher) |
| Eingabe vom Orchestrator: `objekt_slug` | Orchestrator-Modus |
| `runs/<slug>/state.json` existiert | Orchestrator-Modus |

Wenn unsicher: **Akquise-Modus annehmen falls Ordnerpfad gegeben, sonst Orchestrator-Modus**.

### 0.1 Orchestrator-Modus

→ Springe zu Abschnitt 1. Bisheriger Workflow unverändert.

### 0.2 Akquise-Modus — Stub-Workflow (Erstversion 2026-05-15)

> **Stub-Hinweis:** Diese Erstversion nutzt nur CHECK24 als Marktwert-Quelle. User-Plan `Aufteiler/plans/2026-05-15-portal-bewertung-framework.md` erweitert das später um Homeday, Interhyp, ImmoScout24 (Konsens-Median über alle 4). Bis dahin: CHECK24 als einzige Quelle.

**A. Inputs aus Ordner laden**

1. Argument: `<folder>` aus dem User-Prompt extrahieren (alles nach "Ordnerpfad:").
2. `_meta.json` aus `<folder>` lesen → Header-Info (subject, from, files-Liste).
3. PDFs aus `<folder>` listen — alles mit Endung `.pdf`.
4. Pro PDF: `Read` aufrufen oder PDF-Skill nutzen → Textinhalt.
5. Falls `body.txt` im Ordner liegt: einlesen — enthält den Mail-Body-Text als sekundäre Quelle.

**Adress-Priorisierung (sehr wichtig — gegen False-Positives):**

- Objektadresse kommt **PRIMÄR** aus dem Exposé-PDF.
- `body.txt` ist nur Sekundär-Quelle für Plausibilitäts-Check oder als Fallback, wenn das PDF keine Adresse hergibt.
- Maklerfirma-Adressen aus Signaturen, Footern, Disclaimer-Blöcken im Body (z.B. "Mit freundlichen Grüßen, Max Müller, Müller Immobilien GmbH, Hauptstraße 1, 45525 Hattingen, info@mueller.de") dürfen **NIEMALS** als Objektadresse verwendet werden.
- Sender-Email (`_meta.json.from`) wird **ausschließlich** für die Kontakt-Erstellung benutzt, **nie** für Objekt-Identifikation.
- Im Zweifel: Adresse leer lassen + Markdown-Hinweis "Adresse nicht eindeutig erkennbar — manuelle Prüfung". Lieber kein Lead als ein falscher Lead.

**B. Generalisierten Datensatz extrahieren (LLM-intern)**

Aus den PDF-Texten + Mail-Header die folgenden Felder ableiten:

```json
{
  "adresse": { "strasse": "...", "hausnummer": "...", "plz": "...", "ort": "..." },
  "baujahr": <int>,
  "zustand": "neuwertig|gut|sanierungsbeduerftig",
  "ausstattung": "einfach|normal|gehoben",
  "anzahl_we": <int>,
  "wohnflaechen_qm": [<float>, ...],
  "zimmer_liste": [<float>, ...],
  "badezimmer_liste": [<int>, ...],
  "anzahl_garagen": <int>,
  "anzahl_aussenstellplaetze": <int>,
  "angebotspreis_eur": <number>
}
```

Bei Felder-Lücken: Sinnvolle Defaults setzen (z.B. `badezimmer_liste`: 1 pro WE wenn ≥50% WE >50qm, sonst 2 inklusive Gäste-WC; `ausstattung`: "normal"). Defaults im quickcheck-log.md dokumentieren.

**C. CHECK24-Tool aufrufen**

Run via `Bash`:
```bash
cd c:\meine-projekte\Immobilien\Aufteiler
python tools/m00_check24_pricer.py \
  --strasse "<strasse>" --hausnr <hausnummer> --plz <plz> --ort "<ort>" \
  --baujahr <baujahr> --zustand <zustand> --ausstattung <ausstattung> \
  --anzahl-we <anzahl_we> --wohnflaechen-qm "<komma-separiert>" \
  --zimmer-liste "<komma-separiert>" --badezimmer-liste "<komma-separiert>" \
  --anzahl-garagen <anzahl_garagen> --anzahl-aussenstellplaetze <aussen> --headless
```

> **Tool-Pfad-Hinweis:** Der CLI-Entry-Point ist `tools/m00_check24_pricer.py` (im Root von `tools/`), die Library-Module liegen unter `tools/check24/` (form_steps.py, dom_selectors.py, etc.). Voraussetzung: Python-venv aktiv, `pip install -r tools/check24/requirements.txt` ausgeführt, `playwright install chromium` einmal gemacht.

Output ist JSON. Parsen → `marktwert_eur_mittel`, `trend_ampel`, `trend_3j_prozent`.

**Fehler-Pfad:** Wenn Tool nicht da, Python-ENV kaputt, oder JSON unleserlich → setze `marktwert_eur_mittel = null`, `marktwert_quelle = "fehler"`, `error_msg = <Stacktrace>`. Pipeline läuft trotzdem durch mit Score=50 + Markdown-Hinweis "Marktwert-Quelle nicht verfügbar".

**D. Gap-Berechnung (wie Abschnitt 3, aber mit CHECK24-Marktwert)**

```
marktwert_konsens_eur = marktwert_eur_mittel
gap_eur = angebotspreis_eur − marktwert_konsens_eur
gap_prozent = (gap_eur / marktwert_konsens_eur) × 100
status = (siehe Abschnitt 3c: gruen ≤ 0, gelb 0-5, rot >5)
```

**E. Priority-Score-Mapping**

| Status | Score-Range | Logik |
|---|---|---|
| gruen | 70-90 | `max(70, 90 - abs(gap_prozent))` |
| gelb | 50-70 | `60 - gap_prozent × 2` |
| rot | 10-50 | `max(10, 40 - gap_prozent)` |
| marktwert_quelle=fehler | 50 | hard-coded neutral |

**F. Ordner umbenennen**

1. Adress-Slug bauen (Konvention `Aufteiler/CLAUDE.md`): kebab-case, Umlaute ersetzt.
   - Beispiel: `Welperstraße 39, 45525 Hattingen` → `welperstr-39-hattingen`.
2. Ziel-Pfad: `<OneDrive>/Immobilien/001_AQUISE/Objekte/<slug>/`.
3. Duplikat-Check: existiert Ziel? → Suffix `_2`, `_3` etc.
4. `Move-Item _inbox/<msg-id>/ → Objekte/<slug>/`.

**G. Markdown schreiben**

In `<slug>/quickcheck.md`:
```markdown
# Quick-Check — <Adresse>

| Position | Wert |
|---|---|
| Angebotspreis | <angebotspreis> € |
| Marktwert (CHECK24) | <marktwert> € |
| Gap absolut | <gap_eur> € |
| Gap % | <gap_prozent> % |
| Status | <gruen|gelb|rot> |
| Priority-Score | <score> / 100 |

## Annahmen
- <Liste der gesetzten Defaults>

## Marktwert-Quelle
- CHECK24, Trend-Ampel: <trend_ampel>, 3J-Trend: <trend_3j_prozent>%
- (Später: Homeday, Interhyp, ImmoScout24)

## Maklerinfo
- Von: <name> <email>
- Subject: <subject>
- Empfangen: <date>
```

**H. Workspace-Datei schreiben**

In `<slug>/<slug>.code-workspace`:
```json
{
  "folders": [{ "path": "." }],
  "settings": {
    "terminal.integrated.defaultProfile.windows": "PowerShell"
  },
  "tasks": {
    "version": "2.0.0",
    "tasks": [
      {
        "label": "Start Claude Code",
        "type": "shell",
        "command": "claude",
        "presentation": { "reveal": "always", "panel": "shared" },
        "runOptions": { "runOn": "folderOpen" },
        "problemMatcher": []
      }
    ]
  }
}
```

**I. Supabase-Inserts (REST via Service-Role-Key)**

Pflicht-Felder aus `.env` (vom Watcher übergeben): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

1. `POST /rest/v1/contacts` (Email-Upsert via `Prefer: resolution=merge-duplicates,return=representation`)
   - Felder: `name`, `email`, `phone`/`company`/`position` falls aus Mail-From extrahierbar
2. `POST /rest/v1/deals`
   - Felder: `address=<strasse + hausnummer>`, `city=<ort>`, `zip=<plz>`, `priority_score`, `priority_reason=<short>`, `inbox_message_id`, `expose_local_path=<onedrive-pfad>`, `expose_url=<onedrive-weburl-falls-vorhanden>`, `workspace_path=<pfad-zur-workspace-datei>`, `expose_source='mail-pipeline'`, `status='pre_screened'`, `contact_id=<aus-step-1>`, `preis_kauf=<angebotspreis_eur>`, `einheiten=<anzahl_we>`, `wohnflaeche_m2=<summe-aus-wohnflaechen_qm-falls-vorhanden>`
   - Schema-Hinweis: `deals`-Tabelle hat **kein `label`-Feld** (Stand 2026-05-15). Primärer Identifier ist `address` + `city` + `zip`. Bei fehlender Adresse aus PDF: Adresse leer lassen, Status bleibt `pre_screened`, User identifiziert manuell.
3. `POST /rest/v1/activity_log`
   - `activity_type='new_lead'`, `deal_id`, `contact_id`, `payload={source,priority_score,priority_reason}`
4. `PATCH /rest/v1/mail_queue?message_id=eq.<id>`
   - `status='done'`, `done_at=now()`, `deal_id`

Bei 4xx/5xx aus Supabase: `quickcheck-log.md` mit Fehler-Detail, `mail_queue.status='error'`, `error_msg=<msg>`. Watcher sieht non-zero exit-code → setzt `.processing` → `.error`.

**J. quickcheck-log.md (Audit-Spur)**

In `<slug>/quickcheck-log.md` alle Roh-Eingaben + LLM-Antworten + Tool-Outputs + Defaults + Berechnungen ablegen (für späteres Debugging / Modul-0-Refactor).

**K. Aufräumen**

- `.processing` nicht selbst löschen — das macht der Watcher bei Exit-Code 0.

**L. Übergabe-Statement**

Skill antwortet zum Schluss (für Log-Stream):
```
Modul 0 (Akquise-Modus) fertig. Status: <status>. Score: <score>. Lead-ID: <deal-id>. Ordner: <pfad>.
```

---

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
