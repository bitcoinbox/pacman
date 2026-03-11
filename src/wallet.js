// Wallet connector with signature-based auth — Phantom & Solflare

const API = '/api';

export default class Wallet {
  constructor(buttonEl) {
    this.btn = buttonEl;
    this.provider = null;
    this.address = null;
    this.token = null;       // JWT
    this.player = null;      // { nickname, bestScore, totalGames }
    this._dropdown = null;
    this._onAuth = [];       // callbacks

    this.btn.addEventListener('click', () => this._handleClick());

    // Try to restore session from localStorage
    this._restoreSession();
  }

  // Register callback for auth state changes
  onAuth(fn) {
    this._onAuth.push(fn);
    if (this.token) fn(this.player, this.token);
  }

  _emitAuth() {
    for (const fn of this._onAuth) fn(this.player, this.token);
  }

  _getProviders() {
    const providers = [];
    if (window.phantom?.solana?.isPhantom) {
      providers.push({ name: 'Phantom', provider: window.phantom.solana });
    }
    if (window.solflare?.isSolflare) {
      providers.push({ name: 'Solflare', provider: window.solflare });
    }
    return providers;
  }

  async _handleClick() {
    if (this.address) {
      this._showDisconnectMenu();
      return;
    }

    const providers = this._getProviders();

    if (providers.length === 0) {
      window.open('https://phantom.app/', '_blank');
      return;
    }

    if (providers.length === 1) {
      await this._connect(providers[0]);
    } else {
      this._showProviderPicker(providers);
    }
  }

  _showProviderPicker(providers) {
    this._closeDropdown();
    const dd = document.createElement('div');
    dd.className = 'wallet-dropdown';
    dd.innerHTML = providers.map(p =>
      `<button class="wallet-dd-item" data-name="${p.name}">${p.name}</button>`
    ).join('');

    dd.querySelectorAll('.wallet-dd-item').forEach(item => {
      item.addEventListener('click', () => {
        const p = providers.find(x => x.name === item.dataset.name);
        if (p) this._connect(p);
        this._closeDropdown();
      });
    });

    this.btn.parentElement.style.position = 'relative';
    this.btn.parentElement.appendChild(dd);
    this._dropdown = dd;

    setTimeout(() => {
      this._outsideClick = (e) => {
        if (!dd.contains(e.target) && e.target !== this.btn) {
          this._closeDropdown();
        }
      };
      document.addEventListener('click', this._outsideClick);
    }, 10);
  }

  _showDisconnectMenu() {
    this._closeDropdown();
    const dd = document.createElement('div');
    dd.className = 'wallet-dropdown';

    const nick = this.player?.nickname
      ? `<div class="wallet-dd-nick">${this.player.nickname}</div>`
      : '';
    const best = this.player?.bestScore
      ? `<div class="wallet-dd-stat">BEST: ${this.player.bestScore.toLocaleString()}</div>`
      : '';
    const games = this.player?.totalGames
      ? `<div class="wallet-dd-stat">GAMES: ${this.player.totalGames}</div>`
      : '';

    dd.innerHTML = `
      ${nick}
      <div class="wallet-dd-addr">${this.address}</div>
      ${best}${games}
      <button class="wallet-dd-item disconnect">DISCONNECT</button>
    `;

    dd.querySelector('.disconnect').addEventListener('click', () => {
      this._disconnect();
      this._closeDropdown();
    });

    this.btn.parentElement.style.position = 'relative';
    this.btn.parentElement.appendChild(dd);
    this._dropdown = dd;

    setTimeout(() => {
      this._outsideClick = (e) => {
        if (!dd.contains(e.target) && e.target !== this.btn) {
          this._closeDropdown();
        }
      };
      document.addEventListener('click', this._outsideClick);
    }, 10);
  }

  _closeDropdown() {
    if (this._dropdown) {
      this._dropdown.remove();
      this._dropdown = null;
    }
    if (this._outsideClick) {
      document.removeEventListener('click', this._outsideClick);
      this._outsideClick = null;
    }
  }

  async _connect(entry) {
    try {
      const resp = await entry.provider.connect();
      const pubkey = resp.publicKey.toString();
      this.provider = entry.provider;
      this.address = pubkey;
      this._updateButton('SIGNING...');

      // Authenticate with backend
      await this._authenticate(pubkey);

      this._updateButton();

      // Listen for disconnect
      this.provider.on('disconnect', () => {
        this._clearSession();
        this._updateButton();
      });

      this.provider.on('accountChanged', (pk) => {
        if (pk) {
          this.address = pk.toString();
          this._authenticate(this.address);
        } else {
          this._clearSession();
        }
        this._updateButton();
      });
    } catch (err) {
      if (err.code !== 4001) {
        console.warn('Wallet connect failed:', err);
      }
      this._updateButton();
    }
  }

