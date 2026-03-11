import { getNonce, deleteNonce, getPlayer, setPlayer } from '../_lib/kv.js';
import { verifySignature, createToken, handleCors } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { wallet, signature } = req.body || {};
  if (!wallet || !signature) {
    return res.status(400).json({ error: 'Missing wallet or signature' });
  }

  // Get stored nonce
  const nonce = await getNonce(wallet);
  if (!nonce) {
    return res.status(401).json({ error: 'No challenge found. Request a new one.' });
  }

  // Verify the signature
  const message = `Sign this message to authenticate with $PACMAN arcade.\n\nNonce: ${nonce}`;
  const valid = verifySignature(wallet, message, signature);

  if (!valid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Clean up nonce
  await deleteNonce(wallet);

  // Create or get player profile
  let player = await getPlayer(wallet);
  const isNew = !player;

  if (isNew) {
    player = {
      wallet,
      nickname: '',
      bestScore: 0,
      totalGames: 0,
      createdAt: Date.now(),
    };
    await setPlayer(wallet, player);
  }

  // Issue JWT
  const token = createToken(wallet);

  return res.status(200).json({
    token,
    player,
    isNew,
  });
}
