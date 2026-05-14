import { graphClient, getMailbox, getLocalPathPrefix } from './msGraphClient.js';

// BASE muss als Ordnerkette im OneDrive-Mailbox-Drive bereits existieren.
// Pipeline legt nur den objektspezifischen Unterordner an, nicht die Basis-Hierarchie.
const BASE = process.env.ONEDRIVE_BASE_PATH || '/Immobilien/001_AQUISE/Objekte';

export interface UploadInput {
  addressFolder: string;
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
  const folder = sanitizeFolderName(input.addressFolder);
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

  const uploaded: UploadResult['uploadedFiles'] = [];
  for (const file of input.files) {
    if (file.buffer.length < 4 * 1024 * 1024) {
      const item = await client
        .api(`${driveRoot}:${folderUrl}/${file.name}:/content`)
        .put(file.buffer);
      uploaded.push({ name: file.name, itemId: item.id, size: file.buffer.length });
    } else {
      const session = await client
        .api(`${driveRoot}:${folderUrl}/${file.name}:/createUploadSession`)
        .post({ '@microsoft.graph.conflictBehavior': 'replace' });
      const res = await fetch(session.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(file.buffer.length),
          'Content-Range': `bytes 0-${file.buffer.length - 1}/${file.buffer.length}`,
        },
        body: file.buffer,
      });
      if (!res.ok) throw new Error(`Upload-Session-PUT failed: ${res.status}`);
      const item = (await res.json()) as { id: string };
      uploaded.push({ name: file.name, itemId: item.id, size: file.buffer.length });
    }
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
