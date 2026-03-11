import { getSession, deleteSession, getPlayer, setPlayer, submitScore } from '../_lib/kv.js';
import { getWalletFromRequest, handleCors } from '../_lib/auth.js';

// Anti-cheat constants
const MIN_GAME_DURATION_MS = 5000;    // Game must last at least 5 seconds
const MAX_SCORE_PER_SECOND = 500;     // Max plausible score per second
const MAX_SCORE = 999999;             // Absolute max score cap

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const wallet = getWalletFromRequest(req);
  if (!wallet) return res.status(401).json({ error: 'Unauthorized' });

  const { sessionId, score, level } = req.body || {};

  if (!sessionId || typeof score !== 'number' || score < 0) {
    return res.status(400).json({ error: 'Invalid submission' });
  }

  // Validate session
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(400).json({ error: 'Invalid or expired session' });
  }

  if (session.wallet !== wallet) {
    return res.status(403).json({ error: 'Session does not match wallet' });
  }

  if (session.submitted) {
    return res.status(400).json({ error: 'Score already submitted for this session' });
  }

  // Anti-cheat checks
  const elapsed = Date.now() - session.startedAt;

  if (elapsed < MIN_GAME_DURATION_MS) {
    return res.status(400).json({ error: 'Game too short' });
  }

  const elapsedSeconds = elapsed / 1000;
  if (score > elapsedSeconds * MAX_SCORE_PER_SECOND) {
    return res.status(400).json({ error: 'Score exceeds plausible rate' });
  }

  if (score > MAX_SCORE) {
    return res.status(400).json({ error: 'Score exceeds maximum' });
  }

  const finalScore = Math.floor(score);

  // Mark session as submitted
  session.submitted = true;
  // Don't need to save — just delete it
  await deleteSession(sessionId);

  // Update player stats
  const player = await getPlayer(wallet);
  const updates = {
    totalGames: (player?.totalGames || 0) + 1,
  };
  if (finalScore > (player?.bestScore || 0)) {
    updates.bestScore = finalScore;
  }
  await setPlayer(wallet, updates);

  // Submit to leaderboard
  await submitScore(wallet, finalScore);

  return res.status(200).json({
    accepted: true,
    score: finalScore,
    bestScore: Math.max(finalScore, player?.bestScore || 0),
    totalGames: updates.totalGames,
  });
}
