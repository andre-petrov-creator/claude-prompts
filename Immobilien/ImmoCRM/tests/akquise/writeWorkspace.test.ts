import { describe, it, expect } from 'vitest';
import { buildWorkspaceFiles } from '../../app/api/akquise/_lib/writeWorkspace';

describe('buildWorkspaceFiles', () => {
  it('liefert alle 4 Dateien', () => {
    const result = buildWorkspaceFiles({
      address: 'Talstr 10, 44137 Dortmund',
      score: 78,
      reason: 'Bestand MFH, gute Lage',
      kennzahlen: { we: 8, wfl: 520, kp: 1050000, eurProM2: 2020 },
      quickCheckTranscript: 'User: ...\nAssistant: Score 78',
      pdfFiles: ['Exposé.pdf', 'Mieterliste.pdf'],
    });
    expect(Object.keys(result).sort()).toEqual([
      '00_briefing.md',
      '00_quickcheck-transkript.md',
      'CLAUDE.md',
      'objekt.code-workspace',
    ]);
  });

  it('.code-workspace enthält tasks.runOn:folderOpen + claude-Command', () => {
    const result = buildWorkspaceFiles({
      address: 'X',
      score: 50,
      reason: null,
      kennzahlen: {},
      quickCheckTranscript: '',
      pdfFiles: [],
    });
    const ws = result['objekt.code-workspace'];
    expect(ws).toContain('"runOn": "folderOpen"');
    expect(ws).toContain('"command": "claude"');
    expect(() => JSON.parse(ws)).not.toThrow();
  });

  it('CLAUDE.md verweist auf 00_briefing.md und Pflicht-Reads', () => {
    const result = buildWorkspaceFiles({
      address: 'Talstr 10',
      score: 78,
      reason: 'x',
      kennzahlen: {},
      quickCheckTranscript: '',
      pdfFiles: ['Exposé.pdf'],
    });
    expect(result['CLAUDE.md']).toContain('Talstr 10');
    expect(result['CLAUDE.md']).toContain('00_briefing.md');
    expect(result['CLAUDE.md']).toContain('00_quickcheck-transkript.md');
    expect(result['CLAUDE.md']).toContain('Exposé.pdf');
  });

  it('00_briefing.md enthält Score, Begründung, Kennzahlen', () => {
    const result = buildWorkspaceFiles({
      address: 'Y',
      score: 78,
      reason: 'Bestand MFH',
      kennzahlen: { we: 8, wfl: 520, kp: 1050000, eurProM2: 2020, baujahr: 1968 },
      quickCheckTranscript: '',
      pdfFiles: [],
    });
    const br = result['00_briefing.md'];
    expect(br).toContain('Score:** 78');
    expect(br).toContain('Bestand MFH');
    expect(br).toContain('Einheiten: 8 WE');
    expect(br).toContain('Wohnfläche: 520 m²');
    expect(br).toContain('1.050.000');
    expect(br).toContain('€/m²: 2020');
    expect(br).toContain('Baujahr: 1968');
  });

  it('Score null wird als "pending" angezeigt', () => {
    const result = buildWorkspaceFiles({
      address: 'Z',
      score: null,
      reason: null,
      kennzahlen: {},
      quickCheckTranscript: '',
      pdfFiles: [],
    });
    expect(result['00_briefing.md']).toContain('Score:** pending');
  });

  it('Leeres Transkript bekommt Fallback-Text', () => {
    const result = buildWorkspaceFiles({
      address: 'A',
      score: null,
      reason: null,
      kennzahlen: {},
      quickCheckTranscript: '',
      pdfFiles: [],
    });
    expect(result['00_quickcheck-transkript.md']).toContain('Keine QuickCheck-Daten');
  });
});
