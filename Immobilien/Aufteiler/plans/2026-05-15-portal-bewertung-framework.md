# Portal-Bewertung-Framework — Implementierungsplan

**Datum:** 2026-05-15
**Status:** In Umsetzung
**Vorgängerarbeit:** [CHECK24-Pricer MVP](../tools/check24/README.md) — Commit `9fed784`

## Kontext

Wir haben mit CHECK24 ein lokales Python-Tool gebaut, das aus einem
generalisierten MFH-Datensatz einen Marktwert + Trend-Ampel von CHECK24
PriceHugger zurückliefert (verifiziert: Prosperstr. 59 → 173.900 €).

CHECK24 war der schwerste Anwendungsfall (Anti-Bot, iframe, viele
DOM-Fallstricke). Damit die nächsten Portale (Homeday, Interhyp,
ImmobilienScout24) in jeweils ~2 Stunden statt einem Tag gebaut werden
können, **extrahieren wir die wiederverwendbaren Bausteine in ein Framework**
und bauen Portal-Adapter on-top.

## Architektur-Entscheidungen

1. **Hybrid-Ansatz (Python deterministisch + LLM-Fallback bei DOM-Änderungen).**
   Python-Pfad läuft im Normalfall (95% der Bewertungen, 0 € Kosten,
   reproduzierbar). Wenn ein Selektor nicht matched: Claude bekommt den
   DOM-Dump + Screenshot, liefert neuen Selektor, Tool patcht selbst und
   läuft weiter. Zahlen werden IMMER per Regex aus dem HTML extrahiert,
   nie vom LLM geschätzt — die Bewertungs-Werte sind damit identisch
   über alle Modi.

2. **Sub-Orchestrator als Python-Tool, NICHT als Skill.** Modul 0 ruft
   ein Python-Script (`m00_portal_pricer.py`) per Bash, kriegt ein
   aggregiertes JSON mit allen Portal-Werten + Konsens-Median zurück.
   Token-leicht für Modul 0 — kein LLM-Reasoning für die Orchestrierung
   selbst, nur für den Selektor-Recovery-Fallback.

3. **Lokal-only.** Heim-IP bleibt anti-bot-unauffällig. Keine Vercel,
   keine Cloud, kein Proxy. Tool läuft auf User-PC, im Hintergrund
   (headless) während eine Aufteiler-Session aktiv ist. Cloud-Migration
   bewusst ausgeschlossen.

4. **Vorsichtige Migration.** Alte `tools/check24/` bleibt parallel
   stehen, bis das neue `tools/portal-bewertung/portals/check24/`
   nachweislich (Live-Lauf mit Prosperstr. 59) das gleiche Ergebnis
   liefert. Dann erst Löschung.

5. **Manuelles Portal-Setup je Portal mit Screenshot-Briefing.** User
   liefert pro neuem Portal Screenshots mit Markierungen wo geklickt
   werden muss. Wir bauen Stück für Stück mit sichtbarem Browser. Keine
   Vorab-Mocked-Tests pro Portal — die finale Verifikation ist immer
   ein echter Live-Lauf.

## Ziel-Verzeichnisstruktur

