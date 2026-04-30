#!/usr/bin/env python3
"""
pdf_split.py — Splittet große PDFs seitenweise in Chunks <= max_mb.

Nutzung:
  python pdf_split.py "<pfad/zur/datei.pdf>" [--max-mb 25]

Output:
  Geschwister-Ordner _split_<dateiname>/ neben der Original-PDF.
  Enthält part_001.pdf, part_002.pdf, ... und _manifest.json mit Seitenmapping.

Sicherheits-Begrenzung:
  - Nur lokales File-IO
  - Kein Netzwerk, kein subprocess, kein eval/exec
  - Lesend auf Quelle, schreibend nur in Geschwister-Ordner
"""

import argparse
import json
import sys
from pathlib import Path

try:
    from pypdf import PdfReader, PdfWriter
except ImportError:
    print("FEHLER: pypdf nicht installiert. Einmalig: pip install --user pypdf", file=sys.stderr)
    sys.exit(1)


def estimate_chunk_size(reader: PdfReader, start: int, end: int) -> int:
    """Schreibt Seiten start..end-1 in einen In-Memory-Stream und misst Bytes."""
    import io
    writer = PdfWriter()
    for i in range(start, end):
        writer.add_page(reader.pages[i])
    buf = io.BytesIO()
    writer.write(buf)
    return buf.tell()


def split_pdf(input_path: Path, max_mb: int = 25) -> list[Path]:
    if not input_path.exists():
        raise FileNotFoundError(f"Datei nicht gefunden: {input_path}")

    output_dir = input_path.parent / f"_split_{input_path.stem}"
    output_dir.mkdir(exist_ok=True)

    max_bytes = max_mb * 1024 * 1024
    reader = PdfReader(str(input_path))
    total_pages = len(reader.pages)

    chunks: list[tuple[int, int]] = []  # (start, end) je Chunk
    start = 0

    while start < total_pages:
        # Inkrementell mehr Seiten dazunehmen, bis Limit überschritten
        end = start + 1
        last_ok_end = end

        while end <= total_pages:
            size = estimate_chunk_size(reader, start, end)
            if size <= max_bytes:
                last_ok_end = end
                end += 1
            else:
                # Ein Schritt zu weit, zurück zum letzten OK
                break

        if last_ok_end == start:
            # Eine einzelne Seite ist schon zu groß. Trotzdem rausschreiben.
            last_ok_end = start + 1
            print(f"WARNUNG: Seite {start + 1} alleine groesser als {max_mb} MB", file=sys.stderr)

        chunks.append((start, last_ok_end))
        start = last_ok_end

    # Chunks rausschreiben
    output_files: list[Path] = []
    manifest = {
        "source_file": input_path.name,
        "source_path": str(input_path.resolve()),
        "total_pages": total_pages,
        "max_mb": max_mb,
        "chunks": []
    }

    for idx, (s, e) in enumerate(chunks, start=1):
        writer = PdfWriter()
        for i in range(s, e):
            writer.add_page(reader.pages[i])
        out_file = output_dir / f"part_{idx:03d}.pdf"
        with open(out_file, "wb") as f:
            writer.write(f)

        size_mb = out_file.stat().st_size / (1024 * 1024)
        manifest["chunks"].append({
            "file": out_file.name,
            "start_page": s + 1,
            "end_page": e,
            "page_count": e - s,
            "size_mb": round(size_mb, 2)
        })
        output_files.append(out_file)
        print(f"  {out_file.name}  Seiten {s+1}-{e}  {size_mb:.1f} MB")

    # Manifest schreiben
    manifest_file = output_dir / "_manifest.json"
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    return output_files


def main():
    parser = argparse.ArgumentParser(description="Splittet PDF in Chunks <= max_mb.")
    parser.add_argument("input", help="Pfad zur Original-PDF")
    parser.add_argument("--max-mb", type=int, default=25, help="Max Groesse pro Chunk in MB (Default: 25)")
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    print(f"Splitte: {input_path}")
    print(f"Limit:   {args.max_mb} MB pro Chunk")
    print()

    files = split_pdf(input_path, args.max_mb)

    print()
    print(f"Fertig. {len(files)} Chunks in: {input_path.parent / f'_split_{input_path.stem}'}")
    print(f"Manifest: _manifest.json")


if __name__ == "__main__":
    main()
