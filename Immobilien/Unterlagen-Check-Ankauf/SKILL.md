---
name: unterlagen-check-ankauf
description: Use this skill whenever the user wants a professional document review of a German multi-family property (Mehrfamilienhaus, MFH) acquisition package. Triggers include "Unterlagen prüfen", "Unterlagencheck", "Bankenpaket", "Datenraum", "Due Diligence", "Ankaufsprüfung", "Exposé prüfen", or whenever the user shares folders with documents like Grundbuchauszug, Mietverträge, Energieausweis, Teilungserklärung, Betriebskostenabrechnung, Versicherungspolice, Baugenehmigung, Flurkarte, Baulastenverzeichnis, Wohnflächenberechnung, Wartungsvertrag, Hausgeldabrechnung. Performs document-by-document analysis with PARALLEL Profi-Subagents (one per document via Task tool, each is a domain expert defined in references/NN-*.md), runs cross-document checks via the Wechselwirkungs-Matrix, applies Aufteiler-Risk-Analysis with live-researched local rules, runs an Wirtschafts-Subagent for cashflow/CapEx/Rücklagen-Validation, produces a structured Red-Flag-Report with Risk-Score (0–100) and exports as PDF. Always location-agnostic — every legal/regulatory fact is fetched live for the actual `OBJEKT_GEMEINDE` and `OBJEKT_BUNDESLAND`. Always use this skill for systematic package reviews even if user does not explicitly say "Due Diligence". Do NOT use for single-question queries about one fact in one document.
---

# Unterlagen-Check Ankauf (MFH Due Diligence, Profi-Subagents parallel)

## Mission

Komplettes Unterlagenpaket eines MFH systematisch prüfen, jedes Dokument einzeln und im Gesamtkontext. Versteckte Risiken aufdecken, die im Exposé nie stehen, im Kaufvertrag aber bindend werden. Output ist ein Red-Flag-Report aus Investoren- und Bankensicht, mit klarer Deal-Empfehlung und Risk-Score, als Markdown und als PDF.

**Architektur**:

- **Pro Unterlagengruppe ein Profi-Subagent** (z. B. Mietrechts-Anwalt für Mietvertrag, Energieberater für Energieausweis), Definition jeweils in `references/NN-*.md`.
- **Subagents laufen parallel** in Schritt 2 — bei 15 Unterlagen dauert die Einzelprüfung nicht 15× so lange, sondern annähernd so lange wie das langsamste Dokument.
- **Hauptagent trägt zusammen**, wendet die Wechselwirkungs-Matrix (`references/quercheck-matrix.md`) an, ruft den Wirtschafts-Subagent (`references/wirtschaftliche-validierung.md`) auf, baut den Gesamtreport.
- **Standort-agnostisch**: Alle Rechtszitate, kommunalen Regelungen und Marktbenchmarks werden live recherchiert — kein Stadt-/Bundesland-Hardcoding.

## Rolle (Hauptagent)

Erfahrener MFH-Investor mit DACH-Praxis und Aufteiler-Strategie. Kennt BGB-Mietrecht, WEG-Recht, GEG, BetrKV, ImmoWertV. Denkt gleichzeitig wie ein Bankprüfer, der das Objekt finanzieren muss.

Maxime: Die teuersten Fehler stehen in den Unterlagen, nicht im Exposé. Jedes Dokument wird gelesen wie der Verkäufer es nicht möchte.

## Eigene Bias-Disziplin

- **Halo-Effekt**: Hochwertiges Exposé bedeutet nicht gepflegtes Objekt. Zahlen und Dokumente prüfen, nicht Optik.
- **Confirmation Bias**: Wenn der Deal "gut aussieht", aktiv nach Gegenargumenten suchen. Mindestens drei Risiken benennen.
- **Curse of Knowledge**: Fachbegriffe in Klartext erklären, wenn sie zentral für eine Empfehlung sind.
- **Overconfidence**: Bei rechtlichen Detailfragen explizit "muss Anwalt prüfen" sagen, statt eigene Auslegung als sicher zu verkaufen.
- **Anchoring auf Exposé-Zahlen**: Anzeige-/Exposé-Renditen als Anker ignorieren, eigene Cashflow-Rechnung priorisieren.

---

## Workflow

Sieben Schritte. Schritt 2 läuft parallel.

### Schritt 1: Inventur + Standort-Live-Recherche (sequentiell)

Bevor irgendein Dokument inhaltlich geprüft wird:

1. Vom Nutzer den Pfad zum Unterlagen-Ordner erfragen oder aus dem Kontext entnehmen.
   - **Mieten-Soll-Quelle parallel suchen** (Pflicht für Wirtschafts-Subagent B2.5): Suche im Objekt-Stammordner (eine Ebene über `Objektunterlagen/`) und in `Objektunterlagen/` selbst nach Aufteiler-Outputs (`Aufteiler_*.pdf`, `Kalkulation_*.xlsx`) und nach Soll-Mieten-Aufstellungen. Suchmuster case-insensitive: `mietmatrix`, `mietaufstellung`, `mietenliste`, `mietenübersicht`, `mieten gesamt`, `mietenspiegel-objekt`, `rent roll`. Wenn keine Quelle gefunden: frage den User nach Soll-Aufstellung oder Screenshot. Bei vorhandenem Aufteiler-Output: Soll-Mieten daraus ziehen, gegen Einzel-Mietverträge validieren (Quercheck Ist vs. Soll pro WE). Ergebnis als `MIETEN_SOLL_QUELLE` + `MIETEN_SOLL_PRO_WE` (Tabelle: WE | Wohnfläche | Soll-Kalt €/Mt) in den Standort-Block aufnehmen — geht als Pflicht-Input in Schritt 4.5 ein.
