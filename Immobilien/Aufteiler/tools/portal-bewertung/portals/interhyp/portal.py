"""Interhyp-Portal-Adapter.

Architektur: 9-Schritt-Wizard, der vom Adapter selbst durchgeklickt wird
(fill_form). Nach 'Ergebnisse anzeigen' liegt das Resultat im Hauptdokument
(kein iframe). Marktwert + EUR/m² werden aus dem Zusammenfassung-Tab geparst;
der 2-Jahres-Trend wird durch separaten Klick auf den Wertentwicklung-Tab
geholt.

Output: Standard-Marktwert-Felder (min/mittel/max) bleiben None (Homeday-
Pattern). Alle Interhyp-Werte liegen im RunResult.extra-Slot:
  - marktwert_eur_min/mittel/max (Zusammenfassung-Range)
  - eur_per_qm (zur gewaehlten Ausstattung) + eur_per_qm_einfach/gehoben/luxus
  - marktwert_einfach_eur/gehoben_eur/luxus_eur
  - ausstattung_klasse_gewaehlt
  - trend_2j_pct, trend_2j_ampel, trend_2j_ampel_label

Live-Lauf: siehe docs/portal-interhyp.md.
"""
from __future__ import annotations

from typing import Any, Optional

from core.datensatz import GeneralisierterDatensatz
from core.portal_base import PortalBase, RunConfig

from . import selectors as sel
from .parsers import (
    classify_trend_richtung,
    parse_eur_per_qm_by_ausstattung,
    parse_marktwert_by_ausstattung,
    parse_marktwert_interhyp,
    parse_svg_path_points,
    trend_ampel_from_richtung,
)


# ---------------------------------------------------------------------------
# Selector-Helpers — robuste Multi-Strategie-Locators fuer Interhyp's
# Material-UI-Style-Wizard (Floating-Labels, Karten-Radios, Footer-Buttons
# mit gleichem Text wie Wizard-Optionen).
# ---------------------------------------------------------------------------

_FILL_STRATEGIES = (
    "label_exact",
    "label_fuzzy",
    "placeholder",
    "aria_label_contains",
)

_CLICK_STRATEGIES = (
    "label_text",
    "role_radio",
    "button_text",
    "role_button",
)


def _fill_input(page: Any, label_text: str, value: str) -> bool:
    """Versucht ein Input zu fuellen ueber mehrere Selektor-Strategien."""
    candidates = [
        ("label_exact", lambda: page.get_by_label(label_text, exact=True)),
        ("label_fuzzy", lambda: page.get_by_label(label_text)),
        ("placeholder", lambda: page.get_by_placeholder(label_text)),
        (
            "aria_label_contains",
            lambda: page.locator(f'input[aria-label*="{label_text}"]'),
        ),
    ]
    for _, make_loc in candidates:
        try:
            loc = make_loc().first
            if loc.count() > 0 and loc.is_visible():
                loc.fill(value, timeout=4_000)
                return True
        except Exception:
            continue
    return False


def _click_text(page: Any, text: str) -> bool:
    """Klickt ein Element mit gegebenem Text ueber mehrere Strategien.

    Reihenfolge: Wizard-spezifische Selektoren (label/radio) zuerst, damit
    keine Footer-Buttons mit dem gleichen Label getroffen werden.
    """
    candidates = [
        ("label_text", lambda: page.locator(f'label:has-text("{text}")')),
        ("role_radio_text", lambda: page.locator(f'[role="radio"]:has-text("{text}")')),
        ("button_text", lambda: page.locator(f'button:has-text("{text}")')),
        ("role_radio", lambda: page.get_by_role("radio", name=text)),
        ("role_button", lambda: page.get_by_role("button", name=text)),
    ]
    for _, make_loc in candidates:
        try:
            loc = make_loc().first
            if loc.count() > 0 and loc.is_visible():
                loc.click(timeout=3_000)
                return True
        except Exception:
            continue
    return False


