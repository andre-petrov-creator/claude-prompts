import { describe, it, expect } from 'vitest';
import { detectPosition } from '../../api/_lib/positionHeuristic';

describe('detectPosition', () => {
  it('Default = Makler bei neutraler Signatur', () => {
    expect(
      detectPosition({
        signature: 'Mit freundlichen Grüßen\nHans Schmidt\nMüller Immobilien',
        name: 'Hans Schmidt',
        companyName: 'Müller Immobilien GmbH',
      }),
    ).toBe('Makler');
  });

  it('GF in Signatur → Geschäftsführer', () => {
    expect(
      detectPosition({
        signature: 'H. Müller\nGeschäftsführer\nMüller Immo',
        name: 'H. Müller',
        companyName: 'Müller Immo',
      }),
    ).toBe('Geschäftsführer');
  });

  it('GF-Abkürzung erkannt', () => {
    expect(
      detectPosition({
        signature: 'GF, Tel 0231/...',
        name: 'X',
        companyName: 'Y',
      }),
    ).toBe('Geschäftsführer');
  });

  it('Inhaber-Erkennung bei Name == Firmenname', () => {
    expect(
      detectPosition({
        signature: '',
        name: 'Hans Müller',
        companyName: 'Müller Immobilien',
      }),
    ).toBe('Inhaber');
  });

  it('Inhaber-Erkennung mit Levenshtein-Toleranz (Maier vs. Mayer)', () => {
    expect(
      detectPosition({
        signature: '',
        name: 'Klaus Maier',
        companyName: 'Mayer Immo GmbH',
      }),
    ).toBe('Inhaber');
  });

  it('Owner/Inhaber-Keyword in Signatur', () => {
    expect(
      detectPosition({
        signature: 'Inhaber & Eigentümer',
        name: 'Schmidt',
        companyName: 'Beispiel-Firma',
      }),
    ).toBe('Inhaber');
  });

  it('Englisches "founder" in Signatur', () => {
    expect(
      detectPosition({
        signature: 'Founder & CEO',
        name: 'X',
        companyName: 'Y',
      }),
    ).toBe('Inhaber');
  });
});