2. Ordnerinhalt auflisten (Bash `ls`, `find`).
3. **Pre-Flight-Klassifizierung** via `tools/pdf_classify.py`:
   - Pro PDF: Größe + Text-Layer-Probe (pdftotext, >100 Bytes Output) + Split-Bedarf
   - Klassen: `text` / `split` / `scan` / `scan+split`
   ```bash
   python ~/.claude/skills/unterlagen-check-ankauf/tools/pdf_classify.py "<unterlagen-ordner>" --markdown
   ```
4. Jede Datei einem Dokumenttyp zuordnen (siehe Mapping unten).
5. Standort-Variablen aus Grundbuch / Adresse / Exposé extrahieren:
   - `OBJEKT_ADRESSE`
   - `OBJEKT_GEMEINDE`
   - `OBJEKT_KREIS`
   - `OBJEKT_BUNDESLAND`
6. **Standort-Live-Recherche** (zentral, einmalig — Ergebnisse werden allen Subagents als Kontext mitgegeben):
   - **BORIS-Portal** des `OBJEKT_BUNDESLAND` für Bodenrichtwert (URL live recherchieren — jedes Bundesland hat eigenes Portal)
   - **Mietspiegel** `OBJEKT_GEMEINDE` (qualifiziert / einfach / nicht vorhanden)
   - **Kappungsgrenzenverordnung** `OBJEKT_BUNDESLAND` § 558 Abs. 3 BGB (15 % oder 20 % in 3 J. + Geltungsbereich)
   - **Kündigungssperrfristverordnung** `OBJEKT_BUNDESLAND` § 577a BGB (Dauer + Geltungsbereich)
   - **Mietpreisbremse** § 556d BGB — gilt im `OBJEKT_GEMEINDE`?
   - **Kommunale Wärmeplanung** `OBJEKT_GEMEINDE` (Stichtag § 71 GEG)
   - **Soziale Erhaltungssatzung / Milieuschutz** `OBJEKT_GEMEINDE` Stadtteil-genau
   - **Hebesatz Grundsteuer** `OBJEKT_GEMEINDE`
   - **DMB-BetrKV-Spiegel** aktueller Stand (bundesweiter Benchmark NK warm)
   - Rechercheergebnisse mit URL + Stand-Datum dokumentieren. Bei nicht ermittelbar: explizit `nicht_pruefbar`.
7. Vom User zusätzliche Inputs erfragen (sofern nicht schon im Kontext):
   - **Kaufpreis** EUR
   - **Exposé/Verkaufsanzeige** (für Anzeigen-vs-Realität-Vergleich) — falls nicht vorhanden, als `nicht angegeben` weiterführen
   - **Bestand Instandhaltungs-Rücklage** (Hausgeldkonto-Bestand) — falls nicht vorhanden, als `nicht angegeben`
   - **Aufteiler-Strategie?** (ja/nein) — wenn ja, Schritt 4 + 4.5 mit Aufteiler-Spezifika
8. Soll-Ist-Vergleich Inventur ausgeben — **alle 20 Soll-Positionen** mit Status (Spalte **Lesbar** ist Pflicht — entscheidet Pipeline in Schritt 1.5):

| Nr | Dokumenttyp | Datei | Größe | Lesbar | Status |
|---|---|---|---|---|---|
| 01 | Grundbuchauszug | `grundbuch_2026.pdf` | 1.2 MB | ✅ Text | ✅ Vorhanden |
| 02 | Flurkarte | — | — | — | ❌ Fehlt |
| 12 | Bauakte | `bauakte.pdf` | 22 MB | 🟡 OCR nötig | ⚠️ Scan |
| 14 | Großes Gutachten | `gutachten.pdf` | 38 MB | ✅ Text | ⚠️ Split nötig |
| 15 | Bauakte alt | `bauakte_alt.pdf` | 41 MB | 🟡 OCR nötig | ⚠️ Split + OCR |
| ... | ... | ... | ... | ... | ... |

**Mapping Dokumenttyp → Profi-Subagent-Reference**:

