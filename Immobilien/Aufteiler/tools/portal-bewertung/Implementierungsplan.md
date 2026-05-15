# Implementierungsplan: Portal-Bewertung

> **Blueprint-Workflow:** Jeder Schritt unten wird zu einem eigenen
> Claude-Code-Prompt. Pro Schritt: Sparring im Web-Claude (Akzeptanzkriterium
> + Edge-Cases klären), dann finaler Prompt für Claude Code.

> **Voraussetzung:** [Projektbeschreibung.md](./Projektbeschreibung.md) und
> [CLAUDE.md](./CLAUDE.md) sind als Knowledge-Files / Kontext geladen.

---

## Übersicht der Schritte

| # | Schritt | Ziel | Abhängig von |
|---|---|---|---|
| 1 ✅ | Projektstruktur + Meta-Files | CLAUDE.md, GUIDELINES, README, /docs | — |
| 2 | venv + Dependencies | Eigenständige Python-Umgebung | 1 |
| 3 | Framework: `core/datensatz.py` | GeneralisierterDatensatz portiert + Tests | 2 |
| 4 | Framework: `core/parsers.py` + `core/modals.py` | Euro/Trend/Ampel + Modal-Helpers + Tests | 3 |
| 5 | Framework: `core/browser.py`, `cookies.py`, `inputs.py`, `radios.py`, `selects.py`, `submit.py`, `reader.py` | Playwright-Helpers, parametrisiert | 4 |
| 6 | Framework: `core/portal_base.py` + `core/runner.py` | Abstrakte Portal-Klasse + Generic-Runner | 5 |
| 7 | CHECK24-Migration: `portals/check24/` | Bestehender CHECK24-Code in Framework, Live-Lauf grün | 6 |
| 8 | CLI: `m00_portal_pricer.py` (single-portal) | `--portal check24` läuft end-to-end | 7 |
| 9 | Cleanup: alte `tools/check24/` löschen | Nur ein Code-Pfad für CHECK24 | 8 |
| 10 | Inspector-Tool: `inspectors/inspect_dom.py` | Generischer DOM-Dumper für neue Portale | 8 |
| 11 | LLM-Recovery: `core/llm_recovery.py` + `core/selectors_store.py` | Selektor-Recovery via Anthropic-API, persistiert | 8 |
| 12 | Neues Portal: Homeday Preisatlas | Erstes Portal nach Framework, beweist Wiederverwendbarkeit | 10, 11 |
| 13 | Neues Portal: Interhyp | Zweites neues Portal | 12 |
| 14 | Neues Portal: ImmobilienScout24 | Drittes neues Portal (höchstes Anti-Bot-Risiko) | 13 |
| 15 | Orchestrator + `--alle` Modus | Parallel-Aufruf, Konsens-Median | 14 |
| 16 | Modul-0-Integration | Aufteiler-Skill ruft Portal-Bewertung, State-Update | 15 |
| 17 | Modul-5-PDF-Integration | Portal-Werte im PDF-Report | 16 |

**Pause-Punkte:** Nach jedem Schritt Commit + Verifikation. User kann
zwischen beliebigen Schritten pausieren.

---

## Schritt 1: Projektstruktur + Meta-Files

**Ziel:** Standalone-Projektordner unter `tools/portal-bewertung/` mit
allen Steuerungsdateien (CLAUDE.md, GUIDELINES, README), die nachfolgende
Schritte als Kontext nutzen.

**Akzeptanzkriterium:**
- [x] `tools/portal-bewertung/CLAUDE.md` existiert mit "Vor jeder Aufgabe"
  und "Nach jeder Aufgabe"-Regel
- [x] `tools/portal-bewertung/DEVELOPMENT_GUIDELINES.md` existiert mit
  Code-Style + Testing-Konventionen
