export interface MatchInput {
  newContact: { email: string; name: string };
  existing: Array<{ email: string; name: string }>;
}

export type Match =
  | { kind: 'hard'; existingIndex: number }
  | { kind: 'soft'; existingIndex: number }
  | { kind: 'none' };

export function classifyMatch(input: MatchInput): Match {
  const newEmail = input.newContact.email.toLowerCase().trim();
  for (let i = 0; i < input.existing.length; i++) {
    if (input.existing[i].email.toLowerCase().trim() === newEmail) {
      return { kind: 'hard', existingIndex: i };
    }
  }
  const newName = normalize(input.newContact.name);
  for (let i = 0; i < input.existing.length; i++) {
    if (nameSimilar(newName, normalize(input.existing[i].name))) {
      return { kind: 'soft', existingIndex: i };
    }
  }
  return { kind: 'none' };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[äöü]/g, (m) => ({ ä: 'ae', ö: 'oe', ü: 'ue' })[m]!)
    .replace(/[^a-z\s]/g, '')
    .trim();
}

function nameSimilar(a: string, b: string): boolean {
  const aLast = a.split(/\s+/).pop() || '';
  const bLast = b.split(/\s+/).pop() || '';
  return aLast.length >= 3 && aLast === bLast;
}