| Nr | Typ | Profi-Reference |
|---|---|---|
| 01 | Grundbuchauszug | `references/01-grundbuch.md` |
| 02 | Flurkarte / Liegenschaftskarte | `references/02-flurkarte.md` |
| 03 | Baulastenverzeichnis | `references/03-baulasten.md` |
| 04 | Altlastenkataster | `references/04-altlasten.md` |
| 05 | Wohnflächenberechnung | `references/05-wohnflaeche.md` |
| 06 | Mietvertrag | `references/06-mietvertrag.md` |
| 07 | Mieterliste | `references/07-mieterliste.md` |
| 08 | Betriebskostenabrechnung | `references/08-betriebskosten.md` |
| 09 | Heizkostenabrechnung | `references/09-heizkosten.md` |
| 10 | Energieausweis | `references/10-energieausweis.md` |
| 11 | Versicherungspolice / Schadenshistorie | `references/11-versicherung.md` |
| 12 | Baugenehmigung / Bauakte | `references/12-baugenehmigung.md` |
| 13 | Schornsteinfegerprotokoll | `references/13-schornsteinfeger.md` |
| 14 | Trinkwasseruntersuchung | `references/14-trinkwasser.md` |
| 15 | Wartungsvertrag | `references/15-wartungsvertraege.md` |
| 16 | Modernisierungsnachweise | `references/16-modernisierung.md` |
| 17 | Teilungserklärung | `references/17-teilungserklaerung.md` |
| 18 | EV-Protokoll (WEG) | `references/18-ev-protokolle.md` |
| 19 | Wirtschaftsplan / Hausgeldabrechnung | `references/19-wirtschaftsplan.md` |
| 20 | Grundsteuerbescheid + Erschließungsbeiträge | `references/20-grundsteuer.md` |

**Mietverträge**: Wenn mehrere Wohneinheiten, gibt es typischerweise einen Mietvertrag pro WE. Jeder Vertrag bekommt einen eigenen Subagent (Mietrechts-Anwalt aus `06-mietvertrag.md`).

**Fallback bei unbekanntem Doc-Typ**: Wenn die Inventur einen Dokument-Typ findet, der KEIN Mapping hat → generischer Subagent läuft (mit Hinweis "kein Profi-Profil"), Hauptagent vermerkt im finalen Report:

> **Kein Profi-Subagent vorhanden für Dokumenttyp: <TYP>.** Datei wurde mit generischem Prompt geprüft, Tiefe eingeschränkt. **Empfehlung**: `references/NN-<typ>.md` als neue Profi-Reference anlegen (Iteration 02).

**Abbruch-Regel**: Wenn weniger als 60 % der Soll-Liste vorhanden, Stopp und Rückfrage an Nutzer: trotzdem prüfen oder Verkäufer erst nachliefern lassen?

---

### Schritt 1.5: PDFs für Multimodal-Lesung vorbereiten

**Architektur-Prinzip Skill v4 — Lese/Audit-Trennung:**

Subagents bekommen NICHT die PDF, sondern bereits **extrahierten Text** (in Schritt 1.6 vom Hauptagent erzeugt). Grund: Subagent-Sandboxes haben PDF-Tool-Lottery (pdftoppm fehlt zufällig in ~20 % der Subagent-Instanzen). Hauptagent ist **multimodal** und liest PNG-Renderings zuverlässig — das ist die hochwertigste Lese-Methode für deutsche Behörden-/Hausverwaltungs-Dokumente und ersetzt OCR vollständig.

Pipeline-Reihenfolge: **Erst Split (für >25 MB), dann Render (Multimodal-Vorbereitung)**.

#### Pipeline R: Render aller PDFs zu PNGs (Hauptweg)

Für **alle** PDFs (Klassen `text`, `scan`, `split`, `scan+split`):

```bash
python ~/.claude/skills/unterlagen-check-ankauf/tools/pdf_render.py "<unterlagen-ordner>" --dpi 160
```

**Effekt**: Pro PDF Geschwister-Ordner `_render_<originalname>/` mit `page_001.png`, `page_002.png`, ... + `_manifest.json` (Mapping page → Originalseite).

**Voraussetzung**: PyMuPDF (Python-Paket, plattformunabhängig, kein Binary-Install).

```bash
pip install --user pymupdf
```

**Warum Render statt OCR**: Hauptagent liest die PNGs in Schritt 1.6 multimodal — das ergibt höhere Lese-Qualität als Tesseract-OCR (Tabellen, Stempel, Handschrift, gemischte Layouts). Kein Tesseract-Install nötig.

#### Pipeline S: Split für PDFs > 25 MB

Für Klasse `split` und `scan+split` (vor dem Render):

**Tool**: `tools/pdf_split.py`

```bash
python tools/pdf_split.py "/pfad/zur/grossen.pdf"
```

**Effekt**: Erzeugt Geschwister-Ordner `_split_<dateiname>/` mit `part_001.pdf`, `part_002.pdf`, ... und `_manifest.json`. Jeder Chunk ≤ 25 MB.

**Anschließend**: pdf_render.py auf jeden Part anwenden, damit auch große PDFs multimodal lesbar werden.

**Quellenverweis bleibt korrekt**: Das `_manifest.json` enthält das Mapping Part → Originalseiten.

#### Pipeline OCR (optional, Massenverarbeitung)

Tool `tools/pdf_ocr.py` bleibt verfügbar als Backup für Token-effiziente Massenverarbeitung (>50 PDFs, wo Hauptagent-Multimodal zu teuer wird). Standard-Workflow Skill v4 nutzt **Render** statt OCR.

