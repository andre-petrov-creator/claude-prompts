# Modul 5 — Verdict-Export — `modul_5_verdict.xml`

============================================================

## Zweck

Modul 5 baut das Aufteiler-Verdict-PDF aus den Outputs der Module 0–4 plus der befüllten Excel-Datei und spiegelt Notizen in Excel-Comments. Lädt verbindlich `skill_pdf_export.md` für Layout-Regeln (R1–R13) und ist **NIE automatisch Teil der Vollanalyse-Sequenz** — nur on-demand auf User-Anfrage oder explizite Bestätigung am Sequenz-Ende.

============================================================

## Files

- **Hauptdatei:** `modul_5_verdict.xml`
- **Pflicht-Skill:** `skill_pdf_export.md` (Layout-Regeln R1–R13, reportlab-Code-Bausteine)
- **Excel-Sheets (read + Comments schreiben):** `BESICHTIGUNG`, `KALKU`, `RENO`, `MIETER`, `VK_CF`, `VERKAUFSMATRIX`
- **PDF-Output:** `Aufteiler_<Stadt>_<Strasse>_<YYYY-MM-DD>.pdf` (im Objektordner)
- **Notion-Quellen:** keine direkten — Modul 5 konsumiert nur Outputs der Vor-Module

============================================================

## Datenfluss

```
Module 0–4 Chat-Outputs ─┐
befüllte Excel ──────────┤
mietspiegelrechner_lookup ┼─► Modul 5 ─► PDF (11 Sektionen + 11 Charts)
(intern aus M5)          │           └─► Excel-Comments (6 Zellen, Spiegelung)
Modul 1 v1.1 Sachwert-   │
Inputs (BGF/NHK/Idx/Fakt)┘
```

**Inputs:**
- Modul-0–4-Outputs aus Chat-Kontext (Stammdaten, BRW, Mietspiegel, Modernisierung, RND/AfA, Mietsubvention pro WE inkl. Stufen, Risiken)
- `Kalkulation_Aufteiler_<...>.xlsx` befüllt — Markt-VK, Cashflow-VK, Renditen
- `mietspiegelrechner_lookup` (in `modul_5_verdict.xml` v1.2) — Stadt → URL für Pflicht-Aufgabe Mietspiegel-Verifikation
- v1.2: BGF, NHK_2010, BKI-Index 2026, Sachwertfaktor aus Modul 1 v1.1 für Sektion 3 (Sachwertverfahren)
- v1.3: Bewirtschaftungs-Schätzung (Quote, Aufschlüsselungs-Posten, Σ Fixkosten, Freier Cashflow für Rücklage), Rücklagen-Entwicklung (Bestand-Start, Aufbau/Jahr, Pro-Jahr-Pfad bis GEG-Stichtag), Profil-Bausteine (4–5 Bullet-Quotes + Verdict-Schluss-Satz) für Sektion 8.5

**Verarbeitung:**
- 11 Sektionen aufbauen (Cover bis Anhang Quellen) gemäß `<pdf_struktur>`-Block
- 11 Charts via matplotlib (Hebel-Kaskade, Donuts, Step-Charts, Heatmap, Sensitivität)
- Layout-Regeln R1–R13 aus `skill_pdf_export.md` anwenden (PFLICHT vor `doc.build()`)
- Risiko-Tabelle mit min. 10 Pflicht-Risiko-Kategorien
- Verdict-Block (GO/GRENZWERTIG/STOP) + Pflicht-Schritte vor Notar (mit ALWAYS-Pflicht-Items für BORIS + Mietspiegel)

**Outputs:**
- PDF-Datei (Standard-Naming-Schema)
- Excel-Comments in 6 Zellen (`BESICHTIGUNG!A40`, `BESICHTIGUNG!A41`, `KALKU!H...`, `RENO!K105`, `MIETER!U6`, `VK_CF!C9`)
- Pflicht-Schritte-Checkliste (Chat-Output)

============================================================

## Schnittstellen

