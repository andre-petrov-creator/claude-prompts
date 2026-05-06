# Aufteiler-Risiken — Risikomatrix + Strategie-Szenarien

> Referenziert von [SKILL.md](../SKILL.md) Schritt 4 (Aufteiler-Risiken). Wird vom Hauptagent angewendet, wenn der Nutzer Aufteiler-Strategie verfolgt (Aufteilung in Eigentumswohnungen + Einzelverkauf nach WEG).

## Voraussetzung — Live-Recherche aus Schritt 1

Folgende Variablen müssen aus Schritt 1 (Inventur + Standort-Recherche) vorliegen:

- `OBJEKT_GEMEINDE`, `OBJEKT_KREIS`, `OBJEKT_BUNDESLAND`
- `SPERRFRIST_§577a`: aktuelle Kündigungssperrfristverordnung des Bundeslandes (Live-Recherche), Geltungsbereich (welche Gemeinden), Dauer in Jahren
- `KAPPUNGSGRENZE_§558_3`: aktuelle Kappungsgrenzenverordnung des Bundeslandes (Live-Recherche), Geltungsbereich, Prozent in 3 Jahren
- `MIETPREISBREMSE_§556d`: ist die Gemeinde als angespannter Wohnungsmarkt verordnet? (Live-Recherche)
- `SOZIALE_ERHALTUNGSSATZUNG`: greift eine Milieuschutzsatzung am Objektstandort? (Live-Recherche, Stadtteil-genau)

Wenn eine Variable nicht ermittelbar: explizit als `nicht_pruefbar` markieren und Empfehlung an User: über Mietverein, Anwalt, oder Bauamt klären.

---

## Risiko-Matrix pro Mietverhältnis

### Spalten

| Spalte | Inhalt |
|---|---|
| WE | Wohneinheit (Bezeichnung) |
| Mietbeginn | Datum aus Mietvertrag |
| Mietdauer | Jahre, gerechnet ab heute |
| Mieteralter (geschätzt) | falls aus Mieterliste / Mieterstammblatt ableitbar, sonst `unbekannt` |
| Soziale Härte (vermutet) | hoch / mittel / gering (siehe Bewertungsregeln unten) |
| § 577 BGB Vorkaufsrecht | ja / nein / Sonderfall |
| § 577a BGB Sperrfrist | Live-Wert aus Variable + Restlaufzeit ab Aufteilungs-Eintragung |
| § 574 BGB Härtefall | wahrscheinlich / unwahrscheinlich |
| Risikostufe | 🔴 sehr hoch / 🟡 mittel / 🟢 niedrig |

### Bewertungsregeln Soziale Härte (vermutet)

- **hoch**: Mietdauer ≥ 20 Jahre · Senioren-Indizien (Alter ≥ 70) · Schwerbehinderung dokumentiert · Pflegestufe · langjähriges Kind im Haushalt
- **mittel**: Mietdauer 10–20 Jahre · Familie mit schulpflichtigen Kindern · soziale Verwurzelung im Stadtteil
- **gering**: Mietdauer < 5 Jahre · Single/Paar ohne Kinder · keine Sonderindikatoren

### Bewertungsregeln § 577 BGB Vorkaufsrecht

- **ja**: WE war zum Zeitpunkt der Aufteilung **bereits vermietet**
- **nein**: WE wurde **nach** Aufteilung erstvermietet (§ 577 Abs. 1a BGB) — Stichtag = Eintragung der Teilungserklärung im Grundbuch
- **Sonderfall**: ja, aber Vermieter hat bereits Andienungsschreiben mit Preis verschickt + 2-Monats-Frist abgelaufen → erloschen

### Bewertungsregeln Risikostufe

- 🔴 sehr hoch: hohe soziale Härte + lange Restlaufzeit Sperrfrist + Vorkaufsrecht aktiv → Eigenbedarfskündigung praktisch ausgeschlossen, Vermarktung als vermietete WE mit niedrigerem Anlegerpreis
- 🟡 mittel: mittlere soziale Härte ODER mittlere Sperrfrist-Restlaufzeit ODER unklarer Vorkaufsstatus → Kündigung möglich aber langwierig
- 🟢 niedrig: keine soziale Härte + Sperrfrist abgelaufen oder nicht greifend + kein Vorkaufsrecht → freier Verkauf möglich

---

## Strategie-Szenarien

Bei jeder Aufteiler-Prüfung drei Szenarien gegeneinanderstellen. Ziel: dem Nutzer eine ehrliche Entscheidungsgrundlage geben, kein blindes "Aufteilung lohnt sich".