---

### Schritt 1.6: Multimodal-Extraktion durch Hauptagent (NEU in Skill v4)

Pro PDF (mit gerendertem `_render_<name>/`-Ordner) führt der **Hauptagent** folgende Sequenz aus:

1. Lies alle `page_NNN.png` des `_render_<name>/`-Ordners via Read-Tool (Hauptagent ist multimodal — das ist die native, hochqualitative Lesung).
2. Extrahiere strukturiert in eine Markdown-Datei `_extract_<originalname>.md` neben der PDF:

```markdown
# Extract: <originalname>.pdf

**Quelle**: <originalname>.pdf
**Seiten**: <n>
**Render-DPI**: 160
**Datum Extraktion**: YYYY-MM-DD

## Seite 1

### Header / Briefkopf
[Aussteller, Datum, Adressat, Aktenzeichen]

### Inhalt
[Volltext-Zusammenfassung der Seite, alle relevanten Datenpunkte als Bullets]

### Tabellen
[Tabellen 1:1 als Markdown-Tabelle wiedergeben]

### Stempel / Unterschriften
[Sichtbare Stempel, Genehmigungsvermerke, Unterschriften (geschwärzt/sichtbar)]

## Seite 2
[gleiche Struktur]

...
```

3. Pflichtfelder pro Seite:
   - **Datum**, **Aussteller**, **Aktenzeichen** (sofern vorhanden)
   - **Beträge in Euro** (alle nennen, nicht runden)
   - **Adresse / Flurstück / Gemarkung** (für Identitäts-Quercheck)
   - **Bei Verträgen**: Mietbeginn, Kalt-/Warm-Miete, BK-VZ, HK-VZ, Kaution, Indexierung/Staffel
   - **Bei NK-Abrechnungen**: Verteilerschlüssel, m²-Bezugsbasis, Einzelpositionen €/Jahr, VZ vs. Ergebnis
   - **Bei Bauakte**: Baujahr, genehmigte WE, Auflagen, Schlussabnahme-Datum

4. Rote Texte / Streichungen / Rötungen explizit markieren als `[GELÖSCHT]` oder `[GERÖTET]` — wichtig für Grundbuch-Auszüge (siehe `references/01-grundbuch.md`).

**Vorteil dieser Architektur:**
- Multimodal-Lesung des Hauptagents ist die qualitativ beste verfügbare Methode (besser als Tesseract).
- Subagents bekommen sauberen Text statt PDF — keine Sandbox-Lottery, robust und schnell.
- Token-Bilanz: Hauptagent zahlt einmalig die Bild-Tokens, Subagents arbeiten mit Text (= günstiger und schneller).

---

### Schritt 2: Parallele Profi-Subagent-Einzelprüfung

Für jede vorhandene Datei einen Profi-Subagent via Task-Tool spawnen. **Mehrere Task-Calls in einer einzigen Antwort starten parallel.** Das ist der zentrale Performance-Hebel.

**Subagent-Prompt-Template** (für jeden Task-Call individuell befüllen):

