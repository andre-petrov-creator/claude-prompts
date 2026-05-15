# Akquise-Pipeline Cloud-Anthropic — Implementierungsplan

> **HISTORISCHE REFERENZ — VERWORFEN am 2026-05-15.**
> Modul 0 muss lokale Playwright-Skripte (CHECK24, Interhyp + 3 weitere) ausführen → Quick-Check kann nicht in Vercel-Function laufen. Zurück zur lokalen Watcher-Architektur.
> Aktiver Plan: [`2026-05-15-akquise-pipeline-local-watcher-final.md`](2026-05-15-akquise-pipeline-local-watcher-final.md).
> Aktive Spec: [`../specs/2026-05-14-akquise-pipeline-redesign.md`](../specs/2026-05-14-akquise-pipeline-redesign.md) (mit 2026-05-15-Update-Block für Playwright + At-log-on).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Akquise-Pipeline-Quick-Check vollständig in der Cloud — Vercel-Function orchestriert Anthropic-API (Sonnet extrahiert PDFs, Opus analysiert), schreibt Lead ins CRM, legt Markdown in OneDrive ab. Externer Cron triggert die Verarbeitung. Lokaler Watcher entfällt.

**Architecture:** Stage 1 (Webhook + Mail-Ingest) bleibt unverändert wie heute. Stage 2 (Quick-Check) ist neu: `/api/akquise/process-queue` als Cron-getriggerter Endpoint, der einen wartenden Job pickt, Sonnet+Opus aufruft, Markdown nach OneDrive schreibt und Supabase befüllt. Der Skill `aufteiler-modul-0-quickcheck` bleibt eine Datei auf GitHub und bekommt einen Modus-Check (Akquise vs. Orchestrator).

**Tech Stack:** TypeScript, Vercel Serverless Functions (Hobby-Plan), Anthropic SDK (`@anthropic-ai/sdk` v0.95.2 bereits vorhanden), Supabase REST, Microsoft Graph API, cron-job.org als externer Trigger.

**Spec:** [2026-05-14-akquise-pipeline-cloud-anthropic.md](../specs/2026-05-14-akquise-pipeline-cloud-anthropic.md)

---

## Spec-Korrekturen (vor Plan-Ausführung)

Beim Plan-Schreiben aufgedeckt — Spec-Korrekturen werden in **Task 0** mit erledigt:

1. **Migration-Nr:** Spec sagt `006_mail_queue_processing_quickcheck.sql`, real ist die nächste freie Nummer **`017`** (bestehende gehen bis 016).
2. **Spalten-Name:** Spec sagt `ORDER BY received_at`, aber `mail_queue` hat `enqueued_at` (siehe `013_mail_queue.sql`). Plan verwendet `enqueued_at`.
3. **`@anthropic-ai/sdk`** ist bereits in `package.json` (v0.95.2) — kein Install nötig.

---

## File Structure

**NEU:**
- `api/akquise/process-queue.ts` — Endpoint (Cron-getriggert, Auth, Item-Pick, Orchestrierung, Cleanup)
- `api/_lib/loadSkill.ts` — GitHub-raw-URL-Fetch mit 5-Min-Cache
- `api/_lib/anthropicQuickCheck.ts` — Sonnet-Extract + Opus-Analyse, zweistufig
- `api/_lib/onedriveOps.ts` — PDF-Download, Move-Operation, Markdown-Write, Workspace-Datei
- `api/_lib/crmInsert.ts` — Supabase-Inserts (contacts, deals, activity_log)
- `supabase/migrations/017_mail_queue_processing_quickcheck.sql` — Status-Erweiterung + Audit-Spalten
- `tests/akquise/loadSkill.test.ts`, `anthropicQuickCheck.test.ts`, `onedriveOps.test.ts`, `crmInsert.test.ts`

**MODIFIZIERT:**
- `api/akquise/process.ts` — `.trigger`-Datei wird nicht mehr geschrieben
- `Immobilien/Aufteiler/skills/aufteiler-modul-0-quickcheck/SKILL.md` — Abschnitt 0 (Modus-Check)
- `Immobilien/ImmoCRM/docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md` — Banner (ersetzt)
- `Immobilien/ImmoCRM/docs/superpowers/specs/2026-05-14-akquise-pipeline-cloud-anthropic.md` — Spec-Korrekturen oben
- `Immobilien/ImmoCRM/docs/03_decisions.md` — neuer ADR
- `Immobilien/ImmoCRM/docs/04_progress.md` — Step-7-Status

**GELÖSCHT:**
- `Immobilien/akquise-watcher/` (uncommitted, wird nie ins Repo)

---

## Task 0: Cleanup + Spec-Korrekturen

**Files:**
- Delete: `c:\meine-projekte\Immobilien\akquise-watcher\`
- Modify: `Immobilien/ImmoCRM/docs/superpowers/specs/2026-05-14-akquise-pipeline-cloud-anthropic.md`
- Modify: `Immobilien/ImmoCRM/docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md`

- [ ] **Step 0.1: Akquise-Watcher-Ordner wegwerfen**

Run:
```powershell
Remove-Item -Path "c:\meine-projekte\Immobilien\akquise-watcher" -Recurse -Force
```

Expected: kein Output, Ordner weg.

- [ ] **Step 0.2: Spec-Korrekturen einarbeiten**

In `Immobilien/ImmoCRM/docs/superpowers/specs/2026-05-14-akquise-pipeline-cloud-anthropic.md` global per Edit:

| Suchen | Ersetzen mit |
|---|---|
| `006_mail_queue_processing_quickcheck.sql` | `017_mail_queue_processing_quickcheck.sql` |
| `Migration `006`` | `Migration `017`` |
| `Migration ``006`` | `Migration ``017`` |
| `.order('received_at', { ascending: true })` | `.order('enqueued_at', { ascending: true })` |
| `quickcheck_started_at IS NULL OR < now() - interval '10 minutes'` | `quickcheck_started_at IS NULL OR quickcheck_started_at < now() - interval '10 minutes'` |

(Letzter Eintrag ist Bug-Fix einer kaputten SQL-Klausel.)

- [ ] **Step 0.3: Banner auf alte Spec**

Edit `Immobilien/ImmoCRM/docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md` — ganz oben (nach Frontmatter, vor erstem `##`) einfügen:

```markdown
> **HISTORISCHE REFERENZ — ERSETZT.**
> Diese Spec wurde am 2026-05-14 funktional ersetzt durch
> [`2026-05-14-akquise-pipeline-cloud-anthropic.md`](2026-05-14-akquise-pipeline-cloud-anthropic.md).
> Grund: Lokaler Watcher + lokaler Skill verworfen zugunsten Cloud-Anthropic-Variante
> (Sonnet+Opus direkt in Vercel via API).
```

- [ ] **Step 0.4: Commit**

```bash
cd c:\meine-projekte\Immobilien\ImmoCRM
git add docs/superpowers/specs/2026-05-14-akquise-pipeline-cloud-anthropic.md docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md
git commit -m "docs(akquise): spec-korrekturen + banner auf redesign-spec"
git push origin main
```

Cleanup-Lösch passiert nicht im Git-Commit (war uncommitted).

---

## Task 1: DB-Migration 017

**Files:**
- Create: `supabase/migrations/017_mail_queue_processing_quickcheck.sql`

- [ ] **Step 1.1: Migration-Datei schreiben**

Vollständiger Inhalt von `supabase/migrations/017_mail_queue_processing_quickcheck.sql`:

```sql
-- 017_mail_queue_processing_quickcheck.sql
-- Erweitert mail_queue.status um 'processing_quickcheck' (Cloud-Quick-Check-State)
-- + Audit-Spalten für Cron-getriggerten Worker

ALTER TABLE mail_queue DROP CONSTRAINT IF EXISTS mail_queue_status_check;

ALTER TABLE mail_queue ADD CONSTRAINT mail_queue_status_check
  CHECK (status IN (
    'pending',
    'processing',
    'ready_for_quickcheck',
    'processing_quickcheck',
    'done',
    'error'
  ));

ALTER TABLE mail_queue ADD COLUMN IF NOT EXISTS quickcheck_started_at timestamptz;
ALTER TABLE mail_queue ADD COLUMN IF NOT EXISTS quickcheck_attempts   integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_mail_queue_ready
  ON mail_queue(enqueued_at ASC)
  WHERE status = 'ready_for_quickcheck';

CREATE INDEX IF NOT EXISTS idx_mail_queue_processing_qc
  ON mail_queue(quickcheck_started_at ASC)
  WHERE status = 'processing_quickcheck';
```

- [ ] **Step 1.2: Migration auf Supabase ausführen**

Run:
```bash
cd c:\meine-projekte\Immobilien\ImmoCRM
npm run db:push
```

Expected: `supabase db push` zeigt `Applying migration 017_mail_queue_processing_quickcheck.sql...` und endet mit `Finished`.

