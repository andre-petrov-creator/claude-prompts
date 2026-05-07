# Überarbeitungs-Plan: Modul 5 + Skill PDF-Export — Layout & Inhalt 2026-05

============================================================

## Meta

| Feld | Wert |
|------|------|
| **Plan-Datum** | 2026-05-07 |
| **Komponente** | `modul_5_verdict.xml` + `skill_pdf_export.md` (+ ggf. `modul_1_objektbasis.xml` für neue Inputs) |
| **Aktuelle Version** | Modul 5 v1.1 / Skill PDF v1.0 |
| **Ziel-Version** | Modul 5 v1.2 / Skill PDF v1.1 (Minor — additive Änderungen, keine Excel-Migration) |
| **Ausgelöst durch** | User-Review nach Vollanalyse Prosperstr. 59 (`Aufteiler_Essen_Prosperstr59_2026-04-28.pdf`) — 5 konkrete Anpassungswünsche |
| **Status** | OFFEN |

============================================================

## 1. Ausgangslage

PDF zur Prosperstr. 59 zeigt 5 Optimierungspunkte:

1. **To-do-Liste** vor Notar hat keine festen Pflicht-Items für Bodenrichtwert- und Mietspiegel-Verifikation. Mietspiegelrechner-Link fehlt strukturell — er taucht nur situativ auf.
2. **Mietsubvention** wird nur als Aggregat-Tabelle (Sektion 6) + Treppen-Chart **NUR für WE 01** dargestellt. Pro Wohnung ist die Subv-Summe eine Black-Box-Zahl ohne Stufenpfad.
3. **Gebäudewert** in Sektion 3 nutzt vereinfachte Methode (`Bodenrichtwert × m² → Bodenwert; KP − Bodenwert = Gebäudewert`). Im PDF: Bodenwert 124.470 €, Gebäudewert 424.530 € (77,3 %). Kein Sachwertverfahren, keine konsistente Verbindung zum RND-Modell aus Modul 3.
4. **Tabellen-Header** sind in Navy `#1f2937`. User-Feedback: "übersichtlicher in Orange".
5. **PDF-Bezeichnung** "AUFTEILER-VERDICT" (Headline) ist nicht selbsterklärend; User-Vorschlag "Analyse zur Aufteiler-Kalkulation [STRASSE]".

User-Zitat (Bohrphase): *"Erst sammeln, am Ende bohren."* — alle 5 Punkte sind in dieser Iteration zu adressieren.

============================================================

## 2. Ziel

Das PDF wird **nachvollziehbarer** (Stufenpfade pro WE statt Black-Box-Subv), **lesbarer** (Orange-Header) und **steuerlich tragfähiger** (Sachwertverfahren statt Vereinfachung) — bei sonst unverändertem Inhalt.

============================================================

## 3. Scope

### IN-Scope (wird in diesem Plan angefasst)

- `skill_pdf_export.md` R4 Farbpalette + Tabellen-Header-Style → `#f97316`
- `modul_5_verdict.xml` PDF-Struktur Sektion 1 (Aufgaben), 3 (Gebäudewert), 6 (Mietsubvention), Cover-Headline + PDF-title-Metadatum
- `modul_5_verdict.xml` neuer Block `<mietspiegelrechner_lookup>` (Stadt → URL)
- `modul_1_objektbasis.xml` (vermutlich): neue Inputs BGF + NHK-2010-Tabellenwert
- Doku-Pflege: `docs/modul_5_verdict.md` (neu), `docs/skill_pdf_export.md` (neu), `docs/README.md`-Index

### OUT-of-Scope (bewusst nicht)

- Andere PDF-Sektionen (2, 4, 5, 7, 8, 9, 10, 11) — bleiben unangetastet, kein Layout-Sweep
- Excel-Template (`Kalkulation_Aufteiler_mit_VK_CF.xlsx`) — keine Zell-Migration nötig
- Andere Module (0, 2, 3, 4) — abgesehen von ggf. Datenexport für Sachwertverfahren keine inhaltliche Änderung
- Charts in anderen Sektionen (Hebel-Kaskade, Mietspiegel-Validation, Risk-Heatmap, Marge-Sensitivität) — Farbschema dort bleibt

============================================================

## 4. Architektur-Entscheidungen

