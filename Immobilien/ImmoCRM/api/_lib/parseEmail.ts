import type { GraphMail, GraphAttachment } from './fetchMail';

export interface ParsedEmail {
  messageId: string;
  graphMessageId: string;
  subject: string;
  from: { name?: string; email: string };
  to: string[];
  date: Date;
  text: string;
  html: string;
  inReplyTo?: string;
  attachments: Array<{ name: string; contentType: string; buffer: Buffer }>;
  links: string[];
}

export function parseEmail(mail: GraphMail, attachments: GraphAttachment[]): ParsedEmail {
  const html = mail.body.contentType === 'html' ? mail.body.content : '';
  const text = mail.body.contentType === 'text' ? mail.body.content : htmlToText(html);
  const links = extractLinks(`${text}\n${html}`);

  return {
    messageId: mail.internetMessageId,
    graphMessageId: mail.id,
    subject: mail.subject || '',
    from: {
      name: mail.from?.emailAddress?.name,
      email: mail.from?.emailAddress?.address || '',
    },
    to: mail.toRecipients?.map((r) => r.emailAddress.address) ?? [],
    date: new Date(mail.receivedDateTime),
    text,
    html,
    inReplyTo: mail.inReplyTo,
    attachments: attachments.map((a) => ({
      name: a.name,
      contentType: a.contentType || 'application/octet-stream',
      buffer: Buffer.from(a.contentBytes, 'base64'),
    })),
    links,
  };
}

function htmlToText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractLinks(content: string): string[] {
  const re = /https?:\/\/[^\s"'<>)]+/g;
  return Array.from(new Set(content.match(re) || []));
}