- [ ] **Step 1.3: Verifikation in Supabase-Konsole**

Manuell in Supabase-SQL-Editor:
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'mail_queue_status_check';
```

Erwartet: Constraint enthält `processing_quickcheck`.

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'mail_queue'
  AND column_name IN ('quickcheck_started_at', 'quickcheck_attempts');
```

Erwartet: beide Spalten vorhanden.

- [ ] **Step 1.4: Commit**

```bash
cd c:\meine-projekte\Immobilien\ImmoCRM
git add supabase/migrations/017_mail_queue_processing_quickcheck.sql
git commit -m "feat(akquise): mail_queue um processing_quickcheck + audit-spalten erweitert"
git push origin main
```

---

## Task 2: process.ts — `.trigger`-Datei entfernen

**Files:**
- Modify: `api/akquise/process.ts` (Zeile 70-87)

- [ ] **Step 2.1: Trigger-Block + Trigger-Datei aus uploadInput entfernen**

In `api/akquise/process.ts`:

**ALT (Zeilen 70-88):**
```typescript
    const trigger = {
      messageId,
      enqueuedAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    const uploadInput = [
      ...allFiles,
      {
        name: '_meta.json',
        buffer: Buffer.from(JSON.stringify(meta, null, 2)),
        contentType: 'application/json',
      },
      {
        name: '.trigger',
        buffer: Buffer.from(JSON.stringify(trigger, null, 2)),
        contentType: 'application/json',
      },
    ];
```

**NEU:**
```typescript
    const uploadInput = [
      ...allFiles,
      {
        name: '_meta.json',
        buffer: Buffer.from(JSON.stringify(meta, null, 2)),
        contentType: 'application/json',
      },
    ];
```

- [ ] **Step 2.2: Build prüfen**

Run:
```bash
cd c:\meine-projekte\Immobilien\ImmoCRM
npx tsc -b
```

Expected: keine Fehler.

- [ ] **Step 2.3: Commit**

```bash
git add api/akquise/process.ts
git commit -m "feat(akquise): .trigger-datei entfaellt — cloud-quick-check uebernimmt via cron"
git push origin main
```

Hinweis: Vercel deployt automatisch nach Push.

---

## Task 3: Skill-Anpassung Modus-Check

**Files:**
- Modify: `c:\meine-projekte\Immobilien\Aufteiler\skills\aufteiler-modul-0-quickcheck\SKILL.md`

- [ ] **Step 3.1: Abschnitt 0 (Modus-Check) einfügen**

In `Aufteiler/skills/aufteiler-modul-0-quickcheck/SKILL.md` direkt nach Zeile 8 (`Erstes Gate: Lohnt sich der Deal überhaupt? Gap-Check Angebotspreis vs. ETW-Konsens.`) einfügen:

```markdown

## 0. Modus-Check (erste Aktion)

Welcher Modus liegt vor?

**Akquise-Modus** (Cloud, Vercel-Function via Anthropic-API):
- Kontext-Signal: User-Message enthält JSON-Block mit Feldern wie `angebotspreis_eur`, `anzahl_we`, `adresse`, kein `objekt_slug`.
- Verhalten:
  - Abschnitt 1 (State laden) → **überspringen** (kein state.json verfügbar).
  - Abschnitt 2 (AskUserQuestion) → **überspringen** (Inputs stehen im JSON).
  - Abschnitt 3 (Berechnung) → **unverändert** anwenden auf JSON-Felder.
  - Abschnitt 5 (State persistieren) → **ersetzt** durch JSON-Antwort:
    ```json
    {
      "modul_0_json": { /* Block wie in Abschnitt 5.1 */ },
      "markdown_report": "<vollständige Zonen A/B/C als Markdown>"
    }
    ```
  - Abschnitt 6/7 (Self-Check, Übergabe) → entfällt, kein Orchestrator.

**Orchestrator-Modus** (lokal, Aufteiler-Vollanalyse via aufteiler-Skill):
- Kontext-Signal: `objekt_slug` als Eingabe vom Orchestrator.
- Verhalten: Bisheriger Workflow ab Abschnitt 1 — unverändert.

---
```

- [ ] **Step 3.2: Frontmatter-Beschreibung aktualisieren**

In `SKILL.md` Zeile 3 (description):

**ALT:**
```
description: Modul 0 der Aufteiler-Analyse — Quick-Check. Vergleicht Angebotspreis gegen ETW-Konsens (Marktwert pro WE × Anzahl WE), prüft Gap-Schwelle 5%. Wird ausschließlich vom aufteiler-Orchestrator aufgerufen, NICHT direkt durch User.
```

**NEU:**
```
description: Modul 0 der Aufteiler-Analyse — Quick-Check. Vergleicht Angebotspreis gegen ETW-Konsens (Marktwert pro WE × Anzahl WE), prüft Gap-Schwelle 5%. Zwei Modi (siehe Abschnitt 0): Orchestrator-Modus (vom aufteiler-Skill aufgerufen) und Akquise-Modus (von Vercel-Function in der Akquise-Pipeline aufgerufen, Inputs als JSON statt AskUserQuestion).
```

- [ ] **Step 3.3: CLAUDE.md im Aufteiler-Repo ergänzen**

In `c:\meine-projekte\Immobilien\Aufteiler\CLAUDE.md` am Ende des Architektur-Prinzipien-Blocks einfügen:

```markdown
- **Dual-Mode-Skills.** `aufteiler-modul-0-quickcheck` läuft sowohl im Orchestrator-Modus (lokaler aufteiler-Skill) als auch im Akquise-Modus (Cloud-Vercel-Function, ImmoCRM-Pipeline). Bei Änderungen an Berechnungs-Logik (Abschnitt 3) muss sichergestellt sein, dass beide Modi korrekt durchlaufen. Test-Trigger: lokaler Modul-2-Lauf (Orchestrator-Modus) UND Cloud-Endpoint `/api/akquise/process-queue` Spike-Test (Akquise-Modus).
```

- [ ] **Step 3.4: Commit (im Aufteiler-Subfolder)**

```bash
cd c:\meine-projekte\Immobilien\Aufteiler
git add skills/aufteiler-modul-0-quickcheck/SKILL.md CLAUDE.md
git commit -m "feat(modul-0): dual-mode — akquise-modus fuer cloud-pipeline"
git push origin main
```

**Achtung:** Aufteiler ist Teil des Mono-Repos `meine-projekte`. Das `git add` läuft im Mono-Repo-Root, der Pfad zeigt nur auf den Aufteiler-Subfolder.

Korrekt:
```bash
cd c:\meine-projekte
git add Immobilien/Aufteiler/skills/aufteiler-modul-0-quickcheck/SKILL.md Immobilien/Aufteiler/CLAUDE.md
git commit -m "feat(modul-0): dual-mode — akquise-modus fuer cloud-pipeline"
git push origin main
```

- [ ] **Step 3.5: Verifizieren dass GitHub-raw-URL die neue Version liefert**

Run:
```bash
curl -s https://raw.githubusercontent.com/andre-petrov-creator/meine-projekte/main/Immobilien/Aufteiler/skills/aufteiler-modul-0-quickcheck/SKILL.md | grep -c "Akquise-Modus"
```

Expected: `3` oder mehr (Abschnitt-0-Block enthält das Wort mehrfach).

---

## Task 4: Helper-Lib `loadSkill` (TDD)

**Files:**
- Create: `api/_lib/loadSkill.ts`
- Create: `tests/akquise/loadSkill.test.ts`

- [ ] **Step 4.1: Failing Test schreiben**

Vollständiger Inhalt von `tests/akquise/loadSkill.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadSkill, resetSkillCache, SKILL_RAW_URL } from '../../api/_lib/loadSkill';

describe('loadSkill', () => {
  beforeEach(() => {
    resetSkillCache();
    vi.restoreAllMocks();
  });

  it('lädt Skill-Inhalt von GitHub-raw-URL', async () => {
    const mockContent = '# Modul 0\n\nakquise-modus content';
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => mockContent,
    } as Response);

    const result = await loadSkill();
    expect(result).toBe(mockContent);
    expect(global.fetch).toHaveBeenCalledWith(SKILL_RAW_URL);
  });

  it('nutzt Cache bei zweitem Call innerhalb von 5 Min', async () => {
    const mockContent = '# Modul 0 cached';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockContent,
    } as Response);
    global.fetch = fetchMock;

    await loadSkill();
    await loadSkill();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('lädt Skill neu wenn Cache älter als 5 Min', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, text: async () => 'v1' } as Response)
      .mockResolvedValueOnce({ ok: true, text: async () => 'v2' } as Response);
    global.fetch = fetchMock;

    vi.useFakeTimers();
    const start = new Date('2026-05-14T12:00:00Z');
    vi.setSystemTime(start);

    const first = await loadSkill();
    expect(first).toBe('v1');

    vi.setSystemTime(new Date(start.getTime() + 6 * 60_000));
    const second = await loadSkill();
    expect(second).toBe('v2');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('wirft Fehler bei nicht-2xx-Response', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    await expect(loadSkill()).rejects.toThrow(/skill.*404/i);
  });
});
```

