# Quercheck-Matrix — Wechselwirkungen zwischen MFH-Unterlagen

> Referenziert von [SKILL.md](../SKILL.md) Schritt 3 (Synthese & Quercheck). Hauptagent wendet diese Matrix Zeile für Zeile an, sobald die parallel laufenden Profi-Subagents (Schritt 2) ihre Outputs abgeliefert haben.

## Zweck

Manche Risiken werden erst sichtbar, wenn man **mehrere Unterlagen nebeneinander** liest. Ein Mietvertrag wirkt sauber, ein Grundbuchauszug wirkt sauber — erst beim Abgleich fällt auf, dass im Vertragsvordruck "preisgebundener Wohnraum" steht und im Grundbuch noch eine landesrechtliche Förderhypothek (Wohnraumförderungsgesetz des `OBJEKT_BUNDESLAND`) aktiv ist.

Die Matrix definiert genau diese **Wechselwirkungen**: pro Zeile ein Datenpunkt, der in ≥2 Quellen auftaucht, ein Konflikt-Indikator und ein Fix.

## Anwendungslogik (Hauptagent)

1. **Datenpunkte aus allen Subagent-Outputs in eine flache Liste sammeln** (jede Zeile einer "Kerndaten"-Sektion = ein Datenpunkt mit Quellenverweis).
2. **Pro Matrix-Zeile prüfen**: Sind die geforderten Quellen vorhanden? Stimmen die Werte überein?
3. **Konsistent / Abweichend / Nicht prüfbar** klassifizieren.
4. **Bei Abweichung**: Konflikt-Indikator anwenden, Fix als Action-Item ableiten.
5. **Output**: Quercheck-Tabelle (siehe Schema unten) im Gesamtreport.

## Output-Schema (Schritt 3)

| Datenpunkt | Quelle 1 | Quelle 2 | Quelle 3 | Konsistent? | Hinweis | Fix |
|---|---|---|---|---|---|---|
| ... | ... | ... | ... | ✅ / ⚠️ / 🔴 | ... | ... |

Klassifikation:
- ✅ Werte stimmen oder Abweichung < Toleranz
- ⚠️ Abweichung über Toleranz, aber unkritisch (Klärung)
- 🔴 Abweichung blockiert Deal oder bedeutet konkretes Risiko

---

## Wechselwirkungs-Tabelle (v0.1)

### W1 · Wohnflächen-Triangulation

- **Datenpunkt**: Wohnfläche gesamt (m²) und pro WE
- **Quellen**: Wohnflächenberechnung · Energieausweis (A_N abgeleitet) · BK-Verteilerschlüssel (m²-Anteile) · Mietverträge (sofern m² genannt) · Bauakte (Pläne)
- **Toleranz**: ±2 % zwischen Quellen
- **Konflikt-Indikator**: Abweichung > 2 % oder fehlende WoFlV-konforme Berechnung
- **Fix**: Aufmaß durch Sachverständigen vor Mieterhöhung; Loggia/Dachschrägen-Anrechnung verifizieren

### W2 · Baujahr / fiktives Baujahr

- **Datenpunkt**: Baujahr (faktisch) vs. Bauakte-Historie
- **Quellen**: Energieausweis · Bauakte (Schlussabnahme) · Modernisierungsnachweise · Schornsteinfegerprotokoll
- **Konflikt-Indikator**: Bauakte zeigt Quasi-Neubau (Standsicherheits-Korrespondenz, Ruine-Vermerk, neue Schlussabnahme nach Abriss bis Erdgleiche), Energieausweis nennt aber älteres Baujahr aus dem Bestandsverzeichnis
- **Fix**: reales fiktives Baujahr für RND nach ImmoWertV ansetzen, nicht das ursprüngliche Bestands-Baujahr

### W3 · Heizungs-Konsistenz

- **Datenpunkt**: Wärmeerzeuger Bj. / Typ / Leistung
- **Quellen**: Energieausweis · Schornsteinfegerprotokoll · Wartungsvertrag · Heizkostenabrechnung
- **Toleranz**: ±1 Jahr beim Bj. (Master = Schornsteinfeger), Typ identisch
- **Konflikt-Indikator**: Typ widersprüchlich; Leistung-Diff (Tarif-Mismatch); Wartungsvertrag pauschal "bis 25 kW", Schornsteinfeger sagt 47 kW
- **Fix**: Schornsteinfeger als Master, Wartungstarif anpassen, GEG-§-71/§-72-Live-Recherche mit Bj.-Wert

