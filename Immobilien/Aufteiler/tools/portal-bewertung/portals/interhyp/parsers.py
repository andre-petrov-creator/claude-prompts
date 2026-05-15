"""Body-Text-Parser fuer die Interhyp-Immobilienbewertungs-Result-Seite.

Extrahiert:
- Marktwert-Min/Mittel/Max aus 'Untergrenze/Schaetzwert/Obergrenze'-Block
- Marktwert + EUR/m² je Ausstattungsklasse (Einfach/Gehoben/Luxus)
- 2-Jahres-Trend-% aus dem Wertentwicklung-Tab (Zeitraum=2 Jahre)

Plus Ampel-Logik (analog zu portals/homeday/parsers.py) — Interhyp liefert
nur EINEN Trend-Wert pro Zeitraum, keine 3J/1J/Prognose-Aufschluesselung.
"""
from __future__ import annotations

import re
from typing import Optional

# Euro-Wert mit Tausenderpunkten, optional vor EUR oder €.
_EURO_INT_RE = r"(\d{1,3}(?:\.\d{3})+)\s*(?:EUR|€)"


def _euro_to_int(s: str) -> Optional[int]:
    digits = s.replace(".", "").replace(" ", "")
    return int(digits) if digits.isdigit() else None


def parse_marktwert_interhyp(text: str) -> dict[str, Optional[int]]:
    """Extrahiert Marktwert-Min/Mittel/Max aus dem Zusammenfassung-Tab.

    Live-Body-Layout (Stand 2026-05-15):
      <Untergrenze-€>
      <Obergrenze-€>
      Schätzwert *
      <Mittel-€>

    Heisst: Min und Max sind nicht beschriftet — sie stehen direkt vor dem
    Schätzwert-Marker. Wir matchen das ganze Block-Pattern als Anker.

    Fallback: einzelner Schätzwert wenn Block-Pattern bricht.

    Toleriert 'EUR' und '€', 'ä' und 'ae' in 'Schätzwert', optional '*'.
    """
    out: dict[str, Optional[int]] = {"min": None, "mittel": None, "max": None}

    # Voll-Pattern: 2 Werte, dann Schätzwert-Marker, dann Mittel-Wert
    m_full = re.search(
        rf"{_EURO_INT_RE}\s*[\r\n]+\s*"
        rf"{_EURO_INT_RE}\s*[\r\n]+\s*"
        rf"Sch(?:ä|ae)tzwert\s*\*?\s*[\r\n]+\s*"
        rf"{_EURO_INT_RE}",
        text,
        re.IGNORECASE,
    )
    if m_full:
        out["min"] = _euro_to_int(m_full.group(1))
        out["max"] = _euro_to_int(m_full.group(2))
        out["mittel"] = _euro_to_int(m_full.group(3))
        return out

    # Legacy-Fallback: explizit beschriftete Werte (Sparring-Sample)
    m_min = re.search(rf"Untergrenze\s*[\r\n]+\s*{_EURO_INT_RE}", text, re.IGNORECASE)
    if m_min:
        out["min"] = _euro_to_int(m_min.group(1))

    m_mittel = re.search(
        rf"Sch(?:ä|ae)tzwert\s*\*?\s*[\r\n]+\s*{_EURO_INT_RE}", text, re.IGNORECASE
    )
    if m_mittel:
        out["mittel"] = _euro_to_int(m_mittel.group(1))

    m_max = re.search(rf"Obergrenze\s*[\r\n]+\s*{_EURO_INT_RE}", text, re.IGNORECASE)
    if m_max:
        out["max"] = _euro_to_int(m_max.group(1))

    return out


def parse_eur_per_qm_by_ausstattung(text: str) -> dict[str, Optional[int]]:
    """Extrahiert EUR/m² je Klasse aus dem 'Preisunterschiede...'-Block.

    Live-Body-Layout (Stand 2026-05-15):
      Einfach 162.000 €
      2.025 € /m²
      Gehoben 172.000 €
      2.150 € /m²
      Luxus 191.000 €
      2.388 € /m²

    Wichtig: Klasse + Marktwert stehen in der SELBEN Zeile (kein Newline
    dazwischen). EUR/m² hat ein Leerzeichen zwischen '€' und '/m²'.

    Auch das Legacy-Layout (Newline zwischen Klasse und Wert) wird matched.
    """
    out: dict[str, Optional[int]] = {"einfach": None, "gehoben": None, "luxus": None}
    eur_per_qm_value = r"(\d{1,3}(?:\.\d{3})*)\s*(?:EUR|€)\s*/\s*m"
    for klasse in ("Einfach", "Gehoben", "Luxus"):
        # Pattern toleriert beide Layouts (Klasse mit Wert in einer Zeile
        # ODER getrennt durch Newline). \s+ matched Leerzeichen UND Newline.
        pattern = (
            rf"(?:^|\n)\s*{klasse}\s+\d{{1,3}}(?:\.\d{{3}})+\s*(?:EUR|€)\s*[\r\n]+"
            rf"\s*{eur_per_qm_value}"
        )
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            out[klasse.lower()] = _euro_to_int(m.group(1))
    return out


