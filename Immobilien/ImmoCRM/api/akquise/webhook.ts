import { fetchMail } from '../_lib/fetchMail.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

function getValidationToken(rawUrl: string): string | null {
  const qIdx = rawUrl.indexOf('?');
  if (qIdx === -1) return null;
  const query = rawUrl.slice(qIdx + 1);
  const params = new URLSearchParams(query);
  return params.get('validationToken');
}

export default async function handler(req: Request): Promise<Response> {
  const validationToken = getValidationToken(req.url || '');
  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  if (req.method === 'GET') {
    return new Response('Missing validationToken', { status: 400 });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  interface GraphNotification {
    subscriptionId?: string;
    changeType?: string;
    resource?: string;
    resourceData?: { id?: string };
    clientState?: string;
  }
  const body = (await req.json()) as { value?: GraphNotification[] };
  if (!Array.isArray(body.value)) {
    return new Response('Invalid payload', { status: 400 });
  }

  const supa = supabaseAdmin();
  const expectedClientState = process.env.MS_GRAPH_WEBHOOK_CLIENT_STATE;
  if (!expectedClientState) {
    console.error('MS_GRAPH_WEBHOOK_CLIENT_STATE not configured');
    return new Response('Server misconfigured', { status: 500 });
  }

  for (const notification of body.value) {
    if (notification.clientState !== expectedClientState) {
      console.warn('Unauthorized webhook notification (clientState mismatch)');
      continue;
    }
    if (notification.changeType !== 'created') continue;

    const graphMessageId = notification.resourceData?.id;
    if (!graphMessageId) continue;

    let mail;
    try {
      mail = await fetchMail(graphMessageId);
    } catch (err: any) {
      console.error('fetchMail failed for', graphMessageId, err?.message);
      continue;
    }

    const messageId = mail.internetMessageId;
    if (!messageId) {
      console.warn('Mail without internetMessageId:', graphMessageId);
      continue;
    }

    const { error } = await supa.from('mail_queue').insert({
      message_id: messageId,
      graph_message_id: graphMessageId,
      status: 'pending',
    });

    if (error) {
      if (error.code === '23505') continue;
      console.error('mail_queue insert failed:', error);
      continue;
    }

    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.SITE_URL;
    if (base) {
      fetch(`${base}/api/akquise/process`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${expectedClientState}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ messageId, graphMessageId }),
      }).catch((err) => {
        console.error('Stage-worker fire-and-forget failed:', err?.message);
      });
    }
  }

  return Response.json({ ok: true });
}