def _click_sanierung_radio(page: Any, value: str) -> bool:
    """Klickt die Wizard-Karte 'Ja' oder 'Nein' fuer 'Hat eine Sanierung
    stattgefunden?'.

    Schutz vor dem Footer-Button 'Sind Sie zufrieden? Ja/Nein' via
    `:not(:has-text("zufrieden"))`.
    """
    for sel_str in [
        f'label:has-text("{value}"):not(:has-text("zufrieden"))',
        f'[role="radio"]:has-text("{value}")',
    ]:
        try:
            loc = page.locator(sel_str).first
            if loc.count() > 0 and loc.is_visible():
                loc.click(timeout=3_000)
                return True
        except Exception:
            continue
    return False


def _click_strasse_dropdown_item(page: Any, strasse: str, ort: str) -> bool:
    """Klickt im Autocomplete-Dropdown den Eintrag mit Strasse + Ort.

    Interhyp's Strassen-Autocomplete erfordert Klick (Enter reicht nicht).
    Format: 'Prosperstrasse, Essen' (Strasse + Komma + Ort).
    """
    target = f"{strasse}, {ort}"
    for sel_str in [
        f'li:has-text("{target}")',
        f'[role="option"]:has-text("{target}")',
        f'text="{target}"',
    ]:
        try:
            loc = page.locator(sel_str).first
            if loc.count() > 0 and loc.is_visible():
                loc.click(timeout=2_000)
                return True
        except Exception:
            continue
    # Fallback: erster Vorschlag mit der Strasse
    for sel_str in [f'li:has-text("{strasse}")', f'[role="option"]:has-text("{strasse}")']:
        try:
            loc = page.locator(sel_str).first
            if loc.count() > 0 and loc.is_visible():
                loc.click(timeout=2_000)
                return True
        except Exception:
            continue
    return False


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------


