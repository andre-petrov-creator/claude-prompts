/**
 * STANDARD PDF TEMPLATE
 * 
 * Einheitliches Design für alle PDF-Outputs.
 * Kopiere diese Datei nach /home/claude/pdf-work/document.tsx und passe NUR den DATEN-Block am Ende an.
 * 
 * Design-Konstanten (Farben, Fonts, Sizes) NICHT ändern, außer auf explizite Anweisung.
 * 
 * Render: npx tsx document.tsx
 */

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
// FONT REGISTRATION (Pfade relativ zum Working Directory)
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
// FARBPALETTE — Anthrazit + Bronze
// ============================================================
export const C = {
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
export const styles = StyleSheet.create({
  page: {
    fontFamily: "IBM Plex Sans",
    fontSize: 9.5,
    color: C.textDark,
    paddingTop: 70,
    paddingBottom: 55,
    paddingHorizontal: 50,
    lineHeight: 1.45,
  },

  // Header / Footer
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

  // Section
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
  tableRowAlt: { backgroundColor: C.bgSoft },
  tableRowSubtotal: {
    backgroundColor: C.bgSoft,
    borderTopWidth: 0.5,
    borderTopColor: C.anthrazit,
    paddingVertical: 8,
  },
  cellPos: { width: "13%", fontSize: 9, color: C.textDark },
  cellLabel: { width: "57%", fontSize: 9, color: C.textDark, paddingRight: 6 },
  cellUnit: { width: "13%", fontSize: 9, color: C.textDark, textAlign: "center" },
  cellPrice: { width: "17%", fontSize: 9, color: C.textDark, textAlign: "right", fontWeight: 500 },
  headerCell: { fontSize: 9, fontWeight: 600, color: C.white, letterSpacing: 0.3 },
  subtotalText: { fontWeight: 700, color: C.bronze },

  // Boxen
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
  excludedBox: {
    backgroundColor: C.bgSoft,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: C.bronze,
  },
  excludedItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 4 },
  excludedBullet: { color: C.bronze, fontWeight: 700, marginRight: 8, fontSize: 10 },
  excludedText: { fontSize: 9.5, color: C.textDark, flex: 1 },

  // Hinweise nummeriert
  hinweisRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.3,
    borderBottomColor: C.lineLight,
    alignItems: "flex-start",
  },
  hinweisNum: { width: 22, fontSize: 9, fontWeight: 700, color: C.bronze },
  hinweisText: { flex: 1, fontSize: 9, color: C.textDark, lineHeight: 1.5 },

  // TOC
  tocRow: {
    flexDirection: "row",
    paddingVertical: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: C.lineLight,
    alignItems: "center",
  },
  tocNum: { width: 32, fontSize: 9, fontWeight: 600, color: C.bronze },
  tocTitle: { flex: 1, fontSize: 10, color: C.anthrazit, fontWeight: 500 },

  // Summary Grid
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 10, marginHorizontal: -6 },
  summaryCard: { width: "50%", padding: 6 },
  summaryCardInner: {
    backgroundColor: C.bgSoft,
    borderLeftWidth: 3,
    borderLeftColor: C.bronze,
    padding: 12,
  },
  summaryLabel: { fontSize: 8, color: C.textMid, fontWeight: 500, letterSpacing: 0.5, marginBottom: 4 },
  summaryTitle: { fontSize: 10, color: C.anthrazit, fontWeight: 600, marginBottom: 8, lineHeight: 1.3 },
  summaryPriceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  summaryPriceValue: { fontSize: 14, fontWeight: 700, color: C.anthrazit },
  summaryPriceUnit: { fontSize: 9, color: C.textMid },

  // Body Text (für Briefe, Reports, etc.)
  bodyText: {
    fontSize: 10,
    color: C.textDark,
    lineHeight: 1.6,
    marginBottom: 8,
  },
});

// ============================================================
// REUSABLE COMPONENTS
// ============================================================

export const HeaderFooter = ({ headerLeft = "DOKUMENT", headerRight = "", footerLeft = "" }: any) => (
  <>
    <View style={styles.headerAccent} fixed />
    <View style={styles.header} fixed>
      <Text style={styles.headerLeft}>{headerLeft}</Text>
      <Text style={styles.headerRight}>{headerRight}</Text>
    </View>
    <View style={styles.footer} fixed>
      <Text>{footerLeft}</Text>
      <Text render={({ pageNumber, totalPages }) => `Seite ${pageNumber} / ${totalPages}`} />
    </View>
  </>
);

export const CoverBlock = ({ eyebrow, title, subtitle }: any) => (
  <>
    {eyebrow && <Text style={styles.coverEyebrow}>{eyebrow}</Text>}
    <Text style={styles.coverTitle}>{title}</Text>
    {subtitle && <Text style={styles.coverSubtitle}>{subtitle}</Text>}
    <View style={styles.coverDivider} />
  </>
);

export const SectionHeader = ({ eyebrow, title }: any) => (
  <>
    {eyebrow && <Text style={styles.sectionEyebrow}>{eyebrow}</Text>}
    <Text style={styles.sectionTitle}>{title}</Text>
  </>
);

export const TableOfContents = ({ items }: { items: { num: string; title: string }[] }) => (
  <View>
    {items.map((it, i) => (
      <View key={i} style={styles.tocRow}>
        <Text style={styles.tocNum}>{it.num}</Text>
        <Text style={styles.tocTitle}>{it.title}</Text>
      </View>
    ))}
  </View>
);