### Szenario A — Voll-Aufteilung sofort

**Annahmen**:
- Alle WE werden in Eigentumswohnungen aufgeteilt
- Sperrfrist beginnt zu laufen (Live-Wert)
- Vermarktung sofort, vermietete WE als Anleger-Preis, freie WE als Eigennutzer-Preis

**Pflicht-Outputs**:
- Erwartete Brutto-Verkaufserlöse pro WE (Marktpreise live ableiten)
- Realisierungs-Zeitfenster (innerhalb / nach Sperrfrist)
- Risiken: Verkaufspreis-Diskont bei vermieteter Vermarktung, Kosten WEG-Verwaltung ab Aufteilung

**Empfehlung-Logik**: nur sinnvoll, wenn ≥3 von 5 WE als 🟢 oder 🟡 klassifiziert sind UND keine laufende Förder-/Belegungsbindung besteht.

### Szenario B — Teil-Aufteilung (selektiv)

**Annahmen**:
- Nur die WE mit niedriger Risikostufe (🟢 + 🟡) werden in EW umgewandelt und einzeln verkauft
- 🔴-WE bleiben als gemeinsamer Mietbestand erhalten oder werden später nachträglich aufgeteilt (Modernisieren-und-Aufteilen-bei-Auszug)

**Pflicht-Outputs**:
- Liste WE mit Aufteilungs-Empfehlung
- Erwartete Erlöse aus Teil-Verkauf
- Restlich gehaltener Bestand: Cashflow + Bewirtschaftung

**Empfehlung-Logik**: Standardstrategie bei gemischtem Mieterstamm im Objekt.

### Szenario C — Halten + Modernisieren-und-Heben

**Annahmen**:
- Keine Aufteilung
- Modernisierungsmaßnahmen nach § 559 BGB → Mietumlage 8 % p.a. der Modernisierungskosten
- Mietsteigerung im Bestand nach § 558 BGB bis Kappungsgrenze (Live-Wert)
- Bei Auszug einzelner Mieter: Neuvermietung zu Marktpreis

**Pflicht-Outputs**:
- Mietsteigerungs-Hebepotenzial (3-Jahres-Horizont, gedeckelt durch Kappung)
- Modernisierungs-Investitions-Fenster (welche Maßnahmen, welche Förder-Programme live recherchieren)
- Cashflow-Kurve über 5 Jahre

**Empfehlung-Logik**: Wenn ≥3 von 5 WE als 🔴 oder Förderbindung aktiv → defensivere Halten-Strategie.

---

## Output-Schema (Schritt 4 im Gesamtreport)

```markdown
## Aufteiler-Risiken

### Standort-Live-Recherche
| Variable | Wert | Quelle | Stand |
|---|---|---|---|
| Sperrfrist § 577a | <Jahre> | <URL Verordnung> | <Datum> |
| Kappungsgrenze § 558 | <Prozent> | <URL Verordnung> | <Datum> |
| Mietpreisbremse § 556d | <ja/nein> | <URL Verordnung> | <Datum> |
| Soziale Erhaltungssatzung | <ja/nein, Geltungsbereich> | <URL Stadt> | <Datum> |

### Mieterstruktur-Risikomatrix
[Tabelle pro Mietverhältnis nach obigen Spalten]

### Strategie-Szenarien
**Szenario A — Voll-Aufteilung**: [Bewertung + Eckdaten]
**Szenario B — Teil-Aufteilung**: [Bewertung + Eckdaten]
**Szenario C — Halten + Heben**: [Bewertung + Eckdaten]

### Empfehlung
[Eine Szenarien-Wahl mit 1–2 Sätzen Begründung]
```

---

## Anti-Patterns

- **Sperrfrist-Annahme aus Erinnerung**: niemals "typischerweise X Jahre" schreiben. Live-Recherche oder `nicht_pruefbar`.
- **§ 577 BGB pauschal "ja" für alle WE**: Stichtag Aufteilung beachten, Abs. 1a-Ausnahme prüfen.
- **§ 574 BGB Härtefall ignorieren**: bei sehr hoher sozialer Härte ist Eigenbedarfskündigung praktisch oft auch nach Sperrfristablauf nicht durchsetzbar.
- **Förderbindung übersehen**: bei laufender Belegungsbindung ist Aufteiler-Strategie nicht durchführbar — Schritt 4 muss dann früh abbrechen mit klarem KO-Vermerk.
- **WEG-Verwaltungskosten ignorieren**: nach Aufteilung fallen WEG-Verwaltungskosten an, die in Szenario A/B den Cashflow drücken (siehe Wirtschafts-Subagent).
