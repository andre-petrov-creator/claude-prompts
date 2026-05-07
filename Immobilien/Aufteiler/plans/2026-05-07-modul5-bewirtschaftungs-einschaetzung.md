# Überarbeitungs-Plan: Modul 5 — Bewirtschaftungs-Einschätzung ins PDF

============================================================

## Meta

| Feld | Wert |
|------|------|
| **Plan-Datum** | 2026-05-07 |
| **Komponente** | `modul_5_verdict.xml` |
| **Aktuelle Version** | Modul 5 v1.2 |
| **Ziel-Version** | Modul 5 v1.3 (Minor — additive Sektion, kein Breaking Change) |
| **Ausgelöst durch** | User-Review: Bewirtschaftungs-Einschätzung existiert als Chat-Output, kommt aber nicht ins PDF. Im Web-Claude-Sparring entstandener Block (Aufschlüsselung Glas/Allgemeinstrom/WEG-Verwaltung + Rücklagen-Pfad + Profil für Anzeige) ist beim Investor mündlich/im Chat sichtbar, fehlt aber im exportierten Dokument. |
| **Status** | ERLEDIGT |

============================================================

## 1. Ausgangslage

Der Aufteiler liefert dem Investor eine kompakte Vorab-Einschätzung der laufenden Bewirtschaftung — wichtig für die Kapitalanleger-Story (Anzeige + Käuferansprache nach Aufteilung). Die Einschätzung besteht aus drei Teilen, die im Chat-Output schon entstehen, aber bisher nicht ins PDF wandern:

1. **Einschätzung unter diesen Prämissen** — Verdict-Statement (z.B. "20 % Bewirtschaftung = 5.940 €/Jahr — passt") plus Aufschlüsselungs-Tabelle mit konkreten Posten (Glas-Versicherung, Allgemeinstrom, Versicherungs-Diff, WEG-Verwaltung mit Berechnungs-Detail), Σ Laufende Fixkosten, Freier Cashflow für Rücklage.
2. **Rücklagen-Entwicklung** — Tabelle Jahr/Bestand-Heizung/Aufbau/Gesamt-Rücklage über 5–7 Jahre bis zum GEG-Pflichttausch, mit Heizungstausch-Bewertung (BEG-Förderung, Bandbreite Hybrid/Pellets).
3. **Profil für Anzeige / Käuferansprache** — Bullet-Liste mit 4–5 Quote-Bausteinen (z.B. "20 % Bewirtschaftungskosten inkl. WEG-Verwaltung", "15.000 € Heizungs-Rücklage beim Hauseigentümer hinterlegt") plus Verdict-Schluss-Satz für Kapitalanleger-Story.

Aktuell endet das PDF nach Sektion 8.4 (Mietsubvention-Aggregat) direkt mit Sektion 9 (Risiko-Heatmap). Der Investor verliert genau die kompakte Bewirtschaftungs-Sicht, die er für die Kapitalanleger-Vermarktung braucht.

============================================================

## 2. Ziel

Das PDF enthält ab v1.3 eine neue Sektion 8.5 mit den drei Sub-Blöcken (Einschätzung / Rücklagen-Entwicklung / Profil für Anzeige). Inhalt kommt aus dem Chat-Output der Vor-Module (Modul 5 rechnet wie immer nicht selbst). Layout konsistent mit v1.2 (Tabellen-Header Orange, Word-Wrap, KeepTogether).

============================================================

## 3. Scope

### IN-Scope

- `modul_5_verdict.xml` — neue Sektion 8.5 in `<pdf_struktur>`-Block, drei Sub-Blocks mit Layout-Spezifikation
- `modul_5_verdict.xml` — `data_sources` + `step 1 datensammlung` um Bewirtschaftungs-Schätzung-Felder erweitern
- `modul_5_verdict.xml` — PageBreak-Liste um Sektion 8.5 ergänzen
- `modul_5_verdict.xml` — Header-Bump v1.2 → v1.3 mit Änderungsblock
- `docs/modul_5_verdict.md` — Versions-Historie + Datenfluss + Schnittstellen aktualisieren

