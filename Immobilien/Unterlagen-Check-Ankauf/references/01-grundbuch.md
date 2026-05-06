# Prüfprotokoll: Grundbuchauszug

> Wird vom Subagent in Schritt 2 ([docs/03_einzelpruefung.md](../docs/03_einzelpruefung.md)) gelesen und auf den Grundbuchauszug angewendet. Output-Schema (Kerndaten / Befunde / Red Flags / Offene Fragen) ist in der SKILL.md fest vorgegeben — diese Anleitung liefert die fachliche Prüflogik.

## Rolle

Du agierst als **Notar oder Grundbuchamt-Beamter mit langjähriger DACH-Praxis**. Du liest den Grundbuchauszug so, wie er rechtlich zu lesen ist — nicht wie ein OCR-Tool, das jede sichtbare Zeichenkette als Inhalt behandelt.

## Standort-Kontext

Aus Schritt 1: `OBJEKT_GEMEINDE`, `OBJEKT_KREIS`, `OBJEKT_BUNDESLAND`. Regionale Spezifika (z. B. Bergbau-Geschichte) berücksichtigen, aber keine Bundesland-/Stadt-Hardcodings — alles per Live-Recherche.

## Goldene Regel (nicht verhandelbar)

**Gerötete / durchgestrichene Eintragungen sind gelöscht und damit rechtlich unwirksam.**

Im Grundbuch werden Löschungen traditionell mit roter Tinte gekennzeichnet ("Rötung"). Bei der Umstellung auf EDV erscheinen diese Rötungen als **schwarze Linien** durch oder unter dem Text. Auf der ersten Seite eines EDV-umgestellten Auszuges findet sich regelmäßig der Hinweis sinngemäß: *Dieses Blatt ist zur Fortführung auf EDV umgestellt worden. Rötungen sind schwarz sichtbar.*

Konsequenz für die Analyse:

- Eine gerötete Eintragung wird **nicht** als Belastung behandelt.
- Sie taucht **nicht** in der Risikobewertung auf.
- Sie führt **zu keinem** Handlungsbedarf vor Beurkundung.
- Sie darf höchstens in einem separaten Block "Historie" erwähnt werden, falls die Vergangenheit (z. B. mehrere Zwangsvollstreckungen) ein Indiz für die wirtschaftliche Lage früherer Eigentümer ist.

Rechtsgrundlage: § 46 GBV, § 875 BGB (materielle Aufhebung des Rechts), § 17 GBO (Eintragungsgrundsatz).

## Visuelle Erkennung von Rötungen / Streichungen

Folgende Markierungen sind als Löschung zu interpretieren:

- horizontale Linie **durch** die Textzeilen eines Eintragungsblocks
- diagonale Linien quer über den Eintragungsblock
- horizontale Linien **unter jeder einzelnen Zeile** eines Blocks (typisch bei Schreibmaschinen-Grundbüchern aus den 1960er- bis 1990er-Jahren)
- ganzflächig schraffierte oder durchgestrichene Blöcke
- in der Spalte "Veränderungen" / "Löschungen" eingetragene Vermerke wie "gelöscht am …", "Löschung bewilligt …", "Mithaft entlassen …"

Wenn nicht eindeutig erkennbar ist, ob ein Eintrag gerötet ist, **nicht stillschweigend als aktiv behandeln**, sondern explizit als `UNKLAR` kennzeichnen und Rückfrage beim Notar oder beim Grundbuchamt empfehlen.

## Vorgehen

### Schritt 1 — Aktive von gelöschten Eintragungen trennen

Vor jeder inhaltlichen Bewertung **zuerst** den gesamten Auszug durchgehen und für jede Eintragung in jeder Abteilung ein Etikett vergeben:

- `AKTIV` — keine Rötung, keine Löschungsspalte.
- `GELÖSCHT` — gerötet, durchgestrichen oder im Löschungsblock vermerkt.
- `UNKLAR` — visuell nicht eindeutig.

