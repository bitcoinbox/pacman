import { Graphics } from 'pixi.js';
import { PLAYER_SIZE, GHOST_SIZE, COLORS } from '../config/constants.js';

export default class EntityRenderer {
  constructor(layer) {
    this._layer = layer;
    // Player glow + body
    this._playerGlow = new Graphics();
    this._playerGfx = new Graphics();
    this._layer.addChild(this._playerGlow);
    this._layer.addChild(this._playerGfx);
    this._ghostGraphics = {};
    this._ghostGlows = {};
    this._time = 0;
  }

  createGhostGraphic(name) {
    const glow = new Graphics();
    const gfx = new Graphics();
    this._layer.addChild(glow);
    this._layer.addChild(gfx);
    this._ghostGlows[name] = glow;
    this._ghostGraphics[name] = gfx;
    return gfx;
  }

  drawPlayer(player) {
    if (!player || player.dead) {
      this._playerGfx.visible = false;
      this._playerGlow.visible = false;
      return;
    }
    this._playerGfx.visible = true;
    this._playerGlow.visible = true;
    this._playerGfx.clear();
    this._playerGlow.clear();

    const x = player.x;
    const y = player.y;
    const r = PLAYER_SIZE / 2;

    // Mouth animation — snappy chomp
    const raw = Math.abs(Math.sin(this._time * 18));
    const mouthAngle = 0.08 + 0.42 * raw * raw; // sharper open/close

    // Direction angle
    let startAngle = 0;
    switch (player.dir) {
      case 'r': startAngle = 0; break;
      case 'd': startAngle = Math.PI / 2; break;
      case 'l': startAngle = Math.PI; break;
      case 'u': startAngle = -Math.PI / 2; break;
    }

    // Glow behind pac-man
    const glowPulse = 0.8 + 0.2 * Math.sin(this._time * 6);
    this._playerGlow.circle(x, y, r + 6);
    this._playerGlow.fill({ color: COLORS.PACMAN, alpha: 0.08 * glowPulse });
    this._playerGlow.circle(x, y, r + 12);
    this._playerGlow.fill({ color: COLORS.PACMAN, alpha: 0.03 * glowPulse });

    // Pac-man body
    this._playerGfx.moveTo(x, y);
    this._playerGfx.arc(x, y, r, startAngle + mouthAngle, startAngle + Math.PI * 2 - mouthAngle);
    this._playerGfx.lineTo(x, y);
    this._playerGfx.fill({ color: COLORS.PACMAN });
  }

  drawGhost(ghost) {
    let gfx = this._ghostGraphics[ghost.name];
    if (!gfx) {
      gfx = this.createGhostGraphic(ghost.name);
    }
    const glow = this._ghostGlows[ghost.name];

    if (!ghost || ghost.hidden) {
      gfx.visible = false;
      if (glow) glow.visible = false;
      return;
    }
    gfx.visible = true;
    gfx.clear();
    if (glow) { glow.visible = true; glow.clear(); }

    const x = ghost.x;
    const y = ghost.y;
    const r = GHOST_SIZE / 2;

    let color;
    if (ghost.mode === 'dead') {
      this._drawEyes(gfx, x, y, r, ghost.dir);
      if (glow) glow.visible = false;
      return;
    } else if (ghost.mode === 'frightened') {
      color = ghost.flashing ? COLORS.FRIGHTENED_FLASH : COLORS.FRIGHTENED;
    } else {
      color = COLORS[ghost.name.toUpperCase()] || 0xFF0000;
    }

    // Ghost glow
    if (glow) {
      const glowAlpha = ghost.mode === 'frightened' ? 0.06 : 0.1;
      glow.circle(x, y, r + 8);
      glow.fill({ color, alpha: glowAlpha });
    }

    // Body — rounded top, wavy bottom
    gfx.moveTo(x - r, y + r);
    gfx.lineTo(x - r, y - r * 0.3);
    gfx.arc(x, y - r * 0.3, r, Math.PI, 0);
    gfx.lineTo(x + r, y + r);

    // Wavy bottom
    const waves = 3;
    const waveW = (r * 2) / waves;
    const waveH = r * 0.3;
    const waveOffset = Math.sin(this._time * 10) * 0.5;
    for (let i = 0; i < waves; i++) {
      const wx = x + r - i * waveW;
      const wx2 = wx - waveW;
      const cp1x = wx - waveW * 0.25;
      const cp2x = wx - waveW * 0.75;
      const baseY = y + r;
      gfx.bezierCurveTo(
        cp1x, baseY + waveH * (1 + waveOffset),
        cp2x, baseY - waveH * (1 - waveOffset),
        wx2, baseY
      );
    }
    gfx.fill({ color });

    // Eyes
    this._drawEyes(gfx, x, y, r, ghost.dir, ghost.mode === 'frightened');
  }

  _drawEyes(gfx, x, y, r, dir, frightened = false) {
    const eyeR = r * 0.28;
    const pupilR = eyeR * 0.5;
    const eyeY = y - r * 0.2;
    const eyeSpacing = r * 0.4;

    // Eye whites
    const eyeColor = frightened ? COLORS.FRIGHTENED_FLASH : 0xFFFFFF;
    gfx.circle(x - eyeSpacing, eyeY, eyeR);
    gfx.fill({ color: eyeColor });
    gfx.circle(x + eyeSpacing, eyeY, eyeR);
    gfx.fill({ color: eyeColor });

    if (frightened) return;

    // Pupils — offset by direction
    let px = 0, py = 0;
    const offset = eyeR * 0.4;
    switch (dir) {
      case 'u': py = -offset; break;
      case 'd': py = offset; break;
      case 'l': px = -offset; break;
      case 'r': px = offset; break;
    }

    gfx.circle(x - eyeSpacing + px, eyeY + py, pupilR);
    gfx.fill({ color: 0x1111CC });
    gfx.circle(x + eyeSpacing + px, eyeY + py, pupilR);
    gfx.fill({ color: 0x1111CC });
  }

  update(dt) {
    this._time += dt;
  }

  destroy() {
    this._playerGfx.destroy();
    this._playerGlow.destroy();
    Object.values(this._ghostGraphics).forEach(g => g.destroy());
    Object.values(this._ghostGlows).forEach(g => g.destroy());
  }
}
