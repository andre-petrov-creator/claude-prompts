import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractAddress } from '../../app/api/akquise/_lib/extractAddress';

describe('extractAddress', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Regex-First: klare Adresse im Mailtext', async () => {
    const result = await extractAddress({
      text: 'Objekt: Talstraße 10, 44137 Dortmund. Bestand MFH mit 8 WE.',
      pdfText: '',
    });
    expect(result.address).toBe('Talstraße 10, 44137 Dortmund');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.source).toBe('regex');
  });

  it('Regex-First: Adresse im PDF-Text statt Mailtext', async () => {
    const result = await extractAddress({
      text: 'Siehe Anhang.',
      pdfText: 'Lage: Rüttenscheider Str. 78, 45131 Essen',
    });
    expect(result.address).toMatch(/Rüttenscheider/);
    expect(result.address).toMatch(/45131 Essen/);
    expect(result.source).toBe('regex');
  });

  it('Regex-First: Bochumer Str. 12, 44866 Bochum', async () => {
    const result = await extractAddress({
      text: 'Objekt-Daten: Bochumer Straße 12, 44866 Bochum, gepflegtes Haus',
      pdfText: '',
    });
    expect(result.source).toBe('regex');
    expect(result.address).toContain('44866 Bochum');
  });

  it('Fallback null wenn weder Regex noch ANTHROPIC_API_KEY verfügbar', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const result = await extractAddress({
      text: 'Es geht um ein wirklich tolles Objekt mit super Lage.',
      pdfText: '',
    });
    expect(result.address).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.source).toBe('fallback');
  });

  it('Confidence aus Regex ist 0.85', async () => {
    const result = await extractAddress({
      text: 'Lage: Mozartweg 3, 45657 Recklinghausen',
      pdfText: '',
    });
    expect(result.confidence).toBe(0.85);
  });
});