```
Du bist ein Profi-Subagent (Auditor) für genau einen Dokumenttyp eines
MFH-Ankaufspakets. Du LIEST KEINE PDF — der Hauptagent hat den Inhalt
bereits multimodal extrahiert. Du arbeitest mit dem extrahierten Text.

PROFI-PROTOKOLL: {PROTOKOLL_PFAD}
   → Lies dieses Protokoll vollständig. Es definiert deine Rolle, Pflichtfelder,
     Live-Quellen, Wechselwirkungs-Hooks und Risiko-Indikatoren.

EXTRAHIERTER DOKUMENT-INHALT: {EXTRACT_PFAD}
   → Markdown-Datei mit dem strukturierten Inhalt des Original-PDF
     (vom Hauptagent in Schritt 1.6 via Multimodal-Read aus PNG-Renderings
     erstellt). Enthält pro Seite: Header, Inhalt, Tabellen, Stempel.
   → ORIGINAL-PDF: {ORIGINAL_PFAD} (für Quellenverweise im Output)

STANDORT-KONTEXT (aus Schritt 1, zentrale Live-Recherche):
{STANDORT_BLOCK}
   Enthaelt: OBJEKT_ADRESSE, OBJEKT_GEMEINDE, OBJEKT_KREIS, OBJEKT_BUNDESLAND
   und alle live recherchierten Variablen (BRW-Portal, Mietspiegel,
   Sperrfrist, Kappungsgrenze, Mietpreisbremse, Waermeplanung,
   Erhaltungssatzung, Hebesatz, BetrKV-Spiegel) mit URL + Stand.

AUFTRAG:
1. Profi-Protokoll vollstaendig anwenden.
2. Lies {EXTRACT_PFAD} vollständig — DAS ist deine Daten-Quelle.
   Du brauchst die PDF NICHT zu öffnen. Falls das Extract Lücken aufweist
   (z. B. "[unleserlich]" oder fehlende Felder), rückmelden mit Status
   "unvollstaendig" und konkret nennen, welche Daten fehlen — der
   Hauptagent kann dann gezielt nachrendern (höherer DPI / fehlende Seite).
3. Bei jedem Rechtszitat: Live-URL + Datum aus Standort-Block beziehen,
   sonst Status "nicht_pruefbar".
4. Bei jedem konkreten Befund und jeder Red Flag: Quelle als
   [<originaldatei>.pdf, S. X] anhaengen — Seitenzahl aus dem Extract
   (Sektion "## Seite N").
5. Wechselwirkungs-Datenpunkte fuer Quercheck-Matrix klar markieren
   (siehe Hooks im Profi-Protokoll).
6. Antworte AUSSCHLIESSLICH im folgenden Schema (kein Vorwort, kein Abschluss,
   kein Markdown-Codeblock drumherum):

---
dokument: "{DOKUMENTTYP}"
datei: "{ORIGINAL_PFAD oder DATEIPFAD}"
status: "vollstaendig" | "unvollstaendig" | "nicht_pruefbar"
profi_profil: "vorhanden" | "fallback_generisch"
---

## Kerndaten
[Datenpunkte fuer Cross-Doc-Quercheck. Pro Datenpunkt:
 [datei.pdf, S. X] anhaengen. Quercheck-Hook-Zeilen markieren mit
 "→ W<Nr>".]

## Befunde
[Bullet-List, max. 5-8 Punkte. Quelle zwingend.]

## Red Flags
🔴 [Hohes Risiko, konkretes Detail mit Begruendung] [datei.pdf, S. X]
🟡 [Mittleres Risiko, konkretes Detail mit Begruendung] [datei.pdf, S. X]
(Nur tatsaechlich vorhandene Red Flags. Keine Erfindungen. Wenn keine,
 schreib "Keine.")

## Offene Fragen an Verkaeufer
- [Konkrete Frage 1]
- [Konkrete Frage 2]

CONSTRAINTS:
- Keine Spekulation. Bei Unsicherheit Status "nicht_pruefbar".
- Betraege in Euro. Keine Gedankenstriche, stattdessen Komma oder Punkt.
- Bei rechtlichen Detailfragen Hinweis "muss von Anwalt geprueft werden".
- Antworte auf Deutsch.
- Quellenverweise als [datei.pdf, S. X] sind PFLICHT bei jedem Befund
  und jeder Red Flag.
- Bei Doc-Typ ohne Profi-Reference (Fallback): profi_profil="fallback_generisch"
  setzen, Hauptagent baut daraus den "kein Profi-Subagent"-Hinweis.
```

**Parallelisierung**: Alle Task-Calls in einer einzigen Antwort. Beispiel: 15 vorhandene Dokumente = 15 Task-Tool-Aufrufe in einer Response. Claude Code führt diese parallel aus.

**Bei sehr großer Anzahl (>20)**: in Batches von max. 20 parallel laufen lassen, sonst können Token-/Rate-Limits stören.

---

### Schritt 3: Synthese & Quercheck (sequentiell)

Hauptagent sammelt alle Subagent-Outputs. Dann:

1. **Datenpunkte sammeln**: aus allen "Kerndaten"-Sektionen die mit `→ W<Nr>` markierten Werte in eine flache Liste extrahieren.
2. **Wechselwirkungs-Matrix anwenden**: Zeile für Zeile aus `references/quercheck-matrix.md` durchgehen — pro Zeile prüfen, ob die geforderten Quellen-Datenpunkte vorhanden sind und ob sie konsistent sind.
3. **Quercheck-Tabelle ausgeben**:

| Datenpunkt | Quelle 1 | Quelle 2 | Quelle 3 | Konsistent? | Hinweis | Fix |
|---|---|---|---|---|---|---|
| ... | ... | ... | ... | ✅ / ⚠️ / 🔴 | ... | ... |

4. **Inkonsistenzen rot markieren**, mit Detailangabe welche Quellen abweichen und um wie viel.

---

### Schritt 4: Aufteiler-Risiken (bedingt — nur bei Aufteiler-Strategie)

Wenn der Nutzer Aufteiler-Strategie verfolgt: `references/aufteiler-risiken.md` anwenden.

1. Standort-Live-Variablen aus Schritt 1 nutzen (Sperrfrist, Kappung, Mietpreisbremse, Erhaltungssatzung).
2. Risiko-Matrix pro Mietverhältnis erstellen (siehe Schema in `aufteiler-risiken.md`).
3. Strategie-Szenarien A (Voll-Aufteilung), B (Teil-Aufteilung), C (Halten + Modernisieren-und-Heben) gegenüberstellen.
4. Empfehlung mit Begründung.

Wenn Quercheck W7 ergibt: Förderbindung aktiv → Schritt 4 frühzeitig abbrechen mit klarem KO-Vermerk für Aufteiler-Strategie.

---

### Schritt 4.5: Wirtschaftliche Validierung (eigener Profi-Subagent)

**Wichtig**: Schritt 4.5 wird als **eigener Subagent-Aufruf** (Task-Tool) gestartet, NACH Abschluss der Schritte 2 + 3. Der Wirtschafts-Subagent ist Profi (Investmentprüfer + Banken-Risikoanalyst), Definition in `references/wirtschaftliche-validierung.md`.

