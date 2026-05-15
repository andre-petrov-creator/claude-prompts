# Akquise-Pipeline — Lokaler Watcher (Final) — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Datum:** 2026-05-15
**Spec:** [`../specs/2026-05-14-akquise-pipeline-redesign.md`](../specs/2026-05-14-akquise-pipeline-redesign.md) (mit Revision-Block 2026-05-15)
**Ersetzt:** [`2026-05-14-akquise-pipeline-redesign.md`](2026-05-14-akquise-pipeline-redesign.md) (Vorlage, aber übergangen) und [`2026-05-14-akquise-pipeline-cloud-anthropic.md`](2026-05-14-akquise-pipeline-cloud-anthropic.md) (Cloud-Detour verworfen)

---

## Goal

Akquise-Pipeline läuft **vollständig** durch:
1. Cloud (Vercel) empfängt Mail-Notification, lädt PDFs nach OneDrive `_inbox/<msg-id>/` (committed, läuft).
2. Lokaler Task-Scheduler-Job (`At log on` + `Every 1 minute`) ruft headless `claude --print "..."` mit Modul-0-Skill im Akquise-Modus auf, sobald ein `.trigger`-File auftaucht.
3. Skill liest PDFs lokal, ruft CHECK24-Python-Tool auf (Marktwert-Lookup), berechnet Gap, schreibt Lead in Supabase + Markdown in OneDrive + benennt Ordner um.

**Stub-Note:** Der Modul-0-Akquise-Modus ist eine Erstversion mit CHECK24-Tool als Marktwert-Quelle. User überarbeitet Modul 0 später im Rahmen des `portal-bewertung-framework`-Plans (Homeday, Interhyp, ImmoScout24). Dieser Plan stellt nur die Pipeline-Infrastruktur + funktionsfähige Erstversion bereit.

## Architecture

```
Mail in M365 CRM-Eingang
   ↓
Microsoft Graph Webhook → Vercel /api/akquise/webhook       (committed)
   ↓
mail_queue.insert(status='pending')
   ↓
Vercel /api/akquise/process: fetchMail, parseEmail,
  resolveLinks, uploadOneDrive("_inbox/<msg-id>/"),
  schreibt _meta.json + .trigger,
  setzt status='ready_for_quickcheck'                       (committed)
   ↓
OneDrive-Sync auf PC                                        (passiv)
   ↓
Task Scheduler (At log on + Every 1 minute)
   ↓
PowerShell watch-inbox.ps1:
  scannt _inbox/, findet .trigger,
  setzt globalen .lock,
  .trigger → .processing,
  ruft claude --print "Verwende Skill aufteiler-modul-0-quickcheck im Akquise-Modus mit Ordnerpfad: <folder>"
   ↓
Claude Code (headless, --print):
  lädt Skill, erkennt Modus-Check (Abschnitt 0 — Akquise-Modus),
  liest _meta.json, liest PDFs,
  extrahiert generalisierten Datensatz (LLM),
  ruft python m00_check24_pricer.py mit Datensatz,
  bekommt Marktwert-JSON zurück,
  berechnet Gap, schreibt:
    - Supabase: contacts upsert, deals insert, activity_log
    - OneDrive: Markdown quickcheck.md
    - OneDrive: <slug>.code-workspace
    - Filesystem: _inbox/<msg-id>/ → Objekte/<slug>/ (Move)
  setzt mail_queue.status='done'
   ↓
Watcher: .processing löschen (Erfolg)
   ↓
ImmoCRM Lead-Liste zeigt neuen Eintrag mit priority_score
```

## Tech Stack

- Cloud: TypeScript, Vercel Serverless (Webhook + Mail-Ingest, committed)
- Local Watcher: PowerShell 5.1 (Windows Task Scheduler)
- Local Quick-Check: Claude Code CLI (headless mode `--print`)
- Marktwert-Quelle: Python 3.x + Playwright (Aufteiler/tools/check24/m00_check24_pricer.py)
- DB: Supabase (Postgres)
- Files: OneDrive (Microsoft Graph API für Cloud-Move-Operationen, Filesystem für lokale Operationen)

---

## File Structure

**EXISTS / UNCHANGED (Cloud-Briefträger committed):**
- `Immobilien/ImmoCRM/api/akquise/webhook.ts`
- `Immobilien/ImmoCRM/api/akquise/process.ts`
- `Immobilien/ImmoCRM/api/_lib/{fetchMail, parseEmail, resolveLink, uploadOneDrive, supabaseAdmin, msGraphClient}.ts`
- `Immobilien/ImmoCRM/supabase/migrations/013_mail_queue.sql` bis `016_mail_queue_status_extension.sql`

**EXISTS LOCAL (uncommitted, aus heutiger Session):**
- `Immobilien/akquise-watcher/watch-inbox.ps1`
- `Immobilien/akquise-watcher/task-scheduler.xml`
- `Immobilien/akquise-watcher/README.md`
- `Immobilien/akquise-watcher/.env.example`
- `Immobilien/akquise-watcher/.gitignore`
- `Immobilien/akquise-watcher/.env` (gitignored)

**WILL BE MODIFIED:**
- `Immobilien/akquise-watcher/task-scheduler.xml` — At-log-on-Trigger hinzufügen
- `Immobilien/akquise-watcher/watch-inbox.ps1` — Lock-Verhalten finalisieren (`claude --print "..."`-Form bereits korrekt seit heute Vormittag)
- `Immobilien/Aufteiler/skills/aufteiler-modul-0-quickcheck/SKILL.md` — Abschnitt 0 (Modus-Check) + Stub-Akquise-Modus
- `Immobilien/Aufteiler/CLAUDE.md` — Hinweis auf Dual-Mode-Skill
- `Immobilien/ImmoCRM/CLAUDE.md` — Workflow-Integration aktualisieren
- `Immobilien/ImmoCRM/docs/03_decisions.md` — neuer ADR
- `Immobilien/ImmoCRM/docs/04_progress.md` — Schritt 7 Status
- `c:/meine-projekte/README.md` — Mono-Repo-Eintrag akquise-watcher

**WILL BE COMMITTED (was uncommitted vorher liegt):**
- Watcher-Files (außer `.env`)
- Banner-Updates (Specs + alter Plan, schon in vorhergehender Session-Phase geändert)
- Neuer Plan (diese Datei)

---

## Wichtige Voraussetzungen vor Start

1. **Microsoft Graph Subscription muss aktiv sein.** Aktuelle Subscription läuft `2026-05-16 08:59 UTC` ab. Wenn der Plan nach diesem Zeitpunkt ausgeführt wird, **vor Task 7** renewen (siehe Task 0).
2. **Vercel-Production-Deploy mit aktuellem Code.** Sollte stehen, letzte Push war Commit `1533e75` (docs). Branche `main` ist sauber.
3. **Aufteiler-Skill-Junctions** unter `~/.claude/skills/aufteiler-modul-0-quickcheck` zeigen auf den Mono-Repo-Pfad. Falls nicht: Junction neu setzen (siehe Aufteiler/README).
4. **Python + Playwright lokal installiert** für CHECK24-Tool. Falls nicht: `pip install -r Aufteiler/tools/check24/requirements.txt && playwright install chromium`.

---

## Task 0: Microsoft-Graph-Subscription renewen

