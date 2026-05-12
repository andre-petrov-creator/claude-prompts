# Design — Aufteiler-Workflow als Markdown-Skill-Suite

**Datum:** 2026-05-12
**Status:** Design abgeschlossen, wartet auf User-Review vor writing-plans
**Betroffene Komponenten:** kompletter Aufteiler-Workflow (alle Module + Orchestrator + PDF-Skill)

============================================================

## 1. Ziel und Motivation

Der bisherige Aufteiler-Workflow basiert auf XML-Modulen, die von Web-Claude (claude.ai) via `web_fetch` geladen werden. Andre arbeitet inzwischen ausschließlich in Claude Code. Drei Pain-Points sollen gelöst werden:

1. **Akkuratesse:** Der Workflow läuft jedes Mal etwas anders ab — Reihenfolge, Berechnungen und Output-Format variieren. Das verhindert iterative Optimierung, weil das Ergebnis kein stabiles Vergleichsobjekt ist.
2. **Token-Effizienz:** Das gesamte XML-Setup als Projektanweisung zu laden ist groß. Module on-demand laden, statt alles auf einmal im Kontext zu halten.
3. **Sync-Pflicht:** Bisher mussten Inhalte zwischen GitHub, Skill-Ordner und Mono-Repo manuell synchron gehalten werden. Eine einzige Quelle der Wahrheit.

Bedingung: Wertvolle Daten und Zwischenergebnisse dürfen durch Kontext-Compression NICHT verloren gehen. Werte und Entscheidungen müssen auch nach Sitzungs-Wechsel oder Wochen später vollständig zugreifbar sein.

============================================================

## 2. Architektur-Übersicht

Markdown-Skill-Suite mit einem Orchestrator-Skill und sechs Modul-Sub-Skills plus einem PDF-Form-Skill. Alle Skills liegen im Aufteiler-Repo unter `skills/`. Eine Junction macht sie für Claude Code unter `~/.claude/skills/` sichtbar. Persistenter State pro Objekt liegt unter `runs/<objekt-slug>/state.json` und überlebt Kontext-Compression.

```
c:\meine-projekte\Immobilien\Aufteiler\
├── skills\
│   ├── aufteiler\                            ← Orchestrator (klein)
│   ├── aufteiler-modul-0-quickcheck\
│   ├── aufteiler-modul-1-objektbasis\
│   ├── aufteiler-modul-2-rnd-afa\
│   ├── aufteiler-modul-3-massnahmen\
│   ├── aufteiler-modul-4-miete\
│   ├── aufteiler-modul-5-deal-bewertung\
│   └── aufteiler-pdf-export\
├── archive\                                  ← alte XMLs (Rollback)
│   ├── orchestrator.xml
│   └── modul_*.xml
├── runs\                                     ← .gitignore'd, ein Ordner pro Objekt
│   └── <objekt-slug>\state.json + Outputs
├── docs\
├── plans\
├── template\Kalkulation_…xlsx
└── setup-junctions.ps1
```

============================================================

## 3. Sequenz und Modul-Übersicht

**Vollanalyse-Sequenz NEU:** 0 → 1 → 2 → 3 → 4 (Modul 5 nur auf Anfrage).

Reihenfolge gegenüber alt geändert: RND/AfA **vor** Massnahmen, weil Massnahmen die RND nicht ändern dürfen.

| ID | Name | Skill-Ordner | Liest | Schreibt |
|----|------|--------------|-------|----------|
| 0 | Quick-Check | `aufteiler-modul-0-quickcheck` | User-Input | `state.objekt`, `state.modul_0` |
| 1 | Objektbasis | `aufteiler-modul-1-objektbasis` | `modul_0` | `state.modul_1` |
| 2 | RND und AfA | `aufteiler-modul-2-rnd-afa` | `modul_1` | `state.modul_2` mit `rnd_frozen=true` |
| 3 | Massnahmen | `aufteiler-modul-3-massnahmen` | `modul_1`, `modul_2` (read-only) | `state.modul_3` |
| 4 | Mietsituation | `aufteiler-modul-4-miete` | `modul_1` | `state.modul_4` |
| 5 | Deal-Bewertung | `aufteiler-modul-5-deal-bewertung` | alles | `state.modul_5` + PDF + Excel |

