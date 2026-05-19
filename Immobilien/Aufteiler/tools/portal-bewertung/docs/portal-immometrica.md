# Portal: Immometrica

## Zweck

Adapter fuer **Immometrica.com**, ein Paid-B2B-Portal fuer
Immobilien-Investoren. Liefert objektspezifische Marktstatistiken
(Anzahl Angebote, Median Preis pro m², Median Onlinezeit, Rendite)
**pro PLZ und Stadt** fuer Kauf + Miete in der Asset-Klasse
ETW und Mehrfamilienhaus.

Step 14 im Implementierungsplan — ersetzt das urspruenglich geplante
ImmoScout24 als 4. Portal.

## Files

- `portals/immometrica/__init__.py`
- `portals/immometrica/parsers.py` — DOM-Body → Stat-Block-Parser
- `portals/immometrica/portal.py` — Adapter inkl. nodriver-Steuerung
- `inspectors/login_immometrica_autonomous.py` — Auto-Login + Cookie-Export
- `inspectors/training_immometrica.py` — Browser offen halten + Network-Sniff
- `inspectors/auto_statistics_immometrica.py` — Vollautonome 6-Filter-Sniff (Dev)
- `inspectors/sniff_immometrica_search.py` — Adress-Such-Probing (Dev)
- `inspectors/debug_immometrica_dom.py` — DOM-Inspector (Dev)
- `inspectors/probe_location_api.py` — Location-API-Probe (Dev)
- `inspectors/test_immometrica_adapter.py` — Live-Smoke-Test
- `tests/test_portals_immometrica_parsers.py` — 15 Unit-Tests (alle gruen)
- `learned_selectors/immometrica_nodriver_userdata/` — Browser-User-Daten
  (gitignored)
- `learned_selectors/immometrica_cookies.json` — Cookie-Snapshot (gitignored)
- `.env` — Login-Credentials `IMMOMETRICA_USERNAME` / `IMMOMETRICA_PASSWORD`

## Architektur — anders als andere Portale

Immometrica verwendet **reCAPTCHA v2** vor dem Login, das Standard-Playwright
sofort blockt ("keine Verbindung zum reCAPTCHA-Dienst"). Selbst System-Chrome
mit `channel="chrome"` + `--disable-blink-features=AutomationControlled`
reicht nicht.

