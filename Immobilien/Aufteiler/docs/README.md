# Docs — Aufteiler

Lebende Dokumentation des aktuellen Stands aller Komponenten. Wird bei jeder Skill-Änderung mitgepflegt (Pflicht aus `CLAUDE.md`).

Pläne und historische Iterationen liegen in `../plans/`, **nicht** hier.

============================================================

## Wegweiser

| Was du suchst | Datei |
|---------------|-------|
| Big Picture (Orchestrator + Module + Skills + State + Excel + Notion) | [`ARCHITEKTUR.md`](ARCHITEKTUR.md) |
| State-Schema (lesbar) | [`state-schema.md`](state-schema.md) |
| State-Schema (maschinell, JSON Schema Draft 2020-12) | [`state.schema.json`](state.schema.json) |
| Excel-Zell-Verträge pro Modul | [`excel_handoff.md`](excel_handoff.md) |
| Modul-Skill-Template (Sektionen 1/5/6/7 byte-identisch) | [`_TEMPLATE_MODUL_SKILL.md`](_TEMPLATE_MODUL_SKILL.md) |
| Vorlage für Komponenten-Doku | [`_TEMPLATE_KOMPONENTE.md`](_TEMPLATE_KOMPONENTE.md) |
| Vorlage für Überarbeitungs-Plan (für `../plans/`) | [`UEBERARBEITUNGS_TEMPLATE.md`](UEBERARBEITUNGS_TEMPLATE.md) |

============================================================

## Skill-Suite-Index

Status-Legende: ✓ = ausgeschrieben & getestet · ○ = Stub · — = noch nicht angelegt

| Skill | Datei | Schema-Feld | Status |
|-------|-------|-------------|--------|
| Orchestrator | [`../skills/aufteiler/SKILL.md`](../skills/aufteiler/SKILL.md) | — | ✓ |
| Modul 0 — Quick-Check | [`../skills/aufteiler-modul-0-quickcheck/SKILL.md`](../skills/aufteiler-modul-0-quickcheck/SKILL.md) | `modul_0` | ✓ |
| Modul 1 — Objektbasis | [`../skills/aufteiler-modul-1-objektbasis/SKILL.md`](../skills/aufteiler-modul-1-objektbasis/SKILL.md) | `modul_1` | ✓ |
| Modul 2 — RND und AfA | [`../skills/aufteiler-modul-2-rnd-afa/SKILL.md`](../skills/aufteiler-modul-2-rnd-afa/SKILL.md) | `modul_2` (`rnd_frozen=true`) | ✓ |
| Modul 3 — Massnahmen | [`../skills/aufteiler-modul-3-massnahmen/SKILL.md`](../skills/aufteiler-modul-3-massnahmen/SKILL.md) | `modul_3` (Asset-Trennung) | ✓ |
| Modul 4 — Mietsituation | [`../skills/aufteiler-modul-4-miete/SKILL.md`](../skills/aufteiler-modul-4-miete/SKILL.md) | `modul_4` | ✓ |
| Modul 5 — Deal-Bewertung | [`../skills/aufteiler-modul-5-deal-bewertung/SKILL.md`](../skills/aufteiler-modul-5-deal-bewertung/SKILL.md) | `modul_5` (Score Platzhalter) | ✓ |
| PDF-Form-Skill (R1–R13) | [`../skills/aufteiler-pdf-export/SKILL.md`](../skills/aufteiler-pdf-export/SKILL.md) | — | ✓ |

============================================================

## State / Validator

| Datei | Zweck |
|-------|-------|
| [`state-schema.md`](state-schema.md) | Lesbare Schema-Doku v1.0 (Top-Level + alle Modul-Blöcke) |
| [`state.schema.json`](state.schema.json) | JSON Schema Draft 2020-12 (von `tools/validate_state.py` konsumiert) |
| `../tools/validate_state.py` | CLI-Validator: Schema + Business-Checks (Asset-Trennung in `modul_3.massnahmen_liste`) |
| `../tools/test_validate_state.py` | pytest-Suite mit 5 Testfällen (minimal valid, missing fields, slug pattern, rnd_frozen, asset-trennung) |

State-Dateien selbst (`../runs/<slug>/state.json`) sind **gitignored** (enthalten personenbezogene Daten).

============================================================

## Komponenten-Doku (alt, einige stehen, einige sind veraltet)

| Komponente | Datei | Status |
|------------|-------|--------|
| Modul 1 alt (XML) | [`modul_1_objektbasis.md`](modul_1_objektbasis.md) | (alt, vor Skill-Suite) |
| Modul 5 alt (XML) | [`modul_5_verdict.md`](modul_5_verdict.md) | (alt, vor Skill-Suite) |
| Skill PDF-Export alt | [`skill_pdf_export.md`](skill_pdf_export.md) | (alt, vor Skill-Suite) |

Die obigen Doku-Dateien beziehen sich auf die **alten XML-Module** in `../archive/`. Die neue Skill-Suite ist im Skill selbst dokumentiert (Frontmatter + Inhalts-Sektionen). Wenn nötig wird Skill-Doku separat ergänzt — bisher reicht der Skill-Inhalt als Quelle.

============================================================

## Doku-Pflicht-Sektionen (aus Template)

Jede Komponenten-Doku enthält:

1. **Zweck** — was tut die Komponente, in 2-3 Sätzen
2. **Files** — welche Dateien gehören dazu
3. **Datenfluss** — Inputs → Verarbeitung → Outputs
4. **Schnittstellen** — Excel-Zellen, State-Felder, Notion-Reads, Skill-Verweise
5. **Bekannte Limitierungen** — Edge-Cases, TODOs, technische Schulden
