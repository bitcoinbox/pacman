import { Graphics } from 'pixi.js';
import { TILE, DOT_RADIUS, PILL_RADIUS, COLORS } from '../config/constants.js';

const POWERUP_COLORS = {
  speed: 0x00FF88,
  multiplier: 0xFFCC00,
  freeze: 0x00CCFF
};

export default class PelletRenderer {
  constructor(layer) {
    this._layer = layer;
    this._dots = new Graphics();
    this._pills = new Graphics();
    this._pillGlow = new Graphics();
    this._powerUpGfx = new Graphics();
    this._layer.addChild(this._pillGlow);
    this._layer.addChild(this._dots);
    this._layer.addChild(this._pills);
    this._layer.addChild(this._powerUpGfx);
    this._time = 0;
    this._powerUp = null;
  }

  draw(map) {
    this._map = map;
    this._redraw();
  }

  setPowerUp(powerUp) {
    this._powerUp = powerUp;
  }

  _redraw() {
    this._dots.clear();
    this._pills.clear();
    this._pillGlow.clear();
    this._powerUpGfx.clear();

    for (const tile of this._map.tiles) {
      if (!tile.hasItem) continue;
      const cx = tile.col * TILE + TILE / 2;
      const cy = tile.row * TILE + TILE / 2;

      if (tile.code === '.') {
        // Dot with subtle warm glow
        this._dots.circle(cx, cy, DOT_RADIUS + 2);
        this._dots.fill({ color: COLORS.DOT, alpha: 0.06 });
        this._dots.circle(cx, cy, DOT_RADIUS);
        this._dots.fill({ color: COLORS.DOT, alpha: 0.95 });
      }

      if (tile.code === '*') {
        // Pulsing power pill
        const pulse = 1 + 0.25 * Math.sin(this._time * 5);
        const r = PILL_RADIUS * pulse;

        // Outer glow
        this._pillGlow.circle(cx, cy, r + 8);
        this._pillGlow.fill({ color: COLORS.PILL, alpha: 0.04 });
        // Inner glow
        this._pillGlow.circle(cx, cy, r + 4);
        this._pillGlow.fill({ color: COLORS.PILL, alpha: 0.1 });
        // Pill
        this._pills.circle(cx, cy, r);
        this._pills.fill({ color: COLORS.PILL, alpha: 1 });
      }
    }

    // Draw power-up
    if (this._powerUp) {
      const tile = this._powerUp.tile;
      const cx = tile.col * TILE + TILE / 2;
      const cy = tile.row * TILE + TILE / 2;
      const color = POWERUP_COLORS[this._powerUp.type] || 0xFFFFFF;
      const pulse = 1 + 0.3 * Math.sin(this._time * 6);
      const r = 10 * pulse;

      // Glow
      this._powerUpGfx.circle(cx, cy, r + 8);
      this._powerUpGfx.fill({ color, alpha: 0.08 });
      this._powerUpGfx.circle(cx, cy, r + 4);
      this._powerUpGfx.fill({ color, alpha: 0.15 });
      // Core
      this._powerUpGfx.circle(cx, cy, r);
      this._powerUpGfx.fill({ color, alpha: 0.9 });
      // Inner highlight
      this._powerUpGfx.circle(cx - 2, cy - 2, r * 0.4);
      this._powerUpGfx.fill({ color: 0xFFFFFF, alpha: 0.3 });
    }
  }

  update(dt) {
    this._time += dt;
    if (this._map) this._redraw();
  }
}
