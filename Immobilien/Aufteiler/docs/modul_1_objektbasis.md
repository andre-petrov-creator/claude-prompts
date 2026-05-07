# Modul 1 — Objektbasis — `modul_1_objektbasis.xml`

============================================================

## Zweck

Erfasst die zwei zentralen Datenstrukturen, die alle anderen Module brauchen: **WE-Liste** (Wohneinheiten-Tabelle als Referenz für Modul 4 + 5 + Excel) und **Boden-Gebäude-Verteilung des Kaufpreises**. Letzteres ab v1.1 nach **ImmoWertV-Sachwertverfahren** (Anlage 4 ImmoWertV 2021) statt vereinfacht. Liefert die FA-konforme AfA-Bemessungsgrundlage für Modul 3 und Stammdaten für Modul 5 PDF-Sektion 3.

============================================================

## Files

- **Hauptdatei:** `modul_1_objektbasis.xml`
- **Excel-Sheets:** `MIETER` (WE-Liste `A8:K27`), `BESICHTIGUNG` (Status-Zellen `B31`/`B32`/`B33`), `KALKU` (Boden/Gebäude/Sachwert `C20`–`C28`)
- **Notion-Quellen:** Preisdatenbank GMB (`3310ae59-38e4-81f1-ad36-e8bd809d437a`)
- **Web:** BORIS.NRW (`https://www.boris.nrw.de/borisplus`) — User-manueller Lookup oder Modul-Web-Search

============================================================

## Datenfluss

```
Exposé (Mieterliste, Wohnflächen) ─┐
Adresse ───────────────────────────┤
Grundstücksfläche ─────────────────┼──► Modul 1 ─┬─► WE-Liste ──► MIETER!A8:K27
Kaufpreis ─────────────────────────┤            │
                                   │            └─► Boden-Gebäude (B2) ──► KALKU!C20–C28
BGF (v1.1) ────────────────────────┤                                   ──► Modul 5 Sektion 3
NHK_2010 (v1.1) ───────────────────┤                                   ──► Modul 3 (AfA-Basis)
BKI-Index 2026 (v1.1) ─────────────┤
Sachwertfaktor (v1.1) ─────────────┘
```

**Inputs Pflicht (Original v1.0):**
- Exposé mit Mieterliste oder Mietaufstellung
- Adresse (für Bodenrichtwert-Lookup)
- Grundstücksfläche m²
- Kaufpreis EUR

**Inputs Pflicht für Sachwertverfahren (v1.1):**
- BGF (Brutto-Grundfläche m²) — Wohnfläche × 1,30…1,40 oder Architektenwert
- NHK_2010 (Normalherstellungskosten je m² BGF) — Anlage 4 ImmoWertV 2021, MFH Bj. 1977 Standard normal: ca. 700–900 EUR/m²
- BKI-Index 2026 (Baupreisindex zur Indexierung 2010 → 2026)
- Sachwertfaktor (aus GMB Stadt-Subpage; Default 1,0 wenn nicht ermittelbar)

**Verarbeitung:**
- **Step A1:** WE-Tabelle aus Mieterliste extrahieren oder Hülle anlegen (bei fehlender Liste); Altmieter-Erkennung (Mietbeginn vor 2000)
- **Step B1:** Bodenrichtwert-Lookup (Notion GMB → BORIS.NRW)
- **Step B2 (v1.1):** Sachwertverfahren — 4 Blöcke
  - Block 1: Bodenwert = Bodenrichtwert × Grundstücksfläche
  - Block 2: Gebäudesachwert vorläufig = NHK_2010_indexiert × BGF × (1 − Alterswertminderung) × Modernisierungsfaktor
  - Block 3: Marktangepasster Sachwert = (Bodenwert + Gebäudesachwert) × Sachwertfaktor
  - Block 4: KP-Verteilung = KP × Gebäudesachwert / (Bodenwert + Gebäudesachwert)
- **Step B2 Fallback:** vereinfachte Methode (KP − Bodenwert) wenn BGF/NHK fehlen, mit FA-Akzeptanz-Hinweis
- **Step C1:** Zusammenfassung (was komplett, was offen)

