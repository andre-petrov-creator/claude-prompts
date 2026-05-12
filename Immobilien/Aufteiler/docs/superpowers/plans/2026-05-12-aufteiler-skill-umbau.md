# Aufteiler-Skill-Umbau Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migration des Aufteiler-Workflows von XML-Modulen (Web-Claude) zu einer Markdown-Skill-Suite (Claude Code), mit persistentem State pro Objekt und reproduzierbarem Output.

**Architektur:** Ein Orchestrator-Skill dispatcht via `Skill`-Tool zu sechs Modul-Sub-Skills plus PDF-Form-Skill. Persistenter State pro Objekt unter `runs/<slug>/state.json`. Module folgen einem einheitlichen Template (State laden → Inputs → Berechnung → State persistieren → Self-Check). Drei Output-Zonen pro Modul (A pixel-identisch, B Tiefenstufen-Deklaration, C freie Begründung) machen Outputs diff-bar.

**Tech-Stack:** Markdown-Skills mit YAML-Frontmatter; JSON Schema (Ajv-kompatibel) für State-Validierung; Python `jsonschema` für lokale Validierung; PowerShell-Junction für Skills-Sichtbarkeit; bestehende `template/Kalkulation_…xlsx` als Excel-Maschine; `reportlab`+`matplotlib` für PDF (übernommen aus Modul 5 alt).

**Spec:** [docs/superpowers/specs/2026-05-12-aufteiler-skill-umbau-design.md](../specs/2026-05-12-aufteiler-skill-umbau-design.md)

---

## Datei-Struktur (Endzustand)

```
c:\meine-projekte\Immobilien\Aufteiler\
├── skills\
│   ├── aufteiler\SKILL.md                          ← Orchestrator
│   ├── aufteiler-modul-0-quickcheck\SKILL.md
│   ├── aufteiler-modul-1-objektbasis\SKILL.md
│   ├── aufteiler-modul-2-rnd-afa\SKILL.md
│   ├── aufteiler-modul-3-massnahmen\SKILL.md
│   ├── aufteiler-modul-4-miete\SKILL.md
│   ├── aufteiler-modul-5-deal-bewertung\SKILL.md
│   └── aufteiler-pdf-export\SKILL.md               ← Form-Skill
├── archive\                                         ← alte XMLs (Rollback)
│   ├── orchestrator.xml
│   └── modul_*.xml
├── runs\                                            ← .gitignore'd
│   └── .gitkeep
├── docs\
│   ├── state-schema.md                              ← Schema-Doku
│   ├── state.schema.json                            ← validierbares JSON-Schema
│   ├── excel_handoff.md                             ← Zell-Verträge
│   ├── _TEMPLATE_MODUL_SKILL.md                     ← Modul-Template
│   ├── ARCHITEKTUR.md                               ← aktualisiert in Phase 4
│   └── README.md                                    ← Index, aktualisiert
├── tools\
│   └── validate_state.py                            ← CLI-Validator
├── setup-junctions.ps1
└── .gitignore                                       ← `runs/` ausschließen
```

**Verantwortlichkeit pro Datei:**
- `skills/aufteiler/SKILL.md`: Stumpfer Dispatcher — Modus-Erkennung, Todo-Liste, State-Init, ruft Sub-Skills auf, holt Freigabe.
- `skills/aufteiler-modul-N-*/SKILL.md`: Eine Domäne (Quickcheck/Basis/RND-AfA/Massnahmen/Miete/Deal-Bewertung). State laden, Inputs, Rechnen, State schreiben, Self-Check.
- `skills/aufteiler-pdf-export/SKILL.md`: Form-Skill mit reportlab-Layout-Regeln, übersetzt aus `skill_pdf_export.md`.
- `docs/state-schema.md` (Doku) + `docs/state.schema.json` (Maschine): zwei Sichten auf dasselbe Schema.
- `tools/validate_state.py`: CLI für JSON-Schema-Check (von Modulen aufrufbar via Bash).
- `setup-junctions.ps1`: Erzeugt Junctions `~/.claude/skills/aufteiler*` → Aufteiler-Repo.

---

## Phase 1 — Fundament

Ziel: Skill-Ordner existieren als leere, registrierbare Stubs; State-Schema steht; Junction zeigt; Smoke-Test grün.

### Task 1: Archive-Ordner und Move alter XMLs

**Files:**
- Create: `archive/.gitkeep`
- Move: `orchestrator.xml` → `archive/orchestrator.xml`
- Move: `modul_0_quickcheck.xml` → `archive/modul_0_quickcheck.xml`
- Move: `modul_1_objektbasis.xml` → `archive/modul_1_objektbasis.xml`
- Move: `modul_2_massnahmen.xml` → `archive/modul_2_massnahmen.xml`
- Move: `modul_3_rnd_afa.xml` → `archive/modul_3_rnd_afa.xml`
- Move: `modul_4_miete.xml` → `archive/modul_4_miete.xml`
- Move: `modul_5_verdict.xml` → `archive/modul_5_verdict.xml`
- Move: `skill_pdf_export.md` → `archive/skill_pdf_export.md`

- [ ] **Step 1.1: Archive-Ordner anlegen**

```bash
mkdir -p archive
touch archive/.gitkeep
```

- [ ] **Step 1.2: Alle XMLs + alten PDF-Skill per `git mv` verschieben (Historie erhalten)**

```bash
cd c:/meine-projekte/Immobilien/Aufteiler
git mv orchestrator.xml archive/orchestrator.xml
git mv modul_0_quickcheck.xml archive/modul_0_quickcheck.xml
git mv modul_1_objektbasis.xml archive/modul_1_objektbasis.xml
git mv modul_2_massnahmen.xml archive/modul_2_massnahmen.xml
git mv modul_3_rnd_afa.xml archive/modul_3_rnd_afa.xml
git mv modul_4_miete.xml archive/modul_4_miete.xml
git mv modul_5_verdict.xml archive/modul_5_verdict.xml
git mv skill_pdf_export.md archive/skill_pdf_export.md
```

Expected: `git status` zeigt 8 Rename-Einträge.

- [ ] **Step 1.3: Verifizieren — Datei-Liste im Root nur noch ohne XMLs**

Run: `ls c:/meine-projekte/Immobilien/Aufteiler/ | grep -E "\.xml$"`
Expected: leere Ausgabe.

- [ ] **Step 1.4: Commit**

```bash
git add archive/
git commit -m "Aufteiler: alte XMLs in archive/ (Rollback-Quelle, Historie via git mv erhalten)"
```

---

### Task 2: `.gitignore` für `runs/` und `runs/`-Ordner

**Files:**
- Create: `c:\meine-projekte\Immobilien\Aufteiler\.gitignore`
- Create: `c:\meine-projekte\Immobilien\Aufteiler\runs\.gitkeep`

- [ ] **Step 2.1: Lokale `.gitignore` schreiben (überschreibt Root-.gitignore NICHT — wird zusätzlich angewendet)**

Inhalt von `c:\meine-projekte\Immobilien\Aufteiler\.gitignore`:

```
# Objekt-Daten gehören nicht ins Repo (persönliche Adressen, Mietverträge, PDFs)
runs/*
!runs/.gitkeep
```

- [ ] **Step 2.2: `runs/`-Ordner mit `.gitkeep` anlegen**

```bash
mkdir -p runs
touch runs/.gitkeep
```

- [ ] **Step 2.3: Verifizieren — `.gitkeep` getrackt, sonst nichts**

Run: `git status runs/`
Expected: `runs/.gitkeep` als untracked. Wenn man manuell `touch runs/test.json` macht und nochmal `git status runs/` — `test.json` darf NICHT auftauchen.

```bash
touch runs/_ignored_test.json
git check-ignore -v runs/_ignored_test.json
rm runs/_ignored_test.json
```

Expected aus `git check-ignore`: zeigt Match auf `.gitignore` Zeile 2. Wenn keine Ausgabe → `.gitignore` greift nicht, fix.

- [ ] **Step 2.4: Commit**

```bash
git add .gitignore runs/.gitkeep
git commit -m "Aufteiler: runs/ als objekt-lokaler State (gitignored)"
```

---

### Task 3: Acht leere Skill-Stubs anlegen

**Files (alle Create):**
- `skills/aufteiler/SKILL.md`
- `skills/aufteiler-modul-0-quickcheck/SKILL.md`
- `skills/aufteiler-modul-1-objektbasis/SKILL.md`
- `skills/aufteiler-modul-2-rnd-afa/SKILL.md`
- `skills/aufteiler-modul-3-massnahmen/SKILL.md`
- `skills/aufteiler-modul-4-miete/SKILL.md`
- `skills/aufteiler-modul-5-deal-bewertung/SKILL.md`
- `skills/aufteiler-pdf-export/SKILL.md`

- [ ] **Step 3.1: Orchestrator-Stub schreiben**

Inhalt `skills/aufteiler/SKILL.md`:

```markdown
---
name: aufteiler
description: Orchestrator für die MFH-Aufteiler-Analyse. Trigger bei "Aufteiler", "Vollanalyse MFH", "Quick-Check Aufteiler", "Mietsituation prüfen MFH", "Aufteiler RND", "Aufteiler Massnahmen", "Deal-Bewertung Aufteiler", "PDF-Export Aufteiler". Erkennt Modus, legt State an, dispatcht Modul-Skills, holt Freigabe.
---

# Aufteiler-Orchestrator (Stub)

Phase 1: Skeleton. Inhalt wird in Phase 2 ausgeschrieben.

STOPP — dieser Skill ist noch ein Stub. Bitte Antwort: "Skill aufteiler ist noch nicht implementiert (Phase 2)."
```

- [ ] **Step 3.2: Sieben Modul-Stubs schreiben (identisches Muster, nur Name/Description anpassen)**

Inhalt `skills/aufteiler-modul-0-quickcheck/SKILL.md`:

```markdown
---
name: aufteiler-modul-0-quickcheck
description: Modul 0 der Aufteiler-Analyse — Quick-Check (Angebotspreis vs. ETW-Konsens, Gap-Prüfung). Wird ausschließlich vom aufteiler-Orchestrator aufgerufen, nicht direkt durch User.
---

# Modul 0 — Quick-Check (Stub)

Phase 1: Skeleton. Inhalt in Phase 2.

STOPP — Stub. Antwort: "Modul 0 noch nicht implementiert."
```

Inhalt `skills/aufteiler-modul-1-objektbasis/SKILL.md`:

```markdown
---
name: aufteiler-modul-1-objektbasis
description: Modul 1 der Aufteiler-Analyse — Objektbasis (BRW, Gebäudeanteil, WE-Liste). Wird ausschließlich vom aufteiler-Orchestrator aufgerufen.
---

# Modul 1 — Objektbasis (Stub)

Phase 1: Skeleton. Inhalt in Phase 3.

STOPP — Stub. Antwort: "Modul 1 noch nicht implementiert."
```

Inhalt `skills/aufteiler-modul-2-rnd-afa/SKILL.md`:

```markdown
---
name: aufteiler-modul-2-rnd-afa
description: Modul 2 der Aufteiler-Analyse — Restnutzungsdauer und AfA (ImmoWertV-basiert, mit rnd_frozen-Mechanik). Wird ausschließlich vom aufteiler-Orchestrator aufgerufen.
---

# Modul 2 — RND und AfA (Stub)

Phase 1: Skeleton. Inhalt in Phase 3.

STOPP — Stub. Antwort: "Modul 2 noch nicht implementiert."
```

Inhalt `skills/aufteiler-modul-3-massnahmen/SKILL.md`:

```markdown
---
name: aufteiler-modul-3-massnahmen
description: Modul 3 der Aufteiler-Analyse — Sanierungs-/Modernisierungskosten inkl. RND-Gutachten und WEG-Teilung als Reno-Positionen. Wird ausschließlich vom aufteiler-Orchestrator aufgerufen.
---

# Modul 3 — Massnahmen (Stub)

Phase 1: Skeleton. Inhalt in Phase 3.

STOPP — Stub. Antwort: "Modul 3 noch nicht implementiert."
```