- [x] `tools/portal-bewertung/README.md` existiert mit Setup-Anweisung
- [x] `tools/portal-bewertung/docs/` existiert (mit `.gitkeep`)
- [x] `.gitignore` in `Aufteiler/.gitignore` erweitert (venv, runs/,
  learned_selectors/, .env)

**Betroffene Dateien:**
- Neu: `tools/portal-bewertung/CLAUDE.md`
- Neu: `tools/portal-bewertung/DEVELOPMENT_GUIDELINES.md`
- Neu: `tools/portal-bewertung/README.md`
- Neu: `tools/portal-bewertung/.gitignore`
- Neu: `tools/portal-bewertung/docs/.gitkeep`
- Neu: `tools/portal-bewertung/Projektbeschreibung.md` (bereits gemacht)
- Neu: `tools/portal-bewertung/Implementierungsplan.md` (dieses File)

**Doku-Update:** Keine `/docs`-Updates nötig — Step 1 ist die Doku-Basis.

**Edge-Cases:**
- `.gitignore` muss `learned_selectors/*.json` ausschließen (gelernte Selektoren
  sind lokaler Cache, gehören nicht ins Repo). Aber `learned_selectors/.gitkeep`
  bleibt drin.

---

## Schritt 2: venv + Dependencies

**Ziel:** Eigenständige Python-Umgebung, getrennt von `tools/check24/.venv/`.

**Akzeptanzkriterium:**
- [ ] `tools/portal-bewertung/.venv/` angelegt
- [ ] `pip install -r requirements.txt` + `playwright install chromium`
  laufen durch
- [ ] `pytest tests/` läuft (leere Test-Suite oder smoke-test) ohne Fehler

**Betroffene Dateien:**
- Neu: `tools/portal-bewertung/requirements.txt` (playwright, pytest,
  anthropic, python-dotenv)
- Neu: `tools/portal-bewertung/pytest.ini`
- Neu: `tools/portal-bewertung/tests/__init__.py`

**Doku-Update:**
- `/docs/setup.md` mit Setup-Reihenfolge.

**Edge-Cases:**
- Python-Version: 3.13 wie bei CHECK24. Falls 3.14 verfügbar, das nutzen
  (egal, beide laufen).
- `playwright install chromium` lädt ~150 MB. Bestätigung einholen vor
  Download.

---

## Schritt 3: `core/datensatz.py` portiert

**Ziel:** GeneralisierterDatensatz + `from_summary` + `from_lists` aus
`tools/check24/generalisierter_datensatz.py` ins neue Framework. Unit-Tests
laufen.

**Akzeptanzkriterium:**
- [ ] `core/datensatz.py` vorhanden, importierbar als `from core.datensatz import GeneralisierterDatensatz`
- [ ] 7+ Unit-Tests grün (round_half_up, avg_zimmer, from_summary, from_lists, garage_50_percent, invalid_zustand, list_mismatch)

**Betroffene Dateien:**
- Neu: `core/__init__.py`
- Neu: `core/datensatz.py`
- Neu: `tests/test_core_datensatz.py`

**Doku-Update:**
- `/docs/datensatz.md` — Zweck, Felder, Berechnungsregeln (Durchschnitts-
  WE, 50%-Garage), Beispiele.

**Edge-Cases:**
- Badezimmer-Default 1, kann durch Liste überschrieben werden
  (Gäste-WC-Logik kommt im Aufteiler Modul 0, nicht hier)

---

## Schritt 4: `core/parsers.py` + `core/modals.py`

**Ziel:** Generische Parser (Euro-Werte, Trends, Ampel-Logik,
Trend-Label) + Modal-Dismisser. Portal-agnostisch.

**Akzeptanzkriterium:**
- [ ] `_parse_marktwert_block`, `_parse_trends`, `_trend_ampel`,
  `_build_trend_label` als public-Functions
- [ ] `dismiss_modal_by_text(page, accept_texts, wrapper_selector)` als
  generischer Modal-Dismisser
