import { TILE, BASE_SPEED, DIR_VEC, DIR_OPPOSITE } from '../config/constants.js';

// Ghost modes
const MODES = {
  SCATTER: 'scatter',
  CHASE: 'chase',
  FRIGHTENED: 'frightened',
  DEAD: 'dead',
  HOUSE: 'house'
};

// Mode timing sequences (seconds) — shared global schedule
const MODE_TIMES = [
  { mode: MODES.SCATTER, time: 7 },
  { mode: MODES.CHASE, time: 20 },
  { mode: MODES.SCATTER, time: 7 },
  { mode: MODES.CHASE, time: 20 },
  { mode: MODES.SCATTER, time: 5 },
  { mode: MODES.CHASE, time: 20 },
  { mode: MODES.SCATTER, time: 5 },
  { mode: MODES.CHASE, time: 999999 },
];

export default class Ghost {
  constructor(name, map, config = {}) {
    this.name = name;
    this.map = map;
    this.x = 0;
    this.y = 0;
    this.dir = 'l';
    this._nextDir = null;
    this.mode = MODES.HOUSE;
    this.globalMode = MODES.SCATTER;
    this.speed = config.speed || BASE_SPEED * 0.75;
    this.frightenedSpeed = this.speed * 0.5;
    this.tunnelSpeed = this.speed * 0.4;
    this.frightenedTime = config.frightenedTime || 6;
    this.waitTime = config.waitTime || 0;
    this.hidden = false;
    this.flashing = false;

    this._startX = 0;
    this._startY = 0;
    this._startDir = 'l';
    this._modeTimer = 0;
    this._modeIndex = 0;
    this._frightenedTimer = 0;
    this._waitTimer = 0;
    this._lastTile = null;
    this._turnBack = false;

    // Scatter target (corner tile)
    this.scatterTarget = config.scatterTarget || null;

    // Reference to player for chase targeting
    this.player = config.player || null;

    // Reference to blinky for inky's targeting
    this.blinky = config.blinky || null;

    // Global mode timer reference (shared across ghosts)
    this._globalTimer = config.globalTimer || null;

    // Seeded RNG for deterministic replay (optional)
    this._opts = { rng: config.rng || null };
  }

  spawn(x, y, dir = 'u') {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this._startX = x;
    this._startY = y;
    this._startDir = dir;
    this._nextDir = null;
    this._waitTimer = 0;
    this.mode = MODES.HOUSE;
    this._modeTimer = 0;
    this._modeIndex = 0;
    this._frightenedTimer = 0;
    this.flashing = false;
    this.hidden = false;
    this._turnBack = false;
    this._lastTile = null;
  }

  reset() {
    this.spawn(this._startX, this._startY, this._startDir);
  }

  update(dt) {
    if (this.hidden) return;

    this._updateMode(dt);
    const speed = this._getCurrentSpeed() * dt;

    switch (this.mode) {
      case MODES.HOUSE:
        this._moveInHouse(speed, dt);
        break;
      case MODES.DEAD:
        this._moveDead(speed);
        break;
      default:
        this._moveNormal(speed);
        break;
    }

    // Tunnel wrapping
    const worldW = this.map.width * TILE;
    if (this.x < -TILE) this.x += worldW;
    if (this.x > worldW + TILE) this.x -= worldW;
  }

  getTile() {
    return this.map.getNearestTile(this.x, this.y);
  }

  setFrightened() {
    if (this.mode === MODES.DEAD || this.mode === MODES.HOUSE) return;
    this.mode = MODES.FRIGHTENED;
    this._frightenedTimer = this.frightenedTime;
    this.flashing = false;
    this._turnBack = true;
  }

  kill() {
    this.mode = MODES.DEAD;
    this.flashing = false;
  }

  isFrightened() {
    return this.mode === MODES.FRIGHTENED;
  }

  isDead() {
    return this.mode === MODES.DEAD;
  }

  _getCurrentSpeed() {
    switch (this.mode) {
      case MODES.FRIGHTENED: return this.frightenedSpeed;
      case MODES.DEAD: return this.speed * 1.5;
      case MODES.HOUSE: return this.speed * 0.6;
      default: {
        const tile = this.getTile();
        if (tile && tile.isTunnel()) return this.tunnelSpeed;
        return this.speed;
      }
    }
  }