Inhalt `skills/aufteiler-modul-4-miete/SKILL.md`:

```markdown
---
name: aufteiler-modul-4-miete
description: Modul 4 der Aufteiler-Analyse — Mietsituation (Mietspiegel, §558-Heberecht, Mietsubvention). Tiefenstufen 1–6. Wird ausschließlich vom aufteiler-Orchestrator aufgerufen.
---

# Modul 4 — Mietsituation (Stub)

Phase 1: Skeleton. Inhalt in Phase 3.

STOPP — Stub. Antwort: "Modul 4 noch nicht implementiert."
```

Inhalt `skills/aufteiler-modul-5-deal-bewertung/SKILL.md`:

```markdown
---
name: aufteiler-modul-5-deal-bewertung
description: Modul 5 der Aufteiler-Analyse — Deal-Bewertung mit PDF-Export und Excel-Befüllung. Konsumiert State aus Modul 0–4. Wird ausschließlich vom aufteiler-Orchestrator aufgerufen.
---

# Modul 5 — Deal-Bewertung (Stub)

Phase 1: Skeleton. Inhalt in Phase 4.

STOPP — Stub. Antwort: "Modul 5 noch nicht implementiert."
```

Inhalt `skills/aufteiler-pdf-export/SKILL.md`:

```markdown
---
name: aufteiler-pdf-export
description: Form-Skill für den PDF-Export von Modul 5. Liefert reportlab-Layout-Regeln (Spaltenbreiten, Farben, Word-Wrap, kein Emoji). Wird ausschließlich von aufteiler-modul-5-deal-bewertung aufgerufen.
---

# PDF-Export-Form (Stub)

Phase 1: Skeleton. Inhalt in Phase 4 (übersetzt aus archive/skill_pdf_export.md).

STOPP — Stub. Antwort: "PDF-Export-Skill noch nicht implementiert."
```

- [ ] **Step 3.3: Verifizieren — alle 8 Skill-Dateien existieren**

Run: `ls skills/*/SKILL.md`
Expected: 8 Zeilen, je `skills/<name>/SKILL.md`.

- [ ] **Step 3.4: Commit**

```bash
git add skills/
git commit -m "Aufteiler Skill-Suite: 8 Skill-Stubs (Orchestrator + 6 Module + PDF-Form)"
```

---

### Task 4: Junction-Setup-Skript und einmaliger Lauf

**Files:**
- Create: `setup-junctions.ps1`

- [ ] **Step 4.1: Skript schreiben**

Inhalt `setup-junctions.ps1`:

```powershell
# setup-junctions.ps1
# Erzeugt Windows-Junctions von ~/.claude/skills/<name> → Aufteiler-Repo skills/<name>.
# Einmalig laufen. Idempotent: existierende Junctions werden übersprungen.

$src = "C:\meine-projekte\Immobilien\Aufteiler\skills"
$dst = "C:\Users\andre\.claude\skills"

if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Path $dst | Out-Null }

Get-ChildItem $src -Directory | ForEach-Object {
    $target = Join-Path $dst $_.Name
    if (Test-Path $target) {
        Write-Host "SKIP (existiert): $target"
    } else {
        cmd /c mklink /J "$target" "$($_.FullName)" | Out-Null
        Write-Host "OK:   $target → $($_.FullName)"
    }
}
```

- [ ] **Step 4.2: Skript einmalig ausführen**

```powershell
powershell -ExecutionPolicy Bypass -File setup-junctions.ps1
```

Expected: 8× `OK:` Zeilen (oder `SKIP` falls schon vorhanden).

- [ ] **Step 4.3: Verifizieren — Junctions zeigen auf Aufteiler-Repo**

```powershell
Get-ChildItem C:\Users\andre\.claude\skills\aufteiler* | Select-Object Name, Target
```

Expected: 8 Zeilen, Target zeigt jeweils auf `C:\meine-projekte\Immobilien\Aufteiler\skills\…`.

- [ ] **Step 4.4: Commit**

```bash
git add setup-junctions.ps1
git commit -m "Aufteiler: setup-junctions.ps1 für ~/.claude/skills-Sichtbarkeit"
```

---

### Task 5: State-Schema (Markdown-Doku + JSON-Schema-Datei)

**Files:**
- Create: `docs/state-schema.md`
- Create: `docs/state.schema.json`

- [ ] **Step 5.1: Lesbare Doku `docs/state-schema.md`**

Inhalt:

````markdown
# State-Schema (`runs/<slug>/state.json`)

**Schema-Version:** 1.0
**Validator-Datei:** `docs/state.schema.json` (JSON Schema Draft 2020-12)
**Validator-CLI:** `python tools/validate_state.py runs/<slug>/state.json`

Pro Objekt eine `state.json` unter `runs/<slug>/`. Jedes Modul liest die Vorgänger-Felder und schreibt seinen eigenen Block. Asset-Trennung und RND-Freeze sind im Schema verankert.

---

## Top-Level

| Feld | Typ | Pflicht | Bedeutung |
|------|-----|---------|-----------|
| `schema_version` | string | ✓ | aktuell `"1.0"` |
| `objekt` | object | ✓ | Stammdaten |
| `modul_0` … `modul_5` | object | optional | je gefülltes Modul |

## `objekt`

| Feld | Typ | Pflicht | Bedeutung |
|------|-----|---------|-----------|
| `slug` | string (kebab-case) | ✓ | aus Adresse erzeugt |
| `adresse` | string | ✓ | Vollständig |
| `stadt` | string | ✓ |  |
| `stadtteil` | string | – | optional |
| `bundesland` | string | ✓ | z.B. `"NRW"` |
| `erstellt_am` | string (ISO 8601 Datum) | ✓ |  |
| `letzter_modul_lauf` | string | ✓ | z.B. `"modul_2"` |

## `modul_0` (Quick-Check)

| Feld | Typ | Pflicht | Bedeutung |
|------|-----|---------|-----------|
| `status` | enum: `gruen`/`gelb`/`rot` | ✓ |  |
| `tiefenstufe` | int 1–5 | ✓ |  |
| `konfidenz` | enum: `hoch`/`mittel`/`niedrig` | ✓ |  |
| `ausgefuehrt_am` | string ISO | ✓ |  |
| `angebotspreis_eur` | number ≥ 0 | ✓ |  |
| `etw_konsens_eur` | number ≥ 0 | ✓ | ETW-Konsens (Marktwert pro WE × Anzahl) |
| `gap_prozent` | number | ✓ | `(angebot − konsens) / konsens × 100` |
| `ueber_schwelle` | bool | ✓ | `gap_prozent > 5` |

## `modul_1` (Objektbasis)

| Feld | Typ | Pflicht |
|------|-----|---------|
| `status` | enum | ✓ |
| `tiefenstufe` | int 1–5 | ✓ |
| `tiefenstufe_max` | int 1–5 | ✓ |
| `konfidenz` | enum | ✓ |
| `brw_eur_pro_qm` | number > 0 | ✓ |
| `gebaeude_anteil_prozent` | number 0–100 | ✓ |
| `we_liste` | array of `we_eintrag` | ✓, min 1 |

`we_eintrag`:
- `we_nr` (int ≥ 1), `lage_im_haus` (string: `EG`/`OG_links`/`OG_rechts`/`DG_links`/`DG_rechts`/…),
- `wohnflaeche_qm` (number 10–250), `zimmer_anzahl` (number 1–8),
- `balkon` (bool), `keller` (bool).

## `modul_2` (RND und AfA)

| Feld | Typ | Pflicht |
|------|-----|---------|
| `status` | enum | ✓ |
| `tiefenstufe` | int 1–3 | ✓ |
| `konfidenz` | enum | ✓ |
| `baujahr` | int 1850–<aktuelles Jahr> | ✓ |
| `rnd_jahre` | int 20–80 | ✓ |
| `rnd_frozen` | bool, immer `true` nach M2-Lauf | ✓ |
| `rnd_basis` | string (Erläuterung) | ✓ |
| `mod_score` | number 0–100 | ✓ |
| `afa_korridor_prozent` | object `{min, max}` (z.B. `{2.0, 3.5}`) | ✓ |
| `afa_empfehlung_prozent` | number | ✓ |
| `begruendung` | string | ✓ |

**Freeze-Regel:** Sobald `rnd_frozen=true`, weisen Modul 3/5 Schreibversuche auf `modul_2.rnd_jahre` zurück (durch Validator + Modul-Check).

## `modul_3` (Massnahmen)

| Feld | Typ | Pflicht |
|------|-----|---------|
| `status` | enum | ✓ |
| `tiefenstufe` | int 1–5 | ✓ |
| `konfidenz` | enum | ✓ |
| `ist_kernsanierung` | bool | ✓ |
| `massnahmen_liste` | array of `massnahme` | ✓ |
| `rnd_gutachten_netto_eur` | number ≥ 0 | ✓ | Pflicht-Position, default `1000 × anzahl_we` |
| `weg_teilung_netto_eur` | number ≥ 0 | ✓ |
| `enev_klasse` | string (`A+` … `H` oder `unbekannt`) | ✓ |
| `summen` | object | ✓ |

`massnahme`:
- `kategorie` (enum: `Dach`/`Fassade`/`Fenster`/`Heizung`/`Elektrik`/`Sanitaer`/`Boeden`/`Grundriss`/`Sonstiges`),
- `ist_zustand` (string), `geplant` (string), `kosten_netto_eur` (number ≥ 0).

`summen`:
- `modernisierung_netto_eur`, `modernisierung_brutto_eur`,
- `nebenkosten_netto_eur`, `nebenkosten_brutto_eur` — alle `number ≥ 0`.

**Asset-Trennung:** Kein Eintrag in `massnahmen_liste` darf in `kategorie` oder `geplant` die Wörter `subvention` oder `rücklage`/`ruecklage` enthalten (Self-Check in M3).

## `modul_4` (Miete)

| Feld | Typ | Pflicht |
|------|-----|---------|
| `status` | enum | ✓ |
| `tiefenstufe` | int 1–6 | ✓ |
| `tiefenstufe_max` | int 1–6 | ✓ |
| `konfidenz` | enum | ✓ |
| `we_mieten` | array of `we_miete` (1 pro WE) | ✓ |
| `mietsubventionen_summe_eur_pro_monat` | number ≥ 0 | ✓ |
| `begruendung_je_we` | object (`we_nr` → string) | ✓ |

`we_miete`:
- `we_nr` (int), `ist_miete_eur_pro_qm` (number ≥ 0), `sollmiete_eur_pro_qm` (number ≥ 0),
- `mietspiegel_obergrenze_eur_pro_qm` (number ≥ 0),
- `paragraph_558_heberecht_eur` (number ≥ 0),
- `mietsubvention_eur_pro_monat` (number ≥ 0).

## `modul_5` (Deal-Bewertung)

| Feld | Typ | Pflicht |
|------|-----|---------|
| `status` | enum | ✓ |
| `bewertungs_score` | number 0–100 | ✓ |
| `pdf_pfad` | string (Pfad relativ zu `runs/<slug>/`) | ✓ |
| `excel_pfad` | string | ✓ |

---

## Plausibilitäts-Grenzen (Validator-Constraints)

Werden im JSON-Schema als `minimum`/`maximum`/`enum` durchgesetzt. Wenn Modul-Berechnung außerhalb landet → Status `rot`, kein Schreiben.
````

