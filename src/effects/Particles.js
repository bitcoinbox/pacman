import { Graphics, Container } from 'pixi.js';

// --- Predefined configs ---

export const PARTICLE_DOT_EAT = {
  count: 4,
  color: 0xFFFF00,
  speed: 120,
  life: 0.25,
  size: 2,
  gravity: 0,
  spread: Math.PI * 2,
};

export const PARTICLE_PILL_EAT = {
  count: 8,
  color: 0xFFFFFF,
  speed: 160,
  life: 0.4,
  size: 3.5,
  gravity: 0,
  spread: Math.PI * 2,
};

export const PARTICLE_GHOST_EAT = {
  count: 12,
  color: 0xFF0000, // caller overrides with ghost color
  speed: 200,
  life: 0.5,
  size: 3,
  gravity: 40,
  spread: Math.PI * 2,
};

export const PARTICLE_DEATH = {
  count: 16,
  color: 0xFFFF00,
  speed: 140,
  life: 1.0,
  size: 3,
  gravity: 60,
  spread: Math.PI * 2,
  spiral: true,
};

export const PARTICLE_LEVEL_CLEAR = {
  count: 24,
  color: 0xFFFFFF,
  speed: 80,
  life: 1.5,
  size: 2,
  gravity: 50,
  spread: Math.PI * 0.6,
  rain: true,
};

// --- Burst: a single emission of particles sharing one Graphics ---

class Burst {
  constructor(x, y, config) {
    this.gfx = new Graphics();
    this.particles = [];
    this._dead = false;

    const {
      count = 6,
      color = 0xFFFFFF,
      speed = 100,
      life = 0.5,
      size = 2,
      gravity = 0,
      spread = Math.PI * 2,
      spiral = false,
      rain = false,
    } = config;

    for (let i = 0; i < count; i++) {
      const angle = rain
        ? Math.PI * 0.5 + (Math.random() - 0.5) * spread
        : (spread / count) * i + (Math.random() - 0.5) * 0.3;

      const spd = speed * (0.6 + Math.random() * 0.4);

      this.particles.push({
        x: rain ? Math.random() * 896 : x, // GAME_WIDTH for rain
        y: rain ? -10 : y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life,
        maxLife: life,
        size: size * (0.7 + Math.random() * 0.6),
        color,
        gravity,
        spiral,
        spiralSpeed: spiral ? (Math.random() > 0.5 ? 1 : -1) * (3 + Math.random() * 4) : 0,
      });
    }
  }

  get dead() {
    return this._dead;
  }

  update(dt) {
    let alive = 0;
    this.gfx.clear();

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) continue;

      alive++;

      // Spiral rotation
      if (p.spiral) {
        const cos = Math.cos(p.spiralSpeed * dt);
        const sin = Math.sin(p.spiralSpeed * dt);
        const nvx = p.vx * cos - p.vy * sin;
        const nvy = p.vx * sin + p.vy * cos;
        p.vx = nvx;
        p.vy = nvy;
      }

      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const alpha = Math.max(0, p.life / p.maxLife);
      const scale = 0.5 + 0.5 * alpha; // shrink as they die

      this.gfx.circle(p.x, p.y, p.size * scale);
      this.gfx.fill({ color: p.color, alpha });
    }

    if (alive === 0) {
      this._dead = true;
    }
  }
}

// --- Main particle system ---

export default class Particles {
  constructor(layer) {
    this._layer = layer;
    this._bursts = [];
  }

  emit(x, y, config) {
    const burst = new Burst(x, y, config);
    this._layer.addChild(burst.gfx);
    this._bursts.push(burst);
  }

  update(dt) {
    for (let i = this._bursts.length - 1; i >= 0; i--) {
      const burst = this._bursts[i];
      burst.update(dt);

      if (burst.dead) {
        this._layer.removeChild(burst.gfx);
        burst.gfx.destroy();
        this._bursts.splice(i, 1);
      }
    }
  }

  clear() {
    for (const burst of this._bursts) {
      this._layer.removeChild(burst.gfx);
      burst.gfx.destroy();
    }
    this._bursts.length = 0;
  }

  destroy() {
    this.clear();
  }
}