| Entscheidung | Alternativen | Gewählt weil |
|---|---|---|
| Header-Farbe `#f97316` (ORANGE aus Palette R4) | Eigener Hex `#ea580c`, `#c2410c` | Bereits in R4 definiert, konsistent mit ORANGE_BG für Status-Cells, kein neues Token |
| Mini-Rechnung Mietsubvention: **Format A** (Stufentabelle pro WE mit Subv-Spalte) | Format B (kompakt, Diff zu SOLL) / Format C (Fließtext-Pfeilkette) | User-Wahl nach Mockup-Vergleich (`_mockup_subv.pdf`) — maximale Cent-Nachvollziehbarkeit, Σ-berechnet als Self-Check |
| Aggregat-Treppe: Summe der monatlichen Stufenmieten aller 5 WE über Mt 0–183 | Pro-WE-Layer-Chart / Anzahl-WE-Reach pro Zeitpunkt | Direkter Lesbezug zur Aggregat-Σ-Subv 125.576 €; matcht das vorhandene Treppen-Idiom (war WE 01) |
| Gebäudewert: **ImmoWertV-Sachwertverfahren** | BMF-Arbeitshilfe / Vereinfacht (Status quo) | User-Wahl — konsistent mit RND-Modell aus Modul 3 (gleiche ImmoWertV-2021-Datenquelle), FA-anerkannt, BFH-IX-R-7/23-tragfähig |
| Mietspiegelrechner-Mapping als XML-Block in `modul_5_verdict.xml` | Hardcoded im Skill / externe Lookup-Datei | Inhalt = Modul, Form = Skill (DEVELOPMENT_GUIDELINES §1) — Mapping ist domänenspezifischer Inhalt; im Skill wäre es Vermischung |
| PDF-Titel "Analyse zur Aufteiler-Kalkulation [STRASSE]" | "Aufteiler-Verdict" beibehalten / "Zusatz: ..." vorangestellt | Klarste Selbstbeschreibung; "Zusatz:" entfällt als Headline (passt nicht für eigenständige Datei), bleibt für Excel-Comment-Verweise |

============================================================

## 5. Schritte

### Schritt 1: Skill PDF — Tabellen-Header-Farbe Orange

- **Datei:** `skill_pdf_export.md`
- **Änderung:**
  - R4 Farbpalette unverändert (ORANGE = `#f97316` ist schon da). Neue **R4-Anwendungsregel**: "Tabellen-Header-Cell BACKGROUND = ORANGE, TEXTCOLOR = white. Navy bleibt für H1/H2-Body-Text."
  - Code-Baustein 2.2 (`make_todo_table`): `("BACKGROUND", (0,0), (-1,0), ORANGE)` statt NAVY. Analog für alle anderen Tabellen, die das Skript baut.
  - Self-Check Tabelle Abschnitt 5: R4-Zeile ergänzen "Tabellen-Header BG = `#f97316`".
  - Header-Comment: Versionshistorie v1.0 → v1.1 mit Änderungsblock.
- **Akzeptanzkriterium:** PDF-Build mit der neuen Skill-Version zeigt orangefarbene Tabellen-Header über alle Sektionen; H1/H2-Sektions-Titel bleiben dunkelblau.

### Schritt 2: Modul 5 — To-do-Liste Pflicht-Items + Mietspiegelrechner-Mapping

- **Datei:** `modul_5_verdict.xml`
- **Änderung:**
  - Neuer Block `<mietspiegelrechner_lookup>` mit initialer Befüllung:
    - Bochum: `https://www.bochum.de/C125830C0042AB74/vwContentByKey/W2DFQALM601BOCMDE/$File/MSR_2025.html` (+ Übersicht: `https://www.bochum.de/amt-fuer-stadtplanung-und-wohnen/Dienstleistungen-und-Infos/Mietspiegel`)
    - Essen: `https://formulare.essen.de/metaform/Form-Solutions/?2&releaseUserId=05113000-0001-0005&releaseID=5f9be026e4b01507f808d2eb&...&assistant=KFAS_68-Mietspiegelrechner&...`
    - Schema: `<stadt name="..." mietspiegelrechner="URL" mietspiegel_uebersicht="URL"/>`. Erweiterbar.
  - Step 4 (`verdict_aufbereiten`): Pflicht-Schritt-Liste erweitern → **Bodenrichtwert verifizieren via BORIS.NRW** und **Mietspiegel verifizieren via [Lookup-URL]** sind ALWAYS-Pflicht (auch wenn intern als "geprüft" markiert).
  - Step 5 (`pdf_generieren`) Sektion 1 (`Aufgaben & To-Do's`): Aufgabe "Mietspiegel verifizieren" zieht Mietspiegelrechner-URL automatisch aus Lookup. Falls `OBJEKT_GEMEINDE` nicht im Mapping: Hinweis-Cell `Mietspiegelrechner-URL für [Stadt] recherchieren — keine fixe URL hinterlegt` (statt stilles Weglassen).
