# Projekt: Aufteiler-Workflow (MFH-Analyse)

Markdown-Skill-Suite für die Aufteiler-Analyse von Mehrfamilienhäusern (NRW/Ruhrgebiet). Wird in **Claude Code** lokal ausgeführt; State pro Objekt unter `runs/<slug>/state.json` (gitignored). Skills sind sichtbar in Claude Code via Windows-Junctions (`~/.claude/skills/aufteiler*`).

Dieses Repo ist die **einzige Quelle der Wahrheit** für Skills, State-Schema und Excel-Template. Vorgängerversion (XML-Module für Web-Claude) liegt in `archive/` als Rollback-Quelle.

============================================================

## Vor jeder Aufgabe (Pflicht-Reads)

1. **`DEVELOPMENT_GUIDELINES.md`** — Konventionen, Format-Regeln, Versionierung
2. **`docs/ARCHITEKTUR.md`** — Big Picture: Orchestrator → Module → State → Excel → Notion
3. **`docs/state-schema.md`** + **`docs/state.schema.json`** — State-Vertrag, falls Modul-Schreibverhalten betroffen
4. **`docs/excel_handoff.md`** — Excel-Zell-Verträge, falls Excel-Befüllung betroffen
5. **Relevante `docs/*.md`** zum betroffenen Skill (siehe `docs/README.md` als Index)
6. **Relevante `plans/*.md`** der letzten Überarbeitung (Kontext, was zuletzt geändert wurde und warum)

## Nach jeder Aufgabe (Pflicht-Writes)

1. **Version-Bump** in der betroffenen Datei (Frontmatter-Beschreibung + Änderungs-Hinweis im Skill-Body, wo sinnvoll)
2. **`docs/<komponente>.md`** anlegen oder aktualisieren (Zweck, Files, Datenfluss, Schnittstellen, Limitierungen)
3. **Bei Schema-Änderungen:** `docs/state-schema.md` UND `docs/state.schema.json` parallel updaten + Validator-Test-Suite anpassen
4. **Bei Excel-Zell-Vertrag-Änderungen:** `docs/excel_handoff.md` updaten
5. **Bei strukturellen Änderungen:** `docs/ARCHITEKTUR.md` und `README.md` (Repo-Root) nachziehen
6. **Größere Überarbeitungen** als neuer `plans/YYYY-MM-DD-<modul>-<thema>.md` ablegen (Vorlage: `docs/UEBERARBEITUNGS_TEMPLATE.md`)
7. **Commit + Push auf `main`** (Repo `meine-projekte`, Subfolder `Immobilien/Aufteiler/`)

============================================================

## Stack

- **Skill-Format:** Markdown mit YAML-Frontmatter (`name`/`description`) — Claude-Code-konform
- **Ausführungs-Runtime:** Claude Code lokal — Skills werden via `Skill`-Tool dispatcht; Junctions in `~/.claude/skills/`
- **State-Backend:** JSON pro Objekt unter `runs/<slug>/state.json` (gitignored), Schema-Version 1.0
- **Validator:** `python tools/validate_state.py runs/<slug>/state.json` — JSON Schema Draft 2020-12 + Business-Checks (Asset-Trennung)
- **Daten-Backend:** Notion-Datenbanken (Mietspiegel NRW, ImmoWertV, EnEV NRW, Stadt-Marktdaten) — IDs in `README.md`
- **Excel-Maschine:** `template/Kalkulation_Aufteiler_mit_VK_CF.xlsx` (Binary, von Modul 5 via `openpyxl` befüllt)
- **PDF-Generator:** reportlab + matplotlib (Modul 5, Layout-Regeln aus `skills/aufteiler-pdf-export/SKILL.md`)
- **Hosting:** GitHub-Repo `andre-petrov-creator/meine-projekte`, Pfad `Immobilien/Aufteiler/` (case-sensitive)

## Architektur-Prinzipien

