"""Tests fuer portals/interhyp/parsers.py.

Body-Text-Samples basieren auf live-Beobachtungen (Sparring-Lauf
2026-05-15, Prosperstr. 59, 45357 Essen, Eigentumswohnung).
"""
from __future__ import annotations

import pytest

from portals.interhyp.parsers import (
    classify_trend_richtung,
    parse_eur_per_qm_by_ausstattung,
    parse_marktwert_by_ausstattung,
    parse_marktwert_interhyp,
    parse_svg_path_points,
    parse_trend_2j_pct,
    trend_ampel_from_richtung,
    trend_ampel_interhyp,
)


# ---------------------------------------------------------------------------
# parse_marktwert_interhyp
# ---------------------------------------------------------------------------

SAMPLE_ZUSAMMENFASSUNG_FULL = """
Ihr Immobilienwert betraegt
183.000 EUR
Zusammenfassung
Ihre Angaben
Strasse  Prosperstrasse 59
Ort      45357 Essen
Untergrenze
157.000 EUR
Schaetzwert*
183.000 EUR
Obergrenze
207.000 EUR
*80 % der Immobilien mit vergleichbarer Lage und Ausstattung befinden sich
in diesem Preisumfeld.
"""

# Live-Layout: Untergrenze/Obergrenze sind nicht beschriftet — sie stehen
# als nackte Euro-Werte direkt vor 'Schätzwert *'.
SAMPLE_ZUSAMMENFASSUNG_LIVE = """
Kaufpreis für Einschätzung hinzufügen
140.000 €
198.000 €
Schätzwert *
162.000 €
*80 % der Immobilien mit vergleichbarer Lage und Ausstattung
"""


def test_parse_marktwert_interhyp_full() -> None:
    mw = parse_marktwert_interhyp(SAMPLE_ZUSAMMENFASSUNG_FULL)
    assert mw == {"min": 157000, "mittel": 183000, "max": 207000}


def test_parse_marktwert_interhyp_live_layout() -> None:
    """Live-Layout: Werte ohne Label, direkt vor 'Schätzwert *'."""
    mw = parse_marktwert_interhyp(SAMPLE_ZUSAMMENFASSUNG_LIVE)
    assert mw == {"min": 140000, "mittel": 162000, "max": 198000}


def test_parse_marktwert_interhyp_with_euro_sign() -> None:
    text = "Untergrenze\n157.000 €\nSchaetzwert*\n183.000 €\nObergrenze\n207.000 €"
    mw = parse_marktwert_interhyp(text)
    assert mw == {"min": 157000, "mittel": 183000, "max": 207000}


def test_parse_marktwert_interhyp_no_match_returns_nones() -> None:
    mw = parse_marktwert_interhyp("kein passender text hier")
    assert mw == {"min": None, "mittel": None, "max": None}


def test_parse_marktwert_interhyp_partial_match_keeps_nones() -> None:
    # Nur Schaetzwert da, keine Spanne
    text = "Schaetzwert*\n183.000 EUR"
    mw = parse_marktwert_interhyp(text)
    assert mw["mittel"] == 183000
    assert mw["min"] is None
    assert mw["max"] is None


# ---------------------------------------------------------------------------
# parse_eur_per_qm_by_ausstattung
# ---------------------------------------------------------------------------

SAMPLE_AUSSTATTUNGSKLASSEN = """
Preisunterschiede verschiedener Ausstattungsklassen
Einfach
183.000 EUR
2.288 EUR/m²
Gehoben
194.000 EUR
2.425 EUR/m²
Luxus
215.000 EUR
2.688 EUR/m²
"""

# Live-Layout: Klasse + Marktwert in einer Zeile, EUR/m² mit Leerzeichen.
SAMPLE_AUSSTATTUNGSKLASSEN_LIVE = """
Preisunterschiede verschiedener Ausstattungsklassen
Einfach 162.000 €
2.025 € /m²
Gehoben 172.000 €
2.150 € /m²
Luxus 191.000 €
2.388 € /m²
"""


def test_parse_eur_per_qm_by_ausstattung_full() -> None:
    eq = parse_eur_per_qm_by_ausstattung(SAMPLE_AUSSTATTUNGSKLASSEN)
    assert eq == {"einfach": 2288, "gehoben": 2425, "luxus": 2688}


