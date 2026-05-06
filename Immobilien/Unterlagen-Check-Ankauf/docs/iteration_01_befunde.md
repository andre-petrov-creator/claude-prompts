# Iteration 01 — Befunde aus erstem Durchlauf (Prosperstr. 59, Essen-Dellwig)

Sammelpunkt für Schwachstellen aus dem ersten Skill-Durchlauf. Bausteine für späteren Umbau. **Nicht** umsetzen, bevor Sammlung abgeschlossen.

Quelle des Durchlaufs: `00_unterlagen-check_2026-04-28.pdf` (Datenraum Prosperstr. 59).

---

## Querschnitts-Prinzipien (gelten für ALLE Schritte)

### P1 · Standort-/objektagnostisch — keine Hardcoded-Geographie

Skill-Prompts und Reference-Dateien dürfen **keine** Stadt-, Gemeinde-, Bundesland- oder Objektbezüge enthalten. Alles standortabhängige läuft über Variablen aus Schritt 1 (Inventur).

**Pattern:**

1. **Schritt 1 (Inventur)** extrahiert aus Grundbuch/Adresse:
   - `OBJEKT_ADRESSE`
   - `OBJEKT_GEMEINDE`
   - `OBJEKT_KREIS`
   - `OBJEKT_BUNDESLAND`
2. **Subagent-Prompts** verwenden ausschließlich Variablen, nie Klartext-Städte.
3. **Reference-Dateien** nennen Themen-URLs (Bundesrecht) + Recherche-Pattern für Landes-/Kommunalebene, niemals konkrete Städte.
4. **Bei jedem Rechtszitat (Bund/Land/Kommune):** Live-Fetch + Datum + URL im Subagent-Output. Ohne Quelle → Status `nicht_pruefbar`.

**Begründung:** Recht und kommunale Regelungen ändern sich, Trainings-Wissen ist stale. Hardcoded-Städtenamen brechen den Skill für jedes andere Objekt.

**Gilt für:**
- Mietrecht (Kappungsgrenze, Sperrfrist § 577a, Mietpreisbremse)
- GEG / kommunale Wärmeplanung (WPG)
- Bauordnung (BauO Land)
- Bodenrichtwerte (BORIS-Portal des jeweiligen Landes)
- Altlasten- und Baulastenkataster (kommunal)
- Kappungsgrenzenverordnung, Kündigungssperrfristverordnung
- BetrKV-Spiegel-Benchmarks (regional/bundesweit)

### P1.1 · Konkrete Hardcoded-Stellen, die raus müssen

Befund nach Repo-Scan — alles unter P1 zu fixen:

**`SKILL.md`:**
- L3 (Description): `applies Aufteiler-specific risk analysis (NRW/Ruhrgebiet)` → entfernen oder generisch
- L16 (Rolle): `Schwerpunkt NRW/Ruhrgebiet ... BauO NRW` → generisch (DACH, Bundesland aus Variable)
- L208 (Schritt 4): `Stadt-spezifische Sperrfrist nach NRW-Verordnung berücksichtigen (typisch Ruhrgebiet: 5 bis 8 Jahre)` → komplett raus, ersetzen durch Live-Recherche-Anweisung pro `OBJEKT_BUNDESLAND`/`OBJEKT_GEMEINDE`
- L218 (Schritt 4.5.1): `Bodenrichtwert €/m² (BORIS.NRW oder Aufteiler-Annahme)` → BORIS-Portal des `OBJEKT_BUNDESLAND` (Variable)
- L227 (Schritt 4.5.1): `Falls BRW noch nicht via BORIS.NRW verifiziert` → Portal-Variable
- L277 (Schritt 4.5.4a): `Heizungstausch GEG 2032` → Beispiel-Jahr raus, Live-Recherche

**`docs/05_aufteiler_risiken.md`:**
- L7: `NRW-spezifische Sperrfristen` → `bundeslandspezifische Sperrfristen`
- L11: `NRW/Ruhrgebiet-Spezifika` → `landes-/kommunale Spezifika`
- L21: `NRW-Spezifika (z.B. Mietpreisbremse, Soziale Erhaltungssatzung)` → bundeslandspezifisch generisch

**`references/01-grundbuch.md`:**
- L7 (Rolle): `Notar oder Grundbuchamt-Beamter mit langjähriger Praxis im Ruhrgebiet` → `... mit DACH-Praxis`
- L64: `WFNG NRW etc.` → `Wohnraumförderungsgesetz des jeweiligen Bundeslandes (z.B. WFNG für NRW, BayWoFG für Bayern, ...)` ODER ganz raus, Live-Recherche
- L72: `typisch im Ruhrgebiet: Bergschädenverzicht` → `regionaltypische Belastungen (z.B. Bergschädenverzicht in Bergbau-Regionen)`