- [ ] **Step 5.2: Maschinen-validierbares JSON-Schema `docs/state.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/andre-petrov-creator/meine-projekte/Aufteiler/state.schema.json",
  "title": "Aufteiler State v1.0",
  "type": "object",
  "required": ["schema_version", "objekt"],
  "additionalProperties": false,
  "properties": {
    "schema_version": { "const": "1.0" },
    "objekt": {
      "type": "object",
      "required": ["slug", "adresse", "stadt", "bundesland", "erstellt_am", "letzter_modul_lauf"],
      "additionalProperties": false,
      "properties": {
        "slug": { "type": "string", "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$" },
        "adresse": { "type": "string", "minLength": 3 },
        "stadt": { "type": "string", "minLength": 2 },
        "stadtteil": { "type": "string" },
        "bundesland": { "type": "string", "minLength": 2 },
        "erstellt_am": { "type": "string", "format": "date" },
        "letzter_modul_lauf": { "type": "string", "pattern": "^modul_[0-5]$" }
      }
    },
    "modul_0": { "$ref": "#/$defs/modul_0" },
    "modul_1": { "$ref": "#/$defs/modul_1" },
    "modul_2": { "$ref": "#/$defs/modul_2" },
    "modul_3": { "$ref": "#/$defs/modul_3" },
    "modul_4": { "$ref": "#/$defs/modul_4" },
    "modul_5": { "$ref": "#/$defs/modul_5" }
  },
  "$defs": {
    "status_enum": { "type": "string", "enum": ["gruen", "gelb", "rot"] },
    "konfidenz_enum": { "type": "string", "enum": ["hoch", "mittel", "niedrig"] },
    "modul_0": {
      "type": "object",
      "required": ["status", "tiefenstufe", "konfidenz", "ausgefuehrt_am",
                   "angebotspreis_eur", "etw_konsens_eur", "gap_prozent", "ueber_schwelle"],
      "additionalProperties": false,
      "properties": {
        "status": { "$ref": "#/$defs/status_enum" },
        "tiefenstufe": { "type": "integer", "minimum": 1, "maximum": 5 },
        "konfidenz": { "$ref": "#/$defs/konfidenz_enum" },
        "ausgefuehrt_am": { "type": "string", "format": "date-time" },
        "angebotspreis_eur": { "type": "number", "minimum": 0 },
        "etw_konsens_eur": { "type": "number", "minimum": 0 },
        "gap_prozent": { "type": "number" },
        "ueber_schwelle": { "type": "boolean" }
      }
    },
    "modul_1": {
      "type": "object",
      "required": ["status", "tiefenstufe", "tiefenstufe_max", "konfidenz",
                   "brw_eur_pro_qm", "gebaeude_anteil_prozent", "we_liste"],
      "additionalProperties": false,
      "properties": {
        "status": { "$ref": "#/$defs/status_enum" },
        "tiefenstufe": { "type": "integer", "minimum": 1, "maximum": 5 },
        "tiefenstufe_max": { "type": "integer", "minimum": 1, "maximum": 5 },
        "konfidenz": { "$ref": "#/$defs/konfidenz_enum" },
        "brw_eur_pro_qm": { "type": "number", "exclusiveMinimum": 0 },
        "gebaeude_anteil_prozent": { "type": "number", "minimum": 0, "maximum": 100 },
        "we_liste": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": ["we_nr", "lage_im_haus", "wohnflaeche_qm", "zimmer_anzahl", "balkon", "keller"],
            "additionalProperties": false,
            "properties": {
              "we_nr": { "type": "integer", "minimum": 1 },
              "lage_im_haus": { "type": "string", "minLength": 1 },
              "wohnflaeche_qm": { "type": "number", "minimum": 10, "maximum": 250 },
              "zimmer_anzahl": { "type": "number", "minimum": 1, "maximum": 8 },
              "balkon": { "type": "boolean" },
              "keller": { "type": "boolean" }
            }
          }
        }
      }
    },
    "modul_2": {
      "type": "object",
      "required": ["status", "tiefenstufe", "konfidenz", "baujahr", "rnd_jahre",
                   "rnd_frozen", "rnd_basis", "mod_score",
                   "afa_korridor_prozent", "afa_empfehlung_prozent", "begruendung"],
      "additionalProperties": false,
      "properties": {
        "status": { "$ref": "#/$defs/status_enum" },
        "tiefenstufe": { "type": "integer", "minimum": 1, "maximum": 3 },
        "konfidenz": { "$ref": "#/$defs/konfidenz_enum" },
        "baujahr": { "type": "integer", "minimum": 1850, "maximum": 2030 },
        "rnd_jahre": { "type": "integer", "minimum": 20, "maximum": 80 },
        "rnd_frozen": { "const": true },
        "rnd_basis": { "type": "string", "minLength": 1 },
        "mod_score": { "type": "number", "minimum": 0, "maximum": 100 },
        "afa_korridor_prozent": {
          "type": "object",
          "required": ["min", "max"],
          "properties": {
            "min": { "type": "number", "minimum": 0, "maximum": 10 },
            "max": { "type": "number", "minimum": 0, "maximum": 10 }
          }
        },
        "afa_empfehlung_prozent": { "type": "number", "minimum": 0, "maximum": 10 },
        "begruendung": { "type": "string", "minLength": 1 }
      }
    },
    "modul_3": {
      "type": "object",
      "required": ["status", "tiefenstufe", "konfidenz", "ist_kernsanierung",
                   "massnahmen_liste", "rnd_gutachten_netto_eur",
                   "weg_teilung_netto_eur", "enev_klasse", "summen"],
      "additionalProperties": false,
      "properties": {
        "status": { "$ref": "#/$defs/status_enum" },
        "tiefenstufe": { "type": "integer", "minimum": 1, "maximum": 5 },
        "konfidenz": { "$ref": "#/$defs/konfidenz_enum" },
        "ist_kernsanierung": { "type": "boolean" },
        "massnahmen_liste": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["kategorie", "ist_zustand", "geplant", "kosten_netto_eur"],
            "additionalProperties": false,
            "properties": {
              "kategorie": {
                "type": "string",
                "enum": ["Dach", "Fassade", "Fenster", "Heizung", "Elektrik",
                         "Sanitaer", "Boeden", "Grundriss", "Sonstiges"]
              },
              "ist_zustand": { "type": "string" },
              "geplant": { "type": "string" },
              "kosten_netto_eur": { "type": "number", "minimum": 0 }
            }
          }
        },
        "rnd_gutachten_netto_eur": { "type": "number", "minimum": 0 },
        "weg_teilung_netto_eur": { "type": "number", "minimum": 0 },
        "enev_klasse": { "type": "string", "enum": ["A+","A","B","C","D","E","F","G","H","unbekannt"] },
        "summen": {
          "type": "object",
          "required": ["modernisierung_netto_eur", "modernisierung_brutto_eur",
                       "nebenkosten_netto_eur", "nebenkosten_brutto_eur"],
          "additionalProperties": false,
          "properties": {
            "modernisierung_netto_eur": { "type": "number", "minimum": 0 },
            "modernisierung_brutto_eur": { "type": "number", "minimum": 0 },
            "nebenkosten_netto_eur": { "type": "number", "minimum": 0 },
            "nebenkosten_brutto_eur": { "type": "number", "minimum": 0 }
          }
        }
      }
    },
    "modul_4": {
      "type": "object",
      "required": ["status", "tiefenstufe", "tiefenstufe_max", "konfidenz",
                   "we_mieten", "mietsubventionen_summe_eur_pro_monat", "begruendung_je_we"],
      "additionalProperties": false,
      "properties": {
        "status": { "$ref": "#/$defs/status_enum" },
        "tiefenstufe": { "type": "integer", "minimum": 1, "maximum": 6 },
        "tiefenstufe_max": { "type": "integer", "minimum": 1, "maximum": 6 },
        "konfidenz": { "$ref": "#/$defs/konfidenz_enum" },
        "we_mieten": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": ["we_nr", "ist_miete_eur_pro_qm", "sollmiete_eur_pro_qm",
                         "mietspiegel_obergrenze_eur_pro_qm",
                         "paragraph_558_heberecht_eur", "mietsubvention_eur_pro_monat"],
            "additionalProperties": false,
            "properties": {
              "we_nr": { "type": "integer", "minimum": 1 },
              "ist_miete_eur_pro_qm": { "type": "number", "minimum": 0 },
              "sollmiete_eur_pro_qm": { "type": "number", "minimum": 0 },
              "mietspiegel_obergrenze_eur_pro_qm": { "type": "number", "minimum": 0 },
              "paragraph_558_heberecht_eur": { "type": "number", "minimum": 0 },
              "mietsubvention_eur_pro_monat": { "type": "number", "minimum": 0 }
            }
          }
        },
        "mietsubventionen_summe_eur_pro_monat": { "type": "number", "minimum": 0 },
        "begruendung_je_we": {
          "type": "object",
          "additionalProperties": { "type": "string" }
        }
      }
    },
    "modul_5": {
      "type": "object",
      "required": ["status", "bewertungs_score", "pdf_pfad", "excel_pfad"],
      "additionalProperties": false,
      "properties": {
        "status": { "$ref": "#/$defs/status_enum" },
        "bewertungs_score": { "type": "number", "minimum": 0, "maximum": 100 },
        "pdf_pfad": { "type": "string", "minLength": 1 },
        "excel_pfad": { "type": "string", "minLength": 1 }
      }
    }
  }
}
```

- [ ] **Step 5.3: Commit**

```bash
git add docs/state-schema.md docs/state.schema.json
git commit -m "Aufteiler Docs: state-schema v1.0 (Markdown-Doku + validierbares JSON-Schema)"
```

---

### Task 6: CLI-Validator `tools/validate_state.py`

**Files:**
- Create: `tools/validate_state.py`
- Test: `tools/test_validate_state.py`

- [ ] **Step 6.1: Failing Test schreiben**

Inhalt `tools/test_validate_state.py`:

```python
"""Tests für validate_state.py — Schema-Validator.

Lauf: pytest tools/test_validate_state.py -v
Voraussetzung: pip install jsonschema pytest
"""
import json
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = REPO_ROOT / "tools" / "validate_state.py"


def _run(state_obj, tmp_path) -> tuple[int, str]:
    """Validator auf state-Dict laufen lassen, (returncode, stderr) zurück."""
    state_file = tmp_path / "state.json"
    state_file.write_text(json.dumps(state_obj), encoding="utf-8")
    proc = subprocess.run(
        [sys.executable, str(VALIDATOR), str(state_file)],
        capture_output=True, text=True
    )
    return proc.returncode, proc.stderr


def _minimal_valid_state() -> dict:
    return {
        "schema_version": "1.0",
        "objekt": {
            "slug": "teststr-1-essen",
            "adresse": "Teststr. 1, 45000 Essen",
            "stadt": "Essen",
            "bundesland": "NRW",
            "erstellt_am": "2026-05-12",
            "letzter_modul_lauf": "modul_0",
        },
    }


def test_minimal_state_is_valid(tmp_path):
    rc, _ = _run(_minimal_valid_state(), tmp_path)
    assert rc == 0


def test_missing_schema_version_fails(tmp_path):
    state = _minimal_valid_state()
    del state["schema_version"]
    rc, err = _run(state, tmp_path)
    assert rc != 0
    assert "schema_version" in err


def test_invalid_slug_fails(tmp_path):
    state = _minimal_valid_state()
    state["objekt"]["slug"] = "Teststr 1"  # Leerzeichen, Großbuchstabe
    rc, err = _run(state, tmp_path)
    assert rc != 0
    assert "slug" in err


def test_modul_2_rnd_frozen_must_be_true(tmp_path):
    state = _minimal_valid_state()
    state["modul_2"] = {
        "status": "gruen",
        "tiefenstufe": 2,
        "konfidenz": "mittel",
        "baujahr": 1968,
        "rnd_jahre": 45,
        "rnd_frozen": False,  # Verstoß
        "rnd_basis": "ImmoWertV Anlage 2",
        "mod_score": 60,
        "afa_korridor_prozent": {"min": 2.0, "max": 3.5},
        "afa_empfehlung_prozent": 2.5,
        "begruendung": "Test",
    }
    rc, err = _run(state, tmp_path)
    assert rc != 0
    assert "rnd_frozen" in err


def test_modul_3_subvention_in_massnahme_rejected(tmp_path):
    """Asset-Trennung: 'subvention' in massnahmen_liste-Eintrag muss als rot zurückgewiesen werden."""
    state = _minimal_valid_state()
    state["modul_3"] = {
        "status": "gruen",
        "tiefenstufe": 2,
        "konfidenz": "mittel",
        "ist_kernsanierung": False,
        "massnahmen_liste": [
            {"kategorie": "Sonstiges", "ist_zustand": "leer", "geplant": "Mietsubvention 2 Jahre",
             "kosten_netto_eur": 10000}
        ],
        "rnd_gutachten_netto_eur": 6000,
        "weg_teilung_netto_eur": 3000,
        "enev_klasse": "E",
        "summen": {
            "modernisierung_netto_eur": 100000,
            "modernisierung_brutto_eur": 119000,
            "nebenkosten_netto_eur": 9000,
            "nebenkosten_brutto_eur": 10710,
        },
    }
    rc, err = _run(state, tmp_path)
    assert rc != 0
    assert "asset-trennung" in err.lower() or "subvention" in err.lower()
```

