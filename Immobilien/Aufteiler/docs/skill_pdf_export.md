# Skill PDF-Export — `skill_pdf_export.md`

============================================================

## Zweck

Pflicht-Skill für jeden Aufteiler-PDF-Export (Modul 5). Spezifiziert verbindliche Layout-Regeln R1–R13 (Word-Wrap, KeepTogether, Spaltenbreiten, Farbpalette, kein Emoji, Hyperlinks, Schriften, Margins, Padding, Zebra, Zahlen-Alignment, VALIGN) und liefert reportlab-Code-Bausteine zum Kopieren. Ohne diesen Skill kein PDF — Modul 5 lädt ihn vor jedem Build per `web_fetch`.

============================================================

## Files

- **Hauptdatei:** `skill_pdf_export.md`
- **Wird konsumiert von:** `modul_5_verdict.xml` (PFLICHT vor jedem PDF-Build)
- **Generiert keine eigenen Files** — der Skill ist reine Anleitung + Code-Vorlagen

============================================================

## Datenfluss

```
modul_5_verdict.xml ──web_fetch──► skill_pdf_export.md
                                    ├─► R1–R13 Pflicht-Regeln
                                    ├─► Code-Bausteine (Tabelle, Verdict-Badge, KeepTogether, Footer)
                                    ├─► Farbpalette (NAVY/INK/ACCENT/GREEN/YELLOW/ORANGE/RED/GRAY)
                                    └─► Self-Check Tabelle vor doc.build()
```

Skill ist ein Lese-Asset — keine Inputs/Outputs im klassischen Sinn. Wird zur Build-Zeit von Modul 5 konsumiert und in reportlab-Code übersetzt.

============================================================

## Schnittstellen

| Schnittstelle | Typ | Adresse / Detail |
|---------------|-----|------------------|
| Code-Baustein 2.2 `make_todo_table` | reportlab-Pattern | Standard-Tabellen-Builder mit ORANGE-Header (v1.1) |
| Code-Baustein 2.3 `verdict_badge` | reportlab-Pattern | GO/GRENZ/STOP-Box mit Status-BG |
| Code-Baustein 2.4 `section_block` | reportlab-Pattern | KeepTogether-Wrapper für Sektion + Tabelle + Legende |
| Code-Baustein 2.5 `add_footer` | reportlab-Pattern | Seitenzahl rechts unten + Adresse links unten |
| Farbpalette R4 | reportlab-Constants | `NAVY` (ungenutzt seit v1.1), `INK` (Headlines), `ACCENT`, `GREEN/YELLOW/ORANGE/RED` (Status), `GRAY` (Zebra/Small) |
| Tabellen-Header-Style v1.1 | TableStyle-Regel | `BACKGROUND=ORANGE` (`#f97316`), `TEXTCOLOR=white`, `FONTNAME=Helvetica-Bold` |
| PDF-title-Metadatum (v1.1) | `SimpleDocTemplate(title=...)` | `f"Analyse zur Aufteiler-Kalkulation {adresse}"` |
| Self-Check Tabelle | Vor `doc.build()` | 13 Regeln durchgehen, sonst PDF nicht ausliefern → neu bauen |

============================================================

## Bekannte Limitierungen

- **Reportlab + matplotlib müssen installiert sein** — STOPP wenn nicht (Modul 5 prüft).
- **Helvetica/DejaVu Sans haben keine Emoji-Glyphs** — R5 verbietet Emojis. Status mit farbigen Cell-BGs + Klartext statt `🔴/🟢/🟡/✅/⚠️/🔥`.
- **Modul-spezifischen Inhalt regelt der Skill NICHT** — er regelt nur Form. Sektions-Reihenfolge ist im Modul (`<pdf_struktur>`-Block).
- **Bei extrem langem Text** (>200 Zeichen pro Cell) kann Word-Wrap zu zu vielen Zeilen führen → manuelle Kürzung nötig. R3 (Spaltenbreiten-Summe) und R10 (Padding) helfen, aber kein Auto-Truncate.
- **Schriftgrößen sind hartkodiert in R7** — bei Format-Anpassungen Skill-Bump nötig, kein per-Modul-Override.

============================================================

## Versions-Historie

| Version | Datum | Änderung (Stichwort) | Plan-Ref |
|---------|-------|----------------------|----------|
| v1.1 | 2026-05-07 | Tabellen-Header NAVY → ORANGE (`#f97316`); R4-Anwendungsregel ergänzt; Code-Baustein 2.2 aktualisiert; PDF-title-Metadatum auf "Analyse zur Aufteiler-Kalkulation" | `plans/2026-05-07-modul5-pdf-export-anpassung.md` |
| v1.0 | 2026-04-27 | Initial — abgeleitet aus Layout-Problemen Prosperstr. 59 (Spalten-Overflow, Emoji-Glyphs, mittige Tabellen-Splits) | — |
