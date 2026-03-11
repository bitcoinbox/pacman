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

// ── Daily Challenges ────────────────────────────────

const CHALLENGE_TYPES = [
  { type: 'target_score', label: 'Target Score', description: 'Reach the target score' },
  { type: 'speed_run', label: 'Speed Run', description: 'Complete the level before time runs out' },
  { type: 'ghost_hunter', label: 'Ghost Hunter', description: 'Eat the required number of ghosts' },
  { type: 'dot_collector', label: 'Dot Collector', description: 'Eat all dots without dying' },
];

const SPECIAL_RULES = [
  null,                   // no special rule
  'no_power_pills',      // power pills disabled
  'speed_mode',          // everything moves faster
  'no_power_pills',
  null,
  'speed_mode',
  null,
];

// Simple deterministic hash from a string → integer
function seedFromDate(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// Seeded pseudo-random (returns 0-1 float, advances seed)
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateChallenge(dateStr) {
  const seed = seedFromDate(dateStr);
  const typeIndex = seed % CHALLENGE_TYPES.length;
  const challenge = { ...CHALLENGE_TYPES[typeIndex] };

  const r1 = seededRandom(seed + 1);
  const r2 = seededRandom(seed + 2);

  switch (challenge.type) {
    case 'target_score':
      // Target between 5000-25000, rounded to nearest 500
      challenge.target = Math.round((5000 + r1 * 20000) / 500) * 500;
      break;
    case 'speed_run':
      // Time limit between 60-180 seconds
      challenge.timeLimitSeconds = Math.round(60 + r1 * 120);
      break;
    case 'ghost_hunter':
      // Eat between 8-24 ghosts
      challenge.target = Math.round(8 + r1 * 16);
      break;
    case 'dot_collector':
      // No extra params — eat all dots without dying
      break;
  }

  // Maze index 0-3
  challenge.mazeIndex = Math.floor(r2 * 4);

  // Special rule based on day
  const ruleIndex = seed % SPECIAL_RULES.length;
  challenge.specialRule = SPECIAL_RULES[ruleIndex];

  challenge.date = dateStr;
  return challenge;
}

export async function getDailyChallenge(dateStr) {
  const key = `daily:${dateStr}`;
  const cached = await kv.get(key);
  if (cached) {
    return typeof cached === 'string' ? JSON.parse(cached) : cached;
  }

  const challenge = generateChallenge(dateStr);
  // Cache for 48 hours
  await kv.set(key, JSON.stringify(challenge), { ex: 172800 });
  return challenge;
}

export async function submitDailyChallenge(wallet, dateStr, score) {
  const challenge = await getDailyChallenge(dateStr);
  const completionKey = `daily:done:${dateStr}:${wallet}`;

  // Check if already completed
  const already = await kv.get(completionKey);
  if (already) {
    return { alreadyCompleted: true, streak: await getDailyStreak(wallet) };
  }

  // Mark as completed (expires in 48h)
  await kv.set(completionKey, JSON.stringify({ score, completedAt: Date.now() }), { ex: 172800 });

  // Update streak
  const streakKey = `daily:streak:${wallet}`;
  const streakData = await kv.get(streakKey);
  const streak = streakData
    ? (typeof streakData === 'string' ? JSON.parse(streakData) : streakData)
    : { count: 0, lastDate: null };

  // Check if yesterday was the last completion (streak continues)
  const yesterday = getDateStr(new Date(new Date(dateStr + 'T00:00:00Z').getTime() - 86400000));
  if (streak.lastDate === yesterday) {
    streak.count += 1;
  } else if (streak.lastDate === dateStr) {
    // Same day, no change
  } else {
    // Streak broken, start fresh
    streak.count = 1;
  }
  streak.lastDate = dateStr;

  await kv.set(streakKey, JSON.stringify(streak));
  return { alreadyCompleted: false, streak: streak.count };
}

export async function getDailyStreak(wallet) {
  const streakKey = `daily:streak:${wallet}`;
  const streakData = await kv.get(streakKey);
  if (!streakData) return 0;
  const streak = typeof streakData === 'string' ? JSON.parse(streakData) : streakData;

  // Check if streak is still active (last completion was today or yesterday)
  const today = getDateStr(new Date());
  const yesterday = getDateStr(new Date(Date.now() - 86400000));
  if (streak.lastDate !== today && streak.lastDate !== yesterday) {
    return 0; // Streak expired
  }
  return streak.count;
}

function getDateStr(date) {
  return date.toISOString().split('T')[0];
}
