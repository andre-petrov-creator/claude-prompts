# Schritt 1: Inventur

> Master: [`../SKILL.md`](../SKILL.md), Sektion `### Schritt 1: Inventur (sequentiell)`

## Zweck

Vor jeder inhaltlichen Prüfung: was ist im Datenraum vorhanden, was fehlt, welche Dateien sind zu groß für direkte Subagent-Verarbeitung. Soll-Ist-Vergleich gegen MFH-Standard-Checkliste.

## Files

- `SKILL.md` — Inventur-Logik + Soll-Liste + Mapping Dokumenttyp → Prüfprotokoll
- *(keine eigenen Tools — nur Bash `ls` / `find`)*

## Datenfluss

```
User-Pfad zum Datenraum
  → ls/find auf alle Files (rekursiv)
  → Größenprüfung pro File
  → Mapping Dateiname → Dokumenttyp
  → Soll-Ist-Tabelle (vorhanden / fehlt / split nötig)
  → Output: Inventur-Tabelle als Markdown
```

## Schnittstellen

- **Input:** Pfad zum Datenraum-Ordner (vom User oder aus Kontext)
- **Output:** Inventur-Tabelle (Nr, Dokumenttyp, Datei, Größe, Status) → wird Input für Schritt 1.5 und Schritt 2

## Bekannte Limitierungen

- TODO
