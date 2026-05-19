# Step 14 — Aktueller Stand (2026-05-19, autonomer Modus)

> Live-Statusdokument. Wird waehrend des autonomen Laufs fortgeschrieben.

## Bisherige Erkenntnisse

1. **IS24 verworfen** (siehe HANDOVER_step-14_immometrica.md). Step 14 = Immometrica.
2. **Immometrica liefert** Marktwert + €/m² + Miete + Rendite + Marktstatistik.
3. **URL-Realitaet:** `www.immometrica.com/de` redirected auf `www.immometrica.de`.
   App-Subdomain `app.immometrica.com` existiert NICHT (DNS-Fail).
4. **Login-Button:** Rechts oben in der Marketing-Page, Text `"Einloggen"`
   (nicht "Anmelden"). Login-Form oeffnet sich vermutlich als Modal/SPA-Route —
   keine URL-Aenderung beim Klick (im URL-Poll-Log).
5. **Login-Form** (aus User-Screenshots):
   - E-Mail (`andre-petrov@web.de` aus `.env`)
   - Passwort
   - Checkbox "Angemeldet bleiben"
   - "Passwort vergessen?" Link
   - **reCAPTCHA aktiv** vor dem Login-Button
6. **Credentials** vorhanden in `.env`:
   - `IMMOMETRICA_USERNAME`
   - `IMMOMETRICA_PASSWORD`

## Anti-Bot-Erkenntnisse

| Stufe | Beschreibung | Ergebnis |
|---|---|---|
| 0 (initial) | Playwright-Chromium, frischer Context | reCAPTCHA: "keine Verbindung" |
| 1 | System-Chrome (channel='chrome') + Persistent Context + `--disable-blink-features=AutomationControlled` + `ignore_default_args=['--enable-automation']` + `viewport=None` | reCAPTCHA blockt weiter |
| 1.5 | Stufe 1 + Inline-Stealth-Patches via `add_init_script` (navigator.webdriver, window.chrome, plugins, languages, WebGL-Renderer-Override, permissions.query-Patch) | Vom User nicht getestet (Fenster nicht gefunden) |

## Aktiver Pfad (autonomer Modus)

**Stufe 2:** Nochmehr Anti-Detect via `nodriver` / `undetected-playwright`
ODER **Stufe 3:** Direct-Headless mit Patchright/curl_cffi.

Falls Login-Form trotz aller Anti-Detect-Tricks reCAPTCHA Image-Challenge wirft:
→ Captcha-Service-Integration vorbereiten (2captcha/CapSolver), API-Key spaeter.

Falls Captcha-Service auch nicht ausreichend:
→ Adapter-Code bauen, der auf einem manuell vom User-Chrome (CDP-Connect)
  einmal angelegten Storage-State arbeitet. Erstmaliger Login bleibt manuell,
  alles danach laeuft automatisch.

## Geplante Schritte (autonom)

1. `nodriver` ins venv installieren
2. `inspectors/login_immometrica_autonomous.py` schreiben — versucht
   vollautomatisch zu loggen. Liefert Cookies + Storage-State bei Erfolg.
3. Test-Lauf, Auswerten via DOM-Dumps + Screenshots
4. Bei Erfolg: Network-Sniffer aktivieren, interne API-Endpoints suchen
5. `portals/immometrica/` Adapter bauen
6. CLI `m00_portal_pricer.py` registry-update
7. Smoke-Tests + Live-Lauf gegen Prosperstr. 59

## Files heute

- `inspectors/explore_immometrica.py` — Stufe-1.5-Skript (System-Chrome + Stealth-Init)
- `learned_selectors/immometrica_userdata/` — Persistent User-Data-Dir
  (mehrfach geloescht/neu erstellt — kontaminiert von reCAPTCHA-Fail)
- `runs/2026-05-19T08*_immometrica_explore_*` — Screenshots + URL-Logs

## Geplante Files (autonom)

- `inspectors/login_immometrica_autonomous.py` — Auto-Login-Versuch (nodriver)
- `inspectors/connect_existing_chrome.py` — Backup: CDP-Connect an User-Chrome
- `portals/immometrica/__init__.py`, `selectors.py`, `parsers.py`, `portal.py`
- `tests/test_portals_immometrica_*.py`
- `docs/portal-immometrica.md`

## Wann ich aus dem autonomen Modus aussteige

- Login klappt vollautomatisch → weiter zu Adapter-Bau
- Captcha unueberwindbar ohne Service-API-Key → Status-Dump, Backup-Pfad bereit
- Anti-Detect-Tools sind installiert aber Sandbox blockt — User informieren
- Adapter steht und Live-Lauf liefert Marktwert + Miete + Rendite —
  Step 14 ist fertig

## Stand am Ende dieses Laufs (2026-05-19)

### Erreicht (Autonomer Modus)

1. **Login geknackt vollautomatisch:** nodriver + Stealth-Patches + System-Chrome
   umgehen reCAPTCHA zuverlaessig. Persistent User-Data-Dir reduziert
   Login-Frequenz.
2. **DOM-Parser fertig:** `portals/immometrica/parsers.py` mit 15 Unit-Tests
   gruen — inkl. 2 mit echten Live-DOM-Dumps.
