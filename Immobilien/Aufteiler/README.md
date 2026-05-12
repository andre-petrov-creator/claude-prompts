# Aufteiler-Workflow (MFH-Aufteiler-Analyse)

Dieser Ordner enthält die **Skill-Suite** für die MFH-Aufteiler-Analyse (NRW/Ruhrgebiet). Seit 2026-05-12 läuft die Analyse als Markdown-Skill-Suite in Claude Code; die alten XML-Module sind unter `archive/` als Rollback-Quelle erhalten.

## Skill-Suite (ab 2026-05-12)

Aufteiler läuft als Markdown-Skill-Suite in Claude Code:
- **Orchestrator:** [`skills/aufteiler/SKILL.md`](skills/aufteiler/SKILL.md) — Modus-Erkennung, State-Init, Modul-Dispatch, Freigabe-Gate
- **Module 0–5:** `skills/aufteiler-modul-N-*/SKILL.md` (siehe Tabelle unten)
- **PDF-Form-Skill:** [`skills/aufteiler-pdf-export/SKILL.md`](skills/aufteiler-pdf-export/SKILL.md) — reportlab-Layout-Regeln R1–R13

**Persistenter State pro Objekt:** `runs/<slug>/state.json` (gitignored — enthält Adressen, Mieter-Daten, Werte).
- Schema-Doku: [`docs/state-schema.md`](docs/state-schema.md)
- Validierbares JSON-Schema: [`docs/state.schema.json`](docs/state.schema.json)
- CLI-Validator: `python tools/validate_state.py runs/<slug>/state.json`

**Excel-Zell-Verträge:** [`docs/excel_handoff.md`](docs/excel_handoff.md) (welches Modul welche Zelle schreibt).

### Skill-Sichtbarkeit in Claude Code (Windows-Junctions)

Setup einmalig pro Maschine:
```powershell
.\setup-junctions.ps1
```
Erzeugt 8 Junctions unter `~/.claude/skills/aufteiler*` → Aufteiler-Repo.

## Einstieg für Überarbeitungen

Vor jeder Änderung an Skills, Modul-Logik oder dem Excel-Template lesen:

1. [`CLAUDE.md`](CLAUDE.md) — Steuerungsdatei: Pflicht-Reads vor / Pflicht-Writes nach jeder Aufgabe
2. [`DEVELOPMENT_GUIDELINES.md`](DEVELOPMENT_GUIDELINES.md) — Konventionen, Format-Regeln, Versionierung
3. [`docs/ARCHITEKTUR.md`](docs/ARCHITEKTUR.md) — Big Picture
4. [`docs/README.md`](docs/README.md) — Index der Komponenten-Doku
5. [`plans/`](plans/) — letzte Überarbeitungs-Plans (Vorlage: [`docs/UEBERARBEITUNGS_TEMPLATE.md`](docs/UEBERARBEITUNGS_TEMPLATE.md))

## Module / Skills (Skill-Suite)

| ID | Skill | Zweck | Schema-Feld |
|----|-------|-------|-------------|
| – | [`skills/aufteiler/`](skills/aufteiler/SKILL.md) | Orchestrator — Modus-Erkennung, State-Init, Sub-Skill-Dispatch, Freigabe-Gate | — |
| 0 | [`skills/aufteiler-modul-0-quickcheck/`](skills/aufteiler-modul-0-quickcheck/SKILL.md) | Quick-Check: Angebotspreis vs. ETW-Konsens, Gap-Schwelle 5 % | `modul_0` |
| 1 | [`skills/aufteiler-modul-1-objektbasis/`](skills/aufteiler-modul-1-objektbasis/SKILL.md) | Objektbasis: BRW, Gebäudeanteil, WE-Liste | `modul_1` |
| 2 | [`skills/aufteiler-modul-2-rnd-afa/`](skills/aufteiler-modul-2-rnd-afa/SKILL.md) | RND und AfA (ImmoWertV Anlage 2, `rnd_frozen=true` enforced) | `modul_2` |
| 3 | [`skills/aufteiler-modul-3-massnahmen/`](skills/aufteiler-modul-3-massnahmen/SKILL.md) | Sanierungs-/Modernisierungskosten + RND-Gutachten + WEG-Teilung (Asset-Trennung enforced) | `modul_3` |
| 4 | [`skills/aufteiler-modul-4-miete/`](skills/aufteiler-modul-4-miete/SKILL.md) | Mietsituation (Mietspiegel, §558-Heberecht, Mietsubvention, Option C) | `modul_4` |
| 5 | [`skills/aufteiler-modul-5-deal-bewertung/`](skills/aufteiler-modul-5-deal-bewertung/SKILL.md) | Deal-Bewertung + PDF-Export + Excel-Befüllung (Score Platzhalter) | `modul_5` |
| – | [`skills/aufteiler-pdf-export/`](skills/aufteiler-pdf-export/SKILL.md) | PDF-Form-Skill (R1–R13 Layout-Regeln) — nur von Modul 5 aufgerufen | — |

## Vollanalyse-Sequenz

`0 → 1 → 2 → 3 → 4` (Modul 5 nur auf explizite User-Anfrage am Ende).

Zwischen jedem Modul wartet der Orchestrator auf Freigabe (`go`, `weiter`, `ja`, `ok`).

## Daten-Quellen (Notion)

- Mietspiegel NRW (DS): `8b000923-d5ee-45a4-8f6a-e7f3bf81f20e`
- ImmoWertV 2021 RND-Regelwerk (Page): `3360ae59-38e4-81a6-a632-f0715b46ead4`
- EnEV NRW (DS): `50c75486-37ec-45fa-a243-d0a486206f20`
- Preisdatenbank Stadt-Marktdaten (Page): `3310ae59-38e4-81f1-ad36-e8bd809d437a`

## Excel-Handoff

**Vorlage (Master):** [`template/Kalkulation_Aufteiler_mit_VK_CF.xlsx`](template/Kalkulation_Aufteiler_mit_VK_CF.xlsx)

Pro Objekt wird das Template von Modul 5 nach `runs/<slug>/Kalkulation_<Straßenkurz>.xlsx` kopiert und via `openpyxl` befüllt (Zell-Verträge in [`docs/excel_handoff.md`](docs/excel_handoff.md)).

## Archiv (Rollback-Quelle)

Vorherige XML-basierte Web-Claude-Lösung: [`archive/`](archive/). Alte XMLs (`modul_*.xml`, `orchestrator.xml`, `skill_pdf_export.md`) wurden per `git mv` migriert, Historie via `git log` zugänglich.
