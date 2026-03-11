// Simple Solana wallet connector — Phantom & Solflare (no React adapter needed)

export default class Wallet {
  constructor(buttonEl) {
    this.btn = buttonEl;
    this.provider = null;
    this.address = null;
    this._dropdown = null;

    this.btn.addEventListener('click', () => this._handleClick());
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
      // No wallet found — open Phantom install page
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

    // Close on outside click
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
    dd.innerHTML = `
      <div class="wallet-dd-addr">${this.address}</div>
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
      this._updateButton();

      // Listen for disconnect
      this.provider.on('disconnect', () => {
        this.address = null;
        this.provider = null;
        this._updateButton();
      });

      // Listen for account change
      this.provider.on('accountChanged', (pk) => {
        if (pk) {
          this.address = pk.toString();
        } else {
          this.address = null;
          this.provider = null;
        }
        this._updateButton();
      });
    } catch (err) {
      if (err.code !== 4001) { // 4001 = user rejected
        console.warn('Wallet connect failed:', err);
      }
    }
  }

  _disconnect() {
    if (this.provider) {
      this.provider.disconnect();
    }
    this.address = null;
    this.provider = null;
    this._updateButton();
  }

  _updateButton() {
    if (this.address) {
      const short = this.address.slice(0, 4) + '...' + this.address.slice(-4);
      this.btn.textContent = short;
      this.btn.classList.add('connected');
    } else {
      this.btn.textContent = 'CONNECT WALLET';
      this.btn.classList.remove('connected');
    }
  }
}