**Outputs:**
- WE-Tabelle für Modul 4 + 5 + Excel
- Boden-Gebäude-Verteilung des KP für Modul 3 (AfA-Basis)
- Excel-Transfer-Block `KALKU!C20`–`C28`

============================================================

## Schnittstellen

| Schnittstelle | Typ | Adresse / Detail |
|---------------|-----|------------------|
| WE-Liste | Excel-Cell | `MIETER!A8:K27` |
| JNKM IST Summe | Excel-Cell | `BESICHTIGUNG!B33` |
| Anzahl vermietet/Leerstand | Excel-Cell | `BESICHTIGUNG!B31`, `B32` |
| Bodenrichtwert EUR/m² | Excel-Cell | `KALKU!C20` |
| Bodenwert (Block 1) EUR | Excel-Cell | `KALKU!C21` |
| Gebäude-KP-Anteil EUR (= AfA-Basis) | Excel-Cell | `KALKU!C22` |
| Gebäudeanteil % | Excel-Cell | `KALKU!C23` |
| BGF m² (v1.1, Vorschlag) | Excel-Cell | `KALKU!C24` |
| NHK_2010 indexiert (v1.1, Vorschlag) | Excel-Cell | `KALKU!C25` |
| Gebäudesachwert vorläufig (v1.1, Vorschlag) | Excel-Cell | `KALKU!C26` |
| Sachwertfaktor (v1.1, Vorschlag) | Excel-Cell | `KALKU!C27` |
| Marktangepasster Sachwert (v1.1, Vorschlag) | Excel-Cell | `KALKU!C28` |
| BORIS.NRW | Web-Lookup | `https://www.boris.nrw.de/borisplus` |
| GMB Preisdatenbank | Notion-Read | `3310ae59-38e4-81f1-ad36-e8bd809d437a` |
| Modernisierungspunkte (Konsument) | Modul-Lookup | aus Modul 3 RND-Modell, fließt in Block 2 (Alterswertminderung) |

============================================================

## Bekannte Limitierungen

- **NHK_2010-Tabellen sind aktuell User-Recherche** — keine automatische Notion-Quelle. Anlage 4 ImmoWertV 2021 PDF nachschlagen. TODO: in künftiger Version Notion-DB für NHK_2010-Werte je Gebäudetyp anlegen.
- **BKI-Baupreisindex 2026** muss aktuell nachgeschlagen werden (BKI Baupreisindex-Tabelle, Statistisches Bundesamt). Default-Indexwert nicht zuverlässig — User pflegt.
- **Sachwertfaktor** kommt aus GMB Stadt-Subpage — nicht alle Städte führen ihn aus. Default 1,0 mit Hinweis.
- **Excel-Template hat C24–C28 noch nicht** (v1.1-Vorschlag). Bis zur Template-Erweiterung werden diese Werte nur im Chat-Output und im PDF (Modul 5 Sektion 3) gehalten.
- **Fallback vereinfachte Methode** bei fehlenden Inputs erlaubt PDF-Build, aber FA-Akzeptanz nicht garantiert (BFH IX R 7/23 verlangt sachverständige Würdigung). User-Hinweis explizit.
- **Aufbau-Baujahr vs. Substanz-Baujahr:** bei Wiederaufbauten (z.B. Prosperstr. 59 Substanz 1910 / Aufbau 1977) gilt für die Alterswertminderung das Aufbau-Baujahr; das Substanz-Baujahr ist Argument für SV-Gutachten in Modul 3.

============================================================

## Versions-Historie

| Version | Datum | Änderung (Stichwort) | Plan-Ref |
|---------|-------|----------------------|----------|
| v1.1 | 2026-05-07 | Step B2 auf ImmoWertV-Sachwertverfahren umgestellt (4 Blöcke); neue Pflicht-Inputs BGF/NHK_2010/BKI-Index/Sachwertfaktor; Excel-Transfer-Vorschlag `C24`–`C28`; Fallback vereinfachte Methode mit FA-Hinweis | `plans/2026-05-07-modul5-pdf-export-anpassung.md` |
| v1.0 | initial | WE-Liste + vereinfachte Boden-Gebäude-Verteilung (KP − Bodenwert) | — |
