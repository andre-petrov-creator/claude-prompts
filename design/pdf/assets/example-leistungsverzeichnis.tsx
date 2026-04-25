import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  renderToFile,
} from "@react-pdf/renderer";

// ============================================================
// FONT REGISTRATION
// ============================================================
Font.register({
  family: "IBM Plex Sans",
  fonts: [
    { src: "./fonts/IBMPlexSans-Regular.ttf", fontWeight: 400 },
    { src: "./fonts/IBMPlexSans-Medium.ttf", fontWeight: 500 },
    { src: "./fonts/IBMPlexSans-SemiBold.ttf", fontWeight: 600 },
    { src: "./fonts/IBMPlexSans-Bold.ttf", fontWeight: 700 },
    { src: "./fonts/IBMPlexSans-Italic.ttf", fontStyle: "italic", fontWeight: 400 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

// ============================================================
// FARBPALETTE: Anthrazit + Bronze
// ============================================================
const C = {
  anthrazit: "#1F2937",
  anthrazitDark: "#111827",
  textDark: "#374151",
  textMid: "#6B7280",
  textLight: "#9CA3AF",
  lineLight: "#E5E7EB",
  bgSoft: "#F9FAFB",
  bronze: "#B45309",
  bronzeLight: "#FEF3C7",
  white: "#FFFFFF",
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  page: {
    fontFamily: "IBM Plex Sans",
    fontSize: 9.5,
    color: C.textDark,
    paddingTop: 70,
    paddingBottom: 55,
    paddingHorizontal: 50,
    lineHeight: 1.45,
  },

  // Header / Footer (fixed)
  header: {
    position: "absolute",
    top: 28,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 8,
  },
  headerAccent: {
    position: "absolute",
    top: 28,
    left: 50,
    width: 28,
    height: 2,
    backgroundColor: C.bronze,
  },
  headerLeft: {
    fontSize: 8.5,
    fontWeight: 700,
    color: C.anthrazit,
    letterSpacing: 1.2,
    paddingTop: 8,
  },
  headerRight: {
    fontSize: 8.5,
    color: C.textMid,
    paddingTop: 8,
  },
  footer: {
    position: "absolute",
    bottom: 25,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: C.textLight,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: C.lineLight,
  },

  // Cover-Block
  coverEyebrow: {
    fontSize: 9,
    color: C.bronze,
    fontWeight: 600,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: C.anthrazit,
    letterSpacing: -0.5,
    lineHeight: 1.15,
    marginBottom: 6,
  },
  coverSubtitle: {
    fontSize: 12,
    color: C.textMid,
    fontWeight: 400,
    marginBottom: 18,
  },
  coverDivider: {
    height: 1,
    backgroundColor: C.lineLight,
    marginBottom: 18,
  },

  // Sektionen
  sectionEyebrow: {
    fontSize: 8,
    color: C.bronze,
    fontWeight: 600,
    letterSpacing: 1.5,
    marginTop: 16,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: C.anthrazit,
    marginBottom: 10,
    letterSpacing: -0.2,
  },

  // Tabellen
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.anthrazit,
    color: C.white,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.lineLight,
  },
  tableRowAlt: {
    backgroundColor: C.bgSoft,
  },
  tableRowSubtotal: {
    backgroundColor: C.bgSoft,
    borderTopWidth: 0.5,
    borderTopColor: C.anthrazit,
    paddingVertical: 8,
  },
  cellPos: {
    width: "13%",
    fontSize: 9,
    color: C.textDark,
  },
  cellLeistung: {
    width: "57%",
    fontSize: 9,
    color: C.textDark,
    paddingRight: 6,
  },
  cellEinheit: {
    width: "13%",
    fontSize: 9,
    color: C.textDark,
    textAlign: "center",
  },
  cellPreis: {
    width: "17%",
    fontSize: 9,
    color: C.textDark,
    textAlign: "right",
    fontWeight: 500,
  },
  headerCell: {
    fontSize: 9,
    fontWeight: 600,
    color: C.white,
    letterSpacing: 0.3,
  },
  subtotalText: {
    fontWeight: 700,
    color: C.bronze,
  },

  // Hinweis-Box
  hinweisBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: C.bgSoft,
    borderLeftWidth: 3,
    borderLeftColor: C.bronze,
    fontSize: 8.5,
    fontStyle: "italic",
    color: C.textMid,
    lineHeight: 1.5,
  },

  // Nicht-enthalten Box
  excludedItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  excludedBullet: {
    color: C.bronze,
    fontWeight: 700,
    marginRight: 8,
    fontSize: 10,
  },
  excludedText: {
    fontSize: 9.5,
    color: C.textDark,
    flex: 1,
  },
  excludedBox: {
    backgroundColor: C.bgSoft,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: C.bronze,
  },

  // Hinweise nummeriert
  hinweisRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.3,
    borderBottomColor: C.lineLight,
    alignItems: "flex-start",
  },
  hinweisNum: {
    width: 22,
    fontSize: 9,
    fontWeight: 700,
    color: C.bronze,
  },
  hinweisText: {
    flex: 1,
    fontSize: 9,
    color: C.textDark,
    lineHeight: 1.5,
  },

  // TOC
  tocRow: {
    flexDirection: "row",
    paddingVertical: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: C.lineLight,
    alignItems: "center",
  },
  tocNum: {
    width: 32,
    fontSize: 9,
    fontWeight: 600,
    color: C.bronze,
  },
  tocTitle: {
    flex: 1,
    fontSize: 10,
    color: C.anthrazit,
    fontWeight: 500,
  },
  tocPage: {
    fontSize: 9,
    color: C.textMid,
    fontWeight: 400,
  },

  // Summen-Übersicht
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    marginHorizontal: -6,
  },
  summaryCard: {
    width: "50%",
    padding: 6,
  },
  summaryCardInner: {
    backgroundColor: C.bgSoft,
    borderLeftWidth: 3,
    borderLeftColor: C.bronze,
    padding: 12,
  },
  summaryLabel: {
    fontSize: 8,
    color: C.textMid,
    fontWeight: 500,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 10,
    color: C.anthrazit,
    fontWeight: 600,
    marginBottom: 8,
    lineHeight: 1.3,
  },
  summaryPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  summaryPriceValue: {
    fontSize: 14,
    fontWeight: 700,
    color: C.anthrazit,
  },
  summaryPriceUnit: {
    fontSize: 9,
    color: C.textMid,
  },
});

