import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const validationToken = typeof req.query.validationToken === 'string'
    ? req.query.validationToken
    : Array.isArray(req.query.validationToken)
      ? req.query.validationToken[0]
      : undefined;

  if (validationToken) {
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(validationToken);
    return;
  }

  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send('OK');
}
