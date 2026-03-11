import { Howl } from 'howler';

const SOUNDS = {
  intro:      { src: '/audio/intro.mp3', volume: 0.6 },
  dot:        { src: '/audio/dot.mp3', volume: 0.15 },
  eat:        { src: '/audio/eat.mp3', volume: 0.5 },
  eaten:      { src: '/audio/eaten.mp3', volume: 0.6 },
  frightened: { src: '/audio/frightened.mp3', volume: 0.4, loop: true },
  dead:       { src: '/audio/dead.mp3', volume: 0.6 },
  bonus:      { src: '/audio/bonus.mp3', volume: 0.5 },
  life:       { src: '/audio/life.mp3', volume: 0.5 },
  back:       { src: '/audio/back.mp3', volume: 0.3, loop: true },
};

export default class Audio {
  constructor() {
    this._sounds = {};
    this._muted = false;
    this._loaded = false;
  }

  load() {
    if (this._loaded) return;
    this._loaded = true;

    for (const [key, cfg] of Object.entries(SOUNDS)) {
      this._sounds[key] = new Howl({
        src: [cfg.src],
        volume: cfg.volume,
        loop: cfg.loop || false,
        preload: true,
      });
    }
  }

  play(name) {
    if (this._muted) return;
    const sound = this._sounds[name];
    if (!sound) return;
    // For short SFX, just play. For loops, only play if not already playing
    if (sound._loop && sound.playing()) return;
    sound.play();
  }

  stop(name) {
    const sound = this._sounds[name];
    if (sound) sound.stop();
  }

  stopAll() {
    for (const sound of Object.values(this._sounds)) {
      sound.stop();
    }
  }

  pauseAll() {
    for (const sound of Object.values(this._sounds)) {
      if (sound.playing()) sound.pause();
    }
  }

  resumeAll() {
    for (const sound of Object.values(this._sounds)) {
      if (sound._loop && sound.seek() > 0) sound.play();
    }
  }

  toggle() {
    this._muted = !this._muted;
    if (this._muted) this.stopAll();
    return this._muted;
  }

  get muted() {
    return this._muted;
  }
}
