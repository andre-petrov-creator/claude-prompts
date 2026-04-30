# Schritt 4: Aufteiler-Risiken (bedingt)

> Master: [`../SKILL.md`](../SKILL.md), Sektion `### Schritt 4: Aufteiler-Risiken (falls Strategie aktiv)`

## Zweck

Bedingter Schritt: nur wenn der User Aufteiler-Strategie (Aufteilung in Eigentumswohnungen + Einzelverkauf) verfolgt. Prüft auf Aufteiler-Killer: § 577 BGB Vorkaufsrecht, § 577a BGB Sperrfrist, Erbbaurecht, ungünstige WEG-Konstellationen, NRW-spezifische Sperrfristen.

## Files

- `SKILL.md` — Aufteiler-Risiken-Katalog + NRW/Ruhrgebiet-Spezifika

## Datenfluss

```
Konsens-Werte aus Schritt 3 + Mietverträge (Mieterstruktur)
  → Prüfung gegen Aufteiler-Killer-Liste:
    - § 577 BGB / § 577a BGB Sperrfristen
    - Erbbaurecht / Wege- / Leitungsrechte
    - Mieterklassen (Senioren, langjährig, sozialer Wohnungsbau)
    - NRW-Spezifika (z.B. Mietpreisbremse, Soziale Erhaltungssatzung)
  → Output: Aufteiler-Risiko-Score (kritisch / mittel / unkritisch)
```

## Schnittstellen

- **Input:** Konsens-Werte (Schritt 3), Mieterliste, Lage-Info
- **Output:** Aufteiler-Risiko-Block → fließt in Gesamtreport (Schritt 5)
- **Aktiviert nur wenn:** User-Strategie = Aufteiler

## Bekannte Limitierungen

- TODO
