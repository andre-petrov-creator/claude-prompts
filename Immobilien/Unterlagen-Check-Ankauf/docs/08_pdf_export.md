# Schritt 6: PDF-Export

> Master: [`../SKILL.md`](../SKILL.md), Sektion `### Schritt 6: PDF-Export`

## Zweck

Markdown-Gesamtreport (Schritt 5) in ein präsentationsfertiges PDF konvertieren. Ampel-Layout, klickbare Quellenverweise via GoToR-Actions, **saubere Seitenumbrüche** ohne mitten-im-Block-Trennung. **Läuft nie automatisch** — nur auf explizite User-Anfrage.

## Files

- `SKILL.md` Schritt 6 — Trigger-Bedingung + Umbruch-Regel-Verweis
- [`../tools/report_to_pdf.py`](../tools/report_to_pdf.py) — Export-Implementierung mit erweitertem CSS

## Datenfluss

```
Markdown-Report aus Schritt 5
  → User-Bestätigung "PDF erzeugen" (zwingend)
  → tools/report_to_pdf.py <report.md>
    → Markdown → HTML (Extensions: tables, fenced_code, attr_list, md_in_html)
    → CSS mit Umbruch-Regeln (page-break-inside avoid, orphans/widows ≥2)
    → Edge headless --print-to-pdf
    → Post-Processing: file://-URI-Actions → GoToR-Actions (relative Pfade)
  → Output: <report>.pdf im selben Folder
```

## Umbruch-Regeln (im CSS)

- **Tabellen** (`table`): `page-break-inside: avoid` — bricht nur, wenn die Tabelle größer als eine Seite ist; dann an `tr`-Grenzen mit `thead` als sich wiederholender Kopf
- **To-Do-Buckets** (`.todo-rot/.todo-gelb/.todo-gruen`): `page-break-inside: avoid`
- **Listen-Items** (`li`): `page-break-inside: avoid` (verhindert halbe Listenpunkte)
- **Header** (`h1/h2/h3`): `page-break-after: avoid` (Header bleibt mit Folgeinhalt zusammen)
- **Absätze** (`p`, `li`): `orphans: 2; widows: 2` (keine alleinstehende Zeile am Seitenanfang/-ende)
- **Verbot**: halber Block am Seitenende + Rest auf Folgeseite

## Schnittstellen

- **Input**: Markdown-Report-Pfad (aus Schritt 5)
- **Output**: PDF-Datei
- **Trigger**: ausschließlich User-Wunsch ("erstelle PDF", "exportiere als PDF")

## Bekannte Limitierungen

- Edge-Abhängigkeit (Skript meldet, wenn Edge nicht gefunden — Fallback: Browser-Druck-zu-PDF)
- `page-break-inside: avoid` bei Tabellen, die ALLEINE größer als eine Seite sind, kann Layout-Engines zwingen, eine leere Vorderseite einzulegen — bei sehr langen Tabellen ggf. Tabelle splitten
- GoToR-Konvertierung scannt nur `file://`-URIs; andere URIs (https:) bleiben unverändert
- Keine Layout-Logik in der SKILL.md — alles im Tool/CSS (siehe DEVELOPMENT_GUIDELINES.md "Don'ts")
