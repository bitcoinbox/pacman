// Mulberry32 — fast seeded 32-bit PRNG
export default class Rng {
  constructor(seed) {
    this._state = seed | 0;
  }

  // Returns float in [0, 1)
  next() {
    this._state |= 0;
    this._state = (this._state + 0x6D2B79F5) | 0;
    let t = Math.imul(this._state ^ (this._state >>> 15), 1 | this._state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Returns integer in [0, max)
  int(max) {
    return Math.floor(this.next() * max);
  }

  // Pick random element from array
  pick(arr) {
    return arr[this.int(arr.length)];
  }
}
