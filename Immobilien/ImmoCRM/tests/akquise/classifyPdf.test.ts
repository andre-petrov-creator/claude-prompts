import { describe, it, expect } from 'vitest';
import { classifyPdf } from '../../app/api/akquise/_lib/classifyPdf';

describe('classifyPdf', () => {
  it('erkennt Exposé per Filename mit/ohne Akzent', () => {
    expect(classifyPdf({ filename: 'Expose_Talstr_10.pdf', text: '' })).toBe('expose');
    expect(classifyPdf({ filename: 'Exposé.pdf', text: '' })).toBe('expose');
    expect(classifyPdf({ filename: 'EXPOSE-MFH.pdf', text: '' })).toBe('expose');
  });

  it('erkennt Mieterliste in mehreren Schreibweisen', () => {
    expect(classifyPdf({ filename: 'Mieterliste.pdf', text: '' })).toBe('mieterliste');
    expect(classifyPdf({ filename: 'mietaufstellung.pdf', text: '' })).toBe('mieterliste');
  });

  it('erkennt Energieausweis', () => {
    expect(classifyPdf({ filename: 'energieausweis.pdf', text: '' })).toBe('energie');
    expect(classifyPdf({ filename: 'Energiepass-2024.pdf', text: '' })).toBe('energie');
  });

  it('Fallback per Inhalt wenn Filename neutral', () => {
    expect(
      classifyPdf({
        filename: 'anhang.pdf',
        text: 'Endenergiebedarf 145 kWh/(m²·a) Energieeffizienzklasse D',
      }),
    ).toBe('energie');
    expect(
      classifyPdf({
        filename: 'dokument.pdf',
        text: 'Wohnfläche ca. 520 m². Kaufpreis 1.050.000 EUR. Baujahr 1968.',
      }),
    ).toBe('expose');
  });

  it('sonstiges als Default bei keinem Match', () => {
    expect(classifyPdf({ filename: 'random.pdf', text: 'lorem ipsum dolor sit amet' })).toBe('sonstiges');
  });

  it('erkennt Modernisierung + Grundriss per Filename', () => {
    expect(classifyPdf({ filename: 'sanierungskonzept.pdf', text: '' })).toBe('modernisierung');
    expect(classifyPdf({ filename: 'Grundriss-EG.pdf', text: '' })).toBe('grundriss');
  });
});
