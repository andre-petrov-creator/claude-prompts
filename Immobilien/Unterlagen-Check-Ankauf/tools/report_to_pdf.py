#!/usr/bin/env python3
"""
report_to_pdf.py — Wandelt Markdown-Report in PDF um, mit Ampel-Layout
und klickbaren Quellenverweisen.

Nutzung:
  python report_to_pdf.py "<pfad/zum/report.md>" [--out "<pfad/zum/output.pdf>"]

Output:
  - <name>.pdf   Einziger Output. Quellen-Links als PDF-GoToR-Actions
                 mit relativen Pfaden (Edge-/Adobe-/Foxit-kompatibel,
                 #page=X bleibt erhalten).

Warum GoToR statt file:// URI-Action?
  Chromium-PDF-Viewer (Edge, Chrome) blockieren file://-URI-Actions als
  Sicherheitssandbox seit 2021. GoToR ist der PDF-Standard fuer Cross-
  Document-Refs (ISO 32000-1, §12.6.4.5) und wird vom Chromium-Viewer
  als legitime Doc-Navigation behandelt (bestaetigt funktional in Edge).
  Relative Pfade verhindern zusaetzlich, dass die Sandbox triggert.

Voraussetzungen:
  - pip install --user markdown pikepdf
  - Microsoft Edge (auf Windows immer vorhanden)

Sicherheits-Begrenzung:
  - Lesend: Markdown-Datei
  - Schreibend: PDF (HTML nur temporaer waehrend Edge-Druck)
  - Edge-Subprocess nur fuer PDF-Druck
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
from pathlib import Path

try:
    import markdown as md_lib
except ImportError:
    print("FEHLER: markdown nicht installiert. Einmalig: pip install --user markdown", file=sys.stderr)
    sys.exit(1)

try:
    import pikepdf
except ImportError:
    print("FEHLER: pikepdf nicht installiert. Einmalig: pip install --user pikepdf", file=sys.stderr)
    sys.exit(1)


# CSS fuer Ampel-Layout, kompakt, nicht aufgeblaeht
CSS = """
@page {
  size: A4;
  margin: 1.6cm 1.4cm 1.4cm 1.4cm;
}
body {
  font-family: -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.4;
  color: #1a1a1a;
  margin: 0;
}
h1 {
  font-size: 16pt;
  border-bottom: 2px solid #333;
  padding-bottom: 6px;
  margin: 0 0 12px 0;
}
h2 {
  font-size: 12pt;
  margin: 18px 0 6px 0;
  padding: 4px 8px;
  background: #f0f0f0;
  border-left: 4px solid #555;
}
h2.rot    { background: #fde2e2; border-left-color: #c62828; color: #8b0000; }
h2.gelb   { background: #fff4d6; border-left-color: #f9a825; color: #6b4500; }
h2.gruen  { background: #e1f5e2; border-left-color: #2e7d32; color: #1b4d1f; }

h3 {
  font-size: 11pt;
  margin: 12px 0 4px 0;
}
p, li { margin: 3px 0; }
ul, ol { padding-left: 22px; margin: 4px 0; }
table {
  border-collapse: collapse;
  width: 100%;
  font-size: 9pt;
  margin: 6px 0;
}
th, td {
  border: 1px solid #bbb;
  padding: 4px 6px;
  text-align: left;
  vertical-align: top;
}
th { background: #eaeaea; font-weight: 600; }

.todo-rot, .todo-gelb, .todo-gruen {
  padding: 8px 10px;
  margin: 6px 0;
  border-left: 4px solid;
  border-radius: 2px;
}
.todo-rot   { background: #fde2e2; border-color: #c62828; }
.todo-gelb  { background: #fff4d6; border-color: #f9a825; }
.todo-gruen { background: #e1f5e2; border-color: #2e7d32; }

.quelle {
  font-size: 8.5pt;
  color: #555;
}
a {
  color: #1565c0;
  text-decoration: none;
}
a:hover { text-decoration: underline; }
.page-break { page-break-before: always; }

code {
  font-family: "Consolas", "Menlo", monospace;
  font-size: 9pt;
  background: #f5f5f5;
  padding: 1px 3px;
  border-radius: 2px;
}

.meta {
  font-size: 9pt;
  color: #666;
  margin-bottom: 14px;
}
"""


def find_edge() -> str:
    """Findet Microsoft Edge auf Windows oder macOS."""
    # Pfad in PATH?
    for cmd in ["msedge", "microsoft-edge", "msedge.exe"]:
        path = shutil.which(cmd)
        if path:
            return path

    # Windows-Standardpfade
    candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        # macOS
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ]
    for c in candidates:
        if Path(c).exists():
            return c

    raise FileNotFoundError(
        "Microsoft Edge nicht gefunden. "
        "Bitte Edge installieren oder Pfad manuell setzen."
    )


def md_to_html(md_text: str, title: str) -> str:
    """Konvertiert Markdown zu HTML mit Tables-Extension."""
    html_body = md_lib.markdown(
        md_text,
        extensions=["tables", "fenced_code", "attr_list", "md_in_html"]
    )

    return f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>{title}</title>
<style>{CSS}</style>
</head>
<body>
{html_body}
</body>
</html>
"""


def html_to_pdf_via_edge(html_path: Path, pdf_path: Path) -> None:
    """Druckt HTML zu PDF via Microsoft Edge headless."""
    edge = find_edge()
    # file:// URI fuer lokale Datei
    file_uri = html_path.resolve().as_uri()

    cmd = [
        edge,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path.resolve()}",
        file_uri,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        print(f"Edge stderr: {result.stderr}", file=sys.stderr)
        raise RuntimeError(f"Edge headless fehlgeschlagen, returncode={result.returncode}")


# ---------------------------------------------------------------------------
# PDF-Postprocessing: file:// URI-Action -> GoToR-Action mit relativem Pfad
# ---------------------------------------------------------------------------

_FILE_URI_RE = re.compile(r"^file:/{2,3}", re.IGNORECASE)


def _parse_file_uri(uri: str) -> tuple[Path, int | None]:
    """file:///C:/path/foo.pdf#page=7 -> (Path("C:/path/foo.pdf"), 7).

    Liefert (None, None) wenn kein file://-URI.
    """
    if not _FILE_URI_RE.match(uri):
        return None, None

    # Fragment vor URL-Decoding extrahieren
    if "#" in uri:
        url_part, fragment = uri.split("#", 1)
    else:
        url_part, fragment = uri, ""

    # file:/// -> Pfad
    raw_path = _FILE_URI_RE.sub("", url_part)
    decoded = urllib.parse.unquote(raw_path)
    # Auf Windows: "C:/foo" -> Path("C:/foo"); fuehrender / vor Drive entfernen
    if re.match(r"^/[A-Za-z]:[/\\]", decoded):
        decoded = decoded.lstrip("/")
    target = Path(decoded)

    page = None
    if fragment:
        m = re.search(r"page=(\d+)", fragment)
        if m:
            page = int(m.group(1))

    return target, page


def _make_relative(target: Path, base_dir: Path) -> str:
    """Liefert relativen POSIX-Pfad target relativ zu base_dir.

    Faellt auf absoluten POSIX-Pfad zurueck, wenn target ausserhalb base_dir.
    """
    try:
        rel = os.path.relpath(target, base_dir)
    except ValueError:
        # Unterschiedliche Drives auf Windows -> absoluter Pfad
        rel = str(target)
    # PDF-Spec: Forward-Slashes empfohlen
    return rel.replace("\\", "/")


def convert_file_uris_to_gotor(pdf_path: Path) -> int:
    """Ersetzt file://-URI-Annotationen durch GoToR-Actions mit relativen Pfaden.

    GoToR = "Go-To Remote", PDF-Standard fuer Cross-Document-Refs.
    Edge/Adobe/Foxit handhaben das als legitime Navigation; die Chromium-
    Sandbox, die file://-URIs blockiert, greift hier nicht.

    Returns: Anzahl konvertierter Annotations.
    """
    base_dir = pdf_path.parent.resolve()
    converted = 0

    with pikepdf.open(pdf_path, allow_overwriting_input=True) as pdf:
        for page in pdf.pages:
            if "/Annots" not in page:
                continue
            annots = page["/Annots"]
            for annot in annots:
                if annot.get("/Subtype") != pikepdf.Name("/Link"):
                    continue
                action = annot.get("/A")
                if action is None:
                    continue
                if action.get("/S") != pikepdf.Name("/URI"):
                    continue
                uri_obj = action.get("/URI")
                if uri_obj is None:
                    continue
                uri_str = str(uri_obj)

                target, page_num = _parse_file_uri(uri_str)
                if target is None:
                    continue  # nicht-file:// (z.B. https://) unangetastet lassen
                if not target.exists():
                    print(
                        f"  WARNUNG: Link-Ziel existiert nicht: {target}",
                        file=sys.stderr,
                    )

                rel_path = _make_relative(target, base_dir)

                # Destination: PDF-Page-Index ist 0-basiert in /D-Array,
                # /Fit zoomt die ganze Seite ein.
                dest_page = (page_num - 1) if page_num else 0

                new_action = pikepdf.Dictionary(
                    Type=pikepdf.Name("/Action"),
                    S=pikepdf.Name("/GoToR"),
                    F=pikepdf.String(rel_path),
                    NewWindow=True,
                    D=pikepdf.Array(
                        [dest_page, pikepdf.Name("/Fit")]
                    ),
                )
                annot["/A"] = new_action
                converted += 1

        pdf.save(pdf_path)
    return converted




def main():
    parser = argparse.ArgumentParser(
        description="Konvertiert Markdown-Report in PDF mit Ampel-Layout."
    )
    parser.add_argument("input", help="Pfad zum Markdown-Report")
    parser.add_argument("--out", help="Pfad zum Output-PDF (optional)")
    args = parser.parse_args()

    md_path = Path(args.input).resolve()
    if not md_path.exists():
        print(f"FEHLER: Datei nicht gefunden: {md_path}", file=sys.stderr)
        sys.exit(1)

    if args.out:
        pdf_path = Path(args.out).resolve()
    else:
        pdf_path = md_path.with_suffix(".pdf")

    md_text = md_path.read_text(encoding="utf-8")
    html = md_to_html(md_text, md_path.stem)

    # Temporaere HTML-Datei im gleichen Ordner wie der Report,
    # damit relative file:// Links zu Originaldokumenten aufloesen.
    # Wird nach Edge-Druck geloescht — einziger Output ist das PDF.
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".html", delete=False,
        dir=md_path.parent, encoding="utf-8"
    ) as tmp:
        tmp.write(html)
        html_path = Path(tmp.name)

    try:
        html_to_pdf_via_edge(html_path, pdf_path)
        print(f"PDF erstellt: {pdf_path}")
        print(f"Groesse: {pdf_path.stat().st_size / 1024:.1f} KB")
    finally:
        try:
            html_path.unlink()
        except OSError:
            pass

    # Post-Processing: file://-Links durch GoToR-Actions ersetzen,
    # weil Chromium-PDF-Viewer (Edge) file://-URI-Actions blockiert.
    n = convert_file_uris_to_gotor(pdf_path)
    print(f"GoToR-Links konvertiert: {n}")


if __name__ == "__main__":
    main()
