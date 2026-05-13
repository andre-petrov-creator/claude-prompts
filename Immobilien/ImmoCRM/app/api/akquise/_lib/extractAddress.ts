import Anthropic from '@anthropic-ai/sdk';

export interface AddressResult {
  address: string | null;
  confidence: number;
  source: 'regex' | 'llm' | 'fallback';
}

const STREET_RE = /\b([A-ZÄÖÜ][a-zäöüß.\-]+(?:\s+(?:straße|str\.?|allee|weg|gasse|platz|ring)|(?:straße|str\.?|allee|weg|gasse|platz|ring)))\s+(\d+[a-z]?)\b/i;
const CITY_RE = /\b(\d{5})\s+([A-ZÄÖÜ][a-zäöüß\-]+(?:\s+[A-ZÄÖÜ][a-zäöüß\-]+)*)\b/;

export async function extractAddress(input: { text: string; pdfText: string }): Promise<AddressResult> {
  const blob = `${input.text}\n${input.pdfText}`;

  const street = blob.match(STREET_RE);
  const city = blob.match(CITY_RE);

  if (street && city) {
    return {
      address: `${street[1]} ${street[2]}, ${city[1]} ${city[2]}`,
      confidence: 0.85,
      source: 'regex',
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { address: null, confidence: 0, source: 'fallback' };
  }

  const client = new Anthropic();
  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system:
      'Du extrahierst Immobilien-Adressen aus deutschem Text. Antworte ausschließlich im JSON-Format {"address": string|null, "confidence": number}. Keine Erklärung.',
    messages: [
      {
        role: 'user',
        content: `Extrahiere die Objekt-Adresse:\n\n${blob.slice(0, 4000)}`,
      },
    ],
  });

  const content = resp.content[0];
  if (content.type !== 'text') {
    return { address: null, confidence: 0, source: 'fallback' };
  }

  try {
    const parsed = JSON.parse(content.text);
    return {
      address: parsed.address,
      confidence: parsed.confidence ?? 0.5,
      source: 'llm',
    };
  } catch {
    return { address: null, confidence: 0, source: 'fallback' };
  }
}
