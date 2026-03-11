import { Graphics } from 'pixi.js';
import { TILE, DOT_RADIUS, PILL_RADIUS, COLORS } from '../config/constants.js';

export default class PelletRenderer {
  constructor(layer) {
    this._layer = layer;
    this._dots = new Graphics();
    this._pills = new Graphics();
    this._pillGlow = new Graphics();
    this._layer.addChild(this._pillGlow);
    this._layer.addChild(this._dots);
    this._layer.addChild(this._pills);
    this._time = 0;
  }

  draw(map) {
    this._map = map;
    this._redraw();
  }

  _redraw() {
    this._dots.clear();
    this._pills.clear();
    this._pillGlow.clear();

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
  }

  update(dt) {
    this._time += dt;
    if (this._map) this._redraw();
  }
}
