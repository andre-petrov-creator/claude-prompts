import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';

const GRAPH_SCOPES = ['https://graph.microsoft.com/.default'];

let cachedToken: { value: string; expiresAt: number } | null = null;
let cachedApp: ConfidentialClientApplication | null = null;

function getMsalApp(): ConfidentialClientApplication {
  if (cachedApp) return cachedApp;
  cachedApp = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MS_GRAPH_CLIENT_ID!,
      clientSecret: process.env.MS_GRAPH_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.MS_GRAPH_TENANT_ID}`,
    },
  });
  return cachedApp;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const result = await getMsalApp().acquireTokenByClientCredential({
    scopes: GRAPH_SCOPES,
  });

  if (!result?.accessToken) {
    throw new Error('Microsoft Graph token acquisition failed');
  }

  cachedToken = {
    value: result.accessToken,
    expiresAt: result.expiresOn?.getTime() ?? Date.now() + 50 * 60 * 1000,
  };
  return cachedToken.value;
}

export async function graphClient(): Promise<Client> {
  const token = await getAccessToken();
  return Client.init({ authProvider: (done) => done(null, token) });
}

export function getMailbox(): string {
  const mailbox = process.env.MS_GRAPH_MAILBOX_EMAIL;
  if (!mailbox) {
    throw new Error('MS_GRAPH_MAILBOX_EMAIL not set');
  }
  return mailbox;
}
