# Akquise-Pipeline Redesign — Design

> **REVISION 2026-05-15 — aktiv.** Diese Spec war kurz durch [`2026-05-14-akquise-pipeline-cloud-anthropic.md`](2026-05-14-akquise-pipeline-cloud-anthropic.md) ersetzt; nach Erkenntnis am 2026-05-15, dass Modul 0 lokale Playwright-Skripte (CHECK24, Interhyp + 3 weitere) braucht, ist diese Spec wieder verbindlich. Zwei Detail-Ergänzungen siehe Abschnitt 0 (Revision-Block) unten.
> Aktiver Plan: [`../plans/2026-05-15-akquise-pipeline-local-watcher-final.md`](../plans/2026-05-15-akquise-pipeline-local-watcher-final.md). Vormittag-Plan [`../plans/2026-05-14-akquise-pipeline-redesign.md`](../plans/2026-05-14-akquise-pipeline-redesign.md) ist Vorlage, aber durch die heutige Version überschrieben.

**Status:** AKTIV (mit Revision-Block 2026-05-15)
**Datum:** 2026-05-14 (Revision: 2026-05-15)
**Autor:** André Petrov (mit Claude Code, Brainstorming-Skill)
**Verortung:** ImmoCRM-Schritt 7 (`docs/02_implementierungsplan.md` §7)
**Ersetzt:** `2026-05-11-akquise-pipeline-cloud-design.md` (alte Cloud-Variante)

---

## 0. Revision-Block 2026-05-15 (Inhaltliche Ergänzungen)

Folgende Detail-Punkte überschreiben/präzisieren den Haupttext der Spec. Bei Widerspruch gilt dieser Block.

### 0.1 Modul-0-Skill: Playwright-Integration

Modul 0 wird vom User selbst um vier lokale Skripte erweitert (außerhalb dieses Plans):
- Playwright-Skript "CHECK24" — Marktwert-Lookup pro Stadtteil
- Playwright-Skript "Interhyp" — alternativer Marktwert-Datenpunkt
- 2 weitere Skripte (TBD, durch User definiert)

Diese Skripte laufen **zwingend lokal** (Headless-Browser-Engine, keine Cloud-Funktion). Das ist der eigentliche Grund, warum die Akquise-Pipeline-Verarbeitung lokal bleibt — nicht das PDF-Parsing (das könnten wir auch in der Cloud machen). Quick-Check-Sequenz im Akquise-Modus:

```
1. PDFs lesen (Claude Code Read-Tool, lokal)
2. Adresse extrahieren (LLM-Call, lokal)
3. Playwright-Skripte aufrufen (lokal) → Marktwert-Konsens-Daten
4. Modul-0-Berechnung (Gap-Formel mit lokalen Marktwerten)
5. CRM-Insert + Markdown + Ordner-Rename
```

**Plan-Scope:** Der heutige Plan (`2026-05-15-akquise-pipeline-local-watcher-final.md`) liefert die Pipeline-Infrastruktur (Watcher + Task Scheduler + Trigger-Handling + Headless-Claude-Aufruf). Die Modul-0-Skill-Anpassung selbst macht der User danach in einem separaten Bau-Schritt.

### 0.2 Task-Scheduler-Trigger: zwei statt einer

Der Task-Scheduler-Job hat **zwei** Trigger statt nur dem 60-Sek-Polling:

| Trigger | Zweck |
|---|---|
| `At log on` (eines beliebigen Users) | PC fährt hoch → sofortiger Backlog-Scan. Mails, die während PC-aus reinkamen, werden ohne 60-Sek-Wartezeit abgearbeitet. |
| `Every 1 minute` (Repetition) | Laufender Betrieb. Mails während PC-an werden innerhalb 1 Min gesehen. |

Beide aktiv, Multi-Instance-Policy: `IgnoreNew` (kein paralleler Doppellauf, der zweite Trigger wartet bis erste fertig).

### 0.3 Skill-Aufruf-Syntax (Headless Claude Code)

Die heute Vormittag im Plan-§5.5 angedachte Form `claude --print --skill <name> --arg <path>` existiert in der Claude-Code-CLI nicht (verifiziert 2026-05-14 im Trockentest). Korrekte Form für Headless-Aufruf:

```powershell
claude --print --permission-mode acceptEdits "Verwende den Skill aufteiler-modul-0-quickcheck im Akquise-Modus mit dem Ordnerpfad: <folder>"
```

Skill-Erkennung läuft über den Prompt-Text. `--permission-mode acceptEdits` erlaubt File-Operationen ohne Permission-Popups. Der Skill bekommt den Pfad aus dem Prompt — er prüft selbst (Abschnitt 0 des Skills, Modus-Check), ob `_meta.json` + `.processing` im Ordner liegen → Akquise-Modus.

### 0.4 cron-job.org wird NICHT benötigt

Account-Anlage am 2026-05-14 war im Hinblick auf die Cloud-Anthropic-Variante. Mit lokaler Variante ist der externe Cron überflüssig — Windows-Task-Scheduler übernimmt. Account kann ungenutzt bleiben oder gelöscht werden (User-Entscheidung).

### 0.5 Token-Kosten: 0 € statt 15 Cent/Mail

In der Cloud-Anthropic-Variante hätte jeder Quick-Check ~15 Cent Anthropic-API-Tokens gekostet. In der lokalen Variante deckt das Claude-Code-Pauschal-Abo den Token-Verbrauch ab. Akzeptanzkriterium A12 (Token < 50 Cent/Mail) ist trivial erfüllt.

---

---

## 1. Status & Verortung

Diese Spec definiert die **finale Architektur** für Schritt 7 der ImmoCRM-Implementierung (Akquise-Pipeline). Sie ersetzt funktional die Spec vom 2026-05-11.

Die alte Spec basierte auf einer Vollautomatisierung in der Cloud (Vercel-Function macht Mail-Parsen, PDF-Lesen, LLM-Adress-Extraktion, LLM-QuickCheck, CRM-Insert). Diese Architektur wurde **fast vollständig gebaut** (`api/akquise/webhook.ts`, `api/akquise/process.ts`, alle Module unter `api/_lib/`), bricht aber am PDF-Text-Lesen — `pdf-parse@2` benötigt `DOMMatrix` (Browser-API), die Vercel-Node-Runtime stellt sie nicht bereit. Downgrade auf v1 hat den Bug nicht gelöst.

