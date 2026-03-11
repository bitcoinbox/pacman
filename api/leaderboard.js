import { getLeaderboard, getPlayerRank, getPlayer } from './_lib/kv.js';
import { handleCors } from './_lib/auth.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const period = req.query.period === 'weekly' ? 'weekly' : 'alltime';
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const wallet = req.query.wallet || null;

  let entries;
  try {
    entries = await getLeaderboard(period, limit);
  } catch {
    // KV not configured yet — return empty
    return res.status(200).json({ period, entries: [], myRank: null });
  }

  // Enrich with nicknames
  const enriched = await Promise.all(
    entries.map(async (entry, i) => {
      const player = await getPlayer(entry.wallet);
      return {
        rank: i + 1,
        wallet: entry.wallet,
        nickname: player?.nickname || '',
        score: entry.score,
        hasReplay: !!player?.hasReplay,
      };
    })
  );

  // Get requesting player's rank if wallet provided
  let myRank = null;
  if (wallet) {
    try {
      const rankData = await getPlayerRank(wallet, period);
      const player = await getPlayer(wallet);
      if (rankData.rank !== null) {
        myRank = {
          rank: rankData.rank,
          score: rankData.score,
          nickname: player?.nickname || '',
          wallet,
        };
      }
    } catch {}
  }

  return res.status(200).json({
    period,
    entries: enriched,
    myRank,
  });
}
