# Schritt 6: PDF-Export

> Master: [`../SKILL.md`](../SKILL.md), Sektion `### Schritt 6: PDF-Export`

## Zweck

Markdown-Gesamtreport (Schritt 5) in ein präsentationsfertiges PDF konvertieren. Layout-Regeln R1–R13 (Schriftgrößen, Margins, Seitenumbrüche, Risk-Score-Farben). **Läuft nie automatisch** — nur auf explizite User-Anfrage.

## Files

- `SKILL.md` — Trigger-Bedingung + Layout-Regel-Verweis
- [`../tools/report_to_pdf.py`](../tools/report_to_pdf.py) — Export-Implementierung

## Datenfluss

```
Markdown-Report aus Schritt 5
  → User-Bestätigung "PDF erzeugen" (zwingend)
  → tools/report_to_pdf.py <report.md>
  → Layout-Regeln R1–R13 anwenden
  → Output: <report>.pdf im selben Folder
```

## Schnittstellen

- **Input:** Markdown-Report-Pfad (aus Schritt 5)
- **Output:** PDF-Datei
- **Trigger:** ausschließlich User-Wunsch ("erstelle PDF", "exportiere als PDF")

## Bekannte Limitierungen

- TODO