- [ ] 8+ Unit-Tests grün (Marktwert-Format mit Newlines, mit Pipes,
  empty; Trends-3-fach, negativ; Ampel grün/gelb/rot;
  Trend-Label-Generierung)

**Betroffene Dateien:**
- Neu: `core/parsers.py`
- Neu: `core/modals.py`
- Neu: `tests/test_core_parsers.py`
- Neu: `tests/test_core_modals.py`

**Doku-Update:**
- `/docs/parsers.md` — welche Regexe, welche Trend-Schwellen für
  Ampel-Logik, wie das `trend_label` formatiert wird

**Edge-Cases:**
- Negative Prozentwerte (rot-Ampel): Regex muss `-` vor Zahl erfassen
- Fehlende Prognose: `prognose: null` ist gültig, Label baut sich auch
  mit 1-2 Werten

---

## Schritt 5: Playwright-Helpers in `core/`

**Ziel:** Browser-Setup, Cookie-Banner-Dismiss, Input-Tipper (mit/ohne
Autocomplete), Radio-Klicker (mit Pfeil-Nudge), Select-Helper,
Submit-Klicker, iframe-Reader. Portal-agnostisch, parametrisiert.

**Akzeptanzkriterium:**
- [ ] Folgende Module + Funktionen vorhanden:
  - `core/browser.py`: `launch_browser(headless) -> (browser, ctx, page)`
  - `core/cookies.py`: `dismiss_cookies(page, accept_candidates, wrapper_selector, max_wait_s)`
  - `core/inputs.py`: `input_typed(page, selector_or_index, value)`,
    `input_street_with_autocomplete(page, selector, value)`
  - `core/radios.py`: `click_radio(page, qa_ref_selector, nudge=True)`
  - `core/selects.py`: `select_by_index(page, selector_root, index, label)`,
    `select_by_label(page, selector, label)`
  - `core/submit.py`: `submit_form(page, submit_selector)` (mit Scroll +
    Mouse-Move-Fallback)
  - `core/reader.py`: `find_result_frame(page, marker_text)`,
    `read_frame_body_deep(frame)` (Deep-Scroll + Text-Extract)

**Betroffene Dateien:** Neu, alle unter `core/`

**Doku-Update:**
- `/docs/playwright-helpers.md` — pro Funktion ein kurzer Abschnitt mit
  Signature + Beispielaufruf

**Edge-Cases:**
- Cookie-Banner kann verzögert aufpoppen → Helper muss in Loop pollen
- Straßen-Autocomplete: "Straße" → "Str." normalisieren, dann Enter
- Radio-Click: muss `scroll_into_view_if_needed` + Pfeil-Nudge (2× rechts,
  2× links, Enter) für CHECK24-Format
- Submit: Viewport muss groß genug sein (1440×1600), sonst
  "Element outside viewport"-Fehler

---

## Schritt 6: `core/portal_base.py` + `core/runner.py`

**Ziel:** Abstrakte Portal-Klasse mit klaren Hooks. Generic-Runner, der
für jedes Portal den gleichen Lebenszyklus durchläuft
(Browser → Cookies → fill_form → submit → modals → frame → parse → JSON).

**Akzeptanzkriterium:**
- [ ] `PortalBase` definiert die Properties + abstrakten Methoden
  (`NAME`, `START_URL`, `COOKIE_ACCEPT_CANDIDATES`, `COOKIE_WRAPPER`,
  `SUBMIT_SELECTOR`, `RESULT_FRAME_MARKER`, `fill_form()`,
  `dismiss_post_submit_modals()`, `parse_result()` mit Default)
- [ ] `run(portal, datensatz, cfg) -> dict` orchestriert den vollen Lauf
- [ ] Smoke-Test: dummy-Portal-Klasse → Runner ruft alle Methoden in
  richtiger Reihenfolge (mocked Playwright)

**Betroffene Dateien:**
- Neu: `core/portal_base.py`
- Neu: `core/runner.py`
- Neu: `tests/test_core_runner.py`

