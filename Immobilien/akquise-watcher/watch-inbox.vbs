' Akquise-Watcher VBScript-Wrapper.
' Task Scheduler ruft wscript.exe mit dieser Datei auf — sie startet PowerShell
' komplett unsichtbar im Hintergrund (kein Fenster-Flash jede Minute).
' Run-Parameter: erstes 0 = WindowStyle Hidden, False = nicht warten.
CreateObject("Wscript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""C:\meine-projekte\Immobilien\akquise-watcher\watch-inbox.ps1""", 0, False