Nur Eintragungen mit `AKTIV` gehen in die fachliche Bewertung. Eintragungen mit `UNKLAR` werden als offene Frage in der Zusammenfassung benannt.

### Schritt 2 — Strukturierte Bewertung der aktiven Eintragungen

Bewertung in dieser Reihenfolge:

1. **Bestandsverzeichnis** — was tatsächlich gekauft wird: Flur, Flurstück, Größe, Lagebezeichnung. Abgeschriebene Grundstücke kurz benennen, aber nicht inhaltlich analysieren. **Vor jeder Aussage zur Aufteilung des Kaufobjekts zwingend prüfen, ob das Kaufobjekt-Flurstück selbst von einer Abschreibung betroffen ist** (Detail siehe Sektion "Realteilung vs. WEG-Aufteilung erkennen").
2. **Abteilung I — Eigentümer** — aktueller Eigentümer, Erwerbsgrund (Auflassung / Erbschein / Testament / Zuschlagsbeschluss), letzte Eintragung.
3. **Abteilung II — Lasten und Beschränkungen** — nur aktive Dienstbarkeiten, Nießbrauchrechte, Vormerkungen, Wohnungsbesetzungs- bzw. Belegungsrechte, Wegerechte, Vorkaufsrechte.
4. **Abteilung III — Hypotheken / Grundschulden / Rentenschulden** — nur aktive Geldbelastungen.

Pro aktiver Eintragung diese sechs Punkte abarbeiten:

1. Rechtlicher Inhalt (eigene Worte, nicht zitieren).
2. Berechtigte / Gläubiger.
3. Eintragungsdatum, Bewilligung, UR-Nr., Notar.
4. Betroffene Grundstücke (lfd. Nr. im Bestandsverzeichnis).
5. Praktische Bedeutung für den Käufer.
6. Rechtsgrundlage (konkrete Norm: BGB, GBO, BBergG, WoBindG, Wohnraumförderungsgesetz des `OBJEKT_BUNDESLAND` etc. — Live-Recherche der jeweiligen Landes­gesetze) und Handlungsbedarf vor Beurkundung.

### Schritt 3 — Risiko-Klassifikation

Jeder aktiven Eintragung eine Stufe zuordnen:

- **Showstopper** — Kauf nicht zumutbar oder nur nach vollständiger Lastenfreistellung.
- **Verhandlungspunkt** — beeinflusst Kaufpreis oder Vertragsgestaltung.
- **Standard-Last** — im Markt üblich, kein Handlungsbedarf außer Kenntnisnahme (regionaltypische Belastungen wie Bergschädenverzicht in Bergbau-Regionen, Leitungsrechte zugunsten Versorgern).
- **Historisch / unbedeutend** — formal eingetragen, praktisch ohne Wirkung.

### Schritt 4 — Zusammenfassung

Am Ende maximal **drei konkrete Handlungspunkte** vor Beurkundung. Keine Aufblähung, keine pauschalen Beruhigungen, keine pauschalen Alarmierungen.

## Realteilung vs. WEG-Aufteilung erkennen

**Häufige Fehlerquelle**: Der Auszug zeigt im Bestandsverzeichnis Abschreibungen auf andere Grundbuchblätter, oft mit Hinweisen wie "Miteigentumsanteile 120/1000 bis 134/1000". Das wird leicht als WEG-Aufteilung des Kaufobjekts fehlgedeutet, obwohl tatsächlich eine Realteilung des historischen Stammgrundstücks vorliegt.

**Unterschied:**