### OUT-of-Scope

- `skill_pdf_export.md` — keine neue Layout-Regel nötig (Standard-Tabellen + Bullet-Liste, alle aus R1-R13 abgedeckt)
- Andere Module (0, 1, 2, 3, 4) — Bewirtschaftungs-Schätzung entsteht aktuell on-the-fly im Web-Claude-Sparring; ob sie strukturell in M2/M3/M4 gehört, ist eine eigene Entscheidung (separater Plan)
- Excel-Template — keine neuen Zellen, keine Comment-Spiegelung der Bewirtschaftungs-Posten (kann später nachgezogen werden)
- Charts — die Sektion ist tabellenbasiert, kein matplotlib-Chart nötig

============================================================

## 4. Architektur-Entscheidungen

| Entscheidung | Alternativen | Gewählt weil |
|---|---|---|
| Position der Sektion = 8.5 (zwischen 8.4 Subventions-Aggregat und 9 Risiko) | Zwischen 7 und 8 (vor Mietsubv) / Nach 10 (nach Verdict) | 8.5 ist die natürliche Folge der Mietsubvention: erst Mieten + Subv (8.x), dann Bewirtschaftung als Cashflow-Realitätscheck — vor den Risiko-/Verdict-Blöcken |
| Drei Sub-Blocks in einer Sektion (8.5.1, 8.5.2, 8.5.3) | Drei eigene Sektionen 8.5/8.6/8.7 | Inhaltlich gehören sie zusammen (Bewirtschaftung → Rücklagen → Anzeige-Profil ist eine Story); KeepTogether pro Sub-Block reicht für Lesbarkeit |
| Inhalt kommt aus Chat-Output, Modul 5 rechnet nicht | Eigene Modul-5-Berechnungs-Logik | Verstößt gegen `core_rule "Modul 5 fuehrt KEINE Berechnungen durch"`; Berechnungs-Logik gehört wenn überhaupt in M2/M3/M4 |
| Bei fehlender Schätzung → STOPP statt stiller Auslassung | Sektion einfach weglassen | Konsistent mit anderen Pflicht-Inputs (BGF/NHK fehlen → STOPP); explizit ist besser als stillschweigend leere PDF-Sektion |
| Tabellen-Header Orange (geerbt aus v1.2) | Eigenes Farbschema für Bewirtschaftung | Konsistenz mit anderen Tabellen, kein neues Token |
| Verdict-Statement mit farbig hinterlegtem Verdict-Wort | Plain-Text | Visueller Anker, gleiche Logik wie Status-Cells (R5: kein Emoji, BG-Farbe) |

============================================================

## 5. Schritte

### Schritt 1: Header-Bump + AENDERUNGEN-Block

- **Datei:** `modul_5_verdict.xml`
- **Änderung:** `version="1.2"` → `"1.3"`. AENDERUNGEN-v1.3-vs-v1.2-Block oberhalb des v1.2-Blocks einfügen, mit Verweis auf diesen Plan.
- **Akzeptanzkriterium:** Header zeigt v1.3, Diff-Block listet die drei Sub-Blocks + data_sources/step1/PageBreak-Erweiterungen.

### Schritt 2: data_sources erweitern

- **Datei:** `modul_5_verdict.xml`
- **Änderung:** `<source name="modul_0_4_outputs"><enthaelt>` um drei v1.3-Felder ergänzt: Bewirtschaftungs-Schätzung, Rücklagen-Entwicklung, Profil-Bausteine.
- **Akzeptanzkriterium:** `<enthaelt>`-Block listet die neuen Felder explizit als v1.3-Erweiterung.

### Schritt 3: Step 1 datensammlung erweitern