- [ ] **Step 6.2: Test laufen lassen — er muss fehlschlagen (Validator existiert nicht)**

Run: `pytest tools/test_validate_state.py -v`
Expected: FAIL — `validate_state.py not found` oder ähnlich.

- [ ] **Step 6.3: Validator implementieren**

Inhalt `tools/validate_state.py`:

```python
"""Aufteiler state.json Validator.

Lauf: python tools/validate_state.py <pfad-zu-state.json>
Returncode 0 = valid, 1 = invalid (Fehler auf stderr).

Zusätzliche Business-Checks über JSON-Schema hinaus:
- Asset-Trennung in modul_3.massnahmen_liste (keine 'subvention' / 'rücklage' / 'ruecklage' in Text-Feldern).
"""
import json
import sys
from pathlib import Path

import jsonschema

REPO_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = REPO_ROOT / "docs" / "state.schema.json"

FORBIDDEN_IN_MASSNAHME = ("subvention", "rücklage", "ruecklage")


def _asset_trennung_check(state: dict) -> list[str]:
    errors: list[str] = []
    massnahmen = (state.get("modul_3") or {}).get("massnahmen_liste") or []
    for idx, m in enumerate(massnahmen):
        for field in ("kategorie", "ist_zustand", "geplant"):
            text = str(m.get(field, "")).lower()
            for token in FORBIDDEN_IN_MASSNAHME:
                if token in text:
                    errors.append(
                        f"Asset-Trennung verletzt: modul_3.massnahmen_liste[{idx}].{field} "
                        f"enthält '{token}' — gehört nicht in Reno-Block."
                    )
    return errors


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("Usage: validate_state.py <state.json>", file=sys.stderr)
        return 2

    state_path = Path(argv[1])
    if not state_path.is_file():
        print(f"State-Datei nicht gefunden: {state_path}", file=sys.stderr)
        return 2

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    state = json.loads(state_path.read_text(encoding="utf-8"))

    validator = jsonschema.Draft202012Validator(schema)
    schema_errors = sorted(validator.iter_errors(state), key=lambda e: list(e.absolute_path))
    business_errors = _asset_trennung_check(state)

    if not schema_errors and not business_errors:
        return 0

    for err in schema_errors:
        path = "/".join(str(p) for p in err.absolute_path) or "<root>"
        print(f"[SCHEMA] {path}: {err.message}", file=sys.stderr)
    for msg in business_errors:
        print(f"[BUSINESS] {msg}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
```

- [ ] **Step 6.4: `jsonschema` installieren (falls noch nicht im venv)**

Run: `python -m pip install jsonschema pytest`
Expected: erfolgreich oder „already installed".

- [ ] **Step 6.5: Tests laufen lassen — müssen alle grün sein**

Run: `pytest tools/test_validate_state.py -v`
Expected: 5 passed.

- [ ] **Step 6.6: Commit**

```bash
git add tools/validate_state.py tools/test_validate_state.py
git commit -m "Aufteiler Tools: state.json-Validator (JSON-Schema + Asset-Trennung)"
```

---

### Task 7: Excel-Handoff-Skeleton

**Files:**
- Create: `docs/excel_handoff.md`

- [ ] **Step 7.1: Skeleton-Tabelle anlegen (eine Sektion pro Sheet, leer ist OK in Phase 1; wird beim Modul-Bau befüllt)**

Inhalt `docs/excel_handoff.md`:

````markdown
# Excel-Handoff-Vertrag

Pro Excel-Sheet eine Tabelle. Jede Zeile beschreibt **eine Zelle**, die von einem Modul-Skill geschrieben wird, mit:
- `Sheet!Zelle`: exakte Adresse im Template `Kalkulation_Aufteiler_mit_VK_CF.xlsx`
- `Inhalt`: was steht drin
- `Quelle (Schema-Pfad)`: woher kommt der Wert in `state.json`
- `Liefer-Modul`: welcher Modul-Skill schreibt diese Zelle

Wird pro Modul beim Bau befüllt. **Vertrag** — wenn eine Zelle hier steht, darf kein anderes Modul sie überschreiben.

---

## Sheet `MIETER`

| Sheet!Zelle | Inhalt | Quelle (Schema-Pfad) | Liefer-Modul |
|-------------|--------|----------------------|--------------|
| _(wird in Modul 1 + Modul 4 befüllt)_ | | | |

## Sheet `VK_CF`

| Sheet!Zelle | Inhalt | Quelle (Schema-Pfad) | Liefer-Modul |
|-------------|--------|----------------------|--------------|
| _(wird in Modul 5 befüllt)_ | | | |

## Sheet `VERKAUFSMATRIX`

| Sheet!Zelle | Inhalt | Quelle (Schema-Pfad) | Liefer-Modul |
|-------------|--------|----------------------|--------------|
| _(wird in Modul 4 + Modul 5 befüllt)_ | | | |

## Sonstige Sheets

_Werden ergänzt, sobald Modul-Skills sie ansprechen._

---

## Asset-Trennung (verbindlich)

- **Rücklage** und **Mietsubvention** gehören in zwei **Extra-Spalten unter der Verkaufsmatrix** (siehe `VERKAUFSMATRIX`), NICHT in den Modernisierungskosten-Block (`VK_CF`-Reno-Bereich). Grund: Steuerbasis darf nicht verfälscht werden.
- **Wohnungen / Garagen / Stellplätze** NIE im selben Cashflow-Block mischen — siehe `archive/orchestrator.xml` v2.2 Header.
````

- [ ] **Step 7.2: Commit**

```bash
git add docs/excel_handoff.md
git commit -m "Aufteiler Docs: excel_handoff.md skeleton (wird beim Modul-Bau befüllt)"
```

---

### Task 8: Smoke-Test Phase 1

Ziel: Claude Code findet alle Skills via Junctions; Orchestrator-Stub kann theoretisch Sub-Skills aufrufen (Funktion noch nicht implementiert, aber das Skill-System sieht sie).

- [ ] **Step 8.1: Skill-Sichtbarkeit prüfen**

Run: `ls C:/Users/andre/.claude/skills/aufteiler*`
Expected: 8 Junction-Einträge.

- [ ] **Step 8.2: Frontmatter-Validität jedes Stubs prüfen**

Run:
```bash
python -c "
import re, pathlib
for f in sorted(pathlib.Path('skills').glob('*/SKILL.md')):
    text = f.read_text(encoding='utf-8')
    m = re.match(r'^---\n(.*?)\n---\n', text, re.S)
    assert m, f'kein Frontmatter in {f}'
    fm = m.group(1)
    assert 'name:' in fm and 'description:' in fm, f'name/description fehlen in {f}'
    print(f'OK {f}')
"
```
Expected: 8 OK-Zeilen.

- [ ] **Step 8.3: Phase-1-Abschluss-Commit (Tag)**

```bash
git tag -a phase-1-fundament -m "Aufteiler Skill-Umbau Phase 1 abgeschlossen: Fundament steht"
git push origin main --tags
```

---

## Phase 2 — Orchestrator + Modul-Template + Modul 0

Ziel: Orchestrator vollständig, Modul-Template als Vorlage, Modul 0 (Quick-Check) als Referenz-Modul lauffähig, Smoke-Test mit Dummy-Objekt.

### Task 9: Modul-Skill-Template

**Files:**
- Create: `docs/_TEMPLATE_MODUL_SKILL.md`

- [ ] **Step 9.1: Template schreiben**

Inhalt `docs/_TEMPLATE_MODUL_SKILL.md`:

````markdown
# Template — Modul-Skill

Vorlage für `skills/aufteiler-modul-N-<thema>/SKILL.md`. Sektionen 1, 5, 6, 7 sind **byte-identisch** über alle Module (außer Modul-Nummer/Felder). Sektionen 2, 3, 4 sind modul-spezifisch.

````markdown
---
name: aufteiler-modul-N-<thema>
description: <Ein Satz: Was macht das Modul, wann wird es aufgerufen, wer ruft auf>
---

# Modul N — <Name>

## 1. State laden (Pflicht — erste Aktion)

1. Vom Orchestrator bekomme ich `objekt_slug`. Pfad: `runs/<objekt_slug>/state.json`.
2. State einlesen mit `Read`.
3. Pflicht-Vorgänger-Felder prüfen (siehe Tabelle unten). Wenn etwas fehlt → STOPP, Antwort an Orchestrator:
   `"Modul N: Pflichtfeld <pfad> fehlt. Bitte Modul <M> erneut laufen lassen."`

**Pflicht-Vorgänger pro Modul:**
- Modul 0: keine
- Modul 1: `modul_0.status`
- Modul 2: `modul_1.we_liste`
- Modul 3: `modul_1.we_liste`, `modul_2.rnd_jahre`, `modul_2.rnd_frozen=true`
- Modul 4: `modul_1.we_liste`
- Modul 5: `modul_0` … `modul_4` alle gesetzt

## 2. Inputs erheben

Modul-spezifisch. Regeln:
- Eine User-Frage pro `AskUserQuestion`-Aufruf (keine Multi-Inputs).
- Notion-DB-Lookups (Mietspiegel, BRW, ImmoWertV) hier.
- Externe Quellen (BORIS.NRW): User-Hand-Eingabe abfragen.

## 3. Berechnung / Logik

**3a) Tiefenstufen-Wahl:** Eingangs-Check → höchste vollständig erreichbare Stufe wählen (siehe Tabelle im Modul).
**3b) Berechnung** in fester Reihenfolge ausführen. Keine Improvisation.
**3c) Plausibilitäts-Prüfung** vor State-Write.

## 4. Output erzeugen (Drei Zonen)

**Zone A — Daten-Block (pixel-identisch über alle Objekte):**
- Tabellen mit fixen Spalten und Reihenfolge (siehe Modul-spezifischen Block unten).
- Nicht-ermittelbare Werte: `"n/a"`, nicht weglassen.

**Zone B — Tiefenstufen-Deklaration (genau zwei Zeilen, byte-identisches Format):**
```
Tiefenstufe: <N> von <MAX> (<Begründung wenn nicht max>)
Konfidenz: <hoch|mittel|niedrig>
```

**Zone C — Begründungs-Block (Struktur fix, Formulierung frei):**
1. **Wichtigste Annahmen** (Bullet-Liste, max 5)
2. **Risiken / Unsicherheiten** (Bullet-Liste, max 5)
3. **Empfehlung** (1–3 Sätze)

## 5. State persistieren