  _updateMode(dt) {
    if (this.mode === MODES.FRIGHTENED) {
      this._frightenedTimer -= dt;
      this.flashing = this._frightenedTimer < this.frightenedTime * 0.3;
      if (this._frightenedTimer <= 0) {
        this.mode = this.globalMode;
        this.flashing = false;
        this._turnBack = true;
      }
      return;
    }

    if (this.mode === MODES.DEAD || this.mode === MODES.HOUSE) return;

    // Global mode timer
    this._modeTimer += dt;
    const times = MODE_TIMES;
    let elapsed = 0;
    for (let i = 0; i < times.length; i++) {
      elapsed += times[i].time;
      if (this._modeTimer < elapsed) {
        const newMode = times[i].mode;
        if (this.mode !== newMode) {
          this.mode = newMode;
          this.globalMode = newMode;
          this._turnBack = true;
        }
        break;
      }
    }
  }

  _moveNormal(speed) {
    const tile = this.getTile();
    if (!tile) return;

    const vec = DIR_VEC[this.dir];
    if (!vec) return;

    // Check if we've entered a new tile
    if (tile !== this._lastTile) {
      this._lastTile = tile;

      // Execute turn-back
      if (this._turnBack) {
        this.dir = DIR_OPPOSITE[this.dir] || this.dir;
        this._turnBack = false;
      }

      // Choose next direction at this tile
      this._nextDir = this._chooseDirection(tile);
    }

    // Distance from ghost to tile center along each axis
    const dx = tile.x - this.x;
    const dy = tile.y - this.y;
    const distX = Math.abs(dx);
    const distY = Math.abs(dy);

    // Check if we're close enough to tile center to snap and turn
    if (distX < speed + 1 && distY < speed + 1 && this._nextDir) {
      this.x = tile.x;
      this.y = tile.y;
      this.dir = this._nextDir;
      this._nextDir = null;
    }

    // Move forward
    const moveVec = DIR_VEC[this.dir];
    if (!moveVec) return;

    const next = tile.getNeighbor(this.dir);
    const canPass = next && !next.isWall() &&
      (this.mode === MODES.DEAD || !next.isHouse());

    if (canPass) {
      // Open path ahead — move freely
      this.x += moveVec.x * speed;
      this.y += moveVec.y * speed;
    } else {
      // Wall ahead — still move toward tile center, but don't overshoot
      const toCenter = moveVec.x * dx + moveVec.y * dy;
      if (toCenter > 0.5) {
        // Center is still ahead of us, keep moving toward it
        const step = Math.min(speed, toCenter);
        this.x += moveVec.x * step;
        this.y += moveVec.y * step;
      } else {
        // At or past center — snap and stop (direction change should happen via _nextDir)
        this.x = tile.x;
        this.y = tile.y;
      }
    }
  }

  _chooseDirection(tile) {
    const target = this._getTarget();
    if (!target) return this.dir;

    // Choose best direction from CURRENT tile (not next tile ahead)
    // Direction is applied at this tile's center, so neighbors must be valid here
    const dirs = ['u', 'l', 'd', 'r'];
    let bestDir = null;
    let bestDist = Infinity;

    for (const d of dirs) {
      // Can't reverse direction
      if (d === DIR_OPPOSITE[this.dir]) continue;

      const neighbor = tile.getNeighbor(d);
      if (!neighbor || neighbor.isWall()) continue;
      if (this.mode !== MODES.DEAD && neighbor.isHouse()) continue;

      const dist = this._distance(neighbor, target);
      if (dist < bestDist) {
        bestDist = dist;
        bestDir = d;
      }
    }

    // If no valid direction found (dead end), allow reverse as last resort
    if (!bestDir) {
      bestDir = DIR_OPPOSITE[this.dir] || this.dir;
    }

    return bestDir;
  }