**`references/_template.md` + alle 20 Reference-Dateien (L19):**
- `TODO — relevante BGB / WEG / GEG / BetrKV / BauO NRW / ImmoWertV-Paragraphen` → `BauO NRW` durch `BauO des jeweiligen Bundeslandes` ersetzen, weil `_template.md` als Vorlage für künftige Reference-Dateien dient

**SKILL.md Description (Frontmatter):**
- Der Trigger-Beispiele-Satz "Aufteiler-specific risk analysis (NRW/Ruhrgebiet)" muss in der Description weg, sonst wird der Skill für Nicht-NRW-Objekte schlechter erkannt.

---

## Kategorisierte Einzelbefunde

### A · Komplett fehlende Skill-Bausteine

- **A1** Wirtschaftliche Validierung (Schritt 4.5) im Output komplett fehlend: Gebäudeanteil, Vermieter-NK, Aufteiler-Kosten, Rücklagen-Tabelle 1,5–2,5 %, Rücklagenentwicklung, Cashflow-Impact, Bewirtschaftungs-Realitätscheck, Mieter-NK + BetrKV-Benchmark, BK-Lücken-Hebel.
- **A2** Risk-Score (laut `CLAUDE.md` Pflicht) fehlt — nur Ampel-Verdict.
- **A3** Verdict-Hierarchie unsauber ("NACHVERHANDELN ODER NO-GO") — SKILL.md verlangt genau eines von 🟢/🟡/🔴.

### B · Inhaltliche Lücken

- **B1** Mietsteigerungs-Hebepotenzial nicht pro WE quantifiziert.
- **B2** Bodenrichtwert (BORIS-Portal des jeweiligen Bundeslandes — siehe P1) wird nicht abgefragt → Gebäudeanteil-Berechnung fehlt.
- **B3** CapEx-Tabelle einspaltig (nur Worst-Case) — Best/Real/Worst fehlen, Reduktions-Empfehlung ohne Rechenweg.
- **B4** Cashflow-Rechnung dünn — keine Brutto/Bewirtschaftung/Netto-Subtraktion.
- **B5** Anzeige/Exposé-Vergleich (SKILL.md 4.5.4b) komplett fehlend — Exposé nicht als Inventur-Input gefordert.
- **B6** CO2KostAufG-Vermieter-Anteil nicht beziffert.
- **B7** BK-Lücken-Hebel nur in Fließtext — Tabelle fehlt.
- **B8** Markt-Benchmarks (Versicherung, NK warm) ohne Quelle.
- **B9** Sperrfrist § 577a "typisch" geschätzt — muss live aus VO des betroffenen Bundeslandes kommen (P1).
- **B10** Vorkaufsrecht § 577 BGB-Logik unscharf (vermietet vor/nach Aufteilung).
- **B11** RND nach ImmoWertV fehlt.
- **B12** Bestehende Rücklage / Hausgeld-Konto nicht erfragt.
- **B13** Recht hardcoded statt live: SKILL.md:277 "GEG 2032" raus. Stattdessen Live-Quellen-Block in jeder Reference mit Rechtsbezug (`10-energieausweis.md`, `13-schornsteinfeger.md`, `15-wartungsvertraege.md`, `06-mietvertrag.md`, `08-betriebskosten.md`). Live-Pflicht laut P1.

### C · Layout / Optik

- **C1** Vergleichsdaten ≥3 Zeilen müssen Tabelle sein, sind aber Bullet-Listen (Bsp. Mieten pro WE).
- **C2** Klickbarkeit Quellenverweise in Edge/Adobe nicht verifiziert.
- **C3** Inventur-Tabelle zeigt nur vorhandene Nrn — Soll-Liste vollständig (alle 20 + n/a-Flag) fehlt.
- **C4** Wiederholungen To-Do ↔ Detail (Bsp. WoFlV-Aufmaß 4×).
- **C5** Empfehlung verweist auf Detail ohne PDF-internen Anker.
- **C6** PDF-Seitenumbrüche unsauber. Regel für `tools/report_to_pdf.py` + Schritt 6:
  - Block (Tabelle, Detail-Sektion, Red-Flag-Eintrag, To-Do-Bucket, Quercheck-Tabelle) niemals so trennen, dass eine halbe Tabelle/halbe Sektion auf der nächsten Seite landet.
  - Wenn ein Block auf der aktuellen Seite nicht mehr ganz passt → Seitenumbruch davor.
  - Mehrere kurze Blöcke dürfen sich eine Seite teilen.
  - Lange Blöcke dürfen über zwei oder mehr Seiten gehen, müssen dann aber an einer sauberen Naht (Tabellenzeile, Bullet, Absatzgrenze) brechen — nicht mitten in einer Zeile.
  - Verbot: Block, Block, halber Block — neue Seite — Rest des halben Blocks — neuer Block.
  - Umsetzung: `page-break-inside: avoid` für Tabellen/`<section>`-Wrapper, `page-break-before: auto` für Detail-Sektionen, ggf. `break-inside: avoid-page` (CSS3) prüfen.

