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

    this._setupEvents();
    this._setupPause();
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

    // Clear effects
    if (this.particles) this.particles.clear();
    if (this.scorePopup) this.scorePopup.clear();

    this.hud.updateScore(this.score.score);
    this.hud.updateHighScore(this.score.highScore);
    this.hud.updateLives(this.score.lives);
  }

  _spawnGhosts() {
    const houseCenter = this.map.houseCenter;
    if (!houseCenter) return;

    const houseExit = this.map.houseExit;
    if (!houseExit) return;

    // Blinky — starts at exit tile, immediately active
    const blinky = new Ghost('blinky', this.map, {
      speed: 120,
      waitTime: 0,
      frightenedTime: 6,
      scatterTarget: this.map.getTileByGrid(25, 0),
      player: this.player
    });
    blinky.spawn(houseExit.x, houseExit.y, 'l');
    blinky.mode = 'scatter';
    blinky._lastTile = null;

    // Pinky — in house center, exits quickly
    const pinky = new Ghost('pinky', this.map, {
      speed: 120,
      waitTime: 2,
      frightenedTime: 6,
      scatterTarget: this.map.getTileByGrid(2, 0),
      player: this.player
    });
    pinky.spawn(houseCenter.x, houseCenter.y, 'u');

    // Inky — in house, offset left
    const inky = new Ghost('inky', this.map, {
      speed: 120,
      waitTime: 6,
      frightenedTime: 6,
      scatterTarget: this.map.getTileByGrid(27, 35),
      player: this.player,
      blinky: blinky
    });
    const inkyX = houseCenter.getNeighbor('l');
    inky.spawn(inkyX ? inkyX.x : houseCenter.x - TILE, houseCenter.y, 'u');

    // Sue — in house, offset right
    const sue = new Ghost('sue', this.map, {
      speed: 120,
      waitTime: 8,
      frightenedTime: 6,
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

    // Update entities
    this.player.update(dt);
    for (const ghost of this.ghosts) {
      ghost.update(dt);
    }

    // Check collisions
    this.collision.check(this.player, this.ghosts, this.map);

    // Stop frightened music when no ghosts are frightened
    const anyFrightened = this.ghosts.some(g => g.isFrightened());
    if (!anyFrightened) {
      this.audio.stop('frightened');
    }

    // Update HUD
    this.hud.updateScore(this.score.score);
    this.hud.updateHighScore(this.score.highScore);
  }

  _render(alpha) {
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
    this.audio.stopAll();

    this._overlay.classList.add('active');
    this._overlay.innerHTML = `
      <div class="message gameover-screen">
        <div class="go-title">GAME OVER</div>
        <div class="go-score">SCORE: ${this.score.score}</div>
        <div class="go-high">HIGH SCORE: ${this.score.highScore}</div>
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
}
