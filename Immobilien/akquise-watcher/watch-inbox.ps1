# Akquise-Watcher: scannt OneDrive _inbox alle 60 Sek nach .trigger-Dateien
# und startet Claude Code mit dem aufteiler-modul-0-quickcheck-Skill im Akquise-Modus.

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
  Write-Host "INFO: Inbox-Pfad existiert noch nicht (OneDrive-Sync hat noch keinen Ordner): $inboxBase"
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
      # Skill-Frontmatter (B5) muss den Akquise-Modus an "Ordnerpfad enthaelt .processing" erkennen.
      # CWD auf Trigger-Ordner setzen, damit Claude-Sandbox die OneDrive-Files lesen darf
      # (schtasks startet sonst aus C:\WINDOWS\system32 und blockiert alle OneDrive-Pfade).
      Set-Location $folder

      $prompt = "Verwende den Skill aufteiler-modul-0-quickcheck im Akquise-Modus mit dem Ordnerpfad: $folder"
      # Prompt via stdin (statt positional) — sonst schluckt `--add-dir <directories...>` (variadic)
      # den Prompt als zweites Directory. Stdin-Pipe schliesst gleichzeitig den stdin-Wait-Block.
      # --add-dir gibt Sandbox-Zugriff auf das Aufteiler-Repo (CHECK24-Tool, Skill-Junctions).
      $claudeOutput = $prompt | & claude --print --permission-mode acceptEdits --add-dir "c:\meine-projekte\Immobilien\Aufteiler" 2>&1
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