- [ ] **Step 4.2: Test laufen lassen, FAIL erwarten**

Run:
```bash
cd c:\meine-projekte\Immobilien\ImmoCRM
npx vitest run tests/akquise/loadSkill.test.ts
```

Expected: FAIL mit `Cannot find module ... loadSkill`.

- [ ] **Step 4.3: `loadSkill.ts` implementieren**

Vollständiger Inhalt von `api/_lib/loadSkill.ts`:

```typescript
export const SKILL_RAW_URL =
  'https://raw.githubusercontent.com/andre-petrov-creator/meine-projekte/main/Immobilien/Aufteiler/skills/aufteiler-modul-0-quickcheck/SKILL.md';

const CACHE_TTL_MS = 5 * 60 * 1000;

type SkillCache = { content: string; ts: number };
let cache: SkillCache | null = null;

export function resetSkillCache(): void {
  cache = null;
}

export async function loadSkill(): Promise<string> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return cache.content;
  }
  const res = await fetch(SKILL_RAW_URL);
  if (!res.ok) {
    throw new Error(`Skill-Fetch fehlgeschlagen: HTTP ${res.status}`);
  }
  const content = await res.text();
  cache = { content, ts: Date.now() };
  return content;
}
```

- [ ] **Step 4.4: Tests laufen lassen, PASS erwarten**

Run:
```bash
npx vitest run tests/akquise/loadSkill.test.ts
```

Expected: alle 4 Tests grün.

- [ ] **Step 4.5: Commit**

```bash
git add api/_lib/loadSkill.ts tests/akquise/loadSkill.test.ts
git commit -m "feat(akquise): loadSkill helper — github-raw-url mit 5-min-cache"
git push origin main
```

---

## Task 5: Helper-Lib `anthropicQuickCheck` (TDD, zweistufig)

**Files:**
- Create: `api/_lib/anthropicQuickCheck.ts`
- Create: `tests/akquise/anthropicQuickCheck.test.ts`

- [ ] **Step 5.1: Failing Test schreiben**

Vollständiger Inhalt von `tests/akquise/anthropicQuickCheck.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runQuickCheck, type PdfInput } from '../../api/_lib/anthropicQuickCheck';

vi.mock('../../api/_lib/loadSkill', () => ({
  loadSkill: vi.fn().mockResolvedValue('# Modul 0\n\nQuick-Check Skill Content'),
}));

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class Anthropic {
      messages = { create: mockCreate };
    },
  };
});

describe('runQuickCheck', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('führt Sonnet-Extract und Opus-Analyse aus', async () => {
    mockCreate
      .mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              angebotspreis_eur: 1200000,
              anzahl_we: 6,
              adresse: { strasse: 'Welperstraße', hausnummer: '39', plz: '45525', stadt: 'Hattingen' },
              stadtteil: 'Welper',
              baujahr: 1958,
              energieeffizienzklasse: 'E',
              gesamtflaeche_qm: 480,
              jahresmieteinnahmen_eur: 36000,
              exposetext: 'MFH mit 6 WE',
              besonderheiten: ['leerstandsfrei'],
            }),
          },
        ],
      })
      .mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              modul_0_json: {
                status: 'gruen',
                tiefenstufe: 1,
                konfidenz: 'mittel',
                ausgefuehrt_am: '2026-05-14T12:00:00Z',
                angebotspreis_eur: 1200000,
                etw_konsens_eur: 1080000,
                gap_prozent: 11.11,
                ueber_schwelle: true,
              },
              markdown_report: '## Quick-Check\n\nGap: 11%, Status rot',
            }),
          },
        ],
      });

    const pdfs: PdfInput[] = [{ name: 'expose.pdf', base64: Buffer.from('%PDF-1.4').toString('base64') }];
    const result = await runQuickCheck(pdfs);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    const [sonnetCall, opusCall] = mockCreate.mock.calls;
    expect(sonnetCall[0].model).toBe('claude-sonnet-4-6');
    expect(opusCall[0].model).toBe('claude-opus-4-7');

    expect(result.extracted.angebotspreis_eur).toBe(1200000);
    expect(result.modul_0_json.status).toBe('gruen');
    expect(result.markdown_report).toContain('Quick-Check');
  });

  it('wirft, wenn Sonnet kein gültiges JSON liefert', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'nicht-json output' }],
    });

    const pdfs: PdfInput[] = [{ name: 'x.pdf', base64: 'YWJj' }];
    await expect(runQuickCheck(pdfs)).rejects.toThrow(/sonnet.*json/i);
  });

  it('wirft, wenn Opus-Antwort keine erwarteten Felder hat', async () => {
    mockCreate
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ angebotspreis_eur: 500000 }) }],
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ unerwartet: true }) }],
      });

    const pdfs: PdfInput[] = [{ name: 'x.pdf', base64: 'YWJj' }];
    await expect(runQuickCheck(pdfs)).rejects.toThrow(/opus.*schema/i);
  });
});
```

- [ ] **Step 5.2: Test laufen, FAIL erwarten**

Run:
```bash
npx vitest run tests/akquise/anthropicQuickCheck.test.ts
```

Expected: FAIL mit `Cannot find module ... anthropicQuickCheck`.

- [ ] **Step 5.3: `anthropicQuickCheck.ts` implementieren**

Vollständiger Inhalt von `api/_lib/anthropicQuickCheck.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { loadSkill } from './loadSkill.js';

export type PdfInput = { name: string; base64: string };

export type ExtractedFields = {
  angebotspreis_eur: number | null;
  anzahl_we: number | null;
  adresse: {
    strasse: string | null;
    hausnummer: string | null;
    plz: string | null;
    stadt: string | null;
  };
  stadtteil: string | null;
  baujahr: number | null;
  energieeffizienzklasse: string | null;
  gesamtflaeche_qm: number | null;
  jahresmieteinnahmen_eur: number | null;
  exposetext: string;
  besonderheiten: string[];
};

export type Modul0Result = {
  status: 'gruen' | 'gelb' | 'rot';
  tiefenstufe: number;
  konfidenz: 'hoch' | 'mittel' | 'niedrig';
  ausgefuehrt_am: string;
  angebotspreis_eur: number;
  etw_konsens_eur: number;
  gap_prozent: number;
  ueber_schwelle: boolean;
};

export type QuickCheckResult = {
  extracted: ExtractedFields;
  modul_0_json: Modul0Result;
  markdown_report: string;
};

const EXTRACT_SYSTEM = `Du bist Daten-Extraktor für Immobilien-Akquise. Aus den mitgelieferten PDFs (Exposé, Mietaufstellung, Energieausweis und ggf. weitere) extrahiere strukturierte Felder. Wähle selbst, welche PDFs du für welche Felder brauchst — wichtig sind: Exposé (Preis, Adresse, WE-Zahl, Baujahr, Flächen), Energieausweis (Klasse, Baujahr), Mietaufstellung / Mietspiegel / Rent Roll (Jahresmieteinnahmen). Antworte ausschließlich mit gültigem JSON, kein Markdown, kein Erklärtext, kein Code-Fence.`;

const EXTRACT_USER_PROMPT = `Extrahiere als JSON mit folgendem Schema:
{
  "angebotspreis_eur": number | null,
  "anzahl_we": number | null,
  "adresse": { "strasse": string|null, "hausnummer": string|null, "plz": string|null, "stadt": string|null },
  "stadtteil": string | null,
  "baujahr": number | null,
  "energieeffizienzklasse": string | null,
  "gesamtflaeche_qm": number | null,
  "jahresmieteinnahmen_eur": number | null,
  "exposetext": string,
  "besonderheiten": string[]
}

Bei Unsicherheit: null statt Raten. Bei mehreren Adressen im Exposé: Hauptobjekt-Adresse, ignoriere Vergleichsobjekte.`;

function extractText(response: any): string {
  const block = response.content?.find?.((b: any) => b.type === 'text');
  if (!block || typeof block.text !== 'string') {
    throw new Error('Anthropic-Antwort enthält keinen Text-Block');
  }
  return block.text;
}

function parseJsonStrict(text: string, source: 'sonnet' | 'opus'): any {
  try {
    return JSON.parse(text.trim());
  } catch (err) {
    throw new Error(`${source}-Antwort ist kein gültiges JSON: ${(err as Error).message}`);
  }
}

function validateModul0Output(parsed: any): { modul_0_json: Modul0Result; markdown_report: string } {
  const required = ['modul_0_json', 'markdown_report'];
  for (const key of required) {
    if (!(key in parsed)) {
      throw new Error(`Opus-Antwort entspricht nicht erwartetem Schema: Feld '${key}' fehlt`);
    }
  }
  return parsed;
}

export async function runQuickCheck(pdfs: PdfInput[]): Promise<QuickCheckResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY nicht gesetzt');
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const sonnetResp = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: EXTRACT_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          ...pdfs.map((pdf) => ({
            type: 'document' as const,
            source: {
              type: 'base64' as const,
              media_type: 'application/pdf' as const,
              data: pdf.base64,
            },
          })),
          { type: 'text' as const, text: EXTRACT_USER_PROMPT },
        ],
      },
    ],
  });

  const extracted = parseJsonStrict(extractText(sonnetResp), 'sonnet') as ExtractedFields;

  const skill = await loadSkill();
  const opusSystem = `${skill}

