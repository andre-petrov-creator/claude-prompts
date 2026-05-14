export type Position = 'Makler' | 'Geschäftsführer' | 'Inhaber';

export function detectPosition(input: {
  signature: string;
  name: string;
  companyName: string;
}): Position {
  const sig = input.signature.toLowerCase();

  if (/\b(gf|geschäftsführer|geschaeftsfuehrer|managing director)\b/.test(sig)) {
    return 'Geschäftsführer';
  }
  if (/\b(inhaber|owner|gründer|gruender|founder)\b/.test(sig)) {
    return 'Inhaber';
  }

  const lastName = input.name.trim().split(/\s+/).pop()?.toLowerCase() || '';
  const companyTokens = input.companyName
    .toLowerCase()
    .replace(/(gmbh|kg|ag|ohg|gbr|immobilien|immo|gruppe|holding|consulting|partners?)\b\.?/g, '')
    .trim()
    .split(/\s+/);

  for (const token of companyTokens) {
    if (token.length >= 3 && levenshtein(lastName, token) <= 1) {
      return 'Inhaber';
    }
  }

  return 'Makler';
}

function levenshtein(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}
