# Development Guidelines

Konventionen für die Pflege und Erweiterung des Unterlagen-Check-Skills.

## Workflow-Aufbau

### Schritt-Numerierung

- Hauptschritte: ganze Zahlen (`Schritt 1`, `Schritt 2`, …)
- Optionale / bedingte Zwischenschritte: Dezimal (`Schritt 1.5`, `Schritt 4.5`)
- Pro Schritt **eine** klar abgegrenzte Aufgabe — kein Mischen von Inventur und Inhaltsprüfung

### Sequenziell vs. Parallel

- **Sequenziell** (Default): Inventur, Synthese/Quercheck, Aufteiler-Risiken, Wirtschaftliche Validierung, Gesamtreport, PDF-Export
- **Parallel** (Subagents via Task-Tool): nur Einzelprüfung (Schritt 2). Pro Dokument **ein** Subagent
- **Niemals**: parallele Schritte, die voneinander Daten erwarten

### Subagent-Pattern (Schritt 2)

Pro Subagent-Aufruf:
- `subagent_type: general-purpose`
- Klar umrissene Aufgabe (genau ein Dokument prüfen)
- Output-Schema fix: Kerndaten, Befunde, Red Flags, Offene Fragen
- Keine Cross-Doc-Logik im Subagent — die kommt in Schritt 3

## Output-Format

### Einzelreports (Schritt 2-Output)

```
## Kerndaten
[Tabelle oder Liste]

## Befunde
[Fließtext, max. 5–8 Punkte]

## Red Flags
[Bullet List, jede Zeile ≤ 1 Satz]

## Offene Fragen an Verkäufer
[Numbered List]
```

### Risk-Score-Skala

- 🔴 **Sofort klären** (vor Vertragsunterschrift) — Deal-Killer-Risiko
- 🟡 **Vor Notar nachverhandeln** — Preis-/Klausel-relevant
- 🟢 **Erledigt / unkritisch** — Dokumentation, kein Action-Item

### Tabellen-Style

- Spaltenbreite gleichmäßig, kein erzwungenes Alignment
- Header **immer** mit `|---|` separator
- Zahlen rechtsbündig, Text linksbündig (default in Markdown)

## Tool-Nutzung

### `tools/pdf_split.py`

- Trigger: PDF > 25 MB
- Input: Pfad zur Original-PDF
- Output: gesplittete PDFs in `<originalname>_chunks/`
- Aufruf aus SKILL.md Schritt 1.5

### `tools/report_to_pdf.py`

- Trigger: nur in Schritt 6 (PDF-Export)
- Input: Markdown-Report-Pfad
- Output: PDF nach Layout-Regeln R1–R13 (siehe Aufteiler `skill_pdf_export.md` als Referenz für Layout-Logik)
- **Niemals** automatisch — Schritt 6 läuft nur auf explizite User-Anfrage

## Frontmatter-Regeln (SKILL.md)

- `name`: kebab-case, max. 40 Zeichen
- `description`: präziser Trigger-Katalog (Keywords, Dokumenttypen, Use-Case-Abgrenzung), 1 Absatz, **kein Zeilenumbruch**
- Bei Description-Änderung: User-Triggert ggf. Änderung in `~/.claude/projects/.../memory/` ankündigen

## Versionierung

- Inhaltliche Änderungen am Skill: Commit-Message-Prefix `Unterlagen-Check-Ankauf:`
- Neue Dokumenttypen / Schritte: zusätzlich `docs/`-Eintrag aktualisieren
- Tool-Änderungen: Commit-Prefix `Unterlagen-Check-Ankauf/tools:`

## Externe Dependencies

- **Python-Pakete in tools/**: nur Standard-Lib + bereits genutzte (`pypdf`, `markdown2`, `weasyprint` o.ä.). Vor Hinzufügen neuer Pakete: Begründung in PR / Commit-Body.
- **Notion / Web-APIs**: nicht von tools/ aus aufrufen — der Skill läuft offline-fähig.

## Testing

- Manuelle Test-Pakete: Datenraum-Folder mit 5–15 PDFs, davon mindestens einer > 25 MB
- Akzeptanzkriterium pro Schritt: Output entspricht Format-Spec, keine Halluzinationen über fehlende Dokumente
- Regression-Sanity: Aufteiler-Risiken-Sektion erscheint nur wenn Strategie aktiv (Schritt 4)

## Don'ts

- **Keine** Layout-Logik in der SKILL.md — gehört in `tools/report_to_pdf.py` oder dedizierte Skill-Referenz
- **Keine** Vermischung von Investoren- und Bankensicht in einem einzelnen Befund
- **Keine** stillen Fallbacks bei fehlenden Dokumenten — explizit als "fehlt" markieren
- **Keine** Domain-Logik in tools/-Scripts — die machen Format-Konvertierung, sonst nichts