**Wann ausführen:** Wenn aktuelle Uhrzeit > 2026-05-16 06:00 UTC ODER ihr habt seit > 2.5 Tagen keine Mail durch die Pipeline geschickt.

**Files:** keine. Läuft als Skript.

- [ ] **Step 0.1: Aktuellen Expiry-Stand prüfen**

In Supabase-SQL-Editor:
```sql
-- Es gibt aktuell keine Tabelle für Subscription-State im Repo.
-- Stattdessen: scripts/setup-graph-subscription.mjs zeigt beim Renew die alte + neue Expiry.
```

Alternative: schau in den letzten `node scripts/setup-graph-subscription.mjs`-Run-Logs (Console-Output beim letzten Renew).

- [ ] **Step 0.2: Subscription renewen**

Run:
```powershell
cd c:\meine-projekte\Immobilien\ImmoCRM
$env:WEBHOOK_BASE_URL = "https://immo-crm-xi.vercel.app"
npx dotenv -e .env.local -- node scripts/setup-graph-subscription.mjs
```

Expected: Output endet mit `Subscription renewed, expires <ISO-Datum> (in 71 hours)` (oder ähnlich).

- [ ] **Step 0.3: Smoke-Test Webhook**

Schicke dir eine Test-Mail an `andre-petrov@web.de` (Subject: `B4-Renew-Smoke <Uhrzeit>`), leite via Outlook-QuickStep in `CRM-Eingang`. Warte 30 Sek.

Supabase:
```sql
SELECT message_id, status, enqueued_at FROM mail_queue ORDER BY enqueued_at DESC LIMIT 1;
```

Expected: neuer Eintrag mit `status='ready_for_quickcheck'` (Cloud-Briefträger hat die PDFs hochgeladen). Wenn `status='pending'` oder kein Eintrag → Subscription nicht aktiv, Renew prüfen.

---

## Task 1: Banner-Cleanup committen

Banner-Edits sind in der vorherigen Session schon gemacht (Cloud-Anthropic-Spec + Plan = verworfen, Vormittag-Spec mit Revision-Block 2026-05-15, Vormittag-Plan = Vorlage-Banner). Jetzt nur committen.

**Files:**
- Modify (already done): `Immobilien/ImmoCRM/docs/superpowers/specs/2026-05-14-akquise-pipeline-cloud-anthropic.md`
- Modify (already done): `Immobilien/ImmoCRM/docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md`
- Modify (already done): `Immobilien/ImmoCRM/docs/superpowers/plans/2026-05-14-akquise-pipeline-cloud-anthropic.md`
- Modify (already done): `Immobilien/ImmoCRM/docs/superpowers/plans/2026-05-14-akquise-pipeline-redesign.md`
- Create (this file): `Immobilien/ImmoCRM/docs/superpowers/plans/2026-05-15-akquise-pipeline-local-watcher-final.md`

- [ ] **Step 1.1: Git status prüfen**

```bash
cd c:\meine-projekte\Immobilien\ImmoCRM
git status --short docs/superpowers/
```

Expected: 4 geänderte + 1 neue (diese Datei) Markdown-Dateien.

- [ ] **Step 1.2: Add + Commit + Push**

```bash
git add docs/superpowers/specs/2026-05-14-akquise-pipeline-cloud-anthropic.md
git add docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md
git add docs/superpowers/plans/2026-05-14-akquise-pipeline-cloud-anthropic.md
git add docs/superpowers/plans/2026-05-14-akquise-pipeline-redesign.md
git add docs/superpowers/plans/2026-05-15-akquise-pipeline-local-watcher-final.md
git commit -m "docs(akquise): pivot zurueck zu lokalem watcher — cloud-anthropic verworfen wegen playwright"
git push origin main
```

Expected: Push grün.

---

## Task 2: Akquise-Watcher-Files finalisieren

Watcher-Folder existiert lokal aus heutiger Session (unter `c:/meine-projekte/Immobilien/akquise-watcher/`). Wir prüfen jeden File auf Korrektheit, korrigieren ggf., dann commit.

**Files:**
- Verify: `Immobilien/akquise-watcher/watch-inbox.ps1`
- Modify: `Immobilien/akquise-watcher/task-scheduler.xml` (At-log-on-Trigger)
- Verify: `Immobilien/akquise-watcher/README.md`
- Verify: `Immobilien/akquise-watcher/.env.example`
- Verify: `Immobilien/akquise-watcher/.gitignore`

- [ ] **Step 2.1: watch-inbox.ps1 inspizieren**

Read: `Immobilien/akquise-watcher/watch-inbox.ps1`

Erwartet:
- claude-Aufruf ist Form: `& claude --print --permission-mode acceptEdits $prompt 2>&1` (NICHT `--skill`/`--arg`-Form)
- Lock-Mechanik global (`.lock` in `_inbox/`) + per Ordner (`.trigger → .processing → .error`)
- Stale-Lock-Recovery (>15 Min → ignorieren)
- Logging in `watcher.log`

Falls Abweichung von obigem: Datei überschreiben mit korrigiertem Inhalt (siehe Task 2.2 unten als Quelle der Wahrheit).

- [ ] **Step 2.2: Falls Korrektur nötig: watch-inbox.ps1 vollständig neu schreiben**

Vollständiger Soll-Inhalt von `Immobilien/akquise-watcher/watch-inbox.ps1`:

```powershell
# Akquise-Watcher: scannt OneDrive _inbox alle 60 Sek (oder At-log-on) nach .trigger-Dateien
# und startet Claude Code (headless) mit dem aufteiler-modul-0-quickcheck-Skill im Akquise-Modus.

$ErrorActionPreference = "Stop"

# --- Config aus .env laden (Pfad relativ zum Skript) ---
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $scriptDir ".env"
if (-not (Test-Path $envFile)) {
  Write-Host "FATAL: .env nicht gefunden: $envFile"
  exit 1
}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.*?)\s*$') {
    Set-Item -Path "env:$($matches[1])" -Value $matches[2]
  }
}

$inboxBase = $env:AKQUISE_INBOX_PATH
if (-not $inboxBase) {
  Write-Host "FATAL: AKQUISE_INBOX_PATH nicht gesetzt"
  exit 1
}
if (-not (Test-Path $inboxBase)) {
  Write-Host "INFO: Inbox-Pfad existiert noch nicht: $inboxBase"
  exit 0
}

$logFile = Join-Path $scriptDir "watcher.log"
$lockFile = Join-Path $inboxBase ".lock"

function Write-Log($msg) {
  $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $logFile -Value "$ts $msg"
}

# --- Stale-Lock-Schutz: Lock aelter 15 Min -> ignorieren ---
if (Test-Path $lockFile) {
  $age = (Get-Date) - (Get-Item $lockFile).LastWriteTime
  if ($age.TotalMinutes -gt 15) {
    Write-Log "Stale lock entdeckt (Alter $($age.TotalMinutes) min), entferne"
    Remove-Item $lockFile -Force
  } else {
    Write-Log "Lock aktiv (Alter $($age.TotalMinutes) min), exit"
    exit 0
  }
}

# --- Trigger-Dateien suchen ---
$triggers = Get-ChildItem -Path $inboxBase -Filter ".trigger" -Recurse -Force -ErrorAction SilentlyContinue
if (-not $triggers -or $triggers.Count -eq 0) {
  exit 0
}

Write-Log "Gefunden: $($triggers.Count) Trigger"
New-Item -Path $lockFile -ItemType File -Force | Out-Null

try {
  foreach ($trigger in $triggers) {
    $folder = $trigger.Directory.FullName
    $processingFlag = Join-Path $folder ".processing"
    $errorFlag = Join-Path $folder ".error"

    Write-Log "Starte Quick-Check fuer: $folder"

    # Lock pro Ordner: .trigger -> .processing
    try {
      Move-Item -Path $trigger.FullName -Destination $processingFlag -Force
    } catch {
      Write-Log "WARN: konnte .trigger nicht in .processing umbenennen ($folder): $($_.Exception.Message)"
      continue
    }

    try {
      # Headless Claude-Code-Aufruf.
      # CLI hat keine --skill/--arg Optionen — Skill und Argument gehen via Prompt-Text.
      # Skill-Frontmatter (Abschnitt 0) erkennt Akquise-Modus, weil Ordner .processing + _meta.json enthaelt.
      $prompt = "Verwende den Skill aufteiler-modul-0-quickcheck im Akquise-Modus mit dem Ordnerpfad: $folder"
      $claudeOutput = & claude --print --permission-mode acceptEdits $prompt 2>&1
      $exitCode = $LASTEXITCODE
      $claudeOutput | Out-File -FilePath $logFile -Append -Encoding utf8

      if ($exitCode -ne 0) {
        throw "claude exit code $exitCode"
      }

      # Erfolg: .processing weg
      if (Test-Path $processingFlag) {
        Remove-Item $processingFlag -Force -ErrorAction SilentlyContinue
      }
      Write-Log "Quick-Check fertig fuer: $folder"
    } catch {
      $errMsg = $_.Exception.Message
      Write-Log "FEHLER bei $folder`: $errMsg"
      # .processing -> .error mit Stacktrace
      if (Test-Path $processingFlag) {
        try {
          Add-Content -Path $processingFlag -Value "`n--- ERROR $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ---`n$errMsg`n$($_.ScriptStackTrace)"
          Move-Item -Path $processingFlag -Destination $errorFlag -Force
        } catch {
          Write-Log "WARN: konnte .processing nicht in .error umbenennen: $($_.Exception.Message)"
        }
      }
    }
  }
} catch {
  Write-Log "FATALER FEHLER im Watcher-Hauptloop: $($_.Exception.Message)"
} finally {
  if (Test-Path $lockFile) {
    Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
  }
}
```

- [ ] **Step 2.3: task-scheduler.xml mit zwei Triggern überschreiben**

Vollständiger Inhalt von `Immobilien/akquise-watcher/task-scheduler.xml`:

```xml
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Author>Andre Petrov</Author>
    <Description>Akquise-Pipeline: Watcher fuer OneDrive _inbox. Triggert bei Log-on und alle 60 Sek, ruft Claude Code (headless) mit Modul-0-Skill im Akquise-Modus auf, sobald eine .trigger-Datei gefunden wird.</Description>
    <URI>\Akquise-Watcher</URI>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <Delay>PT30S</Delay>
    </LogonTrigger>
    <CalendarTrigger>
      <Repetition>
        <Interval>PT1M</Interval>
        <Duration>P1D</Duration>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
      <StartBoundary>2026-05-15T06:00:00</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay>
        <DaysInterval>1</DaysInterval>
      </ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT1H</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>-NoProfile -ExecutionPolicy Bypass -File "C:\meine-projekte\Immobilien\akquise-watcher\watch-inbox.ps1"</Arguments>
    </Exec>
  </Actions>
</Task>
```

**Was sich ändert vs. heute Vormittag:**
- `<LogonTrigger>` hinzugefügt mit 30 Sek Delay (OneDrive-Sync soll erst kurz laufen, bevor wir scannen)
- `MultipleInstancesPolicy: IgnoreNew` (At-log-on und Every-Minute können sich nicht überlagern)

- [ ] **Step 2.4: README.md verifizieren**

Read: `Immobilien/akquise-watcher/README.md`

Erwartet: bestehender Inhalt aus heutigem Vormittag passt grundsätzlich, aber Verhalten-Block sollte beide Trigger erwähnen. Falls nicht: ergänzen mit:

```markdown
## Trigger

Der Task Scheduler ruft `watch-inbox.ps1` mit zwei Triggern:

1. **At log on** (30 Sek nach User-Login) — fängt Backlog ab, der während PC-aus angesammelt wurde.
2. **Every 1 minute** — laufender Betrieb für Mails, die während PC-an reinkommen.

Beide Trigger sind aktiv. `MultipleInstancesPolicy=IgnoreNew` stellt sicher, dass nicht zwei Instanzen parallel laufen.
```

- [ ] **Step 2.5: .env.example verifizieren**

Read: `Immobilien/akquise-watcher/.env.example`

Erwartet: enthält `AKQUISE_INBOX_PATH`, `AKQUISE_OBJEKTE_PATH`, optional `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (Letztere für direkten Skill-zu-DB-Schreibweg).

- [ ] **Step 2.6: .gitignore verifizieren**

Read: `Immobilien/akquise-watcher/.gitignore`

Erwartet:
```
.env
*.log
.lock
```

- [ ] **Step 2.7: Trockentest (ohne Trigger)**

Run:
```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "c:\meine-projekte\Immobilien\akquise-watcher\watch-inbox.ps1"
Write-Output "ExitCode: $LASTEXITCODE"
```

Expected: ExitCode 0 (kein Trigger im `_inbox/`, exit silent). Wenn `_inbox/` nicht existiert: ExitCode 0 mit Log-Eintrag "Inbox-Pfad existiert noch nicht" (Skript ist robust).

---

## Task 3: Modul-0-Skill um Akquise-Modus erweitern (Stub mit CHECK24)

**Files:**
- Modify: `c:\meine-projekte\Immobilien\Aufteiler\skills\aufteiler-modul-0-quickcheck\SKILL.md`
- Modify: `c:\meine-projekte\Immobilien\Aufteiler\CLAUDE.md`

- [ ] **Step 3.1: Aktuelle SKILL.md komplett lesen**

Read: `c:\meine-projekte\Immobilien\Aufteiler\skills\aufteiler-modul-0-quickcheck\SKILL.md`

Notiere mental: bestehende Abschnitte 1-7 bleiben unverändert. Wir fügen Abschnitt 0 (Modus-Check) **vor** Abschnitt 1 ein.

- [ ] **Step 3.2: Frontmatter-Beschreibung erweitern**

Edit: Zeile 3 in SKILL.md.

**ALT:**
```
description: Modul 0 der Aufteiler-Analyse — Quick-Check. Vergleicht Angebotspreis gegen ETW-Konsens (Marktwert pro WE × Anzahl WE), prüft Gap-Schwelle 5%. Wird ausschließlich vom aufteiler-Orchestrator aufgerufen, NICHT direkt durch User.
```

**NEU:**
```
description: Modul 0 der Aufteiler-Analyse — Quick-Check. Vergleicht Angebotspreis gegen Marktwert-Konsens, prüft Gap-Schwelle 5%. Zwei Modi (Abschnitt 0 entscheidet): Orchestrator-Modus (vom aufteiler-Skill aufgerufen, state.json + AskUserQuestion) und Akquise-Modus (vom lokalen Akquise-Watcher aufgerufen, Ordnerpfad mit PDFs als Eingabe, CHECK24-Python-Tool als Marktwert-Quelle, Lead-Insert in Supabase + Markdown in OneDrive).
```

