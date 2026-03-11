import { getWalletFromRequest, handleCors } from './_lib/auth.js';
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method === 'GET') {
    // Get referral stats for a wallet
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });

    try {
      const count = await kv.scard(`ref:${wallet}`) || 0;
      const code = wallet.slice(0, 8).toUpperCase();
      return res.json({ code, referrals: count });
    } catch {
      return res.json({ code: wallet.slice(0, 8).toUpperCase(), referrals: 0 });
    }
  }

  if (req.method === 'POST') {
    // Record a referral: authenticated user was referred by someone
    const walletAddr = getWalletFromRequest(req);
    if (!walletAddr) return res.status(401).json({ error: 'unauthorized' });

    const { referrerCode } = req.body || {};
    if (!referrerCode || typeof referrerCode !== 'string') {
      return res.status(400).json({ error: 'referrerCode required' });
    }

    try {
      // Check if user already has a referrer
      const existing = await kv.get(`ref:user:${walletAddr}`);
      if (existing) return res.json({ ok: true, already: true });

      // Find referrer by code prefix match (code = first 8 chars of wallet)
      // Store the referral
      await kv.set(`ref:user:${walletAddr}`, referrerCode);
      // Add to referrer's set (using code as key since we don't have full wallet)
      await kv.sadd(`ref:code:${referrerCode}`, walletAddr);

      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: 'failed' });
    }
  }

  return res.status(405).json({ error: 'method not allowed' });
}
