import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchMail } from '../_lib/fetchMail.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

interface GraphNotification {
  subscriptionId?: string;
  changeType?: string;
  resource?: string;
  resourceData?: { id?: string };
  clientState?: string;
}

function readValidationToken(req: VercelRequest): string | null {
  const raw = req.query.validationToken;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const validationToken = readValidationToken(req);
  if (validationToken) {
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(validationToken);
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send('OK');
    return;
  }

  const body = req.body as { value?: GraphNotification[] } | undefined;
  if (!body || !Array.isArray(body.value)) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  const expectedClientState = process.env.MS_GRAPH_WEBHOOK_CLIENT_STATE;
  if (!expectedClientState) {
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  const supa = supabaseAdmin();

  for (const notification of body.value) {
    if (notification.clientState !== expectedClientState) continue;
    if (notification.changeType !== 'created') continue;

    const graphMessageId = notification.resourceData?.id;
    if (!graphMessageId) continue;

    let mail;
    try {
      mail = await fetchMail(graphMessageId);
    } catch (err) {
      console.error('fetchMail failed', graphMessageId, (err as Error)?.message);
      continue;
    }

    const messageId = mail.internetMessageId;
    if (!messageId) continue;

    const { error } = await supa.from('mail_queue').insert({
      message_id: messageId,
      graph_message_id: graphMessageId,
      status: 'pending',
    });

    if (error) {
      if (error.code === '23505') continue;
      console.error('mail_queue insert failed', error);
      continue;
    }

    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.SITE_URL;
    if (base) {
      void fetch(`${base}/api/akquise/process`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${expectedClientState}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ messageId, graphMessageId }),
      }).catch((err) => console.error('process trigger failed', (err as Error)?.message));
    }
  }

  res.status(200).json({ ok: true });
}
