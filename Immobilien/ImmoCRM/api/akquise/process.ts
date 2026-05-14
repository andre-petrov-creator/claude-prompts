import { fetchMail, fetchAttachments } from '../_lib/fetchMail';
import { parseEmail } from '../_lib/parseEmail';
import { classifyPdf, type PdfType } from '../_lib/classifyPdf';
import { extractAddress } from '../_lib/extractAddress';
import { extractContact } from '../_lib/extractContact';
import { quickCheck } from '../_lib/quickCheck';
import { uploadFiles } from '../_lib/uploadOneDrive';
import { buildWorkspaceFiles } from '../_lib/writeWorkspace';
import { insertLead } from '../_lib/insertLead';
import { resolveLink } from '../_lib/resolveLink';
import { supabaseAdmin } from '../../src/lib/supabaseAdmin';
import { PDFParse } from 'pdf-parse';

interface ClassifiedFile {
  name: string;
  buffer: Buffer;
  contentType: string;
  type: PdfType;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const expected = process.env.MS_GRAPH_WEBHOOK_CLIENT_STATE;
  if (!expected || req.headers.get('authorization') !== `Bearer ${expected}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { messageId, graphMessageId } = (await req.json()) as {
    messageId: string;
    graphMessageId: string;
  };
  const supa = supabaseAdmin();

  await supa
    .from('mail_queue')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('message_id', messageId);

  try {
    const [graphMail, graphAttachments] = await Promise.all([
      fetchMail(graphMessageId),
      fetchAttachments(graphMessageId),
    ]);
    const mail = parseEmail(graphMail, graphAttachments);

    const linkAttachments: Array<{ name: string; buffer: Buffer; contentType: string }> = [];
    for (const link of mail.links) {
      const resolved = await resolveLink(link);
      if (resolved) linkAttachments.push({ ...resolved, contentType: 'application/pdf' });
    }
    const allFiles = [...mail.attachments, ...linkAttachments];

    let fullPdfText = '';
    const classifiedFiles: ClassifiedFile[] = [];
    for (const file of allFiles) {
      if (file.contentType.includes('pdf')) {
        try {
          const text = await extractPdfText(file.buffer);
          fullPdfText += `\n\n=== ${file.name} ===\n${text}`;
          classifiedFiles.push({
            ...file,
            type: classifyPdf({ filename: file.name, text }),
          });
        } catch {
          classifiedFiles.push({ ...file, type: 'sonstiges' });
        }
      } else {
        classifiedFiles.push({ ...file, type: 'sonstiges' });
      }
    }

    const addressResult = await extractAddress({ text: mail.text, pdfText: fullPdfText });
    const contact = extractContact(mail);
    const qcResult = await quickCheck({
      address: addressResult.address,
      pdfText: fullPdfText,
      mailText: mail.text,
    });

    const address = addressResult.address || `_unbekannt_${Date.now()}`;

    const workspaceFiles = buildWorkspaceFiles({
      address,
      score: qcResult.score,
      reason: qcResult.reason,
      kennzahlen: qcResult.kennzahlen,
      quickCheckTranscript: qcResult.transcript,
      pdfFiles: classifiedFiles.map((f) => f.name),
    });

    const uploadInput = [
      ...classifiedFiles.map((f) => ({ name: f.name, buffer: f.buffer, contentType: f.contentType })),
      {
        name: '_meta.json',
        buffer: Buffer.from(
          JSON.stringify(
            {
              messageId,
              graphMessageId,
              subject: mail.subject,
              from: mail.from,
              date: mail.date,
              addressConfidence: addressResult.confidence,
              addressSource: addressResult.source,
              score: qcResult.score,
              files: classifiedFiles.map((f) => ({ name: f.name, type: f.type, size: f.buffer.length })),
            },
            null,
            2,
          ),
        ),
        contentType: 'application/json',
      },
      ...Object.entries(workspaceFiles).map(([name, content]) => ({
        name,
        buffer: Buffer.from(content),
        contentType:
          name.endsWith('.json') || name.endsWith('.code-workspace')
            ? 'application/json'
            : 'text/markdown',
      })),
    ];

    const upload = await uploadFiles({ addressFolder: address, files: uploadInput });

    const exposeFile = classifiedFiles.find((f) => f.type === 'expose');
    const lead = await insertLead({
      contact,
      deal: {
        address: addressResult.address,
        workspacePath: upload.localPath,
        onedriveWebUrl: upload.webUrl,
        expose_url: exposeFile ? `${upload.webUrl}/${exposeFile.name}` : null,
        inboxMessageId: messageId,
        inReplyTo: mail.inReplyTo,
        priorityScore: qcResult.score,
        priorityReason: qcResult.reason,
        newFilenames: classifiedFiles.map((f) => f.name),
      },
    });

    await supa
      .from('mail_queue')
      .update({
        status: 'done',
        done_at: new Date().toISOString(),
        deal_id: lead.dealId,
      })
      .eq('message_id', messageId);

    return Response.json({
      ok: true,
      dealId: lead.dealId,
      contactId: lead.contactId,
      matchKind: lead.matchKind,
      groupingKind: lead.groupingKind,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supa
      .from('mail_queue')
      .update({ status: 'error', error_msg: msg })
      .eq('message_id', messageId);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