def test_parse_eur_per_qm_by_ausstattung_live() -> None:
    eq = parse_eur_per_qm_by_ausstattung(SAMPLE_AUSSTATTUNGSKLASSEN_LIVE)
    assert eq == {"einfach": 2025, "gehoben": 2150, "luxus": 2388}


def test_parse_marktwert_by_ausstattung_live() -> None:
    mw = parse_marktwert_by_ausstattung(SAMPLE_AUSSTATTUNGSKLASSEN_LIVE)
    assert mw == {"einfach": 162000, "gehoben": 172000, "luxus": 191000}


def test_parse_eur_per_qm_by_ausstattung_empty() -> None:
    eq = parse_eur_per_qm_by_ausstattung("nichts hier")
    assert eq == {"einfach": None, "gehoben": None, "luxus": None}


def test_parse_eur_per_qm_by_ausstattung_only_einfach() -> None:
    text = "Einfach\n183.000 EUR\n2.288 EUR/m²"
    eq = parse_eur_per_qm_by_ausstattung(text)
    assert eq["einfach"] == 2288
    assert eq["gehoben"] is None
    assert eq["luxus"] is None


# ---------------------------------------------------------------------------
# parse_marktwert_by_ausstattung
# ---------------------------------------------------------------------------


def test_parse_marktwert_by_ausstattung_full() -> None:
    mw = parse_marktwert_by_ausstattung(SAMPLE_AUSSTATTUNGSKLASSEN)
    assert mw == {"einfach": 183000, "gehoben": 194000, "luxus": 215000}


def test_parse_marktwert_by_ausstattung_empty() -> None:
    mw = parse_marktwert_by_ausstattung("kein text")
    assert mw == {"einfach": None, "gehoben": None, "luxus": None}


# ---------------------------------------------------------------------------
# parse_trend_2j_pct (aus Wertentwicklung-Tab nach Zeitraum=2 Jahre)
# ---------------------------------------------------------------------------

SAMPLE_WERTENTWICKLUNG_2J_PLUS = """
Zeitraum
2 Jahre
Marktwert 2024
155.000 EUR
Aktueller Marktwert
183.000 EUR
Wertentwicklung
28.000 EUR
+ 18 %
"""

SAMPLE_WERTENTWICKLUNG_2J_NEGATIV = """
Zeitraum
2 Jahre
Marktwert 2024
200.000 EUR
Aktueller Marktwert
180.000 EUR
Wertentwicklung
-20.000 EUR
- 10 %
"""

SAMPLE_WERTENTWICKLUNG_2J_STAGNIEREND = """
Zeitraum
2 Jahre
Wertentwicklung
500 EUR
+ 0,5 %
"""


def test_parse_trend_2j_pct_positiv() -> None:
    assert parse_trend_2j_pct(SAMPLE_WERTENTWICKLUNG_2J_PLUS) == 18.0


def test_parse_trend_2j_pct_negativ() -> None:
    assert parse_trend_2j_pct(SAMPLE_WERTENTWICKLUNG_2J_NEGATIV) == -10.0


def test_parse_trend_2j_pct_stagnierend_with_comma() -> None:
    # 0,5 % → 0.5
    assert parse_trend_2j_pct(SAMPLE_WERTENTWICKLUNG_2J_STAGNIEREND) == 0.5


def test_parse_trend_2j_pct_missing_returns_none() -> None:
    assert parse_trend_2j_pct("nichts hier") is None


# ---------------------------------------------------------------------------
# trend_ampel_interhyp (analog homeday-Logik)
# ---------------------------------------------------------------------------


def test_trend_ampel_gruen_above_one_percent() -> None:
    ampel, label = trend_ampel_interhyp(18.0)
    assert ampel == "gruen"
    assert "steigend" in label.lower()
    assert "+18.0" in label


def test_trend_ampel_rot_below_minus_one_percent() -> None:
    ampel, label = trend_ampel_interhyp(-10.0)
    assert ampel == "rot"
    assert "fallend" in label.lower()
    assert "-10.0" in label


def test_trend_ampel_gelb_stagnierend() -> None:
    ampel, label = trend_ampel_interhyp(0.5)
    assert ampel == "gelb"
    assert "stagnierend" in label.lower()


def test_trend_ampel_gelb_at_threshold_plus_one() -> None:
    # Genau +1% gilt als stagnierend (|x| <= 1)
    ampel, _ = trend_ampel_interhyp(1.0)
    assert ampel == "gelb"


