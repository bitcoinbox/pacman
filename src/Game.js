import { TILE, GAME_WIDTH, GAME_HEIGHT, MAZE_THEMES, COLORS } from './config/constants.js';
import { MAZES } from './config/maps.js';
import GameMap from './systems/Map.js';
import Collision from './systems/Collision.js';
import Score from './systems/Score.js';
import Player from './entities/Player.js';
import Ghost from './entities/Ghost.js';
import Loop from './core/Loop.js';
import Input from './core/Input.js';
import EventBus from './core/EventBus.js';
import Audio from './core/Audio.js';
import Renderer from './render/Renderer.js';
import MazeRenderer from './render/MazeRenderer.js';
import PelletRenderer from './render/PelletRenderer.js';
import EntityRenderer from './render/EntityRenderer.js';
import HUD from './render/HUD.js';
import Particles from './effects/Particles.js';
import ScreenEffects from './effects/ScreenEffects.js';
import ScorePopup from './effects/ScorePopup.js';
import { PARTICLE_DOT_EAT, PARTICLE_PILL_EAT, PARTICLE_GHOST_EAT, PARTICLE_DEATH } from './effects/Particles.js';

// Game states
const STATE = {
  MENU: 'menu',
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  DYING: 'dying',
  LEVEL_CLEAR: 'levelClear',
  GAME_OVER: 'gameOver'
};

export default class Game {
  constructor(containerEl) {
    this._containerEl = containerEl;
    this.events = new EventBus();
    this.input = new Input();
    this.score = new Score(this.events);
    this.audio = new Audio();
    this.state = STATE.MENU;
    this._stateTimer = 0;
    this._freezeTimer = 0;

    this.map = null;
    this.player = null;
    this.ghosts = [];
    this.collision = new Collision(this.events);

    // Renderers
    this.renderer = null;
    this.mazeRenderer = null;
    this.pelletRenderer = null;
    this.entityRenderer = null;
    this.hud = null;

    // Effects
    this.particles = null;
    this.screenFx = null;
    this.scorePopup = null;

    // Overlay element
    this._overlay = document.getElementById('overlay');

    // Wallet / online features
    this._wallet = null;
    this._sessionId = null;

    // Power-ups
    this._powerUp = null;         // { type, tile, timer }
    this._powerUpEffect = null;   // { type, timer }
    this._powerUpSpawnTimer = 0;

    this._setupEvents();
    this._setupPause();
  }

  setWallet(wallet) {
    this._wallet = wallet;
  }

  async init() {
    this.renderer = new Renderer(this._containerEl);
    await this.renderer.init();

    this.mazeRenderer = new MazeRenderer(this.renderer.getLayer('maze'));
    this.pelletRenderer = new PelletRenderer(this.renderer.getLayer('pellets'));
    this.entityRenderer = new EntityRenderer(this.renderer.getLayer('entities'));
    this.hud = new HUD(this.renderer.getLayer('hud'));

    // Effects
    this.particles = new Particles(this.renderer.getLayer('effects'));
    this.screenFx = new ScreenEffects(this.renderer.app.stage, this.renderer.getLayer('effects'));
    this.scorePopup = new ScorePopup(this.renderer.getLayer('effects'));

    this.loop = new Loop(
      (dt) => this._update(dt),
      (alpha) => this._render(alpha)
    );

    this._showMenu();
    this.loop.start();
  }

