import jwt from 'jsonwebtoken';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const JWT_SECRET = process.env.JWT_SECRET || 'pacman-dev-secret-change-me';
const JWT_EXPIRY = '24h';

// Verify an Ed25519 signature from a Solana wallet
export function verifySignature(walletAddress, message, signatureBase58) {
  try {
    const publicKey = bs58.decode(walletAddress);
    const signature = bs58.decode(signatureBase58);
    const messageBytes = new TextEncoder().encode(message);
    return nacl.sign.detached.verify(messageBytes, signature, publicKey);
  } catch {
    return false;
  }
}

// Create a JWT for an authenticated wallet
export function createToken(walletAddress) {
  return jwt.sign({ wallet: walletAddress }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

// Verify JWT and return wallet address
export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.wallet;
  } catch {
    return null;
  }
}

// Extract token from Authorization header
export function getWalletFromRequest(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
}

// CORS headers helper
export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}

// Handle OPTIONS preflight
export function handleCors(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