- [ ] **Step 3.3: Abschnitt 0 (Modus-Check) einfügen**

Edit: Nach Zeile 8 (`Erstes Gate: Lohnt sich der Deal überhaupt? Gap-Check Angebotspreis vs. ETW-Konsens.`) und VOR `## 1. State laden (Pflicht — erste Aktion)`.

Einzufügender Block:

````markdown

## 0. Modus-Erkennung (erste Aktion — Pflicht)

Zuerst feststellen, in welchem Modus ich laufe.

**Aufruf-Indikatoren:**

| Indikator | Modus |
|---|---|
| User-Prompt enthält "im Akquise-Modus" + Ordnerpfad | Akquise-Modus |
| Ordnerpfad zeigt auf `.../001_AQUISE/_inbox/<msg-id>/` mit `_meta.json` + `.processing` | Akquise-Modus (sicher) |
| Eingabe vom Orchestrator: `objekt_slug` | Orchestrator-Modus |
| `runs/<slug>/state.json` existiert | Orchestrator-Modus |

Wenn unsicher: **Akquise-Modus annehmen falls Ordnerpfad gegeben, sonst Orchestrator-Modus**.

### 0.1 Orchestrator-Modus

→ Springe zu Abschnitt 1. Bisheriger Workflow unverändert.

### 0.2 Akquise-Modus — Stub-Workflow (Erstversion 2026-05-15)

> **Stub-Hinweis:** Diese Erstversion nutzt nur CHECK24 als Marktwert-Quelle. User-Plan `Aufteiler/plans/2026-05-15-portal-bewertung-framework.md` erweitert das später um Homeday, Interhyp, ImmoScout24 (Konsens-Median über alle 4). Bis dahin: CHECK24 als einzige Quelle.

**A. Inputs aus Ordner laden**

1. Argument: `<folder>` aus dem User-Prompt extrahieren (alles nach "Ordnerpfad:").
2. `_meta.json` aus `<folder>` lesen → Header-Info (subject, from, files-Liste).
3. PDFs aus `<folder>` listen — alles mit Endung `.pdf`.
4. Pro PDF: `Read` aufrufen oder PDF-Skill nutzen → Textinhalt.

**B. Generalisierten Datensatz extrahieren (LLM-intern)**

Aus den PDF-Texten + Mail-Header die folgenden Felder ableiten:

```json
{
  "adresse": { "strasse": "...", "hausnummer": "...", "plz": "...", "ort": "..." },
  "baujahr": <int>,
  "zustand": "neuwertig|gut|sanierungsbeduerftig",
  "ausstattung": "einfach|normal|gehoben",
  "anzahl_we": <int>,
  "wohnflaechen_qm": [<float>, ...],
  "zimmer_liste": [<float>, ...],
  "badezimmer_liste": [<int>, ...],
  "anzahl_garagen": <int>,
  "anzahl_aussenstellplaetze": <int>,
  "angebotspreis_eur": <number>
}
```

Bei Felder-Lücken: Sinnvolle Defaults setzen (z.B. `badezimmer_liste`: 1 pro WE wenn ≥50% WE >50qm, sonst 2 inklusive Gäste-WC; `ausstattung`: "normal"). Defaults im quickcheck-log.md dokumentieren.

**C. CHECK24-Tool aufrufen**

Run via `Bash`:
```bash
cd c:\meine-projekte\Immobilien\Aufteiler
python tools/m00_check24_pricer.py \
  --strasse "<strasse>" --hausnr <hausnummer> --plz <plz> --ort "<ort>" \
  --baujahr <baujahr> --zustand <zustand> --ausstattung <ausstattung> \
  --anzahl-we <anzahl_we> --wohnflaechen-qm "<komma-separiert>" \
  --zimmer-liste "<komma-separiert>" --badezimmer-liste "<komma-separiert>" \
  --anzahl-garagen <anzahl_garagen> --anzahl-aussenstellplaetze <aussen> --headless
```

> **Tool-Pfad-Hinweis:** Der CLI-Entry-Point ist `tools/m00_check24_pricer.py` (im Root von `tools/`), die Library-Module liegen unter `tools/check24/` (form_steps.py, dom_selectors.py, etc.). Voraussetzung: Python-venv aktiv, `pip install -r tools/check24/requirements.txt` ausgeführt, `playwright install chromium` einmal gemacht.

Output ist JSON. Parsen → `marktwert_eur_mittel`, `trend_ampel`, `trend_3j_prozent`.

**Fehler-Pfad:** Wenn Tool nicht da, Python-ENV kaputt, oder JSON unleserlich → setze `marktwert_eur_mittel = null`, `marktwert_quelle = "fehler"`, `error_msg = <Stacktrace>`. Pipeline läuft trotzdem durch mit Score=50 + Markdown-Hinweis "Marktwert-Quelle nicht verfügbar".

**D. Gap-Berechnung (wie Abschnitt 3, aber mit CHECK24-Marktwert)**

```
marktwert_konsens_eur = marktwert_eur_mittel
gap_eur = angebotspreis_eur − marktwert_konsens_eur
gap_prozent = (gap_eur / marktwert_konsens_eur) × 100
status = (siehe Abschnitt 3c: gruen ≤ 0, gelb 0-5, rot >5)
```

**E. Priority-Score-Mapping**

| Status | Score-Range | Logik |
|---|---|---|
| gruen | 70-90 | `max(70, 90 - abs(gap_prozent))` |
| gelb | 50-70 | `60 - gap_prozent × 2` |
| rot | 10-50 | `max(10, 40 - gap_prozent)` |
| marktwert_quelle=fehler | 50 | hard-coded neutral |

**F. Ordner umbenennen**

1. Adress-Slug bauen (Konvention `Aufteiler/CLAUDE.md`): kebab-case, Umlaute ersetzt.
   - Beispiel: `Welperstraße 39, 45525 Hattingen` → `welperstr-39-hattingen`.
2. Ziel-Pfad: `<OneDrive>/Immobilien/001_AQUISE/Objekte/<slug>/`.
3. Duplikat-Check: existiert Ziel? → Suffix `_2`, `_3` etc.
4. `Move-Item _inbox/<msg-id>/ → Objekte/<slug>/`.

**G. Markdown schreiben**

In `<slug>/quickcheck.md`:
```markdown
# Quick-Check — <Adresse>

| Position | Wert |
|---|---|
| Angebotspreis | <angebotspreis> € |
| Marktwert (CHECK24) | <marktwert> € |
| Gap absolut | <gap_eur> € |
| Gap % | <gap_prozent> % |
| Status | <gruen|gelb|rot> |
| Priority-Score | <score> / 100 |

## Annahmen
- <Liste der gesetzten Defaults>

## Marktwert-Quelle
- CHECK24, Trend-Ampel: <trend_ampel>, 3J-Trend: <trend_3j_prozent>%
- (Später: Homeday, Interhyp, ImmoScout24)

## Maklerinfo
- Von: <name> <email>
- Subject: <subject>
- Empfangen: <date>
```

**H. Workspace-Datei schreiben**

