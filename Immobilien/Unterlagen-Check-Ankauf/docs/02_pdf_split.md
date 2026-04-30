# Schritt 1.5: Große PDFs splitten

> Master: [`../SKILL.md`](../SKILL.md), Sektion `### Schritt 1.5: Große PDFs splitten (falls nötig)`

## Zweck

Bedingter Schritt: nur falls Inventur (Schritt 1) PDFs > 25 MB markiert hat. Splittet diese in handhabbare Chunks, damit Subagents in Schritt 2 die Inhalte verarbeiten können.

## Files

- `SKILL.md` — Trigger-Logik
- [`../tools/pdf_split.py`](../tools/pdf_split.py) — Splitter-Implementierung

## Datenfluss

```
Inventur-Tabelle (Schritt 1) mit Markierung "Split nötig"
  → tools/pdf_split.py <pfad-zur-pdf>
  → Output: <originalname>_chunks/<originalname>_part_NN.pdf
  → Inventur-Tabelle wird mit Chunk-Pfaden ergänzt
```

## Schnittstellen

- **Input:** Pfad zur Original-PDF (> 25 MB)
- **Output:** Folder `<originalname>_chunks/` mit nummerierten PDF-Splits → werden in Schritt 2 als Subagent-Inputs verwendet

## Bekannte Limitierungen

- TODO