def parse_marktwert_by_ausstattung(text: str) -> dict[str, Optional[int]]:
    """Extrahiert den Marktwert (EUR) je Klasse aus dem 'Preisunterschiede...'-Block.

    Live-Pattern: 'Einfach 162.000 €' (Klasse + Wert in einer Zeile).
    Legacy: 'Einfach\\n183.000 EUR' (mit Newline) wird auch matched.
    """
    out: dict[str, Optional[int]] = {"einfach": None, "gehoben": None, "luxus": None}
    for klasse in ("Einfach", "Gehoben", "Luxus"):
        # \s+ erlaubt Leerzeichen ODER Newline zwischen Klasse und Wert
        pattern = rf"(?:^|\n)\s*{klasse}\s+{_EURO_INT_RE}"
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            out[klasse.lower()] = _euro_to_int(m.group(1))
    return out


def parse_trend_2j_pct(text: str) -> Optional[float]:
    """Extrahiert den 2-Jahres-Trend-% aus dem Wertentwicklung-Tab.

    Voraussetzung: Adapter hat Zeitraum-Dropdown auf '2 Jahre' gestellt.
    Pattern: 'Wertentwicklung\\n<eur> EUR\\n+ 18 %' (oder '- 10 %', '+ 0,5 %').
    """
    m = re.search(
        r"Wertentwicklung\b.*?([+-])\s*(\d+(?:[,.]\d+)?)\s*%",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    if not m:
        return None
    sign = m.group(1)
    raw = m.group(2).replace(",", ".")
    try:
        value = float(raw)
    except ValueError:
        return None
    return -value if sign == "-" else value


def trend_ampel_interhyp(trend_pct: Optional[float]) -> tuple[str, str]:
    """Ampel-Logik fuer den 2-Jahres-Trend.

    Schwellen (analog homeday):
      > +1 %    -> gruen  ('steigend')
      |x| <= 1  -> gelb   ('stagnierend')
      < -1 %    -> rot    ('fallend')
      None      -> grau   ('keine Daten')
    """
    if trend_pct is None:
        return "grau", "— (keine Daten)"
    if trend_pct > 1.0:
        return "gruen", f"steigend (+{trend_pct:.1f}%)"
    if trend_pct < -1.0:
        return "rot", f"fallend ({trend_pct:+.1f}%)"
    return "gelb", f"stagnierend ({trend_pct:+.1f}%)"


def parse_svg_path_points(path_d: str) -> list[tuple[float, float]]:
    """Parst einen SVG-Path-String ('M x y L x y L x y ...') zu (x,y)-Punkten.

    Akzeptiert M-, L-Befehle und implizite L nach M. Komma- und Whitespace-
    Trennung. Ignoriert ungerade Zahlen-Counts.
    """
    nums = [float(n) for n in re.findall(r"-?\d+\.?\d*", path_d)]
    if len(nums) < 4 or len(nums) % 2 != 0:
        return []
    return [(nums[i], nums[i + 1]) for i in range(0, len(nums), 2)]


def classify_trend_richtung(
    points: list[tuple[float, float]],
    *,
    last_fraction: float = 0.2,
    threshold_fraction: float = 0.02,
    min_pixel_threshold: float = 2.0,
) -> Optional[str]:
    """Klassifiziert die Richtung der letzten 'last_fraction' der Punkt-Liste.

    Annahme: Punkte sind nach X aufsteigend sortiert (Zeit links→rechts).
    Bei einem Highcharts-Default-Zeitraum von 10 Jahren entspricht
    last_fraction=0.2 etwa den letzten 2 Jahren.

    Y-Achse ist SVG-invertiert: kleinerer Y-Wert = höher gezeichnet = höherer Preis.

    Schwelle: max(y_range * threshold_fraction, min_pixel_threshold).
    Bei flachen Charts (y_range < min_pixel_threshold) immer 'stagniert'.

    Returns: 'steigt' | 'stagniert' | 'faellt' | None (zu wenige Punkte).
    """
    n = len(points)
    if n < 4:
        return None
    n_last = max(2, int(n * last_fraction))
    last_segment = points[-n_last:]
    y_start = last_segment[0][1]
    y_end = last_segment[-1][1]
    y_values = [y for _, y in points]
    y_range = max(y_values) - min(y_values)
    if y_range < min_pixel_threshold:
        return "stagniert"
    threshold = max(y_range * threshold_fraction, min_pixel_threshold * 0.5)
    diff = y_start - y_end
    if diff > threshold:
        return "steigt"
    if diff < -threshold:
        return "faellt"
    return "stagniert"


def trend_ampel_from_richtung(richtung: Optional[str]) -> tuple[str, str]:
    """Mappt Richtung ('steigt'/'stagniert'/'faellt'/None) auf Ampel + Label.

    User-Vorgabe: simple Ampel ohne Prozent-Angaben.
    """
    return {
        "steigt": ("gruen", "steigt"),
        "stagniert": ("gelb", "stagniert"),
        "faellt": ("rot", "faellt"),
    }.get(richtung or "", ("grau", "— (keine Daten)"))