In `<slug>/<slug>.code-workspace`:
```json
{
  "folders": [{ "path": "." }],
  "settings": {
    "terminal.integrated.defaultProfile.windows": "PowerShell"
  },
  "tasks": {
    "version": "2.0.0",
    "tasks": [
      {
        "label": "Start Claude Code",
        "type": "shell",
        "command": "claude",
        "presentation": { "reveal": "always", "panel": "shared" },
        "runOptions": { "runOn": "folderOpen" },
        "problemMatcher": []
      }
    ]
  }
}
```

**I. Supabase-Inserts (REST via Service-Role-Key)**

Pflicht-Felder aus `.env` (vom Watcher übergeben): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

1. `POST /rest/v1/contacts` (Email-Upsert via `Prefer: resolution=merge-duplicates,return=representation`)
   - Felder: `name`, `email`, `phone`/`company`/`position` falls aus Mail-From extrahierbar
2. `POST /rest/v1/deals`
   - Felder: `label=<slug>`, `priority_score`, `priority_reason=<short>`, `inbox_message_id`, `expose_local_path=<onedrive-pfad>`, `expose_url=<onedrive-weburl-falls-vorhanden>`, `workspace_path=<pfad-zur-workspace-datei>`, `expose_source='mail-pipeline'`, `status='pre_screened'`, `contact_id=<aus-step-1>`
3. `POST /rest/v1/activity_log`
   - `activity_type='new_lead'`, `deal_id`, `contact_id`, `payload={source,priority_score,priority_reason}`
4. `PATCH /rest/v1/mail_queue?message_id=eq.<id>`
   - `status='done'`, `done_at=now()`, `deal_id`

Bei 4xx/5xx aus Supabase: `quickcheck-log.md` mit Fehler-Detail, `mail_queue.status='error'`, `error_msg=<msg>`. Watcher sieht non-zero exit-code → setzt `.processing` → `.error`.

**J. quickcheck-log.md (Audit-Spur)**

In `<slug>/quickcheck-log.md` alle Roh-Eingaben + LLM-Antworten + Tool-Outputs + Defaults + Berechnungen ablegen (für späteres Debugging / Modul-0-Refactor).

**K. Aufräumen**

- `.processing` nicht selbst löschen — das macht der Watcher bei Exit-Code 0.

**L. Übergabe-Statement**

Skill antwortet zum Schluss (für Log-Stream):
```
Modul 0 (Akquise-Modus) fertig. Status: <status>. Score: <score>. Lead-ID: <deal-id>. Ordner: <pfad>.
```

---

````

- [ ] **Step 3.4: Aufteiler/CLAUDE.md ergänzen**

Read: `c:\meine-projekte\Immobilien\Aufteiler\CLAUDE.md`

Edit: Im Abschnitt **Architektur-Prinzipien** am Ende einfügen (vor dem Trennstrich `============`):

```markdown
- **Dual-Mode-Skill `aufteiler-modul-0-quickcheck`.** Läuft in zwei Modi (siehe SKILL.md Abschnitt 0): (a) Orchestrator-Modus (vom aufteiler-Skill aufgerufen, state.json + AskUserQuestion); (b) Akquise-Modus (vom lokalen Akquise-Watcher in ImmoCRM-Pipeline aufgerufen, Ordnerpfad mit PDFs als Eingabe, CHECK24-Tool als Marktwert-Quelle). Bei Änderungen an der Berechnungs-Logik (Abschnitt 3) sicherstellen, dass beide Modi korrekt durchlaufen. Verifikation: lokaler Modul-2-Lauf (Orchestrator-Modus) UND lokaler Akquise-Pipeline-Lauf (Akquise-Modus) — beide grün.
```

- [ ] **Step 3.5: Build-Check (TypeScript-Quellen unverändert, aber paranoider Check)**

```bash
cd c:\meine-projekte\Immobilien\ImmoCRM
npx tsc -b 2>&1 | tail -5
```

Expected: keine Fehler (wir haben keinen TS-Code angefasst, das ist nur Smoke-Check).

- [ ] **Step 3.6: Commit (Aufteiler-Subfolder)**

```bash
cd c:\meine-projekte
git add Immobilien/Aufteiler/skills/aufteiler-modul-0-quickcheck/SKILL.md Immobilien/Aufteiler/CLAUDE.md
git commit -m "feat(modul-0): dual-mode skill — akquise-modus mit check24-tool als marktwert-quelle"
git push origin main
```

- [ ] **Step 3.7: GitHub-raw-URL verifizieren**

Run:
```bash
curl -s https://raw.githubusercontent.com/andre-petrov-creator/meine-projekte/main/Immobilien/Aufteiler/skills/aufteiler-modul-0-quickcheck/SKILL.md | grep -c "Akquise-Modus"
```

Expected: `4` oder mehr.

---

## Task 4: Watcher-Folder committen

**Files:**
- Commit: alle Watcher-Files (außer `.env`)

- [ ] **Step 4.1: Status prüfen**

```bash
cd c:\meine-projekte
git status --short Immobilien/akquise-watcher/
```

Expected: 5 neue Dateien:
```
?? Immobilien/akquise-watcher/.env.example
?? Immobilien/akquise-watcher/.gitignore
?? Immobilien/akquise-watcher/README.md
?? Immobilien/akquise-watcher/task-scheduler.xml
?? Immobilien/akquise-watcher/watch-inbox.ps1
```

`.env` darf NICHT auftauchen (gitignored). Wenn doch: `.gitignore` korrigieren.

- [ ] **Step 4.2: Add + Commit + Push**

```bash
git add Immobilien/akquise-watcher/.env.example
git add Immobilien/akquise-watcher/.gitignore
git add Immobilien/akquise-watcher/README.md
git add Immobilien/akquise-watcher/task-scheduler.xml
git add Immobilien/akquise-watcher/watch-inbox.ps1
git commit -m "feat(akquise): lokaler watcher (powershell + task scheduler dual-trigger)"
git push origin main
```

Expected: 5 Files added, Push grün.

- [ ] **Step 4.3: Verifikation**

```bash
git ls-files Immobilien/akquise-watcher/
```

Expected: 5 Einträge, kein `.env`.

---

## Task 5: Mono-Repo-README aktualisieren

**Files:**
- Modify: `c:\meine-projekte\README.md`

- [ ] **Step 5.1: README lesen**

Read: `c:\meine-projekte\README.md`

Erwartet: Inhaltsverzeichnis aller Subfolder. Prüfe ob `Immobilien/akquise-watcher/` schon drin steht (war als verworfen markiert). Wenn nicht: ergänzen.

- [ ] **Step 5.2: Eintrag ergänzen/aktualisieren**

Im Bereich `Immobilien/` einen Eintrag hinzufügen (oder vorhandenen aktualisieren):

```markdown
- `Immobilien/akquise-watcher/` — Lokaler PowerShell-Watcher für die Akquise-Pipeline. Task Scheduler (At-log-on + Every-1-min) ruft Claude Code (headless) mit Modul-0-Skill im Akquise-Modus auf, sobald eine `.trigger`-Datei im OneDrive-`_inbox` auftaucht. Spec: [`Immobilien/ImmoCRM/docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md`](Immobilien/ImmoCRM/docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md).
```

- [ ] **Step 5.3: Commit**

```bash
cd c:\meine-projekte
git add README.md
git commit -m "docs(mono-repo): akquise-watcher-eintrag im inhaltsverzeichnis"
git push origin main
```