### D · Konsistenz / kleine Bugs

- **D1** Header-Datum nicht aktuell — System-Datum nutzen.
- **D2** Header "4 von 5 unwirksam" vs. Detail "3.OG grenzwertig" → Klassifizierung schärfen.
- **D3** Quercheck-Tabelle Wert "nicht" unklar → "n/a" / "nicht angegeben" erzwingen.
- **D4** WE-/Garagen-Zuordnung lückenhaft (welche WE ohne Garage?).
- **D5** Altlastenkataster fehlt → Triage zu schwach (im Bergbauerbe-Kontext min. 🟡).
- **D6** Inkonsistente Nutzerzahlen ista (35/6/5) nicht aufgeklärt — Quercheck-Matrix erweitern.
- **D7** Verkäufer im Header redundant — nur als Red Flag, wenn Risiko.

### E · Fehlende Output-Artefakte

- **E1** Verkäufer-Anschreiben-Entwurf nicht generiert.
- **E2** Vor-Ort-Begehungs-Checkliste nur 1 Bullet — eigener Anhang fehlt.
- **E3** Aufteiler-Szenarien A/B/C ohne Kalkulation.

---

## Umsetzungs-Status (nach Iteration 01)

### Erledigt in Iteration 01

| Bereich | Befund | Umsetzung |
|---|---|---|
| **P1** | Standort-/objektagnostisch | SKILL.md komplett neu, Hardcoding raus, `OBJEKT_*`-Variablen + zentrale Live-Recherche in Schritt 1 |
| **P1.1** | NRW-Hardcoding | SKILL.md L3/L16/L208/L218/L227/L277 entfernt; alle 21 references NRW raus; `01-grundbuch.md` Ruhrgebiet-Bezug generisch; `docs/05_aufteiler_risiken.md` aktualisiert |
| **A1** | Wirtschaftliche Validierung fehlte | Eigener Profi-Subagent `references/wirtschaftliche-validierung.md` mit B1–B9; SKILL.md Schritt 4.5 ruft ihn explizit auf |
| **A2** | Risk-Score | SKILL.md Schritt 5: Score 0–100, Formel `15·🔴 + 5·🟡 + 3·Lücken`, capped bei 100 |
| **A3** | Verdict-Hierarchie | SKILL.md Schritt 5: genau eines von 🟢/🟡/🔴 mit Schwellen; Override-Regel bei eindeutigen Deal-Killern |
| **B1** | Mietsteigerung pro WE | `wirtschaftliche-validierung.md` B7 mit Tabelle pro WE + Mietspiegel + Kappung |
| **B2** | BORIS-BRW | `wirtschaftliche-validierung.md` B1 + Schritt-1-Live-Recherche, Portal des `OBJEKT_BUNDESLAND` |
| **B3** | CapEx Best/Real/Worst | `wirtschaftliche-validierung.md` B8 mit 3-Spalten-Tabelle |
| **B4** | Cashflow-Rechnung | `wirtschaftliche-validierung.md` B9 Cashflow-Kurve pro Szenario |
| **B5** | Exposé-Vergleich | SKILL.md Schritt 1 fragt Exposé als Pflicht-Input ab; B4b vergleicht Anzeige vs. realistisch |
| **B6** | CO2KostAufG | `wirtschaftliche-validierung.md` + `09-heizkosten.md` W11-Hook |
| **B7** | BK-Lücken-Tabelle | `wirtschaftliche-validierung.md` B6 mit BetrKV-Norm-Spalte |
| **B8** | Markt-Benchmarks Quelle | Live-Recherche in Schritt 1 + Quellen-Pflicht in `wirtschaftliche-validierung.md` |
| **B9** | Sperrfrist § 577a | `aufteiler-risiken.md` Standort-Live-Variable; SKILL.md Schritt 1 recherchiert |
| **B10** | Vorkaufsrecht-Logik | `aufteiler-risiken.md` Bewertungsregeln § 577 BGB inkl. Abs. 1a |
| **B11** | RND ImmoWertV | `wirtschaftliche-validierung.md` (Substanz-Bj.-Hinweis in B4) + W2 in Quercheck |
| **B12** | Bestand-Rücklage | SKILL.md Schritt 1 fragt User explizit; B4a nutzt als Startwert |
| **B13** | Recht hardcoded | "GEG 2032" in SKILL.md raus; alle Reference-Dateien mit "Live-Quellen"-Block + Pflicht zu URL+Datum |
| **C1** | Tabelle statt Bullets | SKILL.md Stilregel "≥3 Vergleichszeilen IMMER als Tabelle" |
| **C3** | Inventur vollständig | SKILL.md Schritt 1: alle 20 Soll-Positionen mit Status, auch n/a |
| **C4** | Wiederholungs-Verbot | SKILL.md Schritt 5: To-Do = nur Action-Satz mit Anker, Detail = volle Begründung |
| **C5** | PDF-Anker | SKILL.md Schritt 5: To-Do mit Detail-Anker `#detail-rf-N` (attr_list-Extension bereits aktiv im Tool) |
| **C6** | PDF-Umbruch | `tools/report_to_pdf.py` CSS erweitert: `page-break-inside: avoid` für Tabellen/Listen/To-Do-Buckets, `orphans/widows: 2`, `page-break-after: avoid` für Header |
| **D1** | Datum dynamisch | SKILL.md Schritt 5: System-Datum |
| **D2** | Klassifizierung | Subagent-Output-Schema mit `nicht_pruefbar` als eigenem Status; Hauptagent darf nicht Mischformen erzeugen |
| **D3** | "n/a" | Subagent-Anti-Patterns + Selbstkontrolle |
| **D4** | WE-/Garagen-Zuordnung | `07-mieterliste.md` Pflichtfeld "Garage separat?" |
| **D5** | Altlasten-Triage | `04-altlasten.md` Risiko-Indikatoren erweitert (Bergbau-Region) |
| **D6** | Quercheck Nutzerzahlen | `09-heizkosten.md` Pflichtfeld + W19-Hook |
| **D7** | Verkäufer-Header | SKILL.md Schritt 5: Verkäufer NICHT im Header, nur als Red Flag bei Risiko |
| **E1** | Verkäufer-Anschreiben | Neuer Schritt 7 in SKILL.md (optional, generiert `01_verkäufer-nachforderung_{datum}.md`) |
| **E2** | Begehungs-Checkliste | `references/begehung-checkliste.md` mit Pflicht-Punkten + risiko-spezifischen Markern |
| **E3** | Aufteiler-Szenarien | `aufteiler-risiken.md` mit Szenarien A/B/C inkl. Pflicht-Outputs |