Umbenennungen gegenüber Alt:
- Alt-Modul 2 (Massnahmen) → Neu-Modul 3
- Alt-Modul 3 (RND/AfA) → Neu-Modul 2
- Alt-Modul 5 „Deal Verdict" → Neu „Deal-Bewertung"

============================================================

## 4. Orchestrator-Mechanik

Der Orchestrator-Skill (`skills/aufteiler/SKILL.md`) ist ein stumpfer Dispatcher. Er rechnet nicht, er interpretiert nicht — je dümmer, desto reproduzierbarer.

### 4.1 Modus-Erkennung (deterministisch)

Erste Aktion bei jedem Aufruf:

| User sagt … | Modus | Sequenz |
|-------------|-------|---------|
| "Vollanalyse", "komplette Analyse", "alles" | `vollanalyse` | 0 → 1 → 2 → 3 → 4 |
| "Quick-Check", "nur Schnellcheck" | `nur_quickcheck` | 0 |
| "Objektbasis", "WE-Liste" | `nur_basis` | 1 |
| "RND", "Restnutzungsdauer", "AfA" | `nur_rnd` | 2 |
| "Massnahmen", "Sanierung" | `nur_massnahmen` | 3 |
| "Miete", "Mietspiegel" | `nur_miete` | 4 |
| "Deal-Bewertung", "PDF-Export", "Endbericht" | `nur_export` | 5 |

Bei unklarem Input: eine Rückfrage via AskUserQuestion. Keine Vermutung.

### 4.2 TodoWrite vor Start

Sobald Modus erkannt, legt der Orchestrator eine Todo-Liste mit der geplanten Sequenz an. Damit ist State jederzeit sichtbar; Claude kann nicht „springen".

### 4.3 Objekt-Slug + State-Init

Orchestrator fragt nach Adresse, erzeugt daraus einen kebab-case-Slug (z.B. `prosperstr-59-essen-dellwig`), legt `runs/<slug>/` an, initialisiert `state.json` falls neu oder lädt bestehende. Bestehende State erkennt der Orchestrator am `objekt.letzter_modul_lauf`-Feld und schlägt vor, dort weiterzumachen.

### 4.4 Sub-Skill-Aufruf pro Modul

Pro Modul ein Skill-Aufruf: `Skill(skill="aufteiler-modul-N-xxx")`. Der Modul-Inhalt landet erst dann im Kontext, läuft sein Programm ab, schreibt State, und das nächste Modul rotiert beim nächsten Aufruf den vorigen Inhalt aus dem aktiven Fokus.

### 4.5 Freigabe-Gate

Nach jedem Modul:
> "Modul X abgeschlossen. Weiter zu Modul Y? (`go`/`weiter`/`ja`/`ok` = weiter, alles andere = Stopp)"

Kein automatisches Weiterlaufen, auch nicht bei „mach alles".

### 4.6 Was der Orchestrator NICHT macht

- Keine Berechnungen
- Keine Excel-Befüllung
- Keine Interpretation von Modul-Outputs
- Keine Modus-Schätzung bei mehrdeutigem Input

============================================================

## 5. Modul-Skill-Template (einheitlich)

Jeder Modul-Skill folgt **derselben Innen-Struktur**. Sektionen 1, 5, 6, 7 sind byte-identisch (außer Modul-Nummer). Sektionen 2, 3, 4 sind modul-spezifisch.

```markdown
---
name: aufteiler-modul-N-<thema>
description: Wann auslösen (vom Orchestrator) ...
---

# Modul N — <Name>

## 1. State laden (Pflicht erste Aktion)
- Read state.json aus runs/<objekt-slug>/
- Pflichtfelder aus Vorgänger-Modulen prüfen
- Fehlt etwas → STOPP, zurück an Orchestrator

## 2. Inputs erheben
Modulspezifisch. User-Eingaben einzeln via AskUserQuestion. Notion-DB-Queries hier.

## 3. Berechnung / Logik
3a) Tiefenstufen-Definition (siehe 6.2)
3b) Eingangs-Check → Stufen-Wahl (höchste vollständig erreichbare Stufe)
3c) Berechnung schrittweise, in fester Reihenfolge

## 4. Output erzeugen (Zone A/B/C, siehe 6.1)

## 5. State persistieren
- Schreibe modul_N-Block in state.json (Schema-validiert)
- Schreibe modul-N-output.md (lesbarer Audit-Trail)

## 6. Self-Check
- [ ] Alle Pflichtfelder im Schema befüllt
- [ ] Werte in Plausibilitätsgrenzen
- [ ] Asset-Trennung eingehalten (modulspezifisch)
- [ ] Excel-Transfer-Block vollständig
Bei rot → kein state.json-Schreiben, an Orchestrator zurück

## 7. Übergabe
Knappe Bestätigung an Orchestrator: "Modul N grün, Freigabe?"
```

