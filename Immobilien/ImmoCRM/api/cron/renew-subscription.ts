import { graphClient } from '../_lib/msGraphClient.js';

async function handle(req: Request) {
  const expected = process.env.MS_GRAPH_WEBHOOK_CLIENT_STATE;
  if (!expected) {
    return new Response('Server misconfigured', { status: 500 });
  }

  const isVercelCron = req.headers.get('x-vercel-cron') !== null;
  const hasBearer = req.headers.get('authorization') === `Bearer ${expected}`;
  if (!isVercelCron && !hasBearer) {
    return new Response('Unauthorized', { status: 401 });
  }

  const client = await graphClient();
  const subs = await client.api('/subscriptions').get();

  const newExpiry = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const renewed: string[] = [];

  for (const sub of subs.value || []) {
    if (sub.notificationUrl?.includes('/api/akquise/webhook')) {
      await client.api(`/subscriptions/${sub.id}`).patch({ expirationDateTime: newExpiry });
      renewed.push(sub.id);
    }
  }

  return Response.json({ ok: true, renewed });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'GET' || req.method === 'POST') {
    return handle(req);
  }
  return new Response('Method Not Allowed', { status: 405 });
}