class InterhypPortal(PortalBase):
    """Adapter fuer interhyp.de/rechner/immobilienbewertung."""

    NAME = "interhyp"
    START_URL = sel.START_URL
    COOKIE_ACCEPT_CANDIDATES = sel.COOKIE_ACCEPT_CANDIDATES
    COOKIE_WRAPPER = sel.COOKIE_WRAPPER
    SUBMIT_SELECTOR = ""  # fill_form klickt selbst 'Ergebnisse anzeigen'
    RESULT_FRAME_MARKER = sel.RESULT_FRAME_MARKER

    def __init__(
        self,
        *,
        balkon_groesse_default_qm: int = 6,
        parkplatz_groesse_default_qm: int = 12,
    ) -> None:
        self.balkon_groesse_default_qm = balkon_groesse_default_qm
        self.parkplatz_groesse_default_qm = parkplatz_groesse_default_qm
        self.ausstattung_klasse_gewaehlt: Optional[str] = None

    def fill_form(self, page: Any, d: GeneralisierterDatensatz, cfg: RunConfig) -> None:
        """Klickt durch den 9-Schritt-Wizard inkl. 'Ergebnisse anzeigen'."""
        # Step 1: Immobilienart
        _click_text(page, sel.STEP1_IMMOBILIENART)
        page.wait_for_timeout(1_500)

        # Step 2: Adresse (PLZ -> Ort auto, Strasse mit Autocomplete-Klick, Hausnr)
        _fill_input(page, "PLZ", d.plz)
        page.wait_for_timeout(1_500)
        _fill_input(page, "Straße", d.strasse)
        page.wait_for_timeout(1_500)
        _click_strasse_dropdown_item(page, d.strasse, d.ort)
        page.wait_for_timeout(400)
        if d.hausnr:
            _fill_input(page, "Hausnummer", d.hausnr)
            page.wait_for_timeout(400)
        _click_text(page, "Weiter")
        page.wait_for_timeout(1_800)

        # Step 3: Beweggrund (Kapitalanlage, Auto-Advance)
        _click_text(page, sel.STEP3_BEWEGGRUND)
        page.wait_for_timeout(1_800)

        # Step 4: Kaufpreis + Miete — beide leer lassen (haben laut User keinen
        # Einfluss auf die Bewertung). Direkt Weiter.
        _click_text(page, "Weiter")
        page.wait_for_timeout(1_800)

        # Step 5: Wohnflaeche + Zimmer
        _fill_input(page, "Wohnfläche", str(d.avg_wohnflaeche_qm))
        page.wait_for_timeout(300)
        _fill_input(page, "Anzahl der Zimmer", str(d.avg_zimmer))
        page.wait_for_timeout(300)
        _click_text(page, "Weiter")
        page.wait_for_timeout(1_800)

        # Step 6: Baujahr
        _fill_input(page, "Baujahr", str(d.baujahr))
        page.wait_for_timeout(300)
        _click_text(page, "Weiter")
        page.wait_for_timeout(1_800)

        # Step 7: Sanierung Ja/Nein (+ optional Jahr)
        if d.sanierungsjahr_letztes is not None:
            _click_sanierung_radio(page, "Ja")
            page.wait_for_timeout(1_000)
            _fill_input(
                page, "Jahr der letzten Sanierung", str(d.sanierungsjahr_letztes)
            )
            page.wait_for_timeout(400)
        else:
            _click_sanierung_radio(page, "Nein")
            page.wait_for_timeout(800)
        _click_text(page, "Weiter")
        page.wait_for_timeout(1_800)

        # Step 8: Ausstattung (Auto-Advance)
        ausstattung_label = sel.STEP8_AUSSTATTUNG_MAP.get(d.ausstattung, "Einfach")
        self.ausstattung_klasse_gewaehlt = ausstattung_label.lower()
        _click_text(page, ausstattung_label)
        page.wait_for_timeout(2_000)

        # Step 9: Weitere Ausstattung (Checkboxen, optional)
        if d.hat_garage or d.hat_aussenstellplatz:
            _click_text(page, "Parkplatz")
            page.wait_for_timeout(600)
            # Groesse-Feld ist optional; falls vorhanden, fuellen
            _fill_input(
                page, "Größe des Parkplatzes",
                str(self.parkplatz_groesse_default_qm),
            )
            page.wait_for_timeout(300)

        # Submit: 'Ergebnisse anzeigen' (kein 'Weiter')
        _click_text(page, sel.SUBMIT_TEXT_WIZARD)
        page.wait_for_timeout(5_000)

    def dismiss_post_submit_modals(self, page: Any) -> None:
        """Keine Post-Submit-Modals bei Interhyp."""
        return None

    def extract_extra(self, body_text: str, page: Any) -> dict[str, Any]:
        """Parst alle Interhyp-Werte ins extra-Dict.

        1. Marktwert-Range + EUR/m² + Ausstattungs-Tabelle aus dem
           Zusammenfassung-Tab-Body
        2. Wertentwicklung-Tab + SVG-Path-Auswertung fuer 2-J-Trend-Richtung
        """
        marktwert = parse_marktwert_interhyp(body_text)
        eur_per_qm = parse_eur_per_qm_by_ausstattung(body_text)
        marktwert_by_klasse = parse_marktwert_by_ausstattung(body_text)

        klasse = self.ausstattung_klasse_gewaehlt or "einfach"
        chosen_eur_per_qm = eur_per_qm.get(klasse)

        richtung = _read_trend_2j_via_svg(page)
        ampel, ampel_label = trend_ampel_from_richtung(richtung)

        return {
            "marktwert_eur_min": marktwert["min"],
            "marktwert_eur_mittel": marktwert["mittel"],
            "marktwert_eur_max": marktwert["max"],
            "eur_per_qm": chosen_eur_per_qm,
            "eur_per_qm_einfach": eur_per_qm["einfach"],
            "eur_per_qm_gehoben": eur_per_qm["gehoben"],
            "eur_per_qm_luxus": eur_per_qm["luxus"],
            "marktwert_einfach_eur": marktwert_by_klasse["einfach"],
            "marktwert_gehoben_eur": marktwert_by_klasse["gehoben"],
            "marktwert_luxus_eur": marktwert_by_klasse["luxus"],
            "ausstattung_klasse_gewaehlt": klasse,
            "trend_2j_richtung": richtung,
            "trend_2j_ampel": ampel,
            "trend_2j_ampel_label": ampel_label,
        }