// ============================================================
// DATEN
// ============================================================
const chapters = [
  {
    num: "01",
    title: "Fassade WDVS – Grundleistung",
    rows: [
      ["1.1", "Dämmplatten kleben und dübeln", "m²", "15,00 €"],
      ["1.2", "Armierung: Mörtel auftragen und Gewebe einbetten", "m²", "14,00 €"],
      ["1.3", "Schienen setzen (Eck-, Kanten-, Sockel-, Anputzleisten)", "m²", "4,00 €"],
      ["1.4", "Laibungen-Zuschlag Fenster/Türen (im m²-Grundpreis)", "m²", "8,00 €"],
      ["1.5", "Grundierung / Putzgrund auftragen", "m²", "4,00 €"],
      ["1.6", "Oberputz (Reibe- oder Strukturputz)", "m²", "17,00 €"],
      ["1.7", "Fassadenanstrich 2× deckend", "m²", "8,00 €"],
    ],
    subtotal: ["Summe Grundleistung WDVS pro m² Fassadenfläche", "m²", "70,00 €"],
  },
  {
    num: "02",
    title: "Fensterbänke Aluminium – Lohnleistung",
    rows: [
      ["2.1", "Alu-Fensterbank bis 1,20 m Länge (Demontage alt + Montage neu)", "Stück", "50,00 €"],
      ["2.2", "Alu-Fensterbank 1,21 m bis 2,00 m Länge", "Stück", "70,00 €"],
      ["2.3", "Alu-Fensterbank über 2,00 m Länge", "Stück", "95,00 €"],
    ],
    note: "Enthaltene Leistungen je Fensterbank: Demontage Altbestand, Untergrund vorbereiten, Zuschnitt, Kompriband + Dichtstoff, Montage mit Gefälle, seitliche Bordstücke / Endkappen, Anschluss an WDVS.",
  },
  {
    num: "03",
    title: "Fensterbänke Naturstein / Granit – Lohnleistung",
    rows: [
      ["3.1", "Naturstein-Fensterbank bis 1,20 m Länge", "Stück", "85,00 €"],
      ["3.2", "Naturstein-Fensterbank 1,21 m bis 2,00 m Länge", "Stück", "110,00 €"],
      ["3.3", "Naturstein-Fensterbank über 2,00 m Länge", "Stück", "140,00 €"],
    ],
  },
  {
    num: "04",
    title: "Laibungen – separate Abrechnung",
    rows: [
      ["4.1", "Laibung dämmen (Dämmplatte 20–40 mm)", "lfm", "18,00 €"],
      ["4.2", "Laibung armieren + Gewebe einbetten", "lfm", "12,00 €"],
      ["4.3", "Laibung verputzen und streichen", "lfm", "14,00 €"],
    ],
    subtotal: ["Laibung komplett (4.1 + 4.2 + 4.3)", "lfm", "44,00 €"],
    extraRows: [["4.4", "Zuschlag Rollladenkasten-Laibung", "lfm", "10,00 €"]],
  },
  {
    num: "05",
    title: "Sockel / Perimeterbereich",
    rows: [
      ["5.1", "Perimeterdämmung unter GOK kleben", "m²", "18,00 €"],
      ["5.2", "Sockelputz mineralisch armiert", "m²", "22,00 €"],
      ["5.3", "Sockelabschlussprofil setzen", "lfm", "8,00 €"],
      ["5.4", "Noppenbahn + Schutzfolie anbringen", "m²", "7,00 €"],
    ],
    subtotal: ["Sockel komplett (Durchschnittswert pro m² Sockelfläche)", "m²", "ca. 55,00 €"],
  },
  {
    num: "06",
    title: "Vorarbeiten",
    rows: [
      ["6.1", "Altputz abschlagen", "m²", "18,00 €"],
      ["6.2", "Fassade reinigen (Hochdruck)", "m²", "4,00 €"],
      ["6.3", "Algen- und Pilzentfernung inkl. Biozidbehandlung", "m²", "6,00 €"],
      ["6.4", "Risse sanieren (Einzelrisse)", "lfm", "8,00 €"],
    ],
  },
  {
    num: "07",
    title: "Anschlüsse und Details",
    rows: [
      ["7.1", "Rollladenkasten dämmen und einputzen", "Stück", "45,00 €"],
      ["7.2", "Fenster-/Türanschlussband setzen", "lfm", "9,00 €"],
      ["7.3", "Dehnungsfuge einbauen", "lfm", "12,00 €"],
      ["7.4", "Gesims, Faschen, Zierprofil", "lfm", "28,00 €"],
      ["7.5", "Tropfkantenprofil", "lfm", "6,00 €"],
    ],
  },
  {
    num: "08",
    title: "Sonstige Leistungen und Zuschläge",
    rows: [
      ["8.1", "Satellitenschüssel / Lampen demontieren + neu setzen", "Stück", "35,00 €"],
      ["8.2", "Hausnummer / Klingel neu setzen", "Stück", "25,00 €"],
      ["8.3", "Briefkasten demontieren und neu setzen", "Stück", "45,00 €"],
      ["8.4", "Zuschlag dunkler Farbton (HBW < 25)", "m²", "3,00 €"],
      ["8.5", "Zuschlag Rundungen / Erker", "m²", "12,00 €"],
      ["8.6", "Zuschlag Arbeiten über 3. OG (ohne Aufzug)", "m²", "5,00 €"],
    ],
  },
];