- **Akzeptanzkriterium:** PDF Prosperstr. 59 zeigt klickbaren Essen-Mietspiegelrechner-Link. Synth-Test Bochum zeigt Bochum-Link. Synth-Test Düsseldorf zeigt Hinweis-Cell.

### Schritt 3: Modul 5 — Mietsubvention pro WE (Format A) + Aggregat-Treppe

- **Datei:** `modul_5_verdict.xml`
- **Änderung:**
  - PDF-Struktur Sektion 8 neu strukturiert:
    - 8.1 Annahmen (3 Mt Karenz, 36 Mt-Stufen, k=15 % NRW, Cap je WE = `Y × m²`) — bleibt
    - **8.2 NEU: Aggregat-Treppe** über alle 5 WE — Linie = Summe der monatlichen Stufenmieten Mt 0–maxReach; Hilfslinie = SOLL-Total (4.024,55 €/Mt für Prosperstr.); rosa Fläche = Σ-Subv (125.576 €). Stufen springen wenn EINE WE eine Stufe nimmt.
    - **8.3 NEU: Pro WE Stufentabelle Format A** — 6 Spalten (Stufe / Monat-Range / Stufenmiete €/Mt / Subv./Mt / Dauer / Σ Phase €) plus Σ-berechnet-Zeile. Berechnungs-Logik: 3 Mt Karenz, dann Stufen je 36 Mt mit `Stufe_n+1 = Stufe_n × 1,15 (Cap auf SOLL)`. Subv./Mt = `SOLL − Stufenmiete`. Σ Phase = `Subv./Mt × Dauer`.
    - 8.4 (alt 8.3): Aggregat-Tabelle + Donut + Reach-Time-Bar — bleibt
  - Mini-Treppen-Chart pro WE (war Sektion 6 nur WE 01) → **entfernt**, durch 8.3 vollständig ersetzt.
  - Berechnungs-Logik aus `_mockup_subv.py::compute_phases` als Referenz-Implementierung im Modul-Comment hinterlegen (oder in `modul_4_miete.xml` falls dort schon vorhanden — prüfen vor Implementierung).
- **Akzeptanzkriterium:** PDF Prosperstr. 59 zeigt 5 Stufentabellen (eine pro WE) plus eine Aggregat-Treppe. Σ-berechnet pro WE liegt innerhalb ±0,5 % der Aggregat-Tabelle (Rundungstoleranz). Aggregat-Treppe endet bei SOLL-Total = 4.024,55 €/Mt.

### Schritt 4: Modul 5 — Gebäudewert nach ImmoWertV-Sachwertverfahren

- **Datei:** `modul_5_verdict.xml` (PDF-Sektion 3) + `modul_1_objektbasis.xml` (neue Inputs)
- **Änderung:**
  - `modul_1_objektbasis.xml` — INPUT-PFLICHT-Liste ergänzt um:
    - `BGF` (Brutto-Grundfläche, m² — meist `Wohnfläche × 1,30…1,40` oder Architektenwert)
    - `NHK_2010` (Normalherstellungskosten je m² BGF, Anlage 4 ImmoWertV — abhängig von Gebäudetyp + Standardstufe; für MFH Bj. 1977 Standard normal: ca. 700–900 €/m² BGF, Index 2010 → 2026 anwenden)
    - `Marktanpassungsfaktor` (Sachwertfaktor lt. GMB Essen 2025 oder Default 1,0)
  - `modul_5_verdict.xml` PDF-Sektion 3 "Bodenrichtwert & Gebäudeanteil" → ersetzen durch **"Gebäudewert nach ImmoWertV-Sachwertverfahren"**:
    - Block 1 — **Bodenwert:** `Bodenrichtwert × Grundstücksfläche` (z.B. 270 × 461 = 124.470 €)
    - Block 2 — **Gebäudesachwert (vorläufig):** `NHK_2010_indexiert × BGF × (1 − Alterswertminderung) × Modernisierungsfaktor`. Alterswertminderung = `(GA / GND) × (1 − Modernisierungspunkte/20)` — Werte aus Modul 3 ziehen (RND/AfA bereits berechnet). Modernisierungsfaktor aus Modernisierungspunkte 6/20.
    - Block 3 — **Vorläufiger Sachwert:** `Bodenwert + Gebäudesachwert`. Marktanpassung: × Sachwertfaktor → marktangepasster Sachwert.
    - Block 4 — **Boden-Gebäude-Verteilung des Kaufpreises:** `Gebäude-KP-Anteil = KP × Gebäudesachwert / (Bodenwert + Gebäudesachwert)`. Plausi-Check 50–90 % (wie bisher).
  - **Wenn BGF oder NHK_2010 fehlen:** STOPP mit User-Hinweis "ImmoWertV-Sachwertverfahren benötigt BGF + NHK-2010. Inputs in Modul 1 ergänzen — siehe `docs/modul_1_objektbasis.md`."
