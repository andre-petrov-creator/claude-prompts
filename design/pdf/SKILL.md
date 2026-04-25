---
name: pdf
description: Generiert PDFs im Standard-Design für jeden Output-Typ (Angebot, Leistungsverzeichnis, Exposé, Anschreiben, Report, Rechnung, Onepager, Pitch-Dokument, etc.). Schriftart IBM Plex Sans, Farbpalette Anthrazit + Bronze, A4 Format. Nutze diesen Skill IMMER, wenn ein PDF erstellt werden soll, unabhängig vom Inhalt oder Dokument-Typ.
---

# PDF Standard Design

Einheitliches Design für alle PDF-Outputs. Basiert auf React-PDF (`@react-pdf/renderer`).

## Wann nutzen

**Bei jeder PDF-Erstellung, ohne Ausnahme.** Egal ob:
- Angebot, Leistungsverzeichnis, Rechnung
- Exposé, Investor-Onepager, Pitch-Dokument
- Anschreiben, Geschäftsbrief, formelles Schreiben
- Report, Analyse, Auswertung, Quick-Check
- Übersicht, Konzept, Strategie-Papier
- Jeder andere Dokument-Typ

Das Design ist absichtlich generisch gehalten, damit jeder Output-Typ damit funktioniert.

Für API-Details zu React-PDF siehe Schwester-Skill [`../react-pdf/`](../react-pdf/).

## Setup (einmal pro Session)

```bash
mkdir -p /home/claude/pdf-work/fonts
cd /home/claude/pdf-work

# Dependencies
npm init -y > /dev/null
npm install react @react-pdf/renderer
npm install -D tsx @types/react

# IBM Plex Sans laden
URLS=($(curl -sL "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" -A "Mozilla/5.0" | grep -oP "https://[^)]+\.ttf"))
curl -sL "${URLS[0]}" -o fonts/IBMPlexSans-Italic.ttf
curl -sL "${URLS[1]}" -o fonts/IBMPlexSans-Regular.ttf
curl -sL "${URLS[2]}" -o fonts/IBMPlexSans-Medium.ttf
curl -sL "${URLS[3]}" -o fonts/IBMPlexSans-SemiBold.ttf
curl -sL "${URLS[4]}" -o fonts/IBMPlexSans-Bold.ttf

# Verifizieren — muss "TrueType Font data" zeigen
file fonts/*.ttf | grep -q "TrueType" || echo "FEHLER: Fonts sind kein TrueType, Download fehlgeschlagen"
```

## Workflow

1. Kopiere `template.tsx` aus diesem Skill nach `/home/claude/pdf-work/document.tsx`
2. Passe NUR den Daten-Block am Ende an (das `<MyDocument />` Beispiel)
3. Render: `npx tsx document.tsx`
4. Output: `output.pdf` im selben Ordner

## Design-Konstanten (NICHT ändern)

```ts
const C = {
  anthrazit:      "#1F2937",  // Primär-Dunkel, Headings, Tabellen-Header
  textDark:       "#374151",  // Body-Text
  textMid:        "#6B7280",  // Sekundär-Text
  textLight:      "#9CA3AF",  // Tertiär (Footer)
  lineLight:      "#E5E7EB",  // Trennlinien
  bgSoft:         "#F9FAFB",  // Zebra-Streifen, Karten-Hintergrund
  bronze:         "#B45309",  // Akzent, Eyebrow-Labels, Hervorhebungen
  white:          "#FFFFFF",
};

// Schrift: IBM Plex Sans
// Body 9.5, Section-Title 13, Cover-Title 28, Eyebrow 8-9
```

## Verfügbare Komponenten

| Komponente | Zweck |
|------------|-------|
| `<HeaderFooter />` | Fixed Header (Bronze-Akzentlinie + Titel) + Footer (Seitenzahl) |
| `<CoverBlock />` | Großer Titel-Block (Eyebrow + Title + Subtitle + Divider) |
| `<TableOfContents />` | Inhaltsverzeichnis aus Items-Array |
| `<SectionHeader />` | Eyebrow-Label + Section-Title |
| `<DataTable />` | 4-Spalten Tabelle mit Zebra-Streifen |
| `<TableRow />` | Einzelne Zeile, optional alt-Style |
| `<SubtotalRow />` | Hervorgehobene Summenzeile in Bronze |
| `<ChapterBlock />` | SectionHeader + DataTable + optional Note (wrap={false}) |
| `<HinweisBox />` | Italic-Box mit Bronze-Linie für Erläuterungen |
| `<ExcludedBox />` | Bullet-Liste mit Bronze-Linie |
| `<NumberedHints />` | Nummerierte Hinweise mit Bronze-Nummern |
| `<SummaryGrid />` | 2-Spalten Karten-Grid für Übersichten |

