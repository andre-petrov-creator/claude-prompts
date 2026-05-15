import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchMail, fetchAttachments } from '../_lib/fetchMail.js';
import { parseEmail } from '../_lib/parseEmail.js';
import { resolveLink } from '../_lib/resolveLink.js';
import { uploadFiles } from '../_lib/uploadOneDrive.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

function sanitizeMessageId(id: string): string {
  return id.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const expected = process.env.MS_GRAPH_WEBHOOK_CLIENT_STATE;
  if (!expected || req.headers.authorization !== `Bearer ${expected}`) {
    res.status(401).send('Unauthorized');
    return;
  }

  const { messageId, graphMessageId } = (req.body ?? {}) as {
    messageId?: string;
    graphMessageId?: string;
  };
  if (!messageId || !graphMessageId) {
    res.status(400).json({ error: 'messageId and graphMessageId required' });
    return;
  }

  const supa = supabaseAdmin();

  await supa
    .from('mail_queue')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('message_id', messageId);

  let step = 'init';
  try {
    step = 'fetchMail+Attachments';
    const [graphMail, graphAttachments] = await Promise.all([
      fetchMail(graphMessageId),
      fetchAttachments(graphMessageId),
    ]);
    step = 'parseEmail';
    const mail = parseEmail(graphMail, graphAttachments);

    step = 'resolveLinks';
    const linkAttachments: Array<{ name: string; buffer: Buffer; contentType: string }> = [];
    for (const link of mail.links) {
      const resolved = await resolveLink(link);
      if (resolved) linkAttachments.push({ ...resolved, contentType: 'application/pdf' });
    }
    const allFiles = [...mail.attachments, ...linkAttachments];

    const inboxFolder = sanitizeMessageId(messageId);

    const meta = {
      messageId,
      graphMessageId,
      subject: mail.subject,
      from: mail.from,
      to: mail.to,
      date: mail.date,
      inReplyTo: mail.inReplyTo,
      text: mail.text,
      links: mail.links,
      files: allFiles.map((f) => ({ name: f.name, size: f.buffer.length, contentType: f.contentType })),
      schemaVersion: 1,
    };

    const trigger = {
      messageId,
      enqueuedAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    const uploadInput = [
      ...allFiles,
      ...(mail.text
        ? [{
            name: 'body.txt',
            buffer: Buffer.from(mail.text, 'utf8'),
            contentType: 'text/plain; charset=utf-8',
          }]
        : []),
      {
        name: '_meta.json',
        buffer: Buffer.from(JSON.stringify(meta, null, 2)),
        contentType: 'application/json',
      },
      {
        name: '.trigger',
        buffer: Buffer.from(JSON.stringify(trigger, null, 2)),
        contentType: 'application/json',
      },
    ];

    step = 'uploadFiles';
    const upload = await uploadFiles({ folderName: inboxFolder, files: uploadInput });

    step = 'supabaseUpdate-done';
    await supa
      .from('mail_queue')
      .update({
        status: 'ready_for_quickcheck',
        done_at: null,
      })
      .eq('message_id', messageId);

    res.status(200).json({
      ok: true,
      inboxFolder,
      webUrl: upload.webUrl,
      localPath: upload.localPath,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error && err.stack ? err.stack.slice(0, 1500) : '';
    console.error(`process error at step=${step}`, msg, '\n', stack);
    await supa
      .from('mail_queue')
      .update({ status: 'error', error_msg: `[step=${step}] ${msg}` + (stack ? '\n--- stack ---\n' + stack : '') })
      .eq('message_id', messageId);
    res.status(500).json({ ok: false, error: msg, step });
  }
}