- **Akzeptanzkriterium:** Test mit synth. BGF = 600 m² + NHK_2010 = 800 €/m² für Prosperstr. liefert vollständige 4-Block-Sachwert-Herleitung. Gebäudeanteil ergibt sich aus Sachwert-Verhältnis (nicht aus `KP − Bodenwert`).

### Schritt 5: Modul 5 — PDF-Titel/Headline

- **Datei:** `modul_5_verdict.xml`
- **Änderung:**
  - Cover-Sektion Headline: `"AUFTEILER-VERDICT"` → `"Analyse zur Aufteiler-Kalkulation [STRASSE]"` (Variable `OBJEKT_STRASSE` einsetzen, z.B. "Prosperstraße 59").
  - PDF-Metadaten `title=` (`SimpleDocTemplate` Argument): gleicher Wortlaut.
  - Dateiname-Schema unverändert: `Aufteiler_<Stadt>_<Strasse>_<YYYY-MM-DD>.pdf` (Backward-Compat zu Excel-Verweisen + Notion-Backlinks).
  - Excel-Comment-Spiegelung (Step 6 `excel_notizen_spiegeln`): Verweis-Text auf "Analyse zur Aufteiler-Kalkulation [STRASSE]" updaten.
- **Akzeptanzkriterium:** Cover-Seite zeigt neue Headline; Datei-Properties → "Title" zeigt gleichen Text; alte Datei-Naming-Pfade in Excel-Comments funktionieren weiterhin.

### Schritt 6: Doku + Version-Bump

- **Datei:** `modul_5_verdict.xml` Header (v1.1 → v1.2), `skill_pdf_export.md` Header (v1.0 → v1.1), `docs/modul_5_verdict.md` (NEU aus `_TEMPLATE_KOMPONENTE.md`), `docs/skill_pdf_export.md` (NEU aus `_TEMPLATE_KOMPONENTE.md`), `docs/README.md` (Index-Update)
- **Änderung:**
  - Modul 5: Version-Bump + AENDERUNGEN-Block "v1.2 vs v1.1: Mietspiegelrechner-Lookup, Mietsubventions-Stufentabellen pro WE + Aggregat-Treppe, Sachwertverfahren in Sektion 3, neue Cover-Headline".
  - Skill PDF: Version-Bump + AENDERUNGEN-Block "v1.1 vs v1.0: Tabellen-Header ORANGE statt NAVY, R4-Anwendungsregel ergänzt".
  - `docs/modul_5_verdict.md` neu: Zweck/Files/Datenfluss/Schnittstellen/Limitierungen.
  - `docs/skill_pdf_export.md` neu: gleiches Schema.
  - `docs/README.md` Status-Spalte: `—` → `✓` für Modul 5 + Skill PDF-Export.
- **Akzeptanzkriterium:** `docs/README.md`-Index zeigt beide Komponenten dokumentiert. Modul/Skill-Header zeigen neue Version + Diff-Block. Neue `.md`-Files sind nach `_TEMPLATE_KOMPONENTE.md` strukturiert.

### Schritt 7: Mockup-Aufräumen + Commit + Push

