import { DIR } from '../config/constants.js';

const KEY_MAP = {
  ArrowUp: DIR.UP,
  ArrowDown: DIR.DOWN,
  ArrowLeft: DIR.LEFT,
  ArrowRight: DIR.RIGHT,
  w: DIR.UP,
  s: DIR.DOWN,
  a: DIR.LEFT,
  d: DIR.RIGHT
};

export default class Input {
  constructor() {
    this._keys = {};
    this._lastDirection = null;
    this._directionBuffer = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('touchstart', this._onTouchStart, { passive: false });
    window.addEventListener('touchend', this._onTouchEnd, { passive: false });
  }

  _onKeyDown(e) {
    const dir = KEY_MAP[e.key];
    if (dir) {
      e.preventDefault();
      this._keys[e.key] = true;
      this._lastDirection = dir;
      this._directionBuffer = dir;
    }
  }

  _onKeyUp(e) {
    this._keys[e.key] = false;
  }

  _onTouchStart(e) {
    const t = e.touches[0];
    this._touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
  }

  _onTouchEnd(e) {
    if (!this._touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - this._touchStart.x;
    const dy = t.clientY - this._touchStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const elapsed = Date.now() - this._touchStart.time;
    this._touchStart = null;

    // Need minimum 20px swipe within 500ms
    if (dist < 20 || elapsed > 500) return;
    e.preventDefault();

    let dir;
    if (Math.abs(dx) > Math.abs(dy)) {
      dir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
    } else {
      dir = dy > 0 ? DIR.DOWN : DIR.UP;
    }
    this._lastDirection = dir;
    this._directionBuffer = dir;
  }

  // Returns the most recently pressed direction
  getDirection() {
    // Check currently held keys (most recent press wins)
    if (this._directionBuffer) {
      const dir = this._directionBuffer;
      this._directionBuffer = null;
      return dir;
    }

    // Fall back to currently held key
    for (const [key, held] of Object.entries(this._keys)) {
      if (held && KEY_MAP[key]) return KEY_MAP[key];
    }

    return this._lastDirection;
  }

  // Check if any direction key is currently held
  isAnyDirectionHeld() {
    for (const [key, held] of Object.entries(this._keys)) {
      if (held && KEY_MAP[key]) return true;
    }
    return false;
  }

  isKeyDown(key) {
    return !!this._keys[key];
  }

  clear() {
    this._keys = {};
    this._lastDirection = null;
    this._directionBuffer = null;
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('touchstart', this._onTouchStart);
    window.removeEventListener('touchend', this._onTouchEnd);
  }
}