const excluded = [
  "Gerüst (Aufbau, Vorhaltung, Abbau)",
  "Entsorgung und Container",
  "Baustrom und Bauwasser",
  "Baustelleneinrichtung",
];

const hinweise = [
  "Alle Preise sind Nettopreise in Euro und verstehen sich als reine Lohnleistung.",
  "Preise gelten für Fassaden in Regelgeometrie bis 3. OG. Abweichungen siehe Zuschläge Pos. 8.",
  "Abrechnung erfolgt nach tatsächlich ausgeführten Mengen je Einheit (m² / lfm / Stück).",
  "Abdichtung der Fensterbänke gemäß ift-Montagerichtlinie bzw. DIN 18531.",
];

// Summen-Übersicht: nur Kapitel mit Subtotals + Schlüssel-Einzelpositionen
const summaryItems = [
  { label: "KAPITEL 01", title: "WDVS Grundleistung Komplett", price: "70,00 €", unit: "/ m²" },
  { label: "KAPITEL 04", title: "Laibung Komplett (4.1 + 4.2 + 4.3)", price: "44,00 €", unit: "/ lfm" },
  { label: "KAPITEL 05", title: "Sockel Komplett (Durchschnitt)", price: "ca. 55,00 €", unit: "/ m²" },
  { label: "KAPITEL 02", title: "Alu-Fensterbank bis 1,20 m", price: "50,00 €", unit: "/ Stück" },
  { label: "KAPITEL 03", title: "Naturstein-Fensterbank bis 1,20 m", price: "85,00 €", unit: "/ Stück" },
  { label: "KAPITEL 07", title: "Rollladenkasten dämmen + einputzen", price: "45,00 €", unit: "/ Stück" },
];

