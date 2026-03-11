import { SCORE_DOT, SCORE_PILL, SCORE_GHOST, EXTRA_LIFE_SCORE, DEFAULT_LIVES } from '../config/constants.js';

export default class Score {
  constructor(events) {
    this.events = events;
    this.score = 0;
    this.highScore = this._loadHighScore();
    this.lives = DEFAULT_LIVES;
    this.level = 1;
    this._ghostCombo = 0;
    this._extraLifeGiven = false;
    this._multiplier = 1;
  }

  reset() {
    this.score = 0;
    this.lives = DEFAULT_LIVES;
    this.level = 1;
    this._ghostCombo = 0;
    this._extraLifeGiven = false;
    this._multiplier = 1;
  }

  addDotScore() {
    this._addScore(SCORE_DOT);
  }

  addPillScore() {
    this._addScore(SCORE_PILL);
    this._ghostCombo = 0;
  }

  addGhostScore() {
    const points = SCORE_GHOST[Math.min(this._ghostCombo, SCORE_GHOST.length - 1)];
    this._ghostCombo++;
    this._addScore(points);
    return points;
  }

  loseLife() {
    this.lives--;
    return this.lives;
  }

  nextLevel() {
    this.level++;
  }

  _addScore(points) {
    this.score += points * this._multiplier;
    if (!this._extraLifeGiven && this.score >= EXTRA_LIFE_SCORE) {
      this._extraLifeGiven = true;
      this.lives++;
      this.events.emit('extra:life');
    }
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
  }

  saveHighScore() {
    try {
      localStorage.setItem('pacman_high', String(this.highScore));
    } catch (e) {}
  }

  _loadHighScore() {
    try {
      return parseInt(localStorage.getItem('pacman_high') || '0', 10);
    } catch (e) {
      return 0;
    }
  }
}