1. `modul_N`-Block bauen (siehe Schema in `docs/state-schema.md`).
2. State validieren: `python tools/validate_state.py runs/<slug>/state.json` als Trockenlauf (auf einer temporären Kopie). Wenn rot → kein Schreiben, an Orchestrator zurück.
3. `state.json` schreiben (komplettes Objekt, nicht patchen).
4. `runs/<slug>/modul-N-output.md` schreiben (Zone A/B/C als lesbarer Audit-Trail).
5. `objekt.letzter_modul_lauf` auf `modul_N` setzen.

## 6. Self-Check (Pflicht vor Übergabe)

- [ ] Alle Pflichtfelder im Schema befüllt
- [ ] Werte in Plausibilitätsgrenzen (siehe Modul-spezifische Grenzen)
- [ ] Asset-Trennung eingehalten (für M3: keine `subvention`/`rücklage` in `massnahmen_liste`)
- [ ] Excel-Transfer-Block vollständig (für Module die in Excel schreiben — siehe `docs/excel_handoff.md`)
- [ ] `modul-N-output.md` erzeugt
- [ ] Validator-CLI exit 0

Bei rot → kein state.json-Schreiben, an Orchestrator zurück mit Fehlertext.

## 7. Übergabe an Orchestrator

Eine Zeile:
```
Modul N grün. Werte in runs/<slug>/state.json, Audit in runs/<slug>/modul-N-output.md. Freigabe für Modul <N+1>?
```
````
````

- [ ] **Step 9.2: Commit**

```bash
git add docs/_TEMPLATE_MODUL_SKILL.md
git commit -m "Aufteiler Docs: Modul-Skill-Template (Sektionen 1/5/6/7 byte-identisch)"
```

---

### Task 10: Orchestrator-Skill ausschreiben

**Files:**
- Modify: `skills/aufteiler/SKILL.md`

- [ ] **Step 10.1: Orchestrator komplett ersetzen**

Inhalt `skills/aufteiler/SKILL.md`:

````markdown
---
name: aufteiler
description: Orchestrator für die MFH-Aufteiler-Analyse (NRW/Ruhrgebiet). Trigger bei "Aufteiler", "Vollanalyse MFH", "Quick-Check MFH", "Mietsituation prüfen", "RND prüfen", "Massnahmen kalkulieren", "Deal-Bewertung", "PDF-Export Aufteiler". Erkennt Modus deterministisch, legt State pro Objekt an, dispatcht Modul-Sub-Skills mit Freigabe-Gate nach jedem Modul. Rechnet selbst NICHTS.
---

# Aufteiler-Orchestrator

Stumpfer Dispatcher. Je dümmer, desto reproduzierbarer.

## 1. Modus-Erkennung (deterministisch — keine Vermutung)

Erste Aktion bei jedem Aufruf: User-Aussage gegen Tabelle matchen.

| User sagt … (Substring-Match, case-insensitive) | Modus | Sequenz |
|-------------------------------------------------|-------|---------|
| "vollanalyse", "komplette analyse", "alles", "ganze analyse" | `vollanalyse` | 0 → 1 → 2 → 3 → 4 |
| "quick-check", "quickcheck", "schnellcheck" | `nur_quickcheck` | 0 |
| "objektbasis", "we-liste", "we liste" | `nur_basis` | 1 |
| "rnd", "restnutzungsdauer", "afa" | `nur_rnd` | 2 |
| "massnahmen", "sanierung", "modernisierung" | `nur_massnahmen` | 3 |
| "miete", "mietspiegel", "mietsituation" | `nur_miete` | 4 |
| "deal-bewertung", "pdf-export", "pdf export", "endbericht", "verdict" | `nur_export` | 5 |

**Bei unklarem Input** (kein Match oder mehrere Matches): EINE Rückfrage via `AskUserQuestion` mit allen plausiblen Modi als Optionen. Niemals raten.

## 2. TodoWrite VOR Start

Sobald Modus erkannt, sofort `TodoWrite` aufrufen mit einer Aufgabe pro Modul der Sequenz + zwei Klammer-Aufgaben:
- "State init / laden für Objekt <slug>"
- "Modul 0 — Quick-Check"
- … (gemäß Sequenz)
- "Vollanalyse abgeschlossen"

Damit ist State auch nach Compression sichtbar, und Claude kann nicht „springen".

## 3. Objekt-Slug + State-Init

1. **Adresse erfragen** via `AskUserQuestion`, falls nicht im Input enthalten:
   "Adresse des Objekts? (z.B. Prosperstr. 59, 45356 Essen-Dellwig)"
2. **Slug bilden:** kebab-case aus Straße + Hausnummer + Stadt(teil), Umlaute ersetzen (`ä→ae`, `ö→oe`, `ü→ue`, `ß→ss`), Sonderzeichen weg, Whitespace zu `-`. Beispiel:
   `Prosperstr. 59, 45356 Essen-Dellwig` → `prosperstr-59-essen-dellwig`.
3. **Bestehenden State suchen:** `runs/<slug>/state.json` lesen. Wenn vorhanden:
   - `objekt.letzter_modul_lauf` melden: `"State für <slug> existiert, letzter Lauf: <modul_N>. Weiter ab Modul <N+1>? (ja = weiter, neu = State frisch)"`
   - User-Antwort `neu` → existierenden Ordner zu `runs/<slug>_<timestamp>_archiv/` umbenennen, frischen anlegen.
4. **Frischen State init** (falls neu oder nach Archiv):
   ```bash
   mkdir -p runs/<slug>/eingangs-daten
   ```
   `runs/<slug>/state.json` mit Minimal-Objekt:
   ```json
   {
     "schema_version": "1.0",
     "objekt": {
       "slug": "<slug>",
       "adresse": "<adresse>",
       "stadt": "<stadt>",
       "bundesland": "NRW",
       "erstellt_am": "<heute ISO>",
       "letzter_modul_lauf": "modul_0"
     }
   }
   ```
5. Validieren: `python tools/validate_state.py runs/<slug>/state.json` → exit 0.

## 4. Sub-Skill-Aufruf pro Modul (Sequenz abarbeiten)

Pro Sequenz-Schritt:

1. Todo-Item auf `in_progress` setzen.
2. Sub-Skill via `Skill`-Tool aufrufen:
   - Modul 0: `Skill(skill="aufteiler-modul-0-quickcheck", args="<objekt_slug>")`
   - Modul 1: `Skill(skill="aufteiler-modul-1-objektbasis", args="<objekt_slug>")`
   - Modul 2: `Skill(skill="aufteiler-modul-2-rnd-afa", args="<objekt_slug>")`
   - Modul 3: `Skill(skill="aufteiler-modul-3-massnahmen", args="<objekt_slug>")`
   - Modul 4: `Skill(skill="aufteiler-modul-4-miete", args="<objekt_slug>")`
   - Modul 5: `Skill(skill="aufteiler-modul-5-deal-bewertung", args="<objekt_slug>")`
3. Nach Sub-Skill-Rückkehr: State neu lesen, prüfen ob `objekt.letzter_modul_lauf` korrekt hochgesetzt wurde. Wenn nein → Fehler an User: "Modul N hat State nicht geschrieben."
4. Todo-Item auf `completed` setzen.
5. **Freigabe-Gate** (siehe 5).

## 5. Freigabe-Gate (Pflicht zwischen Modulen)

Nach jedem Modul-Lauf (außer letztem in Sequenz):

> `Modul N abgeschlossen. Weiter zu Modul <N+1>? (go/weiter/ja/ok = weiter, alles andere = Stopp)`

User-Antwort:
- `go`, `weiter`, `ja`, `ok` (case-insensitive Trim) → nächstes Modul laden
- Alles andere → Sequenz stoppen, Übersicht geben: "Stopp. State ist persistiert. Weiter mit `<objekt-slug> weiter` möglich."

**KEIN automatisches Weiterlaufen,** auch nicht bei „Vollanalyse machen".

## 6. Fragen nach Abschluss → Pflicht-Read

Wenn User nach Sequenz-Ende eine Frage stellt („Wie hoch war die Sollmiete für WE 3?"), NIE aus dem Chat antworten. Immer `Read runs/<slug>/state.json` oder `Read runs/<slug>/modul-N-output.md` ausführen und Wert daraus zitieren.

## 7. Was der Orchestrator NICHT macht

- Keine Berechnungen.
- Keine Excel-Befüllung (das macht Modul 5).
- Keine Interpretation von Modul-Outputs.
- Keine Modus-Schätzung bei mehrdeutigem Input.
- Kein Override von Modul-Status (wenn Modul rot meldet, Sequenz stoppt).
````

- [ ] **Step 10.2: Commit**

```bash
git add skills/aufteiler/SKILL.md
git commit -m "Aufteiler Skill aufteiler v1.0: Orchestrator-Logik ausgeschrieben"
```

---

### Task 11: Modul 0 — Quick-Check ausschreiben

**Files:**
- Modify: `skills/aufteiler-modul-0-quickcheck/SKILL.md`

- [ ] **Step 11.1: Quick-Check-Logik aus `archive/modul_0_quickcheck.xml` extrahieren**

Run: `cat archive/modul_0_quickcheck.xml`
Lies die Datei, notiere für dich:
- Welche Inputs erhebt Modul 0?
- Welche Berechnung (Angebotspreis vs. ETW-Konsens, Gap %)?
- Welche Schwelle (vermutlich 5%)?

- [ ] **Step 11.2: Modul 0 schreiben (basiert auf Template aus Task 9 + Logik aus XML)**

Inhalt `skills/aufteiler-modul-0-quickcheck/SKILL.md`:

````markdown
---
name: aufteiler-modul-0-quickcheck
description: Modul 0 der Aufteiler-Analyse — Quick-Check. Vergleicht Angebotspreis gegen ETW-Konsens (Marktwert pro WE × Anzahl WE), prüft Gap-Schwelle 5%. Wird ausschließlich vom aufteiler-Orchestrator aufgerufen, NICHT direkt durch User.
---

# Modul 0 — Quick-Check

Erstes Gate: Lohnt sich der Deal überhaupt? Gap-Check Angebotspreis vs. ETW-Konsens.

## 1. State laden (Pflicht — erste Aktion)

1. Vom Orchestrator: `objekt_slug`. Pfad: `runs/<objekt_slug>/state.json`.
2. State einlesen mit `Read`.
3. Pflicht: `objekt.slug`, `objekt.adresse`, `objekt.stadt`. Wenn fehlt → STOPP, an Orchestrator: "Modul 0: objekt.adresse fehlt."

## 2. Inputs erheben

Per `AskUserQuestion` einzeln:
1. "Angebotspreis des Objekts (€)?"
2. "ETW-Konsens (Marktwert pro WE in €) und Anzahl WE? Format: `<Preis_pro_WE>, <Anzahl_WE>` (z.B. `180000, 6`)."

Falls User unsicher beim ETW-Konsens: Fallback-Hilfe — "ETW-Konsens schätzt du aus aktuellen Verkaufspreisen vergleichbarer Wohnungen im Stadtteil. Wenn unbekannt: bitte später nachreichen."

## 3. Berechnung / Logik

**3a) Tiefenstufen-Wahl:**

| Stufe | Eingang vorhanden | Berechnung |
|-------|-------------------|------------|
| 1 | Angebot + ETW-Konsens-Schätzung | Gap-% gegen Schätzung |
| 2 | + ETW-Konsens via Vergleichsobjekte | Gap-% gegen belastbare Vergleichsbasis |
| 3 | + Stadtteil-Marktdaten | Gap-% + Marktdaten-Kontext |
| 4 | + Vermarktungsdauer / Preisanpassungen | + Dynamik-Indikator |
| 5 | + voll dokumentierter Verkaufsprozess | + Verhandlungs-Hebel |

In Modul 0 reicht **Stufe 1 oder 2**.

**3b) Berechnung in fester Reihenfolge:**

