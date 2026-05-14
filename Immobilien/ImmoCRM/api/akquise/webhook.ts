import { fetchMail } from '../_lib/fetchMail.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

interface GraphNotification {
  subscriptionId?: string;
  changeType?: string;
  resource?: string;
  resourceData?: { id?: string };
  clientState?: string;
}

function extractValidationToken(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  const m = rawUrl.match(/[?&]validationToken=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default async function handler(req: Request): Promise<Response> {
  const validationToken = extractValidationToken(req.url);
  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  if (req.method !== 'POST') {
    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  let body: { value?: GraphNotification[] };
  try {
    body = (await req.json()) as { value?: GraphNotification[] };
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!Array.isArray(body.value)) {
    return new Response('Invalid payload', { status: 400 });
  }

  const expectedClientState = process.env.MS_GRAPH_WEBHOOK_CLIENT_STATE;
  if (!expectedClientState) {
    return new Response('Server misconfigured', { status: 500 });
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

  return Response.json({ ok: true });
}