```
Aufteiler/tools/portal-bewertung/
├── README.md
├── pytest.ini
├── requirements.txt
├── m00_portal_pricer.py              # CLI: --portal X | --alle, --datensatz path.json
├── orchestrator.py                   # ruft mehrere Portale parallel, aggregiert, Median
│
├── core/                             # FRAMEWORK — 1x geschrieben, alle Portale teilen sich
│   ├── __init__.py
│   ├── datensatz.py                  # GeneralisierterDatensatz (aus tools/check24/)
│   ├── browser.py                    # sync_playwright Setup, Viewport, Locale
│   ├── cookies.py                    # generischer Cookie-Banner-Dismiss-Loop
│   ├── inputs.py                     # _input_typed, Street-Autocomplete (Str.-Normalisierung)
│   ├── radios.py                     # Radio-Click via xpath-ancestor::label + Pfeil-Nudge
│   ├── selects.py                    # select_by_index, select_by_label
│   ├── submit.py                     # Submit mit Mouse-Move + Scroll + Fallback
│   ├── reader.py                     # iframe-Suche, Deep-Scroll, Body-Extract
│   ├── parsers.py                    # Euro/Trend/Ampel/Label-Generator
│   ├── modals.py                     # Topzinsen-Dismiss, generische Modal-Helpers
│   ├── portal_base.py                # abstrakte PortalBase-Klasse (Hooks)
│   ├── runner.py                     # run(portal, datensatz, cfg) — orchestriert pro Portal
│   ├── llm_recovery.py               # NEU: Selektor-Recovery via Anthropic-API
│   └── selectors_store.py            # NEU: persistiert gelernte Selektoren in JSON
│
├── portals/                          # PORTAL-ADAPTER — pro Portal ~150 Zeilen
│   ├── __init__.py
│   ├── check24/
│   │   ├── __init__.py
│   │   ├── selectors.py              # MIGRIERT aus tools/check24/dom_selectors.py
│   │   └── portal.py                 # class Check24Portal(PortalBase)
│   ├── homeday/                      # NEU (Phase 3)
│   ├── interhyp/                     # NEU (Phase 5)
│   └── immoscout24/                  # NEU (Phase 5)
│
├── learned_selectors/                # gitignored; pro Portal eine JSON-Datei
│   ├── check24.json                  # vom LLM-Recovery gelernte Selektoren
│   ├── homeday.json
│   └── ...
│
├── runs/                             # gitignored Screenshots aller Portale
│   └── .gitkeep
│
├── inspectors/                       # Dev-Tools (DOM-Dumper pro Portal)
│   ├── inspect_dom.py                # generisch: URL + Cookie-Selector → JSON-Dump
│   └── README.md
│
└── tests/
    ├── test_core_datensatz.py
    ├── test_core_parsers.py
    ├── test_core_modals.py
    └── test_orchestrator_aggregation.py
```

## Phasen-Übersicht

| Phase | Inhalt | Aufwand | Verifikation |
|---|---|---|---|
| 1 | Framework `core/` aus CHECK24-Code extrahieren | 2 h | Unit-Tests grün |
| 2 | CHECK24 als ersten Portal-Adapter migrieren | 1.5 h | Live-Lauf Prosperstr. → 173.9k € |
| 3 | Homeday als zweites Portal aufsetzen | 2 h | Live-Lauf mit Screenshot-Briefing |
| 4 | LLM-Recovery-Fallback einbauen | 2 h | Manuell DOM-Bruch simulieren, Recovery klappt |
| 5 | Interhyp + ImmoScout24 | 4 h | Live-Lauf je Portal |
| 6 | Sub-Orchestrator + Modul-0-Integration | 2 h | Aufteiler-Lauf nutzt Portal-Bewertungen |

**Pause-Punkte:** Nach jeder Phase Commit + Verifikation. User pausiert
zwischen Phasen, wenn er möchte. Plan ist auf Pausen ausgelegt.

---

## Phase 1: Framework `core/` extrahieren

**Ziel:** Wiederverwendbarer Code aus CHECK24 abstrahieren, ohne dass
CHECK24-Lauf bricht.

### Schritte

1. **Verzeichnisstruktur anlegen**
   - `tools/portal-bewertung/` mit allen Unterordnern
   - `pytest.ini`, `requirements.txt` (von tools/check24/ kopiert)
   - `.gitignore`-Einträge ergänzen: `.venv/`, `runs/*.png`, `learned_selectors/*.json`

2. **`core/datensatz.py`** — `generalisierter_datensatz.py` 1:1 kopieren.
   Bleibt identisch. Tests `test_core_datensatz.py` aus
   `tools/check24/test_pricer.py` umziehen.

3. **`core/browser.py`** — Playwright-Setup auslagern:
   ```python
   def launch_browser(headless: bool) -> tuple[Browser, BrowserContext, Page]:
       p = sync_playwright().start()
       browser = p.chromium.launch(headless=headless)
       ctx = browser.new_context(
           locale="de-DE",
           timezone_id="Europe/Berlin",
           viewport={"width": 1440, "height": 1600},
       )
       page = ctx.new_page()
       page.set_default_timeout(30_000)
       return browser, ctx, page
   ```

