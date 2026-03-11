// Replays recorded inputs — drop-in replacement for Input during playback
export default class ReplayInput {
  constructor(replayData) {
    this._inputs = replayData.i;  // [[tick, dir], ...]
    this._totalTicks = replayData.t;
    this._tick = 0;
    this._idx = 0;
    this._currentDir = null;
    this.captureTouch = false;
    this.done = false;
  }

  getDirection() {
    // Check if any inputs fire this tick
    while (this._idx < this._inputs.length && this._inputs[this._idx][0] <= this._tick) {
      const dir = this._inputs[this._idx][1];
      this._currentDir = dir === 'n' ? null : dir;
      this._idx++;
    }
    this._tick++;

    if (this._tick >= this._totalTicks) {
      this.done = true;
    }

    return this._currentDir;
  }

  getProgress() {
    return this._totalTicks > 0 ? this._tick / this._totalTicks : 0;
  }

  isAnyDirectionHeld() {
    return this._currentDir !== null;
  }

  isKeyDown() { return false; }
  clear() {}
  destroy() {}
}