---

## Task 6: Task Scheduler einrichten

**Achtung:** System-State-Change. Bestätigung beim User einholen vor `schtasks /Create`.

**Files:** keine. Setup-Schritte.

- [ ] **Step 6.1: User-Bestätigung einholen**

Frage User: "Soll ich jetzt den Task-Scheduler-Job `Akquise-Watcher` auf deinem PC installieren (via `schtasks /Create /XML ...`)? Das ist eine System-Änderung. Alternative: du machst es selbst manuell via Task-Scheduler-GUI mit der XML-Datei."

Optionen:
- (a) Claude installiert via schtasks
- (b) User installiert selbst via GUI

- [ ] **Step 6.2a (bei Wahl a): Schtasks-Befehl ausführen**

Run (in Admin-PowerShell — wenn User nicht-Admin, dann fragt schtasks ggf. nach Eskalation, sonst legt es im User-Kontext an):
```powershell
schtasks /Create /XML "c:\meine-projekte\Immobilien\akquise-watcher\task-scheduler.xml" /TN "Akquise-Watcher"
```

Expected: `INFORMATION: Die geplante Aufgabe "Akquise-Watcher" wurde erfolgreich erstellt.`

- [ ] **Step 6.2b (bei Wahl b): User-Anleitung**

User-Anleitung als Antwort schreiben:
1. Win+R → `taskschd.msc` → Enter
2. Aktion → Aufgabe importieren → `c:\meine-projekte\Immobilien\akquise-watcher\task-scheduler.xml` auswählen
3. Übersicht prüfen, OK klicken
4. Aufgabe `Akquise-Watcher` erscheint in der Liste
5. Rechtsklick → Ausführen (Probelauf)

User bestätigt wenn fertig.

- [ ] **Step 6.3: Verifikation**

Run:
```powershell
schtasks /Query /TN "Akquise-Watcher" /V /FO LIST | Select-String -Pattern "Aufgabenname:", "Status:", "Aufgabe ausführen:", "Nächste Ausführung:"
```

Expected: Aufgabe ist registriert, Status=Bereit, Nächste Ausführung innerhalb der nächsten Minute.

- [ ] **Step 6.4: Aufgabe sofort einmal ausführen (Probelauf)**

Run:
```powershell
schtasks /Run /TN "Akquise-Watcher"
```

Warte 5 Sek, dann:
```powershell
Get-Content "c:\meine-projekte\Immobilien\akquise-watcher\watcher.log" -ErrorAction SilentlyContinue | Select-Object -Last 5
```

Expected: entweder leer (kein .trigger im _inbox) oder Log-Eintrag "Gefunden: 0 Trigger" (Skript ist sauber durchgelaufen).

---

## Task 7: Funktions-Test (Stage 1 — Watcher-Mechanik)

**Ziel:** Verifizieren dass Watcher → Claude Code → Skill funktioniert. Ergebnis-Qualität egal.

**Files:** keine.

- [ ] **Step 7.1: Test-Trigger anlegen**

Run:
```powershell
$dummyDir = "$env:OneDrive\Immobilien\001_AQUISE\_inbox\STAGE1-TEST"
# Hinweis: $env:OneDrive zeigt evtl. NICHT auf den richtigen Pfad bei Business-OneDrive.
# Korrekter Pfad: C:\Users\andre\OneDrive - APPV Personalvermittlung\Immobilien\001_AQUISE\_inbox\STAGE1-TEST
$dummyDir = "C:\Users\andre\OneDrive - APPV Personalvermittlung\Immobilien\001_AQUISE\_inbox\STAGE1-TEST"
New-Item -ItemType Directory -Path $dummyDir -Force | Out-Null
'{"messageId":"<STAGE1@test>","enqueuedAt":"2026-05-15T20:00:00.000Z","schemaVersion":1}' | Out-File -FilePath "$dummyDir\.trigger" -Encoding utf8
# Auch dummy _meta.json:
@'
{
  "messageId": "<STAGE1@test>",
  "subject": "Stage-1-Test",
  "from": { "emailAddress": { "name": "Test", "address": "test@example.com" } },
  "files": []
}
'@ | Out-File -FilePath "$dummyDir\_meta.json" -Encoding utf8
Write-Output "Dummy-Trigger angelegt: $dummyDir"
Get-ChildItem $dummyDir -Force | Format-Table Name, Length
```

Expected: `.trigger` (96 Byte) + `_meta.json` sichtbar.

- [ ] **Step 7.2: Watcher manuell auslösen**

Run:
```powershell
schtasks /Run /TN "Akquise-Watcher"
```

Warte 60-120 Sek (Claude Code Cold-Start + Skill-Lauf-Versuch).

- [ ] **Step 7.3: Ergebnis prüfen**

```powershell
Write-Output "--- watcher.log ---"
Get-Content "c:\meine-projekte\Immobilien\akquise-watcher\watcher.log" | Select-Object -Last 20
Write-Output ""
Write-Output "--- STAGE1-TEST Ordner-Inhalt ---"
Get-ChildItem "$dummyDir" -Force | Format-Table Name, Length, Mode
```

Erwartete Ergebnisse (eines davon):

| Ergebnis | Bedeutung |
|---|---|
| `.processing` ist weg, `quickcheck.md` da | **Erfolg** — Skill ist durchgelaufen (Stub-Pfad inkl. CHECK24-Aufruf, der wird scheitern weil keine PDFs, aber Fehlerbehandlung greift) |
| `.error` da mit Stacktrace | Watcher hat Fehler gefangen, Mechanik OK, Skill ist gescheitert (zu erwarten weil keine PDFs) |
| `.processing` da, nichts passiert | Skill hängt oder Claude Code crashed silent — Logs prüfen |

**Akzeptanzkriterium Stage 1:** entweder `.error` oder Erfolg — Hauptsache der Watcher hat **gehandelt**, der Lock-Mechanismus funktioniert, und claude wurde aufgerufen. Inhaltliche Korrektheit kommt in Task 8.

- [ ] **Step 7.4: STAGE1-TEST-Ordner aufräumen**

```powershell
Remove-Item "$dummyDir" -Recurse -Force
```

---

## Task 8: End-to-End-Test mit echter Test-Mail

**Voraussetzung:** Task 0 erledigt (Subscription frisch), Task 7 grün.

**Files:** keine.

- [ ] **Step 8.1: Test-Mail vorbereiten**

Erstelle eine eigene Mail mit:
- Subject: `B4-E2E <ZeitstempelHHMM>`
- Anhang: 1 echter Exposé-PDF (kann ein altes von dir sein, Hauptsache Adresse + Preis lesbar)
- Empfänger: dich selbst (`andre-petrov@web.de`)

Schicke ab. Wenn angekommen: per Outlook-QuickStep `An CRM-Eingang` weiterleiten.

- [ ] **Step 8.2: Cloud-Stage beobachten**

Innerhalb 30 Sek:
```sql
-- Supabase SQL-Editor:
SELECT message_id, status, enqueued_at, error_msg
FROM mail_queue
ORDER BY enqueued_at DESC
LIMIT 3;
```

Expected: neuester Eintrag mit `status='ready_for_quickcheck'`.

OneDrive prüfen:
```powershell
Get-ChildItem "C:\Users\andre\OneDrive - APPV Personalvermittlung\Immobilien\001_AQUISE\_inbox\" -Recurse -Force | Format-Table FullName, Length
```

