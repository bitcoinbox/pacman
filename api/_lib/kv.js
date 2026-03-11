import { kv } from '@vercel/kv';

// ── Player profiles ──────────────────────────────────

export async function getPlayer(wallet) {
  return await kv.hgetall(`player:${wallet}`);
}

export async function setPlayer(wallet, data) {
  await kv.hset(`player:${wallet}`, data);
}

export async function playerExists(wallet) {
  return await kv.exists(`player:${wallet}`);
}

// ── Auth nonces ──────────────────────────────────────

export async function setNonce(wallet, nonce) {
  // Nonce expires in 5 minutes
  await kv.set(`nonce:${wallet}`, nonce, { ex: 300 });
}

export async function getNonce(wallet) {
  return await kv.get(`nonce:${wallet}`);
}

export async function deleteNonce(wallet) {
  await kv.del(`nonce:${wallet}`);
}

// ── Game sessions ────────────────────────────────────

export async function createSession(sessionId, data) {
  // Session expires in 30 minutes
  await kv.set(`session:${sessionId}`, JSON.stringify(data), { ex: 1800 });
}

export async function getSession(sessionId) {
  const data = await kv.get(`session:${sessionId}`);
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

export async function deleteSession(sessionId) {
  await kv.del(`session:${sessionId}`);
}

// ── Leaderboard ──────────────────────────────────────

function getWeekKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((now - jan1) / 86400000 + jan1.getUTCDay() + 1) / 7);
  return `lb:week:${year}-${String(week).padStart(2, '0')}`;
}

export async function submitScore(wallet, score) {
  const allTimeKey = 'lb:alltime';
  const weekKey = getWeekKey();

  // Only update if new score is higher (ZADD with GT flag)
  await kv.zadd(allTimeKey, { gt: true }, { score, member: wallet });
  await kv.zadd(weekKey, { gt: true }, { score, member: wallet });

  // Set weekly key expiry (8 days to cover timezone edge cases)
  await kv.expire(weekKey, 691200);
}

export async function getLeaderboard(period = 'alltime', limit = 20) {
  const key = period === 'weekly' ? getWeekKey() : 'lb:alltime';

  // ZREVRANGE with scores — returns [member, score, member, score, ...]
  const results = await kv.zrange(key, 0, limit - 1, { rev: true, withScores: true });

  // Parse into array of { wallet, score }
  const entries = [];
  for (let i = 0; i < results.length; i += 2) {
    entries.push({ wallet: results[i], score: Number(results[i + 1]) });
  }
  return entries;
}

export async function getPlayerRank(wallet, period = 'alltime') {
  const key = period === 'weekly' ? getWeekKey() : 'lb:alltime';
  const rank = await kv.zrevrank(key, wallet);
  const score = await kv.zscore(key, wallet);
  return { rank: rank !== null ? rank + 1 : null, score: score ? Number(score) : 0 };
}
