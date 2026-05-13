import { describe, it, expect } from 'vitest';
import { classifyMatch } from '../../app/api/akquise/_lib/duplicateMatch';

describe('classifyMatch', () => {
  it('Hard-Match bei exakter Email', () => {
    expect(
      classifyMatch({
        newContact: { email: 'h.mueller@immo.de', name: 'Hans Müller' },
        existing: [{ email: 'h.mueller@immo.de', name: 'H. Müller' }],
      }),
    ).toEqual({ kind: 'hard', existingIndex: 0 });
  });

  it('Hard-Match case-insensitive + Trim', () => {
    expect(
      classifyMatch({
        newContact: { email: '  H.Mueller@Immo.DE  ', name: 'x' },
        existing: [{ email: 'h.mueller@immo.de', name: 'y' }],
      }),
    ).toEqual({ kind: 'hard', existingIndex: 0 });
  });

  it('Soft-Match bei Name-Ähnlichkeit ohne Email-Match', () => {
    expect(
      classifyMatch({
        newContact: { email: 'neue@anders.de', name: 'Hans Müller' },
        existing: [{ email: 'alt@anders.de', name: 'H. Mueller' }],
      }),
    ).toEqual({ kind: 'soft', existingIndex: 0 });
  });

  it('No-Match bei unbekanntem Kontakt', () => {
    expect(
      classifyMatch({
        newContact: { email: 'x@y.de', name: 'Frau Neumann' },
        existing: [{ email: 'a@b.de', name: 'Herr Schulz' }],
      }),
    ).toEqual({ kind: 'none' });
  });

  it('Email-Match hat Vorrang vor Name-Match', () => {
    expect(
      classifyMatch({
        newContact: { email: 'matching@email.de', name: 'Anderer Nachname' },
        existing: [
          { email: 'matching@email.de', name: 'X' },
          { email: 'x@y.de', name: 'Anderer' },
        ],
      }),
    ).toEqual({ kind: 'hard', existingIndex: 0 });
  });

  it('Leere Existing-Liste → No-Match', () => {
    expect(
      classifyMatch({
        newContact: { email: 'x@y.de', name: 'X' },
        existing: [],
      }),
    ).toEqual({ kind: 'none' });
  });
});
