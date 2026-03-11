import { Text, TextStyle, Container } from 'pixi.js';

const FLOAT_SPEED = 80;   // pixels per second upward
const FADE_TIME = 1.0;    // seconds
const POOL_MAX = 16;

const style = new TextStyle({
  fontFamily: 'Press Start 2P',
  fontSize: 14,
  fill: 0xFFFFFF,
});

export default class ScorePopup {
  constructor(layer) {
    this._layer = layer;
    this._active = [];
    this._pool = [];
  }

  show(x, y, text, color = 0xFFFFFF) {
    const txt = this._acquire();
    txt.text = String(text);
    txt.style.fill = color;
    txt.x = x;
    txt.y = y;
    txt.alpha = 1;
    txt.anchor.set(0.5);
    txt.visible = true;

    this._layer.addChild(txt);
    this._active.push({ txt, elapsed: 0 });
  }

  update(dt) {
    for (let i = this._active.length - 1; i >= 0; i--) {
      const entry = this._active[i];
      entry.elapsed += dt;

      const t = entry.elapsed / FADE_TIME;
      entry.txt.y -= FLOAT_SPEED * dt;
      entry.txt.alpha = Math.max(0, 1 - t);

      // Slight scale bump at start
      const scale = t < 0.15 ? 1 + (1 - t / 0.15) * 0.3 : 1;
      entry.txt.scale.set(scale);

      if (t >= 1) {
        this._release(entry.txt);
        this._active.splice(i, 1);
      }
    }
  }

  _acquire() {
    if (this._pool.length > 0) {
      return this._pool.pop();
    }
    return new Text({ text: '', style: style.clone() });
  }

  _release(txt) {
    txt.visible = false;
    this._layer.removeChild(txt);

    if (this._pool.length < POOL_MAX) {
      this._pool.push(txt);
    } else {
      txt.destroy();
    }
  }

  clear() {
    for (const entry of this._active) {
      this._release(entry.txt);
    }
    this._active.length = 0;
  }

  destroy() {
    this.clear();
    for (const txt of this._pool) {
      txt.destroy();
    }
    this._pool.length = 0;
  }
}