**Subagent-Aufruf**:

```
Du bist der Wirtschafts-Subagent fuer ein MFH-Unterlagenpaket.

PROFI-PROTOKOLL: references/wirtschaftliche-validierung.md

INPUTS:
- Standort-Live-Variablen aus Schritt 1: {STANDORT_BLOCK}
- User-Eingaben: KAUFPREIS_EUR, GRUNDSTUECKSFLAECHE_M2, EXPOSE_RENDITE_ANNAHME,
  BESTAND_RUECKLAGE_EUR, AUFTEILER_STRATEGIE
- Mieten-Soll-Basis (Pflicht fuer B2.5):
  - MIETEN_SOLL_QUELLE: {Pfad Aufteiler-Output Kalkulation_*.xlsx /
    Aufteiler_*.pdf / Mietaufstellung}
  - MIETEN_SOLL_PRO_WE: {Tabelle pro WE — Wohnflaeche m² | Soll-Kalt €/Mt
    | Soll-Kalt €/Jahr}
  - MIETEN_IST_PRO_WE: {Tabelle pro WE aus Subagent 06-mietvertrag —
    Ist-Kalt €/Mt, nur als Quercheck-Spalte}
- Subagent-Outputs Schritt 2: {ALLE_KERNDATEN_UND_BEFUNDE}
- Quercheck-Tabelle Schritt 3: {QUERCHECK_TABELLE}

AUFTRAG:
Wende das Profi-Protokoll vollstaendig an. Liefere alle Bloecke
B1, B2, B2.5, B3, B4, B5, B6, B7, B8, B9 (Gebaeudeanteil, Vermieter-NK,
Bewirtschaftungskosten Hausgesamt + pro WE, Aufteiler-Kosten,
Ruecklagen-Empfehlung, Mieter-NK, BK-Luecken-Hebel, Mietsteigerung,
CapEx Best/Real/Worst, Cashflow-Kurve).

Liefere B2.5 in beiden Sichten (Hausgesamt + pro WE), Bezugsgroesse
Soll-Kalt p.a. ohne Garagen. Soll-Mieten sind alleinige Berechnungsbasis,
Ist-Mieten nur Quercheck-Spalte. Keine geschaetzten Mieten.
Verteilerschluessel pro WE aus BK-/Heizkostenabrechnung uebernehmen,
keine Eigenkonstruktion.

Output-Schema steht im Profi-Protokoll. Jede Zahl mit Quelle
[datei.pdf, S. X] oder [Kalkulation_*.xlsx, Tab X].
Annahmen explizit als "Annahme" markieren.
```

Hauptagent integriert den Subagent-Output in Schritt 5.

---

### Schritt 5: Gesamtreport

Markdown-Report speichern unter:

```
{ankaufsordner}/00_unterlagen-check_{datum_aktuell}.md
```

Datum aus dem System (heute), nicht hardcoded.

**Layout-Pflichten**:

- **Header schlank**: `Adresse · Datum · Anzahl geprüfte Dokumente · Anzahl Mietverhältnisse · WE+Garagen-Count`. **Verkäufer NICHT im Header** — nur als Red Flag, wenn Verkäufer-Konstellation tatsächlich risikobehaftet (Bankverwertung, Erbenverkauf, Insolvenz, Treuhand).
- **Seite 1 = To-Do-Liste nach Ampel** (rot oben, gelb mitte, grün unten). Direkt abarbeitbar. Jede Zeile mit Quellen-Anker auf Detail-Sektion (PDF-internes Sprungziel) UND mit Quellen-Verweis als `file://`-Link auf Originaldokument.
- **Folgeseiten** = Detail-Sektionen, gleiche Ampelreihenfolge.
- **Wiederholungs-Verbot**: To-Do-Zeile = nur Action-Satz mit Anker. Volle Begründung steht ausschließlich in Detail-Sektion.
- **Vergleichsdaten ≥3 Zeilen** IMMER als Tabelle, nicht als Bullet-Liste.
- **Empfehlung**: GENAU EINES von 🟢 GO / 🟡 NACHVERHANDELN / 🔴 NO-GO. Keine Doppel-Verdicts.
- **Risk-Score**: 0–100 (siehe Berechnung unten), prominent unter der Empfehlung.

**Risk-Score-Berechnung**:

```
Score = min(100, 15 × Anzahl 🔴 + 5 × Anzahl 🟡 + 3 × Anzahl Pflicht-Unterlagen-Lücken)
```

Schwellen:
- 0–30 → 🟢 GO
- 31–65 → 🟡 NACHVERHANDELN
- 66–100 → 🔴 NO-GO

Bei eindeutigen Deal-Killern (z. B. laufende Förderbindung + Aufteiler-Ziel, ungeklärter Eigentümer-Status) Verdict-Override auf NO-GO unabhängig vom Score, Begründung explizit.

**Aufbau (Markdown-Skelett)**:

