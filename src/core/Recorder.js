// Records game inputs for replay
export default class Recorder {
  constructor(seed, mazeIndex) {
    this.seed = seed;
    this.mazeIndex = mazeIndex;
    this._tick = 0;
    this._inputs = [];      // [[tick, dir], ...]
    this._lastDir = null;
    this.recording = true;
  }

  // Called each game tick with the direction returned by Input.getDirection()
  tick(dir) {
    if (!this.recording) return;
    if (dir !== this._lastDir) {
      this._inputs.push([this._tick, dir || 'n']);
      this._lastDir = dir;
    }
    this._tick++;
  }

  stop() {
    this.recording = false;
  }

  // Export compact replay data
  toJSON() {
    return {
      v: 1,
      s: this.seed,
      m: this.mazeIndex,
      i: this._inputs,
      t: this._tick,
    };
  }

  // Encode as string for storage
  encode() {
    return JSON.stringify(this.toJSON());
  }
}