  _setupEvents() {
    this.events.on('dot:eaten', (tile) => {
      this.score.addDotScore();
      this._checkLevelClear();
      // Particles + sound
      if (tile) {
        this.particles.emit(tile.x, tile.y, PARTICLE_DOT_EAT);
      }
      this.audio.play('dot');
    });

    this.events.on('pill:eaten', (tile) => {
      this.score.addPillScore();
      // Frighten all ghosts
      for (const ghost of this.ghosts) {
        ghost.setFrightened();
      }
      this._checkLevelClear();
      // Effects
      if (tile) {
        this.particles.emit(tile.x, tile.y, PARTICLE_PILL_EAT);
      }
      this.screenFx.flash(0x2222FF, 0.15);
      this.audio.play('eat');
      this.audio.play('frightened');
    });

    this.events.on('ghost:eaten', (ghost) => {
      const points = this.score.addGhostScore();
      ghost.kill();
      this._freezeTimer = 0.5;
      // Effects
      const ghostColor = COLORS[ghost.name.toUpperCase()] || 0xFF0000;
      this.particles.emit(ghost.x, ghost.y, { ...PARTICLE_GHOST_EAT, color: ghostColor });
      this.scorePopup.show(ghost.x, ghost.y - 10, points, 0xFFFF00);
      this.screenFx.shake(5, 0.25);
      this.screenFx.flash(0xFFFFFF, 0.1);
      this.audio.play('eaten');
    });

    this.events.on('player:killed', () => {
      if (this.state !== STATE.PLAYING) return;
      this.player.dead = true;
      this.state = STATE.DYING;
      this._stateTimer = 1.5;
      // Effects
      this.particles.emit(this.player.x, this.player.y, PARTICLE_DEATH);
      this.screenFx.shake(8, 0.4);
      this.screenFx.flash(0xFF0000, 0.2);
      this.audio.stopAll();
      this.audio.play('dead');
    });
  }

