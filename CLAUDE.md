# Guidelines & Anweisungen — meine-projekte

Zentrale Anweisungen für Claude Code über alle Unterprojekte hinweg.
Pro-Projekt-Details stehen in den jeweiligen `CLAUDE.md` der Unterordner
(`Immobilien/*/CLAUDE.md`, `automatisierung-aquise/CLAUDE.md`).

---

## Tools & MCP-Server

### Higgsfield MCP — Bild- & Videogenerierung (inkl. 3D-Kamerafahrten)

**URL:** https://higgsfield.ai/mcp
**Auth:** Higgsfield-Account (kein API-Key nötig, Credits über bestehenden Plan).
**Status:** noch nicht eingebunden — bei Bedarf in Claude-Code-Settings als MCP-Server hinzufügen.

**Was es kann (Kurzbeschreibung):**
Higgsfield ist ein „One-Stop"-MCP für agentische Bild- und Videoproduktion.
Anstatt zwischen Sora, Veo, Kling, Flux usw. zu wechseln, ruft Claude alle
Modelle über ein einziges Toolset auf, pollt asynchron auf Ergebnisse und kann
auf eine vollständige Generation-History zugreifen (Iterationen, Reuse).

**Modellpalette (~30 Modelle, Stand 2026):**
- **Bild:** Soul, Soul 2.0, Nano Banana Pro, Flux, Flux 2, Seedream 5.0 Lite, GPT Image 2
  - Auflösungen bis **4K**, bis zu **16 Referenzbilder**, Stilkontrolle.
- **Video:** Sora 2, Veo 3.1, Kling 3.0 (+ 2.5/2.6), Seedance / Seedance 2.0, Minimax Hailuo 02, WAN 2.6, Grok Video
  - **720p / 1080p**, **16:9 oder 9:16**, **4 / 8 / 12 / bis 15 s**, Start-/End-Frame-Control, Sound.
- **Talking-Head / Avatar:** `generate_speech_video` (Lippensynchron-Avatare).