```
etw_konsens_eur = etw_konsens_pro_we_eur × anzahl_we
gap_eur = angebotspreis_eur − etw_konsens_eur
gap_prozent = (gap_eur / etw_konsens_eur) × 100
ueber_schwelle = (gap_prozent > 5)
```

**3c) Status-Ableitung:**
- `gap_prozent ≤ 0` (Angebot unter Konsens) → `status = "gruen"`
- `0 < gap_prozent ≤ 5` → `status = "gelb"`
- `gap_prozent > 5` → `status = "rot"` (Empfehlung: Verhandeln oder skippen)

**Plausibilität:** `angebotspreis_eur` zwischen 50.000 und 5.000.000 (außerhalb → User-Rückfrage).

## 4. Output erzeugen

**Zone A — Daten-Block:**

```
| Position                  | Wert              |
|---------------------------|-------------------|
| Angebotspreis             | <X> €             |
| ETW-Konsens               | <Y> € (<W> WE × <P> €/WE) |
| Gap absolut               | <G> €             |
| Gap %                     | <G%> %            |
| Schwellen-Überschritt 5%? | ja/nein           |
| Status                    | grün/gelb/rot     |
```

**Zone B:**
```
Tiefenstufe: <N> von 5 (<wenn nicht 5: Begründung welche Daten fehlen>)
Konfidenz: <hoch|mittel|niedrig>
```

**Zone C:**
1. **Wichtigste Annahmen** (max 5 Bullets)
2. **Risiken / Unsicherheiten** (max 5 Bullets)
3. **Empfehlung** (1–3 Sätze, z.B. "Verhandeln auf <Y> €.")

## 5. State persistieren

1. `modul_0`-Block bauen:
   ```json
   {
     "status": "<gruen|gelb|rot>",
     "tiefenstufe": <int>,
     "konfidenz": "<hoch|mittel|niedrig>",
     "ausgefuehrt_am": "<jetzt ISO>",
     "angebotspreis_eur": <number>,
     "etw_konsens_eur": <number>,
     "gap_prozent": <number>,
     "ueber_schwelle": <bool>
   }
   ```
2. `objekt.letzter_modul_lauf` auf `"modul_0"` setzen.
3. State schreiben.
4. `runs/<slug>/modul-0-output.md` mit Zonen A/B/C schreiben.
5. Validator-Lauf: `python tools/validate_state.py runs/<slug>/state.json`. Exit 0 = OK; ≠0 → state.json zurückrollen, Fehlertext zurückgeben.

## 6. Self-Check

- [ ] Alle Pflichtfelder befüllt
- [ ] `gap_prozent` rechnerisch korrekt (Stichprobe: `(angebot − konsens)/konsens × 100`)
- [ ] Status passt zur Schwelle
- [ ] `modul-0-output.md` erzeugt
- [ ] Validator-Exit 0

Bei rot → kein State-Write, an Orchestrator: "Modul 0 rot, Grund: <Fehlertext>".

## 7. Übergabe

```
Modul 0 grün. Status: <gruen|gelb|rot>. Gap: <G%>%. Werte in runs/<slug>/state.json. Freigabe für Modul 1?
```
````

- [ ] **Step 11.3: Commit**

```bash
git add skills/aufteiler-modul-0-quickcheck/SKILL.md
git commit -m "Aufteiler Skill aufteiler-modul-0-quickcheck v1.0: Quick-Check (Angebot vs. ETW-Konsens, Gap 5%)"
```

---

### Task 12: Smoke-Test Phase 2 (Dummy-Objekt durch Modul 0)

Ziel: Frische Claude-Code-Session öffnen, „Quick-Check für Testadresse Musterstr. 1, 45000 Musterstadt" sagen, Modul 0 mit fiktiven Werten durchlaufen, prüfen ob `state.json` korrekt geschrieben wird.

- [ ] **Step 12.1: Manuelle Test-Anleitung in `docs/superpowers/plans/2026-05-12-aufteiler-skill-umbau.md` (dieses Plan-File) notieren**

Nicht-automatisierbarer Test (Skill-Aufruf läuft im Live-Chat). Test-Checklist:

1. Frische Claude-Code-Session.
2. Eingabe: `"Quick-Check für Musterstr. 1, 45000 Musterstadt"`
3. Erwartet: Orchestrator-Skill aktiviert, fragt nach Adresse (oder erkennt sie), legt `runs/musterstr-1-musterstadt/state.json` an.
4. Erwartet: Modul 0 fragt Angebotspreis und ETW-Konsens ab. Eingabe: `Angebot 1.000.000 €, ETW-Konsens 180.000 € × 6 WE`.
5. Erwartet: Gap 7.4% → Status rot.
6. Erwartet: `runs/musterstr-1-musterstadt/state.json` enthält `modul_0`-Block mit `gap_prozent ≈ 7.41`, `status: "rot"`.
7. Erwartet: `runs/musterstr-1-musterstadt/modul-0-output.md` existiert mit drei Zonen.

- [ ] **Step 12.2: Test ausführen, Ergebnis dokumentieren**

Nach Test: Status der oben genannten 7 Punkte in `plans/2026-05-12-aufteiler-skill-umbau-tests.md` (neu anlegen) abhaken.

```bash
# Falls Test grün: nichts weiter
# Falls Test rot: Issue in plans/2026-05-12-aufteiler-skill-umbau-tests.md notieren,
#                  Fix-Task definieren, vor Phase 3 schließen.
```

- [ ] **Step 12.3: Phase-2-Tag**

```bash
git tag -a phase-2-orchestrator-und-modul-0 -m "Aufteiler Skill-Umbau Phase 2 abgeschlossen: Orchestrator + Modul 0 lauffähig"
git push origin main --tags
```

---

## Phase 3 — Module 1–4

Ziel: Vier Inhalts-Module gebaut, je mit realistischem Test (Prosperstraße als Daten-Set).

### Task 13: Modul 1 — Objektbasis

**Files:**
- Modify: `skills/aufteiler-modul-1-objektbasis/SKILL.md`
- Modify: `docs/excel_handoff.md` (MIETER-Sheet-Zeilen ergänzen)

- [ ] **Step 13.1: Logik aus `archive/modul_1_objektbasis.xml` extrahieren**

Read: `archive/modul_1_objektbasis.xml`. Notiere:
- BRW-Eingang (BORIS.NRW, manuell)
- Gebäudeanteil-Schätzung (Gebäudefläche / Grundstück)
- WE-Liste-Format (Spalten)

- [ ] **Step 13.2: Skill schreiben — gemäß Template aus Task 9**

**Vorgehen:** Sektionen 1, 5 (Persist-Schema-Felder anpassen), 6, 7 byte-identisch aus `docs/_TEMPLATE_MODUL_SKILL.md` übernehmen. Sektion 2, 3, 4 modul-spezifisch ausschreiben (Inhalt aus altem XML übersetzt). Nach Fertigstellung: Modul 1 ist die Referenz-Vorlage für Module 2–4 (gleiche Außenstruktur).

Pflicht-Inhalte:
- Sektion 1 (State laden) byte-identisch aus Template, Pflicht-Vorgänger: `modul_0.status`.
- Sektion 2 (Inputs): BRW abfragen, Gebäudeanteil herleiten, WE-Liste durchgehen (pro WE: lage_im_haus, wfl, zimmer, balkon, keller).
- Sektion 3 (Tiefenstufen 1–5 für Objektbasis — schreibe konkrete Treppe).
- Sektion 4 (Zone A: WE-Tabelle in fixem Format mit Spalten `WE-Nr | Lage | Wfl m² | Zimmer | Balkon | Keller`; Zone B + C wie Template).
- Sektion 5 (State-Persist): `modul_1`-Block per Schema; `MIETER!A8:F<7+anzahl_we>` füllen (Excel-Handoff).
- Sektion 6 (Self-Check), 7 (Übergabe).

**Excel-Handoff:** In `docs/excel_handoff.md` Sheet-`MIETER`-Tabelle ergänzen:
| `MIETER!A8:A<7+N>` | WE-Nr | `modul_1.we_liste[].we_nr` | Modul 1 |
| `MIETER!B8:B<7+N>` | Lage im Haus | `modul_1.we_liste[].lage_im_haus` | Modul 1 |
| `MIETER!F8:F<7+N>` | Wohnfläche m² | `modul_1.we_liste[].wohnflaeche_qm` | Modul 1 |
(weitere Spalten je nach XML-Vorlage)

- [ ] **Step 13.3: Mini-Test mit Dummy-Daten**

Manuell: in frischer Session „Objektbasis für Prosperstr. 59, 45356 Essen-Dellwig" sagen, mit Phantasiewerten durchlaufen, `state.json` und `modul-1-output.md` prüfen, Validator `python tools/validate_state.py runs/prosperstr-59-essen-dellwig/state.json` → exit 0.

- [ ] **Step 13.4: Commit**

```bash
git add skills/aufteiler-modul-1-objektbasis/SKILL.md docs/excel_handoff.md
git commit -m "Aufteiler Skill aufteiler-modul-1-objektbasis v1.0: WE-Liste + BRW + Gebäudeanteil + MIETER-Sheet"
```

---

### Task 14: Modul 2 — RND und AfA (mit Freeze-Mechanik)

**Files:**
- Modify: `skills/aufteiler-modul-2-rnd-afa/SKILL.md`

- [ ] **Step 14.1: Logik aus `archive/modul_3_rnd_afa.xml` (alte Nr. 3) extrahieren**

Read: `archive/modul_3_rnd_afa.xml`. Notiere:
- ImmoWertV Anlage 2 Standard-RND nach Baujahr
- Mod-Score-Berechnung
- AfA-Korridor-Logik

- [ ] **Step 14.2: Skill schreiben — gemäß Template**

**Vorgehen:** Wie Task 13.2. Sektionen 1/5-Außenform/6/7 aus Template; Modul 1 (Task 13) als zusätzliche Referenz, was „byte-identisch außer Modul-Nummer" konkret heißt.

Pflicht-Inhalte:
- Sektion 1: Pflicht-Vorgänger `modul_1.we_liste`. Plus: prüfen, ob `modul_2.rnd_frozen` bereits `true` ist → wenn ja STOPP: "Modul 2 wurde bereits gelaufen und RND ist gefroren. Re-Run nur via Orchestrator nach explizitem Reset des modul_2-Blocks."
- Sektion 2 Inputs: Baujahr, Mod-Ist-Liste (Dach/Heizung/Fenster), optional Detail-Alter pro Gewerk.
- Sektion 3 Tiefenstufen 1–3:
  | Stufe | Vorhanden | Berechnet |
  |-------|-----------|-----------|
  | 1 | Baujahr | Standard-RND nach ImmoWertV Anlage 2 |
  | 2 | + Mod-Ist-Score | Mod-Score → Korridor-Position |
  | 3 | + Dach/Heizung/Fenster-Alter | Differenzierte Mod-Score-Berechnung |
- Sektion 4 Zone A (Tabelle: `Baujahr | Standard-RND | Mod-Score | Korrigierte RND | AfA-Korridor | AfA-Empfehlung`); Zone B/C.
- Sektion 5: `modul_2`-Block mit `rnd_frozen: true` immer setzen vor Schreiben.
- Sektion 6 Self-Check: zusätzlich „RND zwischen 20 und 80 Jahre" prüfen.
- Sektion 7 Übergabe.

**Plausibilität:** `rnd_jahre` zwischen 20 und 80; `afa_empfehlung_prozent` zwischen 0 und 10.

- [ ] **Step 14.3: Mini-Test**

Manuell mit Baujahr 1968, leichten Modernisierungen → erwartete RND ~45 Jahre. `state.json` → `modul_2.rnd_frozen === true`. Validator exit 0.

- [ ] **Step 14.4: Commit**

```bash
git add skills/aufteiler-modul-2-rnd-afa/SKILL.md
git commit -m "Aufteiler Skill aufteiler-modul-2-rnd-afa v1.0: ImmoWertV Anlage 2 + Mod-Score + rnd_frozen-Mechanik"
```

