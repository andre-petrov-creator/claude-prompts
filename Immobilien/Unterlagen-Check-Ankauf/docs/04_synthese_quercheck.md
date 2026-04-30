# Schritt 3: Synthese & Quercheck

> Master: [`../SKILL.md`](../SKILL.md), Sektion `### Schritt 3: Synthese & Quercheck (sequentiell)`

## Zweck

Cross-Document-Logik: stimmen die Einzelreports untereinander? Wohnfläche, Baujahr, Mieten, Heizungssystem etc. — wenn Dokumente sich widersprechen, ist das ein Red Flag.

## Files

- `SKILL.md` — Quercheck-Matrix (welche Felder werden gegen welche verglichen)

## Datenfluss

```
Map aller Einzelreports (aus Schritt 2)
  → Quercheck-Matrix: zentrale Felder extrahieren
  → Inkonsistenzen markieren (z.B. Wohnfläche WGB vs. Mietverträge vs. Energieausweis)
  → Output: Liste der Inkonsistenzen + bestätigte Werte (Konsens)
```

## Schnittstellen

- **Input:** alle Einzelreports aus Schritt 2
- **Output:** Quercheck-Inkonsistenzen-Liste + Konsens-Werte → Input für Schritt 4, 4.5, 5

## Bekannte Limitierungen

- TODO