### W4 · Mieten-Triangulation

- **Datenpunkt**: Kalt-Miete · NK-VZ · Kaution
- **Quellen**: Mietvertrag · Mieterliste / Mietmatrix · BK-Vorauszahlungen · BK-Abrechnung (Saldo)
- **Konflikt-Indikator**: Mietvertrag-Kalt ≠ Mietmatrix (Erhöhung erfolgt? § 558 BGB-konform? Kappungsgrenze gewahrt?); NK-VZ in Matrix fehlt; Kaution-Nachweis fehlt (§ 566a BGB)
- **Fix**: Mieterhöhungs-Historie nachfordern; Kautions-Konten bestätigen; Übergabe-Konstruktion klären

### W5 · Eigentümer-Triangulation

- **Datenpunkt**: Aktueller Eigentümer + Erwerbsgrund + Verkaufsbefugnis
- **Quellen**: Grundbuch (Abt. I aktiv) · Verkäufer-Angaben · Anliegerbescheinigung · Erbschein / Testament / Vollmacht
- **Konflikt-Indikator**: Verkäufer ≠ Grundbuch-Eigentümer; Bankenverwertungstochter als Verkäufer ohne Vollmachtnachweis; Erbe + Erbengemeinschaft mit fehlender Zustimmung
- **Fix**: Vollmacht / Erbschein / ungeschwärzter Auszug zwingend vor LOI

### W6 · Belastungen Abt. II — Topologie-Check

- **Datenpunkt**: Wegerechte · Leitungsrechte · Reallasten · Vorkaufsrechte
- **Quellen**: Grundbuch Abt. II (aktiv) · Flurkarte · Baulastenverzeichnis · Teilungserklärung (falls WEG)
- **Konflikt-Indikator**: Recht im Grundbuch eingetragen, aber in Flurkarte nicht topologisch sichtbar; Baulast existiert, aber im Grundbuch keine korrespondierende Dienstbarkeit
- **Fix**: Flurkarte mit Wegerechte-Layer anfordern; Baulast-Auswirkung auf Grundstücksnutzung prüfen

### W7 · Förderbindung-Triggermuster

- **Datenpunkt**: Förder-/Belegungsbindung aktiv?
- **Quellen**: Grundbuch (Abt. III: Förder-Hypotheken / Abt. II: Wohnungsbesetzungsrecht) · Mietvertrags-Vordrucke ("preisgebundener Wohnraum") · Förderbescheid · Einzelvereinbarungen Bindungsende
- **Konflikt-Indikator**: Mietvertragsvordruck "preisgebundener Wohnraum" verwendet, aber kein aktueller Förderbescheid mit Bindungsende-Bestätigung; Belegungsrecht in Abt. II ohne Löschungsnachweis
- **Fix**: Förderbescheid + amtliche Bindungsablauf-Bestätigung anfordern; KO für Aufteiler-Strategie bei laufender Belegungsbindung

### W8 · Stellplatz-Genehmigung

- **Datenpunkt**: Anzahl + Lage Garagen / Stellplätze
- **Quellen**: Bauakte (Pläne, Genehmigung, Nachträge) · Baulastenverzeichnis (Stellplatz-Baulast) · Mietverträge (Garagen-Mietverhältnisse) · Flurkarte
- **Konflikt-Indikator**: Garagen vermietet, in genehmigtem Bauplan nicht eingezeichnet, Nachträge nicht lesbar/fehlen → Schwarzbau-Risiko, Stellplatznachweis nach BauO des jeweiligen Bundeslandes (Live-Recherche) unklar
- **Fix**: nachträgliche Genehmigung prüfen oder Rückbau-Risiko in CapEx einpreisen

### W9 · Versicherungs-Plausibilität

