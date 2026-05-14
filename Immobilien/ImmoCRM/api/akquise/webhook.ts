function extractValidationToken(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  const m = rawUrl.match(/[?&]validationToken=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default async function handler(req: Request): Promise<Response> {
  const validationToken = extractValidationToken(req.url);
  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  return new Response('OK', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}
