import { describe, it, expect } from 'vitest';
import { parseEmail } from '../../api/_lib/parseEmail';
import type { GraphMail, GraphAttachment } from '../../api/_lib/fetchMail';

const PDF_BASE64 = Buffer.from('%PDF-1.4 dummy content').toString('base64');

describe('parseEmail', () => {
  it('extrahiert PDF-Anhänge aus base64', () => {
    const mail: GraphMail = {
      id: 'AAxxx',
      internetMessageId: '<abc@web.de>',
      subject: 'Exposé MFH Dortmund',
      from: { emailAddress: { name: 'Hans Müller', address: 'h.mueller@immo.de' } },
      toRecipients: [{ emailAddress: { address: 'andre-petrov@web.de' } }],
      receivedDateTime: '2026-05-12T10:00:00Z',
      body: { contentType: 'html', content: '<p>Anbei das Exposé</p>' },
      hasAttachments: true,
    };
    const attachments: GraphAttachment[] = [
      { id: 'a1', name: 'Exposé.pdf', contentType: 'application/pdf', size: 100, contentBytes: PDF_BASE64 },
    ];
    const result = parseEmail(mail, attachments);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].name).toBe('Exposé.pdf');
    expect(result.attachments[0].buffer.toString('utf-8')).toContain('PDF-1.4');
  });

  it('extrahiert Links aus HTML-Body', () => {
    const mail: GraphMail = {
      id: 'BBxxx',
      internetMessageId: '<def@web.de>',
      subject: 'Link zum Exposé',
      from: { emailAddress: { name: 'Test', address: 't@x.de' } },
      toRecipients: [{ emailAddress: { address: 'a@b.de' } }],
      receivedDateTime: '2026-05-12T11:00:00Z',
      body: {
        contentType: 'html',
        content: '<p>Siehe <a href="https://immobilienscout24.de/expose/123">hier</a>.</p>',
      },
      hasAttachments: false,
    };
    const result = parseEmail(mail, []);
    expect(result.links).toContain('https://immobilienscout24.de/expose/123');
  });

  it('liefert messageId + from + date', () => {
    const mail: GraphMail = {
      id: 'CCxxx',
      internetMessageId: '<xyz@web.de>',
      subject: 'Test',
      from: { emailAddress: { name: 'Sender', address: 'sender@example.com' } },
      toRecipients: [],
      receivedDateTime: '2026-05-12T12:30:00Z',
      body: { contentType: 'text', content: 'Plain text body' },
      hasAttachments: false,
    };
    const result = parseEmail(mail, []);
    expect(result.messageId).toBe('<xyz@web.de>');
    expect(result.from.email).toBe('sender@example.com');
    expect(result.from.name).toBe('Sender');
    expect(result.date).toEqual(new Date('2026-05-12T12:30:00Z'));
  });

  it('konvertiert HTML zu Text wenn kein text-body da ist', () => {
    const mail: GraphMail = {
      id: 'DDxxx',
      internetMessageId: '<m@x.de>',
      subject: '',
      from: { emailAddress: { name: '', address: 'x@y.de' } },
      toRecipients: [],
      receivedDateTime: '2026-05-12T13:00:00Z',
      body: { contentType: 'html', content: '<h1>Titel</h1><p>Absatz mit <b>fett</b>.</p>' },
      hasAttachments: false,
    };
    const result = parseEmail(mail, []);
    expect(result.text).toContain('Titel');
    expect(result.text).toContain('Absatz mit fett');
    expect(result.text).not.toContain('<h1>');
  });
});