- **Datenpunkt**: Versicherungssumme · Wert 1914 · Prämie · BK-Position Versicherung
- **Quellen**: Versicherungspolice · Wert-1914-Berechnung · BK-Abrechnung · Wohnflächenberechnung
- **Konflikt-Indikator**: BK-Position weicht von Police ab (Glasversicherung als "Hausrat-Zusatz" bei vermietetem MFH = Tarifierungsfehler); Versicherungswert / m² über Marktbenchmark MFH (Live-Recherche) → Optimierungspotenzial; Wert 1914 zu niedrig → Unterversicherungs-Klausel
- **Fix**: Original-Police anfordern, Marktvergleich, ggf. Tarifkorrektur vor Übergabe

### W10 · BK-Umlagen-Vollständigkeit

- **Datenpunkt**: BetrKV § 2 Soll-Umlagen vs. tatsächlich umgelegt
- **Quellen**: BK-Abrechnung · Mietvertrag (BK-Klausel) · Wartungsverträge · Allgemeinstrom-Rechnung · Hausreinigung-/Gartenpflege-Belege
- **Konflikt-Indikator**: Position in BetrKV § 2 vorhanden + Mietvertrag enthält BK-Pauschal-Klausel + tatsächlich nicht in Abrechnung umgelegt → BK-Lücken-Hebel nach Übernahme (§ 560 BGB)
- **Fix**: Mieter-Anschreiben vorbereiten, Position in nächste BK-Periode aufnehmen; Hebel als €/Jahr beziffern (siehe Wirtschafts-Subagent)

### W11 · CO2KostAufG-Anwendung

- **Datenpunkt**: Energieträger + CO2-Aufteilung Vermieter/Mieter
- **Quellen**: Heizkostenabrechnung an Mieter · Energieausweis (Energieträger) · Wartungsvertrag (Brennstofftyp)
- **Konflikt-Indikator**: Fossiler Energieträger + keine CO2-Aufteilung in Heizkosten → 50/50-Default → Vermieter zahlt anteilig ohne Vermeidungsmöglichkeit
- **Fix**: Aufteilung nach Stufenmodell CO2KostAufG einfordern, in nächster Heizkostenabrechnung berücksichtigen

### W12 · Schönheitsreparatur-Klausel-Live-Check

- **Datenpunkt**: § 20/21-Klausel im Mietvertrag
- **Quellen**: Mietvertrag · Mietvertragsdatum · BGH-Rechtsprechung (Live-Recherche, mind. VIII ZR 178/05, VIII ZR 285/12 + neueres)
- **Konflikt-Indikator**: starre Fristen + Quotenklausel + Endrenovierungspflicht + "im Allgemeinen"-Klausel = unwirksam → Vermieter trägt Renovierungslast
- **Fix**: anwaltliche Einzelprüfung; CapEx-Position "Renovierungspflicht ungewirksamer Klauseln" pro WE einpreisen

### W13 · Modernisierungs-Konsistenz

- **Datenpunkt**: Modernisierungs-Maßnahmen + Datum
- **Quellen**: Modernisierungsnachweise · Energieausweis (Effizienz-Sprung) · Mietvertrag (Modernisierungsumlage § 559 BGB) · Bauakte (Genehmigungen)
- **Konflikt-Indikator**: Modernisierung dokumentiert, aber keine § 559-Umlage im Mietvertrag → Hebepotenzial verschenkt; Modernisierungsumlage im Mietvertrag, aber Nachweise fehlen → Rückforderungsrisiko Mieter
- **Fix**: Belege vollständigen, ggf. nachträgliche § 559-Anpassung prüfen

### W14 · Trinkwasser-Pflicht-Trigger

- **Datenpunkt**: Anzahl WE + Zentral-WW + Untersuchungspflicht
- **Quellen**: Inventur (WE-Anzahl) · Energieausweis (WW-System) · Trinkwasseruntersuchungsbericht
- **Konflikt-Indikator**: ≥3 WE + zentrale WW-Versorgung + Untersuchungsbericht fehlt → § 14b TrinkwV-Verstoß, Bußgeldrisiko
- **Fix**: Untersuchung beauftragen vor Übergabe

### W15 · AwSV-Tank-Pflicht-Trigger

- **Datenpunkt**: Heizungstyp Öl + Tankvolumen + Prüfintervall
- **Quellen**: Bauakte (Tankbeschreibung) · Schornsteinfeger · Wartungsvertrag · AwSV-Prüfbericht
- **Konflikt-Indikator**: Öl-Heizung + Tank ≥1.000 L + Prüfbericht älter als 5 Jahre / fehlt → AwSV-Verstoß
- **Fix**: Sachverständigen-Prüfung beauftragen; bei Tank-Alter ≥30 Jahre → Stilllegung + Bodenuntersuchung in CapEx