============================================================

## 6. Output-Stabilität und Tiefenstufen

Trennung zwischen **Methode** (flexibel — folgt der Datenlage) und **Output-Struktur** (starr — immer gleich aufgebaut).

### 6.1 Drei Output-Zonen pro Modul

**Zone A — Daten-Block (pixel-identisch, immer)**
- Tabellen mit fixen Spalten und Reihenfolge
- Drei kritische Blöcke MÜSSEN strukturidentisch sein über alle Objekte hinweg:
  1. Mietsubventionen
  2. Aktuelle Miete vs. Sollmiete
  3. Restnutzungsdauer-Bewertung
- Nicht ermittelbare Werte: „n/a" eintragen, nicht weglassen
- Zwei Outputs nebeneinanderlegen → diff-bar wie Code

**Zone B — Tiefenstufen-Deklaration (pixel-identisch, immer)**
Genau zwei Zeilen am Modul-Anfang:
```
Tiefenstufe: 3 von 5 (Fotos + Lage verfügbar; Grundriss/Mietvertrag nicht verfügbar)
Konfidenz: mittel
```

**Zone C — Begründungs-Block (Struktur fix, Formulierung frei)**
Drei fixe Sub-Sektionen, immer in dieser Reihenfolge:
1. Wichtigste Annahmen (Bullet-Liste, max 5)
2. Risiken / Unsicherheiten (Bullet-Liste, max 5)
3. Empfehlung (1–3 Sätze)

### 6.2 Tiefenstufen-Logik

Jedes Modul hat eine fest definierte Eskalations-Treppe (Code im Skill, keine Improvisation). Kumulativ: Stufe 4 enthält 1–3 plus neue Logik. Fehlt ein Datenpunkt, hält das Modul bei der vorigen Stufe und deklariert das in Zone B.

**Modul 4 Miete (Beispiel):**

| Stufe | Vorhanden | Berechnet |
|-------|-----------|-----------|
| 1 | Adresse + WE-Wfl | Mietspiegel-Mittelwert nach Wfl-Korridor |
| 2 | + Baujahr | + Baujahr-Zu/Abschlag |
| 3 | + Lage-Daten | + Lage-Zuschlag NRW-Spiegel |
| 4 | + Fotos | + Ausstattungs-Score (Bad/Küche/Boden) |
| 5 | + Grundriss/Lage im Haus | + DG/EG/Mitte-Faktor + Schnitt |
| 6 | + Mietvertrag | + Ist-Miete + §558-Heberecht |

**Modul 2 RND (Beispiel):**

| Stufe | Vorhanden | Berechnet |
|-------|-----------|-----------|
| 1 | Baujahr | Standard-RND ImmoWertV Anlage 2 |
| 2 | + Mod-Ist | Mod-Score → Korridor-Position |
| 3 | + Dach-/Heizungs-/Fenster-Alter | Differenzierte Mod-Score-Berechnung |

Output-Tabelle sieht in allen Stufen gleich aus. Nur die Spalte "Begründung" wird detaillierter.

============================================================

## 7. State-Schema und Daten-Verträge

### 7.1 Speicherort pro Objekt

```
runs/<objekt-slug>/
├── state.json                  ← maschinelle Wahrheit
├── modul-0-output.md … modul-5-output.md  ← Audit-Trail
├── Kalkulation_<Strasse>.xlsx  ← befüllte Excel-Kopie
└── eingangs-daten/             ← PDFs, Fotos, Grundrisse
```