---

### Task 15: Modul 3 — Massnahmen (mit RND-Gutachten + WEG-Teilung als Reno-Pos.)

**Files:**
- Modify: `skills/aufteiler-modul-3-massnahmen/SKILL.md`
- Modify: `docs/excel_handoff.md` (VERKAUFSMATRIX-Sheet Reno-Block-Zeilen)

- [ ] **Step 15.1: Logik aus `archive/modul_2_massnahmen.xml` (alte Nr. 2) extrahieren**

Read: `archive/modul_2_massnahmen.xml`. Notiere:
- Massnahmen-Kategorien
- Kosten-Schätzungs-Heuristiken
- Brutto/Netto-Logik

Read auch: `plans/2026-05-12-offene-punkte.md` Sektion 2 (RND-Gutachten 1.000 €/WE, WEG-Teilung netto, Brutto/Netto-Verifikation).

- [ ] **Step 15.2: Brutto/Netto-Klärung als TODO im Skill verankern**

Wenn nicht aus Excel-Template verifizierbar, in Skill Sektion 2 als Pflicht-Schritt aufnehmen:
> "Vor Modul-3-Lauf einmalig prüfen: rechnet Excel-Template `VK_CF` USt 19% auf alle Reno-Kosten-Zellen? Wenn ja → Modul liefert netto. Wenn nein → Modul liefert brutto. Verifikation-Status in `docs/excel_handoff.md` Brutto/Netto-Sektion dokumentieren."

- [ ] **Step 15.3: Skill schreiben — gemäß Template**

Pflicht-Inhalte:
- Sektion 1: Pflicht-Vorgänger `modul_1.we_liste`, `modul_2.rnd_jahre`, `modul_2.rnd_frozen === true`. Wenn `rnd_frozen` fehlt → STOPP.
- Sektion 2: Massnahmen abfragen je Kategorie (Dach, Fassade, Fenster, Heizung, Elektrik, Sanitär, Böden, Grundriss, Sonstiges).
  Plus: zwei Pflicht-Positionen:
  - **RND-Gutachten:** automatisch `1000 €/WE × anzahl_we`, kategorie `Sonstiges`, geplant `"RND-Gutachten (1.000 €/WE)"`.
  - **WEG-Teilung:** User-Input fragen (Default-Vorschlag aus Erfahrungswert, falls bekannt), kategorie `Sonstiges`, geplant `"WEG-Teilung Einmalkosten"`.
- Sektion 3 Tiefenstufen 1–5:
  | Stufe | Vorhanden | Berechnet |
  |-------|-----------|-----------|
  | 1 | Adresse + WE-Liste | Standard-Annahmen pro Kategorie |
  | 2 | + Fotos | Zustands-Bewertung je Gewerk |
  | 3 | + Mod-Score aus M2 | Korrigierte Kostenschätzung |
  | 4 | + Handwerker-Angebote (partiell) | Eingerechnete Ist-Werte |
  | 5 | + voll dokumentierte Massnahmen | Pixel-genaue Reno-Tabelle |
- Sektion 4 Zone A Reno-Tabelle in fixem Spaltenformat: `Kategorie | Ist | Geplant | Netto € | Brutto €`. Plus Pflicht-Zeilen RND-Gutachten und WEG-Teilung am Ende.
- Sektion 5: `modul_3`-Block mit `rnd_gutachten_netto_eur`, `weg_teilung_netto_eur`, `summen` (Netto+Brutto). Pflicht: weder `kategorie` noch `geplant` darf das Wort `subvention` oder `rücklage` enthalten (Validator zwingt das ohnehin durch).
- Sektion 6 Self-Check: zusätzlich "Asset-Trennung: keine Subvention/Rücklage in Massnahmen" als expliziten Check.
- Sektion 7 Übergabe.

**Excel-Handoff:** In `docs/excel_handoff.md` Reno-Block-Zellen (Position aus Template ermitteln; falls unklar, in Skill als TODO-Comment markieren bis Verifikation).

- [ ] **Step 15.4: Mini-Test mit Mock-Massnahmen-Liste — verifiziert Asset-Trennung-Validator**

Test 1 (positiv): Massnahmen ohne Subvention/Rücklage → Validator exit 0.
Test 2 (negativ): Eintrag mit `geplant: "Mietsubvention 2 Jahre"` → Validator exit 1 mit Business-Error.

- [ ] **Step 15.5: Commit**

```bash
git add skills/aufteiler-modul-3-massnahmen/SKILL.md docs/excel_handoff.md
git commit -m "Aufteiler Skill aufteiler-modul-3-massnahmen v1.0: Reno + RND-Gutachten + WEG-Teilung; Asset-Trennung enforced"
```

---

### Task 16: Modul 4 — Mietsituation (Tiefenstufen 1–6, Mietsubvention separat)

**Files:**
- Modify: `skills/aufteiler-modul-4-miete/SKILL.md`
- Modify: `docs/excel_handoff.md` (MIETER Y-Spalte + VERKAUFSMATRIX Mietsubvention-Extra-Spalte)

- [ ] **Step 16.1: Logik aus `archive/modul_4_miete.xml` extrahieren**

Read: `archive/modul_4_miete.xml`. Notiere:
- Mietspiegel-Lookup (Notion-DB Mietspiegel NRW)
- Lage-Korrektur (NRW-Spiegel)
- §558-Heberecht-Berechnung
- Mietsubvention-Definition

- [ ] **Step 16.2: Skill schreiben**

Pflicht-Inhalte:
- Sektion 1: Pflicht-Vorgänger `modul_1.we_liste`.
- Sektion 2 Inputs: Mietverträge je WE (Ist-Miete), Sollmiete-Bestimmung via Mietspiegel-Lookup, optional Fotos / Grundriss / Lage-im-Haus.
- Sektion 3 Tiefenstufen 1–6 (aus Spec-Tabelle übernehmen).
- Sektion 4 Zone A — DREI Pflicht-Blöcke pixel-identisch:
  1. **Mietsubventionen** (Tabelle pro WE: WE-Nr | Ist-Miete | Sollmiete | Subvention €/Monat)
  2. **Aktuelle Miete vs. Sollmiete** (pro WE: WE-Nr | Ist €/m² | Soll €/m² | Mietspiegel-Obergrenze €/m² | Delta)
  3. **§558-Heberecht** (pro WE: WE-Nr | Heberecht € | Hinweis ob aktiv)
  Plus Zone B+C.
- Sektion 5: `modul_4`-Block mit `we_mieten[]`, `mietsubventionen_summe_eur_pro_monat`, `begruendung_je_we{}`. Mietsubvention NICHT in `modul_3.massnahmen_liste` schreiben — gehört in dieses Modul.
- Sektion 6 Self-Check: Asset-Trennung (Subvention NICHT in M3 geschrieben).
- Sektion 7 Übergabe.

**Excel-Handoff (in `docs/excel_handoff.md`):**
- `MIETER!Y8:Y<7+N>` ← `modul_4.we_mieten[].mietspiegel_obergrenze_eur_pro_qm` (Modul 4)
- `VERKAUFSMATRIX!<Extra-Spalte>` ← `modul_4.mietsubventionen_summe_eur_pro_monat` (genaue Zelle aus Template verifizieren; bis dahin TODO)

- [ ] **Step 16.3: Mini-Test mit Mietspiegel-Lookup für Essen-Dellwig**

Test: realistische Daten Prosperstr. → Sollmiete ~7–8 €/m². Validator exit 0. `modul-4-output.md` enthält DREI Pflicht-Tabellen in fester Reihenfolge.

- [ ] **Step 16.4: Commit**

```bash
git add skills/aufteiler-modul-4-miete/SKILL.md docs/excel_handoff.md
git commit -m "Aufteiler Skill aufteiler-modul-4-miete v1.0: Tiefenstufen 1–6 + Mietsubvention separat von Reno"
```

---

### Task 17: Phase-3-Smoke-Test (Vollanalyse 0→4 mit Dummy-Objekt)

Ziel: In frischer Session „Vollanalyse für Testadresse" sagen, Sequenz 0→1→2→3→4 durchlaufen, jeweils Freigabe geben, am Ende prüfen:
- `state.json` enthält `modul_0` … `modul_4` vollständig
- `runs/<slug>/modul-0-output.md` … `modul-4-output.md` existieren
- Validator exit 0
- Asset-Trennung respektiert
- RND-freeze respektiert (Modul 3 hat `modul_2.rnd_jahre` nicht verändert)

- [ ] **Step 17.1: Test durchführen, Ergebnis dokumentieren**

In `plans/2026-05-12-aufteiler-skill-umbau-tests.md` Sektion „Phase 3 Smoke" anhängen.

- [ ] **Step 17.2: Reproduzierbarkeits-Test (Zone A/B)**

Selben Input zweimal in zwei frischen Sessions durchlaufen, `runs/<slug>_run1/` und `runs/<slug>_run2/` (Slug temporär anpassen). Dann:
```bash
diff -q runs/test-strasse-run1/modul-1-output.md runs/test-strasse-run2/modul-1-output.md
```
Erwartet: Zone A und B byte-identisch (Tabellen + Tiefenstufen-Zeilen). Zone C darf abweichen.

- [ ] **Step 17.3: Phase-3-Tag**

```bash
git tag -a phase-3-module-1-bis-4 -m "Aufteiler Skill-Umbau Phase 3 abgeschlossen: Module 1–4 lauffähig, Reproduzierbarkeits-Test bestanden"
git push origin main --tags
```

---

## Phase 4 — Modul 5 + PDF-Form-Skill + Cleanup

Ziel: PDF-Form-Skill aus altem `skill_pdf_export.md` übersetzt; Modul 5 mit Platzhalter-Score; End-to-End-Test; Doku aktualisiert.

### Task 18: PDF-Form-Skill `aufteiler-pdf-export`

**Files:**
- Modify: `skills/aufteiler-pdf-export/SKILL.md`

- [ ] **Step 18.1: Quelle lesen**

Read: `archive/skill_pdf_export.md` (komplette Datei).

- [ ] **Step 18.2: Inhalt 1:1 in neue Skill-Datei übertragen, mit angepasstem Frontmatter**

Inhalt `skills/aufteiler-pdf-export/SKILL.md`:

```markdown
---
name: aufteiler-pdf-export
description: Form-Skill für den PDF-Export von Modul 5 (aufteiler-modul-5-deal-bewertung). Verbindliche reportlab-Layout-Regeln — Spaltenbreiten, Farben, Word-Wrap, KeepTogether, kein Emoji, Hyperlinks. Wird ausschließlich von Modul 5 aufgerufen.
---

# Aufteiler PDF-Export Form-Skill

[Inhalt aus archive/skill_pdf_export.md ab Section 1 (Pflicht-Regeln) bis Ende komplett übernehmen — R1 bis R13, Farbpalette, Code-Bausteine, Anti-Patterns, Versions-Block.]
```

**Wichtig:** Im Versions-Block (Sektion 4) ergänzen:
```
## v1.2 (2026-05-12)
- Migration von archive/skill_pdf_export.md zum Skill-Namespace.
- Frontmatter angepasst: aus type/version-Feldern (alt) → Standard-Skill-Frontmatter (name/description).
- Inhaltliche Regeln R1–R13 unverändert.
```

- [ ] **Step 18.3: Commit**

```bash
git add skills/aufteiler-pdf-export/SKILL.md
git commit -m "Aufteiler Skill aufteiler-pdf-export v1.2: Migration aus archive/skill_pdf_export.md"
```

---

### Task 19: Modul 5 — Deal-Bewertung (mit Platzhalter-Score)

**Files:**
- Modify: `skills/aufteiler-modul-5-deal-bewertung/SKILL.md`

- [ ] **Step 19.1: Quelle lesen**