**Doku-Update:**
- `/docs/portal-base.md` — wie man ein neues Portal implementiert
  (Mini-Tutorial mit Code-Skelett)

**Edge-Cases:**
- Fehler in einem Schritt → Screenshot + strukturiertes Error-JSON
- `parse_result` als Default in Basis, überschreibbar pro Portal

---

## Schritt 7: CHECK24-Migration

**Ziel:** CHECK24 läuft im neuen Framework. Live-Lauf liefert
gleiches Ergebnis wie altes `tools/check24/m00_check24_pricer.py`.

**Akzeptanzkriterium:**
- [ ] `portals/check24/selectors.py` + `portals/check24/portal.py`
  existieren
- [ ] `Check24Portal(PortalBase)` implementiert `fill_form()` (richtige
  Reihenfolge der 6 Selects + 6 Inputs + Kaufen-Radio + Zeitrahmen-Klick
  + Pfeil-Nudge) und `dismiss_post_submit_modals()` (Topzinsen + 2.
  Cookie-Banner)
- [ ] Live-Lauf mit Prosperstr. 59 → JSON enthält
  `marktwert_eur_mittel` 170.000–180.000 € + alle drei Trend-Werte +
  Ampel grün

**Betroffene Dateien:**
- Neu: `portals/__init__.py`
- Neu: `portals/check24/__init__.py`
- Neu: `portals/check24/selectors.py`
- Neu: `portals/check24/portal.py`

**Doku-Update:**
- `/docs/portal-check24.md` — Übersicht des Adapters, bekannte
  Stolpersteine (Cookie "geht klar", Str.-Normalisierung,
  Zeitrahmen-Pfeil-Nudge, PriceHubble-iframe)

**Edge-Cases:**
- PriceHubble-iframe-Marker: "Marktwertermittlung"
- Topzinsen-Modal blockiert weitere Klicks
- Bei DOM-Änderung: Phase 11 (LLM-Recovery) übernimmt

---

## Schritt 8: CLI `m00_portal_pricer.py` (single-portal)

**Ziel:** Ein zentraler CLI-Entry, der per `--portal check24` den
Check24Portal-Adapter ausführt. Identische Argumente wie
`tools/m00_check24_pricer.py`.

**Akzeptanzkriterium:**
- [ ] `python m00_portal_pricer.py --portal check24 --strasse "..."
  --hausnr 59 ... --headless` läuft durch
- [ ] JSON auf stdout, identisches Schema wie altes Tool
- [ ] `--verbose` schaltet Diagnose-Logs ein (auf stderr)
- [ ] Exit 0 bei Erfolg, 1 bei Fehler

**Betroffene Dateien:**
- Neu: `m00_portal_pricer.py`

**Doku-Update:**
- `/docs/cli.md` — alle Argumente, Beispielaufrufe pro Portal

**Edge-Cases:**
- Listen-Inputs (`--wohnflaechen-qm "60,70,80"`) vs. Summen
  (`--gesamtwohnflaeche-qm 480`)
- UTF-8 stdout-Wrapper für Windows (cp1252-Encoding-Bug)

---

## Schritt 9: Cleanup alte `tools/check24/`

**Ziel:** Nur ein Code-Pfad für CHECK24. Alte Files weg, Memory aktualisiert.

**Akzeptanzkriterium:**
- [ ] `tools/check24/` per `git rm -r` entfernt
- [ ] `tools/m00_check24_pricer.py` per `git rm` entfernt
- [ ] Memory: `project_check24-pricer-*.md`-Dateien aktualisiert
  (Pfade zeigen auf neues Framework)
- [ ] `.gitignore` aufgeräumt (CHECK24-Einträge raus, portal-bewertung
  rein — falls noch nicht in Step 1 gemacht)