- **Datei:** `modul_5_verdict.xml`
- **Änderung:** `<output_struktur>` in Step 1 um drei v1.3-Pakete erweitert:
  - Bewirtschaftungs-Einschätzung (Quote, Summe, Verdict-Wort, Aufschlüsselungs-Posten als Liste, Σ Fixkosten, Freier Cashflow für Rücklage)
  - Rücklagen-Entwicklung (Bestand-Start, Aufbau/Jahr, Start-/Stichtags-Jahr, Pro-Jahr-Tabelle, Heizungstausch-Bewertungs-Satz)
  - Profil für Anzeige (4–5 Bullet-Quotes, Verdict-Schluss-Satz)
- **Akzeptanzkriterium:** Schema sauber strukturiert, mit Beispielwerten zur Orientierung; klar dass die Werte aus Vor-Module-Outputs kommen.

### Schritt 4: PDF-Struktur Sektion 8.5 einfügen

- **Datei:** `modul_5_verdict.xml`
- **Änderung:** Neue `<sektion n="8.5" name="bewirtschaftungs_einschaetzung">` zwischen `<sektion n="8.4">` und `<sektion n="9">`. Drei Sub-Block-Spezifikationen:
  - 8.5.1 EINSCHAETZUNG UNTER DIESEN PRAEMISSEN: H2-Heading + Verdict-Statement-Zeile (mit farbig hinterlegtem Verdict-Wort) + 2-Spalten-Tabelle (Position 11 cm | EUR/Jahr 6 cm) mit Σ-Zeilen fett
  - 8.5.2 RUECKLAGEN-ENTWICKLUNG: H2-Heading + 4-Spalten-Tabelle (Jahr 2,5 / Bestand 4,5 / Aufbau 4,5 / Gesamt 5,5 cm) mit Stichtags-Zeile fett + Begleitsatz-Paragraph
  - 8.5.3 PROFIL FUER ANZEIGE / KAEUFERANSPRACHE: H2-Heading + Bullet-Liste mit Quote-Format (Kennzahlen fett via `<b>`-Tag) + Verdict-Schluss-Paragraph
- **Akzeptanzkriterium:** `<pdf_struktur>` zeigt 8.5 mit allen drei Sub-Blocks + STOPP-Logik bei fehlender Schätzung.

### Schritt 5: PageBreak-Regel + Stil-Regeln aktualisieren

- **Datei:** `modul_5_verdict.xml`
- **Änderung:**
  - `<regel_seitenumbruch>` PageBreak-Liste um `8.5` ergänzen.
  - v1.3-Hinweis: drei Sub-Blocks als eigene KeepTogether-Boxen, kein erzwungener Page-Break dazwischen — passen sie auf eine Seite, bleiben sie gemeinsam; sonst automatischer Seitenumbruch.
  - Drei neue `<regel>`-Einträge in `<stil>` für 8.5.1 Verdict-Wort-Färbung, 8.5.2 Stichtags-Zeile fett, 8.5.3 Kennzahlen-Fettung in Quotes.
- **Akzeptanzkriterium:** Layout-Verhalten klar dokumentiert; konsistent mit R1-R13.

### Schritt 6: Doku + Plan ablegen

- **Datei:** `docs/modul_5_verdict.md`, `plans/2026-05-07-modul5-bewirtschaftungs-einschaetzung.md`
- **Änderung:**
  - `docs/modul_5_verdict.md`: Versions-Historie um v1.3-Zeile ergänzt, Datenfluss-Diagramm um Bewirtschaftungs-Schätzung-Input, Schnittstellen-Tabelle um Sektion 8.5-Einträge.
  - Plan-Datei (diese hier) abgelegt.
- **Akzeptanzkriterium:** docs/README.md-Index nicht zu ändern (Modul 5 schon dokumentiert), aber docs/modul_5_verdict.md zeigt v1.3-Stand.

### Schritt 7: Commit + Push direkt auf main

- **Commit-Pattern (DEVELOPMENT_GUIDELINES §7):**
  - `Aufteiler M5 v1.3: Bewirtschaftungs-Einschaetzung ins PDF (Sektion 8.5 mit drei Sub-Blocks)`