Read: `archive/modul_5_verdict.xml` (Inhalt-Sektionen). Notiere: welche Charts (11 matplotlib), welche Excel-Comments / Notiz-Zellen.

Read: `plans/2026-05-12-score-logik-modul-5-offen.md` (Platzhalter-Konzept).

- [ ] **Step 19.2: Modul 5 schreiben**

Pflicht-Inhalte:
- Sektion 1: Pflicht-Vorgänger `modul_0` … `modul_4` ALLE gesetzt (jeweils `status` vorhanden).
- Sektion 2 Inputs: keine User-Inputs (konsumiert nur State).
- Sektion 3 Logik:
  - **Platzhalter-Score:** Ampel-Aggregation aus Tiefenstufen + Konfidenz der Module 0–4:
    ```
    base_score = 70
    for m in [modul_0, modul_1, modul_2, modul_3, modul_4]:
        if m.status == "rot": base_score -= 10
        elif m.status == "gelb": base_score -= 5
        if m.konfidenz == "niedrig": base_score -= 5
        elif m.konfidenz == "mittel": base_score -= 2
    bewertungs_score = max(0, min(100, base_score))
    ```
    **Hinweis im Skill:** "Diese Logik ist ein Platzhalter. Echte Score-Methodik folgt — siehe plans/2026-05-12-score-logik-modul-5-offen.md. Nur die Befüllung wird ausgetauscht; State-Feld bleibt."
- Sektion 4 Outputs:
  - PDF generieren (delegiert an `aufteiler-pdf-export`-Skill für Layout-Regeln).
  - Excel-Kopie: `template/Kalkulation_Aufteiler_mit_VK_CF.xlsx` → `runs/<slug>/Kalkulation_<Strassenkurz>.xlsx`. Werte aus `state.json` gemäß `docs/excel_handoff.md` einsetzen via `openpyxl` (oder Subprocess auf Excel falls openpyxl Formel-Problem).
  - Drei Zonen wie immer.
- Sektion 5 Persist: `modul_5`-Block mit `bewertungs_score`, `pdf_pfad` (relativ z.B. `Aufteiler_<slug>.pdf`), `excel_pfad`.
- Sektion 6 Self-Check: PDF-Datei existiert auf Platte; Excel-Datei existiert; alle Pflicht-Zellen in Excel ≠ leer.
- Sektion 7 Übergabe.

- [ ] **Step 19.3: Commit**

```bash
git add skills/aufteiler-modul-5-deal-bewertung/SKILL.md
git commit -m "Aufteiler Skill aufteiler-modul-5-deal-bewertung v1.0: Platzhalter-Score + PDF + Excel-Handoff"
```

---

### Task 20: End-to-End-Test (Vollanalyse + Modul 5 PDF)

Ziel: Reales Daten-Set (Prosperstraße) komplett durchlaufen 0→1→2→3→4, dann auf Anfrage Modul 5 — PDF + Excel werden korrekt erzeugt.

- [ ] **Step 20.1: Test ausführen**

Frische Session: „Vollanalyse Prosperstr. 59, 45356 Essen-Dellwig" → Sequenz mit echten Daten durchlaufen.

Nach Modul 4 grün: „Deal-Bewertung als PDF" → Modul 5 sollte:
1. PDF `runs/prosperstr-59-essen-dellwig/Aufteiler_Prosperstr-59.pdf` erzeugen
2. Excel `runs/prosperstr-59-essen-dellwig/Kalkulation_Prosperstr-59.xlsx` mit befüllten Zellen erzeugen
3. `modul_5`-Block in `state.json` mit `bewertungs_score`, `pdf_pfad`, `excel_pfad`

- [ ] **Step 20.2: Compression-Test**

In komplett neuer Session (kein Chat-History): „PDF für prosperstr-59-essen-dellwig nochmal aus existierendem State erzeugen". Erwartet: Modul 5 läuft, liest State aus Datei, generiert PDF erneut OHNE Rückfragen zu Werten aus früheren Modulen.

- [ ] **Step 20.3: Ergebnisse dokumentieren**

In `plans/2026-05-12-aufteiler-skill-umbau-tests.md` Sektion „Phase 4 E2E + Compression-Test" anhängen.

---

### Task 21: README.md und ARCHITEKTUR.md aktualisieren

**Files:**
- Modify: `c:\meine-projekte\Immobilien\Aufteiler\README.md`
- Modify: `docs/ARCHITEKTUR.md`
- Modify: `docs/README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 21.1: README.md — neue Sektion „Skill-Suite (ab 2026-05-12)" einfügen, alte XML-Workflow-Beschreibung als „Archiv-Hinweis" kennzeichnen.**

Read aktuelles `README.md`, ersetze die Workflow-Sektion.

Neuer Inhalt (Auszug — den passenden Teil ersetzen):

```markdown
## Skill-Suite (ab 2026-05-12)

Aufteiler läuft als Markdown-Skill-Suite in Claude Code:
- Orchestrator: `skills/aufteiler/`
- Module 0–5: `skills/aufteiler-modul-N-*/`
- PDF-Form: `skills/aufteiler-pdf-export/`

Persistenter State pro Objekt: `runs/<slug>/state.json` (gitignored).
Schema: `docs/state-schema.md` + maschinell `docs/state.schema.json`.
Excel-Zell-Verträge: `docs/excel_handoff.md`.

Sichtbarkeit in Claude Code via Windows-Junction — Setup einmalig:
```powershell
.\setup-junctions.ps1
```

Vorherige XML-basierte Web-Claude-Lösung: siehe `archive/` (Rollback-Quelle).
```

- [ ] **Step 21.2: docs/ARCHITEKTUR.md — aktualisieren**

Read aktuelles `docs/ARCHITEKTUR.md`. Neue Sektion „Architektur ab 2026-05-12 (Skill-Suite)" mit Diagramm aus Spec Sektion 2 einfügen. Alte XML-Architektur-Sektion mit „**Veraltet** — siehe `archive/`" markieren.

- [ ] **Step 21.3: docs/README.md — Index aktualisieren**

Read aktuelles `docs/README.md`. Eintrag pro Modul-Skill ergänzen, Eintrag für `state-schema.md` + `state.schema.json` + `excel_handoff.md` + `_TEMPLATE_MODUL_SKILL.md` ergänzen.

- [ ] **Step 21.4: CLAUDE.md — Workflow-Sektion anpassen**

Read aktuelles `CLAUDE.md`. „Vor jeder Aufgabe (Pflicht-Reads)" und „Nach jeder Aufgabe (Pflicht-Writes)" leicht anpassen — XML-Verweise entfernen, Skill-Verweise aufnehmen. Beispiel:

Ersetze:
> "Modul-Autarkie. Jedes Modul liefert seinen eigenen Excel-Transfer-Block. Module rufen einander nicht auf — der Orchestrator sequenziert."

Mit:
> "Modul-Autarkie. Jedes Modul-Skill liest aus `state.json`, schreibt seinen Block dorthin, liefert Excel-Zellen gemäß `docs/excel_handoff.md`. Module rufen einander nicht auf — der `aufteiler`-Orchestrator dispatcht."

Außerdem im Stack-Abschnitt „Workflow-Format: XML (Module) + Markdown (Skills, Doku)" zu „Markdown-Skill-Suite (`skills/`) mit State unter `runs/<slug>/state.json`" ändern.

- [ ] **Step 21.5: Commit**

```bash
git add README.md docs/ARCHITEKTUR.md docs/README.md CLAUDE.md
git commit -m "Aufteiler Docs: README/ARCHITEKTUR/CLAUDE auf Skill-Suite umgestellt"
```

---

### Task 22: Entscheidung über `archive/`-Löschung

**Files (eventuell):**
- Delete: `archive/` (nur nach User-Bestätigung)

- [ ] **Step 22.1: User explizit fragen**

```
Phase 4 grün, E2E-Test bestanden. archive/ enthält alte XMLs als Rollback-Quelle.
Soll archive/ behalten oder per `git rm -r archive/` gelöscht werden?
(behalten = sicher; löschen = sauber, Historie bleibt via git log + git checkout <commit>)
```

- [ ] **Step 22.2: User-Antwort umsetzen**

Bei „löschen":
```bash
git rm -r archive/
git commit -m "Aufteiler: archive/ entfernt (Historie via git log)"
```

Bei „behalten": kein Commit, weiter zu Step 22.3.

- [ ] **Step 22.3: Phase-4-Tag und Push**

```bash
git tag -a phase-4-skill-suite-komplett -m "Aufteiler Skill-Umbau Phase 4 abgeschlossen: Modul 5 + PDF + Cleanup + Doku"
git push origin main --tags
```

---

## Akzeptanzkriterien-Abgleich (Spec § 13)

Vor Plan-Abschluss diese Checkliste durchgehen — jedes Häkchen entspricht einem Spec-Akzeptanzkriterium:

- [ ] Alle 8 Skill-Ordner existieren und funktionsfähig sind → Task 3 + Task 10 + 11 + 13–16 + 18 + 19
- [ ] Junction-Setup dokumentiert und einmalig ausgeführt → Task 4
- [ ] `state.json`-Schema in `docs/state-schema.md` dokumentiert, von jedem Modul validiert → Task 5 + 6, Modul-Tasks rufen Validator
- [ ] Vollanalyse 0→1→2→3→4 läuft ohne Modus-Sprung durch → Task 17
- [ ] Reproduzierbarkeits-Test: zweimal gleicher Input erzeugt identische Zone A + B → Task 17.2
- [ ] RND-freeze: M3 kann `modul_2.rnd_jahre` nicht überschreiben (Schema enforced `const true`) → Task 5.2 + 15
- [ ] Asset-Trennung: Rücklage/Mietsubvention nicht im Reno-Block → Task 6 Validator + Task 15 + 16
- [ ] Compression-Test: PDF aus existierendem State ohne Rückfragen erzeugbar → Task 20.2
- [ ] Modul 5 PDF mit Platzhalter-Score erfolgreich erzeugt → Task 19 + 20
- [ ] Alte XMLs in `archive/` per `git mv` (Historie erhalten) → Task 1

---

## Status

- [x] **PHASE 1** — Fundament (Tasks 1–8): Archive, .gitignore, Skill-Stubs, Junctions, Schema, Validator, Excel-Handoff-Skeleton, Smoke-Test ✓ (Tag `phase-1-fundament`)
- [x] **PHASE 2** — Orchestrator + Modul 0 (Tasks 9–12): Modul-Template, Orchestrator, Modul 0 Quick-Check, Smoke-Test ✓ (Tag `phase-2-orchestrator-und-modul-0`)
- [x] **PHASE 3** — Module 1–4 (Tasks 13–17): Objektbasis, RND/AfA, Massnahmen, Mietsituation, Vollanalyse-Smoke-Test 0→4 ✓ (Tag `phase-3-module-1-bis-4`)
- [x] **PHASE 4** — Modul 5 + PDF + Cleanup (Tasks 18–22): PDF-Form-Skill migriert, Modul 5 mit Platzhalter-Score, E2E + Compression-Test funktional, Doku-Update, archive behalten ✓ (Tag `phase-4-skill-suite-komplett`)

**Skill-Umbau funktional abgeschlossen 2026-05-12.** 10/10 Akzeptanzkriterien erfüllt (siehe `plans/2026-05-12-aufteiler-skill-umbau-tests.md`).

**Offene Punkte für Live-Roll-out (separate Plans):**
1. KALKU-Zell-Adressen Excel-Template (vor erstem Live-Modul-5-Lauf)
2. Brutto/Netto-Verifikation `RENO`-Sheet
3. Live-Skill-Tool-Dispatch-Test (frische Session, echtes Objekt)
4. Reproduzierbarkeits-Test Zone A/B
5. Echte Score-Methodik (siehe `plans/2026-05-12-score-logik-modul-5-offen.md`)
