import { v4 as uuid } from 'uuid';
import { createSession } from '../_lib/kv.js';
import { getWalletFromRequest, handleCors } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const wallet = getWalletFromRequest(req);
  if (!wallet) return res.status(401).json({ error: 'Unauthorized' });

  const sessionId = uuid();
  const session = {
    wallet,
    startedAt: Date.now(),
    submitted: false,
  };

  await createSession(sessionId, session);

  return res.status(200).json({ sessionId });
}
