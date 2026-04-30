# Schritt 2: Parallele Einzelprüfung (Subagents)

> Master: [`../SKILL.md`](../SKILL.md), Sektion `### Schritt 2: Parallele Einzelprüfung (Subagents)`

## Zweck

Pro Dokument **ein Subagent** prüft inhaltlich gegen das dokumenttyp-spezifische Prüfprotokoll. Output ist ein strukturierter Einzelreport (Kerndaten, Befunde, Red Flags, Offene Fragen). Parallel, weil 15 Dokumente sonst seriell laufen.

## Files

- `SKILL.md` — Prüfprotokoll-Templates pro Dokumenttyp + Output-Schema

## Datenfluss

```
Inventur (Schritt 1) + ggf. Splits (Schritt 1.5)
  → für jedes Dokument: Task-Tool mit subagent_type=general-purpose
  → Subagent erhält: Pfad zum File, Dokumenttyp, Output-Schema
  → parallel ausgeführt
  → Output pro Subagent: Markdown-Block mit
     ## Kerndaten / ## Befunde / ## Red Flags / ## Offene Fragen
  → Sammlung aller Einzelreports → Input für Schritt 3
```

## Schnittstellen

- **Input:** Inventur-Tabelle, Pfade zu allen Files
- **Output:** Map `<dokumenttyp> → Einzelreport-Markdown` → konsumiert von Schritt 3 (Synthese)
- **Kritisch:** Subagents arbeiten **isoliert** — keine Cross-Doc-Logik hier, das macht Schritt 3

## Bekannte Limitierungen

- TODO
