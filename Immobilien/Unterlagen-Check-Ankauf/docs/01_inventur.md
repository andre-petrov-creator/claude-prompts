# Schritt 1: Inventur + Standort-Live-Recherche

> Master: [`../SKILL.md`](../SKILL.md), Sektion `### Schritt 1: Inventur + Standort-Live-Recherche (sequentiell)`

## Zweck

Vor jeder inhaltlichen Prüfung: was ist im Datenraum vorhanden, was fehlt, welche Dateien sind zu groß für direkte Subagent-Verarbeitung. Soll-Ist-Vergleich gegen MFH-Standard-Checkliste. **Plus**: standort-spezifische Live-Recherche, deren Ergebnisse als Kontext-Block an alle Subagents in Schritt 2 weitergereicht werden.

## Files

- `SKILL.md` Schritt 1 — Inventur-Logik + Standort-Variablen + Mapping
- *(keine eigenen Tools — Bash `ls`/`find` + WebFetch/WebSearch für Live-Recherche)*

## Datenfluss

```
User-Pfad zum Datenraum + (optional) Exposé + Kaufpreis + Bestand-Rücklage + Aufteiler-ja/nein
  → ls/find auf alle Files (rekursiv)
  → Größenprüfung pro File (>25 MB → Split-Markierung)
  → Mapping Dateiname → Dokumenttyp
  → Standort-Variablen aus Grundbuch / Adresse / Exposé:
     OBJEKT_ADRESSE, OBJEKT_GEMEINDE, OBJEKT_KREIS, OBJEKT_BUNDESLAND
  → Live-Recherche (zentral, einmalig, mit URL + Stand-Datum):
     - BORIS-Portal des OBJEKT_BUNDESLAND
     - Mietspiegel OBJEKT_GEMEINDE
     - Kappungsgrenzenverordnung OBJEKT_BUNDESLAND
     - Kündigungssperrfristverordnung OBJEKT_BUNDESLAND
     - Mietpreisbremse § 556d in OBJEKT_GEMEINDE
     - Kommunale Wärmeplanung OBJEKT_GEMEINDE
     - Soziale Erhaltungssatzung OBJEKT_GEMEINDE
     - Hebesatz Grundsteuer OBJEKT_GEMEINDE
     - DMB-BetrKV-Spiegel
  → Soll-Ist-Tabelle (alle 20 Soll-Positionen mit Status, auch n/a)
  → Output:
     - Inventur-Tabelle als Markdown
     - Standort-Block (alle Live-Variablen + URL + Stand)
```

## Schnittstellen

- **Input**: Pfad zum Datenraum-Ordner; User-Eingaben (Kaufpreis, Exposé, Bestand-Rücklage, Aufteiler-ja/nein)
- **Output**:
  - Inventur-Tabelle (Nr, Dokumenttyp, Datei, Größe, Status) → Schritt 1.5 + Schritt 2
  - Standort-Block (alle Live-Variablen) → Schritt 2 (an alle Subagents) + Schritt 4 + Schritt 4.5

## Bekannte Limitierungen

- Live-Recherche ist abhängig von WebFetch/WebSearch-Verfügbarkeit (offline nicht möglich)
- Bei nicht ermittelbarer Live-Variable: explizit `nicht_pruefbar` markieren — Subagents müssen damit umgehen können
- Mapping Dateiname → Dokumenttyp ist heuristisch (Dateinamen sind nicht standardisiert) — bei unbekanntem Typ → Fallback "kein Profi-Subagent"