HINWEIS: Du läufst im Akquise-Modus (siehe Abschnitt 0 des Skills). Inputs liegen als JSON vor. Antworte ausschließlich mit JSON folgender Struktur (kein Markdown-Wrapper, kein Code-Fence):
{
  "modul_0_json": { "status": "gruen|gelb|rot", "tiefenstufe": <int>, "konfidenz": "hoch|mittel|niedrig", "ausgefuehrt_am": "<ISO>", "angebotspreis_eur": <number>, "etw_konsens_eur": <number>, "gap_prozent": <number>, "ueber_schwelle": <bool> },
  "markdown_report": "<vollständige Zonen A/B/C als Markdown>"
}`;

  const opusResp = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: opusSystem,
    messages: [
      {
        role: 'user',
        content: `Quick-Check für folgendes Objekt:\n\n${JSON.stringify(extracted, null, 2)}`,
      },
    ],
  });

  const opusParsed = parseJsonStrict(extractText(opusResp), 'opus');
  const { modul_0_json, markdown_report } = validateModul0Output(opusParsed);

  return { extracted, modul_0_json, markdown_report };
}
```

- [ ] **Step 5.4: Tests laufen, PASS erwarten**

Run:
```bash
npx vitest run tests/akquise/anthropicQuickCheck.test.ts
```

Expected: 3 Tests grün.

- [ ] **Step 5.5: Commit**

```bash
git add api/_lib/anthropicQuickCheck.ts tests/akquise/anthropicQuickCheck.test.ts
git commit -m "feat(akquise): anthropicQuickCheck — sonnet-extract + opus-analyse"
git push origin main
```

---

## Task 6: Helper-Lib `onedriveOps` (PDF-Download, Move, Markdown-Write)

**Files:**
- Create: `api/_lib/onedriveOps.ts`
- Create: `tests/akquise/onedriveOps.test.ts`

- [ ] **Step 6.1: Verfügbare Graph-Client-Funktionen prüfen**

Read: `api/_lib/uploadOneDrive.ts` und `api/_lib/msGraphClient.ts`

Erwartet: Modul exportiert einen Graph-Client (`getGraphClient()` oder ähnlich) — den nutzen wir als Basis. Falls eine `downloadFile`-Funktion fehlt, bauen wir sie hier.

- [ ] **Step 6.2: Failing Test schreiben**

Vollständiger Inhalt von `tests/akquise/onedriveOps.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { slugifyAdresse, resolveTargetFolderName, buildWorkspaceFile } from '../../api/_lib/onedriveOps';

describe('slugifyAdresse', () => {
  it('macht kebab-case aus Adresse', () => {
    expect(
      slugifyAdresse({ strasse: 'Welperstraße', hausnummer: '39', plz: '45525', stadt: 'Hattingen' })
    ).toBe('welperstr-39-hattingen');
  });

  it('ersetzt Umlaute korrekt', () => {
    expect(
      slugifyAdresse({ strasse: 'Münzstraße', hausnummer: '5', plz: '40213', stadt: 'Düsseldorf' })
    ).toBe('muenzstr-5-duesseldorf');
  });

  it('liefert Pseudo-Slug bei fehlenden Feldern', () => {
    expect(
      slugifyAdresse({ strasse: null, hausnummer: null, plz: null, stadt: null }, 'msg-id-123')
    ).toBe('unbekannt-msg-id-123');
  });
});

describe('resolveTargetFolderName', () => {
  it('liefert Basis-Slug wenn frei', async () => {
    const existsCheck = vi.fn().mockResolvedValue(false);
    const result = await resolveTargetFolderName('welperstr-39-hattingen', existsCheck);
    expect(result).toBe('welperstr-39-hattingen');
  });

  it('hängt _2 an wenn Basis belegt', async () => {
    const existsCheck = vi.fn().mockImplementation(async (name: string) => name === 'welperstr-39-hattingen');
    const result = await resolveTargetFolderName('welperstr-39-hattingen', existsCheck);
    expect(result).toBe('welperstr-39-hattingen_2');
  });

  it('zählt hoch bei mehrfachen Duplikaten', async () => {
    const existsCheck = vi.fn().mockImplementation(async (name: string) =>
      ['welperstr-39-hattingen', 'welperstr-39-hattingen_2', 'welperstr-39-hattingen_3'].includes(name)
    );
    const result = await resolveTargetFolderName('welperstr-39-hattingen', existsCheck);
    expect(result).toBe('welperstr-39-hattingen_4');
  });
});

describe('buildWorkspaceFile', () => {
  it('liefert valides Workspace-JSON', () => {
    const content = buildWorkspaceFile();
    const parsed = JSON.parse(content);
    expect(parsed.folders).toEqual([{ path: '.' }]);
    expect(parsed.tasks.tasks[0].command).toBe('claude');
    expect(parsed.tasks.tasks[0].runOptions.runOn).toBe('folderOpen');
  });
});
```

- [ ] **Step 6.3: Test laufen, FAIL erwarten**

Run:
```bash
npx vitest run tests/akquise/onedriveOps.test.ts
```

Expected: FAIL mit `Cannot find module`.

- [ ] **Step 6.4: `onedriveOps.ts` implementieren**

Vollständiger Inhalt von `api/_lib/onedriveOps.ts`:

```typescript
import { graphClient } from './msGraphClient.js';

export type AdresseInput = {
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  stadt: string | null;
};

const ONEDRIVE_ROOT = 'Immobilien/001_AQUISE';
const INBOX_FOLDER = `${ONEDRIVE_ROOT}/_inbox`;
const OBJEKTE_FOLDER = `${ONEDRIVE_ROOT}/Objekte`;

function umlautReplace(s: string): string {
  return s
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss');
}

function shortStrasse(s: string): string {
  return umlautReplace(s)
    .toLowerCase()
    .replace(/\bstrasse\b/g, 'str')
    .replace(/\bstraße\b/g, 'str')
    .replace(/[^a-z0-9]+/g, '');
}

export function slugifyAdresse(adresse: AdresseInput, fallbackId?: string): string {
  if (!adresse.strasse && !adresse.hausnummer && !adresse.stadt) {
    const fid = (fallbackId ?? 'noid').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 60);
    return `unbekannt-${fid}`;
  }
  const parts: string[] = [];
  if (adresse.strasse) parts.push(shortStrasse(adresse.strasse));
  if (adresse.hausnummer) parts.push(adresse.hausnummer.replace(/[^a-z0-9]/gi, '').toLowerCase());
  if (adresse.stadt) parts.push(umlautReplace(adresse.stadt).toLowerCase().replace(/[^a-z0-9]+/g, ''));
  return parts.filter(Boolean).join('-');
}

export async function resolveTargetFolderName(
  baseSlug: string,
  existsCheck: (name: string) => Promise<boolean>
): Promise<string> {
  if (!(await existsCheck(baseSlug))) return baseSlug;
  for (let i = 2; i <= 99; i++) {
    const candidate = `${baseSlug}_${i}`;
    if (!(await existsCheck(candidate))) return candidate;
  }
  throw new Error(`Mehr als 99 Duplikate für Slug ${baseSlug}`);
}

export function buildWorkspaceFile(): string {
  const content = {
    folders: [{ path: '.' }],
    settings: {
      'terminal.integrated.defaultProfile.windows': 'PowerShell',
    },
    tasks: {
      version: '2.0.0',
      tasks: [
        {
          label: 'Start Claude Code',
          type: 'shell',
          command: 'claude',
          presentation: { reveal: 'always', panel: 'shared' },
          runOptions: { runOn: 'folderOpen' },
          problemMatcher: [],
        },
      ],
    },
  };
  return JSON.stringify(content, null, 2);
}

// --- Graph-API-Operationen ---

export async function listPdfsInInboxFolder(inboxFolder: string): Promise<Array<{ name: string; downloadUrl: string }>> {
  const client = graphClient();
  const drivePath = `${INBOX_FOLDER}/${inboxFolder}`;
  const resp = await client.api(`/me/drive/root:/${drivePath}:/children`).get();
  const items = resp.value as Array<{ name: string; '@microsoft.graph.downloadUrl'?: string; file?: unknown }>;
  return items
    .filter((it) => it.file && it.name.toLowerCase().endsWith('.pdf'))
    .map((it) => ({ name: it.name, downloadUrl: it['@microsoft.graph.downloadUrl']! }));
}

export async function downloadPdf(downloadUrl: string): Promise<Buffer> {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`PDF-Download fehlgeschlagen: HTTP ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

