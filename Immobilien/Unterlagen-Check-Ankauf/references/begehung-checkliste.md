# Vor-Ort-Begehungs-Checkliste

> Referenziert von [SKILL.md](../SKILL.md) Schritt 5 (Gesamtreport). Hauptagent rendert diese Checkliste in den Report-Anhang und ergänzt **risiko-spezifische Marker** aus den Subagent-Outputs (z. B. "Bauschaden-Indiz aus W16: Tropfen vom Balkon → bei Begehung 4.OG-Balkon-Abdichtung sichten").

## Zweck

Die Unterlagen-Prüfung allein reicht nicht — bestimmte Risiken werden erst beim physischen Sichten erkannt (Pilz im Mauerwerk, Tank-Korrosion, Schimmel im Dachstuhl). Die Checkliste strukturiert die Vor-Ort-Begehung systematisch nach Risiko-Hotspots.

## Anwendungslogik (Hauptagent)

1. Standard-Checkliste rendern (siehe unten).
2. Pro Subagent-Output mit 🔴 oder 🟡 Red Flag prüfen: gibt es einen physischen Sicht-Anker? (z. B. Mängel im MV → Vor-Ort-Sichtprüfung dieses Bauteils)
3. Diese Marker als **zusätzliche risiko-spezifische Punkte** unter dem passenden Abschnitt einfügen mit Verweis auf den Quercheck-Befund.
4. Reihenfolge: erst Standard-Punkte, dann risiko-spezifische Marker (markiert mit 🎯).

---

## Checkliste

### A · Außen / Grundstück

- [ ] Gesamteindruck Fassade — Risse, Putzabsprengungen, Feuchteflecken
- [ ] Dachstuhl von außen sichtbar — Verformung, Rinnen, Dachhaut
- [ ] Schornsteinkopf — Verfugung, Kappe
- [ ] Außentreppe / Eingangsbereich — Setzungsrisse
- [ ] Grundstücksgrenzen — Zaun, Hecke, Übergriff/Nutzungskonflikte mit Nachbarn
- [ ] Versiegelte Flächen / Hofabläufe — funktional, frei
- [ ] Gartenanlage — Pflegezustand (Indiz für BK-Lücken-Hebel "Gartenpflege")
- [ ] Stellplätze / Garagen — Zustand, Zufahrt frei, Genehmigungs-Indizien (Schwarzbau-Verdacht aus W8)

### B · Keller

- [ ] **Mauerwerk** — Feuchteflecken, Salzausblühungen, Pilzbefall (besonders bei Bauakte-Indiz "Standsicherheit / Pilzbefall")
- [ ] **Bodenplatte** — Risse, Senkungen, sichtbare Wasserspuren
- [ ] **Heizraum** — Brandschutz, Kessel-Zustand, Tank
  - Heizöltank: Material (Kunststoff/Stahl), Auffangwanne, Korrosionsspuren, AwSV-Plakette sichtbar?
  - Kessel: Bj.-Schild, Dichtigkeit, Abgasrohr-Zustand
  - Pumpen, Mischer — funktional
- [ ] **Elektrik** — Hauptverteilung, FI-Schalter, Zählerplatz Wohnungen
- [ ] **Trinkwasser-Hauptanschluss** — Rohrmaterial (Blei? Verzinkt? Edelstahl?), Schieber funktional
- [ ] Speichervolumen (Warmwasser-Speicher) — Bj., Korrosionsanzeichen, Legionellen-Trigger
- [ ] Lagerräume / Mieterkeller — Zugang, Zuordnung
- [ ] Lüftung Keller — natürlich oder mechanisch, ggf. Schimmel-Trigger

### C · Treppenhaus / Gemeinschaftsbereiche

- [ ] Bodenbeläge — Zustand, Treppenkanten
- [ ] Brandschutz — Türen, Rauchwarnmelder, Fluchtwege frei
- [ ] Beleuchtung Allgemeinstrom — Zustand (Indiz für BK-Lücken-Hebel W10)
- [ ] Hausreinigung — Pflegezustand (Indiz BK-Lücken-Hebel W10)
- [ ] Briefkastenanlage / Klingelanlage / Sprechanlage — Zustand, Mieter-Beschriftung aktuell?
- [ ] Aushänge / Mieter-Notizen — Beschwerden, Hinweise auf Streit oder Mängel

### D · Wohnungen (innen, sofern Zugang gewährt)

