'use strict';

// Grid geometry. All game logic works in tile units; TILE converts to canvas pixels.
const TILE = 16;
const COLS = 28;
const ROWS = 31;
const HUD_TOP = 3;     // tile rows of score display above the maze
const HUD_BOTTOM = 2;  // tile rows of lives/fruit display below the maze
const WIDTH = COLS * TILE;
const HEIGHT = (ROWS + HUD_TOP + HUD_BOTTOM) * TILE;
const TUNNEL_ROW = 14;

const WALL = '#';
const PELLET = '.';
const POWER = 'o';
const DOOR = '-';
const EMPTY = ' ';

// The arcade maze. Spaces outside the border are unreachable filler, except on the tunnel row.
const MAP = [
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '     #.##### ## #####.#     ',
  '     #.##          ##.#     ',
  '     #.## ###--### ##.#     ',
  '######.## #      # ##.######',
  '      .   #      #   .      ',
  '######.## #      # ##.######',
  '     #.## ######## ##.#     ',
  '     #.##          ##.#     ',
  '     #.## ######## ##.#     ',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##.......  .......##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
];

function makeDir(name, x, y) {
  return Object.freeze({ name, x, y });
}

const DIRS = Object.freeze({
  none: makeDir('none', 0, 0),
  up: makeDir('up', 0, -1),
  left: makeDir('left', -1, 0),
  down: makeDir('down', 0, 1),
  right: makeDir('right', 1, 0),
});

const OPPOSITE = Object.freeze({
  none: DIRS.none,
  up: DIRS.down,
  down: DIRS.up,
  left: DIRS.right,
  right: DIRS.left,
});

// Ghosts break ties between equally good turns in this order, as in the arcade.
const DIR_PRIORITY = [DIRS.up, DIRS.left, DIRS.down, DIRS.right];

// Wall outlines are drawn as segments between the centres of neighbouring wall tiles,
// keeping only segments that border open space (so thick blocks render as outlines).
function buildWallSegments() {
  const isWall = (x, y) => y >= 0 && y < ROWS && x >= 0 && x < COLS && MAP[y][x] === WALL;
  const segments = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!isWall(x, y)) continue;
      if (isWall(x + 1, y) &&
          (!isWall(x, y - 1) || !isWall(x + 1, y - 1) || !isWall(x, y + 1) || !isWall(x + 1, y + 1))) {
        segments.push([x, y, x + 1, y]);
      }
      if (isWall(x, y + 1) &&
          (!isWall(x - 1, y) || !isWall(x - 1, y + 1) || !isWall(x + 1, y) || !isWall(x + 1, y + 1))) {
        segments.push([x, y, x, y + 1]);
      }
    }
  }
  return segments;
}

class Maze {
  constructor() {
    this.segments = buildWallSegments();
    this.reset();
  }

  // Restores every pellet; called at the start of each level.
  reset() {
    this.tiles = MAP.map(row => row.split(''));
    this.pelletsLeft = 0;
    for (const row of this.tiles) {
      for (const t of row) {
        if (t === PELLET || t === POWER) this.pelletsLeft++;
      }
    }
    this.totalPellets = this.pelletsLeft;
  }

  tile(x, y) {
    if (y < 0 || y >= ROWS) return WALL;
    if (x < 0 || x >= COLS) return y === TUNNEL_ROW ? EMPTY : WALL;
    return this.tiles[y][x];
  }

  isBlocked(x, y) {
    const t = this.tile(x, y);
    return t === WALL || t === DOOR;
  }

  isTunnel(x, y) {
    return y === TUNNEL_ROW && (x <= 5 || x >= COLS - 6);
  }

  // Removes a pellet at (x, y) and returns its type, or null if there was none.
  eat(x, y) {
    const t = this.tile(x, y);
    if (t !== PELLET && t !== POWER) return null;
    this.tiles[y][x] = EMPTY;
    this.pelletsLeft--;
    return t;
  }

  draw(ctx, wallColor, showPower) {
    ctx.strokeStyle = wallColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of this.segments) {
      ctx.moveTo((x1 + 0.5) * TILE, (y1 + 0.5) * TILE);
      ctx.lineTo((x2 + 0.5) * TILE, (y2 + 0.5) * TILE);
    }
    ctx.stroke();

    ctx.fillStyle = '#ffb8ff';
    ctx.fillRect(13 * TILE - 4, 12.5 * TILE - 2, 2 * TILE + 8, 4);

    ctx.fillStyle = '#ffb8ae';
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = this.tiles[y][x];
        const cx = (x + 0.5) * TILE;
        const cy = (y + 0.5) * TILE;
        if (t === PELLET) {
          ctx.fillRect(cx - 2, cy - 2, 4, 4);
        } else if (t === POWER && showPower) {
          ctx.beginPath();
          ctx.arc(cx, cy, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}