- **Module = Inhalt, Form-Skills = Form.** Module-Skills (`aufteiler-modul-N-*`) beschreiben Workflow + Berechnungs-Logik; Form-Skills (`aufteiler-pdf-export`) regeln Layout. Niemals vermischen.
- **Modul-Autarkie.** Jedes Modul-Skill liest aus `state.json`, schreibt seinen Block dorthin, liefert Excel-Zellen gemäß `docs/excel_handoff.md`. Module rufen einander nicht auf — der `aufteiler`-Orchestrator dispatcht.
- **State als Source of Truth.** Werte stehen in `runs/<slug>/state.json`, nicht im Chat. Bei Fragen nach Abschluss: `Read state.json` (oder `modul-N-output.md`-Audit-Trail), niemals aus Chat-Memory antworten.
- **Schema enforced.** JSON-Schema validiert Pflichtfelder, Grenzen, `rnd_frozen=true`, Asset-Trennung. Modul darf nur schreiben, wenn `validate_state.py` exit 0 liefert.
- **Excel rechnet, Module liefern Inputs.** Was Excel via Formel selbst kann, gehört nicht in ein Modul. Module produzieren Werte für definierte Zellen.
- **Asset-Trennung enforced.** Wohnungen, Garagen, Stellplätze NIE in Berechnungen vermischen. Mietsubvention & Rücklage gehören in VERKAUFSMATRIX-Extra-Spalten, NICHT in den Reno-Block (`modul_3.massnahmen_liste`). Validator weist `subvention`/`rücklage` in `massnahmen_liste`-Texten ab.
- **RND-Freeze.** Nach Modul-2-Lauf ist `modul_2.rnd_frozen=true` und `modul_2.rnd_jahre` darf nicht mehr geändert werden (Schema-`const`).
- **Keine Auto-Exports.** Modul 5 (PDF) läuft nur auf explizite User-Anfrage, nie als Teil der Vollanalyse-Sequenz.
- **Freigabe-Pflicht zwischen Modulen.** Orchestrator wartet auf `go`/`weiter`/`ja`/`ok`, bevor das nächste Modul geladen wird.
- **Versionierung sichtbar im Skill.** Inhaltliche Änderung = Anpassung der Beschreibung im Frontmatter + ggf. Versions-Hinweis am Body-Ende.
- **Dual-Mode-Skill `aufteiler-modul-0-quickcheck`.** Läuft in zwei Modi (siehe SKILL.md Abschnitt 0): (a) Orchestrator-Modus (vom aufteiler-Skill aufgerufen, state.json + AskUserQuestion); (b) Akquise-Modus (vom lokalen Akquise-Watcher in ImmoCRM-Pipeline aufgerufen, Ordnerpfad mit PDFs als Eingabe, CHECK24-Tool als Marktwert-Quelle). Bei Änderungen an der Berechnungs-Logik (Abschnitt 3) sicherstellen, dass beide Modi korrekt durchlaufen. Verifikation: lokaler Modul-2-Lauf (Orchestrator-Modus) UND lokaler Akquise-Pipeline-Lauf (Akquise-Modus) — beide grün.

## Konventionen

- **Sprache in Skill-Texten:** Deutsch
- **Sprache in Code/Identifiern (Schema-Keys, Excel-Zellen, Python):** Englisch wo etabliert (`status`, `tiefenstufe`), Deutsch wo fachlich (`baujahr`, `we_liste`)
- **Skill-Naming:** `skills/aufteiler-modul-<N>-<thema>/SKILL.md` (Modul-Skills), `skills/aufteiler-<form>/SKILL.md` (Form-Skills), Plans `plans/YYYY-MM-DD-<modul>-<thema>.md`
- **Pfad-Case:** `Aufteiler/` immer mit großem A in URLs (case-sensitive auf GitHub raw)
- **Keine Emojis** in PDF-Output (siehe `skills/aufteiler-pdf-export/SKILL.md` R5)
- **Slug-Konvention:** kebab-case aus Straße + Hausnummer + Stadt(teil), Umlaute ersetzt (`ä→ae`, `ö→oe`, `ü→ue`, `ß→ss`). Beispiel: `prosperstr-59-essen-dellwig`.

## Skill-Referenzen

Beim Arbeiten an folgenden Themen die zugehörigen Skills laden:

| Aufgabe | Skill |
|---------|-------|
| PDF-Layout / Modul 5 | `skills/aufteiler-pdf-export/SKILL.md` (Pflicht vor jedem PDF-Build) |
| Neue Modul-Überarbeitung planen | `superpowers:writing-plans` + `docs/UEBERARBEITUNGS_TEMPLATE.md` |
| Plan ausführen | `superpowers:executing-plans` (oder `superpowers:subagent-driven-development` bei parallelisierbaren Tasks) |
| Bug in Modul-Output | `superpowers:systematic-debugging` |
| Vor Verifikations-Statements | `superpowers:verification-before-completion` |
| Neuen Skill schreiben | `superpowers:writing-skills` |

============================================================

## Workflow für künftige Überarbeitungen

1. **Sparring** in Claude Code (oder Web-Claude). Output: ein konkreter Überarbeitungs-Plan.
2. **Plan ablegen** als `plans/YYYY-MM-DD-modulN-<thema>.md` (Vorlage: `docs/UEBERARBEITUNGS_TEMPLATE.md`).
3. **Implementierung** Schritt für Schritt — pro Schritt: Skill-Datei ändern, Frontmatter ggf. anpassen, `docs/`-File updaten.
4. **Validator + Tests laufen lassen:** `python tools/validate_state.py runs/<test-slug>/state.json` und `pytest tools/test_validate_state.py`.
5. **Commit + Push.**
6. **Live-Test** in frischer Claude-Code-Session mit echtem Objekt-Case — Modul-Output gegen Akzeptanzkriterium aus dem Plan prüfen.
7. **Plan abhaken** (Status-Block am Ende des Plan-Files setzen).