**Betroffene Dateien:**
- Gelöscht: `tools/check24/`, `tools/m00_check24_pricer.py`
- Geändert: `~/.claude/projects/c--meine-projekte/memory/project_check24-*.md`
- Geändert: `Immobilien/Aufteiler/.gitignore`

**Doku-Update:** Keine.

**Edge-Cases:**
- Vor `git rm`: nochmal ein Live-Lauf des neuen Pfades, falls in den
  letzten Stunden was Subtiles kaputt gegangen ist

---

## Schritt 10: Inspector-Tool

**Ziel:** Generisches DOM-Dump-Script, das pro neuem Portal die
Inputs/Selects/Buttons/Cookie-Banner-Texte ausliest. Spart Zeit beim
manuellen Setup neuer Portale.

**Akzeptanzkriterium:**
- [ ] `inspectors/inspect_dom.py <URL>` läuft headless, klickt Cookie-Banner
  (best-effort), dumpt JSON mit Inputs/Selects/Radios/Submits +
  Screenshots
- [ ] `inspectors/README.md` erklärt Aufruf + Output-Format

**Betroffene Dateien:**
- Neu: `inspectors/inspect_dom.py`
- Neu: `inspectors/README.md`

**Doku-Update:**
- `/docs/neue-portale.md` — Schritt-für-Schritt Anleitung wie man ein
  neues Portal hinzufügt (Inspector laufen → Selektoren extrahieren →
  Portal-Klasse schreiben → Live-Test)

**Edge-Cases:**
- Cookie-Banner kann sich pro Portal anders nennen — Best-Effort-Liste
  ("Akzeptieren", "OK", "geht klar", "Zustimmen", ...)

---

## Schritt 11: LLM-Recovery + Selectors-Store

**Ziel:** Wenn ein Selektor nicht matched, fragt das Tool Anthropic-API
mit DOM-Dump + Screenshot, kriegt neuen Selektor, persistiert ihn pro
Portal.

**Akzeptanzkriterium:**
- [ ] `core/llm_recovery.py`: `recover_selector(page, failed_selector,
  intent, portal_name)` ruft Claude Sonnet 4.6 mit DOM + Screenshot
- [ ] `core/selectors_store.py`: `load_learned_selectors(portal_name)`,
  `save_learned_selector(portal_name, intent, selector)` — JSON-Datei
  unter `learned_selectors/<portal>.json`
- [ ] `core/runner.py` integriert: bei Selektor-Fail wird automatisch
  Recovery getriggert
- [ ] Manuelle Bruchprobe: künstlich falscher CHECK24-Cookie-Selektor →
  Recovery findet richtigen → wird persistiert → 2. Lauf nutzt
  gelernten Selektor direkt

**Betroffene Dateien:**
- Neu: `core/llm_recovery.py`
- Neu: `core/selectors_store.py`
- Geändert: `core/runner.py`
- Neu: `learned_selectors/.gitkeep`
- Neu: `.env.example` (mit `ANTHROPIC_API_KEY=`-Platzhalter)

**Doku-Update:**
- `/docs/llm-recovery.md` — wann es triggert, was es kostet
  (~0,30 €/Recovery), wie persistierte Selektoren funktionieren

**Edge-Cases:**
- LLM gibt invalid CSS → Tool testet Selektor auf Funktion vor
  Persistierung
- API-Key fehlt → Recovery wird nicht versucht, normales Error-JSON
- Mehrere Selektoren in einer Session kaputt → jeder einzeln recovered

---

## Schritt 12: Portal Homeday Preisatlas

**Ziel:** Erstes neues Portal nach dem Framework-Pattern. Beweist
Wiederverwendbarkeit.

**Vorab (USER-INPUT NÖTIG):**
- User liefert 3 Screenshots:
  1. Startseite mit Cookie-Banner (markiert: welcher Button anklicken)
  2. Eingabeformular (markiert: welche Felder in welcher Reihenfolge)
  3. Ergebnisseite (markiert: wo der Marktwert steht)