- **Datei:** `_mockup_subv.py`, `_mockup_subv.pdf`, `plans/2026-05-07-modul5-pdf-export-anpassung.md`, alle modifizierten Files
- **Änderung:**
  - Mockup-Files entfernen (oder in `.gitignore` halten — Entscheidung beim Commit).
  - Commit-Pattern (DEVELOPMENT_GUIDELINES §7):
    - `Aufteiler M5 v1.2: Mietspiegelrechner-Lookup, Subv-Stufentabellen, Sachwertverfahren, neue Headline`
    - `Aufteiler Skill pdf_export v1.1: Tabellen-Header Orange`
    - `Aufteiler Plan: 2026-05-07-modul5-pdf-export-anpassung`
    - `Aufteiler Docs: modul_5 + skill_pdf`
  - Push nach jedem Commit auf `main` (`web_fetch`-Wirkung).
- **Akzeptanzkriterium:** `git log --oneline` zeigt 4 saubere Commits; `web_fetch` der neuen `modul_5_verdict.xml` lädt v1.2 produktiv.

============================================================

## 6. Rollback-Plan

- **Quick-Rollback:** `git revert <commit-hash>` der Modul-5/Skill-Commits → push → `web_fetch` zieht wieder v1.1/v1.0
- **Hot-Fix-Strategie:** Falls nur ein Schritt klemmt (z.B. Sachwertverfahren rechnet falsch), kann er einzeln zurückgerollt werden — Header-Farbe + To-do-Liste + Cover-Headline sind unabhängig
- **Daten-Risiko:** keiner — Excel-Template wird nicht angefasst, keine Zell-Mapping-Migrations, keine Backwards-Inkompatibilität der Datei-Naming

============================================================

## 7. Test-Cases

| Case | Was geprüft wird | Erwartetes Ergebnis |
|------|------------------|---------------------|
| **Prosperstr. 59 (Essen)** End-zu-End | Vollanalyse + PDF-Export mit allen 5 Anpassungen | Cover-Headline = "Analyse zur Aufteiler-Kalkulation Prosperstraße 59"; Tabellen-Header orange; Sektion 1 mit Essen-Mietspiegelrechner-Link; Sektion 3 4-Block-Sachwertverfahren; Sektion 8.3 5 Stufentabellen + 8.2 Aggregat-Treppe |
| Synth. **Bochum-Case** | Mietspiegelrechner-Lookup für Bochum | Bochum-MSR-URL aus Lookup eingefügt, klickbar |
| Synth. **Düsseldorf-Case** | Mietspiegelrechner-Lookup-Lücke | Hinweis-Cell "Mietspiegelrechner-URL für Düsseldorf recherchieren" sichtbar, kein Crash |
| Synth. **MFH ohne BGF/NHK** | Sachwertverfahren-Pflicht-Inputs fehlen | STOPP-Meldung mit Hinweis, PDF wird NICHT generiert |
| Σ-Subv-Konsistenz Prosperstr. | Σ-berechnet je WE in Sektion 8.3 vs. Aggregat-Tabelle 8.4 | Abweichung < 0,5 % je WE (Rundungstoleranz) |

============================================================

## 8. Status-Verlauf

- **2026-05-07** — ERLEDIGT, alle 7 Schritte in einer Session umgesetzt:
  - Skill PDF v1.0 → v1.1 (Tabellen-Header Orange `#f97316`, R4-Anwendungsregel, PDF-title-Metadatum)
  - Modul 1 v1.0 → v1.1 (Step B2 ImmoWertV-Sachwertverfahren, neue Inputs BGF/NHK_2010/BKI-Index/Sachwertfaktor)
  - Modul 5 v1.1 → v1.2 (Mietspiegelrechner-Lookup, Subv-Stufentabellen pro WE + Aggregat-Treppe, Sachwertverfahren-Sektion 3, Cover-Headline)
  - Neu: `docs/modul_5_verdict.md`, `docs/skill_pdf_export.md`, `docs/modul_1_objektbasis.md`
  - `docs/README.md` Index aktualisiert (3 Komponenten von `—` auf `✓`)
  - Mockup-Artefakte (`_mockup_subv.py`, `_mockup_subv.pdf`) entfernt
- **2026-05-07** — OFFEN, Plan erstellt nach Bohrphase-Sparring (User-Auswahl Format A für Mini-Rechnung, ImmoWertV-Sachwertverfahren, Header-Farbe `#f97316`)