```markdown
# Unterlagen-Check Ankauf — [Adresse]
[Datum] · [Anzahl geprüfte Dokumente] Dokumente · [Anzahl] Mietverhältnisse · [WE]+[Garagen]

## Empfehlung

[🟢 GO / 🟡 NACHVERHANDELN / 🔴 NO-GO] · **Risk-Score: [Wert]/100**

[Ein Satz Begründung. Keine Romane.]

**Kaufpreis-Anpassung**: [Eurobetrag] (Begründung in Wirtschaftliche Validierung)

---

## To-Do (Seite 1)

<div class="todo-rot">

### 🔴 Sofort klären (vor Vertragsunterschrift)
- [ ] [Konkrete Aktion] [Detail-Anker](#detail-rf-1) [datei.pdf, S. X](file:///pfad/zur/datei.pdf#page=X)
- [ ] ...

</div>

<div class="todo-gelb">

### 🟡 Vor Notar nachverhandeln
- [ ] [Konkrete Aktion] [Detail-Anker](#detail-rf-7) [datei.pdf, S. X]
- [ ] ...

</div>

<div class="todo-gruen">

### 🟢 Erledigt / unkritisch
- [x] ...

</div>

---

## Inventur

[Tabelle aus Schritt 1 mit allen 20 Soll-Positionen + Status]

---

## Standort-Live-Recherche

[Tabelle: Variable | Wert | Quelle (URL) | Stand]

---

<h2 class="rot">🔴 Kritische Red Flags</h2>

### [Detail-Anker: detail-rf-1] Red Flag 1: kurzer Titel
- Detail [datei.pdf, S. X](file:///...)
- Risiko: [konkret, Eurobetrag]
- Empfehlung: [Aktion]

[…]

---

<h2 class="gelb">🟡 Wichtige Red Flags</h2>

[…]

---

## Quercheck-Inkonsistenzen

[Tabelle aus Schritt 3, nur ⚠️ und 🔴-Zeilen]

---

## Fehlende Unterlagen

- [Was fehlt, vom Verkäufer anfordern]

---

## Aufteiler-Risiken (falls relevant)

[Standort-Live-Block + Risiko-Matrix + Szenarien aus Schritt 4]

---

## Wirtschaftliche Validierung

[Output des Wirtschafts-Subagents aus Schritt 4.5 — vollständig integrieren:
 B1 Gebäudeanteil, B2 Vermieter-NK, B2.5 Bewirtschaftung, B3 Aufteiler-Kosten,
 B4 Rücklagen, B5 Mieter-NK, B6 BK-Lücken, B7 Mietsteigerung, B8 CapEx, B9 Cashflow]

### Hausgesamt-Sicht (Investor)

[B2.5 Sicht A: Bucket-Tabelle mit drei Cases, Σ Bewirtschaftung,
 % Soll-Kalt p.a. (ohne Garagen), Vermieter-Quote nicht umlagefähig.
 Garagen-Beitrag separat. Verdict: tragfähig / zu knapp / Cashflow-kritisch.]

### Pro WE-Sicht (Kapitalanleger)

[B2.5 Sicht B: drei Block-Tabellen (Best, Real, Worst), alle WE als Zeilen,
 Spalten Wohnfläche, Soll-Kalt p.a., Rücklage-Anteil, Umlagefähig-Anteil,
 Nicht umlagefähig (a+b+c+d), Σ Bewirtschaftung, % Soll-Kalt,
 Vermieter-Quote nicht umlagefähig. Verteilerschlüssel aus BK-/Heizkosten-
 Abrechnung. Verdict pro Median-WE + namentliche Nennung kritischer WE.
 Letzte Tabelle: Verbindung Mieter-Umlage ↔ Vermieter-Eigenanteil
 mit Σ-Hebel-Zeile (Verlinkung zu B6).]

---

## Investoren-Perspektive

- Worst-Case-CapEx je Red Flag (Eurobetrag)
- Empfehlung Kaufpreis-Reduktion: [Mittelwert Realistisch aus B8] (Begründung verlinkt zu B8)
- Empfehlung Vertragsänderungen

## Banken-Perspektive

- Was die Bank kritisch sehen wird
- Was vor Finanzierungsantrag geklärt sein muss

---

<h2 class="gruen">🟢 Unkritische Befunde (Anhang)</h2>

[Knapp, was OK ist]

---

## Anhang: Vor-Ort-Begehung

[Aus references/begehung-checkliste.md — Pflicht-Punkte + risiko-spezifische Marker
 aus Subagent-Outputs]

---

## Anhang: Einzelreports pro Dokument

[Subagent-Outputs als Sektionen, Quellenverweise als klickbare Links]

---

## Drei nächste Schritte

1. [Konkret]
2. [Konkret]
3. [Konkret]
```

**Stilregeln für den Report**:
- Jede Aussage mit Quellenverweis (Subagent-Quelle ODER Live-URL)
- Eurobeträge konkret, keine Pi-mal-Daumen
- Listen statt Fließtext wo möglich
- Tabellen für ≥3 Vergleichszeilen
- Keine Wiederholungen zwischen To-Do und Detail-Sektion (Detail enthält die volle Begründung, To-Do nur den Action-Satz mit Ankerlink)
- Datum dynamisch aus System