**Konsequenz:** Statt das PDF-Problem in der Cloud zu lösen (entweder über alternative Libraries mit fragilem Tooling oder über kostenpflichtige externe Services oder einen eigenen Server für ~80 €/Monat), verlagern wir Quick-Check + Adress-Extraktion **lokal** auf den PC. Die Cloud wird zum dummen Briefträger. Der bestehende Aufteiler-Skill (`aufteiler-modul-0-quickcheck`) macht die Inhaltsarbeit lokal.

---

## 2. Zweck & Scope

**Drin im MVP:**

- Microsoft-Graph-Webhook empfängt Notification (UNVERÄNDERT, läuft heute)
- Vercel-Function lädt PDFs + Links nach OneDrive (`001_AQUISE/_inbox/<message-id>/`)
- Vercel schreibt `.trigger`-JSON in den Ordner und setzt `mail_queue.status = ready_for_quickcheck`
- OneDrive synct Ordner auf den PC (passiert von alleine, kein Code nötig)
- Lokaler Watcher (Task Scheduler, alle 60 Sek) sieht `.trigger` und startet `claude` mit Quick-Check-Skill
- Quick-Check-Skill: liest PDFs lokal, extrahiert Adresse, berechnet Score, schreibt Lead ins CRM, benennt Ordner um, legt Wiedereinstiegs-Datei ab
- Wiedereinstiegs-Datei: `.code-workspace` öffnet bei Doppelklick VS Code im Objekt-Ordner mit automatisch startendem Claude-Code-Terminal

**Raus aus dem MVP:**

- Automatischer Aufteiler-Vollanalyse-Trigger (bleibt manuell wie heute, über Wiedereinstiegs-Datei)
- Multi-Channel-Ingest (WhatsApp, Scraper, Voice)
- Lernender Priority-Score auf Basis gekaufter Leads
- Server-basierte 24/7-Cloud-Variante (verworfen wegen Kosten, siehe §3.3)
- Reaktivierung der 13 wartenden Mails im M365-Ordner CRM-Eingang (Entscheidung später, nach erstem erfolgreichen Test-Lauf)

---

## 3. Stand vor Redesign

### 3.1 Was läuft

- ✅ Webhook-Endpoint `https://immo-crm-xi.vercel.app/api/akquise/webhook`
- ✅ Microsoft-Graph-Subscription aktiv (ID `935c3625-...`, Expiry 2026-05-16)
- ✅ `mail_queue`-Insert funktioniert
- ✅ ENV-Vars in Vercel-Production gesetzt
- ✅ Outlook-QuickStep schickt forwarded Mails in M365-Ordner `CRM-Eingang`
- ✅ Aufteiler-Skill-Suite läuft lokal (`c:\meine-projekte\Immobilien\Aufteiler\skills\aufteiler-modul-0-quickcheck`)
- ✅ OneDrive ist auf dem PC eingerichtet, Microsoft-Graph-API funktioniert
- ✅ Supabase Free Tier mit `contacts`, `deals`, `mail_queue`, `activity_log`

### 3.2 Was kaputt ist

- ❌ `pdf-parse@2` braucht `DOMMatrix` (Browser-API), nicht in Vercel-Node
- ❌ Downgrade auf v1 hat den Bug nicht gelöst (Bundle scheint noch v2 zu enthalten)
- ❌ Konsequenz: `/api/akquise/process` returnt HTTP 500
- ❌ 13 Mails warten unverarbeitet, 1 als `pending` in `mail_queue`

### 3.3 Warum lokaler Quick-Check statt Cloud-Fix

Brainstorming-Ergebnis (siehe `docs/superpowers/plans/2026-05-14-akquise-pipeline-spec.md`):

| Option | Kosten/Monat | Wieder­verwendung | Komplexität |
|---|---|---|---|
| Eigener Server (Hetzner + Claude Code 24/7) | ~55-110 € | Aufteiler-Skill 1:1 | Server-Wartung, OAuth, Watcher |
| Cloud-PDF-Tech ersetzen (alternative Library, externer Service) | 0-20 € | Logik in TS neu bauen | Tooling fragil, DSGVO-Check bei externem Service |
| **Lokal nach OneDrive-Sync (gewählt)** | **0 €** | Aufteiler-Skill 1:1 | Nur lokaler Watcher (einfach) |

PC-aus-Szenario (Stau bis PC wieder läuft, dann Batch-Abarbeitung beim Frühstück) wurde vom User als akzeptabel eingestuft.

---

## 4. Architektur