- **Push auf main** (Aufteiler ist live über web_fetch — ohne Push kein produktiver Effekt).
- **Akzeptanzkriterium:** `web_fetch` der `modul_5_verdict.xml` lädt v1.3 produktiv.

============================================================

## 6. Rollback-Plan

- **Quick-Rollback:** `git revert <commit-hash>` der M5-v1.3-Commits → push → `web_fetch` zieht wieder v1.2
- **Hot-Fix-Strategie:** Sektion 8.5 ist additiv. Wenn ein Sub-Block fehlerhaft ist (z.B. Verdict-Statement-Färbung crasht), Sub-Block einzeln deaktivieren durch leeren `<sektion>`-Block oder Auskommentierung; andere zwei bleiben funktional.
- **Daten-Risiko:** keiner — Excel-Template wird nicht angefasst, keine Berechnungs-Migrationen. Bei fehlender Schätzung im Chat-Output stoppt Modul 5 mit User-Hinweis statt Crash.

============================================================

## 7. Test-Cases

| Case | Was geprüft wird | Erwartetes Ergebnis |
|------|------------------|---------------------|
| **Prosperstr. 59 (Essen)** End-zu-End | Vollanalyse + PDF-Export mit aktivem Bewirtschaftungs-Block | PDF zeigt Sektion 8.5 zwischen 8.4 und 9; drei Sub-Blocks lesbar; Verdict-Statement "20 % Bewirtschaftung = 5.940 €/Jahr — passt." mit grün hinterlegtem "passt" |
| **Synth.: Bewirtschaftung "zu knapp"** | Verdict-Wort-Färbung Gelb | "zu knapp" gelb hinterlegt, Statement-Rest in INK-Standard |
| **Synth.: Bewirtschaftung "Cashflow-kritisch"** | Verdict-Wort-Färbung Rot | "Cashflow-kritisch" rot hinterlegt |
| **Synth.: keine Bewirtschaftungs-Schätzung im Chat-Output** | STOPP-Logik | PDF wird NICHT generiert; User-Hinweis "Bewirtschaftungs-Schätzung fehlt im Modul-Output" |
| **Layout-Check Sektion 8.5.1 Tabelle** | colWidths 11+6 = 17 cm, Header Orange, Σ-Zeilen fett | R3 (Σ colWidths == textWidth), R4 (Header Orange), Σ-Zeilen visuell hervorgehoben |
| **Layout-Check Sektion 8.5.2 Tabelle** | colWidths 2,5+4,5+4,5+5,5 = 17 cm, Stichtags-Zeile fett, Zebra ab 4 Zeilen | R3, R11, Stichtags-Zeile (z.B. "2032 (GEG)") in Helvetica-Bold |
| **Layout-Check Sektion 8.5.3 Bullets** | Kennzahlen fett innerhalb Quote-Strings | `<b>...</b>`-Tags korrekt gerendert, Anführungszeichen sichtbar |
| **PageBreak-Verhalten** | Drei Sub-Blocks auf einer Seite vs. Aufteilung über zwei Seiten | Bei genug Platz: alle drei zusammen; bei zu wenig: automatischer Umbruch nach KeepTogether-Logik (R2 + R9) |

============================================================

## 8. Status-Verlauf

- **2026-05-07** — ERLEDIGT in einer Session:
  - Modul 5 v1.2 → v1.3 (Sektion 8.5 mit drei Sub-Blocks, data_sources/step1/PageBreak/Stil-Regeln erweitert)
  - `docs/modul_5_verdict.md` aktualisiert (Versions-Historie + Datenfluss + Schnittstellen)
  - Direkt auf main commitet + gepusht
- **2026-05-07** — OFFEN, Plan erstellt nach User-Feedback "Wir haben diese Schätzung zwar schon im Aufteilerskill drin, aber sie kommt leider nicht ins PDF. Ungefähr so sah die aus, und das war gut; die will ich auf jeden Fall im PDF haben."
