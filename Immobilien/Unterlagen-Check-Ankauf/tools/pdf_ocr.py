#!/usr/bin/env python3
"""
pdf_ocr.py — OCRt ein Scan-PDF zu durchsuchbarem PDF mit Text-Layer.

Nutzt ocrmypdf (Python-Paket, intern tesseract).

Nutzung:
  python pdf_ocr.py "<scan.pdf>" [--lang deu+eng] [--force]

Output:
  Geschwister-Datei _ocr_<originalname>.pdf neben dem Scan.
  Bei vorhandenem _ocr_*.pdf wird übersprungen (außer --force).

Verhalten bei fehlenden Tools:
  - ocrmypdf-Modul fehlt → klare Install-Anweisung, Exit-Code 10
  - tesseract-Binary fehlt → klare Install-Anweisung, Exit-Code 11
  - Sprachpaket "deu" fehlt → Hinweis, Exit-Code 12
  - OCR-Fehler (z.B. Datei korrupt) → Stderr, Exit-Code 13

Wichtig: Bei jedem Fehler bleibt das Original unverändert.
Der Skill-Workflow läuft trotzdem weiter — der betroffene Subagent meldet "nicht_pruefbar".
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


INSTALL_HINT = """
Installation auf Windows:
  1. Python-Paket:
       pip install --user ocrmypdf
  2. Tesseract-Binary:
       https://github.com/UB-Mannheim/tesseract/wiki
       (Installer ausführen, "Additional language data" → "German" mit anhaken)
  3. Falls tesseract nach Install nicht im PATH:
       PATH ergänzen um z.B. "C:\\Program Files\\Tesseract-OCR\\"
       oder einmalig in Bash: export PATH="$PATH:/c/Program Files/Tesseract-OCR"
""".strip()


def check_tools() -> tuple[bool, int, str]:
    """Returns (ok, exit_code_if_fail, error_msg)."""
    try:
        import ocrmypdf  # noqa: F401
    except ImportError:
        return (False, 10, f"ocrmypdf-Python-Paket fehlt.\n{INSTALL_HINT}")

    if not shutil.which("tesseract"):
        return (False, 11, f"tesseract-Binary nicht im PATH.\n{INSTALL_HINT}")

    try:
        out = subprocess.run(
            ["tesseract", "--list-langs"],
            capture_output=True,
            timeout=10,
            text=True,
        )
        langs = out.stdout.lower()
        if "deu" not in langs:
            return (
                False,
                12,
                f"tesseract-Sprachpaket 'deu' fehlt. Verfügbar:\n{out.stdout}\n{INSTALL_HINT}",
            )
    except Exception as e:
        return (False, 12, f"tesseract --list-langs schlug fehl: {e}\n{INSTALL_HINT}")

    return (True, 0, "")


def ocr_pdf(input_path: Path, output_path: Path, lang: str, force: bool) -> int:
    import ocrmypdf

    if output_path.exists() and not force:
        print(f"OK   _ocr_-Datei existiert bereits: {output_path.name} (verwende --force zum Erzwingen)")
        return 0

    print(f"OCR  {input_path.name}  →  {output_path.name}  (lang={lang})")
    try:
        ocrmypdf.ocr(
            input_file=str(input_path),
            output_file=str(output_path),
            language=lang,
            skip_text=True,            # PDFs mit Text-Layer einfach durchreichen
            deskew=True,               # leicht schiefe Scans gerade ziehen
            optimize=1,                # leichte Größen-Optimierung
            progress_bar=False,
            # tesseract_thresholding="adaptive-otsu",  # default reicht meistens
        )
    except ocrmypdf.exceptions.PriorOcrFoundError:
        print("OK   Datei hat bereits Text-Layer, OCR übersprungen.")
        # Kopie als _ocr_-Geschwister anlegen, damit Skill-Pipeline einheitlich bleibt
        shutil.copy2(input_path, output_path)
        return 0
    except Exception as e:
        # Ausnahme nicht eskalieren lassen, Original bleibt unverändert
        print(f"FEHLER beim OCR: {type(e).__name__}: {e}", file=sys.stderr)
        if output_path.exists():
            try:
                output_path.unlink()
            except OSError:
                pass
        return 13

    if not output_path.exists():
        print("FEHLER: ocrmypdf lief durch, aber Output fehlt.", file=sys.stderr)
        return 13

    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"OK   {output_path.name}  ({size_mb:.1f} MB)")
    return 0


def main():
    parser = argparse.ArgumentParser(description="OCRt Scan-PDF zu durchsuchbarem PDF.")
    parser.add_argument("input", help="Pfad zum Scan-PDF")
    parser.add_argument("--lang", default="deu+eng", help="Tesseract-Sprachen (Default: deu+eng)")
    parser.add_argument("--force", action="store_true", help="Bestehende _ocr_*.pdf überschreiben")
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    if not input_path.exists():
        print(f"FEHLER: Datei nicht gefunden: {input_path}", file=sys.stderr)
        sys.exit(1)

    ok, code, msg = check_tools()
    if not ok:
        print(msg, file=sys.stderr)
        sys.exit(code)

    output_path = input_path.parent / f"_ocr_{input_path.name}"
    sys.exit(ocr_pdf(input_path, output_path, args.lang, args.force))


if __name__ == "__main__":
    main()