```
┌──────────────────────────────────────────────────────────────────┐
│  USER-AKTION (PC oder mobil per Outlook-App)                     │
│  Mail → M365-Ordner "CRM-Eingang"                                │
└─────────────────────────┬────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  CLOUD: Microsoft Graph Webhook                                  │
│  POST /api/akquise/webhook (UNVERÄNDERT)                         │
│  → Validation Token / Notification-Empfang                       │
│  → mail_queue.insert(status='pending')                           │
│  → fetch /api/akquise/process intern                             │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  CLOUD: /api/akquise/process (ABGESPECKT)                        │
│   1. mail_queue.update(status='processing')                      │
│   2. fetchMail + fetchAttachments (UNVERÄNDERT)                  │
│   3. parseEmail entpackt MIME-Anhänge (UNVERÄNDERT)              │
│   4. resolveLink für jeden Online-Link → PDF (UNVERÄNDERT)       │
│   5. uploadOneDrive in `001_AQUISE/_inbox/<message-id>/`         │
│      (PFAD-ÄNDERUNG: vorher direkt in Objekte/<Adresse>/)        │
│   6. writeTriggerFile → `.trigger`-JSON in den Ordner (NEU)      │
│   7. mail_queue.update(status='ready_for_quickcheck')            │
│                                                                  │
│   RAUS: pdf-parse, extractAddress, classifyPdf, quickCheck,      │
│         insertLead, _meta.json-Score-Felder                      │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  ONEDRIVE-SYNC (passiert automatisch)                            │
│  Cloud-Files → lokaler OneDrive-Ordner                           │
│  Sync-Latenz: typisch <30 Sek bei kleinen Files                  │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  LOKAL: Task Scheduler (alle 60 Sek)                             │
│  → PowerShell `watch-inbox.ps1`                                  │
│     - Scannt `001_AQUISE/_inbox/` rekursiv nach *.trigger        │
│     - Prüft .lock (Doppellauf-Schutz)                            │
│     - Bei Fund: setzt .lock, ruft `claude` CLI                   │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  LOKAL: Quick-Check-Skill (akquise-quickcheck)                   │
│  Eingaben: Ordnerpfad, PDFs, _meta.json, .trigger-Payload        │
│   1. PDFs lesen (Claude-Code Read/PDF-Skill)                     │
│   2. Adresse extrahieren (LLM, kein Cloud-Fallback nötig)        │
│   3. Modul-0-Logik: Angebotspreis vs ETW-Konsens, Gap%, Status   │
│   4. Score 0-100 + Begründung                                    │
│   5. Kontakt aus Mail-Absender ableiten                          │
│   6. Supabase: contacts upsert + deals insert + activity_log     │
│   7. Ordner umbenennen: _inbox/<msg-id>/ → Objekte/<Adresse>/    │
│   8. <Adresse>.code-workspace + tasks.json schreiben             │
│   9. state.json für spätere Aufteiler-Vollanalyse                │
│  10. quickcheck-log.md (Audit-Spur)                              │
│  11. mail_queue.update(status='done', deal_id=<id>)              │
│  12. .trigger + .lock aufräumen                                  │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  IMMOCRM (Lead sichtbar)                                         │
│  Lead-Liste zeigt neuen Eintrag mit Score, sortiert nach         │
│  priority_score DESC NULLS LAST (gemäß alter Spec §4.7)          │
└──────────────────────────────────────────────────────────────────┘

   ⋮
   ⋮  SPÄTER: manueller Wiedereinstieg
   ⋮
┌──────────────────────────────────────────────────────────────────┐
│  Doppelklick auf <Adresse>.code-workspace                        │
│   → VS Code öffnet Objekt-Ordner als Workspace                   │
│   → tasks.json (runOn: folderOpen) startet Terminal mit `claude` │
│   → Du startest Aufteiler-Vollanalyse oder prüfst Quick-Check    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. Komponenten im Detail

### 5.1 Webhook (`api/akquise/webhook.ts`)

**UNVERÄNDERT.** Akzeptiert Graph-Validation-Token + Change-Notifications, schreibt Eintrag in `mail_queue` mit `status='pending'`, ruft `/api/akquise/process` intern auf.

Verifiziert per Live-Logs in Vercel: läuft seit dem 2026-05-13 stabil.

### 5.2 Process-Endpoint (`api/akquise/process.ts`) — ABGESPECKT

**Bisher (kaputt):** macht Mail-Parsen, PDF-Lesen, Adress-Extraktion (LLM), QuickCheck (LLM), Lead-Insert.

**Nach Redesign:** nur Datei-Handling und State-Management. Kein LLM-Call, kein PDF-Lesen.

```typescript
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  if (req.headers.authorization !== `Bearer ${expected}`) return res.status(401).send('Unauthorized');

  const { messageId, graphMessageId } = req.body;
  const supa = supabaseAdmin();

  await supa.from('mail_queue').update({ status: 'processing', started_at: now() }).eq('message_id', messageId);

  try {
    const [graphMail, graphAttachments] = await Promise.all([
      fetchMail(graphMessageId),
      fetchAttachments(graphMessageId),
    ]);
    const mail = parseEmail(graphMail, graphAttachments);

    // Online-Links auflösen (z.B. ImmoScout-Exposé-Links → PDF)
    const linkPdfs = [];
    for (const link of mail.links) {
      const pdf = await resolveLink(link);
      if (pdf) linkPdfs.push(pdf);
    }
    const allFiles = [...mail.attachments, ...linkPdfs];

    // Inbox-Ordner mit Message-ID als Name
    const inboxFolder = sanitizeMessageId(messageId);

    // _meta.json bauen: Header-Info, KEINE Quick-Check-Daten
    const meta = {
      messageId,
      graphMessageId,
      subject: mail.subject,
      from: mail.from,
      date: mail.date,
      inReplyTo: mail.inReplyTo,
      files: allFiles.map(f => ({ name: f.name, size: f.buffer.length, contentType: f.contentType })),
    };

    // Trigger-Payload: was der lokale Quick-Check wissen muss
    const trigger = {
      messageId,
      enqueuedAt: now(),
      schemaVersion: 1,
    };

    const uploadInput = [
      ...allFiles,
      { name: '_meta.json', buffer: Buffer.from(JSON.stringify(meta, null, 2)), contentType: 'application/json' },
      { name: '.trigger', buffer: Buffer.from(JSON.stringify(trigger, null, 2)), contentType: 'application/json' },
    ];

    await uploadFiles({ folderPath: `_inbox/${inboxFolder}`, files: uploadInput });

    await supa.from('mail_queue').update({
      status: 'ready_for_quickcheck',
      done_at: null,
    }).eq('message_id', messageId);

    res.status(200).json({ ok: true, inboxFolder });
  } catch (err) {
    await supa.from('mail_queue').update({ status: 'error', error_msg: String(err) }).eq('message_id', messageId);
    res.status(500).json({ ok: false, error: String(err) });
  }
}
```

**Files RAUS aus `api/_lib/`:**

- `extractAddress.ts`
- `quickCheck.ts`
- `insertLead.ts`
- `classifyPdf.ts`
- `extractContact.ts` (Kontakt-Extraktion läuft jetzt lokal aus Mail-From)
- `writeWorkspace.ts` (Workspace-Datei wird vom Quick-Check-Skill geschrieben)

**Dependency RAUS:** `pdf-parse` aus `package.json`.

**Files BLEIBEN:**

- `fetchMail.ts` (Microsoft Graph: Mail + Attachments)
- `parseEmail.ts` (MIME-Entpacken, Anhänge + Links extrahieren)
- `resolveLink.ts` (Online-Link → PDF-Buffer)
- `uploadOneDrive.ts` (Graph-API-Upload, mit angepasstem Pfad)
- `supabaseAdmin.ts` (Supabase-Client)

**Files NEU:**

- (keine; Trigger-Datei + Meta-Datei werden inline in `process.ts` gebaut)

### 5.3 OneDrive-Ordnerstruktur

**Vor Quick-Check (von Cloud angelegt):**

```
OneDrive/Immobilien/001_AQUISE/_inbox/<sanitized-message-id>/
├── Exposé.pdf
├── Mieterliste.pdf
├── ... (weitere Anhänge / aufgelöste Links)
├── _meta.json
└── .trigger
```

**Nach Quick-Check (vom Skill umbenannt):**

```
OneDrive/Immobilien/001_AQUISE/Objekte/<Adresse>/
├── Exposé.pdf
├── Mieterliste.pdf
├── ...
├── _meta.json
├── <Adresse>.code-workspace
├── quickcheck-log.md
└── state.json    (für spätere Aufteiler-Vollanalyse)
```

**Sanitize-Regel für Message-ID:** alle Zeichen außer `[A-Za-z0-9._-]` durch `_` ersetzen, max 100 Zeichen. Beispiel: `<025e01dce38d$aeb76260$0c262720$@web.de>` → `025e01dce38d_aeb76260_0c262720__web.de`.

**Sanitize-Regel für Adresse:** Aufteiler-Slug-Konvention aus `Aufteiler/CLAUDE.md` — kebab-case, Umlaute ersetzt (`ä→ae`, `ö→oe`, `ü→ue`, `ß→ss`). Beispiel: `Welperstraße 39, 41 und 43, 45525 Hattingen` → `welperstr-39-41-43-hattingen`.

**Bei Duplikat-Adresse:** Suffix `_2`, `_3` etc. (Aufteiler-Konvention).

### 5.4 `.trigger`-Datei-Format

JSON, klein, sauber maschinenlesbar. Inhalt:

```json
{
  "messageId": "<025e01dce38d$aeb76260$0c262720$@web.de>",
  "enqueuedAt": "2026-05-14T13:42:18.123Z",
  "schemaVersion": 1
}
```

Mehr braucht der Watcher nicht — alle weiteren Daten (Subject, From, Files) stehen in `_meta.json` daneben.

`.trigger` wird vom Quick-Check-Skill am Ende gelöscht (Signal: "abgearbeitet").

### 5.5 Lokaler Watcher

**Verortung im Mono-Repo:** `c:\meine-projekte\Immobilien\akquise-watcher\` (neuer Unterordner unter `Immobilien/`, damit thematisch zum CRM gehörig).

**Files:**

- `watch-inbox.ps1` — PowerShell-Skript
- `task-scheduler.xml` — Export der Task-Scheduler-Aufgabe (für Reproduzierbarkeit)
- `README.md` — Setup-Anleitung (einmaliges Importieren der Task-Scheduler-Aufgabe)

**`watch-inbox.ps1` (Skizze, finaler Code im Implementierungsplan):**

```powershell
$inbox = "$env:OneDrive\Immobilien\001_AQUISE\_inbox"
$lockFile = "$inbox\.lock"