4. **`core/cookies.py`** — `_cookies_present`, `_accept_cookies_once`,
   `_ensure_cookies_dismissed` aus form_steps.py. Parametrisiert durch:
   ```python
   def dismiss_cookies(page: Page, accept_candidates: list[str],
                       wrapper_selector: str, max_wait_s: float) -> None:
   ```

5. **`core/inputs.py`** — `_input_typed`, `_input_street_with_autocomplete`,
   `_normalize_strasse`. Portal-agnostisch. Index-based; Portal liefert
   nur die Reihenfolge der Inputs.

6. **`core/radios.py`** — `_click_radio` (xpath-ancestor::label) +
   optional Pfeil-Nudge (2× rechts, 2× links, Enter). Portal liefert
   den qa-ref-Selektor.

7. **`core/selects.py`** — `select_by_index` und `select_by_label`.

8. **`core/submit.py`** — Submit-Click mit `scroll_into_view_if_needed`
   + `btn.click()`. Mouse-Move-Variante als Fallback. Portal liefert nur
   den Submit-Selektor + Wait-Predicate für Erfolg.

9. **`core/reader.py`** — Frame-Suche (mit Marker-Text), Deep-Scroll,
   `inner_text`-Extraktion. Portal liefert Marker-Text.

10. **`core/parsers.py`** — `_parse_marktwert_block`, `_parse_trends`,
    `_trend_ampel`, `_build_trend_label`. Generisch (kein Portal-Bezug).

11. **`core/modals.py`** — `_dismiss_topzinsen_modal`, `_dismiss_second_cookie`.
    Generische Modal-Dismisser mit Selektor-Liste.

12. **`core/portal_base.py`** — abstrakte Basis-Klasse:
    ```python
    class PortalBase(ABC):
        NAME: str
        START_URL: str
        COOKIE_ACCEPT_CANDIDATES: list[str]
        COOKIE_WRAPPER_SELECTOR: str
        SUBMIT_SELECTOR: str
        RESULT_FRAME_MARKER: str   # Text, der im Result-iframe vorkommt

        @abstractmethod
        def fill_form(self, page: Page, d: GeneralisierterDatensatz) -> None: ...

        @abstractmethod
        def dismiss_post_submit_modals(self, page: Page) -> None: ...

        def parse_result(self, body_text: str) -> dict:
            """Default: nutzt core/parsers.py — kann pro Portal overridden werden."""
            from . import parsers
            return {
                **parsers.parse_marktwert_block(body_text),
                "trends": parsers.parse_trends(body_text),
            }
    ```

13. **`core/runner.py`** — `run(portal: PortalBase, datensatz, cfg) -> dict`.
    Orchestriert Browser-Start → Cookies → fill_form → submit →
    dismiss_modals → find_frame → read → parse → screenshot.
    1:1 die `run()`-Funktion aus form_steps.py, nur generisch.

14. **`core/__init__.py`** — Re-exports der wichtigsten Funktionen.

15. **Tests `test_core_*.py`** — alle datensatz/parser/modal-Tests, die
    bisher in `tools/check24/test_pricer.py` sind, ins neue Framework
    umziehen + ergänzen.

### Verifikation Phase 1

```bash
cd Aufteiler/tools/portal-bewertung
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
pytest tests/ -v
```

Erwartet: alle 12+ Unit-Tests grün. **Kein** Live-Lauf in Phase 1 — der
kommt in Phase 2 zusammen mit CHECK24-Migration.

### Commit Phase 1

```
feat(portal-bewertung): framework core extrahiert — datensatz, parsers, runner
```

---

## Phase 2: CHECK24 migrieren

**Ziel:** Beweisen dass das Framework trägt. CHECK24 läuft im neuen
Pfad mit identischem Ergebnis.

### Schritte

1. **`portals/check24/selectors.py`** — bestehende `dom_selectors.py`
   1:1 reinkopieren. Nur Selektor-Konstanten und Option-Maps.

