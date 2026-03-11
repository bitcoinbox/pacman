import { getReplay, getPlayer } from './_lib/kv.js';
import { handleCors } from './_lib/auth.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const wallet = req.query.wallet;
  if (!wallet) {
    return res.status(400).json({ error: 'Missing wallet parameter' });
  }

  try {
    const replay = await getReplay(wallet);
    if (!replay) {
      return res.status(404).json({ error: 'No replay found' });
    }

    const player = await getPlayer(wallet);

    return res.status(200).json({
      wallet,
      nickname: player?.nickname || '',
      bestScore: player?.bestScore || 0,
      replay: typeof replay === 'string' ? replay : JSON.stringify(replay),
    });
  } catch {
    return res.status(500).json({ error: 'Failed to load replay' });
  }
}