if (Test-Path $lockFile) {
  $age = (Get-Date) - (Get-Item $lockFile).LastWriteTime
  if ($age.TotalMinutes -gt 15) {
    Remove-Item $lockFile -Force
  } else {
    exit 0
  }
}

$triggers = Get-ChildItem -Path $inbox -Filter ".trigger" -Recurse -ErrorAction SilentlyContinue
if ($triggers.Count -eq 0) { exit 0 }

New-Item -Path $lockFile -ItemType File -Force | Out-Null

try {
  foreach ($trigger in $triggers) {
    $folder = $trigger.Directory.FullName
    Write-Host "Processing: $folder"
    & claude --skill akquise-quickcheck --arg "$folder" 2>&1 | Tee-Object -FilePath "$inbox\watcher.log" -Append
  }
} finally {
  Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
}
```

**Wichtig:**
- Stale-Lock-Protection (älter 15 Min → ignorieren). Verhindert, dass ein abgestürzter Vorgänger-Lauf den Watcher dauerhaft blockiert.
- Sequenzielle Abarbeitung pro Lauf (Claude Code parallelisiert sich selbst, aber wir wollen pro Mail eine Session).
- Logging in `watcher.log` direkt im `_inbox`-Ordner für späteres Debugging.

**Task Scheduler Setup:**
- Trigger: jede Minute (alle 60 Sek)
- Aktion: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<pfad>\watch-inbox.ps1"`
- "Run whether user is logged on or not": **NEIN** (muss User-Session sein, weil Claude Code im User-Kontext läuft)
- "Run only when user is logged on": **JA**
- Conditions: "Wake the computer to run this task": **NEIN** (PC-aus-Stau ist akzeptabel)

### 5.6 Quick-Check-Skill (`akquise-quickcheck`) — Implementations-Detail