2. **`portals/check24/portal.py`** — `Check24Portal(PortalBase)`-Klasse:
   ```python
   class Check24Portal(PortalBase):
       NAME = "check24"
       START_URL = sel.START_URL
       COOKIE_ACCEPT_CANDIDATES = sel.COOKIE_ACCEPT_CANDIDATES
       COOKIE_WRAPPER_SELECTOR = sel.COOKIE_WRAPPER
       SUBMIT_SELECTOR = sel.SUBMIT_BUTTON
       RESULT_FRAME_MARKER = "Marktwertermittlung"

       def fill_form(self, page, d):
           # Reihenfolge der 6 Selects + 6 Inputs + 2 Radios + Zeitrahmen-Click + Pfeil-Nudge
           # nutzt core/inputs.py, core/selects.py, core/radios.py
           ...

       def dismiss_post_submit_modals(self, page):
           # Topzinsen-Modal + zweites Cookie-Banner
           ...
   ```

3. **`m00_portal_pricer.py`** — CLI:
   ```bash
   python m00_portal_pricer.py --portal check24 \
     --strasse "Prosperstraße" --hausnr 59 --plz 45357 --ort Essen \
     --baujahr 1977 --zustand gut --ausstattung normal \
     --anzahl-we 5 --wohnflaechen-qm "92.98,93.39,92.04,95.45,85.99" \
     --zimmer-liste "4.5,4.5,4.5,4.5,3.5" --badezimmer-liste "2,2,2,2,2" \
     --anzahl-garagen 4 --anzahl-aussenstellplaetze 0 --headless
   ```
   Argumente identisch zu `tools/m00_check24_pricer.py`. Dispatcher
   wählt anhand `--portal` die Portal-Klasse.

### Verifikation Phase 2

```bash
python m00_portal_pricer.py --portal check24 \
  --strasse "Prosperstraße" --hausnr 59 --plz 45357 --ort Essen \
  --baujahr 1977 --zustand gut --ausstattung normal \
  --anzahl-we 5 --wohnflaechen-qm "92.98,93.39,92.04,95.45,85.99" \
  --zimmer-liste "4.5,4.5,4.5,4.5,3.5" --badezimmer-liste "2,2,2,2,2" \
  --anzahl-garagen 4 --anzahl-aussenstellplaetze 0 --headless
```

Erwartet: JSON mit `marktwert_eur_mittel` ≈ 173.000–175.000 € (Tagespreis),
`trend_ampel: gruen`, identische Struktur wie altes Tool.

### Cleanup nach Phase 2

Wenn Live-Lauf grün: **alte `tools/check24/` löschen**, alte
`tools/m00_check24_pricer.py` löschen. Memory-Notiz aktualisieren.

### Commit Phase 2

```
feat(portal-bewertung): check24 ins framework migriert — alte tools/check24/ entfernt
```

---

## Phase 3: Homeday Preisatlas (erstes neues Portal)

**Ziel:** Beweisen dass die Framework-Hooks für ein anderes Portal mit
~2 h Aufwand reichen.

URL: https://www.homeday.de/de/preisatlas

### Schritte

1. **User-Briefing einholen.** Bevor Code geschrieben wird, der User
   liefert:
   - Screenshot der Startseite mit Cookie-Banner
   - Screenshot des Eingabe-Formulars mit Markierungen welche Felder
     in welcher Reihenfolge auszufüllen sind
   - Screenshot der Ergebnisseite mit dem Marktwert-Block
   - Hinweise zu Besonderheiten (Anti-Bot, Captcha, E-Mail-Zwang?)

2. **DOM-Inspector laufen lassen.** `inspectors/inspect_dom.py` mit der
   Homeday-URL aufrufen → JSON-Dump aller Inputs/Selects/Buttons.
   Aus dem Dump die echten Selektoren ableiten.

3. **`portals/homeday/selectors.py`** schreiben — analog CHECK24.

4. **`portals/homeday/portal.py`** schreiben — `HomedayPortal(PortalBase)`-Klasse.

5. **Live-Lauf** mit Prosperstr.-Daten, sichtbarer Browser, manuelles
   Beobachten. Iteration bis Ergebnis kommt.

