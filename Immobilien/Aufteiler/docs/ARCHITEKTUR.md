# Architektur — Aufteiler

Big Picture des MFH-Aufteiler-Workflow-Systems. Detail pro Komponente in den jeweiligen `docs/<komponente>.md`-Files.

============================================================

## Architektur ab 2026-05-12 (Skill-Suite)

Seit 2026-05-12 läuft die Aufteiler-Analyse als **Markdown-Skill-Suite in Claude Code** (vorher: XML-Module in Web-Claude, siehe Sektion „Architektur vor 2026-05-12" unten — **veraltet, nur Rollback-Quelle**).

```
┌──────────────────────────────────────────────────────────────────┐
│  Claude Code (lokal)                                             │
│  - User triggert Skill "aufteiler" (Orchestrator)                │
│  - Skills sichtbar via Junctions ~/.claude/skills/aufteiler*     │
└─────────────────────────┬────────────────────────────────────────┘
                          │
                          │ Skill-Tool dispatcht Sub-Skills
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  Skill-Suite (skills/)                                           │
│                                                                  │
│  ├─ aufteiler/                       Orchestrator (Dispatcher)   │
│  ├─ aufteiler-modul-0-quickcheck/    Angebot vs. ETW-Konsens     │
│  ├─ aufteiler-modul-1-objektbasis/   WE-Liste, BRW, Gebäudeanteil│
│  ├─ aufteiler-modul-2-rnd-afa/       RND + AfA (rnd_frozen)      │
│  ├─ aufteiler-modul-3-massnahmen/    Reno-Kosten + RND-Gutachten │
│  ├─ aufteiler-modul-4-miete/         Mietspiegel + §558 + Subv.  │
│  ├─ aufteiler-modul-5-deal-bewertung/Score + PDF + Excel-Befüllg.│
│  └─ aufteiler-pdf-export/            Form-Skill für Modul 5      │
└─────────────────────────┬────────────────────────────────────────┘
                          │
            ┌─────────────┼─────────────┬──────────────────┐
            ▼             ▼             ▼                  ▼
┌──────────────────┐ ┌──────────┐ ┌──────────────┐ ┌───────────────┐
│  Notion-DBs      │ │  Excel   │ │  state.json  │ │  PDF (M5 only)│
│  (read-only)     │ │  Template│ │  pro Objekt  │ │  reportlab    │
│                  │ │  pro Obj.│ │  unter       │ │  +matplotlib  │
│  Mietspiegel NRW │ │  kopiert │ │  runs/<slug>/│ │  → Aufteiler_ │
│  ImmoWertV       │ │ befüllt  │ │ JSON-Schema  │ │   <…>.pdf     │
│  EnEV NRW        │ │ via      │ │ validiert    │ └───────────────┘
│  Stadt-Marktdat. │ │ openpyxl │ │ (jsonschema) │
└──────────────────┘ └──────────┘ └──────────────┘
```

============================================================

## Komponenten-Verantwortlichkeiten

### Orchestrator (`skills/aufteiler/SKILL.md`)

- **Modus erkennen** aus User-Input (`vollanalyse`, `nur_quickcheck`, `nur_export` etc.)
- **State init / laden** unter `runs/<slug>/state.json`
- **Sub-Skills via `Skill`-Tool dispatchen** (kein Inline-Code, kein Modul-zu-Modul-Aufruf)
- **Freigaben einholen** zwischen Modulen (`go`/`weiter`/`ja`/`ok`)
- **Rechnet selbst NICHTS**, interpretiert Modul-Outputs nicht.

### Module (`skills/aufteiler-modul-N-*/SKILL.md`)

Jedes Modul liest aus `state.json` (definierte Vorgänger-Felder), erzeugt drei Zonen:
- **Zone A** — Daten-Block in pixel-identischer Tabellen-Form (reproduzierbar)
- **Zone B** — Tiefenstufen-Deklaration (genau zwei Zeilen, byte-identisch)
- **Zone C** — Begründung (Struktur fix: Annahmen / Risiken / Empfehlung; Formulierung frei)

Schreibt eigenen `modul_N`-Block in `state.json` (komplettes Objekt, nicht patchen). Module rufen einander nicht auf — der Orchestrator sequenziert.

### Skills (Form / Layout)

`aufteiler-pdf-export` (Form-Skill): reportlab-Layout-Regeln R1–R13 (Spaltenbreiten, Word-Wrap, Farbpalette, keine Emojis). Wird ausschließlich von Modul 5 aufgerufen. Modul 5 bleibt für Inhalt zuständig, der Form-Skill für Layout.

### State (`runs/<slug>/state.json`)

Persistenter Daten-Container pro Objekt. Schema-Version `1.0`, validiert via:
- **Markdown-Doku:** `docs/state-schema.md`
- **JSON Schema (maschinell):** `docs/state.schema.json` (Draft 2020-12)
- **CLI-Validator:** `python tools/validate_state.py runs/<slug>/state.json`

Schema-Constraints enforced:
- `modul_2.rnd_frozen === true` — Schema-`const`, Modul 3/5 können RND nicht überschreiben
- Asset-Trennung: `modul_3.massnahmen_liste[]` enthält kein `subvention`/`rücklage`/`ruecklage`
- Plausibilitäts-Grenzen (BRW > 0, RND 20–80, AfA 0–10 %, Mod-Score 0–100, etc.)

`runs/` ist **gitignored** (enthält personenbezogene Mieter-Daten + Adressen).

### Excel-Template (`template/Kalkulation_Aufteiler_mit_VK_CF.xlsx`)

Die eigentliche Rechen-Maschine. Modul 5 kopiert das Template nach `runs/<slug>/Kalkulation_<Straßenkurz>.xlsx` und befüllt definierte Zellen via `openpyxl`. Excel-Formeln rechnen Multiplikationen, Summen, §559-Umlage etc. Zell-Verträge in [`docs/excel_handoff.md`](excel_handoff.md).

### Notion-DBs (read-only)

Nachschlagewerke für Mietspiegel, RND-Regelwerk, Energetik-Massnahmen, Stadt-Marktdaten. Page-IDs in [`../README.md`](../README.md). Werden modulintern referenziert (über MCP), niemals beschrieben.

============================================================

## Vollanalyse-Sequenz

```
User-Trigger ("Vollanalyse <Objekt>")
       │
       ▼
[Orchestrator erkennt Modus, init State runs/<slug>/state.json]
       │
       ▼
Modul 0 (Quick-Check) ──► (Freigabe go/weiter?) ──► Modul 1 (Objektbasis)
                                                       │
                                                  (Freigabe?)
                                                       │
   Modul 2 (RND/AfA, rnd_frozen=true) ◄────────────────┘
       │
  (Freigabe?)
       │
       ▼
   Modul 3 (Massnahmen, Asset-Trennung enforced)
       │
  (Freigabe?)
       │
       ▼
   Modul 4 (Miete, Option C: M6 vor Sanierung)
       │
  (Freigabe?)
       │
       ▼
[Orchestrator: "PDF-Export gewünscht?"]
       │
       ├── ja ──► Modul 5 (Score + PDF + Excel-Befüllung)
       └── nein ─► Sequenz-Ende
```

**Modul 5 ist NIE Teil der automatischen Sequenz** — nur explizit auf Anfrage oder nach finaler Bestätigung am Sequenz-Ende.

============================================================

## Daten-Verträge (Schnittstellen-Übersicht)

| Modul | Liest aus State | Schreibt nach State | Schreibt nach Excel | Notion-DBs |
|-------|-----------------|---------------------|---------------------|------------|
| M0 | `objekt` | `modul_0` | – | Stadt-Marktdaten (optional) |
| M1 | `objekt`, `modul_0.status` | `modul_1` | (via M5) MIETER A8..I, KALKU | BORIS.NRW (User-manuell) |
| M2 | `modul_1.we_liste` | `modul_2` (mit `rnd_frozen=true`) | (via M5) KALKU C26..C28 | ImmoWertV RND-Regelwerk |
| M3 | `modul_1.we_liste`, `modul_2.rnd_*` | `modul_3` | (via M5) RENO-Block | EnEV NRW |
| M4 | `modul_1.we_liste`, `modul_2.mod_score` (optional) | `modul_4` | (via M5) MIETER M6/P6/Y, RENO!K105 | Mietspiegel NRW |
| M5 | alle `modul_0..4` | `modul_5` (Score, PDF-Pfad, Excel-Pfad) | befüllt Excel-Kopie, schreibt PDF | – |

Detail-Verträge (welche Zelle, welcher Typ) in [`docs/excel_handoff.md`](excel_handoff.md).

============================================================

## Versionierungs-Strategie auf System-Ebene

- **Skills versionieren unabhängig.** v1.0 für Module 0–5, v1.2 für `aufteiler-pdf-export`. Der Orchestrator ist agnostisch — er dispatcht via Skill-Name ohne Version-Pin.
- **State-Schema-Bumps** (z.B. v1.1 für neue Felder) werden in `docs/state-schema.md` versioniert. State-Migration via separates Skript falls nötig (bisher keine Migrationen).
- **Breaking Change in einem Modul** = Major-Bump in dem Modul + Hinweis im Skill-Header, ggf. Schema-Bump wenn Schreib-Vertrag betroffen.
- **PDF-Form-Skill-Bump** muss in Modul 5 erwähnt werden (Modul referenziert Form-Skill ohne Version, aber Form-Erwartung steht im Modul-Header).

============================================================

## Architektur vor 2026-05-12 (XML-Module / Web-Claude) — **Veraltet**

Vorher lief das System als XML-Modul-Suite, geladen per `web_fetch` von Web-Claude (claude.ai-Projekt „Aufteiler"). Module: `orchestrator.xml`, `modul_0_quickcheck.xml`, …, `modul_5_verdict.xml`, plus `skill_pdf_export.md`. Quelle: GitHub-Repo, `web_fetch` von `raw.githubusercontent.com`.

Alle XML-Module wurden per `git mv` nach `archive/` migriert; Historie via `git log archive/<datei>` rekonstruierbar. Diese Architektur ist **veraltet** und sollte nicht mehr verwendet werden — siehe `archive/` als Rollback-Quelle.

Wesentliche Unterschiede neue vs. alte Architektur:
- **State**: neu `runs/<slug>/state.json` JSON, alt: Chat-Kontext (volatil, nicht reproduzierbar nach Compression)
- **Modul-Dispatch**: neu Skill-Tool, alt: `web_fetch` von GitHub
- **Validation**: neu JSON-Schema-Validator + Asset-Trennung-Business-Check, alt: nur Modul-interne Self-Checks
- **Sichtbarkeit**: neu Junctions in `~/.claude/skills/`, alt: keine — Modul-Aufrufe gingen direkt durch `web_fetch`