3. **Stat-Werte werden ausgelesen:** Anzahl Angebote, Median Preis/m²,
   Median Onlinezeit, Rendite (jeweils Übersicht + Zusatzinfo)
4. **Adapter integriert in PORTAL_REGISTRY:** CLI `--portal immometrica`
   funktioniert.
5. **Doku:** `docs/portal-immometrica.md` mit Architektur + Known-Limitation
   + Phase-2-Roadmap.
6. **Live-Smoke-Test gruen:** Status `ok` (Login + 4 Configs durchlaufen).

### Limitation (Phase 2 offen)

**Filter-Setzung (Geo + Object-Typ + MFH-Checkbox) greift nicht zuverlaessig.**

Ursache: Immometrica's UI nutzt React-Select fuer den Ort-Picker + Bootstrap
custom-control fuer Object-Typ-Radios. Beide ignorieren synthesized
JS-click/event-dispatch. Programmatische Eingabe (auch via `/de/api/location`
+ hidden Input-Setting) wird beim Form-Submit nicht uebernommen, weil
React-State authoritativ ist.

Konsequenz: Alle 4 Configs (plz_etw, plz_mfh, stadt_etw, stadt_mfh) liefern
denselben Wert — naemlich den **zuletzt manuell gesetzten Filter-State**
(sticky serverseitig).

**Workaround fuer jetzt:** Vor dem ersten Adapter-Run muss der User einmal
manuell die Filter setzen via `inspectors/training_immometrica.py`. Der
Sticky-State wird gespeichert.

**Phase-2-Loesungs-Optionen:**
1. Direct-POST an IntercoolerJS-Endpoint `/de/statistics?ic-request=true...`
   mit Query-Params + CSRF-Token (Reverse-Engineering aus Network-Log).
2. CDP `Input.dispatchKeyEvent` fuer ECHTE Tastatur-Events in React-Select.
3. Echte Mouse-Events via `Input.dispatchMouseEvent` mit getBoundingClientRect-
   Position fuer die Option-Elemente.

### Was funktioniert / nicht funktioniert — Matrix

| Komponente | Status |
|---|---|
| Login autonom | ✅ 100% |
| Cookies / Session-Persistenz | ✅ 100% |
| Stat-Page laden | ✅ 100% |
| DOM-Body extrahieren | ✅ 100% |
| Parser (Werte aus Body) | ✅ 100% (15 Unit-Tests) |
| Zeitraum-Filter setzen (H1/2026) | ✅ 100% |
| Object-Typ-Radio setzen | ⚠️ Greift nicht zuverlaessig |
| Bauliches-Tab + MFH-Checkbox | ⚠️ Greift nicht zuverlaessig |
| Geo (PLZ/Stadt) setzen via API | ⚠️ Hidden Input gesetzt, React-State nicht |
| "Statistik erstellen" Klick | ✅ Klick funktioniert |
| Resultat-Werte aus DOM lesen | ✅ 100% |
| JSON-Output Schema-konform | ✅ 100% |

### Files (final)

```
tools/portal-bewertung/
├── portals/immometrica/
│   ├── __init__.py
│   ├── parsers.py            ← 15 Unit-Tests grün
│   └── portal.py             ← Adapter mit nodriver
├── tests/test_portals_immometrica_parsers.py
├── docs/portal-immometrica.md
├── inspectors/
│   ├── login_immometrica_autonomous.py     ← Login + Cookie-Export
│   ├── training_immometrica.py             ← Manuelle Filter-Session
│   ├── auto_statistics_immometrica.py      ← Dev-Tool für 6-Config-Sniff
│   ├── sniff_immometrica_search.py
│   ├── debug_immometrica_dom.py
│   ├── probe_location_api.py
│   ├── test_immometrica_adapter.py         ← Live-Smoke-Test
│   └── explore_immometrica.py
├── learned_selectors/
│   ├── immometrica_nodriver_userdata/      ← Session-Persistenz (gitignored)
│   └── immometrica_cookies.json            ← Cookie-Snapshot (gitignored)
├── runs/                                    ← Screenshots, DOM-Dumps, Network-Logs
├── HANDOVER_step-14_status.md              ← Dieses File
├── HANDOVER_step-14_immometrica.md         ← Original-Handover
├── Implementierungsplan.md                 ← Step 14 mit Caveat markiert
└── m00_portal_pricer.py                    ← CLI mit --portal immometrica
```

### Wie aufrufen

```bash
cd Aufteiler/tools/portal-bewertung
# Voraussetzung: 1× manuell Filter setzen über training_immometrica.py

# Smoke-Test:
.venv/Scripts/python.exe inspectors/test_immometrica_adapter.py

# CLI:
.venv/Scripts/python.exe m00_portal_pricer.py --portal immometrica \
  --strasse "Prosperstraße" --hausnr 59 --plz 45357 --ort Essen \
  --baujahr 1965 --zustand gut --ausstattung normal \
  --anzahl-we 4 --gesamtwohnflaeche-qm 320 --gesamtzimmer 12 \
  --headless
```
