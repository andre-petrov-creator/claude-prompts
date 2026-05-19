"""Immometrica-Adapter — Marktstatistik via nodriver (Anti-Detect Chrome).

Liefert 4 Stat-Bloecke pro Adresse:
- PLZ / ETW (mit Zusatzinfo Wohnung mieten)
- PLZ / Hauskauf + Mehrfamilienhaus (mit Zusatzinfo Haus mieten)
- Stadt / ETW (mit Zusatzinfo Wohnung mieten)
- Stadt / Hauskauf + Mehrfamilienhaus (mit Zusatzinfo Haus mieten)

Login wird via persistiertem User-Data-Dir wiederverwendet. Falls Session
abgelaufen ist, faellt das Skript zurueck auf Auto-Login mit .env-Credentials.

Output (JSON, kompatibel zu RunResult-Schema, alle Spezifika im extra-Slot):
{
  "status": "ok"|"error",
  "portal": "immometrica",
  "marktwert_eur_mittel": null,
  "marktwert_eur_min": null,
  "marktwert_eur_max": null,
  "trends": {...},
  "trend_ampel": null,
  "trend_label": null,
  "url": "https://www.immometrica.com/de/statistics",
  "timestamp": "<iso>",
  "screenshot_path": null,
  "extra": {
    "year_half": "H1/2026",
    "plz_input": "45357",
    "stadt_input": "Essen",
    "plz_etw": {"uebersicht": {...}, "zusatzinfo": {...}},
    "plz_mfh": {"uebersicht": {...}, "zusatzinfo": {...}},
    "stadt_etw": {"uebersicht": {...}, "zusatzinfo": {...}},
    "stadt_mfh": {"uebersicht": {...}, "zusatzinfo": {...}}
  }
}
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from portals.immometrica.parsers import parse_stat_block, parse_geo_state

THIS_DIR = Path(__file__).resolve().parent
PROJ_ROOT = THIS_DIR.parent.parent
RUNS_DIR = PROJ_ROOT / "runs"
STATE_DIR = PROJ_ROOT / "learned_selectors"
USER_DATA_DIR = STATE_DIR / "immometrica_nodriver_userdata"
BERLIN_TZ = timezone(timedelta(hours=2))

URL_STATISTICS = "https://www.immometrica.com/de/statistics"
URL_HOME = "https://www.immometrica.com/de/home"


def _ts_iso() -> str:
    return datetime.now(BERLIN_TZ).isoformat()


def _ts_slug() -> str:
    return datetime.now(BERLIN_TZ).strftime("%Y-%m-%dT%H%M%S")


def _load_env_creds() -> tuple[Optional[str], Optional[str]]:
    env_path = PROJ_ROOT / ".env"
    if not env_path.exists():
        return os.environ.get("IMMOMETRICA_USERNAME"), os.environ.get("IMMOMETRICA_PASSWORD")
    user = pw = None
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip()
        if k == "IMMOMETRICA_USERNAME":
            user = v
        elif k == "IMMOMETRICA_PASSWORD":
            pw = v
    return user, pw


async def _do_login(tab, user: str, pw: str) -> bool:
    """Falls Session abgelaufen ist: fueller Login-Flow ueber Marketing-Page."""
    # Navigiere zur Marketing-Page mit Einloggen-Link
    await tab.get("https://www.immometrica.com/de")
    await asyncio.sleep(3.0)

    # Cookie-Banner
    for txt in ["OK", "Alle akzeptieren", "Akzeptieren", "Zustimmen"]:
        try:
            elem = await tab.find(text=txt, best_match=True, timeout=2)
            if elem:
                await elem.click()
                await asyncio.sleep(0.5)
                break
        except Exception:
            continue

    # Einloggen-Link
    try:
        elem = await tab.find(text="Einloggen", best_match=True, timeout=3)
        if elem:
            await elem.click()
            await asyncio.sleep(2.5)
    except Exception:
        return False

    # E-Mail + Passwort
    try:
        email_inp = await tab.query_selector('input[type="email"]')
        if not email_inp:
            return False
        await email_inp.click()
        await asyncio.sleep(0.3)
        await email_inp.send_keys(user)
        pw_inp = await tab.query_selector('input[type="password"]')
        if not pw_inp:
            return False
        await pw_inp.click()
        await asyncio.sleep(0.3)
        await pw_inp.send_keys(pw)
        await asyncio.sleep(1.0)
        # Submit
        elem = await tab.find(text="Login", best_match=True, timeout=2)
        if not elem:
            elem = await tab.find(text="Anmelden", best_match=True, timeout=2)
        if elem:
            await elem.click()
            await asyncio.sleep(5.0)
        return True
    except Exception:
        return False


async def _ensure_logged_in(tab) -> bool:
    """Prueft ob Statistik-Page erreichbar ist (Persistent-Cookies aktiv).

    Falls nicht: Auto-Login mit .env-Credentials.
    """
    try:
        await tab.get(URL_STATISTICS)
        await asyncio.sleep(3.0)
        url = tab.url or ""
        body = await tab.evaluate(
            "(document.body && document.body.innerText) || ''"
        )
        if isinstance(body, dict) and "value" in body:
            body = body["value"]
        body = body or ""
        # Erfolgs-Indikator: "Statistik erstellen" Button + "Logout" im Menue
        if (
            "Statistik erstellen" in body
            and ("Logout" in body or "Profil" in body)
            and "/accounts/login" not in url
        ):
            return True
    except Exception:
        pass
    # Login noetig
    user, pw = _load_env_creds()
    if not user or not pw:
        print(">>> WARN: .env Credentials fehlen", file=sys.stderr, flush=True)
        return False
    print(">>> Session abgelaufen, starte Auto-Login", file=sys.stderr, flush=True)
    return await _do_login(tab, user, pw)


async def _select_period(tab, year_half: str) -> bool:
    """Klickt auf den Halbjahres-Button mit dem Text z.B. 'H1/2026'."""
    try:
        clicked = await tab.evaluate(
            f"""(() => {{
                const btns = Array.from(document.querySelectorAll('a, button'))
                    .filter(b => b.innerText.trim() === {json.dumps(year_half)});
                if (btns.length === 0) return false;
                btns[0].click();
                return true;
            }})()"""
        )
        if isinstance(clicked, dict) and "value" in clicked:
            clicked = clicked["value"]
        return bool(clicked)
    except Exception:
        return False


async def _clear_geo_tags(tab) -> int:
    """Entfernt alle bestehenden Ort-Tags (Muelleimer-Icon-Anker klicken).

    Trash-Anker ist <a href="#"><i class="fas fa-trash"></i></a> in der
    location-select-widget Box.
    """
    try:
        removed = await tab.evaluate(
            """(() => {
                let count = 0;
                // Trash-Anker im Ort-Widget finden
                const widget = document.querySelector('.location-select-widget');
                if (!widget) return 0;
                const trashes = Array.from(
                    widget.querySelectorAll('a > i.fa-trash, a > i.fas.fa-trash')
                );
                for (const ico of trashes) {
                    const anchor = ico.closest('a');
                    if (anchor) {
                        try {
                            anchor.click();
                            count += 1;
                        } catch (e) {}
                    }
                }
                return count;
            })()"""
        )
        if isinstance(removed, dict) and "value" in removed:
            removed = removed["value"]
        return int(removed) if removed is not None else 0
    except Exception:
        return 0


async def _set_geo_via_api(tab, geo_query: str, expected_substring: str) -> tuple[bool, Optional[dict]]:
    """Setzt Ort via direkter Location-API + Manipulation des hidden id_location.

    API: GET /de/api/location?q=<query>
    Response-Format:
        {"results": [
            {"value": "zip:45357", "label": "45357 Essen", "category": "PLZ",
             "lat": ..., "lon": ...},
            {"value": 10800, "label": "Essen, Nordrhein-Westfalen",
             "category": "Kreisfreie Stadt", ...}
        ]}

    Hidden Form-Input:
        <input id="id_location" name="location" value='{"type":"id","value":[{
            "location": <value>, "radius": 0, "polygon": null
        }]}'>
    """
    try:
        raw = await tab.evaluate(
            f"""(async () => {{
                try {{
                    const resp = await fetch(
                        '/de/api/location?q=' + encodeURIComponent({json.dumps(geo_query)}),
                        {{credentials: 'include'}}
                    );
                    if (!resp.ok) return JSON.stringify({{error: 'http_' + resp.status}});
                    const txt = await resp.text();
                    return txt;
                }} catch (e) {{
                    return JSON.stringify({{error: e.message || String(e)}});
                }}
            }})()""",
            await_promise=True,
        )
        if isinstance(raw, dict) and "value" in raw:
            raw = raw["value"]
        if not isinstance(raw, str):
            print(f">>>   Location-API: unerwarteter Returntyp {type(raw)}",
                  file=sys.stderr, flush=True)
            return False, None
        try:
            data = json.loads(raw)
        except Exception:
            print(f">>>   Location-API JSON-Parse FAIL: {raw[:200]}",
                  file=sys.stderr, flush=True)
            return False, None
        if isinstance(data, dict) and "error" in data:
            print(f">>>   Location-API ERROR: {data['error']}",
                  file=sys.stderr, flush=True)
            return False, None

        results = data.get("results") if isinstance(data, dict) else None
        if not results or not isinstance(results, list):
            print(">>>   Location-API: keine results",
                  file=sys.stderr, flush=True)
            return False, None

        # Pick: bevorzugt exaktes Substring-Match im label;
        # bei PLZ-Query (rein numerisch) bevorzuge category=PLZ
        expected_lower = expected_substring.lower()
        is_plz_query = geo_query.strip().isdigit()
        picked = None
        if is_plz_query:
            for r in results:
                if r.get("category") == "PLZ":
                    picked = r
                    break
        if not picked:
            for r in results:
                label = str(r.get("label") or "")
                if expected_lower in label.lower():
                    picked = r
                    break
        if not picked:
            picked = results[0]

        picked_value = picked.get("value")
        picked_label = picked.get("label", "")
        picked_cat = picked.get("category", "")
        print(
            f">>>   Location-API: value={picked_value!r} "
            f"label={picked_label!r} cat={picked_cat!r}",
            file=sys.stderr, flush=True,
        )
        if picked_value is None:
            return False, picked

        # Hidden Form-Input mit dem location-Value setzen
        loc_json_value = json.dumps({
            "type": "id",
            "value": [{
                "location": picked_value,
                "radius": 0,
                "polygon": None,
            }],
        }, ensure_ascii=False)
        await tab.evaluate(
            f"""(() => {{
                const inp = document.getElementById('id_location');
                if (!inp) return false;
                inp.value = {json.dumps(loc_json_value)};
                inp.dispatchEvent(new Event('input', {{bubbles: true}}));
                inp.dispatchEvent(new Event('change', {{bubbles: true}}));
                return true;
            }})()"""
        )
        return True, {
            "value": picked_value,
            "label": picked_label,
            "category": picked_cat,
        }
    except Exception as e:
        print(f">>>   _set_geo_via_api Exception: {e}",
              file=sys.stderr, flush=True)
        return False, None


async def _enter_geo(tab, geo_query: str, expected_substring: str) -> bool:
    """Tippt geo_query in React-Select Ort-Eingabe + waehlt passenden Eintrag.

    Timing aus probe_geo_input.py validiert:
    - 0.3s Delay zwischen Chars (sonst API-Calls nicht getriggert)
    - 4s Wait nach Eingabe (sonst Suggestions nicht voll geladen)
    - Native click() auf Option-Element (synth click ignoriert React-Select)
    """
    try:
        # 1) Existing Tags loeschen
        cleared = await _clear_geo_tags(tab)
        if cleared:
            print(f">>>   Ort-Tags entfernt: {cleared}",
                  file=sys.stderr, flush=True)
        await asyncio.sleep(1.5)

        # 2) Auf "Neuer Ort"-Slot klicken um React-Select zu fokussieren
        try:
            await tab.evaluate(
                """(() => {
                    const widget = document.querySelector('.location-select-widget');
                    if (!widget) return false;
                    const toggle = widget.querySelector('.location-toggle');
                    if (toggle) toggle.click();
                    return true;
                })()"""
            )
            await asyncio.sleep(2.0)
        except Exception:
            pass

        # 3) React-Select-Input mit grosszuegigen Delays zwischen Chars
        try:
            inp = await tab.query_selector(
                'input[id^="react-select-"][id$="-input"]'
            )
            if not inp:
                print(">>>   ERR: react-select Input nicht gefunden",
                      file=sys.stderr, flush=True)
                return False
            await inp.click()
            await asyncio.sleep(1.0)
            # CHAR-BY-CHAR mit 0.3s Delay (Server-API muss antworten)
            for ch in geo_query:
                await inp.send_keys(ch)
                await asyncio.sleep(0.3)
        except Exception as e:
            print(f">>>   Input-Tippen FAIL: {e}",
                  file=sys.stderr, flush=True)
            return False

        # 4) Autocomplete-Suggestions voll laden lassen (Server-Response)
        await asyncio.sleep(4.0)

        # 5) Erste passende Suggestion picken via NATIVE Click
        # React-Select reagiert auf echte Browser-Mouse-Events.
        picked_text = None
        try:
            # Erst: erstes passendes Element finden via JS-eval, dann native click
            option_id = await tab.evaluate(
                f"""(() => {{
                    const items = Array.from(document.querySelectorAll(
                        '[id^="react-select-"][id*="-option"], [role="option"]'
                    )).filter(el => el.offsetParent !== null);
                    for (const it of items) {{
                        const txt = (it.innerText || '').trim();
                        if (txt.toLowerCase().includes(
                            {json.dumps(expected_substring.lower())}
                        )) {{
                            if (!it.id) it.id = 'auto-pick-target-' + Date.now();
                            return {{id: it.id, text: txt}};
                        }}
                    }}
                    if (items.length > 0) {{
                        const first = items[0];
                        if (!first.id) first.id = 'auto-pick-target-' + Date.now();
                        return {{id: first.id, text: (first.innerText || '').trim()}};
                    }}
                    return null;
                }})()"""
            )
            if isinstance(option_id, dict) and "value" in option_id:
                option_id = option_id["value"]
            if option_id and isinstance(option_id, dict):
                target_id = option_id.get("id")
                picked_text = option_id.get("text")
                if target_id:
                    opt_elem = await tab.query_selector(f'#{target_id}')
                    if opt_elem:
                        await opt_elem.click()
                        print(f">>>   Native-Click Suggestion: {picked_text!r}",
                              file=sys.stderr, flush=True)
        except Exception as e:
            print(f">>>   Native-Click FAIL: {e}",
                  file=sys.stderr, flush=True)

        if not picked_text:
            # Fallback: ArrowDown + Enter direkt im Input
            try:
                inp = await tab.query_selector(
                    'input[id^="react-select-"][id$="-input"]'
                )
                if inp:
                    await inp.send_keys("ArrowDown")
                    await asyncio.sleep(0.3)
                    await inp.send_keys("Enter")
                    print(">>>   Fallback ArrowDown+Enter",
                          file=sys.stderr, flush=True)
            except Exception:
                pass

        await asyncio.sleep(3.0)  # warten dass Tag im DOM erscheint

        # Verifikation via Body-Text
        body = await tab.evaluate(
            "(document.body && document.body.innerText) || ''"
        )
        if isinstance(body, dict) and "value" in body:
            body = body["value"]
        geo_now = parse_geo_state(body or "")
        ok = bool(geo_now and expected_substring.lower() in geo_now.lower()
                  and geo_now != "Neuer Ort")
        return ok
    except Exception:
        return False


_RADIO_IDS = {
    "ETW": "id_type_0",
    "Mietwohnung": "id_type_1",
    "Hauskauf": "id_type_2",
    "Hausmiete": "id_type_3",
}


async def _select_radio(tab, label_text: str) -> bool:
    """Klickt Object-Typ-Radio via native Browser-Click auf das Label-Element.

    Bei Bootstrap custom-control ist <input type="radio"> versteckt;
    nur <label for="id_type_X"> ist click-able. Wir nutzen nodriver's
    native click() (echter Mouse-Event), nicht JS-Synth-click.
    """
    radio_id = _RADIO_IDS.get(label_text)
    if not radio_id:
        return False
    try:
        label = await tab.query_selector(f'label[for="{radio_id}"]')
        if not label:
            # Fallback: Element via JS
            await tab.evaluate(
                f"""(() => {{
                    const lbl = document.querySelector('label[for=' + {json.dumps(radio_id)} + ']');
                    if (lbl) lbl.click();
                }})()"""
            )
            return True
        await label.click()
        await asyncio.sleep(0.4)
        return True
    except Exception:
        return False


async def _click_bauliches_tab(tab) -> bool:
    try:
        clicked = await tab.evaluate(
            """(() => {
                const tabs = Array.from(document.querySelectorAll('a, button'))
                    .filter(b => b.innerText.trim() === 'Bauliches');
                if (tabs.length === 0) return false;
                tabs[0].click();
                return true;
            })()"""
        )
        if isinstance(clicked, dict) and "value" in clicked:
            clicked = clicked["value"]
        return bool(clicked)
    except Exception:
        return False


async def _click_mfh_checkbox(tab) -> bool:
    """Klickt 'Mehrfamilienhaus' unter 'Art' im Bauliches-Tab."""
    try:
        clicked = await tab.evaluate(
            """(() => {
                const cbs = Array.from(document.querySelectorAll(
                    'input[type="checkbox"]'
                ));
                for (const cb of cbs) {
                    const wrap = cb.parentElement
                        ? cb.parentElement.innerText.trim() : '';
                    if (wrap.includes('Mehrfamilienhaus')) {
                        if (!cb.checked) cb.click();
                        return true;
                    }
                }
                return false;
            })()"""
        )
        if isinstance(clicked, dict) and "value" in clicked:
            clicked = clicked["value"]
        return bool(clicked)
    except Exception:
        return False


async def _uncheck_mfh_checkbox(tab) -> bool:
    try:
        clicked = await tab.evaluate(
            """(() => {
                const cbs = Array.from(document.querySelectorAll(
                    'input[type="checkbox"]'
                ));
                for (const cb of cbs) {
                    const wrap = cb.parentElement
                        ? cb.parentElement.innerText.trim() : '';
                    if (wrap.includes('Mehrfamilienhaus')) {
                        if (cb.checked) cb.click();
                        return true;
                    }
                }
                return false;
            })()"""
        )
        if isinstance(clicked, dict) and "value" in clicked:
            clicked = clicked["value"]
        return bool(clicked)
    except Exception:
        return False


async def _click_create_stat(tab) -> bool:
    """Triggert das Statistik-Submit via Native-Click auf 'Statistik erstellen'.

    IntercoolerJS reagiert nur auf echte UI-Clicks; reine Form.submit() macht
    Full-Page-Reload, was den State zerstoert.
    """
    try:
        btn = None
        try:
            btn = await tab.find("Statistik erstellen", best_match=True, timeout=3)
        except Exception:
            pass
        if btn:
            await btn.click()
            print(">>>   Native-Click 'Statistik erstellen'",
                  file=sys.stderr, flush=True)
            return True
    except Exception as e:
        print(f">>>   Click 'Statistik erstellen' FAIL: {e}",
              file=sys.stderr, flush=True)

    # Letzter Fallback: JS-Click auf gefundenen Button
    try:
        clicked = await tab.evaluate(
            """(() => {
                const btns = Array.from(document.querySelectorAll('button, a'))
                    .filter(b => b.innerText.trim() === 'Statistik erstellen');
                if (btns.length === 0) return false;
                btns[0].click();
                return true;
            })()"""
        )
        if isinstance(clicked, dict) and "value" in clicked:
            clicked = clicked["value"]
        return bool(clicked)
    except Exception:
        return False


async def _wait_for_stat_loaded(tab, timeout_s: float = 12.0) -> bool:
    """Wartet bis 'Wird geladen...' verschwunden ist und ein Übersicht-Block sichtbar ist."""
    import time
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        try:
            body = await tab.evaluate(
                "(document.body && document.body.innerText) || ''"
            )
            if isinstance(body, dict) and "value" in body:
                body = body["value"]
            if isinstance(body, str) and "Übersicht:" in body and "Wird geladen" not in body:
                return True
        except Exception:
            pass
        await asyncio.sleep(0.6)
    return False


async def _get_dom_body(tab) -> str:
    try:
        body = await tab.evaluate(
            "(document.body && document.body.innerText) || ''"
        )
        if isinstance(body, dict) and "value" in body:
            body = body["value"]
        return body or ""
    except Exception:
        return ""


async def _save_screenshot(tab, label: str, ts: str) -> Optional[Path]:
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    p = RUNS_DIR / f"{ts}_immometrica_{label}.png"
    try:
        await tab.save_screenshot(filename=str(p), full_page=False)
        return p
    except Exception:
        return None


async def _verify_radio_checked(tab, radio_id: str) -> bool:
    try:
        r = await tab.evaluate(
            f"""(() => {{
                const r = document.getElementById({json.dumps(radio_id)});
                return r ? !!r.checked : false;
            }})()"""
        )
        if isinstance(r, dict) and "value" in r:
            r = r["value"]
        return bool(r)
    except Exception:
        return False


async def _verify_mfh_checked(tab) -> bool:
    try:
        r = await tab.evaluate(
            """(() => {
                const cbs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
                for (const cb of cbs) {
                    const wrap = cb.parentElement ? cb.parentElement.innerText.trim() : '';
                    if (wrap.includes('Mehrfamilienhaus')) return !!cb.checked;
                }
                return false;
            })()"""
        )
        if isinstance(r, dict) and "value" in r:
            r = r["value"]
        return bool(r)
    except Exception:
        return False


async def _verify_geo_set(tab, expected_substring: str) -> Optional[str]:
    try:
        body = await _get_dom_body(tab)
        geo = parse_geo_state(body)
        if geo and expected_substring.lower() in geo.lower() and geo != "Neuer Ort":
            return geo
        return None
    except Exception:
        return None


async def _wait_for_radio(tab, radio_id: str, timeout_s: float = 6.0) -> bool:
    import time
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        if await _verify_radio_checked(tab, radio_id):
            return True
        await asyncio.sleep(0.4)
    return False


async def _wait_for_mfh(tab, want_checked: bool, timeout_s: float = 6.0) -> bool:
    import time
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        cur = await _verify_mfh_checked(tab)
        if cur == want_checked:
            return True
        await asyncio.sleep(0.4)
    return False


async def _wait_for_geo(tab, expected_substring: str, timeout_s: float = 6.0) -> Optional[str]:
    import time
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        geo = await _verify_geo_set(tab, expected_substring)
        if geo:
            return geo
        await asyncio.sleep(0.4)
    return None


async def _run_one_config(
    tab,
    *,
    geo_query: str,
    geo_expected: str,
    radio: str,
    mfh: bool,
    year_half: str,
    label: str,
    ts: str,
) -> dict:
    """Setzt Filter und liefert geparsten Stat-Block.

    Mit grosszuegigen Wait-Zeiten und Verifikation pro Schritt — die App
    ist langsam (Server-State + React-Render + IntercoolerJS-AJAX).
    """
    radio_id = _RADIO_IDS[radio]

    # Page laden (resetted Filter-State)
    await tab.get(URL_STATISTICS)
    await asyncio.sleep(6.0)  # generoeses Hydration-Wait

    # Period waehlen
    await _select_period(tab, year_half)
    await asyncio.sleep(2.0)

    # Radio + Verifikation
    await _select_radio(tab, radio)
    radio_ok = await _wait_for_radio(tab, radio_id, timeout_s=6.0)
    print(f">>>   Radio {radio!r} checked: {radio_ok}",
          file=sys.stderr, flush=True)
    if not radio_ok:
        # Retry mit nochmals klick
        await _select_radio(tab, radio)
        radio_ok = await _wait_for_radio(tab, radio_id, timeout_s=4.0)
        print(f">>>   Radio retry: {radio_ok}",
              file=sys.stderr, flush=True)
    await asyncio.sleep(1.5)

    # GEO VOR Bauliches setzen — React-Select Component sonst gestoert von
    # Tab-Wechsel (Bauliches re-mounted das Component)
    await _enter_geo(tab, geo_query, geo_expected)
    await asyncio.sleep(3.0)
    geo_state = await _wait_for_geo(tab, geo_expected, timeout_s=8.0)
    print(f">>>   Geo nach React-Select: state={geo_state!r}",
          file=sys.stderr, flush=True)
    if not geo_state:
        # Retry
        print(">>>   Geo retry...", file=sys.stderr, flush=True)
        await _enter_geo(tab, geo_query, geo_expected)
        await asyncio.sleep(3.0)
        geo_state = await _wait_for_geo(tab, geo_expected, timeout_s=8.0)
        print(f">>>   Geo nach retry: state={geo_state!r}",
              file=sys.stderr, flush=True)

    # Bauliches-Tab oeffnen + MFH-Checkbox passend setzen (NACH Geo!)
    await _click_bauliches_tab(tab)
    await asyncio.sleep(2.0)
    if mfh:
        await _click_mfh_checkbox(tab)
    else:
        await _uncheck_mfh_checkbox(tab)
    mfh_ok = await _wait_for_mfh(tab, mfh, timeout_s=6.0)
    print(f">>>   MFH-Checkbox = {mfh}: {mfh_ok}",
          file=sys.stderr, flush=True)
    if not mfh_ok:
        if mfh:
            await _click_mfh_checkbox(tab)
        else:
            await _uncheck_mfh_checkbox(tab)
        mfh_ok = await _wait_for_mfh(tab, mfh, timeout_s=4.0)
        print(f">>>   MFH retry: {mfh_ok}",
              file=sys.stderr, flush=True)
    await asyncio.sleep(1.5)

    # Statistik erstellen
    submitted = await _click_create_stat(tab)
    if not submitted:
        return {
            "status": "error",
            "error": "submit_button_not_found",
            "geo_ok": bool(geo_state),
            "uebersicht": None,
            "zusatzinfo": None,
        }

    # Warten auf neue Stat (15s wegen Server-Render)
    loaded = await _wait_for_stat_loaded(tab, timeout_s=20.0)
    await asyncio.sleep(1.5)  # extra fuer final DOM-Settle
    body = await _get_dom_body(tab)
    geo_state_final = parse_geo_state(body)
    parsed = parse_stat_block(body)

    # Screenshot zur Verifikation
    shot = await _save_screenshot(tab, f"{label}", ts)

    return {
        "status": "ok" if loaded and parsed.get("uebersicht") else "partial",
        "geo_ok": bool(geo_state),
        "geo_state": geo_state_final,
        "radio_checked": radio_ok,
        "mfh_checked": mfh_ok,
        "uebersicht": parsed.get("uebersicht"),
        "zusatzinfo": parsed.get("zusatzinfo"),
        "screenshot": str(shot) if shot else None,
    }


async def _run_async(
    plz: str,
    stadt: str,
    year_half: str,
    headless: bool,
) -> dict:
    import nodriver as uc

    USER_DATA_DIR.mkdir(parents=True, exist_ok=True)
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    ts = _ts_slug()

    print(f">>> Immometrica-Adapter Start ({_ts_iso()})", file=sys.stderr, flush=True)

    browser = await uc.start(
        user_data_dir=str(USER_DATA_DIR),
        headless=headless,
        lang="de-DE",
        browser_args=[
            "--lang=de-DE",
            "--disable-blink-features=AutomationControlled",
            "--start-maximized",
        ],
    )

    out = {
        "status": "error",
        "portal": "immometrica",
        "marktwert_eur_mittel": None,
        "marktwert_eur_min": None,
        "marktwert_eur_max": None,
        "trends": {"jahre_3": None, "jahr_1": None, "prognose": None},
        "trend_ampel": None,
        "trend_label": None,
        "url": URL_STATISTICS,
        "timestamp": _ts_iso(),
        "screenshot_path": None,
        "extra": {
            "year_half": year_half,
            "plz_input": plz,
            "stadt_input": stadt,
            "plz_etw": None,
            "plz_mfh": None,
            "stadt_etw": None,
            "stadt_mfh": None,
        },
    }

    try:
        # Login sichern (oder neu loggen)
        tab = await browser.get(URL_HOME)
        await asyncio.sleep(3.0)
        logged = await _ensure_logged_in(tab)
        if not logged:
            out["status"] = "error"
            out["error_code"] = "login_failed"
            out["error_message"] = "Login auf Immometrica fehlgeschlagen"
            return out

        # 4 Configs nacheinander
        configs = [
            ("plz_etw", plz, plz, "ETW", False),
            ("plz_mfh", plz, plz, "Hauskauf", True),
            ("stadt_etw", stadt, stadt, "ETW", False),
            ("stadt_mfh", stadt, stadt, "Hauskauf", True),
        ]
        for slot, geo_q, geo_exp, radio, mfh in configs:
            print(f">>> Config {slot}: geo={geo_q!r} radio={radio} mfh={mfh}",
                  file=sys.stderr, flush=True)
            result = await _run_one_config(
                tab,
                geo_query=geo_q,
                geo_expected=geo_exp,
                radio=radio,
                mfh=mfh,
                year_half=year_half,
                label=slot,
                ts=ts,
            )
            out["extra"][slot] = result
            print(f">>>   -> status={result.get('status')} geo_state={result.get('geo_state')!r}",
                  file=sys.stderr, flush=True)
            uebersicht = result.get("uebersicht") if isinstance(result, dict) else None
            if uebersicht:
                print(
                    f">>>   -> Anz={uebersicht.get('anzahl_angebote')} "
                    f"Preis/m²={uebersicht.get('median_preis_eur_per_qm')} "
                    f"Rendite={uebersicht.get('rendite_pct')}",
                    file=sys.stderr, flush=True,
                )

        # Status final
        non_error = sum(
            1 for slot in ("plz_etw", "plz_mfh", "stadt_etw", "stadt_mfh")
            if isinstance(out["extra"].get(slot), dict)
            and out["extra"][slot].get("status") in ("ok", "partial")
            and out["extra"][slot].get("uebersicht")
        )
        if non_error == 4:
            out["status"] = "ok"
        elif non_error > 0:
            out["status"] = "partial"
            out["error_code"] = "partial_configs"
            out["error_message"] = f"{4 - non_error} von 4 Configs unvollstaendig"
        else:
            out["status"] = "error"
            out["error_code"] = "all_configs_failed"
            out["error_message"] = "Keine Config lieferte Werte"

        return out

    except Exception as e:
        print(f">>> Exception: {e}\n{traceback.format_exc()}",
              file=sys.stderr, flush=True)
        out["status"] = "error"
        out["error_code"] = "exception"
        out["error_message"] = str(e)
        return out
    finally:
        try:
            browser.stop()
        except Exception:
            pass


def run_immometrica(
    plz: str,
    stadt: str,
    year_half: str = "H1/2026",
    headless: bool = True,
) -> dict:
    """Sync-Wrapper. Liefert das JSON-Schema (RunResult-kompatibel) als dict."""
    import nodriver as uc
    return uc.loop().run_until_complete(_run_async(plz, stadt, year_half, headless))


class ImmometricaPortal:
    """Adapter-Klasse fuer PORTAL_REGISTRY (kompatibel zu PortalBase-Idiom).

    Aber: Erbt NICHT von PortalBase, weil Immometrica-Adapter nodriver statt
    Playwright nutzt (reCAPTCHA). Stattdessen exponiert es eine
    run(datensatz, cfg)-Methode, die PORTAL_REGISTRY direkt callen kann.
    """

    NAME = "immometrica"
    START_URL = URL_STATISTICS

    def run(self, datensatz, cfg=None) -> dict:
        # datensatz ist GeneralisierterDatensatz oder hat .plz / .ort
        plz = getattr(datensatz, "plz", None) or ""
        stadt = getattr(datensatz, "ort", None) or ""
        if not plz or not stadt:
            return {
                "status": "error",
                "portal": "immometrica",
                "error_code": "missing_geo",
                "error_message": "PLZ oder Stadt fehlen im Datensatz",
                "timestamp": _ts_iso(),
            }
        headless = bool(getattr(cfg, "headless", True)) if cfg else True
        year_half = (
            getattr(cfg, "year_half", None) if cfg else None
        ) or "H1/2026"
        return run_immometrica(plz=plz, stadt=stadt, year_half=year_half, headless=headless)
