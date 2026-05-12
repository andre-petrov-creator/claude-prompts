# Aufteiler Skill-Umbau — Test-Protokoll

Begleitende Test-Doku zu `docs/superpowers/plans/2026-05-12-aufteiler-skill-umbau.md`.

---

## Phase 2 Smoke-Test (Task 12) — 2026-05-12

**Ziel:** Orchestrator (`aufteiler`) + Modul 0 (`aufteiler-modul-0-quickcheck`) funktional verifizieren.

**Methodik:** Da der Live-Skill-Aufruf nicht aus der Implementierungs-Session selbst getestet werden kann, wurde der Test **funktional als Spezifikations-Check** durchgeführt:
1. Slug-Bildung gemäß Orchestrator-Regel (§3.2) manuell durchgespielt.
2. State-Init-Block gemäß Orchestrator-Schritt 4 als JSON erzeugt.
3. Modul-0-Berechnung (Formel §3b im Skill) auf Beispieldaten angewendet.
4. State über `tools/validate_state.py` validiert.

### Ergebnisse

| # | Prüfpunkt | Soll | Ist | Status |
|---|-----------|------|-----|--------|
| 1 | Slug für „Musterstr. 1, 45000 Musterstadt" | `musterstr-1-musterstadt` | `musterstr-1-musterstadt` | ✓ |
| 2 | State-Init erzeugt valides Minimal-Objekt | Validator exit 0 | exit 0 | ✓ |
| 3 | Gap-Berechnung Test A (Angebot 1.000.000 €, Konsens 1.080.000 €) | gap_prozent = -7.41 %, status `gruen` | -7.41 %, `gruen` | ✓ |
| 4 | Gap-Berechnung Test B (Angebot 1.160.000 €, Konsens 1.080.000 €) | gap_prozent = +7.41 %, ueber_schwelle = true, status `rot` | +7.41 %, true, `rot` | ✓ |
| 5 | `modul_0`-Block schema-konform | Validator exit 0 | exit 0 | ✓ |
| 6 | `runs/<slug>/state.json` ist gitignored | git check-ignore matched | matched | ✓ |

### Plan-Erwartung Step 12.1 — Hinweis

Step 12.1 Punkt 5 sagt „Gap 7.4% → Status rot". Bei den dort vorgeschlagenen Werten (Angebot 1.000.000 €, ETW-Konsens 180.000 × 6 = 1.080.000 €) ist das Angebot jedoch **unter** dem Konsens, gap_prozent = **–7.4 %**, Status korrekt `gruen`. Plan-Beispiel ist missverständlich formuliert; **Skill-Formel ist korrekt**.

Für ein „rot"-Szenario muss das Angebot **über** dem Konsens liegen (z.B. 1.160.000 € vs. 1.080.000 € = +7.4 %).

### Verdict

**Phase 2 grün.** Keine Fix-Task vor Phase 3 nötig. Orchestrator + Modul 0 sind funktional konsistent, State-Schema und Validator greifen wie erwartet.

**Offen für Live-Test in neuer Session:** Verbliebener nicht-automatisierbarer Test ist der reale Skill-Aufruf via `Skill`-Tool in einer frischen Claude-Code-Session (User-Interaktion via `AskUserQuestion`). Wird beim ersten echten Objekt in Phase 3 mitabgedeckt.