export async function folderExists(folderName: string): Promise<boolean> {
  const client = graphClient();
  const drivePath = `${OBJEKTE_FOLDER}/${folderName}`;
  try {
    await client.api(`/me/drive/root:/${drivePath}`).get();
    return true;
  } catch (err: unknown) {
    const e = err as { statusCode?: number };
    if (e?.statusCode === 404) return false;
    throw err;
  }
}

export async function moveInboxToObjekte(inboxFolder: string, targetSlug: string): Promise<{ webUrl: string; localPath: string }> {
  const client = graphClient();
  const sourcePath = `${INBOX_FOLDER}/${inboxFolder}`;

  // Ziel-Parent-Ordner auflösen (Objekte/)
  const parent = await client.api(`/me/drive/root:/${OBJEKTE_FOLDER}`).get();

  const moved = await client.api(`/me/drive/root:/${sourcePath}`).patch({
    parentReference: { id: parent.id },
    name: targetSlug,
  });

  return {
    webUrl: moved.webUrl as string,
    localPath: `${OBJEKTE_FOLDER}/${targetSlug}`,
  };
}

export async function writeTextFile(
  folderRelPath: string,
  fileName: string,
  content: string,
  contentType = 'text/markdown'
): Promise<void> {
  const client = graphClient();
  const target = `${folderRelPath}/${fileName}`;
  await client
    .api(`/me/drive/root:/${target}:/content`)
    .header('Content-Type', contentType)
    .put(Buffer.from(content, 'utf-8'));
}

export async function ensureObjekteFolder(): Promise<void> {
  const client = graphClient();
  try {
    await client.api(`/me/drive/root:/${OBJEKTE_FOLDER}`).get();
  } catch (err: unknown) {
    const e = err as { statusCode?: number };
    if (e?.statusCode === 404) {
      const rootParent = await client.api(`/me/drive/root:/${ONEDRIVE_ROOT}`).get();
      await client.api(`/me/drive/items/${rootParent.id}/children`).post({
        name: 'Objekte',
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      });
    } else {
      throw err;
    }
  }
}
```

Hinweis: Beim Build kann sich der genaue Graph-Client-Aufruf je nach `msGraphClient.ts`-Export-Signatur unterscheiden. Anpassen wenn Build fehlschlägt.

- [ ] **Step 6.5: Pure-Function-Tests laufen, PASS erwarten**

Run:
```bash
npx vitest run tests/akquise/onedriveOps.test.ts
```

Expected: 7 Tests grün (alle Pure-Functions: slugifyAdresse, resolveTargetFolderName, buildWorkspaceFile).

Hinweis: Graph-API-Funktionen werden in Spike-Test (Task 11) integration-getestet.

- [ ] **Step 6.6: Build prüfen**

Run:
```bash
npx tsc -b
```

Expected: keine Fehler. Wenn doch (z.B. wegen `graphClient`-Import-Mismatch): Pfad/Export-Name angleichen.

- [ ] **Step 6.7: Commit**

```bash
git add api/_lib/onedriveOps.ts tests/akquise/onedriveOps.test.ts
git commit -m "feat(akquise): onedriveOps — slugify, folder-resolve, move, markdown-write"
git push origin main
```

---

## Task 7: Helper-Lib `crmInsert` (Supabase contacts/deals/activity_log)

**Files:**
- Create: `api/_lib/crmInsert.ts`
- Create: `tests/akquise/crmInsert.test.ts`

- [ ] **Step 7.1: Failing Test schreiben**

Vollständiger Inhalt von `tests/akquise/crmInsert.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upsertContactAndDeal, type ContactInput, type DealInput } from '../../api/_lib/crmInsert';

const mockUpsert = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

vi.mock('../../api/_lib/supabaseAdmin', () => ({
  supabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

describe('upsertContactAndDeal', () => {
  beforeEach(() => {
    mockUpsert.mockReset();
    mockInsert.mockReset();
    mockSelect.mockReset();
    mockFrom.mockReset();
  });

  it('legt Contact + Deal + Activity an und liefert deal_id zurück', async () => {
    const contact: ContactInput = { name: 'Hans Müller', email: 'h.mueller@immo.de' };
    const deal: DealInput = {
      label: 'welperstr-39-hattingen',
      priority_score: 78,
      priority_reason: 'Gap 11%, Status rot',
      inbox_message_id: '<msg-123@web.de>',
      expose_local_path: 'Immobilien/001_AQUISE/Objekte/welperstr-39-hattingen',
      contact_id: '', // wird vom Helper gefüllt
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'contacts') {
        return {
          upsert: mockUpsert.mockReturnValue({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'contact-uuid-1' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'deals') {
        return {
          insert: mockInsert.mockReturnValue({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'deal-uuid-1' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'activity_log') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await upsertContactAndDeal(contact, deal);
    expect(result.deal_id).toBe('deal-uuid-1');
    expect(result.contact_id).toBe('contact-uuid-1');

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'h.mueller@immo.de', name: 'Hans Müller' }),
      expect.objectContaining({ onConflict: 'email' })
    );

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        contact_id: 'contact-uuid-1',
        priority_score: 78,
        expose_source: 'mail-pipeline',
      })
    );
  });

  it('wirft, wenn Contact-Upsert fehlschlägt', async () => {
    mockFrom.mockImplementation(() => ({
      upsert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: { message: 'fk violation' } }),
        }),
      }),
    }));

    await expect(
      upsertContactAndDeal(
        { name: 'X', email: 'x@y.de' },
        {
          label: 'x',
          priority_score: 0,
          priority_reason: '',
          inbox_message_id: '',
          expose_local_path: '',
          contact_id: '',
        }
      )
    ).rejects.toThrow(/contact-upsert/i);
  });
});
```

- [ ] **Step 7.2: Test laufen, FAIL erwarten**

Run:
```bash
npx vitest run tests/akquise/crmInsert.test.ts
```

Expected: FAIL.

- [ ] **Step 7.3: `crmInsert.ts` implementieren**

Vollständiger Inhalt von `api/_lib/crmInsert.ts`:

```typescript
import { supabaseAdmin } from './supabaseAdmin.js';

export type ContactInput = {
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  position?: string | null;
};

export type DealInput = {
  label: string;
  priority_score: number;
  priority_reason: string;
  inbox_message_id: string;
  expose_local_path: string;
  expose_url?: string | null;
  workspace_path?: string | null;
  contact_id: string;
};

export type CrmInsertResult = {
  contact_id: string;
  deal_id: string;
};

export async function upsertContactAndDeal(
  contact: ContactInput,
  deal: Omit<DealInput, 'contact_id'>
): Promise<CrmInsertResult> {
  const supa = supabaseAdmin();

  const contactRes = await supa
    .from('contacts')
    .upsert(
      {
        name: contact.name,
        email: contact.email,
        phone: contact.phone ?? null,
        company: contact.company ?? null,
        position: contact.position ?? null,
      },
      { onConflict: 'email' }
    )
    .select()
    .single();

  if (contactRes.error || !contactRes.data?.id) {
    throw new Error(`Contact-Upsert fehlgeschlagen: ${contactRes.error?.message ?? 'no id'}`);
  }
  const contact_id = contactRes.data.id as string;

  const dealRes = await supa
    .from('deals')
    .insert({
      label: deal.label,
      priority_score: deal.priority_score,
      priority_reason: deal.priority_reason,
      inbox_message_id: deal.inbox_message_id,
      expose_local_path: deal.expose_local_path,
      expose_url: deal.expose_url ?? null,
      workspace_path: deal.workspace_path ?? null,
      expose_source: 'mail-pipeline',
      contact_id,
      status: 'pre_screened',
    })
    .select()
    .single();

  if (dealRes.error || !dealRes.data?.id) {
    throw new Error(`Deal-Insert fehlgeschlagen: ${dealRes.error?.message ?? 'no id'}`);
  }
  const deal_id = dealRes.data.id as string;

  const actRes = await supa.from('activity_log').insert({
    activity_type: 'new_lead',
    deal_id,
    contact_id,
    payload: {
      source: 'mail-pipeline',
      priority_score: deal.priority_score,
      priority_reason: deal.priority_reason,
    },
  });

  if (actRes.error) {
    throw new Error(`Activity-Log-Insert fehlgeschlagen: ${actRes.error.message}`);
  }

  return { contact_id, deal_id };
}
```

Hinweis: `deals`-Spalten `label`, `status`, `expose_url`, `workspace_path` müssen existieren — siehe Migration 014 + bestehende Schemas. Falls eine Spalte nicht existiert → Build/Runtime-Fehler in Task 11 Spike, dann nachjustieren.

- [ ] **Step 7.4: Test laufen, PASS erwarten**

Run:
```bash
npx vitest run tests/akquise/crmInsert.test.ts
```

Expected: 2 Tests grün.

- [ ] **Step 7.5: Commit**

```bash
git add api/_lib/crmInsert.ts tests/akquise/crmInsert.test.ts
git commit -m "feat(akquise): crmInsert helper — contacts upsert + deals + activity_log"
git push origin main
```

---

## Task 8: Endpoint `process-queue.ts`

**Files:**
- Create: `api/akquise/process-queue.ts`

- [ ] **Step 8.1: Endpoint-File schreiben**

Vollständiger Inhalt von `api/akquise/process-queue.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { runQuickCheck } from '../_lib/anthropicQuickCheck.js';
import {
  listPdfsInInboxFolder,
  downloadPdf,
  slugifyAdresse,
  folderExists,
  resolveTargetFolderName,
  moveInboxToObjekte,
  writeTextFile,
  buildWorkspaceFile,
  ensureObjekteFolder,
} from '../_lib/onedriveOps.js';
import { upsertContactAndDeal } from '../_lib/crmInsert.js';