`runs/` ist in `.gitignore` (Objekt-Daten gehören nicht ins Repo).

### 7.2 Schema von `state.json`

Siehe `docs/state-schema.md` (wird in Phase 1 angelegt). Struktur in Auszügen:

```json
{
  "schema_version": "1.0",
  "objekt": { "slug", "adresse", "stadt", "stadtteil", "bundesland",
              "erstellt_am", "letzter_modul_lauf" },
  "modul_0": { "status", "tiefenstufe", "konfidenz", "ausgefuehrt_am",
               "angebotspreis_eur", "etw_konsens_eur", "gap_prozent", "ueber_schwelle" },
  "modul_1": { "status", "tiefenstufe", "tiefenstufe_max", "konfidenz",
               "brw_eur_pro_qm", "gebaeude_anteil_prozent",
               "we_liste": [{ "we_nr", "lage_im_haus", "wohnflaeche_qm",
                              "zimmer_anzahl", "balkon", "keller" }] },
  "modul_2": { "status", "tiefenstufe", "konfidenz",
               "baujahr", "rnd_jahre", "rnd_frozen": true, "rnd_basis",
               "mod_score", "afa_korridor_prozent", "afa_empfehlung_prozent",
               "begründung" },
  "modul_3": { "status", "tiefenstufe", "konfidenz",
               "ist_kernsanierung": false,
               "massnahmen_liste": [{ "kategorie", "ist_zustand", "geplant",
                                       "kosten_netto_eur" }],
               "rnd_gutachten_netto_eur", "weg_teilung_netto_eur", "enev_klasse",
               "summen": { "modernisierung_netto_eur", "modernisierung_brutto_eur",
                           "nebenkosten_netto_eur", "nebenkosten_brutto_eur" } },
  "modul_4": { "status", "tiefenstufe", "tiefenstufe_max", "konfidenz",
               "we_mieten": [{ "we_nr", "ist_miete_eur_pro_qm", "sollmiete_eur_pro_qm",
                               "mietspiegel_obergrenze_eur_pro_qm",
                               "paragraph_558_heberecht_eur", "mietsubvention_eur_pro_monat" }],
               "mietsubventionen_summe_eur_pro_monat", "begruendung_je_we" },
  "modul_5": { "status", "bewertungs_score", "pdf_pfad", "excel_pfad" }
}
```

### 7.3 Daten-Vertrag (wer liest was, wer schreibt was)

Siehe Tabelle in Abschnitt 3. Zusätzlich:

**Asset-Trennung erzwungen durch Schema:**
- `modul_3.summen.modernisierung_netto_eur` enthält NUR Bau-/Modernisierungskosten — keine Rücklage, keine Subvention.
- Self-Check in M3: „Steht in einer Massnahmen-Position das Wort `subvention` oder `rücklage` → STOPP."
- `modul_4.mietsubventionen_summe_eur_pro_monat` und Rücklage gehen in separate Block in `VERKAUFSMATRIX`-Extra-Spalten, nicht in Reno-Block.
- Damit gelöst: Punkt 1 in `plans/2026-05-12-offene-punkte.md`.

**RND-freeze-Mechanik:**
- M2 setzt `modul_2.rnd_frozen = true` nach Schreiben
- M3 darf `modul_2.rnd_jahre` lesen, aber Schema-Validator weist Schreibversuch zurück
- M5 zitiert RND ausschließlich aus `modul_2.rnd_jahre` (single source of truth)
- Technisch verankert, nicht nur prozessual

### 7.4 Schema-Validierung

Jeder Modul-Skill enthält am Ende einen JSON-Schema-Block oder eine Pflichtfeld-Tabelle (Felder, Typen, Wertebereiche). Vor dem Schreiben validiert das Modul:
- Pflichtfeld fehlt → rot, kein Schreiben
- Wert außerhalb Plausibilitätsgrenze → rot
- Typ falsch → rot

Bei rot bleibt `state.json` unverändert und der User wird gefragt.

### 7.5 Excel-Handoff-Vertrag

`docs/excel_handoff.md` (in Phase 1 anzulegen): pro Excel-Sheet eine Tabelle `Zelle | Erwarteter Wert | Liefer-Modul | Schema-Pfad`. Beispiel:

