import { TILE } from '../config/constants.js';

const COLLISION_DIST = TILE * 0.8;

export default class Collision {
  constructor(events) {
    this.events = events;
  }

  check(player, ghosts, map) {
    if (player.dead) return;

    // Player vs pellets
    const tile = player.getTile();
    if (tile && tile.hasItem) {
      const isPill = tile.code === '*';
      map.eatItem(tile);
      this.events.emit(isPill ? 'pill:eaten' : 'dot:eaten', tile);
    }

    // Player vs ghosts
    for (const ghost of ghosts) {
      if (ghost.hidden || ghost.mode === 'dead' || ghost.mode === 'house') continue;

      const dx = player.x - ghost.x;
      const dy = player.y - ghost.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < COLLISION_DIST) {
        if (ghost.mode === 'frightened') {
          this.events.emit('ghost:eaten', ghost);
        } else {
          this.events.emit('player:killed', ghost);
        }
      }
    }
  }
}