- User-Hinweise: Captcha? E-Mail-Zwang? Anti-Bot-Verhalten beobachtet?

**Akzeptanzkriterium:**
- [ ] `portals/homeday/selectors.py` + `portals/homeday/portal.py` existieren
- [ ] Live-Lauf mit Prosperstr. 59 → plausibler Marktwert (±20% vom
  CHECK24-Wert)
- [ ] CLI: `python m00_portal_pricer.py --portal homeday ...` läuft

**Betroffene Dateien:**
- Neu: `portals/homeday/`
- Geändert: `m00_portal_pricer.py` (homeday in Portal-Dispatcher)

**Doku-Update:**
- `/docs/portal-homeday.md` — wie CHECK24-Doku

**Edge-Cases:**
- Homeday hat eventuell keinen iframe — `parse_result` ggf. ohne
  `find_result_frame`
- Homeday hat eventuell andere Adressformat-Erwartungen (nur PLZ + Ort?)

---

## Schritt 13: Portal Interhyp

**Vorab (USER-INPUT NÖTIG):** Screenshot-Briefing wie Step 12.

URL: https://www.interhyp.de/rechner/immobilienbewertung/

**Akzeptanzkriterium:** Wie Step 12, mit `--portal interhyp`.

---

## Schritt 14: Portal ImmobilienScout24

**Vorab (USER-INPUT NÖTIG):** Screenshot-Briefing wie Step 12.

URL: https://www.immobilienscout24.de/immobilie-bewerten/

**Akzeptanzkriterium:** Wie Step 12, mit `--portal immoscout24`.

**Edge-Cases:**
- IS24 nutzt Akamai Bot Manager — höchstes Risiko für Bot-Erkennung
- Wenn Headless geblockt: Headed-Modus als Default für IS24

---

## Schritt 15: Orchestrator + `--alle`

**Ziel:** Parallel-Aufruf aller 4 Portale, Aggregation zu Konsens-Median +
Spread.

**Akzeptanzkriterium:**
- [ ] `orchestrator.py` mit `run_all_portals(datensatz, portals=None)`
- [ ] `concurrent.futures.ThreadPoolExecutor` parallelisiert die 4
  Browser-Läufe
- [ ] Output-JSON:
  ```json
  {
    "portale": { "check24": {...}, "homeday": {...}, ... },
    "konsens_marktwert_eur": 171000,
    "konsens_spread_eur": 5400,
    "konsens_spread_prozent": 3.2,
    "konsens_label": "4 Portale, Median 171.000 €, Spread 3.2%",
    "errors": [...]
  }
  ```
- [ ] CLI `--alle` ruft orchestrator
- [ ] Wenn 1 Portal failed: andere 3 laufen weiter, error in `errors`-Array

**Betroffene Dateien:**
- Neu: `orchestrator.py`
- Geändert: `m00_portal_pricer.py` (--alle Flag)
- Neu: `tests/test_orchestrator_aggregation.py`

**Doku-Update:**
- `/docs/orchestrator.md` — wie Median + Spread berechnet werden, wie
  Failures behandelt werden

**Edge-Cases:**
- Browser-Ressourcen: 4 parallele Chromium-Instanzen — testen, dass
  System nicht ins Schwitzen kommt
- Falls 1 Portal hängt: Timeout pro Portal-Lauf max 90 Sek

---

## Schritt 16: Modul-0-Integration

**Ziel:** Aufteiler-Skill Modul 0 ruft per Bash den Orchestrator nach
Adress-Klärung, packt Konsens-Wert in den State.

**Akzeptanzkriterium:**
- [ ] `skills/aufteiler-modul-0-quickcheck/SKILL.md` neuer Abschnitt
  "Portal-Bewertungen abrufen" mit Bash-Aufruf
- [ ] `docs/state-schema.md` aktualisiert: `modul_0.portal_bewertungen`
- [ ] Manueller End-to-End-Test: Aufteiler-Session für Prosperstr. 59 →
  Modul 0 läuft, State enthält Portal-Werte
