# Schritt 4: Aufteiler-Risiken (bedingt)

> Master: [`../SKILL.md`](../SKILL.md), Sektion `### Schritt 4: Aufteiler-Risiken (bedingt — nur bei Aufteiler-Strategie)`

## Zweck

Bedingter Schritt: nur wenn der User Aufteiler-Strategie (Aufteilung in Eigentumswohnungen + Einzelverkauf) verfolgt. Prüft auf Aufteiler-Killer: § 577 BGB Vorkaufsrecht, § 577a BGB Sperrfrist, Erbbaurecht, ungünstige WEG-Konstellationen, bundeslandspezifische Sperrfristen, kommunale Erhaltungssatzungen.

## Files

- `SKILL.md` Schritt 4 — orchestriert
- `references/aufteiler-risiken.md` — Risiko-Matrix-Schema + Strategie-Szenarien (A/B/C)
- Standort-Live-Variablen aus Schritt 1 (Sperrfrist, Kappung, Mietpreisbremse, Erhaltungssatzung)

## Datenfluss

```
Mietverträge (Schritt 2) + Quercheck-Ergebnisse (Schritt 3)
  + Standort-Live-Variablen (Schritt 1)
  → Risiko-Matrix pro Mietverhältnis (siehe references/aufteiler-risiken.md):
      - § 577 BGB Vorkaufsrecht (Stichtag Aufteilung beachten)
      - § 577a BGB Sperrfrist (live aus Verordnung des Bundeslandes)
      - § 574 BGB Härtefall (Mieterstruktur)
      - Soziale Erhaltungssatzung (live, kommunal)
  → Strategie-Szenarien A (Voll), B (Teil), C (Halten + Heben)
  → Empfehlung
  → KO-Frühabbruch wenn Quercheck W7 = Förderbindung aktiv
```

## Schnittstellen

- **Input**: Mieterstruktur (Subagent 06/07), Quercheck-Ergebnisse (Schritt 3), Standort-Live-Variablen (Schritt 1)
- **Output**: Aufteiler-Risiko-Block → fließt in Gesamtreport (Schritt 5)
- **Aktiviert nur wenn**: User-Strategie = Aufteiler (in Schritt 1 abgefragt)

## Bekannte Limitierungen

- Vorkaufsrecht-Stichtag § 577 Abs. 1a setzt voraus, dass Aufteilungsdatum (TE im Grundbuch) bekannt ist — bei reinen Vorbereitungs-Käufen (noch keine TE) ist dieser Stichtag = Käufer-Aufteilungsdatum, was strategisch beeinflussbar ist
- § 574 BGB Härtefall ist immer Einzelfall-Wertung; "wahrscheinlich" / "unwahrscheinlich" ist Heuristik
- Kommunale Erhaltungssatzung ändert sich häufig — Stand-Datum der Live-Recherche beachten