_WERTENTWICKLUNG_TAB_SELECTORS = (
    '[role="tab"]:has-text("Wertentwicklung")',
    'button[role="tab"]:has-text("Wertentwicklung")',
    'a[role="tab"]:has-text("Wertentwicklung")',
    'a:has-text("Wertentwicklung")',
    'button:has-text("Wertentwicklung")',
    'label:has-text("Wertentwicklung")',
    'div:has-text("Wertentwicklung"):not(:has(div))',
)


def _read_trend_2j_via_svg(page: Any) -> Optional[str]:
    """Liest die SVG-Path-Daten der Trend-Linie, klassifiziert Richtung der
    letzten 2 Jahre als 'steigt' / 'stagniert' / 'faellt'.

    Algorithmus:
      1. Klick auf Wertentwicklung-Tab (Multi-Strategie)
      2. Hole alle <path class="highcharts-graph">-Elemente
      3. Wähle den Pfad mit den meisten Punkten (= Default-Zeitraum, 10 Jahre)
      4. Parse 'M x y L x y L x y ...' zu (x,y)-Punkten
      5. Letzte 20% der Punkte = letzte 2 Jahre (Highcharts zeichnet linear)
      6. Vergleiche Y_start vs Y_end gegen 2% des Y-Range (SVG-invertiert)

    Bei Fehler oder zu wenig Daten: None (Ampel wird grau).
    """
    try:
        # Tab-Klick (Multi-Strategie)
        clicked = False
        for s in _WERTENTWICKLUNG_TAB_SELECTORS:
            try:
                loc = page.locator(s).first
                if loc.count() > 0 and loc.is_visible():
                    loc.click(timeout=2_000)
                    clicked = True
                    break
            except Exception:
                continue
        if not clicked:
            return None
        page.wait_for_timeout(3_000)

        # Lokalisiere den Wertentwicklungs-Chart-Container via 'Marktwert YYYY'-Anker
        # (die andere Charts auf der Seite — z.B. Preiskarte — matchen das nicht)
        paths_d = page.evaluate(
            """
            () => {
                let containers = Array.from(document.querySelectorAll('[role="tabpanel"]'))
                    .filter(p => !p.hidden && window.getComputedStyle(p).display !== 'none');
                if (containers.length === 0) {
                    const heading = Array.from(document.querySelectorAll('*'))
                        .find(el => /Marktwert\\s+\\d{4}/.test(el.textContent || ''));
                    if (heading) {
                        let el = heading;
                        for (let i = 0; i < 10; i++) {
                            el = el.parentElement;
                            if (!el) break;
                            if (el.querySelector('svg path.highcharts-graph')) {
                                containers = [el];
                                break;
                            }
                        }
                    }
                }
                const found = containers.length > 0
                    ? containers.flatMap(c => Array.from(c.querySelectorAll('path.highcharts-graph')))
                    : Array.from(document.querySelectorAll('path.highcharts-graph'));
                return found
                    .map(p => p.getAttribute('d') || '')
                    .filter(d => d.length > 100);
            }
            """
        )
        if not paths_d:
            return None

        # Pfad mit den meisten Punkten = Berechnete-Immobilie-Linie
        # (mehr Datenpunkte als die Ø-Linie wegen Interpolation)
        path_d = max(paths_d, key=len)
        points = parse_svg_path_points(path_d)
        return classify_trend_richtung(points)
    except Exception:
        return None
