#!/usr/bin/env python3
"""
pdf_render.py — Rendert PDF-Seiten zu PNG-Bildern für Multimodal-Lesung.

Zweck (Skill v4 Architektur "Lese/Audit-Trennung"):
- Hauptagent (Claude) liest die PNGs multimodal und schreibt strukturierten Text.
- Subagents bekommen den Text, NICHT die PDF — keine Sandbox-Lottery mehr.

Vorteile gegenüber pdftoppm:
- Reines Python via PyMuPDF, kein Binary in PATH nötig.
- Funktioniert für reine Scan-PDFs identisch wie für Text-PDFs.
- Kein Tesseract / kein OCR-Install nötig — Hauptagent IST der OCR.

Nutzung:
  python pdf_render.py "<datei.pdf>" [--dpi 160] [--max-pages 50]
  python pdf_render.py "<ordner>" --filter scan,scan+split [--dpi 160]

Output:
  Geschwister-Ordner _render_<originalname>/ mit Dateien page_001.png, page_002.png, ...
  Plus _render_<originalname>/_manifest.json mit Mapping page → Originalseite.

Sicherheit:
- Nur Render, kein Schreibzugriff auf Original-PDFs.
- Bestehender _render_-Ordner wird ohne --force NICHT überschrieben.
"""

import argparse
import json
import shutil
import sys
from pathlib import Path


def check_pymupdf():
    try:
        import fitz  # noqa: F401
        return True
    except ImportError:
        print(
            "FEHLER: PyMuPDF nicht installiert.\n"
            "Installation: pip install --user pymupdf",
            file=sys.stderr,
        )
        return False


def render_pdf(pdf_path: Path, dpi: int = 160, max_pages: int | None = None,
               force: bool = False) -> dict:
    """Rendert ein PDF zu PNGs in _render_<name>/.

    Returns: dict mit Status + Manifest-Daten.
    """
    import fitz

    out_dir = pdf_path.parent / f"_render_{pdf_path.stem}"
    if out_dir.exists() and not force:
        existing = sorted(out_dir.glob("page_*.png"))
        if existing:
            print(f"OK   {pdf_path.name}: bereits gerendert ({len(existing)} Seiten in {out_dir.name})")
            return {"file": str(pdf_path), "status": "existed", "pages": len(existing), "dir": str(out_dir)}

    out_dir.mkdir(exist_ok=True)

    try:
        doc = fitz.open(str(pdf_path))
    except Exception as e:
        return {"file": str(pdf_path), "status": "error", "error": f"open failed: {e}"}

    n = doc.page_count
    pages_to_render = n if max_pages is None else min(n, max_pages)

    manifest = {
        "source_pdf": str(pdf_path),
        "source_name": pdf_path.name,
        "total_pages": n,
        "rendered_pages": pages_to_render,
        "dpi": dpi,
        "pages": [],
    }

    for i in range(pages_to_render):
        try:
            pix = doc[i].get_pixmap(dpi=dpi)
            out_file = out_dir / f"page_{i+1:03d}.png"
            pix.save(str(out_file))
            manifest["pages"].append({
                "page_number": i + 1,
                "file": out_file.name,
                "size_kb": out_file.stat().st_size // 1024,
            })
        except Exception as e:
            manifest["pages"].append({
                "page_number": i + 1,
                "file": None,
                "error": str(e),
            })

    doc.close()

    # Manifest schreiben
    (out_dir / "_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"OK   {pdf_path.name}: {pages_to_render}/{n} Seiten gerendert nach {out_dir.name}")
    return {"file": str(pdf_path), "status": "rendered", "pages": pages_to_render, "dir": str(out_dir)}


def collect_pdfs(target: Path, classify_filter: list[str] | None) -> list[Path]:
    """PDFs sammeln. Mit Filter: nur PDFs der angegebenen pdf_classify-Klassen.

    Filter-Werte: text, scan, split, scan+split.
    Wenn Filter gesetzt: pdf_classify wird zur Klassifikation aufgerufen.
    """
    if target.is_file() and target.suffix.lower() == ".pdf":
        return [target]
    if not target.is_dir():
        return []

    all_pdfs = []
    for p in target.rglob("*.pdf"):
        # _render_, _split_, _ocr_-Ordner/Files überspringen (sind abgeleitet)
        if any(part.startswith(("_render_", "_split_")) for part in p.parts):
            continue
        if p.name.startswith(("_ocr_",)):
            continue
        all_pdfs.append(p)

    if not classify_filter:
        return sorted(all_pdfs)

    # Filter via pdf_classify anwenden (Import zur Laufzeit, damit das
    # Skript ohne pdf_classify auch standalone läuft)
    try:
        sys.path.insert(0, str(Path(__file__).parent))
        from pdf_classify import classify_pdf  # type: ignore
    except ImportError:
        print("WARNUNG: pdf_classify.py nicht gefunden — Filter ignoriert.", file=sys.stderr)
        return sorted(all_pdfs)

    filtered = []
    for p in sorted(all_pdfs):
        rec = classify_pdf(p, max_mb=25)
        if rec["klass"] in classify_filter:
            filtered.append(p)
    return filtered


def main():
    parser = argparse.ArgumentParser(description="Rendert PDF-Seiten zu PNGs für Multimodal-Lesung.")
    parser.add_argument("path", help="Pfad zu PDF oder Ordner")
    parser.add_argument("--dpi", type=int, default=160, help="Render-DPI (Default 160, höher = größer + besser)")
    parser.add_argument("--max-pages", type=int, default=None, help="Max. Seiten pro PDF (Default: alle)")
    parser.add_argument("--force", action="store_true", help="Bestehenden _render_-Ordner überschreiben")
    parser.add_argument("--filter", default=None,
                        help="Komma-Liste der pdf_classify-Klassen, die gerendert werden sollen "
                             "(z.B. 'scan,scan+split'). Default: alle PDFs.")
    args = parser.parse_args()

    if not check_pymupdf():
        sys.exit(10)

    target = Path(args.path).resolve()
    if not target.exists():
        print(f"FEHLER: Pfad nicht gefunden: {target}", file=sys.stderr)
        sys.exit(1)

    classify_filter = None
    if args.filter:
        classify_filter = [c.strip() for c in args.filter.split(",")]

    pdfs = collect_pdfs(target, classify_filter)
    if not pdfs:
        print(f"Keine PDFs gefunden unter: {target}", file=sys.stderr)
        sys.exit(2)

    print(f"Render-Plan: {len(pdfs)} PDF(s), DPI={args.dpi}, max-pages={args.max_pages or 'alle'}")
    print()

    summary = []
    for p in pdfs:
        result = render_pdf(p, dpi=args.dpi, max_pages=args.max_pages, force=args.force)
        summary.append(result)

    print()
    rendered = sum(1 for r in summary if r["status"] == "rendered")
    existed = sum(1 for r in summary if r["status"] == "existed")
    errors = sum(1 for r in summary if r["status"] == "error")
    print(f"Zusammenfassung: {rendered} neu, {existed} bestehend, {errors} Fehler")

    if errors:
        for r in summary:
            if r["status"] == "error":
                print(f"  ERROR {r['file']}: {r.get('error')}", file=sys.stderr)
        sys.exit(13)


if __name__ == "__main__":
    main()
