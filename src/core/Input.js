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

// Minimum distance (px) finger must move from origin to register a direction
const SWIPE_THRESHOLD = 15;

export default class Input {
  constructor() {
    this._keys = {};
    this._lastDirection = null;
    this._directionBuffer = null;
    this._touchOrigin = null;
    this._touching = false;

    // When true, swipes on the game canvas block page scroll.
    // Game.js sets this to true only during active gameplay.
    this.captureTouch = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('touchstart', this._onTouchStart, { passive: true });
    window.addEventListener('touchmove', this._onTouchMove, { passive: false });
    window.addEventListener('touchend', this._onTouchEnd, { passive: true });
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
    this._touchOrigin = { x: t.clientX, y: t.clientY };
    this._touching = true;
  }

  _onTouchMove(e) {
    if (!this._touchOrigin) return;

    // Only block scroll when the game is actively capturing input
    if (this.captureTouch) {
      e.preventDefault();
    }

    const t = e.touches[0];
    const dx = t.clientX - this._touchOrigin.x;
    const dy = t.clientY - this._touchOrigin.y;

    // Determine direction from origin point
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) return;

    let dir;
    if (absDx > absDy) {
      dir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
    } else {
      dir = dy > 0 ? DIR.DOWN : DIR.UP;
    }

    // Only buffer if direction changed
    if (dir !== this._lastDirection) {
      this._lastDirection = dir;
      this._directionBuffer = dir;
    }

    // Reset origin so next move is relative to current position
    this._touchOrigin = { x: t.clientX, y: t.clientY };
  }

  _onTouchEnd() {
    this._touchOrigin = null;
    this._touching = false;
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
    if (this._touching) return true;
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
    window.removeEventListener('touchmove', this._onTouchMove);
    window.removeEventListener('touchend', this._onTouchEnd);
  }
}