  async _authenticate(walletAddress) {
    try {
      // 1. Get challenge nonce
      const challengeRes = await fetch(`${API}/auth/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress }),
      });
      const { message } = await challengeRes.json();

      // 2. Sign the message with wallet
      const encoded = new TextEncoder().encode(message);
      const signResult = await this.provider.signMessage(encoded, 'utf8');
      const sigBytes = signResult.signature || signResult;

      // Convert to base58
      const sig58 = this._toBase58(sigBytes);

      // 3. Verify with backend
      const verifyRes = await fetch(`${API}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress, signature: sig58 }),
      });
      const data = await verifyRes.json();

      if (!verifyRes.ok) {
        console.warn('Auth failed:', data.error);
        return;
      }

      this.token = data.token;
      this.player = data.player;

      this._saveSession();
      this._emitAuth();

      // If new player, show nickname modal
      if (data.isNew || !data.player.nickname) {
        this._showNicknameModal();
      }
    } catch (err) {
      if (err.code !== 4001) {
        console.warn('Auth error:', err);
      }
    }
  }

  _toBase58(bytes) {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const arr = Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    let zeros = 0;
    while (zeros < arr.length && arr[zeros] === 0) zeros++;
    const size = Math.ceil(arr.length * 138 / 100) + 1;
    const b58 = new Uint8Array(size);
    for (let i = zeros; i < arr.length; i++) {
      let carry = arr[i];
      for (let j = size - 1; j >= 0; j--) {
        carry += 256 * b58[j];
        b58[j] = carry % 58;
        carry = Math.floor(carry / 58);
      }
    }
    let start = 0;
    while (start < size && b58[start] === 0) start++;
    let result = '1'.repeat(zeros);
    for (let i = start; i < size; i++) result += ALPHABET[b58[i]];
    return result;
  }

  _showNicknameModal() {
    const modal = document.getElementById('nickname-modal');
    if (!modal) return;
    modal.classList.add('active');

    const input = modal.querySelector('.nickname-input');
    const submitBtn = modal.querySelector('.nickname-submit');
    const skipBtn = modal.querySelector('.nickname-skip');
    const errorEl = modal.querySelector('.nickname-error');

    const close = () => modal.classList.remove('active');

    const submit = async () => {
      const name = input.value.trim();
      if (name.length < 2 || name.length > 16) {
        errorEl.textContent = '2-16 characters required';
        return;
      }
      submitBtn.textContent = 'SAVING...';
      try {
        const res = await fetch(`${API}/profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`,
          },
          body: JSON.stringify({ nickname: name }),
        });
        const data = await res.json();
        if (res.ok) {
          this.player = data.player;
          this._saveSession();
          this._updateButton();
          this._emitAuth();
          close();
        } else {
          errorEl.textContent = data.error || 'Failed to save';
        }
      } catch {
        errorEl.textContent = 'Network error';
      }
      submitBtn.textContent = 'SET NAME';
    };

    submitBtn.onclick = submit;
    input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    skipBtn.onclick = close;
  }

  _disconnect() {
    if (this.provider) this.provider.disconnect();
    this._clearSession();
    this._updateButton();
  }

  _clearSession() {
    this.address = null;
    this.provider = null;
    this.token = null;
    this.player = null;
    try { localStorage.removeItem('pacman_session'); } catch {}
    this._emitAuth();
  }

  _saveSession() {
    try {
      localStorage.setItem('pacman_session', JSON.stringify({
        address: this.address,
        token: this.token,
        player: this.player,
      }));
    } catch {}
  }

  _restoreSession() {
    try {
      const saved = JSON.parse(localStorage.getItem('pacman_session'));
      if (saved?.token && saved?.address) {
        this.address = saved.address;
        this.token = saved.token;
        this.player = saved.player;
        this._updateButton();
        this._emitAuth();
      }
    } catch {}
  }

  _updateButton(text) {
    if (text) {
      this.btn.textContent = text;
      return;
    }
    if (this.address) {
      const label = this.player?.nickname || (this.address.slice(0, 4) + '...' + this.address.slice(-4));
      this.btn.textContent = label;
      this.btn.classList.add('connected');
    } else {
      this.btn.textContent = 'CONNECT WALLET';
      this.btn.classList.remove('connected');
    }
  }

  // ── Public API for game integration ──────────────
  isAuthenticated() { return !!this.token; }
  getToken() { return this.token; }
  getAddress() { return this.address; }
  getPlayer() { return this.player; }
}
