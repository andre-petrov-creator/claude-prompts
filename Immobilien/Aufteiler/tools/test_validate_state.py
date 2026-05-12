"""Tests für validate_state.py — Schema-Validator.

Lauf: pytest tools/test_validate_state.py -v
Voraussetzung: pip install jsonschema pytest
"""
import json
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = REPO_ROOT / "tools" / "validate_state.py"


def _run(state_obj, tmp_path) -> tuple[int, str]:
    """Validator auf state-Dict laufen lassen, (returncode, stderr) zurück."""
    state_file = tmp_path / "state.json"
    state_file.write_text(json.dumps(state_obj), encoding="utf-8")
    proc = subprocess.run(
        [sys.executable, str(VALIDATOR), str(state_file)],
        capture_output=True, text=True
    )
    return proc.returncode, proc.stderr


def _minimal_valid_state() -> dict:
    return {
        "schema_version": "1.0",
        "objekt": {
            "slug": "teststr-1-essen",
            "adresse": "Teststr. 1, 45000 Essen",
            "stadt": "Essen",
            "bundesland": "NRW",
            "erstellt_am": "2026-05-12",
            "letzter_modul_lauf": "modul_0",
        },
    }


def test_minimal_state_is_valid(tmp_path):
    rc, _ = _run(_minimal_valid_state(), tmp_path)
    assert rc == 0


def test_missing_schema_version_fails(tmp_path):
    state = _minimal_valid_state()
    del state["schema_version"]
    rc, err = _run(state, tmp_path)
    assert rc != 0
    assert "schema_version" in err


def test_invalid_slug_fails(tmp_path):
    state = _minimal_valid_state()
    state["objekt"]["slug"] = "Teststr 1"  # Leerzeichen, Großbuchstabe
    rc, err = _run(state, tmp_path)
    assert rc != 0
    assert "slug" in err


def test_modul_2_rnd_frozen_must_be_true(tmp_path):
    state = _minimal_valid_state()
    state["modul_2"] = {
        "status": "gruen",
        "tiefenstufe": 2,
        "konfidenz": "mittel",
        "baujahr": 1968,
        "rnd_jahre": 45,
        "rnd_frozen": False,  # Verstoß
        "rnd_basis": "ImmoWertV Anlage 2",
        "mod_score": 60,
        "afa_korridor_prozent": {"min": 2.0, "max": 3.5},
        "afa_empfehlung_prozent": 2.5,
        "begruendung": "Test",
    }
    rc, err = _run(state, tmp_path)
    assert rc != 0
    assert "rnd_frozen" in err


def test_modul_3_subvention_in_massnahme_rejected(tmp_path):
    """Asset-Trennung: 'subvention' in massnahmen_liste-Eintrag muss als rot zurückgewiesen werden."""
    state = _minimal_valid_state()
    state["modul_3"] = {
        "status": "gruen",
        "tiefenstufe": 2,
        "konfidenz": "mittel",
        "ist_kernsanierung": False,
        "massnahmen_liste": [
            {"kategorie": "Sonstiges", "ist_zustand": "leer", "geplant": "Mietsubvention 2 Jahre",
             "kosten_netto_eur": 10000}
        ],
        "rnd_gutachten_netto_eur": 6000,
        "weg_teilung_netto_eur": 3000,
        "enev_klasse": "E",
        "summen": {
            "modernisierung_netto_eur": 100000,
            "modernisierung_brutto_eur": 119000,
            "nebenkosten_netto_eur": 9000,
            "nebenkosten_brutto_eur": 10710,
        },
    }
    rc, err = _run(state, tmp_path)
    assert rc != 0
    assert "asset-trennung" in err.lower() or "subvention" in err.lower()
