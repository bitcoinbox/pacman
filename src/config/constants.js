// Grid dimensions (in tiles)
export const COLS = 28;
export const ROWS = 36;

// Tile size in game units
export const TILE = 32;

// Derived
export const GAME_WIDTH = COLS * TILE;   // 896
export const GAME_HEIGHT = ROWS * TILE;  // 1152

// Entity sizes
export const PLAYER_SIZE = 28;
export const GHOST_SIZE = 28;
export const DOT_RADIUS = 3;
export const PILL_RADIUS = 8;

// Speeds (pixels per second)
export const BASE_SPEED = 160;

// Scoring
export const SCORE_DOT = 10;
export const SCORE_PILL = 50;
export const SCORE_GHOST = [200, 400, 800, 1600];
export const EXTRA_LIFE_SCORE = 10000;
export const DEFAULT_LIVES = 3;

// Timing (seconds)
export const READY_TIME = 2.0;
export const DEATH_TIME = 1.5;
export const GHOST_EAT_FREEZE = 0.5;
export const LEVEL_CLEAR_TIME = 2.0;

// Directions
export const DIR = {
  UP: 'u',
  DOWN: 'd',
  LEFT: 'l',
  RIGHT: 'r'
};

// Direction vectors
export const DIR_VEC = {
  u: { x: 0, y: -1 },
  d: { x: 0, y: 1 },
  l: { x: -1, y: 0 },
  r: { x: 1, y: 0 }
};

// Opposite directions
export const DIR_OPPOSITE = {
  u: 'd', d: 'u', l: 'r', r: 'l'
};

// Colors
export const COLORS = {
  WALL: 0x2121DE,
  WALL_GLOW: 0x4444FF,
  DOT: 0xFFFFCC,
  PILL: 0xFFFFCC,
  PACMAN: 0xFFFF00,
  BLINKY: 0xFF0000,
  PINKY: 0xFFB8FF,
  INKY: 0x00FFFF,
  SUE: 0xFF8800,    // orange (Ms. Pac-Man uses Sue instead of Clyde)
  FRIGHTENED: 0x2222FF,
  FRIGHTENED_FLASH: 0xFFFFFF,
  DEAD: 0xFFFFFF,
  TEXT: 0xFFFFFF,
  SCORE: 0xFFFF00,
  HUD: 0xFFFFFF
};

// Ghost names
export const GHOST_TYPES = ['blinky', 'pinky', 'inky', 'sue'];

// Maze wall color themes per level group
export const MAZE_THEMES = [
  { wall: 0x2121DE, glow: 0x4444FF },  // blue (classic)
  { wall: 0xFFB8FF, glow: 0xFF66CC },  // pink
  { wall: 0xFF6644, glow: 0xFF4422 },  // red/orange
  { wall: 0x00CC88, glow: 0x00FFAA },  // green
  { wall: 0x9933FF, glow: 0xBB66FF },  // purple
  { wall: 0xFFCC00, glow: 0xFFDD44 },  // gold
  { wall: 0x00CCCC, glow: 0x00FFFF },  // cyan
  { wall: 0xFF3366, glow: 0xFF6699 },  // magenta
  { wall: 0x88CC00, glow: 0xAAFF22 },  // lime
  { wall: 0xFF8800, glow: 0xFFAA33 },  // orange
];