---

### Schritt 6: PDF-Export

Markdown-Report in PDF konvertieren mit Ampel-Layout, klickbaren Quellenverweisen und sauberen Seitenumbrüchen.

**Tool**: `tools/report_to_pdf.py`

```bash
python tools/report_to_pdf.py "{ankaufsordner}/00_unterlagen-check_{datum}.md"
```

**Effekt**: Erzeugt `00_unterlagen-check_{datum}.pdf` neben dem Markdown.

**PDF-Umbruch-Regeln** (im Tool implementiert):
- Tabellen, Detail-Sektionen, Red-Flag-Einträge, To-Do-Buckets, Quercheck-Tabellen werden NICHT mitten durch geteilt.
- Mehrere kurze Blöcke teilen sich eine Seite.
- Lange Blöcke dürfen über mehrere Seiten gehen, brechen aber an sauberen Nahtstellen (Tabellenzeile, Bullet-Punkt, Absatz).
- Verbot: halber Block am Seitenende + Rest auf Folgeseite.

**Quellen-Links im PDF**: als GoToR-Actions mit relativen Pfaden eingebettet (PDF-Standard ISO 32000-1 §12.6.4.5). Funktioniert in Edge, Adobe, Foxit, SumatraPDF — `#page=X`-Anker bleibt erhalten.

**Voraussetzung**: einmalige Installation
```bash
pip install --user markdown pikepdf
```

---

### Schritt 7: Verkäufer-Anschreiben (optional)

Wenn der Hauptagent fehlende Unterlagen identifiziert hat ODER der User explizit "Verkäufer anschreiben" anfordert: zweite Markdown-Datei generieren:

```
{ankaufsordner}/01_verkäufer-nachforderung_{datum}.md
```

Inhalt:
- Anrede + Bezug zum Objekt
- Liste aller fehlenden Unterlagen aus Schritt 5
- Liste aller 🔴-To-Dos, die Verkäufer-Klärung erfordern
- Rückmelde-Frist (Vorschlag: vor LOI / Notartermin)
- Optional: PDF-Konvertierung über Schritt-6-Tool

Nur auf User-Anforderung erstellen — nicht automatisch.

---

## Constraints

- **Keine Erfindungen**. Wenn ein Dokument nicht vorliegt oder unklar ist: explizit "nicht prüfbar".
- **Keine Hardcoded-Geographie**. Nichts Stadt-/Bundesland-spezifisches in den Prompts oder References — alles über Variablen aus Schritt 1.
- **Live-Recherche bei Rechtszitaten**: Datum + URL zwingend. Bei Trainings-Wissen ohne Live-Verifikation → `nicht_pruefbar`.
- **Bei rechtlichen Detailfragen** (Klausel-Wirksamkeit, Mietminderung, Eigenbedarfskündigung): immer "muss vor Kaufvertrag von Anwalt geprüft werden" anhängen.
- **Bei steuerlichen Fragen** (AfA, Spekulationsfrist, gewerblicher Grundstückshandel): Steuerberater-Verweis.
- **Sanierungs- und Reparaturkosten** als Schätzung mit Bandbreite Best/Real/Worst (siehe `wirtschaftliche-validierung.md` B8). Nutzer rechnet selbst mit Sicherheitsaufschlägen.
- **Beträge in Euro nennen, nicht in Prozent allein**. Bei Empfehlung "Kaufpreis um X reduzieren" konkrete Eurobeträge.
- **Quellenverweise** sind PFLICHT bei jedem Befund und jeder Red Flag, Format `[datei.pdf, S. X]` bzw. als klickbarer `file://`-Link im finalen Report.
- **Sprache**: Deutsch, professionell, kurz. **Keine Gedankenstriche** (–, —), stattdessen Komma oder Punkt.
- **Subagent-Outputs sind Quelle der Wahrheit**: Hauptagent darf nicht eigenständig Informationen ergänzen, die der Subagent nicht extrahiert hat. Wenn Lücke, dann offene Frage formulieren.
- **Fallback bei unbekanntem Dokumenttyp**: nicht stillschweigend generischer Subagent — explizit als `fallback_generisch` markieren + Empfehlung im Report.
- **Lese/Audit-Trennung (Skill v4)**: Subagents arbeiten ausschließlich mit dem in Schritt 1.6 vom Hauptagent erzeugten `_extract_<name>.md`. Subagents lesen keine PDFs — das verhindert Sandbox-Lottery und nutzt die Multimodal-Stärke des Hauptagents als zentrale Lesequelle. Wenn ein Extract Lücken hat (`[unleserlich]` o.ä.), Subagent meldet `unvollstaendig` mit konkretem Hinweis welche Daten fehlen, Hauptagent rendert gezielt mit höherem DPI nach.

## Stil

- Eine Erkenntnis pro Bullet Point.
- Risiko-Marker (🔴🟡🟢) konsequent.
- Tabellen für Vergleiche und Quercheck.
- Gesamtreport endet immer mit drei konkreten nächsten Schritten.
