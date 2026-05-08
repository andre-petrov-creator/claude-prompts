# 05 — Tools, Skills & Workflow für ImmoCRM

> **Zweck:** Sagt nicht *was* gebaut wird (das macht [02_implementierungsplan.md](02_implementierungsplan.md)), sondern *wie* — welcher Skill, welcher Effort, welches Modell, welche Slash-Commands, welche MCPs pro Bau-Schritt.
>
> **Lese-Pflicht:** Vor jeder Coding-Session zusätzlich zu CLAUDE.md anhängen. Diese Datei ändert sich nur bei Skill-/Workflow-Änderungen, nicht pro Bau-Schritt.

---

## TL;DR — Setup vor Phase-3-Schritt-0

1. **6 ADR-Lücken aus §8 schließen** in `03_decisions.md` (vor Schritt 1)
2. **5 Pflicht-Skills + 2 MCPs installieren** (siehe §3, Copy-Paste-Prompt)
3. **`.claudeignore` anlegen** (siehe §6)
4. **`/model opus` + `/effort xhigh`** als Default
5. **Erst dann:** Phase-3-Schritt-0 starten

---

## 1. Skill-Inventar

### 🟢 Pflicht — vor Schritt 0 installieren

| Skill | Quelle | Warum für ImmoCRM konkret |
|---|---|---|
| **Superpowers** | [obra/superpowers](https://github.com/obra/superpowers) | TDD für `computeNextFollowup` + Duplikat-Check (GUIDELINES §Tests). Brainstorming pro Bau-Schritt. Git Worktrees für parallele Schritte 5 + 6. |
| **Context7 MCP** | [upstash/context7](https://github.com/upstash/context7) | Live-Docs für Vite, TanStack Table, react-hook-form, zod, Tiptap, Supabase, shadcn — alle unter ständiger Versions-Drift. **Härtester Hebel** in diesem Stack. |
| **Supabase MCP** | `@supabase/mcp-server` | Direkter DB-Zugriff: Schema-Tests in Schritt 1, REST-Endpoint-Test in Schritt 7, Migrations-Validation in Schritt 9. Ersetzt Postman + Dashboard-Hopping. |
| **Skill Creator** | [anthropics/skills](https://github.com/anthropics/skills) | Wir bauen **einen** eigenen Skill für Schritt 7: `crm-befuellen` (im Aufteiler-Workflow, nicht im ImmoCRM-Repo). Schritt 5 braucht **keinen** Skill — das ist eine App-Funktion. |
| **LLM Council** | PDF-Anhang `Claude-Code-Setup-Tag76.pdf` (Seite 7-11) | Wird sofort gebraucht für ADR-005 + ADR-007 (siehe §8). Keine Web-Recherche nötig — Skill-Code ist im PDF eingebettet. |
| **`claude-api` Skill** | built-in (auto-trigger) | Schritt 5 (Vision) + Schritt 8 (Briefing-Generation). Erzwingt **Prompt Caching** — 90 % Token-Ersparnis bei wiederkehrender Briefing-Struktur. |
| **`/security-review`** | built-in | Differenziert einsetzen — siehe §5 Workflow-Loop. |

### 🟡 Situativ — bei Bedarf nachziehen

| Skill | Wann | Wozu |
|---|---|---|
| **XLSX Plugin** | Vor Schritt 9 | Excel-Migration ~80 Leads aus Google Sheets |
| **Webapp Testing** | Vor Schritt 10 | E2E-Smoke: Lead anlegen → speichern → Liste zeigt ihn |
| **Caveman** | Erst wenn Sessions > 60 % Context laufen | Output-Reduktion −65 %. **Trade-off:** Code wird kompakter, aber für Single-Dev schwerer lesbar. Auf Max-Plan kein akuter Token-Druck → bewusst zurückgestellt. |
| **Frontend Design (Anthropic)** | Bei Schritt 10 wenn Polish-Look unbefriedigend | Optional zu shadcn — aber meistens nicht nötig |

### 🔴 Bewusst NICHT verwendet

| Tool | Warum nicht für DIESES Projekt |
|---|---|
| Vibe Kanban | Single-Dev, Schritte zu 70 % sequenziell abhängig — Parallelität nicht der Bottleneck |
| GSD (Get Shit Done) | `02_implementierungsplan.md` ist bereits GSD-Pattern (Discuss→Roadmap→Plan→Execute→Verify). Doppelt = Verwirrung |
| Claude Code Templates | Stack via ADR-001 festgenagelt — kein Bootstrap-Bedarf |
| Trail of Bits | Single-User, kein Multi-Tenant — `/security-review` reicht |
| claude-mem | v12.x Token-Bug + CLAUDE.md/`04_progress.md` decken Memory funktional ab |
| Context Mode | CLAUDE.md ist 84 Zeilen, kein Diagnose-Bedarf |
| CLAUDE.md Optimizer | Bereits optimal |
| UI UX Pro Max | shadcn deckt 90 % — bei 21-Spalten-Tabelle ist UX "lesbar", nicht "schick" |
| PDF Plugin | Schritt 5 ist in-memory Vision-Call, keine Datei-Manipulation |
| Marketing Skills, Humanizer, Remotion, Content Strategist, Obsidian Second Brain, last30days, Huashu Design | Kein Use-Case im MVP-Scope |

---

## 2. Modell-Strategie — Opus vs. Sonnet

Auf Max-Plan ist Token-Cost kein Faktor. Aber **Sonnet 4.6 ist messbar schneller** und liefert bei Pattern-Wiederholung gleich gute UI.

| Modell | Wann |
|---|---|
| **Opus 4.7** (`/model opus`) | Architektur-Schritte: 0, 1, 5, 7, 8 + jede ADR-Diskussion + jeder `/ultrareview` + jeder `/security-review` |
| **Sonnet 4.6** (`/model sonnet`) | UI-Pattern-Wiederholung: 2, 3, 4, 6, 10 — wenn ähnliches Pattern bereits einmal gebaut wurde |

**Modell-Wechsel** in laufender Session: `/model opus` → `/model sonnet`. `/status` zeigt aktuelle Wahl.

---

## 3. Install — Copy-Paste-Prompt für Claude Code

In neuem Claude-Code-Chat im Projekt-Root einfügen:

```
Installiere folgende Skills/MCPs für mein ImmoCRM-Setup. Pro Eintrag: aktuelle offizielle Install-Doku via Web-Recherche holen, dann ausführen.

1. Superpowers — github.com/obra/superpowers
2. Skill Creator — github.com/anthropics/skills (example-skills@anthropic-agent-skills)
3. LLM Council — Skill-Code ist eingebettet im PDF
   "Anleitungen Guides/Claude-Code-Setup-Tag76.pdf" Seite 8-11
   zwischen "SKILL.MD BEGIN" und "SKILL.MD END". Lies das PDF,
   extrahiere den Inhalt, speichere als ~/.claude/skills/llm-council/SKILL.md
4. Context7 MCP: claude mcp add context7 -- npx -y @upstash/context7-mcp
5. Supabase MCP: claude mcp add supabase -- npx -y @supabase/mcp-server

Vorgehen pro Skill (1, 2):
- Repo prüfen: Last commit < 14 Tage, Stars > 1k, Lizenz MIT/Apache klar
- README lesen, aktuellen Install-Befehl extrahieren
- Global installieren (~/.claude/skills/)
- Mit /status + /plugin list verifizieren

Bei Fehlern: README erneut lesen, nicht raten.

Am Ende: Liste der installierten Skills + verfügbare Trigger-Phrasen ausgeben.
```

**Verifikation nach Install:**

```
/status              # Zeigt Modell, Effort, Context-Auslastung
/plugin list         # Zeigt installierte Plugins
claude mcp list      # Zeigt installierte MCPs
```

---

## 4. Skill-zu-Schritt-Matrix

Pro Bau-Schritt aus `02_implementierungsplan.md`:

| # | Bau-Schritt | Pflicht-Skills/MCPs | Modell | Effort | Thinking | Mode |
|---|---|---|---|---|---|---|
| 0 | Setup (Vite/Tailwind/Supabase/Vercel) | Context7 MCP | Opus | medium | — | acceptEdits |
| 1 | DB-Schema | Supabase MCP, Superpowers (TDD), Context7 | **Opus** | **max** | **ultrathink** | **default** |
| 2 | Lead-Liste read-only | Context7 (TanStack) | Sonnet | medium | — | acceptEdits |
| 3 | Lead-Interaktionen | Context7 (Tiptap, shadcn Sheet), Superpowers | Sonnet→Opus | xhigh | think hard | acceptEdits |
| 4 | Manueller Lead | Context7 (zod, react-hook-form), Superpowers (TDD Duplikat) | Opus | xhigh | think hard | default |
| 5 | PDF-Drag-Drop | claude-api Skill, Supabase MCP | **Opus** | **max** | **ultrathink** | **default** |
| 6 | CRM-Tabelle | Context7 (TanStack, shadcn) | Sonnet | xhigh | think hard | acceptEdits |
| 7 | Aufteiler-Workflow-Integration | Skill Creator (`crm-befuellen`), Supabase MCP, /security-review | **Opus** | **max** | **ultrathink** | **default** |
| 8 | Tages-Mail | claude-api (Prompt Caching), Context7 (Vercel Cron + Edge), Superpowers | **Opus** | **max** | **ultrathink** | **default** |
| 9 | Excel-Migration | XLSX Plugin (jetzt installieren), Supabase MCP, Superpowers (TDD Mapping) | Opus | xhigh | think hard | **default** |
| 10 | Polish & Production | Webapp Testing (jetzt installieren), /ultrareview, /security-review | Sonnet→Opus | xhigh | — | acceptEdits |

---

## 5. Workflow-Loop pro Schritt (Pflicht)

```
1. Neuer Web-Claude-Chat (claude.ai Projekt)
   - CLAUDE.md anhängen
   - 02_implementierungsplan.md (relevanter Auszug) anhängen
   - 05_tools.md anhängen (für Skill-Refs)

2. Sparring-Prompt (claude-code-blueprint Phase 3.1)
   - Akzeptanzkriterium definieren
   - Neue/geänderte Files listen
   - Edge-Cases klären

3. Bei ADR-Streit:
   council this: <Frage>
   → Ergebnis als ADR in 03_decisions.md

4. Finalen Claude-Code-Prompt formen
   - Skill-Refs explizit benennen ("nutze Context7 für TanStack-Docs")
   - Effort-Stufe + Thinking-Trigger + Modell gemäß Matrix §4

5. In Claude Code:
   /clear                          # frischer Context
   /model <opus|sonnet>            # gemäß Matrix
   /effort <stufe>                 # gemäß Matrix
   Shift+Tab×2                     # Plan Mode (Read→Plan→Execute)
   <finalen Prompt einfügen>
   → Plan reviewen → Approve → Execute

6. Bei kritischer Logik: TDD via Superpowers
   - Test zuerst (red)
   - Implementierung (green)
   - Refactor

7. Vor Commit (DIFFERENZIERT — nicht alles immer):
   /security-review     → Pflicht bei: .env, API-Routen, DB-Queries, Auth, externe Calls,
                          Migrations, Service-Role-Key-Berührung
   /ultrareview         → Pflicht bei: > 200 LoC, Schema-Änderung, Subagent-Bau

8. Nach Schema-Änderung:
   supabase gen types typescript --project-id <id> > src/types/supabase.ts
   → in den Commit aufnehmen

9. Doku-Update:
   - 04_progress.md: Status auf ✅ + Datum
   - 03_decisions.md: ADR ergänzen falls getroffen

10. Commit + Push
    git add <files>
    git commit -m "feat(<scope>): <was, deutsch>"
    git push origin main
```

---

## 6. `.claudeignore` für Token-Sparsamkeit

Im Projekt-Root anlegen, **vor Schritt 0**. Spart 1.500–18.000 Tokens pro Glob/Search-Operation (Quelle: `claude-code-usage-limits-tactics-guide.pdf`).

```
node_modules/
dist/
build/
.next/
coverage/
.vercel/
*.log
*.tsbuildinfo
.env
.env.local
.env.*.local
.DS_Store
package-lock.json
```

---

## 7. Thinking-Budget — wann welcher Trigger

| Trigger | Token-Budget | Wann bei ImmoCRM |
|---|---|---|
| (Standard) | — | Boilerplate (Schritt 0), Pattern-Wiederholungen (Schritt 6 nach 2) |
| `think` | ~4.000 | kleine Refactors, einzelne Komponenten |
| `think hard` / `megathink` | ~10.000 | Schritte 3, 4, 6, 9 — komplexe Forms, Hover-States, Daten-Mapping |
| `think harder` / `ultrathink` | ~31.999 | **Schritte 1, 5, 7, 8** + jede ADR-Diskussion — irreversibel oder geld-/sicherheitskritisch |

**Plan Mode** (Shift+Tab×2) ist **immer Pflicht vor max/ultrathink-Schritten** — Claude liest erst alle relevanten Files, schreibt einen Plan, du reviewst, erst dann Execute.

---

## 8. Validierungs-Findings — 8 offene ADR-Lücken

Aus der Plan-Validierung. **Vor Schritt 1 schließen**, nicht währenddessen.

| ADR-Nr | Frage | Wo im Plan | Risiko bei Nicht-Klärung | Methode |
|---|---|---|---|---|
| ADR-003 | `email unique normalized` umsetzen wie? Trigger? Generated column `lower(trim(email))`? | `01_*.md` §3 | Aufteiler erzeugt Duplikate `Foo@x.de` vs `foo@x.de` | Schnell-Entscheidung |
| ADR-004 | Soft-Delete: `deleted_at` auf `contacts`/`deals`? | Datenmodell | Versehentliche Löschung = unwiderrufbar; auch DSGVO-Löschrecht hängt dran | Schnell-Entscheidung (verzahnt mit ADR-009) |
| ADR-005 | `naechste_nachfass`: Trigger oder View? | Schritt 1 | Performance vs. Konsistenz | **`council this:`** (echter Tradeoff) |
| ADR-006 | Wo wird der Supabase Service-Role-Key im Aufteiler-Workflow gespeichert? | Schritt 7 | Key-Leak wenn Aufteiler-Repo leakt; Mono-Repo-Risiko | **Pflicht** vor Schritt 7 |
| ADR-007 | Vercel Cron `0 7 * * *` UTC = Sommerzeit 9:00 Berlin statt 8:00 — DST-Strategie? | Schritt 8 | Mail kommt im Sommer 1 h zu spät | **`council this:`** |
| ADR-008 | RLS-Policies "vorbereitend" — welche genau? Anon-Read-only? Insert-via-Service-Role-only? | GUIDELINES + Schritt 1 | Anon-Key + offene RLS = de-facto kein Schutz | **Pflicht** vor Schritt 1 |
| **ADR-009** | **DSGVO-Datenfluss-Audit:** PDFs gehen an Anthropic API (Schritt 5), Daten an Supabase US/EU? Auskunfts-/Löschrecht für Makler? AVV mit Anthropic + Supabase? | Schritt 5 + 7 | Bußgeld-Risiko, Reputationsschaden | **Pflicht** vor Schritt 5 |
| **ADR-010** | **Backup-Strategie:** Daten sind **nicht** in Git. Wie SQL-Dump? Wo gespeichert (verschlüsselt, EU-Region)? Welche Frequenz? | Schritt 10 | Festplatten-/Account-Verlust = Datenverlust (globale CLAUDE.md-Backup-Regel greift hier nicht) | **Pflicht** vor Daten-Migration (Schritt 9) |

---

## 9. Eigene Skills, die wir bauen

Aus dem Plan ableitbar — mit Skill Creator (Pflicht-Skill):

### Skill: `crm-befuellen` (für Schritt 7)
- **Trigger:** Aus dem **Aufteiler-Workflow** nach erfolgreicher Kalkulation
- **Input:** Strukturierte Kontakt + Deal-Daten aus dem Aufteiler-Output
- **Output:** Supabase REST-Calls mit Hard/Soft/No-Match-Branching, Position-Heuristik, Activity-Log-Event
- **Speicher-Ort:** **Im Aufteiler-Repo** (`C:\meine-projekte\Immobilien\Aufteiler\`) — *nicht* in ImmoCRM
- **Service-Role-Key:** kommt aus ADR-006

**Was wir NICHT als Skill bauen:**
- PDF-Extraction (Schritt 5) → ist eine App-Funktion (Backend-API-Route mit Vision-Call), kein Claude-Code-Skill
- Tages-Mail-Generation (Schritt 8) → ist eine Vercel Edge Function mit Claude API SDK, kein Skill

---

## 10. Erste 60 Minuten — konkrete Sequenz

```
[0–5 min]    Mono-Repo-README aktualisieren
             → Eintrag "ImmoCRM" in C:\meine-projekte\README.md
             → (Pflicht laut globaler CLAUDE.md)

[5–10 min]   .claudeignore anlegen (Inhalt aus §6)

[10–20 min]  ADR-003, 004, 006, 008, 009, 010 als Open-Status in 03_decisions.md
             → Kontext + Frage formulieren, Status: Open
             → (ADR-005 + ADR-007 kommen gleich via Council)

[20–25 min]  Skills installieren via Install-Prompt aus §3 oben
             /status + /plugin list zur Verifikation

[25–40 min]  council this: für ADR-005 (Trigger vs View)
             council this: für ADR-007 (DST)
             → Entscheidungen in ADR eintragen

[40–55 min]  ADR-003, 004, 006, 008 schnell entscheiden
             ADR-009 + 010: hier nur Skizze, finale Entscheidung
             vor Schritt 5 (DSGVO) und vor Schritt 9 (Backup)

[55–60 min]  Phase-3-Schritt-0 starten:
             /clear
             /model opus
             /effort medium
             "Vite + React + TS + Tailwind + shadcn + Supabase + Vercel-Hello-World
             gemäß 02_implementierungsplan.md Schritt 0. Plan Mode."
             Shift+Tab×2 → Plan reviewen → Execute
```

---

## 11. Slash-Commands Quick-Reference

| Command | Wann |
|---|---|
| `/clear` | Vor jedem neuen Bau-Schritt — frischer Context |
| `/model opus` / `/model sonnet` | Modell-Wechsel mid-session |
| `/effort <low\|medium\|high\|xhigh\|max>` | Effort-Wechsel mid-session |
| `/status` | Modell + Effort + Context-Auslastung prüfen |
| `/context` | Token-Auslastung pro Komponente |
| `/compact` | Bei ~50–60 % Context: zusammenfassen statt clearen |
| `/security-review` | Vor Commit bei Sicherheits-Touch (siehe §5 Schritt 7) |
| `/ultrareview` | Multi-Stage Code-Review nach großen Schritten |
| `/plugin list` | Installierte Plugins anzeigen |
| `Shift+Tab` (1×) | Mode-Wechsel (default → acceptEdits) |
| `Shift+Tab` (2×) | Plan Mode — Read → Plan → Execute |

**Trigger-Phrasen (Skill-aktivierend):**

| Phrase | Skill | Wann |
|---|---|---|
| `council this: <Frage>` | LLM Council | ADR-Streitfragen, echte Tradeoffs |
| `pressure-test this:` | LLM Council | Architektur-Validierung |
| `think hard` / `megathink` | (built-in) | Komplexe Logik |
| `ultrathink` / `think harder` | (built-in) | Irreversibles, Sicherheit, Geld |

---

## 12. Wartung dieser Datei

- Bei neuem Skill: in §1 + §4 ergänzen, Begründung "warum für ImmoCRM"
- Bei Skill-Entfernung: in §1 (🔴-Tabelle) verschieben mit Datum + Grund
- Bei neuem Bau-Schritt: in §4 Skill-zu-Schritt-Matrix ergänzen
- Bei abgeschlossener ADR aus §8: Zeile entfernen (steht dann in `03_decisions.md`)
- Diese Datei ist **kein Memory** für Bau-Fortschritt → das macht `04_progress.md`