// ============================================================
// KOMPONENTEN
// ============================================================
const HeaderFooter = () => (
  <>
    <View style={styles.headerAccent} fixed />
    <View style={styles.header} fixed>
      <Text style={styles.headerLeft}>LEISTUNGSVERZEICHNIS</Text>
      <Text style={styles.headerRight}>Fassade / WDVS</Text>
    </View>
    <View style={styles.footer} fixed>
      <Text>Reine Lohnleistung · Preise netto in EUR</Text>
      <Text
        render={({ pageNumber, totalPages }) => `Seite ${pageNumber} / ${totalPages}`}
      />
    </View>
  </>
);

const TableHeader = () => (
  <View style={styles.tableHeader}>
    <Text style={[styles.cellPos, styles.headerCell]}>POS.</Text>
    <Text style={[styles.cellLeistung, styles.headerCell]}>LEISTUNG</Text>
    <Text style={[styles.cellEinheit, styles.headerCell]}>EINHEIT</Text>
    <Text style={[styles.cellPreis, styles.headerCell, { textAlign: "right" }]}>PREIS</Text>
  </View>
);

const TableRow = ({ pos, leistung, einheit, preis, alt }: any) => (
  <View style={[styles.tableRow, alt ? styles.tableRowAlt : {}]} wrap={false}>
    <Text style={styles.cellPos}>{pos}</Text>
    <Text style={styles.cellLeistung}>{leistung}</Text>
    <Text style={styles.cellEinheit}>{einheit}</Text>
    <Text style={styles.cellPreis}>{preis}</Text>
  </View>
);

const SubtotalRow = ({ leistung, einheit, preis }: any) => (
  <View style={[styles.tableRow, styles.tableRowSubtotal]} wrap={false}>
    <Text style={styles.cellPos}></Text>
    <Text style={[styles.cellLeistung, styles.subtotalText]}>{leistung}</Text>
    <Text style={[styles.cellEinheit, styles.subtotalText]}>{einheit}</Text>
    <Text style={[styles.cellPreis, styles.subtotalText]}>{preis}</Text>
  </View>
);

const ChapterBlock = ({ chapter }: any) => (
  <View wrap={false}>
    <Text style={styles.sectionEyebrow}>KAPITEL {chapter.num}</Text>
    <Text style={styles.sectionTitle}>{chapter.title}</Text>
    <View>
      <TableHeader />
      {chapter.rows.map((r: string[], i: number) => (
        <TableRow
          key={`${chapter.num}-${i}`}
          pos={r[0]}
          leistung={r[1]}
          einheit={r[2]}
          preis={r[3]}
          alt={i % 2 === 1}
        />
      ))}
      {chapter.subtotal && (
        <SubtotalRow
          leistung={chapter.subtotal[0]}
          einheit={chapter.subtotal[1]}
          preis={chapter.subtotal[2]}
        />
      )}
      {chapter.extraRows &&
        chapter.extraRows.map((r: string[], i: number) => (
          <TableRow
            key={`${chapter.num}-extra-${i}`}
            pos={r[0]}
            leistung={r[1]}
            einheit={r[2]}
            preis={r[3]}
            alt={false}
          />
        ))}
    </View>
    {chapter.note && (
      <View style={styles.hinweisBox}>
        <Text>{chapter.note}</Text>
      </View>
    )}
  </View>
);

