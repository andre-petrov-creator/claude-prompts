# setup-junctions.ps1
# Erzeugt Windows-Junctions von ~/.claude/skills/<name> → Aufteiler-Repo skills/<name>.
# Einmalig laufen. Idempotent: existierende Junctions werden übersprungen.

$src = "C:\meine-projekte\Immobilien\Aufteiler\skills"
$dst = "C:\Users\andre\.claude\skills"

if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Path $dst | Out-Null }

Get-ChildItem $src -Directory | ForEach-Object {
    $target = Join-Path $dst $_.Name
    if (Test-Path $target) {
        Write-Host "SKIP (existiert): $target"
    } else {
        cmd /c mklink /J "$target" "$($_.FullName)" | Out-Null
        Write-Host "OK:   $target -> $($_.FullName)"
    }
}