  _getTarget() {
    if (this.mode === MODES.DEAD) {
      // Navigate to house entrance
      return this.map.houseExit || this.map.house;
    }

    if (this.mode === MODES.SCATTER) {
      return this.scatterTarget;
    }

    if (this.mode === MODES.FRIGHTENED) {
      // Random direction — pick random valid neighbor
      const dirs = ['u', 'l', 'd', 'r'];
      const tile = this.getTile();
      if (!tile) return tile;
      const valid = dirs.filter(d => {
        if (d === DIR_OPPOSITE[this.dir]) return false;
        const n = tile.getNeighbor(d);
        return n && !n.isWall() && !n.isHouse();
      });
      if (valid.length > 0) {
        const rng = this._opts?.rng;
        const idx = rng ? rng.int(valid.length) : Math.floor(Math.random() * valid.length);
        return tile.getNeighbor(valid[idx]);
      }
      return tile;
    }

    // Chase mode — different per ghost type
    return this._getChaseTarget();
  }

  _getChaseTarget() {
    if (!this.player) return this.scatterTarget;
    const playerTile = this.player.getTile();
    if (!playerTile) return this.scatterTarget;

    switch (this.name) {
      case 'blinky':
        // Direct chase — target player's tile
        return playerTile;

      case 'pinky': {
        // 4 tiles ahead of player
        let target = playerTile;
        for (let i = 0; i < 4; i++) {
          const next = target.getNeighbor(this.player.dir);
          if (next && !next.isWall()) target = next;
          else break;
        }
        return target;
      }

      case 'inky': {
        // Vector from blinky through 2 tiles ahead of player, doubled
        if (!this.blinky) return playerTile;
        let ahead = playerTile;
        for (let i = 0; i < 2; i++) {
          const next = ahead.getNeighbor(this.player.dir);
          if (next) ahead = next;
        }
        const blinkyTile = this.blinky.getTile();
        if (!blinkyTile) return playerTile;
        const targetCol = ahead.col + (ahead.col - blinkyTile.col);
        const targetRow = ahead.row + (ahead.row - blinkyTile.row);
        return this.map.getTileByGrid(targetCol, targetRow) || playerTile;
      }

      case 'sue': {
        // Chase if far, scatter if close (8 tile threshold)
        const dist = this._distance(this.getTile(), playerTile);
        return dist > 8 * TILE ? playerTile : this.scatterTarget;
      }

      default:
        return playerTile;
    }
  }

  _moveInHouse(speed, dt) {
    this._waitTimer += dt;

    if (this._waitTimer >= this.waitTime) {
      // Exit house — move to the exit tile center
      const exitTile = this.map.houseExit;
      if (!exitTile) {
        // Fallback: just switch mode
        this.mode = this.globalMode;
        return;
      }

      const exitX = exitTile.x;
      const exitY = exitTile.y;

      // Move horizontally to align with exit
      if (Math.abs(this.x - exitX) > speed + 1) {
        this.x += (exitX > this.x ? 1 : -1) * speed;
        this.dir = exitX > this.x ? 'r' : 'l';
      }
      // Then move up to exit
      else if (this.y > exitY + 1) {
        this.x = exitX;
        this.y -= speed;
        this.dir = 'u';
      }
      // Exited house — snap to tile center and start normal movement
      else {
        this.x = exitX;
        this.y = exitY;
        this.mode = this.globalMode;
        this.dir = 'l';
        this._lastTile = null;
        this._nextDir = null;
      }
    } else {
      // Bob up and down in house
      const houseCenter = this.map.houseCenter;
      if (!houseCenter) return;
      const bobRange = TILE * 0.35;
      const topY = houseCenter.y - bobRange;
      const botY = houseCenter.y + bobRange;

      if (this.dir === 'u') {
        this.y -= speed;
        if (this.y <= topY) { this.y = topY; this.dir = 'd'; }
      } else {
        this.y += speed;
        if (this.y >= botY) { this.y = botY; this.dir = 'u'; }
      }
    }
  }

  _moveDead(speed) {
    // Navigate back to ghost house using normal pathfinding
    const exitTile = this.map.houseExit;
    if (!exitTile) return;

    const tile = this.getTile();
    if (!tile) return;

    // Check if we've reached the house entrance area
    if (tile === exitTile || tile.isHouse()) {
      const hc = this.map.houseCenter;
      this.x = hc ? hc.x : exitTile.x;
      this.y = hc ? hc.y : exitTile.y;
      this.mode = MODES.HOUSE;
      this._waitTimer = this.waitTime; // Skip wait, exit immediately
      return;
    }

    // Use normal movement — _getTarget returns house entrance for dead mode
    this._moveNormal(speed);
  }

  _distance(a, b) {
    if (!a || !b) return Infinity;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
