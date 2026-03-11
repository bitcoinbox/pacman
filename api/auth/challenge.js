import { v4 as uuid } from 'uuid';
import { setNonce } from '../_lib/kv.js';
import { handleCors } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { wallet } = req.body || {};
  if (!wallet || typeof wallet !== 'string' || wallet.length < 32 || wallet.length > 44) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const nonce = uuid();
  const message = `Sign this message to authenticate with $PACMAN arcade.\n\nNonce: ${nonce}`;

  await setNonce(wallet, nonce);

  return res.status(200).json({ message, nonce });
}