**Verortung:** `c:\meine-projekte\Immobilien\Aufteiler\skills\akquise-quickcheck\SKILL.md` (parallel zu `aufteiler-modul-0-quickcheck`, weil:
- Modul-0 ist interaktiv (`AskUserQuestion`)
- Modul-0 hängt am Aufteiler-Orchestrator und nimmt `objekt_slug` als Input an
- Akquise-Quick-Check muss **vollautomatisch** laufen, Inputs aus PDFs lesen

Wiederverwendung der Modul-0-**Logik** (Gap-Formel, Schwellwerte), nicht des Modul-0-**Workflows**.

**Skill-Anforderungen:**

- **Vollautomatisch.** Keine `AskUserQuestion`. Kein User-Input.
- **Eingabe:** Ordnerpfad als Argument (z.B. `c:\Users\andre\OneDrive\Immobilien\001_AQUISE\_inbox\025e01dce38d_aeb76260...`).
- **Im Ordner vorhanden:** PDFs, `_meta.json`, `.trigger`.
- **Workflow:**
  1. `_meta.json` lesen (Mail-Header, Subject, From, File-Liste).
  2. PDFs lesen (`Read`-Tool oder `example-skills:pdf` Skill — PDF-Lese-Funktion liegt in der Claude-Code-Toolchain, kein eigenes Lib-Problem).
  3. Adresse extrahieren via LLM-Call (kann beliebig große PDFs nutzen, kein Cloud-Constraint).
  4. Modul-0-Logik:
     - Angebotspreis aus PDF
     - ETW-Konsens-Schätzung (Stadtteil + WE-Zahl, Tiefenstufe 1 reicht für Akquise-Quick-Check — kein Notion-Marktdaten-Call hier, das macht erst Aufteiler-Vollanalyse später)
     - Gap-€ und Gap-%
     - Status grün/gelb/rot nach Modul-0-Schwellwert (5%)
  5. Score 0-100 ableiten (Mapping aus Status + Gap-Tiefe).
  6. Begründung als 1-Satz-Text.
  7. Kontakt aus `_meta.json.from`:
     - Email, Name (Display-Part vor `<email>`)
     - Firma/Position via Heuristik (siehe `01_projektbeschreibung.md` §4.6)
- **Ausgabe nach Supabase (REST via Service-Role-Key — siehe §5.7):**
  - `contacts` upsert (Email-Match, sonst Insert)
  - `deals` insert mit `priority_score`, `priority_reason`, `expose_source='mail-pipeline'`, `inbox_message_id=<msg-id>`, `expose_local_path=<finaler Ordnerpfad>`, `expose_url=<OneDrive-WebUrl falls vorhanden>`
  - `activity_log` insert (type=`new_lead`)
- **Ausgabe ins Dateisystem:**
  - Ordner-Rename: `_inbox/<msg-id>/` → `Objekte/<Adresse>/` (oder mit Suffix bei Duplikat)
  - `<Adresse>.code-workspace` (siehe §5.9)
  - `quickcheck-log.md` (Audit-Spur: Roh-Eingaben + LLM-Antworten + finale Werte)
  - `state.json` (Modul-0-Output gemäß `Aufteiler/docs/state-schema.md` — ermöglicht spätere Aufteiler-Vollanalyse ohne Modul-0-Wiederholung; **rnd_frozen** noch nicht gesetzt, weil Modul-2 noch nicht lief)
- **Cleanup:**
  - `mail_queue.update(status='done', deal_id=<id>, done_at=now())`
  - `.trigger` löschen (Signal an Watcher: erledigt)
  - `.lock` löschen lässt der Watcher selbst (siehe §5.5)

**Token-Budget-Überlegung:** Quick-Check pro Mail mit großen PDFs (Mieterliste 40 Seiten) kann teuer werden. Mitigation:
- Modul-0 braucht nur ein paar Felder: Angebotspreis, WE-Zahl, Adresse. Andere PDFs ignorieren oder nur via Filename klassifizieren.
- Exposé-PDF ist meist die Quelle für Preis + WE + Adresse. Andere Anhänge erst bei Modul-1/3 relevant.
- Implementierungsdetail: PDF-Filter auf `expose`-Typ-Pattern, andere PDFs nur listen, nicht lesen.

### 5.7 CRM-Schreibweg (Supabase REST)

Skill schreibt **direkt** in Supabase via REST-API, kein TypeScript-Code-Build, kein Vercel-Aufruf.

**Setup:**
- ENV-Variable im PowerShell-Aufruf oder im Skill-Config: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Speicherort der ENV: lokale `.env`-Datei (z.B. `c:\meine-projekte\Immobilien\akquise-watcher\.env`), in `.gitignore`
- Skill liest ENV via `Bash` (`cat .env`) oder PowerShell-Übergabe (Watcher exportiert sie vor dem `claude`-Aufruf)

**REST-Calls aus dem Skill:**
- `POST /rest/v1/contacts` mit `Prefer: resolution=merge-duplicates,return=representation` (Email-Unique-Constraint sorgt für Upsert)
- `POST /rest/v1/deals` mit Foreign-Key auf Contact-ID
- `POST /rest/v1/activity_log` mit type `new_lead`
- `PATCH /rest/v1/mail_queue?message_id=eq.<id>` mit `status=done`, `deal_id`, `done_at`

**Fehlerbehandlung:**
- Bei 4xx/5xx: Skill schreibt Fehler in `quickcheck-log.md`, setzt `mail_queue.status=error`, `.trigger` bleibt liegen (kein Auto-Retry — verhindert Endlosschleifen bei kaputten PDFs).
- User-Eingriff: nach Behebung des Fehlers `.trigger` neu schreiben (oder einfach Skill manuell auf den Ordner laufen lassen).

### 5.8 Ordner-Umbenennung

`Move-Item` in PowerShell oder Skill-interner Bash-Aufruf. Schritte:

1. Adresse extrahiert: `Welperstraße 39, 41 und 43, 45525 Hattingen`
2. Slug: `welperstr-39-41-43-hattingen`
3. Ziel-Pfad: `OneDrive\Immobilien\001_AQUISE\Objekte\welperstr-39-41-43-hattingen\`
4. Duplikat-Check: existiert Ziel? Wenn ja: Suffix `_2`, `_3` etc.
5. `Move-Item _inbox/<msg-id>/ → Objekte/<finaler-slug>/`
6. OneDrive synct das Rename automatisch in die Cloud.

**Risiko bei laufendem OneDrive-Sync:** Move-Operation während Sync ist riskant (Datei kann "in Use" sein). Mitigation: `_meta.json` und PDFs sollten zum Zeitpunkt der Move-Operation bereits vollständig gesynct sein, weil sie vom Webhook-zu-OneDrive-Pfad in einem einzigen `uploadFiles`-Call landen und vom Watcher erst gesehen werden, wenn die `.trigger`-Datei (letztes File) lokal sichtbar ist.

### 5.9 Wiedereinstiegs-Datei

**Datei:** `<Adresse>.code-workspace` (z.B. `welperstr-39-41-43-hattingen.code-workspace`)

**Inhalt (JSON):**

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

**Verhalten beim Doppelklick:**
1. Windows öffnet `.code-workspace`-Dateien per Default in VS Code (sofern installiert).
2. VS Code öffnet den Workspace mit dem Objekt-Ordner als Root.
3. `tasks.json` mit `runOn: folderOpen` triggert beim ersten Öffnen das Task "Start Claude Code".
4. Beim ersten Mal fragt VS Code: "Allow automatic tasks in folder?" → **Manage Folder → Allow**.
5. Ab dann läuft Claude Code beim Doppelklick automatisch im Terminal-Panel.

**Alternative ohne Workspace-File:** `.bat`-Datei mit `cd %~dp0 && code . && claude`. Verworfen wegen sichtbarem CMD-Fenster und schlechterer Integration.

---

## 6. State-Übergänge im `mail_queue`

| Status | Wer setzt | Bedeutung |
|---|---|---|
| `pending` | Webhook | Mail erkannt, noch nicht verarbeitet |
| `processing` | process.ts | Cloud arbeitet gerade (Files runterladen, hochladen) |
| `ready_for_quickcheck` | process.ts (Erfolg) | Files im OneDrive `_inbox/<msg-id>/`, Trigger geschrieben, wartet auf lokalen Quick-Check |
| `done` | Quick-Check-Skill | Lead im CRM angelegt, Ordner umbenannt, alles fertig |
| `error` | process.ts ODER Quick-Check-Skill | Fehler aufgetreten, `error_msg` ausgefüllt |

**Schema-Änderung:** `mail_queue.status` von text-Spalte auf erweitertes Enum (oder bleibt text mit Check-Constraint). Migration: `005_mail_queue_status_extension.sql`.

---

## 7. Datenfluss-Sequenz (Happy Path)

```
14:23:00  User schiebt Mail in M365 CRM-Eingang (mobil oder PC)
14:23:05  Microsoft Graph erkennt Change, schickt Notification
14:23:06  Vercel /api/akquise/webhook empfängt
14:23:07  mail_queue.insert(status='pending')
14:23:07  Webhook ruft /api/akquise/process intern auf
14:23:08  process.ts: status='processing', fetchMail+Attachments
14:23:12  uploadOneDrive: PDFs + _meta.json + .trigger → _inbox/<msg-id>/
14:23:13  status='ready_for_quickcheck', HTTP 200
14:23:13  Cloud fertig.

14:23:43  OneDrive-Sync übermittelt Files an PC (Latenz ~30 Sek typisch)
14:24:00  Task Scheduler-Lauf, Watcher scannt _inbox: noch keine .trigger sichtbar (Sync läuft)
14:25:00  Task Scheduler-Lauf, .trigger ist da. Lock setzen, claude aufrufen.
14:25:02  Claude Code startet mit akquise-quickcheck-Skill
14:25:05  Skill liest _meta.json, PDFs
14:25:15  LLM-Adress-Extraktion: "Welperstraße 39, 41 und 43, 45525 Hattingen"
14:25:25  LLM-Modul-0: Score 78, Status grün, Begründung
14:25:28  Supabase POST contacts, POST deals, POST activity_log
14:25:29  Move _inbox/025e01dce38d_.../ → Objekte/welperstr-39-41-43-hattingen/
14:25:29  Schreibe .code-workspace, quickcheck-log.md, state.json
14:25:30  mail_queue.status='done', .trigger gelöscht
14:25:30  Lock freigeben.

14:25:31  Lead sichtbar in ImmoCRM-Lead-Liste, sortiert nach priority_score=78
```

---

## 8. Was aus Cloud-Code RAUSGEHT

| Datei / Dependency | Aktion | Grund |
|---|---|---|
| `api/_lib/extractAddress.ts` | LÖSCHEN | Adress-Extraktion läuft lokal |
| `api/_lib/quickCheck.ts` | LÖSCHEN | Quick-Check läuft lokal |
| `api/_lib/insertLead.ts` | LÖSCHEN | Lead-Insert läuft lokal |
| `api/_lib/classifyPdf.ts` | LÖSCHEN | Klassifikation läuft lokal (falls überhaupt nötig) |
| `api/_lib/extractContact.ts` | LÖSCHEN | Kontakt-Extraktion läuft lokal |
| `api/_lib/writeWorkspace.ts` | LÖSCHEN | Workspace-File wird vom Skill geschrieben |
| `pdf-parse` (package.json) | RAUS | nicht mehr gebraucht, war Cloud-Bruch |
| `@anthropic-ai/sdk` (in Cloud-Code) | BLEIBT optional | wird vorerst nicht mehr gebraucht, kann aber drin bleiben falls später Cloud-Verarbeitung doch wieder gebraucht wird |

---

## 9. Was im Cloud-Code BLEIBT

| Datei | Aktion |
|---|---|
| `api/akquise/webhook.ts` | UNVERÄNDERT |
| `api/_lib/fetchMail.ts` | UNVERÄNDERT |
| `api/_lib/parseEmail.ts` | UNVERÄNDERT |
| `api/_lib/resolveLink.ts` | UNVERÄNDERT |
| `api/_lib/uploadOneDrive.ts` | ANGEPASST: Ziel-Pfad-Konstante auf `_inbox/<msg-id>/` |
| `api/_lib/supabaseAdmin.ts` | UNVERÄNDERT |
| `api/akquise/process.ts` | STARK REDUZIERT (siehe §5.2) |
| `scripts/setup-graph-subscription.mjs` | UNVERÄNDERT |
| `scripts/spike-check-folder.mjs` | UNVERÄNDERT |

---

## 10. Was NEU dazukommt

| Bereich | Datei | Inhalt |
|---|---|---|
| Lokal | `c:\meine-projekte\Immobilien\akquise-watcher\watch-inbox.ps1` | PowerShell-Watcher für Task Scheduler |
| Lokal | `c:\meine-projekte\Immobilien\akquise-watcher\task-scheduler.xml` | Export der Task-Aufgabe (für Reproduktion) |
| Lokal | `c:\meine-projekte\Immobilien\akquise-watcher\README.md` | Setup-Anleitung (einmalig: XML importieren, Pfade in `.env` setzen) |
| Lokal | `c:\meine-projekte\Immobilien\akquise-watcher\.env.example` | Template für SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ONEDRIVE_BASE |
| Lokal | `c:\meine-projekte\Immobilien\akquise-watcher\.gitignore` | `.env`, `*.log`, `.lock` |
| Lokal | `c:\meine-projekte\Immobilien\Aufteiler\skills\akquise-quickcheck\SKILL.md` | Neuer Skill, Modul-0-Logik adaptiert für vollautomatischen Lauf |
| Lokal | Junction-Eintrag in `~/.claude/skills/akquise-quickcheck` | Standard-Aufteiler-Skill-Installation (Windows-Junction) |
| Cloud | (keine neuen Dateien) | Trigger-Datei und _meta.json werden inline in `process.ts` gebaut |

---

## 11. DB-Erweiterungen

**Migration `005_mail_queue_status_extension.sql`:**

```sql
-- mail_queue.status soll auch 'ready_for_quickcheck' akzeptieren
-- Wenn aktuell text mit Check-Constraint: Constraint aktualisieren
-- Wenn aktuell Enum: ALTER TYPE ... ADD VALUE
-- Annahme (zu verifizieren beim Bau): aktuell text ohne Constraint

-- Optional: Check-Constraint hinzufügen für Sauberkeit
ALTER TABLE mail_queue ADD CONSTRAINT mail_queue_status_check
  CHECK (status IN ('pending', 'processing', 'ready_for_quickcheck', 'done', 'error'));
```

**Bestehende Migrationen (`003_mail_queue.sql`, `004_deals_priority_score.sql`) bleiben unverändert.** Spalten `priority_score`, `priority_reason`, `expose_source`, `inbox_message_id` aus 2026-05-11-Spec sind weiterhin gültig und werden vom lokalen Skill befüllt.

---

## 12. Migration der alten Pipeline

| Schritt | Aktion |
|---|---|
| 1 | Branch `redesign/akquise-local-quickcheck` erstellen (oder direkt main, je nach User-Präferenz) |
| 2 | `process.ts` umbauen gemäß §5.2 |
| 3 | Files aus §8 löschen |
| 4 | `pdf-parse` aus package.json + package-lock.json entfernen |
| 5 | `uploadOneDrive.ts` Pfad-Konstante anpassen (Ziel `_inbox/<msg-id>/`) |
| 6 | Migration `005_mail_queue_status_extension.sql` |
| 7 | Lokalen Watcher + Skill bauen |
| 8 | mail_queue säubern: `DELETE FROM mail_queue WHERE status IN ('pending','processing','error')` (sind ohnehin unverarbeitbar) |
| 9 | Test-Mail durchschicken (eine eigene zur Verifikation, NICHT eine der 13 wartenden) |
| 10 | Bei Erfolg: entscheiden ob die 13 wartenden Mails reaktiviert werden (per `\Unread`-Flag oder per Re-Forward) |

**Banner auf alter Spec `2026-05-11-akquise-pipeline-cloud-design.md`:**

> **HISTORISCHE REFERENZ — ERSETZT.**
> Diese Spec wurde am 2026-05-14 funktional ersetzt durch
> [`2026-05-14-akquise-pipeline-redesign.md`](2026-05-14-akquise-pipeline-redesign.md).
> Grund: PDF-Parsing in Vercel-Node-Runtime nicht stabil, Quick-Check + Adress-
> Extraktion wurden lokal verlagert. Webhook und Mail-Scraping-Logik aus dieser
> alten Spec bleiben jedoch im Einsatz.

---

## 13. Akzeptanzkriterien

| # | Kriterium | Verifikation |
|---|---|---|
| A1 | Mail in M365 CRM-Eingang → ≤ 2 Min später Files in OneDrive `_inbox/<msg-id>/` | Test-Mail, manuell Ordner prüfen |
| A2 | Files in OneDrive synct innerhalb 60 Sek auf PC | Explorer öffnen, Inhalt prüfen |
| A3 | Watcher findet `.trigger` und startet Claude Code | Task Scheduler History + `watcher.log` |
| A4 | Quick-Check-Skill legt Lead in CRM an mit Score | ImmoCRM Lead-Liste öffnen |
| A5 | Ordner wird umbenannt von `_inbox/<msg-id>/` → `Objekte/<Adresse>/` | Explorer prüfen |
| A6 | `.code-workspace` öffnet bei Doppelklick VS Code + Claude Code | Manuell testen |
| A7 | Idempotenz: dieselbe Mail doppelt → kein Duplikat-Lead | Test-Mail zweimal triggern (z.B. via Graph Re-Notification), Lead-Count = 1 |
| A8 | Bei PC-aus: Mail wird verarbeitet sobald PC läuft + OneDrive synct + Watcher rennt | PC ausschalten, Mail forwarden, PC anschalten, max 5 Min später Lead da |
| A9 | Stale-Lock-Recovery: abgestürzter Skill blockiert nicht | `.lock`-Datei manuell setzen mit alter Mtime, dann Watcher laufen lassen |
| A10 | `state.json` ist gemäß Aufteiler-State-Schema valide | `python tools/validate_state.py state.json` exit 0 |
| A11 | Aufteiler-Vollanalyse aus dem Objekt-Ordner heraus startbar (Modul-0-State liegt vor) | Workspace öffnen, `aufteiler`-Skill aufrufen, Modul-2 läuft ohne Modul-0-Wiederholung |
| A12 | Token-Verbrauch pro Mail < 50 Cent (im Anthropic-Plan-Budget) | Anthropic-Konsole prüfen nach 10 Test-Läufen |

---

## 14. Risiken

| # | Risiko | Mitigation |
|---|---|---|
| R1 | OneDrive-Sync-Latenz > 1 Minute → Watcher verpasst Files | Trigger wird als LETZTE Datei hochgeladen (siehe §5.2). Wenn `.trigger` lokal sichtbar ist, sind alle anderen Files auch da. Wenn Sync gar nicht durchläuft: Task Scheduler-Lauf ist alle 60 Sek, beim nächsten Mal wird's gesehen. |
| R2 | PowerShell-Skript crasht mid-run → `.lock` bleibt | Stale-Lock-Detection: nach 15 Min wird Lock ignoriert (§5.5). |
| R3 | Claude Code wird upgraded und ändert CLI-Syntax | Wenn `claude --skill X` nicht mehr funktioniert: Watcher-Skript anpassen. Risiko gering aber existent. |
| R4 | Token-Verbrauch pro Mail explodiert bei riesigen PDFs | Skill liest selektiv (Exposé-PDF zuerst, andere ggf. überspringen). Token-Limits im Skill als Guardrail. |
| R5 | OneDrive-Datei-Locks bei laufendem Sync | Move-Operation: bei Fehler 1 Sek warten und retry (max 3x). |
| R6 | Mehrere Mails gleichzeitig in `_inbox/` → Watcher arbeitet sequenziell | Bewusst so gewählt. Bei Backlog (z.B. nach Urlaub) abarbeiten in einem Lauf. |
| R7 | Mail mit 0 PDFs (nur Text-Mail mit Link) → Link-Resolve schlägt fehl | resolveLink ist robust gegen nicht-PDF-Antworten. Skill markiert Status=error im mail_queue, User entscheidet manuell. |
| R8 | Adresse nicht im Exposé erkennbar (z.B. nur "Off-Market") | Skill setzt Adresse = "_unbekannt_<msg-id>" und legt Lead mit dem Subject als Adresse. User korrigiert manuell. |
| R9 | Aufteiler-Modul-Logik ändert sich, Akquise-Quick-Check driftet auseinander | Beide Skills haben dieselbe Modul-0-Berechnung. Bei Aufteiler-Modul-0-Änderungen: Mirror in akquise-quickcheck. Konvention im Aufteiler-CLAUDE.md ergänzen. |
| R10 | Graph-Webhook-Subscription läuft am 2026-05-16 ab (2 Tage nach Spec-Datum) | Vor Redesign-Bau prüfen, ob Renew automatisch läuft (Vercel-Cron?) oder ob `scripts/setup-graph-subscription.mjs` manuell ausgeführt werden muss. Sonst stoppt am 2026-05-16 der gesamte Mail-Ingest. |

---

## 15. Cross-Projekt-Eingriffe

### 15.1 ImmoCRM-Repo (`c:\meine-projekte\Immobilien\ImmoCRM\`)

| Bereich | Aktion |
|---|---|
| `api/akquise/process.ts` | UMBAUEN (siehe §5.2) |
| `api/_lib/{extractAddress, quickCheck, insertLead, classifyPdf, extractContact, writeWorkspace}.ts` | LÖSCHEN |
| `api/_lib/uploadOneDrive.ts` | ANPASSEN (Ziel-Pfad-Konstante) |
| `package.json` + `package-lock.json` | `pdf-parse` entfernen |
| `supabase/migrations/005_mail_queue_status_extension.sql` | NEU |
| `docs/superpowers/specs/2026-05-11-akquise-pipeline-cloud-design.md` | BANNER (siehe §12) |
| `docs/superpowers/specs/2026-05-14-akquise-pipeline-redesign.md` | NEU (diese Datei) |
| `docs/02_implementierungsplan.md` | UPDATE Schritt 7 (Verweis auf neue Spec) |
| `docs/03_decisions.md` | NEUER ADR: "Akquise-Pipeline Quick-Check lokal statt Cloud" |
| `docs/04_progress.md` | UPDATE Schritt 7 Status (zurückgesetzt auf "im Umbau") |

### 15.2 Aufteiler-Repo (`c:\meine-projekte\Immobilien\Aufteiler\`)

| Bereich | Aktion |
|---|---|
| `skills/akquise-quickcheck/SKILL.md` | NEU |
| `docs/akquise-quickcheck.md` | NEU (Skill-Dokumentation gemäß Aufteiler-CLAUDE.md Konvention) |
| `CLAUDE.md` | ERGÄNZEN: Hinweis dass Modul-0-Logik in akquise-quickcheck gespiegelt ist und bei Änderungen mit-gepflegt werden muss |

### 15.3 Akquise-Watcher (neu)

| Bereich | Aktion |
|---|---|
| `c:\meine-projekte\Immobilien\akquise-watcher\` | NEUER ORDNER mit watch-inbox.ps1, task-scheduler.xml, README.md, .env.example, .gitignore |

### 15.4 Mono-Repo-Root

| Bereich | Aktion |
|---|---|
| `c:\meine-projekte\README.md` | EINTRAG: `Immobilien/akquise-watcher/` als neuer Subfolder |

### 15.5 Externe Systeme

| System | Aktion |
|---|---|
| **Task Scheduler (Windows)** | Aufgabe importieren aus `task-scheduler.xml`, Pfad-Anpassung im Skript-Argument |
| **Supabase** | Migration `005` ausführen |
| **Microsoft Graph** | KEINE Änderung (Subscription bleibt, Webhook bleibt) |
| **Vercel** | Re-Deploy nach Code-Änderungen, ENV unverändert |
| **OneDrive** | Ordner `001_AQUISE/_inbox/` wird beim ersten Lauf automatisch angelegt |
| **alte automatisierung-aquise (Python-Pipeline)** | STATUS UNVERÄNDERT (war schon deaktiviert nach 2026-05-11-Migration) |

---

## 16. Implementierungsplan-Skizze

Detail-Plan kommt separat via `superpowers:writing-plans`. Hier nur die Atomarität:

| # | Schritt | Aufwand | Hauptdateien |
|---|---|---|---|
| B1 | DB-Migration `005_mail_queue_status_extension.sql` | 0.5 h | supabase/migrations |
| B2 | Cloud-Code abspecken — process.ts umbauen, Files löschen, package.json | 2 h | api/akquise/process.ts, api/_lib/* |
| B3 | uploadOneDrive Pfad anpassen + Test-Deploy auf Vercel | 1 h | api/_lib/uploadOneDrive.ts |
| B4 | Akquise-Watcher anlegen (PowerShell + README + Task-Scheduler-XML) | 2 h | akquise-watcher/* |
| B5 | Akquise-Quickcheck-Skill bauen (Modul-0-Logik adaptiert, Supabase-REST-Calls, Ordner-Rename, Workspace-File, state.json) | 4 h | Aufteiler/skills/akquise-quickcheck/SKILL.md |
| B6 | Task Scheduler einrichten (XML importieren, Pfade setzen, manueller Probe-Lauf) | 0.5 h | Windows-Setup |
| B7 | E2E-Test mit Test-Mail (selbst geschickte Mail an web.de, dann manuell in CRM-Eingang) | 1 h | Manual |
| B8 | Doku-Updates (03_decisions, 04_progress, 02_implementierungsplan, mono-repo-README) | 1 h | docs/* |
| B9 | Entscheidung 13 wartende Mails: liegenlassen oder durchschicken | 0-1 h | M365 / Re-Trigger |

**Gesamt: ~12 h**

Reihenfolge B1→B2→B3 (Cloud-Teil), parallel B4+B5 (lokaler Teil), dann B6+B7 (Verdrahtung+Test), dann B8+B9.

---

## 17. The One Thing to Do First

**Migration `005_mail_queue_status_extension.sql` ausführen und `mail_queue` säubern (DELETE WHERE status IN ('pending','processing','error')).**

Sobald die mail_queue leer ist und das neue Status-Feld den neuen Wert akzeptiert, kann der Cloud-Code umgebaut werden ohne Risiko, dass mittendrin Test-Mails reinrasseln und in einem unsauberen Zwischen-State landen.

---

## 18. Change-Log

| Datum | Änderung | Autor |
|---|---|---|
| 2026-05-14 | Initial Spec nach Brainstorming (vollständig dokumentiert in `plans/zazzy-tickling-shell.md`) | André + Claude Code |
