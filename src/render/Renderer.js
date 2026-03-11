import { Application, Container } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';

export default class Renderer {
  constructor(container) {
    this._containerEl = container;
    this.app = null;
    this.layers = {};
  }

  async init() {
    this.app = new Application();
    await this.app.init({
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: 0x000000,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this._containerEl.prepend(this.app.canvas);

    // Create render layers (bottom to top)
    this.layers.maze = new Container();
    this.layers.pellets = new Container();
    this.layers.entities = new Container();
    this.layers.effects = new Container();
    this.layers.hud = new Container();

    this.app.stage.addChild(
      this.layers.maze,
      this.layers.pellets,
      this.layers.entities,
      this.layers.effects,
      this.layers.hud
    );

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const maxW = Math.min(window.innerWidth - 24, 560);
    const maxH = window.innerHeight * 0.85;
    const aspect = GAME_WIDTH / GAME_HEIGHT;

    let w, h;
    if (maxW / maxH > aspect) {
      h = maxH;
      w = h * aspect;
    } else {
      w = maxW;
      h = w / aspect;
    }

    // Clamp to reasonable max
    w = Math.min(w, 560);
    h = w / aspect;

    this.app.renderer.resize(w, h);
    this.app.stage.scale.set(w / GAME_WIDTH, h / GAME_HEIGHT);
    this.scale = w / GAME_WIDTH;

    // Update container size
    this._containerEl.style.width = w + 'px';
    this._containerEl.style.height = h + 'px';
  }

  getLayer(name) {
    return this.layers[name];
  }

  destroy() {
    this.app.destroy(true);
  }
}