**Spezialfeatures (das, was Higgsfield von „nur API" unterscheidet):**

1. **DoP — Cinematic Motion / 3D-Kamerafahrten**
   100+ vorgefertigte Kamerapfade als Presets (UUIDs), die statische Bilder in
   filmische 3D-Kameraschwenks animieren:
   - Dolly-in/out, Crash-Zoom, Whip-Pan, Bullet-Time, FPV-Drone,
     Orbit, Handheld, Push-In, Pull-Out u. v. m.
   - Quality-Tiers: `dop-lite` (Preview), `dop-preview` (HQ), `dop-turbo` (Max).
   - **→ Das ist „die 3D-animierten Sachen" aus deiner Frage.** Aus einem Foto
     wird eine echte filmische Kamerafahrt — kein 3D-Modell, aber 3D-wirkende
     Bewegung im Raum.

2. **Soul Character ID — Charakter-Konsistenz**
   Einmal mit ein paar Referenzbildern eine Person/Figur trainieren → diese
   Identität bleibt über beliebig viele spätere Bild- und Video-Generierungen
   konsistent (gleiches Gesicht, gleicher Stil, andere Szenen).

3. **Marketing-Studio-Presets (9 Stück)**
   Fertige Templates für Kurzformat-Ads: UGC, Unboxing, Produkt-Review,
   Hyper-Motion, TV-Spot u. a. Input = Produktfoto/URL, Output = fertiger Ad-Clip
   mit passendem Seitenverhältnis und Schnittrhythmus.

4. **Cinema Studio** — Kombination aus Kamera-, Lens- und Motion-Control für
   filmische Looks.

5. **Async + History** — Jobs laufen asynchron, Claude pollt; alle bisherigen
   Generierungen sind als Referenz für neue Prompts wiederverwendbar.

**Typische MCP-Tools (Namen je nach Server-Variante):**
`generate_image`, `generate_video`, `generate_speech_video`,
`list_models`, `get_status` / `wait_for_job`, `cancel_job`,
`upload_image`, `check_cost`, `get_credits`.

**Wann Claude Higgsfield vorschlagen soll (Trigger für mich):**
- „Erstell mir ein Video / einen Clip / Werbespot / Reel / Short …"
- „Animier dieses Bild" / „mach eine Kamerafahrt aus diesem Foto" → **DoP**
- „Gleiche Person in mehreren Szenen / Kampagne mit konsistentem Charakter" → **Soul Character**
- „Produktvideo / UGC-Ad / Unboxing / TV-Spot" → **Marketing-Studio-Preset**
- „Talking-Head / sprechender Avatar / Voiceover-Video" → **Speech-Video**
- „Cineastischer Look / Kamerafahrt / Drohnenflug / Bullet-Time" → **DoP-Preset**
- „Hi-Res-Bild mit Referenz / 4K-Render" → **Bildmodelle (Soul/Flux/Nano Banana)**

Wenn du (User) eine dieser Anfragen stellst und Higgsfield-MCP noch nicht
eingebunden ist, soll ich dich darauf hinweisen und das Setup vorschlagen.

**Kosten:** Credit-basiert, gleicher Pool wie Higgsfield-Web. Vor teuren Jobs
ggf. `check_cost` / `get_credits` aufrufen.

---

## Externe Anweisungen — OneDrive `KI/`-Ordner

Auf dem PC liegt unter OneDrive ein Ordner **`KI/`**, der zusätzliche
projektübergreifende Anweisungen, Skill-Listen und Plugin-Empfehlungen
enthält. Darin gibt es eine Inhaltsverzeichnis-Markdown, die als
Master-Index dient.

- **Pfad (Windows, OneDrive):** `C:\Users\andre\OneDrive - APPV Personalvermittlung\KI\Prompt´s_Anweisungen\Anleitungen Guides\`
- **Inhaltsverzeichnis-Datei:** _TBD — vom PC eintragen_

**Regel:** Bei Projekt-Start, Sparring, Skill-Auswahl oder Toolbox-
Abfrage **immer zuerst** diesen Ordner + die Inhaltsverzeichnis-MD
prüfen, damit keine vorhandenen Anweisungen / Skills / Plugins
übersehen werden.

> **Hinweis für Claude:** Solange Pfad oder Inhaltsverzeichnis-
> Dateiname hier noch „TBD" lauten, beim Session-Start auf dem PC den
> User darauf hinweisen, dass diese Felder in einem **separaten
> Claude-Code-Fenster** (mit OneDrive-Zugriff) ergänzt werden müssen
> — Web-Claude hat keinen Zugriff auf OneDrive, kann die Felder also
> nicht selbst füllen.

---

## Pending Setup auf PC (lokal ausführen)

Diese Schritte gehen **nicht** auf Claude-Code-Web (kein `/plugin`,
kein lokales MCP-Setup). Beim nächsten Start von Claude Code auf dem PC
**alle vier Plugins installieren**, dann diesen Abschnitt entfernen:

1. **superpowers** (obra/superpowers)
   ```
   /plugin marketplace add obra/superpowers
   /plugin install superpowers@obra-superpowers
   ```

2. **ui-ux-pro-max** (nextlevelbuilder/ui-ux-pro-max-skill)
   ```
   /plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
   /plugin install ui-ux-pro-max
   ```

3. **claude-mem**
   ```
   /plugin install claude-mem
   ```
   (Falls Marketplace fehlt: User fragen, aus welchem Marketplace,
   ggf. vorher `/plugin marketplace add <…>` ausführen.)

4. **differential-review**
   ```
   /plugin install differential-review
   ```
   (Gleiche Anmerkung wie bei claude-mem.)

5. **Higgsfield MCP einbinden** (siehe Abschnitt oben), sobald Bild-/
   Videogenerierung gebraucht wird.

6. **OneDrive: Inhaltsverzeichnis-Dateiname** im Abschnitt „Externe
   Anweisungen" oben ergänzen (Pfad ist schon eingetragen). Auf dem
   PC `C:\Users\andre\OneDrive - APPV Personalvermittlung\KI\Prompt´s_Anweisungen\Anleitungen Guides\`
   öffnen, Index-/Inhaltsverzeichnis-MD identifizieren, Dateiname
   eintragen.

7. **Marketplace: `anthropics/skills`**
   ```
   /plugin marketplace add anthropics/skills
   ```
   Danach `/plugin` öffnen und schauen, welche offiziellen
   Anthropic-Skills relevant sind — die interessanten installieren
   und hier dokumentieren.

8. **Skill: `gstack`** (Garry Tan, via Git-Clone, kein Marketplace)
   ```
   git clone https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
   cd ~/.claude/skills/gstack && ./setup
   ```
   Nach dem Setup prüfen, ob der Skill in `/skills` auftaucht. Trigger
   und Verwendung anschließend im Abschnitt „Skill-/Plugin-Auto-
   Nutzung" eintragen.

Nach Install: `/plugin` öffnen, prüfen dass alle vier als installed
gelistet sind. Erfolgreich installierte Punkte aus dieser Liste
entfernen.

> **Hinweis für Claude:** Wenn dieser Abschnitt beim Session-Start auf
> dem PC sichtbar ist und Punkte offen sind → User aktiv darauf
> hinweisen und Ausführung anbieten. **Erst nach erfolgreicher
> Installation** den Abschnitt „Skill-/Plugin-Auto-Nutzung" unten als
> Standard-Verhaltensregeln befolgen.

---

## Skill-/Plugin-Auto-Nutzung (wann zieht Claude was eigenständig)

Diese Regeln gelten projektübergreifend und legen fest, **wann** Claude
ohne explizite Aufforderung auf einen Skill oder ein Plugin
zurückgreift. Wenn ein Skill nicht installiert ist → User darauf
hinweisen statt schweigend selbst zu improvisieren.

### Higgsfield MCP — Bild & Video
Trigger und Verhalten siehe Abschnitt „Higgsfield MCP" oben.

### ui-ux-pro-max — Design / UI / UX
**Trigger:** Sobald irgendetwas mit **Design, UI, UX, Layout, Mockup,
Screen, Komponente, Farbschema, visuelles Konzept, Landing-Page,
Figma-Übernahme** o. Ä. aufkommt — egal in welchem Projekt.

**Verhalten:**
1. Skill `ui-ux-pro-max` aktivieren.
2. **Den User fragen, welches Design-System / welchen Stil er will**
   (z. B. „shadcn/zinc minimal", „Apple-Style", „Brutalist",
   „Glassmorphism", „bestehendes Brand-System X übernehmen"), bevor
   irgendetwas generiert oder gecodet wird.
3. Erst nach Antwort umsetzen.

### superpowers — allgemeine Power-Tools
Trigger noch nicht festgelegt. User soll nach Install entscheiden,
wofür der Skill standardmäßig anspringen darf. TODO: Trigger hier
ergänzen, sobald der Skill genutzt wurde.

### claude-mem — Memory / Persistenz
Trigger noch nicht festgelegt. TODO: definieren, sobald installiert.

### differential-review — Code-Review
Vermutlicher Trigger: vor jedem Commit / vor jedem Push / vor PR-
Erstellung Diff-Review laufen lassen. TODO: bestätigen nach Install.

> **Pflege-Regel:** Sobald ein neuer Skill / Plugin / MCP-Server dazu
> kommt → hier Trigger und Verhalten ergänzen. Diese Sektion ist die
> Single Source of Truth für „wann zieht Claude was".

---

## Update-Regel

Bei jeder Änderung an Tool-Setup, MCP-Servern oder projektübergreifenden
Anweisungen → diese Datei aktualisieren. Pro-Projekt-Regeln gehören in die
jeweilige Unterordner-`CLAUDE.md`.
