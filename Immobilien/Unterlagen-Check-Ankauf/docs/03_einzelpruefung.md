# Schritt 2: Parallele Profi-Subagent-Einzelprüfung

> Master: [`../SKILL.md`](../SKILL.md), Sektion `### Schritt 2: Parallele Profi-Subagent-Einzelprüfung`

## Zweck

Pro Dokumentengruppe **ein Profi-Subagent** prüft inhaltlich gegen das dokumenttyp-spezifische Profi-Protokoll. Output ist ein strukturierter Einzelreport (Kerndaten, Befunde, Red Flags, Offene Fragen). Parallel, weil 15 Dokumente sonst seriell laufen.

**Profi statt generisch**: Jeder Subagent erhält eine fachliche Rolle (Mietrechts-Anwalt, Energieberater, Steuerberater, …) plus Pflichtfelder, Live-Quellen, Wechselwirkungs-Hooks, Risiko-Indikatoren, Anti-Patterns und Selbstkontrolle. Definition pro Dokumenttyp in `references/NN-*.md`.

## Files

- `SKILL.md` — Subagent-Prompt-Template, Standort-Block-Pass-Through, Output-Schema
- [`../references/`](../references/) — **Profi-Protokolle pro Dokumenttyp** (20 Profis, eines pro Subagent-Aufgabe)
- [`../references/_template.md`](../references/_template.md) — Vorlage für künftige Profi-Protokolle

## Datenfluss

```
Inventur (Schritt 1) + Standort-Block (Schritt 1) + ggf. Splits (Schritt 1.5)
  → für jedes Dokument: Task-Tool mit subagent_type=general-purpose
  → Subagent erhält:
     - Pfad zum File
     - Dokumenttyp
     - Pfad zum Profi-Protokoll (references/<NN>-<typ>.md)
     - Standort-Block (alle Live-Variablen mit URL + Stand)
     - Output-Schema
  → parallel ausgeführt (alle Task-Calls in einer Response)
  → Output pro Subagent: Markdown-Block mit
     ## Kerndaten (mit "→ W<Nr>"-Markierungen für Quercheck-Hooks)
     ## Befunde
     ## Red Flags
     ## Offene Fragen
  → Sammlung aller Einzelreports → Input für Schritt 3
```

## Fallback bei unbekanntem Dokumenttyp

Wenn Inventur einen Doc-Typ findet, der KEIN Mapping hat:
1. Generischer Subagent läuft (Output mit `profi_profil: "fallback_generisch"`)
2. Hauptagent vermerkt im finalen Report den Hinweis "Kein Profi-Subagent für [TYP], Empfehlung: `references/NN-<typ>.md` neu anlegen"

## Schnittstellen

- **Input**: Inventur-Tabelle, Standort-Block, Pfade zu allen Files
- **Output**: Map `<dokumenttyp> → Einzelreport-Markdown` → konsumiert von Schritt 3 (Synthese)
- **Kritisch**: Subagents arbeiten **isoliert** — keine Cross-Doc-Logik hier, das macht Schritt 3 mit der Wechselwirkungs-Matrix

## Bekannte Limitierungen

- Profi-Inhalt der 20 Reference-Dateien ist v0.1: vereinheitlichte Struktur (Rolle, Pflichtfelder, Live-Quellen, Wechselwirkungs-Hooks, Risiko-Indikatoren) ist gesetzt. Tiefere Red-Flag-Patterns (z. B. konkrete BGH-Urteile mit Aktenzeichen, regionale Marktbenchmark-Quellen, branchenspezifische Anti-Patterns) bleiben Iteration 02
- Live-Recherche durch Subagent setzt WebFetch-Verfügbarkeit voraus. Wenn nicht: Status `nicht_pruefbar`
- Subagent ohne Profi-Reference (Fallback-Generisch) liefert nur oberflächliche Prüfung