def test_trend_ampel_grau_when_none() -> None:
    ampel, label = trend_ampel_interhyp(None)
    assert ampel == "grau"
    assert "keine Daten" in label


# ---------------------------------------------------------------------------
# parse_svg_path_points (Highcharts <path d="M x y L x y L ..." />)
# ---------------------------------------------------------------------------


def test_parse_svg_path_points_simple_M_L() -> None:
    """Pfad 'M 10 20 L 30 40 L 50 60' -> 3 Punkte."""
    pts = parse_svg_path_points("M 10 20 L 30 40 L 50 60")
    assert pts == [(10.0, 20.0), (30.0, 40.0), (50.0, 60.0)]


def test_parse_svg_path_points_real_highcharts_sample() -> None:
    """Live-Sample aus Interhyp's highcharts-graph-Path (Anfang)."""
    d = (
        "M 0 1.485 L 2.275 1.92 L 4.477 2.358 L 6.752 2.797 L 9.027 3.238"
    )
    pts = parse_svg_path_points(d)
    assert len(pts) == 5
    assert pts[0] == (0.0, 1.485)
    assert pts[-1][0] == 9.027


def test_parse_svg_path_points_empty_or_invalid() -> None:
    assert parse_svg_path_points("") == []
    assert parse_svg_path_points("M") == []
    # Ungerade Zahl-Counts -> ungueltig
    assert parse_svg_path_points("M 1 2 L 3") == []


# ---------------------------------------------------------------------------
# classify_trend_richtung (Klassifizierung aus Punkt-Liste)
# ---------------------------------------------------------------------------


def test_classify_trend_steigt() -> None:
    # Y faellt von 250 auf 70 ueber 10 Punkte (SVG-invertiert = Preis steigt stark)
    points = [(i, 250.0 - i * 20) for i in range(10)]
    assert classify_trend_richtung(points) == "steigt"


def test_classify_trend_faellt() -> None:
    # Y steigt von 50 auf 230 (SVG-invertiert = Preis faellt stark)
    points = [(i, 50.0 + i * 20) for i in range(10)]
    assert classify_trend_richtung(points) == "faellt"


def test_classify_trend_stagniert_flatline() -> None:
    # Komplett flach: y_range=0 -> stagniert
    points = [(float(i), 150.0) for i in range(10)]
    assert classify_trend_richtung(points) == "stagniert"


def test_classify_trend_stagniert_below_min_threshold() -> None:
    # y_range = 1.0 < min_pixel_threshold (2.0) -> stagniert
    points = [(i, 150.0 + (i % 2) * 1.0) for i in range(10)]
    assert classify_trend_richtung(points) == "stagniert"


def test_classify_trend_too_few_points_returns_none() -> None:
    assert classify_trend_richtung([(0.0, 1.0), (1.0, 2.0)]) is None
    assert classify_trend_richtung([]) is None


def test_classify_trend_uses_only_last_fraction() -> None:
    """Frueher Anstieg darf den Klassifizierer der letzten 20% nicht stoeren."""
    # Erste 80% steigen stark (Y faellt), letzte 20% fallen (Y steigt) -> faellt
    early = [(i, 250.0 - i * 20) for i in range(8)]  # Y: 250 -> 110
    late = [(8 + i, 100.0 + i * 50) for i in range(3)]  # Y: 100, 150, 200
    points = early + late
    assert classify_trend_richtung(points) == "faellt"


# ---------------------------------------------------------------------------
# trend_ampel_from_richtung (Mapping richtung -> ampel/label)
# ---------------------------------------------------------------------------


def test_trend_ampel_from_richtung_steigt_gruen() -> None:
    ampel, label = trend_ampel_from_richtung("steigt")
    assert ampel == "gruen"
    assert label == "steigt"


def test_trend_ampel_from_richtung_stagniert_gelb() -> None:
    ampel, label = trend_ampel_from_richtung("stagniert")
    assert ampel == "gelb"
    assert label == "stagniert"


def test_trend_ampel_from_richtung_faellt_rot() -> None:
    ampel, label = trend_ampel_from_richtung("faellt")
    assert ampel == "rot"
    assert label == "faellt"


def test_trend_ampel_from_richtung_none_grau() -> None:
    ampel, label = trend_ampel_from_richtung(None)
    assert ampel == "grau"
    assert "keine Daten" in label