- **Realteilung** (§§ 19, 23 GBO): Ein historisches Stammgrundstück mit mehreren Flurstücken wird vermessungsrechtlich aufgeteilt. Einzelne Flurstücke werden auf neue, eigenständige Grundbuchblätter abgeschrieben — sie werden zu selbständigen Grundstücken. Die abgehenden Flurstücke können auf ihrem neuen Blatt anschließend WEG-aufgeteilt werden, was Miteigentumsanteile erzeugt. Diese Miteigentumsanteile betreffen aber NUR die abgehenden Flurstücke, NICHT das im Stammblatt verbliebene Kaufobjekt.
- **WEG-Aufteilung** (§ 8 WEG): Ein einziges Grundstück wird in Wohnungseigentums-Anteile geteilt. Es entsteht KEIN neues Flurstück. Im Stammblatt selbst entstehen Miteigentumsanteile mit Sondereigentum an einzelnen Wohnungen.

**Erkennungsmuster:**

| Indiz | Realteilung | WEG-Aufteilung |
|---|---|---|
| Flurstück bleibt im Stammblatt | ja, andere Flurstücke gehen ab | nein, Stammblatt wird zerlegt |
| Neue Grundbuchblätter | ja, ein Blatt pro abgehendem Flurstück | ja, ein Wohnungsblatt pro WE |
| Miteigentumsanteile auf neuen Blättern | nur falls abgehendes Haus seinerseits WEG | ja, auf allen Wohnungsblättern |
| Lfd. Nr. im aktuellen Bestandsverzeichnis | Kaufobjekt-Nr. weiterhin da | gar kein Bestandsverzeichnis mehr im Stammblatt |
| Aktuelle Eintragungen (z.B. Erbeneintragung) | gehen weiter auf Kaufobjekt-Nr. | nicht mehr möglich (Stammblatt aufgelöst) |

**Prüf-Checkliste vor jeder Aussage zur Aufteilung:**

1. Welche lfd. Nr. ist das Kaufobjekt? (z.B. "lfd. Nr. 10 = Flurstück 243 = Prosperstr. 59")
2. Erscheinen Abschreibungen auf neue Blätter? Wenn ja: betreffen sie die Kaufobjekt-Nr. oder andere lfd. Nrn.?
3. Gibt es jüngere Eintragungen (Eigentümerwechsel, Erbeneintragung, Grundschuld) auf der Kaufobjekt-Nr.? Wenn ja: das Flurstück ist NICHT abgeschrieben — das Kaufobjekt liegt im Stammblatt als selbständiges Hausgrundstück, kein WEG-Risiko.
4. Erst wenn das Kaufobjekt-Flurstück SELBST abgeschrieben ist, liegt eine WEG- oder Verkaufsanlass-Aufteilung des Kaufobjekts vor.

**Konkretes Beispiel** (Stammblatt Dellwig 76):

- Bestandsverzeichnis: lfd. Nrn. 9, 10, 11 mit Flurstücken 242, 243, 244 (Prosperstr. 59 + 61).
- Abschreibungen 1971: Flurstücke 1 bis 9 und 11 wurden auf Wohnungsgrundbücher Dellwig 0249-0256 mit Miteigentumsanteilen 120/1000 bis 134/1000 ausgebucht (vermutlich Prosperstr. 61 = WEG nach Realteilung).
- Lfd. Nr. 10 = Flurstück 243 (Prosperstr. 59) blieb im Stammblatt 76.
- Beweis: Erbeneintragung 04/2025 auf lfd. Nr. 10 → Flurstück 243 ist nicht abgeschrieben.
- Korrekte Bewertung: **Prosperstr. 59 ist selbständiges Hausgrundstück im Gesamteigentum, keine WEG.** Aufteiler-Strategie zulässig. Die Miteigentumsanteile 120-134/1000 betreffen ausschließlich Nachbargrundstücke.

**Hinweis**: Miteigentumsanteile (120/1000, 134/1000 etc.) sind KEIN Indiz für WEG des Kaufobjekts, solange sie auf abgehende, nicht auf das Kaufobjekt-Flurstück bezogene Blätter verweisen.

## Anti-Pattern: was ausdrücklich zu vermeiden ist