| Sheet!Zelle | Inhalt | Quelle |
|-------------|--------|--------|
| `MIETER!Y8` | Mietspiegel-Obergrenze WE 1 €/m² | `modul_4.we_mieten[0].mietspiegel_obergrenze_eur_pro_qm` |

Damit ist die Excel-Befüllung deterministisch.

============================================================

## 8. Datenqualität trotz Compression

Compression entfernt Inhalte aus dem Chat-Kontext, **nicht** aus Dateien auf der Platte. Die State-Datei plus die `modul-N-output.md`-Audit-Trails sind compression-safe.

**Drei Bedingungen, die das garantieren:**

| Bedingung | Mechanik |
|-----------|----------|
| A: Schema-Validierung pro Modul | Sektion 6 im Modul-Template; bei Fehlern kein Schreiben |
| B: State-Datei als einzige Quelle für nachgelagerte Schritte | M3 liest aus state.json, nicht aus Chat; M5 ebenso; Excel-Export ebenso |
| C: Bei Fragen nach Abschluss → Pflicht-Read der State-Datei | Im Orchestrator-Skill verankert: nie aus Erinnerung antworten, immer aus Datei zitieren |

Das ist **strikt besser als der Status quo** — Werte landen in JSON (exakt), nicht im Chat (von Compression bedroht), und Begründungen liegen als Markdown auf der Platte.

Restrisiko: wenn ein Modul beim Schreiben einen falschen Wert hineinschreibt (Halluzination). Dagegen: Self-Check + Plausibilitäts-Grenzen + User-Freigabe vor nächstem Modul.

============================================================

## 9. Sync-Strategie

