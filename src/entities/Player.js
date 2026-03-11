import { TILE, BASE_SPEED, DIR_VEC, DIR_OPPOSITE } from '../config/constants.js';

export default class Player {
  constructor(map) {
    this.map = map;
    this.x = 0;
    this.y = 0;
    this.dir = 'l';
    this.nextDir = null;
    this.speed = BASE_SPEED;
    this.dead = false;
    this.moving = false;

    this._startX = 0;
    this._startY = 0;
  }

  spawn(x, y) {
    this.x = x;
    this.y = y;
    this._startX = x;
    this._startY = y;
    this.dir = 'l';
    this.nextDir = null;
    this.dead = false;
    this.moving = false;
  }

  reset() {
    this.spawn(this._startX, this._startY);
  }

  setDirection(dir) {
    if (!dir) return;
    this.nextDir = dir;
  }

  update(dt) {
    if (this.dead) return;

    const speed = this.speed * dt;

    // Try to turn to nextDir if set
    if (this.nextDir && this.nextDir !== this.dir) {
      if (this._canTurn(this.nextDir)) {
        // Snap to grid on the turning axis
        this._snapToAxis(this.nextDir);
        this.dir = this.nextDir;
        this.nextDir = null;
      }
    }

    // Move in current direction
    if (this._canMove(this.dir)) {
      const vec = DIR_VEC[this.dir];
      this.x += vec.x * speed;
      this.y += vec.y * speed;
      this.moving = true;
    } else {
      // Snap to tile center if we can't move
      this._snapToCenter();
      this.moving = false;
    }

    // Tunnel wrapping
    const worldW = this.map.width * TILE;
    const worldH = this.map.height * TILE;
    if (this.x < 0) this.x += worldW;
    if (this.x > worldW) this.x -= worldW;
    if (this.y < 0) this.y += worldH;
    if (this.y > worldH) this.y -= worldH;
  }

  getTile() {
    return this.map.getNearestTile(this.x, this.y);
  }

  _canTurn(dir) {
    const tile = this.getTile();
    if (!tile) return false;

    // Must be near enough to the tile center on the perpendicular axis
    const isVertical = dir === 'u' || dir === 'd';
    const threshold = this.speed / 60 + 1; // Small tolerance

    if (isVertical) {
      if (Math.abs(this.x - tile.x) > threshold) return false;
    } else {
      if (Math.abs(this.y - tile.y) > threshold) return false;
    }

    return this.map.canGo(tile, dir);
  }

  _canMove(dir) {
    const tile = this.getTile();
    if (!tile) return false;

    const next = tile.getNeighbor(dir);
    if (!next || next.isWall()) {
      // Can still move if not yet at tile center
      const vec = DIR_VEC[dir];
      if (vec.x !== 0) {
        return Math.abs(this.x - tile.x) > 1;
      }
      if (vec.y !== 0) {
        return Math.abs(this.y - tile.y) > 1;
      }
      return false;
    }

    // Don't enter ghost house
    if (next.isHouse()) return false;

    return true;
  }

  _snapToAxis(dir) {
    const tile = this.getTile();
    if (dir === 'u' || dir === 'd') {
      this.x = tile.x;
    } else {
      this.y = tile.y;
    }
  }

  _snapToCenter() {
    const tile = this.getTile();
    if (!tile) return;
    const snapSpeed = 0.3;
    this.x += (tile.x - this.x) * snapSpeed;
    this.y += (tile.y - this.y) * snapSpeed;
  }
}