// ============================================================
// DOKUMENT
// ============================================================
const MyDocument = () => (
  <Document
    title="Leistungsverzeichnis Fassade / WDVS"
    subject="Reine Lohnleistung – Preise netto in EUR"
  >
    {/* SEITE 1: Titel + Inhaltsverzeichnis */}
    <Page size="A4" style={styles.page}>
      <HeaderFooter />

      <Text style={styles.coverEyebrow}>LEISTUNGSVERZEICHNIS</Text>
      <Text style={styles.coverTitle}>
        Fassade & {"\n"}Wärmedämm&shy;verbundsystem
      </Text>
      <Text style={styles.coverSubtitle}>
        Reine Lohnleistung · Preise netto in EUR
      </Text>
      <View style={styles.coverDivider} />

      <Text style={[styles.sectionEyebrow, { marginTop: 4 }]}>ÜBERSICHT</Text>
      <Text style={styles.sectionTitle}>Inhaltsverzeichnis</Text>

      <View>
        {chapters.map((c) => (
          <View key={c.num} style={styles.tocRow}>
            <Text style={styles.tocNum}>{c.num}</Text>
            <Text style={styles.tocTitle}>{c.title}</Text>
          </View>
        ))}
        <View style={styles.tocRow}>
          <Text style={styles.tocNum}>09</Text>
          <Text style={styles.tocTitle}>Nicht enthaltene Leistungen</Text>
        </View>
        <View style={styles.tocRow}>
          <Text style={styles.tocNum}>—</Text>
          <Text style={styles.tocTitle}>Hinweise</Text>
        </View>
        <View style={styles.tocRow}>
          <Text style={styles.tocNum}>—</Text>
          <Text style={styles.tocTitle}>Preisübersicht (Schlüsselpositionen)</Text>
        </View>
      </View>
    </Page>

    {/* SEITE 2+: Kapitel 01 - 08 */}
    <Page size="A4" style={styles.page}>
      <HeaderFooter />
      {chapters.map((c) => (
        <ChapterBlock key={c.num} chapter={c} />
      ))}

      {/* Kapitel 09: Nicht enthaltene Leistungen */}
      <View wrap={false}>
        <Text style={styles.sectionEyebrow}>KAPITEL 09</Text>
        <Text style={styles.sectionTitle}>
          Nicht enthaltene Leistungen – separat zu beauftragen
        </Text>
        <View style={styles.excludedBox}>
          {excluded.map((item, i) => (
            <View key={i} style={styles.excludedItem}>
              <Text style={styles.excludedBullet}>•</Text>
              <Text style={styles.excludedText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Hinweise */}
      <View wrap={false}>
        <Text style={styles.sectionEyebrow}>HINWEISE</Text>
        <Text style={styles.sectionTitle}>&nbsp;</Text>
        <View>
          {hinweise.map((h, i) => (
            <View key={i} style={styles.hinweisRow}>
              <Text style={styles.hinweisNum}>{String(i + 1).padStart(2, "0")}</Text>
              <Text style={styles.hinweisText}>{h}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>

    {/* LETZTE SEITE: Summen-Übersicht */}
    <Page size="A4" style={styles.page}>
      <HeaderFooter />

      <Text style={styles.coverEyebrow}>PREISÜBERSICHT</Text>
      <Text style={styles.coverTitle}>
        Schlüssel&shy;positionen{"\n"}auf einen Blick
      </Text>
      <View style={[styles.coverDivider, { marginTop: 18 }]} />

      <View style={styles.summaryGrid}>
        {summaryItems.map((s, i) => (
          <View key={i} style={styles.summaryCard}>
            <View style={styles.summaryCardInner}>
              <Text style={styles.summaryLabel}>{s.label}</Text>
              <Text style={styles.summaryTitle}>{s.title}</Text>
              <View style={styles.summaryPriceRow}>
                <Text style={styles.summaryPriceValue}>{s.price}</Text>
                <Text style={styles.summaryPriceUnit}>{s.unit}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 24 }}>
        <View style={styles.hinweisBox}>
          <Text>
            Vollständige Preisliste und Detailpositionen siehe Kapitel 01 bis 08. Zuschläge gemäß Kapitel 08 sowie Vorarbeiten gemäß Kapitel 06 werden objektabhängig zusätzlich berechnet.
          </Text>
        </View>
      </View>
    </Page>
  </Document>
);

// ============================================================
// RENDER
// ============================================================
(async () => {
  await renderToFile(<MyDocument />, "./Leistungsverzeichnis_Fassade_WDVS.pdf");
  console.log("PDF erstellt: ./Leistungsverzeichnis_Fassade_WDVS.pdf");
})();