Expected: neuer Subfolder mit `_meta.json`, `.trigger`, PDF.

- [ ] **Step 8.3: Lokale Stage abwarten**

Watcher feuert spätestens 1 Min später (oder beim nächsten Task-Scheduler-Tick). Beobachte Log:
```powershell
Get-Content "c:\meine-projekte\Immobilien\akquise-watcher\watcher.log" -Wait -Tail 0
```
(Ctrl+C wenn fertig.)

Expected: Log-Einträge:
```
2026-05-15 ... Gefunden: 1 Trigger
2026-05-15 ... Starte Quick-Check fuer: ...\_inbox\<msg-id>
... claude-output ...
2026-05-15 ... Quick-Check fertig fuer: ...
```

- [ ] **Step 8.4: Ergebnis verifizieren — OneDrive**

```powershell
Get-ChildItem "C:\Users\andre\OneDrive - APPV Personalvermittlung\Immobilien\001_AQUISE\Objekte\" -Recurse -Force | Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-10) } | Format-Table FullName
```

Expected:
- Ordner `Objekte/<adress-slug>/` existiert
- Enthält: ursprüngliches PDF, `_meta.json`, `quickcheck.md`, `<slug>.code-workspace`
- `_inbox/<msg-id>/` ist weg (per Move umbenannt)

- [ ] **Step 8.5: Ergebnis verifizieren — Supabase**

```sql
SELECT message_id, status, deal_id, done_at FROM mail_queue ORDER BY enqueued_at DESC LIMIT 1;
-- Expected: status='done', deal_id gefüllt

SELECT id, label, priority_score, priority_reason, expose_source, inbox_message_id
FROM deals
WHERE inbox_message_id LIKE '%B4-E2E%' OR inbox_message_id = (SELECT message_id FROM mail_queue ORDER BY enqueued_at DESC LIMIT 1);
-- Expected: 1 Eintrag mit gefüllten Feldern

SELECT id, activity_type, payload FROM activity_log ORDER BY created_at DESC LIMIT 1;
-- Expected: activity_type='new_lead', payload mit source='mail-pipeline'
```

- [ ] **Step 8.6: Ergebnis verifizieren — ImmoCRM-UI**

ImmoCRM Lead-Liste öffnen (Frontend). Erwartet: neuer Eintrag oben (priority_score sichtbar, Status `pre_screened`).

- [ ] **Step 8.7: Wiedereinstieg-Test**

Im Explorer: `Objekte/<slug>/<slug>.code-workspace` per Doppelklick öffnen.

Expected: VS Code öffnet Workspace, Terminal startet automatisch mit `claude`. (Beim 1. Mal: VS-Code-Dialog "Allow automatic tasks in folder?" → "Manage Folder → Allow".)

- [ ] **Step 8.8: Idempotenz-Test**

Schicke **dieselbe** Test-Mail nochmal an `CRM-Eingang` (Outlook-QuickStep wieder). Erwartet:

```sql
SELECT COUNT(*) FROM deals WHERE inbox_message_id = '<msg-id>';
-- Expected: 1 (KEIN Duplikat — message_id ist UNIQUE in mail_queue)
```

```sql
SELECT message_id, status FROM mail_queue WHERE message_id = '<msg-id>';
-- Expected: nur 1 Eintrag, status='done'
```

**Idempotenz-Pfad:** Webhook erkennt UNIQUE-Constraint-Violation auf `mail_queue.message_id`, ignoriert die zweite Notification. Pipeline bleibt sauber.

---

## Task 9: Doku-Updates

**Files:**
- Modify: `Immobilien/ImmoCRM/docs/03_decisions.md`
- Modify: `Immobilien/ImmoCRM/docs/04_progress.md`
- Modify: `Immobilien/ImmoCRM/docs/02_implementierungsplan.md`
- Modify: `Immobilien/ImmoCRM/CLAUDE.md`

- [ ] **Step 9.1: ADR in 03_decisions.md**

Read: `Immobilien/ImmoCRM/docs/03_decisions.md` (Letzte ADR-Nummer ermitteln).

Edit: Am Ende einfügen:

```markdown

---

## ADR-XXX: Akquise-Pipeline mit lokalem Watcher (final)

**Datum:** 2026-05-15
**Status:** Aktiv

**Kontext:** Drei Architektur-Iterationen für die Akquise-Pipeline:
1. **Cloud-only (2026-05-11):** Vercel-Function mit pdf-parse. Verworfen wegen DOMMatrix-Bug.
2. **Lokaler Watcher v1 (2026-05-14 Vormittag):** PowerShell + Task Scheduler. Begonnen.
3. **Cloud-Anthropic-Pivot (2026-05-14 Nachmittag):** Versuch, PDF-Lesen via Anthropic-API in Vercel zu machen. Verworfen am 2026-05-15, weil Modul 0 lokale Playwright-Skripte (CHECK24 + 3 weitere) zwingend braucht.
4. **Lokaler Watcher v2 (2026-05-15 — final):** Wie v1, aber mit zwei Triggern (At-log-on + Every-1-min) und Modul-0-Stub mit CHECK24-Aufruf.

**Entscheidung:** Lokaler PowerShell-Watcher (Task Scheduler) ruft headless Claude Code mit Modul-0-Skill auf. Cloud bleibt reiner Briefträger (Webhook → OneDrive-Upload). Skill ist dual-mode: Orchestrator (Aufteiler-Vollanalyse) und Akquise (Pipeline). Stub-Marktwert-Quelle: CHECK24-Python-Tool. Spätere Erweiterung um Homeday/Interhyp/ImmoScout24 via separatem Aufteiler-Plan.

**Konsequenzen:**
- Pro: Playwright-Integration nativ möglich, 0 € Token-Kosten (Claude-Code-Abo), keine Cloud-Limits, Skill bleibt single-source auf GitHub
- Con: PC muss an sein für Quick-Check (akzeptiert), Mails laufen während PC-aus auf und werden beim Boot in Batches abgearbeitet (At-log-on-Trigger)
- Risiko: Pipeline pausiert wenn PC mehr als 3 Tage aus (Graph-Subscription läuft ab) — Renew-Script via Cron oder manuell

**Verworfene Alternativen:**
- Cloud-Anthropic-Variante (2026-05-14): Spec/Plan committed, dann gebannert
- Eigener Server (Hetzner): zu teuer, zu viel Wartung
- Dauer-Session in Claude Code: Token-Verbrauch im Leerlauf inakzeptabel

**Referenzen:**
- Aktive Spec: [`docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md`](superpowers/specs/2026-05-14-akquise-pipeline-redesign.md) (mit Revision-Block 2026-05-15)
- Aktiver Plan: [`docs/superpowers/plans/2026-05-15-akquise-pipeline-local-watcher-final.md`](superpowers/plans/2026-05-15-akquise-pipeline-local-watcher-final.md)
- Skill: `Immobilien/Aufteiler/skills/aufteiler-modul-0-quickcheck/SKILL.md` (Abschnitt 0)
- Watcher: `Immobilien/akquise-watcher/`
```

(`XXX` ersetzen durch nächste freie ADR-Nummer.)

- [ ] **Step 9.2: 04_progress.md Schritt 7 aktualisieren**

