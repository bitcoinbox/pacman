import { Graphics } from 'pixi.js';
import { TILE } from '../config/constants.js';

export default class MazeRenderer {
  constructor(layer) {
    this._layer = layer;
    // Triple-layer glow: outer glow → inner glow → sharp wall
    this._outerGlow = new Graphics();
    this._innerGlow = new Graphics();
    this._walls = new Graphics();
    this._layer.addChild(this._outerGlow);
    this._layer.addChild(this._innerGlow);
    this._layer.addChild(this._walls);
  }

  draw(map, theme = null) {
    const wallColor = theme?.wall ?? 0x2121DE;
    const glowColor = theme?.glow ?? 0x4444FF;

    this._walls.clear();
    this._innerGlow.clear();
    this._outerGlow.clear();

    // Draw wall segments as edge lines
    for (const tile of map.tiles) {
      if (!tile.isWall()) continue;

      const x = tile.col * TILE;
      const y = tile.row * TILE;

      const up = tile.getUp();
      const down = tile.getDown();
      const left = tile.getLeft();
      const right = tile.getRight();

      if (up && !up.isWall()) {
        this._drawEdge(x, y, x + TILE, y, wallColor, glowColor);
      }
      if (down && !down.isWall()) {
        this._drawEdge(x, y + TILE, x + TILE, y + TILE, wallColor, glowColor);
      }
      if (left && !left.isWall()) {
        this._drawEdge(x, y, x, y + TILE, wallColor, glowColor);
      }
      if (right && !right.isWall()) {
        this._drawEdge(x + TILE, y, x + TILE, y + TILE, wallColor, glowColor);
      }
    }

    // Ghost house gate
    if (map.house) {
      const hx = map.house.col * TILE;
      const hy = map.house.row * TILE;
      let houseWidth = 0;
      let col = map.house.col;
      while (col < map.width && map.getTileByGrid(col, map.house.row).isHouse()) {
        houseWidth++;
        col++;
      }
      // Gate glow
      this._innerGlow.moveTo(hx, hy);
      this._innerGlow.lineTo(hx + houseWidth * TILE, hy);
      this._innerGlow.stroke({ width: 6, color: 0xFFB8FF, alpha: 0.2 });
      // Gate line
      this._walls.moveTo(hx, hy);
      this._walls.lineTo(hx + houseWidth * TILE, hy);
      this._walls.stroke({ width: 3, color: 0xFFB8FF });
    }
  }

  _drawEdge(x1, y1, x2, y2, wallColor, glowColor) {
    // Outer glow (wide, very faint)
    this._outerGlow.moveTo(x1, y1);
    this._outerGlow.lineTo(x2, y2);
    this._outerGlow.stroke({ width: 14, color: glowColor, alpha: 0.06 });

    // Inner glow
    this._innerGlow.moveTo(x1, y1);
    this._innerGlow.lineTo(x2, y2);
    this._innerGlow.stroke({ width: 6, color: glowColor, alpha: 0.18 });

    // Sharp wall line
    this._walls.moveTo(x1, y1);
    this._walls.lineTo(x2, y2);
    this._walls.stroke({ width: 2.5, color: wallColor });
  }

  destroy() {
    this._outerGlow.destroy();
    this._innerGlow.destroy();
    this._walls.destroy();
  }
}