- [ ] **Mängel aus Mietverträgen / Übergabeprotokollen** vor Ort sichten (🎯 risiko-spezifisch)
- [ ] Fenster — Bj., Dichtungen, Verglasung, Beschlag
- [ ] Heizkörper / Thermostate — funktional, korrodiert?
- [ ] Bäder — Fliesen, Silikonfugen, Dichtigkeit Dusche/Wanne
- [ ] Küchen — Anschlüsse Wasser/Abwasser/Strom, Dunstabzug
- [ ] Elektrik Wohnung — Steckdosen, FI-Schutz, Zählerstand notieren
- [ ] Schimmel-Indizien — Ecken, Fenster-Laibungen, hinter Schränken
- [ ] Fußbodenbelag — Zustand (Schönheitsreparatur-Indiz für W12)
- [ ] Balkon / Loggia — Belag, Geländer-Befestigung, Abdichtung Anschluss zur Wand

### E · Dachstuhl / Spitzboden

- [ ] Holzbauteile — Schwammbefall, Insektenspuren, Verformungen
- [ ] Schadstoff-Verdacht (PCP/Lindane bei imprägniertem Holz < 1989, Asbest/KMF bei Eternit/alten Dämmplatten) (🎯 W17)
- [ ] Eindeckung von innen — Ziegelbruch, Lichtspalten, Feuchtespuren
- [ ] Dämmung — Material, Stärke, Zustand
- [ ] Antennen-/PV-Vorbereitung — Kabel, Durchdringungen sauber abgedichtet?

### F · Mietersignale (Soft Indicators)

- [ ] Wer öffnet die Tür? (Indiz für Mieterstruktur-Bewertung in `aufteiler-risiken.md`)
- [ ] Allgemeiner Eindruck (gepflegt / verwahrlost)
- [ ] Beziehungsgeflecht zu anderen Mietern (Sympathien / Konflikte)
- [ ] Klagepunkte / Bauschadens-Hinweise direkt vom Mieter
- [ ] Verweildauer (passt zu Mietvertrags-Beginndatum?)

### G · Spezial-Punkte (nur wenn aus Subagent-Outputs aktiviert)

🎯 Diese Punkte fügt der Hauptagent ein, wenn die jeweilige Wechselwirkung ein Risiko-Marker ergibt:

- **W2 — Quasi-Neubau-Verdacht**: Kellersubstanz aus Vor-Abriss-Zeit → Mauerwerk-Sichtprüfung Pilz-/Feuchterest
- **W3 — Heizungstausch absehbar**: Aufstellmöglichkeiten Wärmepumpe (Außengerät, Schallabstand zu Nachbarn), Heizflächen-Eignung Niedrigtemperatur
- **W6 — Belastungs-Topologie**: Wegerechte sichtbar (Trampelpfad, asphaltierter Weg über Grundstück)?
- **W8 — Stellplatz-Schwarzbau-Risiko**: Garagenrückwand an Grundstücksgrenze, Genehmigungs-Plakette, Gründungs-Indizien
- **W14 — Trinkwasser**: Probennahme-Stellen (Vorlauf, fernste WE) zugänglich für späteren Untersuchungs-Auftrag
- **W15 — Heizöltank**: Tank-Bj., Doppelwandigkeit, Auffangwanne, Lecksonden-Anzeige
- **W16 — Bauschaden-Indiz**: konkrete Bauteil-Sichtprüfung (z. B. Balkon-Abdichtung 4.OG bei dokumentiertem Tropfen)
- **W17 — Schadstoff-Verdacht**: Probennahme-Möglichkeit Holz / Bodenbelag / Dichtmasse (für Gutachten-Beauftragung)

---

## Output-Schema (Schritt 5 im Gesamtreport, Anhang)

```markdown
## Anhang: Vor-Ort-Begehung

### Pflicht-Punkte
[Sektionen A–F als Checkliste]

### Risiko-spezifische Schwerpunkte (Sektion G)
[Nur die 🎯 Punkte einfügen, die aus Subagent-Outputs aktiviert wurden]

### Empfohlene Begleitung
- Bauingenieur/Sachverständiger: [ja/nein, falls 🔴 in Substanz]
- Schadstoff-Gutachter: [ja/nein, falls W17 aktiv]
- Heizungs-Fachbetrieb: [ja/nein, falls W3 aktiv]
- Notar (für Beurkundungs-relevante Sichtprüfung): [optional]
```

---

## Anti-Patterns

- Generische Checkliste ohne Risiko-Marker rendern → bringt dem Käufer nichts
- "Auf jeden Fall mitnehmen" → konkret begründen, sonst wird's ignoriert
- Mietersignale ignorieren → die Mieterstruktur ist 50 % der Aufteiler-Bewertung
