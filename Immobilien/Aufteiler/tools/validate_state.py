"""Aufteiler state.json Validator.

Lauf: python tools/validate_state.py <pfad-zu-state.json>
Returncode 0 = valid, 1 = invalid (Fehler auf stderr).

Zusätzliche Business-Checks über JSON-Schema hinaus:
- Asset-Trennung in modul_3.massnahmen_liste (keine 'subvention' / 'rücklage' / 'ruecklage' in Text-Feldern).
"""
import json
import sys
from pathlib import Path

import jsonschema

REPO_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = REPO_ROOT / "docs" / "state.schema.json"

FORBIDDEN_IN_MASSNAHME = ("subvention", "rücklage", "ruecklage")


def _asset_trennung_check(state: dict) -> list[str]:
    errors: list[str] = []
    massnahmen = (state.get("modul_3") or {}).get("massnahmen_liste") or []
    for idx, m in enumerate(massnahmen):
        for field in ("kategorie", "ist_zustand", "geplant"):
            text = str(m.get(field, "")).lower()
            for token in FORBIDDEN_IN_MASSNAHME:
                if token in text:
                    errors.append(
                        f"Asset-Trennung verletzt: modul_3.massnahmen_liste[{idx}].{field} "
                        f"enthält '{token}' — gehört nicht in Reno-Block."
                    )
    return errors


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("Usage: validate_state.py <state.json>", file=sys.stderr)
        return 2

    state_path = Path(argv[1])
    if not state_path.is_file():
        print(f"State-Datei nicht gefunden: {state_path}", file=sys.stderr)
        return 2

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    state = json.loads(state_path.read_text(encoding="utf-8"))

    validator = jsonschema.Draft202012Validator(schema)
    schema_errors = sorted(validator.iter_errors(state), key=lambda e: list(e.absolute_path))
    business_errors = _asset_trennung_check(state)

    if not schema_errors and not business_errors:
        return 0

    for err in schema_errors:
        path = "/".join(str(p) for p in err.absolute_path) or "<root>"
        print(f"[SCHEMA] {path}: {err.message}", file=sys.stderr)
    for msg in business_errors:
        print(f"[BUSINESS] {msg}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
