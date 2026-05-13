import { describe, it, expect, vi, afterEach } from 'vitest';
import { quickCheck } from '../../app/api/akquise/_lib/quickCheck';

describe('quickCheck', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('liefert null-Score wenn kein API-Key gesetzt', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const result = await quickCheck({
      address: 'Talstr 10, Dortmund',
      pdfText: '',
      mailText: '',
    });
    expect(result.score).toBeNull();
    expect(result.reason).toContain('kein API-Key');
  });

  it('extrahiert Kennzahlen aus PDF-Text', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const result = await quickCheck({
      address: null,
      pdfText: '8 WE, Wohnfläche 520 m², Kaufpreis 1.050.000 €, Baujahr 1968',
      mailText: '',
    });
    expect(result.kennzahlen.we).toBe(8);
    expect(result.kennzahlen.wfl).toBe(520);
    expect(result.kennzahlen.kp).toBe(1050000);
    expect(result.kennzahlen.eurProM2).toBe(Math.round(1050000 / 520));
    expect(result.kennzahlen.baujahr).toBe(1968);
  });
});