  _setupPause() {
    this._unpause = () => {
      if (this.state !== STATE.PAUSED) return;
      this.state = STATE.PLAYING;
      this.audio.resumeAll();
      this._overlay.classList.remove('active');
      this._overlay.innerHTML = '';
    };

    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Space') return;
      e.preventDefault();

      if (this.state === STATE.PLAYING) {
        this.state = STATE.PAUSED;
        this.audio.pauseAll();
        this._overlay.classList.add('active');
        this._overlay.innerHTML = `
          <div class="message">
            <div class="pause-text">PAUSED</div>
            <div class="pause-hint">TAP OR PRESS SPACE</div>
          </div>
        `;
      } else if (this.state === STATE.PAUSED) {
        this._unpause();
      }
    });

    // Tap the pause overlay to resume
    this._overlay.addEventListener('touchend', () => this._unpause());
  }

  _checkLevelClear() {
    if (this.map.getRemainingItems() <= 0) {
      this.state = STATE.LEVEL_CLEAR;
      this._stateTimer = 2.0;
      this.screenFx.flash(0xFFFFFF, 0.3);
      this.audio.stopAll();
      this.audio.play('bonus');
    }
  }

  _showMenu() {
    this.state = STATE.MENU;
    this._overlay.classList.add('active');
    this._overlay.innerHTML = `
      <div class="message menu-screen">
        <div class="menu-title">PAC-MAN</div>
        <div class="menu-token">$PACMAN</div>
        <div class="menu-high">HIGH SCORE: ${this.score.highScore}</div>
        <div class="menu-start">TAP OR PRESS ANY KEY</div>
      </div>
    `;

    // Load a maze in the background for visual
    this._loadLevel(0);

    // Wait for keypress or tap
    this._menuListener = (e) => {
      e.preventDefault();
      window.removeEventListener('keydown', this._menuListener);
      window.removeEventListener('touchend', this._menuTouchListener);
      this.audio.load(); // Init audio on first interaction
      this._startGame();
    };
    this._menuTouchListener = (e) => {
      window.removeEventListener('keydown', this._menuListener);
      window.removeEventListener('touchend', this._menuTouchListener);
      this.audio.load();
      this._startGame();
    };
    window.addEventListener('keydown', this._menuListener);
    window.addEventListener('touchend', this._menuTouchListener);
  }

  _startGame() {
    this.score.reset();
    this._startSession();
    this._loadLevel(0);
    this._startReady();
    this.audio.play('intro');
  }

  _startReady() {
    this.state = STATE.READY;
    this._stateTimer = 2.0;
    this._overlay.classList.add('active');
    this._overlay.innerHTML = `
      <div class="message">
        <div class="ready-text">READY!</div>
      </div>
    `;
  }

  _loadLevel(mazeIndex) {
    const mi = mazeIndex % MAZES.length;
    this.map = new GameMap(MAZES[mi]);
    const theme = MAZE_THEMES[mi % MAZE_THEMES.length];

    // Draw maze
    this.mazeRenderer.draw(this.map, theme);
    this.pelletRenderer.draw(this.map);

    // Spawn player
    this.player = new Player(this.map);
    const spawnTile = this.map.getTileByGrid(14, 26);
    this.player.spawn(spawnTile.x, spawnTile.y);

    // Spawn ghosts
    this.ghosts = [];
    this._spawnGhosts();

    // Clear effects and power-ups
    if (this.particles) this.particles.clear();
    if (this.scorePopup) this.scorePopup.clear();
    this._powerUp = null;
    this._powerUpEffect = null;
    this._powerUpSpawnTimer = 20;
    this.score._multiplier = 1;

    this.hud.updateScore(this.score.score);
    this.hud.updateHighScore(this.score.highScore);
    this.hud.updateLives(this.score.lives);
  }

  _getLevelDifficulty() {
    const lvl = this.score.level;
    // Speed ramps: 120 base, +4 per level, cap at 180
    const speed = Math.min(120 + (lvl - 1) * 4, 180);
    // Frightened time shrinks: 6s base, -0.4 per level, min 1.5s
    const frightenedTime = Math.max(6 - (lvl - 1) * 0.4, 1.5);
    // Ghost exit wait times shrink with level
    const waitScale = Math.max(1 - (lvl - 1) * 0.08, 0.3);
    return { speed, frightenedTime, waitScale };
  }

  _spawnGhosts() {
    const houseCenter = this.map.houseCenter;
    if (!houseCenter) return;

    const houseExit = this.map.houseExit;
    if (!houseExit) return;

    const diff = this._getLevelDifficulty();

    // Blinky — starts at exit tile, immediately active
    const blinky = new Ghost('blinky', this.map, {
      speed: diff.speed,
      waitTime: 0,
      frightenedTime: diff.frightenedTime,
      scatterTarget: this.map.getTileByGrid(25, 0),
      player: this.player
    });
    blinky.spawn(houseExit.x, houseExit.y, 'l');
    blinky.mode = 'scatter';
    blinky._lastTile = null;

    // Pinky — in house center, exits quickly
    const pinky = new Ghost('pinky', this.map, {
      speed: diff.speed,
      waitTime: 2 * diff.waitScale,
      frightenedTime: diff.frightenedTime,
      scatterTarget: this.map.getTileByGrid(2, 0),
      player: this.player
    });
    pinky.spawn(houseCenter.x, houseCenter.y, 'u');

    // Inky — in house, offset left
    const inky = new Ghost('inky', this.map, {
      speed: diff.speed,
      waitTime: 6 * diff.waitScale,
      frightenedTime: diff.frightenedTime,
      scatterTarget: this.map.getTileByGrid(27, 35),
      player: this.player,
      blinky: blinky
    });
    const inkyX = houseCenter.getNeighbor('l');
    inky.spawn(inkyX ? inkyX.x : houseCenter.x - TILE, houseCenter.y, 'u');

    // Sue — in house, offset right
    const sue = new Ghost('sue', this.map, {
      speed: diff.speed,
      waitTime: 8 * diff.waitScale,
      frightenedTime: diff.frightenedTime,
      scatterTarget: this.map.getTileByGrid(0, 35),
      player: this.player
    });
    const sueX = houseCenter.getNeighbor('r');
    sue.spawn(sueX ? sueX.x : houseCenter.x + TILE, houseCenter.y, 'u');

    this.ghosts = [blinky, pinky, inky, sue];
  }

  _update(dt) {
    // Apply time scale from screen effects
    const effectiveDt = this.screenFx ? dt * this.screenFx.timeScale : dt;

    // Update effects (always, regardless of state)
    if (this.screenFx) this.screenFx.update(dt);
    if (this.particles) this.particles.update(dt);
    if (this.scorePopup) this.scorePopup.update(dt);

    // Only block mobile scroll during active gameplay
    this.input.captureTouch =
      this.state === STATE.PLAYING ||
      this.state === STATE.READY ||
      this.state === STATE.DYING ||
      this.state === STATE.LEVEL_CLEAR;

    switch (this.state) {
      case STATE.MENU:
        break;

      case STATE.READY:
        this._stateTimer -= dt;
        if (this._stateTimer <= 0) {
          this.state = STATE.PLAYING;
          this._overlay.classList.remove('active');
          this._overlay.innerHTML = '';
          this.audio.play('back');
        }
        break;

      case STATE.PLAYING:
        this._updatePlaying(effectiveDt);
        break;

      case STATE.DYING:
        this._stateTimer -= dt;
        if (this._stateTimer <= 0) {
          const livesLeft = this.score.loseLife();
          this.hud.updateLives(livesLeft);
          if (livesLeft <= 0) {
            this._gameOver();
          } else {
            // Reset positions
            this.player.reset();
            for (const ghost of this.ghosts) ghost.reset();
            this._startReady();
          }
        }
        break;

      case STATE.LEVEL_CLEAR:
        this._stateTimer -= dt;
        if (this._stateTimer <= 0) {
          this.score.nextLevel();
          const mazeIndex = (this.score.level - 1) % MAZES.length;
          this._loadLevel(mazeIndex);
          this._startReady();
        }
        break;

      case STATE.GAME_OVER:
        break;
    }
  }

  _updatePlaying(dt) {
    // Freeze timer (ghost eat pause)
    if (this._freezeTimer > 0) {
      this._freezeTimer -= dt;
      return;
    }

    // Player input
    const dir = this.input.getDirection();
    if (dir) this.player.setDirection(dir);

    // Apply speed boost power-up
    const speedMul = (this._powerUpEffect?.type === 'speed') ? 1.35 : 1;
    const origSpeed = this.player.speed;
    if (speedMul !== 1) this.player.speed = origSpeed * speedMul;

    // Update entities
    this.player.update(dt);

    // Restore original speed
    if (speedMul !== 1) this.player.speed = origSpeed;

    // Ghost freeze power-up: skip ghost updates
    const ghostsFrozen = this._powerUpEffect?.type === 'freeze';
    if (!ghostsFrozen) {
      for (const ghost of this.ghosts) {
        ghost.update(dt);
      }
    }

    // Check collisions
    this.collision.check(this.player, this.ghosts, this.map);

    // Power-up spawning
    this._updatePowerUps(dt);

    // Stop frightened music when no ghosts are frightened
    const anyFrightened = this.ghosts.some(g => g.isFrightened());
    if (!anyFrightened) {
      this.audio.stop('frightened');
    }

    // Update HUD
    this.hud.updateScore(this.score.score);
    this.hud.updateHighScore(this.score.highScore);
  }

  _updatePowerUps(dt) {
    // Spawn timer
    this._powerUpSpawnTimer -= dt;
    if (this._powerUpSpawnTimer <= 0 && !this._powerUp) {
      this._spawnPowerUp();
      this._powerUpSpawnTimer = 15 + Math.random() * 10; // 15-25s between spawns
    }

    // Despawn timer for uncollected power-up
    if (this._powerUp) {
      this._powerUp.timer -= dt;
      if (this._powerUp.timer <= 0) {
        this._powerUp = null;
      } else {
        // Check collection
        const pt = this._powerUp.tile;
        const dx = this.player.x - pt.x;
        const dy = this.player.y - pt.y;
        if (Math.sqrt(dx * dx + dy * dy) < TILE * 0.8) {
          this._collectPowerUp(this._powerUp);
          this._powerUp = null;
        }
      }
    }

    // Active effect timer
    if (this._powerUpEffect) {
      this._powerUpEffect.timer -= dt;
      if (this._powerUpEffect.timer <= 0) {
        if (this._powerUpEffect.type === 'multiplier') {
          this.score._multiplier = 1;
        }
        this._powerUpEffect = null;
      }
    }
  }

  _spawnPowerUp() {
    // Find random empty walkable tile that has no item
    const candidates = this.map.tiles.filter(t =>
      !t.isWall() && !t.isHouse() && !t.isTunnel() && !t.hasItem && t.code !== 'h'
    );
    if (candidates.length === 0) return;
    const tile = candidates[Math.floor(Math.random() * candidates.length)];
    const types = ['speed', 'multiplier', 'freeze'];
    const type = types[Math.floor(Math.random() * types.length)];
    this._powerUp = { type, tile, timer: 10 }; // 10s to collect
  }

  _collectPowerUp(pu) {
    this._powerUpEffect = { type: pu.type, timer: 6 }; // 6s duration

    // Score multiplier applies immediately
    if (pu.type === 'multiplier') {
      this.score._multiplier = 2;
    }

    // Visual feedback
    const colors = { speed: 0x00FF88, multiplier: 0xFFCC00, freeze: 0x00CCFF };
    this.particles.emit(pu.tile.x, pu.tile.y, {
      count: 12, speed: 100, life: 0.6,
      color: colors[pu.type], size: 4, gravity: 0
    });
    this.scorePopup.show(pu.tile.x, pu.tile.y - 10,
      pu.type === 'speed' ? 'SPEED!' : pu.type === 'multiplier' ? '2X!' : 'FREEZE!',
      colors[pu.type]
    );
    this.screenFx.flash(colors[pu.type], 0.12);
    this.audio.play('bonus');
  }

  _render(alpha) {
    // Pass power-up state to renderer
    this.pelletRenderer.setPowerUp(this._powerUp);

    // Update renderers
    this.pelletRenderer.update(1 / 60);
    this.entityRenderer.update(1 / 60);

    // Draw entities
    if (this.player) {
      this.entityRenderer.drawPlayer(this.player);
    }
    for (const ghost of this.ghosts) {
      this.entityRenderer.drawGhost(ghost);
    }
  }

  _gameOver() {
    this.state = STATE.GAME_OVER;
    this.score.saveHighScore();
    this._submitScore();
    this.audio.stopAll();

    this._overlay.classList.add('active');
    const tweetText = encodeURIComponent(`I scored ${this.score.score.toLocaleString()} on $PACMAN! Can you beat it?\n\nPlay now:`);
    const tweetUrl = encodeURIComponent(window.location.origin);
    const twitterLink = `https://x.com/intent/tweet?text=${tweetText}&url=${tweetUrl}`;

    this._overlay.innerHTML = `
      <div class="message gameover-screen">
        <div class="go-title">GAME OVER</div>
        <div class="go-score">SCORE: ${this.score.score.toLocaleString()}</div>
        <div class="go-high">HIGH SCORE: ${this.score.highScore.toLocaleString()}</div>
        <a class="go-share" href="${twitterLink}" target="_blank" onclick="event.stopPropagation()">SHARE ON X</a>
        <div class="go-restart">TAP OR PRESS ANY KEY</div>
      </div>
    `;

    this._gameOverListener = (e) => {
      e.preventDefault();
      window.removeEventListener('keydown', this._gameOverListener);
      window.removeEventListener('touchend', this._gameOverTouchListener);
      this._overlay.classList.remove('active');
      this._overlay.innerHTML = '';
      this._startGame();
    };
    this._gameOverTouchListener = () => {
      window.removeEventListener('keydown', this._gameOverListener);
      window.removeEventListener('touchend', this._gameOverTouchListener);
      this._overlay.classList.remove('active');
      this._overlay.innerHTML = '';
      this._startGame();
    };
    window.addEventListener('keydown', this._gameOverListener);
    window.addEventListener('touchend', this._gameOverTouchListener);
  }

  // ── Online session / score submission ──────────────

  async _startSession() {
    this._sessionId = null;
    if (!this._wallet?.isAuthenticated()) return;
    try {
      const res = await fetch('/api/game/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this._wallet.getToken()}`,
        },
      });
      const data = await res.json();
      if (res.ok) this._sessionId = data.sessionId;
    } catch {}
  }

  async _submitScore() {
    if (!this._sessionId || !this._wallet?.isAuthenticated()) return;
    try {
      const res = await fetch('/api/game/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this._wallet.getToken()}`,
        },
        body: JSON.stringify({
          sessionId: this._sessionId,
          score: this.score.score,
          level: this.score.level,
        }),
      });
      const data = await res.json();
      if (res.ok && data.accepted) {
        // Update local player data
        const player = this._wallet.getPlayer();
        if (player) {
          player.bestScore = data.bestScore;
          player.totalGames = data.totalGames;
        }
        // Dispatch event for leaderboard refresh
        window.dispatchEvent(new CustomEvent('pacman:scoreSubmitted', { detail: data }));
      }
    } catch {}
    this._sessionId = null;
  }
}
