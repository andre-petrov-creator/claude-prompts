import { graphClient } from '../../akquise/_lib/msGraphClient';

export const runtime = 'nodejs';
export const maxDuration = 30;

async function handle(req: Request) {
  const expected = process.env.MS_GRAPH_WEBHOOK_CLIENT_STATE;
  if (!expected) {
    return new Response('Server misconfigured', { status: 500 });
  }

  // Akzeptiere zwei Auth-Pfade:
  //  1. Vercel-Cron sendet x-vercel-cron-Header (kein Bearer-Token verfügbar)
  //  2. Manueller Aufruf (z.B. Setup-Skript) sendet Bearer = MS_GRAPH_WEBHOOK_CLIENT_STATE
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

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
