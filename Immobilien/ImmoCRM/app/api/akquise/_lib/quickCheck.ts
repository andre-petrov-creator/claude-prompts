import Anthropic from '@anthropic-ai/sdk';

export interface QuickCheckInput {
  address: string | null;
  pdfText: string;
  mailText: string;
}

export interface QuickCheckResult {
  score: number | null;
  reason: string;
  transcript: string;
  kennzahlen: {
    we?: number;
    wfl?: number;
    kp?: number;
    eurProM2?: number;
    baujahr?: number;
  };
}

export async function quickCheck(input: QuickCheckInput): Promise<QuickCheckResult> {
  const kennzahlen = extractKennzahlen(input.pdfText);

  if (!process.env.ANTHROPIC_API_KEY || !input.address) {
    return {
      score: null,
      reason: 'QuickCheck konnte nicht ausgeführt werden (kein API-Key oder keine Adresse)',
      transcript: '',
      kennzahlen,
    };
  }

  const client = new Anthropic();
  const blob = input.pdfText.slice(0, 6000);
  const resp = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system:
      'Du bist Akquise-Pre-Screener für MFH-Käufe im Ruhrgebiet. Bewerte ein Exposé nach: Lage, €/m² vs. Marktdurchschnitt, Baujahr, Sanierungsbedarf, Mieterstruktur. Antworte JSON: {"score": 0-100, "reason": "<1 satz>"}. Score-Skala: 70+ = hot, 40-69 = warm, <40 = no.',
    messages: [
      {
        role: 'user',
        content: `Adresse: ${input.address}\n\nExposé-Auszug:\n${blob}`,
      },
    ],
  });

  const content = resp.content[0];
  if (content.type !== 'text') {
    return { score: null, reason: 'Pipeline-Fehler im QuickCheck', transcript: '', kennzahlen };
  }

  const transcript = `# QuickCheck-Transkript\n\n## Input\n\nAdresse: ${input.address}\n\nExposé-Auszug:\n${blob}\n\n## Anthropic-Response\n\n${content.text}\n`;

  try {
    const parsed = JSON.parse(content.text);
    return {
      score: parsed.score,
      reason: parsed.reason,
      transcript,
      kennzahlen,
    };
  } catch {
    return {
      score: 50,
      reason: 'QuickCheck-Antwort nicht parsbar — Score-Platzhalter, manuell prüfen',
      transcript,
      kennzahlen,
    };
  }
}

function extractKennzahlen(text: string): QuickCheckResult['kennzahlen'] {
  const result: QuickCheckResult['kennzahlen'] = {};
  const we = text.match(/(\d+)\s*(?:WE|Wohneinheit|Einheit)/i);
  if (we) result.we = parseInt(we[1]);
  const wfl = text.match(/(?:Wohnfl[äa]che|Wfl\.?)\s*(?:ca\.?\s*)?(\d+[\.,]?\d*)\s*m/i);
  if (wfl) result.wfl = parseFloat(wfl[1].replace(',', '.'));
  const kp = text.match(/(?:Kaufpreis|KP)\s*(?:ca\.?\s*)?([\d.]+)\s*€?/i);
  if (kp) result.kp = parseInt(kp[1].replace(/\./g, ''));
  const baujahr = text.match(/(?:Baujahr|errichtet|erbaut)\s*(?:ca\.?\s*)?(\d{4})/i);
  if (baujahr) result.baujahr = parseInt(baujahr[1]);
  if (result.wfl && result.kp) result.eurProM2 = Math.round(result.kp / result.wfl);
  return result;
}
