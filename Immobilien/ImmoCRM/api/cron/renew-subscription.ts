import type { VercelRequest, VercelResponse } from '@vercel/node';
import { graphClient, getMailbox } from '../_lib/msGraphClient.js';

const FOLDER_NAME = 'CRM-Eingang';
// Microsoft erlaubt für Mailbox-Subscriptions maximal 4230 Minuten (~70.5h).
// 4200 Minuten = 30 Min Puffer, damit Anlegen nicht knapp an der Grenze scheitert.
const SAFE_EXPIRY_MINUTES = 4200;

async function findFolderId(client: any, mailbox: string): Promise<string> {
  const top = await client
    .api(`/users/${mailbox}/mailFolders`)
    .filter(`displayName eq '${FOLDER_NAME}'`)
    .top(10)
    .get();
  if (top.value?.length) return top.value[0].id;

  const all = await client.api(`/users/${mailbox}/mailFolders`).top(50).get();
  for (const parent of all.value || []) {
    if (!parent.childFolderCount) continue;
    const children = await client
      .api(`/users/${mailbox}/mailFolders/${parent.id}/childFolders`)
      .filter(`displayName eq '${FOLDER_NAME}'`)
      .top(10)
      .get();
    if (children.value?.length) return children.value[0].id;
  }
  throw new Error(`Folder "${FOLDER_NAME}" not found in mailbox ${mailbox}`);
}

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

  try {
    const client = await graphClient();
    const mailbox = getMailbox();
    const webhookUrl = `${process.env.WEBHOOK_BASE_URL || 'https://immo-crm-xi.vercel.app'}/api/akquise/webhook`;

    const subs = await client.api('/subscriptions').get();
    const now = Date.now();
    const ourSubs = (subs.value || []).filter(
      (s: any) =>
        s.notificationUrl?.includes('/api/akquise/webhook') &&
        new Date(s.expirationDateTime).getTime() > now,
    );

    const newExpiry = new Date(now + SAFE_EXPIRY_MINUTES * 60 * 1000).toISOString();
    const renewed: string[] = [];
    const patchFailures: { id: string; error: string }[] = [];

    for (const sub of ourSubs) {
      try {
        await client.api(`/subscriptions/${sub.id}`).patch({ expirationDateTime: newExpiry });
        renewed.push(sub.id);
      } catch (err) {
        patchFailures.push({ id: sub.id, error: err instanceof Error ? err.message : String(err) });
      }
    }

    if (renewed.length === 0) {
      const folderId = await findFolderId(client, mailbox);
      const created = await client.api('/subscriptions').post({
        changeType: 'created',
        notificationUrl: webhookUrl,
        resource: `/users/${mailbox}/mailFolders('${folderId}')/messages`,
        expirationDateTime: newExpiry,
        clientState: expected,
      });
      console.log(
        `[renew-subscription] no active subscription, created new: ${created.id} (patchFailures=${patchFailures.length})`,
      );
      res.status(200).json({
        ok: true,
        action: 'created',
        subscriptionId: created.id,
        expiration: created.expirationDateTime,
        patchFailures,
      });
      return;
    }

    console.log(`[renew-subscription] renewed ${renewed.length} subscription(s) until ${newExpiry}`);
    res.status(200).json({ ok: true, action: 'renewed', renewed, expiration: newExpiry, patchFailures });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[renew-subscription] FAILED:', msg);
    res.status(500).json({ ok: false, error: msg });
  }
}
