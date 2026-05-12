# Prompt für Phase 4 (neuer Chat)

Phase 3 des Aufteiler-Skill-Umbaus ist abgeschlossen (Tag `phase-3-module-1-bis-4`). Jetzt Phase 4.

Lies den Plan unter `docs/superpowers/plans/2026-05-12-aufteiler-skill-umbau.md` und führe Phase 4 aus (Tasks 18–22: PDF-Form-Skill, Modul 5 Deal-Bewertung, End-to-End-Test, Doku-Update README/ARCHITEKTUR/CLAUDE, Entscheidung archive/-Löschung).

Nutze dafür den Skill `superpowers:executing-plans`.

Phase-3-Artefakte, die du nutzen kannst:
- `skills/aufteiler-modul-{0..4}/SKILL.md` — alle vollständig ausgeschrieben, deterministische Formeln
- `runs/prosperstr-59-essen-dellwig/state.json` — vollständiger Vollanalyse-State 0→4 (Test-Daten)
- `docs/excel_handoff.md` — Sheets MIETER, KALKU, RENO, BESICHTIGUNG, VK_CF, VERKAUFSMATRIX dokumentiert; Brutto/Netto-Konvention als TODO markiert
- `archive/skill_pdf_export.md` — alte PDF-Form-Quelle (R1–R13)
- `archive/modul_5_verdict.xml` — alte Verdict-Logik (PDF + Excel-Befüllung + 11 Charts)
- `plans/2026-05-12-score-logik-modul-5-offen.md` — Platzhalter-Konzept für Score
- `plans/2026-05-12-aufteiler-skill-umbau-tests.md` — Phase-2 + Phase-3 Test-Protokolle

Wichtig:
- Reihenfolge gemäß Plan: Task 18 (PDF-Form) → 19 (Modul 5) → 20 (E2E-Test + Compression-Test) → 21 (README/ARCHITEKTUR/CLAUDE/docs-README) → 22 (archive-Entscheidung)
- Direkt auf main committen, am Ende `phase-4-skill-suite-komplett` taggen + pushen
- Bei Task 20 (E2E-Test): falls Live-Skill-Aufruf aus Build-Session nicht möglich, funktional via State-Aufbau prüfen (analog Phase 2/3 Tests)
- Bei Task 22 (archive-Löschung): User explizit fragen, nicht autonom löschen — Default ist „behalten"
- Modul 5 verbraucht alle vorherigen Module — keine User-Inputs erforderlich (laut Plan), nur Score-Aggregation aus Modul 0–4
- PDF-Skill aus `archive/skill_pdf_export.md` 1:1 übernehmen, nur Frontmatter umstellen (name/description statt type/version)
- Excel-Befüllung in Modul 5 via openpyxl: liest Werte aus state.json gemäß `docs/excel_handoff.md`, befüllt Kopie von `template/Kalkulation_Aufteiler_mit_VK_CF.xlsx`

Falls Test rot, Fix-Task definieren bevor Phase 5 startet (gibt's nicht — Phase 4 ist die letzte). Bei Brutto/Netto-Verifikation Excel-Template: falls aus der Build-Session nicht prüfbar, in Modul 5 beide Werte schreiben und Vermerk in `excel_handoff.md` lassen.

Akzeptanzkriterien aus Spec § 13 (siehe Plan-Ende) am Ende durchgehen — jedes Häkchen prüfen, abhakbar oder mit Begründung offen.

-----

Laufe komplett durch. Falls Phase 4 zu lang wird und Compression Sorge macht, kannst du nach Task 19 (Modul 5 fertig + commit) einen Zwischen-Tag `phase-4-modul-5-fertig` setzen und in neuem Chat fortsetzen. Default: alles in einem Chat durchziehen.

Ich verlasse jetzt den Computer und möchte, dass du eigenständig durchläufst.
