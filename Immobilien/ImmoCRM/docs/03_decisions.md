# ImmoCRM — Architecture Decisions (ADRs)

Laufendes Log aller architektur-relevanten Entscheidungen während des Baus. Format pro Eintrag: kurz, datiert, mit Begründung. Eine Entscheidung wird nie still rückgängig gemacht — sie wird durch einen neuen Eintrag mit Status "Superseded by ADR-NNN" ersetzt.

---

## Eintrags-Template

```
## ADR-NNN — <Titel>

- **Datum:** YYYY-MM-DD
- **Status:** Accepted | Superseded by ADR-NNN | Deprecated
- **Schritt:** <Bauschritt aus 02_implementierungsplan.md>

### Kontext
Was war das Problem / die Frage?

### Entscheidung
Was wurde entschieden?

### Begründung
Warum so und nicht anders? Welche Alternativen wurden verworfen?

### Konsequenzen
Was zieht das nach sich (Konfiguration, Code-Stellen, Folge-Entscheidungen)?
```

---

## ADR-001 — Tech-Stack festgezurrt

- **Datum:** 2026-04-30
- **Status:** Accepted
- **Schritt:** Phase 1 (Sparring)

### Kontext
Wahl des Stacks für ein Single-User-Tool mit DB, Cron-Mail und Workflow-Integration.

### Entscheidung
Vite + React + TS · Tailwind + shadcn/ui · TanStack Table · Supabase · Vercel · Gmail SMTP. Details siehe [01_projektbeschreibung.md](01_projektbeschreibung.md) Abschnitt 2.

### Begründung
- Vite statt Next.js: kein SSR/SEO nötig, schnellerer DX
- Supabase: Cloud-DB + REST API für Workflow-Integration ohne eigenen Server
- Vercel: Free-Tier reicht, integrierter Cron für Tages-Mail
- shadcn/ui: editierbare Components, kein Lock-in

### Konsequenzen
- Keine Backend-API zu pflegen — Logik liegt im Frontend + DB-Triggers
- Workflow-Integration via Supabase REST direkt aus Cloud Code

---

## ADR-002 — Keine PDF-Speicherung

- **Datum:** 2026-04-30
- **Status:** Accepted
- **Schritt:** Phase 1

### Kontext
Sollen Exposé-PDFs zentral im System abgelegt werden?

### Entscheidung
Nein. PDFs bleiben lokal (PC/OneDrive). Im CRM nur Verweis-Strings (`expose_url`, `expose_local_path`).

### Begründung
- Supabase Free-Storage spart sich auf Wesentliches (DB)
- Kein Sync-Problem zwischen lokal und Cloud
- DSGVO-Footprint minimiert

### Konsequenzen
- Beim PDF-Drag-Drop (Schritt 5): in-memory parsen, dann verwerfen
- `expose_local_path` ist freier String, keine Validierung der Existenz

---

<!-- Ab hier folgen ADRs aus dem Bau. Pro Schritt eine Sektion mit ADR-003, ADR-004 … -->