### Verifikation Phase 3

```bash
python m00_portal_pricer.py --portal homeday \
  --strasse "Prosperstraße" --hausnr 59 --plz 45357 --ort Essen \
  --baujahr 1977 ...
```

Erwartet: JSON mit `marktwert_eur_mittel`, plausibel in der Region des
CHECK24-Wertes (±20%).

### Commit Phase 3

```
feat(portal-bewertung): homeday preisatlas als portal-adapter
```

---

## Phase 4: LLM-Recovery-Fallback

**Ziel:** Wenn ein Portal-Selektor nicht matched, fragt das Tool
Anthropic-API um Hilfe und patcht selbst.

### Schritte

1. **`core/llm_recovery.py`** schreiben:
   ```python
   def recover_selector(
       page: Page,
       failed_selector: str,
       intent: str,            # z.B. "find cookie accept button"
       portal_name: str,
   ) -> Optional[str]:
       """Fragt Claude per API: 'Hier ist DOM + Screenshot, finde Selektor für X'."""
       # 1. DOM-Snippet extrahieren (relevant für intent)
       # 2. Screenshot machen
       # 3. Anthropic-API-Call (Sonnet 4.6, multimodal)
       # 4. Claude antwortet mit CSS/XPath-Selektor
       # 5. Tool testet neuen Selektor auf Funktion
       # 6. Wenn erfolgreich: gespeichert in learned_selectors/<portal>.json
       # 7. Return: neuer Selektor
   ```

2. **`core/selectors_store.py`** — JSON-Persistierung:
   ```python
   def load_learned_selectors(portal_name: str) -> dict:
   def save_learned_selector(portal_name: str, intent: str, selector: str) -> None:
   ```

3. **Integration in `core/runner.py`** — bei jedem Schritt try/except,
   bei Timeout → `recover_selector` aufrufen. Wenn LLM neuen Selektor
   liefert: erneut versuchen. Wenn auch das fehlschlägt: harter
   Fehler mit Diagnose-Info.

4. **Beim Portal-Start:** `learned_selectors/<portal>.json` lesen und
   die gelernten Selektoren VOR den hartcodierten probieren. Damit
   profitieren spätere Läufe vom vorherigen Recovery.

5. **API-Key-Setup:** `ANTHROPIC_API_KEY` in `.env`, `python-dotenv`
   im `requirements.txt`.

### Verifikation Phase 4

Manueller DOM-Bruch-Test: In `portals/check24/selectors.py` einen
Selektor absichtlich kaputt machen (z.B. `COOKIE_WRAPPER` falsch).
Live-Lauf starten → erwartet:
- Tool merkt: Cookie-Wrapper nicht gefunden
- Ruft Claude → kriegt korrekten Selektor zurück
- Patcht `learned_selectors/check24.json`
- Lauf läuft durch, Ergebnis kommt
- Beim zweiten Lauf: Cookie-Recovery wird gar nicht mehr getriggert, weil gelernter Selektor sofort matched

### Commit Phase 4

```
feat(portal-bewertung): llm-fallback fuer selektor-recovery via anthropic-api
```

---

## Phase 5: Interhyp + ImmoScout24

**Ziel:** Zwei weitere Portale, jedes mit User-Screenshot-Briefing.

URLs:
- https://www.interhyp.de/rechner/immobilienbewertung/
- https://www.immobilienscout24.de/immobilie-bewerten/

Ablauf pro Portal identisch zu Phase 3:
1. Screenshot-Briefing vom User
2. DOM-Inspector
3. `selectors.py` + `portal.py`
4. Live-Lauf-Iteration
5. Commit pro Portal

**Reihenfolge:** Interhyp zuerst (vermutlich einfacher), dann IS24
(höchstes Anti-Bot-Risiko — wenn LLM-Fallback klappt, lässt sich auch
IS24 zähmen).

---

## Phase 6: Sub-Orchestrator + Modul-0-Integration

**Ziel:** Modul 0 ruft alle aktivierten Portale, kriegt aggregiertes JSON.

### Schritte

