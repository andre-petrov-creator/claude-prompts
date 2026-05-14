import type { VercelRequest, VercelResponse } from '@vercel/node';
import { graphClient } from '../_lib/msGraphClient.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const expected = process.env.MS_GRAPH_WEBHOOK_CLIENT_STATE;
  if (!expected) {
    res.status(500).send('Server misconfigured');
    return;
  }

  const isVercelCron = typeof req.headers['x-vercel-cron'] === 'string';
  const hasBearer = req.headers.authorization === `Bearer ${expected}`;
  if (!isVercelCron && !hasBearer) {
    res.status(401).send('Unauthorized');
    return;
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

  res.status(200).json({ ok: true, renewed });
}
