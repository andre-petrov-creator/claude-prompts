# react-pdf

PDF-Generation Skill basierend auf React-PDF (`@react-pdf/renderer`).

## Attribution

Dieser Skill ist eine Kopie aus [molefrog/skills](https://github.com/molefrog/skills) (MIT License). Original-Autor: Alexey Taktarov.

Lizenz siehe `LICENSE.txt`.

## Verwendung

Dieser Skill ist die **Grundlage** (Library/Engine) für alle PDF-Generierungen.

Für das **Standard-Design** (IBM Plex Sans, Anthrazit + Bronze) siehe nicht diesen Skill, sondern: [`../pdf/`](../pdf/).

## Wann diesen Skill nutzen statt `pdf/`

- Bei komplett neuen, freien PDF-Designs
- Bei experimentellen Layouts ohne Standard-Vorgaben
- Als Referenz für react-pdf API-Details (Komponenten, Props, Quirks)

## Wann `pdf/` nutzen

- Standard-Output für Angebote, Reports, Anschreiben, Exposés, etc.
- Konsistente Markenoptik

## SKILL.md

Die `SKILL.md` enthält die vollständige API-Referenz von react-pdf:
- Setup, Fonts, Components
- Page-Breaks, Headers, Footers
- SVG, Images, Links
- Styling, Flexbox, Typografie