const STUCK_THRESHOLD_MIN = 10;
const MAX_ATTEMPTS = 3;

function sanitizeMessageId(id: string): string {
  return id.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100);
}

async function recoverStuckJobs() {
  const supa = supabaseAdmin();
  const threshold = new Date(Date.now() - STUCK_THRESHOLD_MIN * 60_000).toISOString();
  await supa
    .from('mail_queue')
    .update({ status: 'ready_for_quickcheck', quickcheck_started_at: null })
    .eq('status', 'processing_quickcheck')
    .lt('quickcheck_started_at', threshold)
    .lt('quickcheck_attempts', MAX_ATTEMPTS);
}

async function fetchMeta(inboxFolder: string): Promise<{ from?: { emailAddress?: { name?: string; address?: string } }; subject?: string } | null> {
  try {
    const pdfs = await listPdfsInInboxFolder(inboxFolder);
    void pdfs;
    // _meta.json laden — bypass die PDF-Filter, brauche Text-Inhalt
    const { graphClient } = await import('../_lib/msGraphClient.js');
    const client = graphClient();
    const res = await client
      .api(`/me/drive/root:/Immobilien/001_AQUISE/_inbox/${inboxFolder}/_meta.json:/content`)
      .get();
    if (typeof res === 'string') return JSON.parse(res);
    if (res && typeof res === 'object') return res as never;
    return null;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const expected = process.env.CRON_BEARER_TOKEN;
  if (!expected || req.headers.authorization !== `Bearer ${expected}`) {
    res.status(401).send('Unauthorized');
    return;
  }

  const supa = supabaseAdmin();

  await recoverStuckJobs();

  const { data: jobs, error: pickErr } = await supa
    .from('mail_queue')
    .select('*')
    .eq('status', 'ready_for_quickcheck')
    .order('enqueued_at', { ascending: true })
    .limit(1);

  if (pickErr) {
    res.status(500).json({ ok: false, error: pickErr.message });
    return;
  }
  if (!jobs || jobs.length === 0) {
    res.status(204).end();
    return;
  }

  const job = jobs[0] as {
    message_id: string;
    graph_message_id: string;
    quickcheck_attempts: number;
  };
  const inboxFolder = sanitizeMessageId(job.message_id);

  await supa
    .from('mail_queue')
    .update({
      status: 'processing_quickcheck',
      quickcheck_started_at: new Date().toISOString(),
      quickcheck_attempts: (job.quickcheck_attempts ?? 0) + 1,
    })
    .eq('message_id', job.message_id);

  try {
    const pdfList = await listPdfsInInboxFolder(inboxFolder);
    if (pdfList.length === 0) {
      throw new Error('Keine PDFs im Inbox-Ordner');
    }

    const pdfs = await Promise.all(
      pdfList.map(async (p) => ({
        name: p.name,
        base64: (await downloadPdf(p.downloadUrl)).toString('base64'),
      }))
    );

    const { extracted, modul_0_json, markdown_report } = await runQuickCheck(pdfs);

    const meta = await fetchMeta(inboxFolder);
    const fromAddr = meta?.from?.emailAddress;
    const contactEmail = fromAddr?.address ?? `unknown-${job.message_id}@noemail.local`;
    const contactName = fromAddr?.name ?? contactEmail;

    const baseSlug = slugifyAdresse(extracted.adresse, sanitizeMessageId(job.message_id));

    await ensureObjekteFolder();

    const finalSlug = await resolveTargetFolderName(baseSlug, folderExists);

    const moved = await moveInboxToObjekte(inboxFolder, finalSlug);

    const folderRelPath = `Immobilien/001_AQUISE/Objekte/${finalSlug}`;
    await writeTextFile(folderRelPath, 'quickcheck.md', markdown_report);
    await writeTextFile(folderRelPath, `${finalSlug}.code-workspace`, buildWorkspaceFile(), 'application/json');

    const { deal_id, contact_id } = await upsertContactAndDeal(
      { name: contactName, email: contactEmail },
      {
        label: finalSlug,
        priority_score: priorityScoreFromModul0(modul_0_json),
        priority_reason: priorityReason(modul_0_json),
        inbox_message_id: job.message_id,
        expose_local_path: moved.localPath,
        expose_url: moved.webUrl,
        workspace_path: `${moved.localPath}/${finalSlug}.code-workspace`,
      }
    );
    void contact_id;

    await supa
      .from('mail_queue')
      .update({ status: 'done', done_at: new Date().toISOString(), deal_id })
      .eq('message_id', job.message_id);

    res.status(200).json({
      ok: true,
      message_id: job.message_id,
      deal_id,
      finalSlug,
      modul_0_status: modul_0_json.status,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supa
      .from('mail_queue')
      .update({ status: 'error', error_msg: msg })
      .eq('message_id', job.message_id);
    res.status(500).json({ ok: false, error: msg });
  }
}

function priorityScoreFromModul0(m0: { status: string; gap_prozent: number }): number {
  if (m0.status === 'gruen') return Math.max(70, Math.round(80 - Math.abs(m0.gap_prozent)));
  if (m0.status === 'gelb') return Math.round(60 - m0.gap_prozent);
  return Math.max(10, Math.round(40 - m0.gap_prozent));
}

function priorityReason(m0: { status: string; gap_prozent: number; ueber_schwelle: boolean }): string {
  return `Status ${m0.status}, Gap ${m0.gap_prozent.toFixed(1)}%${m0.ueber_schwelle ? ' (Schwellenüberschritt)' : ''}`;
}
```

- [ ] **Step 8.2: Build prüfen**

Run:
```bash
npx tsc -b
```

Expected: keine Fehler.

- [ ] **Step 8.3: Commit**

```bash
git add api/akquise/process-queue.ts
git commit -m "feat(akquise): process-queue endpoint — cron-getriggert, sonnet+opus orchestriert"
git push origin main
```

---

## Task 9: Vercel-ENV setzen + Deploy verifizieren

**Files:**
- External: Vercel-Dashboard

- [ ] **Step 9.1: Anthropic-API-Key besorgen**

Falls noch keiner vorhanden: https://console.anthropic.com → API Keys → Create Key (Name: `immo-crm-akquise-prod`).

- [ ] **Step 9.2: CRON_BEARER_TOKEN generieren**

Run lokal:
```bash
node -e "console.log(crypto.randomUUID() + '-' + crypto.randomUUID())"
```

Erwartet: zwei UUIDs konkateniert, z.B. `1a2b3c4d-...-7890`. Wert kopieren.

- [ ] **Step 9.3: Beide Vars in Vercel setzen**

Vercel-Dashboard → Project `immo-crm` → Settings → Environment Variables:
- `ANTHROPIC_API_KEY` = `<key aus 9.1>` — Environment: Production + Preview
- `CRON_BEARER_TOKEN` = `<UUID aus 9.2>` — Environment: Production + Preview

Speichern.

- [ ] **Step 9.4: Redeploy triggern**

Vercel-Dashboard → Deployments → letzten Production-Deploy → ⋮ → Redeploy (mit "Use existing Build Cache" = aus).

Warten bis Deploy grün.

- [ ] **Step 9.5: Endpoint manuell anpingen (Smoke-Test)**

Run lokal:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer WRONG-TOKEN" https://immo-crm-xi.vercel.app/api/akquise/process-queue
```

Expected: `401`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer <DEIN-TOKEN>" https://immo-crm-xi.vercel.app/api/akquise/process-queue
```

Expected: `204` (keine wartenden Jobs in mail_queue).

Wenn `500` → Vercel-Function-Logs prüfen (Dashboard → Logs).

Hinweis: kein Commit, ENV-Werte gehören NICHT ins Repo.

---

## Task 10: Microsoft-Graph-Subscription renewen

**Files:** keine (externes System)

- [ ] **Step 10.1: Renewen**

Run lokal:
```bash
cd c:\meine-projekte\Immobilien\ImmoCRM
$env:WEBHOOK_BASE_URL = "https://immo-crm-xi.vercel.app"
npx dotenv -e .env.local -- node scripts/setup-graph-subscription.mjs
```

Expected: Output "Subscription renewed, expires <neue-Zeit>".

- [ ] **Step 10.2: Notification testen**

Schicke dir selbst eine kurze Test-Mail an `andre-petrov@web.de`, leite sie via Outlook-QuickStep in CRM-Eingang weiter. Warte 30 Sek.

- [ ] **Step 10.3: mail_queue prüfen**

Supabase-SQL-Editor:
```sql
SELECT message_id, status, enqueued_at, error_msg FROM mail_queue ORDER BY enqueued_at DESC LIMIT 3;
```

Expected: neuester Eintrag hat `status='ready_for_quickcheck'`. Status `error` → `error_msg` lesen und fixen.

Bei Erfolg: dieser Test-Job wird in Task 11 (Spike-Test) als Daten-Grundlage genutzt.

---

## Task 11: Spike-Test — Hobby-Timeout-Verifikation

**Ziel:** Misst, ob ein vollständiger Quick-Check-Lauf in den Vercel-Hobby-10-Sek-Timeout passt.

**Files:** keine Code-Änderungen, nur Messung + Entscheidung.

- [ ] **Step 11.1: Endpoint einmal manuell triggern**

Mit dem Test-Job aus Task 10:

Run lokal:
```bash
curl -i -H "Authorization: Bearer <DEIN-CRON-TOKEN>" https://immo-crm-xi.vercel.app/api/akquise/process-queue
```

- [ ] **Step 11.2: Vercel-Function-Logs lesen**

Vercel-Dashboard → Functions → `/api/akquise/process-queue` → Logs.

Notieren:
- HTTP-Status (200 = OK, 500 = Error, 504/Timeout-Variante)
- Duration (Vercel zeigt die in Logs)

- [ ] **Step 11.3: Entscheidungsmatrix anwenden**

| Duration | Bedeutung | Aktion |
|---|---|---|
| < 8 Sek | Hobby-Plan reicht | Weiter mit Task 12 (Cron aktivieren) |
| 8-9 Sek | Knapp, instabil | Vercel-Pro-Upgrade-Empfehlung an User, ODER Task 11b (Splitting) |
| > 10 Sek (Timeout-Fehler) | Hobby reicht nicht | Task 11b (Splitting) zwingend |
| Sonnet/Opus-Fehler | Skill- oder Prompt-Problem | Fehler beheben, Task 11.1 wiederholen |

- [ ] **Step 11.4: User informieren mit konkretem Vorschlag**

Schicke User Statusmeldung im Format:

```
Spike-Test Ergebnis:
- Duration: <X> Sek
- HTTP-Status: <Y>
- Entscheidung: <eine der drei oben>
```

User-Freigabe einholen für nächsten Schritt.

---

## Task 11b (BEDINGT): Endpoint-Splitting bei Timeout

**Trigger:** Nur ausführen wenn Task 11 Duration > 8 Sek oder Timeout-Fehler.

**Files:**
- Refactor: `api/akquise/process-queue.ts` in 3 Sub-Endpoints aufteilen
- Create: `api/akquise/process-queue-extract.ts` (Sonnet-Call only, schreibt extrahierte Felder in neue DB-Spalte `mail_queue.extracted_json`)
- Create: `api/akquise/process-queue-analyse.ts` (Opus-Call only, schreibt JSON+Markdown in neue DB-Spalte `mail_queue.quickcheck_json`)
- Create: `api/akquise/process-queue-finalize.ts` (OneDrive-Move, CRM-Insert, Status=done)
- Modify: `supabase/migrations/018_mail_queue_intermediate_state.sql` — neue Spalten + Status `extracted`, `analysed`
- Modify: cron-job.org Cron tickt alle 1 Min, ruft `process-queue-extract` falls `ready_for_quickcheck` da, sonst `process-queue-analyse` falls `extracted` da, sonst `process-queue-finalize` falls `analysed` da

**Hinweis:** Diese Aufgabe ist 3-4h Arbeit. Vor dem Bau: User-Bestätigung einholen, ob Pro-Upgrade (20 €/Monat) nicht doch die bessere Option ist.

Detailausarbeitung erst nach User-Entscheidung.

---

## Task 12: cron-job.org Job aktivieren

**Files:** keine (externes System)

- [ ] **Step 12.1: Job in cron-job.org anlegen**

cron-job.org → Cronjobs → "Cronjob erstellen":
- **Titel:** `Akquise-Pipeline Quick-Check`
- **URL:** `https://immo-crm-xi.vercel.app/api/akquise/process-queue`
- **Schedule:** Every 1 minute (`* * * * *`)
- **Request method:** GET
- **Erweiterte Optionen → Anfrage-Headers:**
  - Key: `Authorization`
  - Value: `Bearer <DEIN-CRON-TOKEN>`
- **Timeout:** 30 Sekunden
- **Speichern**, aber zunächst **deaktiviert** lassen.

- [ ] **Step 12.2: Job aktivieren**

Toggle auf "aktiv".

- [ ] **Step 12.3: Erste Cron-Läufe beobachten**

cron-job.org → Job → History.

Erwartet:
- HTTP-Status 204 (keine wartenden Jobs) — alle 1 Min
- Wenn der Test-Job aus Task 10 noch in `ready_for_quickcheck` steht: erster Lauf gibt HTTP 200 + Duration sichtbar.

- [ ] **Step 12.4: ImmoCRM auf neuen Lead prüfen**

ImmoCRM-Lead-Liste öffnen. Erwartet: neuer Eintrag mit Score, Adresse, expose_local_path.

- [ ] **Step 12.5: Supabase prüfen**

```sql
SELECT message_id, status, deal_id, quickcheck_started_at FROM mail_queue ORDER BY enqueued_at DESC LIMIT 3;
```

Expected: Test-Job auf `status='done'`, `deal_id` gefüllt.

---

## Task 13: E2E-Test mit echter Test-Mail

**Files:** keine (externe Test)

- [ ] **Step 13.1: Echte Test-Mail mit PDF-Anhang versenden**

Erstelle in einer privaten Mail einen Dummy-Exposé-Anhang (1 PDF mit Adresse + Preis sichtbar), schicke an `andre-petrov@web.de`, leite via Outlook-QuickStep in `CRM-Eingang`.

- [ ] **Step 13.2: Pipeline beobachten**

Innerhalb 2 Min:
1. mail_queue: `pending` → `processing` → `ready_for_quickcheck`
2. Innerhalb der nächsten 1-2 Min via Cron: → `processing_quickcheck` → `done`
3. OneDrive: `_inbox/<msg-id>/` wird zu `Objekte/<adresse>/` umbenannt, enthält `quickcheck.md` + `<adresse>.code-workspace`
4. ImmoCRM-Lead-Liste: neuer Eintrag, Score sichtbar

- [ ] **Step 13.3: Manuell quickcheck.md im OneDrive lesen**

OneDrive-Web öffnen → `Immobilien/001_AQUISE/Objekte/<adresse>/quickcheck.md`. Inhalt prüfen: Zonen A/B/C plausibel? Wenn Output unsinnig (z.B. falsche Adresse extrahiert) → Skill-Output anpassen.

- [ ] **Step 13.4: Wiedereinstieg testen**

OneDrive-Datei `<adresse>.code-workspace` per Doppelklick öffnen. Erwartet: VS Code öffnet sich, Workspace lädt, Terminal startet automatisch mit `claude` (beim ersten Mal: VS Code fragt "Allow automatic tasks?" → bestätigen).

- [ ] **Step 13.5: Idempotenz-Test**

Genau dieselbe Mail nochmal forwarden. Erwartet: Webhook erhält Notification, mail_queue-Insert schlägt fehl wegen UNIQUE-Constraint, **kein** zweiter Lead. Verifikation:

```sql
SELECT COUNT(*) FROM deals WHERE inbox_message_id = '<msg-id>';
```

Expected: `1`.

- [ ] **Step 13.6: Akzeptanzkriterien aus Spec abhaken**

Spec §9 (Akzeptanzkriterien A1-A10) einzeln durchgehen, manuell prüfen.

---

## Task 14: Doku-Updates

**Files:**
- Modify: `Immobilien/ImmoCRM/docs/02_implementierungsplan.md`
- Modify: `Immobilien/ImmoCRM/docs/03_decisions.md`
- Modify: `Immobilien/ImmoCRM/docs/04_progress.md`
- Modify: `Immobilien/ImmoCRM/CLAUDE.md`

- [ ] **Step 14.1: 03_decisions.md — neuer ADR**

In `docs/03_decisions.md` am Ende einfügen:

```markdown

---

## ADR-XXX: Akquise-Pipeline Quick-Check in Cloud via Anthropic-API

**Datum:** 2026-05-14
**Status:** Aktiv (ersetzt ADR-Akquise-Lokaler-Watcher vom selben Tag)

**Kontext:** Cloud-Variante 1 (Vercel + pdf-parse) brach an DOMMatrix-Bug. Lokale Variante (Watcher + lokaler Skill) wurde begonnen, aber verworfen weil PC-aus-Stau + 2-Skill-Pflege-Aufwand nicht überzeugt haben.

**Entscheidung:** PDF-Verarbeitung über Anthropic-API direkt aus Vercel-Function. Sonnet 4.6 extrahiert PDFs zu JSON, Opus 4.7 analysiert. Skill `aufteiler-modul-0-quickcheck` bleibt EINE Datei auf GitHub, läuft dual-mode (Orchestrator + Akquise). Externer Cron-Service (cron-job.org) triggert alle 1 Min einen Vercel-Endpoint, der einen wartenden Job abarbeitet.

**Konsequenzen:**
- Pro: Kein PC nötig, keine OneDrive-Sync-Abhängigkeit, eine Skill-Quelle, schnelle Iteration (Skill-Edit auf GitHub → 5 Min später live)
- Con: ~15 Cent Token-Kosten pro Mail, abhängig von Vercel-Hobby-Timeout (siehe Spike-Test Task 11), externe Cron-Abhängigkeit
- Tradeoff: Wenn Hobby-Timeout nicht reicht → entweder Pro-Upgrade (20 €/Monat) oder 3-fach-Splitting der Verarbeitung

**Verworfene Alternativen:**
- ADR-Akquise-Lokaler-Watcher (PowerShell + Task Scheduler) — verworfen wegen PC-Abhängigkeit + Doppel-Pflege Skill
- Eigener Server (Hetzner + Claude Code 24/7) — verworfen wegen Server-Wartung + Kosten

**Referenzen:**
- Spec: [`docs/superpowers/specs/2026-05-14-akquise-pipeline-cloud-anthropic.md`](superpowers/specs/2026-05-14-akquise-pipeline-cloud-anthropic.md)
- Plan: [`docs/superpowers/plans/2026-05-14-akquise-pipeline-cloud-anthropic.md`](superpowers/plans/2026-05-14-akquise-pipeline-cloud-anthropic.md)
```

(XXX in der Überschrift ersetzen durch nächste freie ADR-Nummer — siehe bestehende ADR-Liste.)

- [ ] **Step 14.2: 04_progress.md — Schritt 7 Status**

In `docs/04_progress.md` Schritt 7 (Akquise-Pipeline) aktualisieren: Status auf "Cloud-Anthropic deployt + grün getestet", Commit-Hashes ergänzen.

- [ ] **Step 14.3: 02_implementierungsplan.md — Schritt 7 Verweis**

In `docs/02_implementierungsplan.md` Schritt 7 die Spec-Referenz auf den neuen Spec-Pfad umlenken.

- [ ] **Step 14.4: CLAUDE.md — Workflow-Integration aktualisieren**

In `Immobilien/ImmoCRM/CLAUDE.md` §Workflow-Integration den Akquise-Pipeline-Block ersetzen durch:

```markdown
**Akquise-Pipeline (Schritt 7, Cloud-Anthropic):** Mails landen via Outlook-QuickStep-Forward im M365-Postfach `appv@appv7878.onmicrosoft.com` Ordner `CRM-Eingang`. Microsoft Graph Webhook → Vercel-Function `/api/akquise/process` (Mail-Ingest, PDFs nach OneDrive `_inbox/<msg-id>/`, mail_queue.status=ready_for_quickcheck). Externer Cron (cron-job.org, 1 Min) triggert `/api/akquise/process-queue`: Sonnet 4.6 extrahiert PDFs, Opus 4.7 analysiert gemäß Skill `aufteiler-modul-0-quickcheck` im Akquise-Modus, Markdown landet in OneDrive `Objekte/<Adresse>/quickcheck.md`, Lead wird in Supabase angelegt. Spec: `docs/superpowers/specs/2026-05-14-akquise-pipeline-cloud-anthropic.md`.
```

- [ ] **Step 14.5: Commit**

```bash
cd c:\meine-projekte\Immobilien\ImmoCRM
git add docs/02_implementierungsplan.md docs/03_decisions.md docs/04_progress.md CLAUDE.md
git commit -m "docs(akquise): cloud-anthropic-architektur in projekt-doku eingepflegt"
git push origin main
```

- [ ] **Step 14.6: Mono-Repo-README aktualisieren**

In `c:\meine-projekte\README.md`: Falls Eintrag `Immobilien/akquise-watcher/` existiert → entfernen (Ordner ist gelöscht).

Commit (falls Änderung):
```bash
cd c:\meine-projekte
git add README.md
git commit -m "docs: akquise-watcher-eintrag entfernt, redesign-cloud-anthropic"
git push origin main
```

---

## Task 15 (Optional): 13 wartende Mails reaktivieren

**Files:** keine

- [ ] **Step 15.1: Entscheidung**

User-Entscheidung einholen: sollen die 13 wartenden Mails im M365-Ordner `CRM-Eingang` reaktiviert werden? Optionen:

1. **Lassen wie sie sind** — alte Mails ohne Lead, manuelle Bearbeitung
2. **Re-Forward** — alle 13 Mails als Forward an dich selbst zurück, Outlook-QuickStep-Trigger feuert erneut
3. **`\Unread`-Trick** — Mails als ungelesen markieren, Graph-Webhook re-notifiziert (riskant, evtl. funktioniert nicht zuverlässig)

Empfehlung: **2 (Re-Forward)**. Klar, idempotent, kontrollierbar.

- [ ] **Step 15.2 (bei Wahl 2): Re-Forward batch**

Manuell in Outlook: alle 13 Mails markieren → "Forward as Attachment" → an `andre-petrov@web.de` → QuickStep "An CRM-Eingang" auf jede.

Pipeline läuft danach automatisch durch.

---

## Verifikation (nach Task 13 + 14 abgeschlossen)

| # | Spec-Akzeptanzkriterium | Verifiziert in Task |
|---|---|---|
| A1 | Mail → ≤2 Min Lead | Task 13.2 |
| A2 | OneDrive-Rename | Task 13.2/13.3 |
| A3 | quickcheck.md mit Zonen | Task 13.3 |
| A4 | CRM-Eintrag mit Score | Task 12.4 + 13.2 |
| A5 | Fehlerfall Pseudo-Adresse | optional, Test-Mail ohne Adresse |
| A6 | Idempotenz | Task 13.5 |
| A7 | Stuck-Job-Recovery | manuell, DB-Manipulation |
| A8 | Skill-Live-Update | Task 4 Step 4.4 + manueller Skill-Edit |
| A9 | Cron-Bearer-Token | Task 9.5 |
| A10 | Token-Kosten < 30 Cent | Anthropic-Konsole nach Task 13 |

---

## Plan-Self-Review

**Coverage-Check vs Spec:**
- §4 Architektur → Tasks 1-12 implementieren alle Pfeile
- §5.1 Webhook → bleibt (Task 2 berührt nur process.ts)
- §5.2 process.ts Stage 1 → Task 2
- §5.3 process-queue.ts → Tasks 4-8
- §5.4 Migration → Task 1
- §5.5 Skill-Modus-Check → Task 3
- §5.6 Workspace-Datei → Task 6 (`buildWorkspaceFile`) + Task 8 (Endpoint nutzt sie)
- §5.7 cron-job.org → Tasks 9 (Token), 12 (Job aktivieren)
- §6 Fehlerbehandlung → Endpoint hat Try/Catch, Stuck-Job-Recovery in Task 8 (`recoverStuckJobs`), Token-Schutz in Task 8 (`expected !== bearer`)
- §13 One-Thing-To-Do-First (Hobby-Timeout-Spike) → Task 11

**Placeholder-Scan:** keine TBD/TODO/FIXME im Plan. (Task 11b ist "bedingt", aber mit klarem Trigger-Kriterium, nicht Placeholder.)

**Type-Konsistenz:** `runQuickCheck` Return-Typ `QuickCheckResult` matched mit Endpoint-Verwendung. `slugifyAdresse` Signatur matched in `process-queue.ts`.

**Bekannte Risiken:**
- Task 6 hängt davon ab, wie `msGraphClient.ts` exportiert ist (Detailmismatch wahrscheinlich → Build-Fehler → schnell fixbar)
- Task 7 hängt davon ab, ob `deals.label` als Spalte existiert (in Migration 014 nicht ersichtlich, evtl. älter)
- Task 11 (Spike) ist der "Wahrheits-Moment" — Plan-Verzweigung bei Timeout
