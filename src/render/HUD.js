import { Text, TextStyle, Container } from 'pixi.js';
import { GAME_WIDTH, TILE, COLORS } from '../config/constants.js';

export default class HUD {
  constructor(layer) {
    this._layer = layer;
    this._container = new Container();
    this._layer.addChild(this._container);

    const style = new TextStyle({
      fontFamily: 'Press Start 2P',
      fontSize: 16,
      fill: COLORS.HUD,
    });

    const smallStyle = new TextStyle({
      fontFamily: 'Press Start 2P',
      fontSize: 14,
      fill: COLORS.HUD,
    });

    // 1UP label
    this._oneUpLabel = new Text({ text: '1UP', style });
    this._oneUpLabel.x = TILE * 2;
    this._oneUpLabel.y = TILE * 0.3;
    this._container.addChild(this._oneUpLabel);

    // Score
    this._scoreText = new Text({ text: '00', style: smallStyle });
    this._scoreText.x = TILE * 2;
    this._scoreText.y = TILE * 1.2;
    this._container.addChild(this._scoreText);

    // HIGH SCORE label
    this._highLabel = new Text({ text: 'HIGH SCORE', style });
    this._highLabel.x = GAME_WIDTH / 2;
    this._highLabel.anchor.set(0.5, 0);
    this._highLabel.y = TILE * 0.3;
    this._container.addChild(this._highLabel);

    // High score value
    this._highScoreText = new Text({ text: '00', style: smallStyle });
    this._highScoreText.x = GAME_WIDTH / 2;
    this._highScoreText.anchor.set(0.5, 0);
    this._highScoreText.y = TILE * 1.2;
    this._container.addChild(this._highScoreText);

    // Lives display (bottom left) — drawn as small pac-man shapes
    this._livesText = new Text({ text: '', style: smallStyle });
    this._livesText.x = TILE * 2;
    this._livesText.y = GAME_WIDTH + TILE * 2; // approximate bottom
    this._container.addChild(this._livesText);
  }

  updateScore(score) {
    this._scoreText.text = score ? String(score) : '00';
  }

  updateHighScore(highScore) {
    this._highScoreText.text = highScore ? String(highScore) : '00';
  }

  updateLives(lives) {
    // Simple text display for now
    let txt = '';
    for (let i = 0; i < lives; i++) txt += '♦ ';
    this._livesText.text = txt;
  }

  destroy() {
    this._container.destroy({ children: true });
  }
}
