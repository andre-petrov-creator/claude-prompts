import { graphClient, getMailbox } from './msGraphClient';

export interface GraphMail {
  id: string;
  internetMessageId: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  toRecipients: Array<{ emailAddress: { name?: string; address: string } }>;
  receivedDateTime: string;
  body: { contentType: 'html' | 'text'; content: string };
  hasAttachments: boolean;
  inReplyTo?: string;
}

export interface GraphAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes: string;
}

export async function fetchMail(messageId: string): Promise<GraphMail> {
  const client = await graphClient();
  const mailbox = getMailbox();
  return client.api(`/users/${mailbox}/messages/${messageId}`).get();
}

export async function fetchAttachments(messageId: string): Promise<GraphAttachment[]> {
  const client = await graphClient();
  const mailbox = getMailbox();
  const res = await client.api(`/users/${mailbox}/messages/${messageId}/attachments`).get();
  return res.value || [];
}