### Profi-Subagent-Architektur (neu)

- **Vereinheitlichte Profi-Struktur** in allen 20 `references/NN-*.md`: Rolle, Standort-Kontext, Pflichtfelder, Live-Quellen, Wechselwirkungs-Hooks, Risiko-Indikatoren, Output-Format, Anti-Patterns, Selbstkontrolle
- **Fallback**: SKILL.md hat klare Regel — bei unbekanntem Doc-Typ läuft generischer Subagent + Hauptagent vermerkt im Report "Kein Profi-Subagent für [TYP]"
- **Subagent-Prompt-Template** in SKILL.md Schritt 2 reicht den zentralen Standort-Block durch (Variablen aus Schritt 1)

### Iteration 02 (Out-of-Scope für jetzt)

- **Tiefe Profi-Inhalte** in den 19 Reference-Dateien (außer 01-grundbuch.md, das schon Tiefe hat): konkrete BGH-Urteile mit Aktenzeichen, regionale Marktbenchmark-Quellen, branchenspezifische Anti-Patterns je Profi-Rolle
- **Quercheck-Matrix v0.2**: Web-Recherche-Sub-Agent verifiziert + ergänzt Wechselwirkungen gegen aktuelle Rechtsprechung + Marktbenchmarks
- **Aufteiler-Risiken v0.2**: Kalkulationsbeispiele in Szenarien A/B/C mit Live-Marktpreis-Recherche pro `OBJEKT_GEMEINDE`
- **Mietspiegel-Integration B7**: automatisches Parsing qualifizierter Mietspiegel des `OBJEKT_GEMEINDE`
- **CapEx-Bandbreiten B8**: regionale Handwerker-Preisbänder (Tank-Stilllegung, Heizungstausch, Schadstoff-Sanierung) statt pauschaler Annahmen

---

## Nächster Schritt

Skill auf zweiten Datenraum laufen lassen (idealerweise außerhalb von NRW, um P1 zu verifizieren). Befunde aus zweitem Durchlauf → Iteration 02 starten.