- [ ] CLAUDE.md (Aufteiler) erweitert: Hinweis dass Modul 0 vom
  portal-bewertung-Tool abhängt

**Betroffene Dateien:**
- Geändert: `skills/aufteiler-modul-0-quickcheck/SKILL.md`
- Geändert: `docs/state-schema.md`
- Geändert: `CLAUDE.md` (Aufteiler-Root)

**Doku-Update:**
- `/docs/modul-0-integration.md` — wie Modul 0 das Tool aufruft, was im
  State landet

**Edge-Cases:**
- Wenn Orchestrator failed (alle 4 Portale): Modul 0 darf nicht
  scheitern, sondern markiert die Portal-Bewertung als
  "nicht verfügbar" + macht weiter mit ETW-Konsens allein
- Wenn nur 1-2 Portale failed: Konsens basiert auf restlichen, Konfidenz
  niedriger markiert

---

## Schritt 17: Modul-5-PDF-Integration

**Ziel:** Portal-Bewertungen im finalen PDF-Report sichtbar — als
zweite Marktwert-Quelle.

**Akzeptanzkriterium:**
- [ ] `skills/aufteiler-modul-5-deal-bewertung/SKILL.md` erweitert um
  Portal-Werte-Sektion
- [ ] PDF zeigt:
  ```
  Portal-Bewertungen (Konsens 171.150 €, Spread 3.2%):
    🟢 CHECK24:     173.900 € (Trend steigend +6.7% 3J)
    🟢 Homeday:     168.500 € (Trend steigend +4.2% 3J)
    🟡 Interhyp:    172.000 € (Trend stagnierend)
    🟢 ImmoScout24: 170.300 € (Trend steigend +5.1% 3J)
  ```
- [ ] PDF generiert sauber, keine Layout-Brüche bei fehlenden Portalen

**Betroffene Dateien:**
- Geändert: `skills/aufteiler-modul-5-deal-bewertung/SKILL.md`
- Geändert: `skills/aufteiler-pdf-export/SKILL.md` (Layout-Regeln)

**Doku-Update:**
- `/docs/modul-5-pdf.md` — neue Sektion dokumentiert

**Edge-Cases:**
- Ampel-Emojis (🟢🟡🔴) — reportlab muss Unicode-Schrift haben
- Bei fehlenden Werten: Zeile auslassen, nicht "N/A" anzeigen

---

## Definition of Done (Gesamt-Projekt)

Alle 17 Schritte committed + getestet. Vollständiger Aufteiler-Lauf für
ein echtes MFH läuft durch, PDF enthält 4 Portal-Bewertungen + Konsens.
LLM-Recovery wurde mindestens einmal in der Praxis getriggert und hat
einen Selektor gelernt.

## Risiko-Register

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| IS24 blockt headless trotz Heim-IP | Mittel | Mittel | Headed-Default für IS24, Fallback auf nur 3 Portale |
| LLM-Recovery hat Edge-Case-Bug | Mittel | Klein | Recovery testet Selektor vor Persistierung; bei Fail normales Error-JSON |
| Modul-0-Integration bricht Bestehendes | Niedrig | Hoch | Step 16 ist optional über Feature-Flag; Aufteiler kann ohne Portal-Werte laufen |
| User verliert Lust zwischen Phasen | Hoch | Niedrig | Plan ist auf Pausen ausgelegt; jeder Step committed sich selbst |

## Memory-Notiz nach Step 17

Memory anlegen: `project_portal-bewertung-framework.md` —
- Welche Portale aktiv sind
- Erfolgs-Pattern für eventuelle 5./6. Portale
- Hinweis: Bei DOM-Änderungen läuft Recovery automatisch
- LLM-Recovery-Statistik (wie oft getriggert)

Memory aufräumen:
- `project_check24-pricer-*.md` — Pfade aktualisieren auf neues Framework