Loesung: **[nodriver](https://github.com/ultrafunkamsterdam/nodriver) statt
Playwright**. Modernster Anti-Detection-Chrome-Treiber (Successor zu
undetected-chromedriver), steuert Chrome direkt via CDP mit allen
bekannten Bot-Markern gepatcht.

Konsequenz:
- Adapter erbt **nicht** von `PortalBase`. PortalBase ist Playwright-spezifisch.
- Adapter hat eigene `run_immometrica(plz, stadt)` Sync-API.
- CLI `m00_portal_pricer.py` hat einen Special-Case fuer `--portal immometrica`.

## Datenfluss

```
m00_portal_pricer.py --portal immometrica --datensatz <json>
   │
   ▼
portals.immometrica.portal.run_immometrica(plz, stadt, year_half, headless)
   │
   ├──► nodriver: launch_persistent_context(user_data_dir=...)
   │       └── Persistente Cookies → kein Re-Login noetig
   │           Falls Session abgelaufen: _do_login() mit .env-Credentials
   │
   ├──► Fuer jede Config (plz_etw / plz_mfh / stadt_etw / stadt_mfh):
   │       1. tab.get(URL_STATISTICS)
   │       2. _select_period("H1/2026")          ← klick Halbjahr-Button
   │       3. _select_radio("ETW" | "Hauskauf")  ← label[for=id_type_X].click()
   │       4. _click_bauliches_tab() + _click_mfh_checkbox / _uncheck_mfh_checkbox
   │       5. _set_geo_via_api(geo_query, expected) ← /de/api/location + hidden Input
   │       6. _click_create_stat()               ← "Statistik erstellen" Click
   │       7. _wait_for_stat_loaded()
   │       8. body = innerText → parsers.parse_stat_block(body)
   │
   └──► Final: dict mit RunResult-Schema + extra-Slot
```

## Output-Schema

```json
{
  "status": "ok|partial|error",
  "portal": "immometrica",
  "marktwert_eur_mittel": null,
  "marktwert_eur_min": null,
  "marktwert_eur_max": null,
  "trends": {"jahre_3": null, "jahr_1": null, "prognose": null},
  "trend_ampel": null,
  "trend_label": null,
  "url": "https://www.immometrica.com/de/statistics",
  "timestamp": "<iso>",
  "extra": {
    "year_half": "H1/2026",
    "plz_input": "45357",
    "stadt_input": "Essen",
    "plz_etw":   {"status": "ok", "geo_state": "...", "uebersicht": {...}, "zusatzinfo": {...}},
    "plz_mfh":   {"status": "ok", ...},
    "stadt_etw": {"status": "ok", ...},
    "stadt_mfh": {"status": "ok", ...}
  }
}
```

Jeder Stat-Block hat:
```json
{
  "uebersicht": {
    "heading": "Wohnung kaufen | Haus kaufen | ...",
    "anzahl_angebote": <int>,
    "median_preis_eur_per_qm": <float>,
    "median_onlinezeit_tage": <int>,
    "rendite_pct": <float|null>
  },
  "zusatzinfo": {
    "heading": "Wohnung mieten | Haus mieten",
    "anzahl_angebote": <int>,
    "median_preis_eur_per_qm": <float>,
    "median_onlinezeit_tage": <int>,
    "rendite_pct": null
  }
}
```

**Wichtig:** `marktwert_eur_*` ist immer `null`, weil Immometrica keine
objektspezifische Marktwert-Schaetzung in dem Sinne liefert (das macht
der Sprengnetter-AVM-Wertbericht hinter einer separaten Bezahlschranke).
Modul 0 nutzt die Statistiken zur Quervalidierung des CHECK24/Homeday-
Marktwerts und fuer Markt-Score (Anbieter-Dichte, Onlinezeit-Indikator,
Renditen).

## Bekannte Limitierungen

### Filter-Autonomie (Phase 2 TODO)

**Aktueller Stand:** Der Adapter ruft korrekt die `/de/api/location` API
auf, holt die Location-ID, und setzt das hidden Form-Input `id_location`.
**Aber:** Die UI ist React-basiert (React-Select fuer Ort, custom-control
fuer Object-Typ-Radio), und der serverseitige Filter-State wird beim
Submit aus dem React-Component-Tree gelesen, nicht aus dem hidden Input.

Konsequenz: **Alle 4 Configs liefern denselben Wert** — naemlich den
zuletzt manuell gesetzten Filter-State.

Workaround fuer jetzt: Vor dem ersten autonomen Adapter-Run muss der
User **einmal manuell** die Filter im Browser setzen
(via `inspectors/training_immometrica.py`). Der Sticky-State wird
serverseitig gespeichert und vom Adapter genutzt.

**Phase 2 — Loesungs-Optionen:**
1. **Direct-POST an IntercoolerJS-Endpoint:** `/de/statistics` mit Query-
   Params + CSRF-Token. Format aus dem Network-Log reverse-engineeren.
2. **CDP Input.dispatchKeyEvent:** Echte Tastatur-Events statt
   synthesized fuer React-Select.
3. **Klick auf serverseitig vor-gerenderte Suggestions:** Nicht React-
   gefilterte Suggestions, sondern Original-Server-Liste.

### reCAPTCHA bei Login-Refresh

Wenn die persistierte Session abgelaufen ist (Cookies-Expiration nach
einigen Tagen), versucht der Adapter Auto-Login. reCAPTCHA kann dann
wieder zuschlagen. Bisher: **selten** — nodriver hat in unseren Tests
zuverlaessig durchgewunken (reCAPTCHA-passive).

Fallback: manuelles `inspectors/login_immometrica_autonomous.py` einmal
laufen lassen, dann ist der State wieder frisch.

### ToS-Risiko

Immometrica's AGB fuer Investor/Pro-Abos verbieten mit hoher
Wahrscheinlichkeit automatisierte Abfragen. Risiko: Account-Sperre.
Mitigation:
- Max 1× pro Aufteiler-Lauf
- Keine Bulk-Abfragen
- Keine festen Zeitfenster

Diese sind im Adapter aktuell NICHT enforced — User entscheidet pro Lauf.

## Schnittstellen

### Python-API

```python
from portals.immometrica.portal import run_immometrica

result = run_immometrica(
    plz="45357",
    stadt="Essen",
    year_half="H1/2026",
    headless=True,
)
# result: dict mit dem oben dokumentierten Schema
```

### CLI

```bash
.venv/Scripts/python.exe m00_portal_pricer.py \
  --portal immometrica \
  --strasse "Prosperstraße" --hausnr 59 --plz 45357 --ort Essen \
  --baujahr 1965 --zustand gut --ausstattung normal \
  --anzahl-we 4 --gesamtwohnflaeche-qm 320 --gesamtzimmer 12 \
  --headless
```

## Smoke-Test

Voraussetzung: `learned_selectors/immometrica_nodriver_userdata/` existiert
(einmaliger Login bereits durchgefuehrt) UND der User hat einmal manuell
die gewuenschten Filter in der Marktstatistik-Page gesetzt.

```bash
.venv/Scripts/python.exe inspectors/test_immometrica_adapter.py
```

Erwartet: Status `ok`, alle 4 extra-Slots gefuellt mit `uebersicht`-Werten.

## Memory-Bezuege

- [[immobilien-portale-strassen-kurzform]] — Immometrica nutzt keine
  Strassen-Eingabe (nur PLZ + Stadt), Strassen-Kurzform irrelevant.
- [[portal-bewertung-blueprint-workflow]] — Step 14 jetzt mit
  Filter-Limit-Caveat.
- [[portal-bewertung-step-14-immometrica]] — komprimierter Stand.
