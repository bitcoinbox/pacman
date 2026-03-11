// Fixed timestep game loop with rAF
const FIXED_DT = 1 / 60; // 60 logic updates per second
const MAX_FRAME_TIME = 0.25; // Cap to prevent spiral of death

export default class Loop {
  constructor(updateFn, renderFn) {
    this._update = updateFn;
    this._render = renderFn;
    this._accumulator = 0;
    this._lastTime = 0;
    this._rafId = null;
    this._running = false;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now() / 1000;
    this._accumulator = 0;
    this._rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _tick(timestamp) {
    if (!this._running) return;

    const now = timestamp / 1000;
    let frameTime = now - this._lastTime;
    this._lastTime = now;

    // Clamp frame time to avoid spiral
    if (frameTime > MAX_FRAME_TIME) frameTime = MAX_FRAME_TIME;

    this._accumulator += frameTime;

    // Fixed timestep updates
    while (this._accumulator >= FIXED_DT) {
      this._update(FIXED_DT);
      this._accumulator -= FIXED_DT;
    }

    // Render with interpolation alpha
    const alpha = this._accumulator / FIXED_DT;
    this._render(alpha);

    this._rafId = requestAnimationFrame(this._tick);
  }

  get dt() { return FIXED_DT; }
}
