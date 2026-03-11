import { getDailyChallenge, submitDailyChallenge, getDailyStreak } from './_lib/kv.js';
import { getWalletFromRequest, handleCors } from './_lib/auth.js';

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method === 'GET') {
    const dateStr = req.query.date || getTodayStr();
    const wallet = req.query.wallet || null;

    let challenge;
    try {
      challenge = await getDailyChallenge(dateStr);
    } catch {
      return res.status(200).json({ challenge: null, streak: 0, error: 'KV not available' });
    }

    let streak = 0;
    if (wallet) {
      try {
        streak = await getDailyStreak(wallet);
      } catch {}
    }

    return res.status(200).json({ challenge, streak });
  }

  if (req.method === 'POST') {
    const wallet = getWalletFromRequest(req);
    if (!wallet) return res.status(401).json({ error: 'Unauthorized' });

    const { score } = req.body || {};
    if (typeof score !== 'number' || score < 0) {
      return res.status(400).json({ error: 'Invalid score' });
    }

    const dateStr = getTodayStr();

    try {
      const result = await submitDailyChallenge(wallet, dateStr, Math.floor(score));

      if (result.alreadyCompleted) {
        return res.status(200).json({
          accepted: false,
          reason: 'Already completed today\'s challenge',
          streak: result.streak,
        });
      }

      return res.status(200).json({
        accepted: true,
        streak: result.streak,
        date: dateStr,
      });
    } catch {
      return res.status(500).json({ error: 'Failed to submit daily challenge' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
