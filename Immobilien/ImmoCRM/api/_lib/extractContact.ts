import type { ParsedEmail } from './parseEmail.js';
import { detectPosition, type Position } from './positionHeuristic.js';

export interface ExtractedContact {
  name: string;
  email: string;
  phone: string | null;
  companyName: string;
  position: Position;
  rawSignature: string;
}

export function extractContact(mail: ParsedEmail): ExtractedContact {
  const signature = extractSignature(mail.text);
  const phone = extractPhone(`${signature}\n${mail.text}`);
  const companyName = extractCompany(mail.from.name || '', signature, mail.from.email);
  const name = mail.from.name || mail.from.email.split('@')[0];

  return {
    name,
    email: mail.from.email.toLowerCase().trim(),
    phone,
    companyName,
    position: detectPosition({ signature, name, companyName }),
    rawSignature: signature,
  };
}

function extractSignature(text: string): string {
  const lines = text.split(/\r?\n/);
  const sigStart = lines.findIndex((l) =>
    /^--\s*$|mit freundlichen grüßen|beste grüße|viele grüße/i.test(l),
  );
  if (sigStart === -1) return lines.slice(-10).join('\n');
  return lines.slice(sigStart).join('\n');
}

function extractPhone(text: string): string | null {
  const re =
    /(\+49\s?\d{2,5}[\s\-\/]?\d{3,}[\s\-\/]?\d{2,}|0\d{2,5}[\s\-\/]?\d{3,}[\s\-\/]?\d{2,})/;
  const m = text.match(re);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
}

function extractCompany(fromName: string, signature: string, email: string): string {
  const sigCompany = signature.match(
    /(?:^|\n)\s*([A-ZÄÖÜ][\w\s&\-.]+(?:GmbH|KG|AG|GbR|OHG|Immobilien|Immo)\b\.?)/,
  );
  if (sigCompany) return sigCompany[1].trim();
  if (/GmbH|KG|AG|GbR/.test(fromName)) return fromName.trim();
  const domain = email.split('@')[1]?.split('.')[0] || '';
  return domain;
}