**Eine Quelle der Wahrheit:** `c:\meine-projekte\Immobilien\Aufteiler\skills\`

Windows-Junction macht den Ordner für Claude Code unter `~/.claude/skills/` sichtbar:

```powershell
# setup-junctions.ps1
$src = "C:\meine-projekte\Immobilien\Aufteiler\skills"
$dst = "C:\Users\andre\.claude\skills"
Get-ChildItem $src -Directory | ForEach-Object {
    cmd /c mklink /J "$dst\$($_.Name)" "$($_.FullName)"
}
```

Bearbeitung passiert nur im Aufteiler-Skills-Ordner → wirkt sofort in Claude Code → Push auf GitHub macht es backed up.

Web-Claude wird nach Phase 4 nicht mehr verwendet. XMLs landen in `archive/` (mit `git mv`, Historie bleibt). Wenn nach grünem E2E-Test alles funktioniert, kann `archive/` gelöscht werden — Entscheidung am Ende von Phase 4.

============================================================

## 10. Phasen-Plan

**Phase 1 — Fundament**
1. `archive/`-Ordner anlegen, XMLs per `git mv` reinverschieben
2. `skills/`-Struktur mit 8 leeren SKILL.md-Stubs
3. `runs/`-Ordner mit `.gitkeep` + `.gitignore`-Eintrag
4. `setup-junctions.ps1` + manueller Lauf
5. `docs/state-schema.md` + `docs/excel_handoff.md` skeleton
6. Smoke-Test: Claude Code findet Skills, Orchestrator-Stub kann andere Skills aufrufen

**Phase 2 — Orchestrator + Modul-Template**
7. `aufteiler/SKILL.md` ausschreiben
8. `docs/_TEMPLATE_MODUL_SKILL.md` ausschreiben
9. Modul 0 Quick-Check vollständig bauen
10. Smoke-Test mit Dummy-Objekt

**Phase 3 — Module 1–4**
11. Modul 1 Objektbasis
12. Modul 2 RND/AfA (inkl. `rnd_frozen`-Mechanik)
13. Modul 3 Massnahmen (inkl. RND-Gutachten + WEG-Teilung als Reno-Pos.; Subvention/Rücklage NICHT in Reno)
14. Modul 4 Miete (Tiefenstufen 1–6, Mietsubvention separat)
15. Pro Modul Test mit realistischen Daten (Prosperstraße als Daten-Set, nicht als Soll-Vergleich)

**Phase 4 — Modul 5 + Cleanup**
16. `aufteiler-pdf-export` als Form-Skill (Übersetzung von `skill_pdf_export.md`)
17. `aufteiler-modul-5-deal-bewertung` mit Platzhalter-Score-Logik (siehe `plans/2026-05-12-score-logik-modul-5-offen.md`)
18. End-to-End-Test
19. `README.md` und `docs/ARCHITEKTUR.md` aktualisieren
20. Entscheidung über `archive/`-Löschung

============================================================

## 11. Test-Strategie

Drei Ebenen:

| Ebene | Was wird getestet | Mit was |
|-------|-------------------|---------|
| Schema-Tests | state.json erfüllt Schema nach jedem Modul | JSON-Schema-Validator pro Modul |
| Reproduzierbarkeit | Gleicher Input → gleicher Output (Zone A + B identisch) | Ein realistisches Daten-Set (z.B. Prosperstraße) zweimal in zwei frischen Sitzungen durchlaufen, beide `modul-N-output.md` und beide `state.json` diffen — Zone A + B müssen byte-identisch sein, Zone C darf variieren |
| Akkuratesse | Werte sind plausibel und nachvollziehbar | Stichproben mit bekannten Daten (Prosperstraße) — als Realitäts-Check, NICHT als Pixel-Vergleich gegen alte Vorlage |

Reproduzierbarkeit ist der wichtigste Test. Wenn Zone A + B bei zwei Läufen mit identischem Input identisch sind, ist das Hauptproblem („jedes Mal anders") gelöst.

============================================================

## 12. Was offen bleibt (außerhalb dieser Spec)

- **Score-Logik Modul 5:** ausgegliedert nach `plans/2026-05-12-score-logik-modul-5-offen.md`. Modul 5 bekommt in Phase 4 eine Platzhalter-Aggregation; echte Logik wird später separat eingebaut.
- **Konkrete Plausibilitäts-Grenzen** pro Schema-Feld (z.B. RND-Korridor) — definiert beim Bau jedes Moduls.
- **Wortwörtliches Tabellen-Layout Zone A** pro Modul — finalisiert beim Bau jedes Moduls.
- **Inhaltliche Logik-Fixes** in `plans/2026-05-12-offene-punkte.md` (Rücklage/Subvention nicht in Reno, RND-Gutachten + WEG-Teilung als Reno-Pos.) — werden beim Bau der jeweiligen Modul-Skills umgesetzt.

============================================================

## 13. Akzeptanzkriterien

Diese Spec gilt als erfolgreich umgesetzt, wenn:

- [ ] Alle 8 Skill-Ordner existieren und funktionsfähig sind
- [ ] Junction-Setup ist dokumentiert und einmalig ausgeführt
- [ ] `state.json`-Schema ist in `docs/state-schema.md` dokumentiert und wird von jedem Modul validiert
- [ ] Vollanalyse 0→1→2→3→4 läuft mit realistischen Daten ohne Modus-Sprung durch
- [ ] Reproduzierbarkeits-Test: zweimal gleicher Input erzeugt identische Zone A + B Outputs
- [ ] RND-freeze: M3 kann `modul_2.rnd_jahre` nicht überschreiben (durch Schema-Validator)
- [ ] Asset-Trennung: Rücklage und Mietsubvention erscheinen nicht im Reno-Block
- [ ] Compression-Test: In einer frischen Sitzung (leerer Kontext) kann der Orchestrator + Modul 5 aus `runs/<slug>/state.json` allein das PDF erzeugen, ohne Rückfrage nach Werten aus früheren Modulen
- [ ] Modul 5 PDF wird mit Platzhalter-Score erfolgreich erzeugt
- [ ] Alte XMLs in `archive/` per `git mv` (Historie erhalten)

============================================================

## 14. Referenzen

- `plans/2026-05-12-offene-punkte.md` — inhaltliche Logik-Fixes
- `plans/2026-05-12-score-logik-modul-5-offen.md` — Score-Logik-Tracking
- `docs/ARCHITEKTUR.md` — aktuelle Architektur (wird in Phase 4 aktualisiert)
- `CLAUDE.md` — Projekt-Konventionen
- `DEVELOPMENT_GUIDELINES.md` — Format-Regeln und Versionierung