### W16 · Bauschaden-Indizien

- **Datenpunkt**: dokumentierte Mängel
- **Quellen**: Mietverträge (Mängel-/§-33-Klauseln, Übergabeprotokoll) · Wartungsverträge · Schornsteinfeger · Versicherungsschadenshistorie · Bauakte (Standsicherheits-Korrespondenz)
- **Konflikt-Indikator**: dokumentierter Mangel im MV (z. B. "Tropfen vom Balkon darüber") ohne Sanierungsnachweis → aktiver Bauschaden, akzeptierter Zustand → keine Mietminderung mehr durch aktuellen Mieter, aber Risiko für Käufer
- **Fix**: Vor-Ort-Begehung des betroffenen Bauteils + Sanierungs-CapEx einpreisen

### W17 · Schadstoff-Trigger

- **Datenpunkt**: Bauphasen mit problematischen Materialien
- **Quellen**: Bauakte (Baujahr Dachstuhl, Materialhinweise) · Modernisierungsnachweise · Energieausweis · Mietvertrag (Mängelliste)
- **Konflikt-Indikator**: Bauphase < 1989 + "imprägniertes Holz" / "Tannenholz behandelt" / "Eternit" / "Floor-Flex" → Verdacht auf PCP/Lindane, Asbest, KMF, PCB
- **Fix**: Schadstoffgutachten vor Sanierung; bei Sanierung Pflicht nach KrWG, GefStoffV, TRGS 519

### W18 · Erschließungsbeitrags-Status

- **Datenpunkt**: BauGB-Erschließungsbeiträge + KAG-Anschlussbeiträge
- **Quellen**: Anliegerbescheinigung der Gemeinde · Grundbuch (Abt. II Erschließungs-Reallasten) · Teilungserklärung
- **Konflikt-Indikator**: Beiträge nicht getilgt → Käufer haftet (§ 134 BauGB Beitragspflicht)
- **Fix**: aktuelle Anliegerbescheinigung "lastenfrei" anfordern

### W19 · Heizkostenabrechnungs-Vollständigkeit

- **Datenpunkt**: kWh + Brennstoffkosten + CO2-Aufteilung pro Mieter
- **Quellen**: Heizkostenabrechnung an Mieter · ista/o.ä.-Dienstleisterrechnung · BK-Abrechnung
- **Konflikt-Indikator**: nur Dienstleisterrechnung vorhanden, keine vollständige Verbrauchsabrechnung an Mieter → § 7 HeizkostenV-Verstoß; inkonsistente Nutzerzahlen zwischen Liegenschafts-Datensätzen
- **Fix**: vollständige Abrechnungssätze nachfordern; Datenkonsistenz prüfen

### W20 · WEG-Konsistenz (falls Aufteilung bereits vorhanden)

- **Datenpunkt**: Kostenverteilung + Hausgeld + Rücklage
- **Quellen**: Teilungserklärung (Kostenverteilungsschlüssel) · EV-Protokolle · Wirtschaftsplan · Hausgeldabrechnung · Bestand Instandhaltungsrücklage
- **Konflikt-Indikator**: TE-Schlüssel ≠ Praxis im Wirtschaftsplan; Rücklagen-Bestand bei absehbarer Großmaßnahme zu niedrig
- **Fix**: Verwalter klären; Rücklagen-Pfad in Wirtschafts-Subagent abbilden

---

## Erweiterung (Iteration 02+)

Die Matrix ist v0.1 — gebaut aus Domain-Wissen + Befunden des ersten Skill-Durchlaufs. Iteration 02 sollte einen Web-Recherche-Sub-Agent starten, der:

1. Aktuelle Rechtsprechungstrends (BGH, OLG) je Wechselwirkung verifiziert.
2. Marktbenchmarks (BetrKV-Spiegel, GdV, regional) aktualisiert.
3. Neue Wechselwirkungen ergänzt (z. B. Gebäudetyp-Klasse-1-Pflicht ab 2026, Smart-Meter-Rollout-Kosten).

Versionierung: bei jeder Erweiterung Datum + Iteration im Frontmatter dieser Datei dokumentieren.
