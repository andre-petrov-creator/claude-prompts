export async function resolveLink(url: string): Promise<{ name: string; buffer: Buffer } | null> {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/pdf')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const filename = url.split('/').pop()?.split('?')[0] || 'expose.pdf';
    return { name: filename, buffer: buf };
  } catch {
    return null;
  }
}
