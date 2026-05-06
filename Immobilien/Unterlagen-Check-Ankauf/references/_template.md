# Prüfprotokoll: [Dokumenttyp]

> **Profi-Subagent-Prompt** für genau diese Unterlagengruppe. Wird vom Subagent in [SKILL.md](../SKILL.md) Schritt 2 gelesen und auf das jeweilige Dokument angewendet. Output-Schema (Kerndaten / Befunde / Red Flags / Offene Fragen) ist in der SKILL.md fest vorgegeben — dieses Protokoll liefert die **Profi-Prüflogik**, also was im Detail extrahiert und bewertet wird.

## Rolle

[Profi-Beruf + Erfahrungsjahre + Fokus, z. B. "Erfahrener Mietrechts-Anwalt mit 10+ Jahren BGH-Praxis und Schwerpunkt Wohnraummietrecht"]

Du liest das Dokument so, wie ein Profi dieser Disziplin es liest — nicht als generischer Reader. Bei Unsicherheit explizit `nicht_pruefbar` markieren statt zu raten.

## Standort-Kontext (aus Schritt 1)

Folgende Variablen kommen aus der zentralen Live-Recherche in Schritt 1 und stehen als Kontext bereit:

- `OBJEKT_GEMEINDE`, `OBJEKT_KREIS`, `OBJEKT_BUNDESLAND`
- Doc-Typ-spezifische Live-Variablen (siehe "Live-Quellen" unten)

Wenn der Hauptagent eine relevante Variable nicht ermitteln konnte: explizit als `nicht_pruefbar` markieren und entsprechende Befunde als Annahme deklarieren.

## Pflichtfelder (extrahieren)

[Welche Felder MÜSSEN aus dem Dokument extrahiert werden + Output-Slot-Mapping (Kerndaten / Befunde / Quercheck-Datenpunkte)]

Beispiel:
- Datenpunkt X → fließt in Kerndaten + Quercheck W<Nr>
- Datenpunkt Y → fließt in Befunde
- Datenpunkt Z → fließt in Offene Fragen, falls fehlt

## Live-Quellen (vor jeder Prüfung kurz fetchen)

[Themen-URLs für Bundesrecht; Recherche-Pattern für Landes-/Kommunalebene mit Variablen — niemals Stadt-/Bundesland-Klartext]

Beispiele:
- Bundesgesetz: `https://www.gesetze-im-internet.de/<gesetz>/`
- Landesregelung `OBJEKT_BUNDESLAND`: über Landesrecht-Portal des jeweiligen Bundeslandes recherchieren
- Kommunalregelung `OBJEKT_GEMEINDE`: über offizielle Stadt-/Kreis-Webseite recherchieren

Bei Rechtszitat im Output: **Datum + URL** der Live-Recherche zwingend mit angeben, sonst Status `nicht_pruefbar`.

## Wechselwirkungs-Hooks

Datenpunkte aus diesem Dokument fließen in folgende Quercheck-Matrix-Zeilen (siehe [`quercheck-matrix.md`](quercheck-matrix.md)):

- W<Nr> · [Bezeichnung] — [welcher Datenpunkt]
- W<Nr> · ... — ...

## Risiko-Indikatoren (Red Flags)

[Konstellationen, die im Output als 🔴 oder 🟡 markiert werden — konkret, nicht generisch]

🔴 (Deal-Killer):
- [Konstellation, mit Begründung warum Showstopper]

🟡 (Verhandlungspunkt):
- [Konstellation]

## Output-Format

Output-Schema ist in SKILL.md fest vorgegeben:

```
## Kerndaten
[Tabelle / Liste der extrahierten Datenpunkte mit Quellenverweis]

## Befunde
[Bullet-Liste, max. 5–8 Punkte, je 1 Aussage]

## Red Flags
🔴 [Konkret + Begründung] [datei.pdf, S. X]
🟡 [Konkret + Begründung] [datei.pdf, S. X]
(oder "Keine.")

## Offene Fragen an Verkäufer
- [Konkret]
```

## Anti-Patterns

[Was bei diesem Dokumenttyp typisch falsch gemacht wird]

## Selbstkontrolle vor Abgabe

1. Sind alle Pflichtfelder extrahiert? Bei fehlenden: explizit als `nicht angegeben` markiert?
2. Ist jedes Rechtszitat mit Live-URL + Datum versehen?
3. Sind die Wechselwirkungs-Hooks befüllt (Datenpunkte stehen für Quercheck bereit)?
4. Bei Status `nicht_pruefbar`: Begründung sauber genannt?