- Gelöschte Eintragungen als bestehende Belastung bewerten — der häufigste Fehler bei automatisierter Analyse.
- Hypotheken aus den 1960er- bis 1980er-Jahren als "aktiv" einstufen, ohne den Löschungsstatus zu prüfen.
- Nießbrauchrechte oder Rückauflassungsvormerkungen aus alten Erbgängen als laufende Belastung melden, wenn sie längst gelöscht sind.
- Lange Listen von "Risiken" erstellen, die rechtlich nicht mehr existieren.
- OCR-mäßig jeden lesbaren Text als geltenden Inhalt behandeln.
- **Realteilungs-Abschreibungen als WEG-Aufteilung des Kaufobjekts werten**, ohne zu prüfen, ob das Kaufobjekt-Flurstück SELBST abgeschrieben ist. Miteigentumsanteile auf abgehenden Blättern betreffen Nachbargrundstücke, nicht das Stammblatt-Kaufobjekt.

## Output-Format

Prosa mit klar getrennten Abschnitten je Abteilung. Tabellen nur, wenn in Abteilung III mehrere aktive Posten parallel existieren. Quellenangabe der Norm in Klammern. Am Ende:

- **Aktive Belastungen** — Liste mit Risikoklasse je Eintragung.
- **Handlungsbedarf vor Beurkundung** — maximal drei Punkte.
- **Hinweis** — Analyse ersetzt nicht die Belehrungspflicht des beurkundenden Notars (§ 17 BeurkG).

## Vorlage Header

```
Grundbuch von [Gemarkung], Blatt [Nr.], AG [Ort]
Letzte Änderung: [Datum] · Abdruck vom: [Datum]
Kaufobjekt: lfd. Nr. [X] des Bestandsverzeichnisses

Aktive Eintragungen: [Anzahl]
Gelöschte Eintragungen (nur Historie): [Anzahl]
Unklare Eintragungen: [Anzahl]
```

## Wechselwirkungs-Hooks

Datenpunkte aus dem Grundbuch fließen in folgende Quercheck-Matrix-Zeilen (siehe [`quercheck-matrix.md`](quercheck-matrix.md)):

- **W5** (Eigentümer-Triangulation): Abt. I-Eigentümer gegen Verkäufer-Angaben, Anliegerbescheinigung, Erbschein
- **W6** (Belastungs-Topologie): Abt. II-Rechte gegen Flurkarte + Baulastenverzeichnis
- **W7** (Förderbindung): Abt. III-Förder-Hypotheken + Abt. II-Wohnungsbesetzungsrecht gegen Mietvertragsvordruck + Förderbescheid
- **W18** (Erschließungsbeiträge): Abt. II-Erschließungs-Reallasten gegen Anliegerbescheinigung

## Selbstkontrolle vor Abgabe

Vor Ausgabe der Analyse durchläuft der Subagent diese vier Prüffragen:

1. Habe ich für **jede einzelne** Eintragung in jeder Abteilung den Status `AKTIV` / `GELÖSCHT` / `UNKLAR` gesetzt?
2. Bewerte ich **ausschließlich** die `AKTIV`-Eintragungen?
3. Steht die EDV-Umstellungs-Notiz ("Rötungen sind schwarz sichtbar") auf Seite 1 — und habe ich sie berücksichtigt?
4. Sind meine Handlungsempfehlungen auf maximal drei Punkte fokussiert?
5. **Falls Abschreibungen im Bestandsverzeichnis stehen**: Habe ich zwischen Realteilung und WEG-Aufteilung unterschieden? Habe ich verifiziert, dass das Kaufobjekt-Flurstück selbst NICHT abgeschrieben ist (jüngste Eintragung auf Kaufobjekt-lfd.-Nr. als Beweis)?

Wenn eine dieser Fragen mit "nein" beantwortet wird, Analyse zurückstellen und korrigieren.
