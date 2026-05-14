export interface WorkspaceInput {
  address: string;
  score: number | null;
  reason: string | null;
  kennzahlen: {
    we?: number;
    wfl?: number;
    kp?: number;
    eurProM2?: number;
    baujahr?: number;
  };
  quickCheckTranscript: string;
  pdfFiles: string[];
}

export function buildWorkspaceFiles(input: WorkspaceInput): Record<string, string> {
  const workspace = JSON.stringify(
    {
      folders: [{ path: '.' }],
      settings: {
        'terminal.integrated.defaultProfile.windows': 'PowerShell',
      },
      tasks: {
        version: '2.0.0',
        tasks: [
          {
            label: 'Claude Code starten',
            type: 'shell',
            command: 'claude',
            windows: { command: 'claude' },
            presentation: { reveal: 'always', panel: 'new', focus: true },
            runOptions: { runOn: 'folderOpen' },
            problemMatcher: [],
          },
        ],
      },
    },
    null,
    2,
  );

  const claudeMd = `# Objekt-Workspace — ${input.address}

Du arbeitest jetzt im Aufteiler-Vorbereitungs-Workspace für dieses Objekt.

## Kontext lesen (Pflicht beim Start)

1. \`00_briefing.md\` — Zusammenfassung Score + Kennzahlen
2. \`00_quickcheck-transkript.md\` — komplette Pipeline-Analyse

## Verfügbare Dokumente

${input.pdfFiles.map((f) => `- ${f}`).join('\n')}

## Typischer nächster Schritt

Aufteiler-Vollanalyse starten (Slash-Command \`/aufteiler\` mit Adresse "${input.address}").
`;

  const briefingLines = [
    `# ${input.address}`,
    '',
    `**Pre-Screening-Score:** ${input.score ?? 'pending'}`,
  ];
  if (input.reason) briefingLines.push(`**Begründung:** ${input.reason}`);
  briefingLines.push('');
  briefingLines.push('## Kennzahlen');
  briefingLines.push('');
  if (input.kennzahlen.we !== undefined) briefingLines.push(`- Einheiten: ${input.kennzahlen.we} WE`);
  if (input.kennzahlen.wfl !== undefined) briefingLines.push(`- Wohnfläche: ${input.kennzahlen.wfl} m²`);
  if (input.kennzahlen.kp !== undefined) briefingLines.push(`- Kaufpreis: ${input.kennzahlen.kp.toLocaleString('de-DE')} €`);
  if (input.kennzahlen.eurProM2 !== undefined) briefingLines.push(`- €/m²: ${input.kennzahlen.eurProM2}`);
  if (input.kennzahlen.baujahr !== undefined) briefingLines.push(`- Baujahr: ${input.kennzahlen.baujahr}`);
  briefingLines.push('');
  briefingLines.push('## Anhänge');
  briefingLines.push('');
  for (const f of input.pdfFiles) briefingLines.push(`- [${f}](./${f})`);
  const briefing = briefingLines.join('\n') + '\n';

  return {
    'objekt.code-workspace': workspace,
    'CLAUDE.md': claudeMd,
    '00_briefing.md': briefing,
    '00_quickcheck-transkript.md': input.quickCheckTranscript || '_Keine QuickCheck-Daten verfügbar._\n',
  };
}