export const TableHeader = ({ cols = ["POS.", "LEISTUNG", "EINHEIT", "PREIS"] }: any) => (
  <View style={styles.tableHeader}>
    <Text style={[styles.cellPos, styles.headerCell]}>{cols[0]}</Text>
    <Text style={[styles.cellLabel, styles.headerCell]}>{cols[1]}</Text>
    <Text style={[styles.cellUnit, styles.headerCell]}>{cols[2]}</Text>
    <Text style={[styles.cellPrice, styles.headerCell, { textAlign: "right" }]}>{cols[3]}</Text>
  </View>
);

export const TableRow = ({ pos, label, unit, price, alt }: any) => (
  <View style={[styles.tableRow, alt ? styles.tableRowAlt : {}]} wrap={false}>
    <Text style={styles.cellPos}>{pos}</Text>
    <Text style={styles.cellLabel}>{label}</Text>
    <Text style={styles.cellUnit}>{unit}</Text>
    <Text style={styles.cellPrice}>{price}</Text>
  </View>
);

export const SubtotalRow = ({ label, unit, price }: any) => (
  <View style={[styles.tableRow, styles.tableRowSubtotal]} wrap={false}>
    <Text style={styles.cellPos}></Text>
    <Text style={[styles.cellLabel, styles.subtotalText]}>{label}</Text>
    <Text style={[styles.cellUnit, styles.subtotalText]}>{unit}</Text>
    <Text style={[styles.cellPrice, styles.subtotalText]}>{price}</Text>
  </View>
);

export const DataTable = ({ rows, subtotal, extraRows, headerCols }: any) => (
  <View>
    <TableHeader cols={headerCols} />
    {rows.map((r: string[], i: number) => (
      <TableRow key={i} pos={r[0]} label={r[1]} unit={r[2]} price={r[3]} alt={i % 2 === 1} />
    ))}
    {subtotal && <SubtotalRow label={subtotal[0]} unit={subtotal[1]} price={subtotal[2]} />}
    {extraRows &&
      extraRows.map((r: string[], i: number) => (
        <TableRow key={`x-${i}`} pos={r[0]} label={r[1]} unit={r[2]} price={r[3]} alt={false} />
      ))}
  </View>
);

export const ChapterBlock = ({ num, title, rows, subtotal, extraRows, note, headerCols }: any) => (
  <View wrap={false}>
    <SectionHeader eyebrow={num ? `KAPITEL ${num}` : undefined} title={title} />
    <DataTable rows={rows} subtotal={subtotal} extraRows={extraRows} headerCols={headerCols} />
    {note && (
      <View style={styles.hinweisBox}>
        <Text>{note}</Text>
      </View>
    )}
  </View>
);

export const HinweisBox = ({ children }: any) => (
  <View style={styles.hinweisBox}>
    <Text>{children}</Text>
  </View>
);

export const ExcludedBox = ({ items }: { items: string[] }) => (
  <View style={styles.excludedBox}>
    {items.map((item, i) => (
      <View key={i} style={styles.excludedItem}>
        <Text style={styles.excludedBullet}>•</Text>
        <Text style={styles.excludedText}>{item}</Text>
      </View>
    ))}
  </View>
);

export const NumberedHints = ({ items }: { items: string[] }) => (
  <View>
    {items.map((h, i) => (
      <View key={i} style={styles.hinweisRow}>
        <Text style={styles.hinweisNum}>{String(i + 1).padStart(2, "0")}</Text>
        <Text style={styles.hinweisText}>{h}</Text>
      </View>
    ))}
  </View>
);

export type SummaryItem = { label: string; title: string; price: string; unit: string };

export const SummaryGrid = ({ items }: { items: SummaryItem[] }) => (
  <View style={styles.summaryGrid}>
    {items.map((s, i) => (
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
);

export const BodyText = ({ children }: any) => (
  <Text style={styles.bodyText}>{children}</Text>
);

// ============================================================
// MINIMAL EXAMPLE — passe diesen Block für deinen Use Case an
// ============================================================

const MyDocument = () => (
  <Document title="Dokumenttitel">
    {/* SEITE 1: Cover + TOC */}
    <Page size="A4" style={styles.page}>
      <HeaderFooter headerLeft="DOKUMENT" headerRight="Untertitel" />

      <CoverBlock
        eyebrow="EYEBROW LABEL"
        title={"Haupt&shy;titel\nin zwei Zeilen"}
        subtitle="Untertitel oder Beschreibung"
      />

      <SectionHeader eyebrow="ÜBERSICHT" title="Inhaltsverzeichnis" />
      <TableOfContents
        items={[
          { num: "01", title: "Erstes Kapitel" },
          { num: "02", title: "Zweites Kapitel" },
        ]}
      />
    </Page>

    {/* SEITE 2+: Inhalt */}
    <Page size="A4" style={styles.page}>
      <HeaderFooter headerLeft="DOKUMENT" headerRight="Untertitel" />

      <ChapterBlock
        num="01"
        title="Erstes Kapitel"
        rows={[
          ["1.1", "Erste Position", "Stück", "10,00 €"],
          ["1.2", "Zweite Position", "Stück", "20,00 €"],
        ]}
        subtotal={["Summe Kapitel 01", "Stück", "30,00 €"]}
        note="Optional: Zusatzhinweis als Italic-Box"
      />
    </Page>
  </Document>
);

(async () => {
  await renderToFile(<MyDocument />, "./output.pdf");
  console.log("PDF erstellt: ./output.pdf");
})();
