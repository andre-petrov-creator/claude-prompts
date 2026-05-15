import { graphClient, getMailbox, getLocalPathPrefix } from './msGraphClient.js';

// BASE muss als Ordnerkette im OneDrive-Mailbox-Drive bereits existieren.
// Pipeline legt nur den inbox-Unterordner an, nicht die Basis-Hierarchie.
// Hartcodiert: ENV-Override war Pre-Pivot-Falle (Folder landete in Objekte/).
const BASE = '/Immobilien/001_AQUISE/_inbox';

export interface UploadInput {
  folderName: string;
  files: Array<{ name: string; buffer: Buffer; contentType: string }>;
}

export interface UploadResult {
  folderPath: string;
  webUrl: string;
  localPath: string;
  uploadedFiles: Array<{ name: string; itemId: string; size: number }>;
}

export async function uploadFiles(input: UploadInput): Promise<UploadResult> {
  const client = await graphClient();
  const mailbox = getMailbox();
  const folder = sanitizeFolderName(input.folderName);
  const folderUrl = `${BASE}/${folder}`;
  const driveRoot = `/users/${mailbox}/drive/root`;

  try {
    await client
      .api(`${driveRoot}:${BASE}:/children`)
      .post({
        name: folder,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      });
  } catch (err: any) {
    if (err?.statusCode !== 409) throw err;
  }

  // Alle Files ueber createUploadSession (auch < 4 MB).
  // Der SDK-direkte .put(buffer)-Pfad zum :/content-Endpoint hatte
  // Content-Type-Quirks ("Unable to read JSON request payload" /
  // "Entity only allows writes with a JSON Content-Type header").
  // createUploadSession + direkter fetch-PUT bypasst das SDK und ist stabil.
  const uploaded: UploadResult['uploadedFiles'] = [];
  for (const file of input.files) {
    const session = await client
      .api(`${driveRoot}:${folderUrl}/${file.name}:/createUploadSession`)
      .post({ '@microsoft.graph.conflictBehavior': 'replace' });
    const res = await fetch(session.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(file.buffer.length),
        'Content-Range': `bytes 0-${file.buffer.length - 1}/${file.buffer.length}`,
      },
      body: new Uint8Array(file.buffer),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Upload failed for ${file.name}: HTTP ${res.status} ${errText}`);
    }
    const item = (await res.json()) as { id: string };
    uploaded.push({ name: file.name, itemId: item.id, size: file.buffer.length });
  }

  const folderItem = await client.api(`${driveRoot}:${folderUrl}`).get();

  return {
    folderPath: folderUrl,
    webUrl: folderItem.webUrl,
    localPath: `${getLocalPathPrefix()}\\${folder}`,
    uploadedFiles: uploaded,
  };
}

function sanitizeFolderName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 200);
}