## Anpassungs-Regeln

**Erlaubt (auf Anweisung):**
- Sektionen hinzufügen / entfernen
- Spalten-Anzahl der Tabelle ändern
- Cover-Inhalte (Titel, Empfänger-Adresse, Logo)
- Karten-Anzahl im SummaryGrid
- Komponenten weglassen (z.B. kein Cover, kein TOC)

**NICHT ändern ohne explizite Anweisung:**
- Farbpalette
- Schriftart
- Schriftgrößen-Verhältnisse
- Margins / Paddings
- Header / Footer Layout

## Inhaltliche Integrität

**Kritische Regel:** Daten 1:1 vom Input übernehmen. Nichts dazu erfinden.

- Keine Zusatztexte wie "Konditionen", "Zusammenfassung", "Übersicht" einfügen, wenn nicht im Original
- Keine Untertitel oder erklärende Überschriften erfinden
- Keine Branding-Elemente einfügen (Firmennamen, Logos, etc.) wenn nicht ausdrücklich gewünscht
- Bei Unsicherheit: nachfragen statt platzhaltern

## Beispiele für verschiedene Dokument-Typen

### Angebot / Leistungsverzeichnis
- Cover mit Titel + Untertitel
- TOC
- ChapterBlock pro Kapitel mit DataTable
- Optional: SummaryGrid für Schlüsselpositionen am Ende

### Exposé Immobilie
- Cover mit Objekt-Adresse + Eckdaten
- SectionHeader + Body-Text für Beschreibung
- DataTable für Eckdaten (Wohnfläche, Zimmer, Baujahr, etc.)
- HinweisBox für rechtliche Hinweise

### Anschreiben / Brief
- Empfänger-Adresse oben links (eigene Komponente, derzeit nicht im Template)
- Datum rechts
- Betreff-Zeile (sectionTitle-Style)
- Body-Text (style.cellLabel oder eigener Style)
- Signatur unten

### Report / Analyse
- Cover mit Report-Titel + Erstellungsdatum
- TOC
- SectionHeader + Body-Text + DataTable je Kapitel
- SummaryGrid für Key-Metrics
- NumberedHints für Empfehlungen / Action-Items

### Onepager / Pitch
- Cover-Block füllt halbe Seite
- 2-3 SummaryGrid-Cards für Kern-Botschaften
- Knapper Body-Text
- Eine ExcludedBox für USPs oder Highlights

## Beispiel

Vollständiges Beispiel siehe [`assets/example-leistungsverzeichnis.tsx`](./assets/example-leistungsverzeichnis.tsx). Das ist ein 6-seitiges Leistungsverzeichnis mit Cover, TOC, 8 Kapiteln, Hinweisen und Preisübersicht.

## Bekannte Quirks

- Bullet-Zeichen `▸` rendert in IBM Plex Sans als `¸`. Nutze stattdessen `•` oder `◆`
- `&shy;` (soft hyphen) funktioniert für Trennstellen in langen Wörtern
- `wrap={false}` auf `<View>` verhindert Seitenumbrüche mitten in Tabellen
- `Font.registerHyphenationCallback((word) => [word])` zwingend nach Font-Registration

## Fehlerbehebung

**Fonts laden nicht:** `file fonts/*.ttf` muss "TrueType Font data" zeigen, nicht "HTML document". Bei HTML-Output: Google Fonts CSS-API hat möglicherweise CDN-Probleme, neu versuchen.

**Tabelle wird mitten getrennt:** Tabelle in `<View wrap={false}>` einpacken.

**Text wird falsch umgebrochen:** Hyphenation-Callback gesetzt? Wenn ja, manuell `&shy;` einfügen.
