import { getPlayer, setPlayer } from './_lib/kv.js';
import { getWalletFromRequest, handleCors } from './_lib/auth.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  // GET — public profile by wallet query param
  if (req.method === 'GET') {
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: 'Missing wallet param' });

    const player = await getPlayer(wallet);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    return res.status(200).json({ player });
  }

  // POST — update nickname (auth required)
  if (req.method === 'POST') {
    const wallet = getWalletFromRequest(req);
    if (!wallet) return res.status(401).json({ error: 'Unauthorized' });

    const { nickname } = req.body || {};
    if (!nickname || typeof nickname !== 'string') {
      return res.status(400).json({ error: 'Invalid nickname' });
    }

    // Sanitize: alphanumeric + spaces + underscores, 2-16 chars
    const clean = nickname.replace(/[^a-zA-Z0-9_ ]/g, '').trim().slice(0, 16);
    if (clean.length < 2) {
      return res.status(400).json({ error: 'Nickname must be 2-16 characters (letters, numbers, underscores)' });
    }

    await setPlayer(wallet, { nickname: clean });
    const player = await getPlayer(wallet);

    return res.status(200).json({ player });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
