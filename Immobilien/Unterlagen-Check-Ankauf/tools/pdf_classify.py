#!/usr/bin/env python3
"""
pdf_classify.py — Pre-Flight-Klassifizierung aller PDFs in einem Ordner.

Pro PDF wird ermittelt:
  - Größe (MB)
  - Hat Text-Layer? (pdftotext-Probe, >100 Bytes)
  - Klassifikation: "text" / "scan" / "split" / "scan+split"

Output:
  - Stdout: JSON-Array mit Records pro Datei
  - Optional: Markdown-Tabelle (--markdown) für direkte Skill-Verwendung

Nutzung:
  python pdf_classify.py "<ordner>" [--max-mb 25] [--markdown]
  python pdf_classify.py "<datei.pdf>" [--max-mb 25] [--markdown]

Sicherheit:
  - Lesend auf PDFs, kein Schreibzugriff
  - Subprocess nur auf pdftotext (lokales Tool)
"""

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path


def has_text_layer(pdf_path: Path, min_bytes: int = 100) -> tuple[bool, str]:
    """Prüft via pdftotext, ob das PDF einen verwertbaren Text-Layer hat.

    Returns: (has_text, error_message_if_any)
    """
    pdftotext = shutil.which("pdftotext")
    if not pdftotext:
        return (False, "pdftotext nicht installiert")

    try:
        result = subprocess.run(
            [pdftotext, "-layout", "-l", "3", str(pdf_path), "-"],
            capture_output=True,
            timeout=30,
        )
        if result.returncode != 0:
            return (False, f"pdftotext rc={result.returncode}: {result.stderr.decode('utf-8', errors='replace')[:200]}")
        text_bytes = len(result.stdout.strip())
        return (text_bytes >= min_bytes, "")
    except subprocess.TimeoutExpired:
        return (False, "pdftotext timeout")
    except Exception as e:
        return (False, f"pdftotext exception: {e}")


def classify_pdf(pdf_path: Path, max_mb: int) -> dict:
    size_bytes = pdf_path.stat().st_size
    size_mb = size_bytes / (1024 * 1024)
    is_split = size_mb > max_mb

    text_ok, err = has_text_layer(pdf_path)

    if text_ok and not is_split:
        klass = "text"
        marker = "OK Text"
    elif text_ok and is_split:
        klass = "split"
        marker = "Split"
    elif not text_ok and not is_split:
        klass = "scan"
        marker = "OCR"
    else:
        klass = "scan+split"
        marker = "Split+OCR"

    return {
        "file": str(pdf_path),
        "name": pdf_path.name,
        "size_mb": round(size_mb, 2),
        "has_text": text_ok,
        "text_probe_error": err,
        "needs_split": is_split,
        "klass": klass,
        "marker": marker,
    }


def collect_pdfs(target: Path) -> list[Path]:
    if target.is_file() and target.suffix.lower() == ".pdf":
        return [target]
    if target.is_dir():
        # Rekursiv, aber _split_*-Ordner und _ocr_*-Files überspringen (sind abgeleitet)
        results = []
        for p in target.rglob("*.pdf"):
            if any(part.startswith("_split_") for part in p.parts):
                continue
            if p.name.startswith("_ocr_"):
                continue
            results.append(p)
        return sorted(results)
    return []


def render_markdown(records: list[dict]) -> str:
    """Inventur-Tabelle wie im SKILL.md, ergänzt um Lesbar-Spalte."""
    rows = ["| Nr | Datei | Größe | Lesbar | Maßnahme |", "|---|---|---|---|---|"]
    for idx, r in enumerate(records, start=1):
        if r["klass"] == "text":
            lesbar = "OK Text"
            massnahme = "direkt prüfen"
        elif r["klass"] == "split":
            lesbar = "OK Text"
            massnahme = "Split nötig"
        elif r["klass"] == "scan":
            lesbar = "OCR nötig"
            massnahme = "OCR vor Subagent"
        else:
            lesbar = "OCR nötig"
            massnahme = "Split + OCR"
        rows.append(
            f"| {idx:02d} | `{r['name']}` | {r['size_mb']} MB | {lesbar} | {massnahme} |"
        )
    return "\n".join(rows)


def main():
    parser = argparse.ArgumentParser(description="Pre-Flight-Klassifizierung von PDFs (Text vs Scan, Split-Bedarf).")
    parser.add_argument("path", help="Pfad zu Ordner oder einzelner PDF")
    parser.add_argument("--max-mb", type=int, default=25, help="Split-Schwelle in MB (Default 25)")
    parser.add_argument("--markdown", action="store_true", help="Markdown-Tabelle statt JSON ausgeben")
    args = parser.parse_args()

    target = Path(args.path).resolve()
    if not target.exists():
        print(f"FEHLER: Pfad existiert nicht: {target}", file=sys.stderr)
        sys.exit(1)

    if not shutil.which("pdftotext"):
        print(
            "WARNUNG: pdftotext nicht im PATH. Klassifikation markiert ALLE PDFs als Scan.\n"
            "Installation Windows: poppler-utils via MSYS2 (`pacman -S mingw-w64-x86_64-poppler`)\n"
            "oder via choco/scoop.",
            file=sys.stderr,
        )

    pdfs = collect_pdfs(target)
    if not pdfs:
        print(f"Keine PDFs gefunden unter: {target}", file=sys.stderr)
        sys.exit(2)

    records = [classify_pdf(p, args.max_mb) for p in pdfs]

    if args.markdown:
        print(render_markdown(records))
    else:
        print(json.dumps(records, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
