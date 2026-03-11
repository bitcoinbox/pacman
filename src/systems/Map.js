import { TILE, COLS, ROWS } from '../config/constants.js';

class Tile {
  constructor(code, col, row, map) {
    this.code = code;
    this.col = col;
    this.row = row;
    this.map = map;
    this.width = TILE;
    this.height = TILE;
    // Center position of this tile in world coords
    this.x = col * TILE + TILE / 2;
    this.y = row * TILE + TILE / 2;
    // Item on this tile (dot or pill) — true if present
    this.hasItem = code === '.' || code === '*';
  }

  isWall()   { return this.code === '='; }
  isHouse()  { return this.code === 'h'; }
  isTunnel() { return this.code === 't'; }
  isDot()    { return this.code === '.' && this.hasItem; }
  isPill()   { return this.code === '*' && this.hasItem; }
  isEmpty()  { return this.code === '-'; }

  // Walkable = not a wall
  isWalkable() {
    return !this.isWall();
  }

  // Neighbor lookups
  getUp()    { return this.map.getTileByGrid(this.col, this.row - 1); }
  getDown()  { return this.map.getTileByGrid(this.col, this.row + 1); }
  getLeft()  { return this.map.getTileByGrid(this.col - 1, this.row); }
  getRight() { return this.map.getTileByGrid(this.col + 1, this.row); }

  getNeighbor(dir) {
    switch (dir) {
      case 'u': return this.getUp();
      case 'd': return this.getDown();
      case 'l': return this.getLeft();
      case 'r': return this.getRight();
    }
    return null;
  }
}

export default class GameMap {
  constructor(mazeData) {
    this.tiles = [];
    this.width = COLS;
    this.height = ROWS;
    this.tileWidth = TILE;
    this.tileHeight = TILE;
    this.tunnels = [];
    this.house = null;
    this.houseCenter = null;
    this.houseExit = null;
    this.dots = [];
    this.pills = [];
    this.totalItems = 0;

    this._parse(mazeData);
  }

  _parse(mazeData) {
    for (let row = 0; row < this.height; row++) {
      const line = mazeData[row];
      for (let col = 0; col < this.width; col++) {
        const code = line.charAt(col);
        const tile = new Tile(code, col, row, this);
        this.tiles.push(tile);

        if (code === '.') {
          this.dots.push(tile);
          this.totalItems++;
        }
        if (code === '*') {
          this.pills.push(tile);
          this.totalItems++;
        }
        if (code === 'h' && !this.house) {
          this.house = tile;
        }
        if (code === 't' && (col === 0 || col === this.width - 1)) {
          this.tunnels.push(tile);
        }
      }
    }

    // House center is 1 tile below the house gate
    if (this.house) {
      this.houseCenter = this.house.getDown();
      // House exit is the walkable tile directly above the house gate
      const above = this.house.getUp();
      if (above && !above.isWall()) {
        this.houseExit = above;
      }
    }
  }

  getTileByGrid(col, row) {
    // Wrap horizontally (tunnels)
    if (col < 0) col = this.width - 1;
    if (col >= this.width) col = 0;
    if (row < 0) row = this.height - 1;
    if (row >= this.height) row = 0;
    const idx = row * this.width + col;
    return this.tiles[idx] || null;
  }

  // Get tile at world position
  getTileAt(x, y) {
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    return this.getTileByGrid(col, row);
  }

  // Get nearest tile center to a world position
  getNearestTile(x, y) {
    const col = Math.round((x - TILE / 2) / TILE);
    const row = Math.round((y - TILE / 2) / TILE);
    return this.getTileByGrid(col, row);
  }

  // Check if a direction is walkable from a tile
  canGo(tile, dir, allowHouse = false) {
    const next = tile.getNeighbor(dir);
    if (!next) return false;
    if (next.isWall()) return false;
    if (!allowHouse && next.isHouse()) return false;
    return true;
  }

  // Get remaining items count
  getRemainingItems() {
    let count = 0;
    for (const tile of this.tiles) {
      if (tile.hasItem) count++;
    }
    return count;
  }

  // Remove item from tile
  eatItem(tile) {
    if (tile.hasItem) {
      tile.hasItem = false;
      return true;
    }
    return false;
  }
}
