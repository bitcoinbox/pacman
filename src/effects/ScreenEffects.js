import { Graphics, Container } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';

export default class ScreenEffects {
  constructor(stage, effectsLayer) {
    this._stage = stage;         // the app.stage we shake
    this._layer = effectsLayer;  // container for overlays

    // Flash overlay
    this._flashGfx = new Graphics();
    this._flashGfx.visible = false;
    this._layer.addChild(this._flashGfx);

    // Vignette/glow overlay
    this._glowGfx = new Graphics();
    this._glowGfx.visible = false;
    this._layer.addChild(this._glowGfx);

    // State
    this._shake = null;
    this._flash = null;
    this._slowMo = null;
    this._glow = null;

    // Time scale readable by other systems
    this.timeScale = 1;

    // Remember original stage position
    this._stageOrigin = { x: stage.x, y: stage.y };
  }

  shake(intensity = 4, duration = 0.3) {
    this._shake = { intensity, duration, elapsed: 0 };
  }

  flash(color = 0xFFFFFF, duration = 0.2) {
    this._flashGfx.clear();
    this._flashGfx.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this._flashGfx.fill({ color, alpha: 1 });
    this._flashGfx.visible = true;
    this._flash = { duration, elapsed: 0 };
  }

  slowMotion(factor = 0.3, duration = 0.5) {
    this._slowMo = { factor, duration, elapsed: 0 };
    this.timeScale = factor;
  }

  pulseGlow(intensity = 0.3) {
    this._glow = { intensity, phase: 0 };
    this._glowGfx.visible = true;
  }

  stopGlow() {
    this._glow = null;
    this._glowGfx.visible = false;
  }

  update(dt) {
    // --- Shake ---
    if (this._shake) {
      this._shake.elapsed += dt;
      const t = this._shake.elapsed / this._shake.duration;

      if (t >= 1) {
        this._stage.x = this._stageOrigin.x;
        this._stage.y = this._stageOrigin.y;
        this._shake = null;
      } else {
        const decay = 1 - t;
        const mag = this._shake.intensity * decay;
        this._stage.x = this._stageOrigin.x + (Math.random() * 2 - 1) * mag;
        this._stage.y = this._stageOrigin.y + (Math.random() * 2 - 1) * mag;
      }
    }

    // --- Flash ---
    if (this._flash) {
      this._flash.elapsed += dt;
      const t = this._flash.elapsed / this._flash.duration;

      if (t >= 1) {
        this._flashGfx.visible = false;
        this._flash = null;
      } else {
        this._flashGfx.alpha = 1 - t;
      }
    }

    // --- Slow motion ---
    if (this._slowMo) {
      this._slowMo.elapsed += dt;
      const t = this._slowMo.elapsed / this._slowMo.duration;

      if (t >= 1) {
        this.timeScale = 1;
        this._slowMo = null;
      } else {
        // Ease back to 1.0 in the last 40%
        if (t > 0.6) {
          const easeT = (t - 0.6) / 0.4;
          this.timeScale = this._slowMo.factor + (1 - this._slowMo.factor) * easeT;
        }
      }
    }

    // --- Glow/vignette pulse ---
    if (this._glow) {
      this._glow.phase += dt * 3;
      const pulse = (Math.sin(this._glow.phase) * 0.5 + 0.5) * this._glow.intensity;

      this._glowGfx.clear();
      // Dark vignette edges
      this._glowGfx.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      this._glowGfx.fill({ color: 0x000000, alpha: pulse * 0.4 });
    }
  }

  destroy() {
    this._flashGfx.destroy();
    this._glowGfx.destroy();
    // Reset stage position
    if (this._shake) {
      this._stage.x = this._stageOrigin.x;
      this._stage.y = this._stageOrigin.y;
    }
  }
}