| Schnittstelle | Typ | Adresse / Detail |
|---------------|-----|------------------|
| `skill_pdf_export.md` | Skill-Call (web_fetch) | `https://raw.githubusercontent.com/andre-petrov-creator/meine-projekte/main/Immobilien/Aufteiler/skill_pdf_export.md` |
| Cover-Headline (v1.2) | PDF-Inhalt | `"Analyse zur Aufteiler-Kalkulation [STRASSE]"` (statt v1.1 `"AUFTEILER-VERDICT"`) |
| PDF-title-Metadatum (v1.2) | `SimpleDocTemplate(title=...)` | gleicher Wortlaut wie Headline |
| Pflicht-Aufgabe Bodenrichtwert (v1.2) | PDF-Sektion 10.2 | ALWAYS-Pflicht-Zeile, `BORIS.NRW` als Quelle |
| Pflicht-Aufgabe Mietspiegel (v1.2) | PDF-Sektion 10.2 | URL aus `mietspiegelrechner_lookup[OBJEKT_GEMEINDE].mietspiegelrechner`; bei Lücke: Hinweis-Cell aus `fallback_logik` |
| Sektion 3 Gebäudewert (v1.2) | PDF-Inhalt | Sachwertverfahren 4 Blöcke; Inputs aus Modul 1 v1.1 |
| Sektion 8.2 Aggregat-Treppe (v1.2) | Chart 08b | Summe monatlicher Stufenmieten Mt 0–maxReach |
| Sektion 8.3 Pro-WE-Stufentabellen (v1.2) | PDF-Inhalt | je WE eine Tabelle Format A (Stufe / Monat-Range / Stufenmiete / Subv./Mt / Dauer / Σ Phase + Σ-berechnet-Zeile) |
| Sektion 8.5 Bewirtschaftungs-Einschätzung (v1.3) | PDF-Inhalt | drei Sub-Blocks: 8.5.1 Verdict-Statement + Aufschlüsselungs-Tabelle (Position/EUR/Jahr) mit Σ Fixkosten + Freier Cashflow; 8.5.2 Rücklagen-Pfad-Tabelle (Jahr/Bestand/Aufbau/Gesamt) bis GEG-Stichtag + Heizungstausch-Bewertung; 8.5.3 Profil-Bullets für Anzeige + Verdict-Schluss-Satz |
| Excel-Comment `BESICHTIGUNG!A40` | Excel-Write | 5-Zeilen-Verdict + Verhandlungsziel + Pflicht-Schritte |
| Excel-Comment `RENO!K105` | Excel-Write | Mietsubvention Berechnungs-Verweis |
| Excel-Comment `VK_CF!C9` | Excel-Write | AfA-Festlegung BFH-Argument |

============================================================

## Bekannte Limitierungen

- **Modul 5 ist NIE in der Vollanalyse-Sequenz.** Wenn User vergisst zu fragen, kein PDF. Orchestrator fragt am Sequenz-Ende explizit.
- **PDF-Dateiname-Schema** `Aufteiler_<Stadt>_<Strasse>_<YYYY-MM-DD>.pdf` bleibt aus Backwards-Kompatibilität (Excel-Comments, Notion-Backlinks). Headline + title-Metadatum sind ab v1.2 entkoppelt — Datei heißt anders als die Cover-Headline.
- **Mietspiegelrechner-Lookup** initial nur Bochum + Essen befüllt. Andere Städte zeigen Hinweis-Cell mit Aufruf zur URL-Recherche; kein PDF-Crash.
- **Sachwertverfahren-Inputs** (BGF, NHK_2010, BKI-Index, Sachwertfaktor) müssen aus Modul 1 v1.1 kommen. Bei fehlenden Inputs: Fallback auf vereinfachte Methode (KP − Bodenwert) mit FA-Akzeptanz-Hinweis. Sachwertverfahren ist FA-konform, vereinfacht nicht.
- **Excel überschreibt KEINE Werte** — nur Comments und freie Notiz-Zellen. Alle Berechnungen passieren in Excel-Formeln, Modul 5 spiegelt nur.
- **Bei Lock auf PDF-Datei** (User hat sie gerade offen): Suffix `_preview.pdf` statt direktem Überschreiben.
- **R5 verbietet Emojis** im PDF — Status mit farbigen Cell-BGs + Klartext (`PFLICHT`, `OK`, `WARNUNG`, `STOP`) statt `🔴/🟢/🟡`.

============================================================

## Versions-Historie

| Version | Datum | Änderung (Stichwort) | Plan-Ref |
|---------|-------|----------------------|----------|
| v1.3 | 2026-05-07 | Sektion 8.5 Bewirtschaftungs-Einschätzung mit drei Sub-Blocks (Aufschlüsselung + Rücklagen-Pfad + Profil für Anzeige) | `plans/2026-05-07-modul5-bewirtschaftungs-einschaetzung.md` |
| v1.2 | 2026-05-07 | Mietspiegelrechner-Lookup, To-do-Pflicht-Items, Subv-Stufentabellen pro WE + Aggregat-Treppe, Sachwertverfahren in Sektion 3, Cover-Headline neu, Skill-PFLICHT auf v1.1 | `plans/2026-05-07-modul5-pdf-export-anpassung.md` |
| v1.1 | 2026-04-27 | Skill-PFLICHT-Verweis (R1–R13), Spaltenbreiten-Regel, Word-Wrap, KeepTogether, User-Reihenfolge erlaubt | — |
| v1.0 | 2026-04-26 | Initial | — |