Edit Schritt-7-Block: Status auf "Lokal-Watcher-Variante deployt + getestet (2026-05-15)", Verweis auf den neuen Plan.

- [ ] **Step 9.3: 02_implementierungsplan.md Schritt 7 Verweis**

Edit Schritt 7: Spec-Verweis auf `2026-05-14-akquise-pipeline-redesign.md` (mit Revision-Block), Plan-Verweis auf `2026-05-15-akquise-pipeline-local-watcher-final.md`.

- [ ] **Step 9.4: CLAUDE.md im ImmoCRM**

Edit §Workflow-Integration im `Immobilien/ImmoCRM/CLAUDE.md`. Bestehender Block ersetzen durch:

```markdown
**Akquise-Pipeline (Schritt 7, lokaler Watcher mit Cloud-Briefträger):** Mails landen via Outlook-QuickStep-Forward im M365-Postfach `appv@appv7878.onmicrosoft.com` Ordner `CRM-Eingang`. Microsoft Graph Webhook → Vercel-Function `/api/akquise/process` (Mail-Ingest, PDFs nach OneDrive `_inbox/<msg-id>/`, mail_queue.status=ready_for_quickcheck). Lokaler Task-Scheduler-Job `Akquise-Watcher` (At-log-on + Every-1-min) ruft PowerShell `watch-inbox.ps1` auf, das `.trigger`-Files findet und headless Claude Code (`--print`) startet. Skill `aufteiler-modul-0-quickcheck` läuft im Akquise-Modus (Abschnitt 0 in der SKILL.md), liest PDFs, ruft CHECK24-Python-Tool für Marktwert, schreibt Lead in Supabase + Markdown in OneDrive + benennt Ordner um. Wiedereinstieg via Doppelklick auf `<slug>.code-workspace`. Spec: [`docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md`](docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md) (mit Revision-Block 2026-05-15). Plan: [`docs/superpowers/plans/2026-05-15-akquise-pipeline-local-watcher-final.md`](docs/superpowers/plans/2026-05-15-akquise-pipeline-local-watcher-final.md).
```

- [ ] **Step 9.5: Commit Doku**

```bash
cd c:\meine-projekte\Immobilien\ImmoCRM
git add docs/02_implementierungsplan.md docs/03_decisions.md docs/04_progress.md CLAUDE.md
git commit -m "docs(akquise): lokaler-watcher-architektur in projekt-doku eingepflegt (final)"
git push origin main
```

---

## Akzeptanzkriterien (am Ende abhaken)

| # | Kriterium | Verifiziert in Task |
|---|---|---|
| A1 | Mail → ≤ 2 Min Lead in CRM | Task 8 |
| A2 | OneDrive `_inbox/<msg-id>/` → `Objekte/<adresse>/` Rename | Task 8.4 |
| A3 | `quickcheck.md` mit Zonen | Task 8.4 |
| A4 | CRM-Eintrag mit Score + priority_reason | Task 8.5 / 8.6 |
| A5 | Marktwert-Quelle CHECK24 oder graceful Fehler | Task 8.4 (quickcheck.md prüfen) |
| A6 | Idempotenz: dieselbe Mail doppelt → 1 Lead | Task 8.8 |
| A7 | Stuck-Lock-Recovery (>15 Min) | manuell testbar, Skript-Verhalten verifiziert in Task 7 |
| A8 | Skill-Änderung auf GitHub → bei nächstem Lauf aktiv | trivial, Skill wird bei jedem Lauf neu geladen |
| A9 | At-log-on triggert sofort Backlog-Scan | Task 7 (Probelauf) |
| A10 | Token-Kosten = 0 € (über Claude-Code-Abo) | trivial, kein API-Key im Watcher |
| A11 | `.code-workspace` öffnet VS Code + Terminal | Task 8.7 |

---

## Plan-Self-Review

**Coverage vs Spec:**
- Spec §4 Architektur → Tasks 2 (Watcher), 3 (Skill), 6 (Task Scheduler), 8 (E2E) decken alle Pfeile ab
- Spec §5.1 Webhook → unverändert, Task 0 (Subscription-Renew) absichert
- Spec §5.2 process.ts → unverändert (committed)
- Spec §5.5 Watcher → Tasks 2, 4, 6
- Spec §5.6 Akquise-Skill → Task 3
- Spec §5.8 Ordner-Umbenennung → in Skill (Task 3, Abschnitt F)
- Spec §5.9 Workspace-Datei → in Skill (Task 3, Abschnitt H)
- Spec §6 mail_queue State-Übergänge → erfüllt durch Skill-Inserts/Updates (Task 3, Abschnitt I)
- Spec §11 DB-Erweiterung → NICHT nötig (Migration 016 hat `ready_for_quickcheck`, Stub braucht keine weiteren States — `done`/`error` reichen)
- Spec §13 Akzeptanzkriterien A1-A12 → alle in obiger Matrix abgebildet
- Revision-Block 0.1 (Playwright) → Task 3 (CHECK24-Aufruf im Stub)
- Revision-Block 0.2 (At-log-on) → Task 2.3 (task-scheduler.xml)
- Revision-Block 0.3 (claude-Aufruf-Form) → Task 2.2 (watch-inbox.ps1 Zeile mit `--print --permission-mode acceptEdits`)
- Revision-Block 0.4 (kein cron-job.org) → impliziert, kein Task

**Placeholder-Scan:** Keine TBD/TODO/FIXME im Plan. `XXX` an einer Stelle (ADR-Nummer) — gewollt, weil sie aus bestehender Doku abgeleitet wird.

**Type-Konsistenz:** Skill-Abschnitt-Referenzen (1, 3, 5) konsistent mit aktuellem SKILL.md. CLI-Args für CHECK24-Tool 1:1 aus `Aufteiler/plans/2026-05-15-portal-bewertung-framework.md` Zeile 287-292 übernommen.

**Bekannte Schwachstellen:**
- Task 3 ist groß (Skill bekommt umfangreichen neuen Abschnitt 0.2 mit ~10 Sub-Schritten). Bei Subagent-Ausführung: pro Sub-Schritt eigenen Subagent-Lauf erwägen oder den Skill-Edit in einem Schwung machen, weil zusammenhängend.
- Task 8 hängt von Test-Mail-Lieferung ab — wenn Mail nicht ankommt, ist Subscription-Renew-Status zu prüfen (Task 0 zurück).
- CHECK24-Tool wird im Stub aufgerufen, aber das Tool selbst kann hängen (Anti-Bot, DOM-Bruch). Graceful Fallback ist in Task 3 Abschnitt 0.2 C "Fehler-Pfad" beschrieben — Score=50, marktwert_quelle=fehler.

---

## Stoppunkte / Pause-Punkte

Der Plan ist auf Pausen ausgelegt. Sinnvolle Stoppunkte:

- Nach **Task 1** (Banner-Cleanup committed) — saubere Ausgangslage
- Nach **Task 4** (Watcher committed) — Infrastruktur sichergestellt
- Nach **Task 6** (Task Scheduler eingerichtet) — System-State-Change abgeschlossen
- Nach **Task 7** (Stage 1 grün) — Mechanik bewiesen, bevor echte Mail
- Nach **Task 8** (E2E grün) — Pipeline live

Bei jedem Stoppunkt: kurz mit User abstimmen, ob direkt weiter oder Pause.