1. **`orchestrator.py`** schreiben:
   ```python
   def run_alle_portale(datensatz: GeneralisierterDatensatz,
                        portale: list[str] = None) -> dict:
       """Läuft alle Portal-Adapter parallel (via concurrent.futures),
       aggregiert Marktwerte, bildet Median + Spread."""
       ...
   ```
   Output:
   ```json
   {
     "portale": {
       "check24":   { "marktwert": 173900, "trend_ampel": "gruen", ... },
       "homeday":   { "marktwert": 168500, ... },
       "interhyp":  { "marktwert": 172000, ... },
       "immoscout24": { "marktwert": 170300, ... }
     },
     "konsens_marktwert_eur": 171150,
     "konsens_spread_eur": 5400,
     "konsens_spread_prozent": 3.2,
     "konsens_label": "4 Portale, Median 171.150 €, Spread 3.2%",
     "errors": []
   }
   ```

2. **CLI `--alle` Modus** im `m00_portal_pricer.py`.

3. **Modul-0-Integration** — neuer Abschnitt im
   `aufteiler-modul-0-quickcheck/SKILL.md`:
   - Nach der Adress-Klärung: Sub-Orchestrator aufrufen via Bash
   - JSON-Output in den Modul-0-State unter
     `modul_0.portal_bewertungen` schreiben
   - Konsens-Marktwert als zweite Quelle neben dem ETW-Konsens
   - Modul 5 zeigt beides nebeneinander im PDF

4. **PDF-Export Modul 5** — neue Sektion:
   ```
   Portal-Bewertungen (Konsens 171.150 €, Spread 3.2%):
   - CHECK24:    173.900 € (Trend 🟢 +6,7% 3J)
   - Homeday:    168.500 € (Trend 🟢 +4,2% 3J)
   - Interhyp:   172.000 € (Trend 🟡 stagnierend)
   - ImmoScout:  170.300 € (Trend 🟢 +5,1% 3J)
   ```

### Verifikation Phase 6

Vollständiger Aufteiler-Lauf für Prosperstr. 59:
- Modul 0 ruft Sub-Orchestrator
- 4 Portale werden parallel angefragt
- Aggregiertes JSON landet im State
- PDF zeigt alle vier Portale + Konsens

### Commit Phase 6

```
feat(modul-0): portal-bewertungen als zweite marktquelle integriert
```

---

## Risiken & Mitigation

| Risiko | Mitigation |
|---|---|
| LLM-Fallback halluziniert falsche Selektoren | Tool testet immer den neuen Selektor auf Funktion, bevor er persistiert wird. Falscher Selektor → kein Match → Fehlerausgabe |
| Anthropic-API-Kosten laufen aus dem Ruder | Recovery nur bei Selektor-Fail, gelernte Selektoren werden persistiert. Erwartung: 1-2 Recovery-Calls pro Portal alle 3-6 Monate |
| Portale erkennen Playwright-Headless als Bot | Heim-IP bleibt, headless: false als Fallback. Ggf. playwright-stealth nachziehen — als separater Plan |
| User hat zwischen Phasen die Lust verloren | Plan ist auf Pausen ausgelegt. Jede Phase committed sich selbst, parking-ready |
| DOM-Änderung während aktiver Aufteiler-Session | LLM-Recovery löst es im Hintergrund, User merkt nichts (außer +5 Sek Latenz beim ersten Lauf nach Änderung) |

## Out of Scope (bewusst nicht jetzt)

- Cloud-Deployment (Hetzner, Vercel, Browserbase)
- Voll-Cloud-Architektur (Worker + Queue)
- Sprengnetter / PriceHubble Direct-API
- Captcha-Lösungen
- Mehrere Bewertungen pro Stunde / Parallelisierung über die 4 Portale hinaus

## Memory-Updates am Plan-Ende

Nach Abschluss aller Phasen:
- `project_portal-bewertung-framework.md` anlegen — Erfolgs-Pattern und
  Reihenfolge für eventuelle 5. + 6. Portale dokumentieren
- `project_check24-pricer-*.md`-Memories aufräumen (Inhalt veraltet, da
  Tool im Framework lebt)
