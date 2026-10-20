'use strict';

// The tile just above the house door, where ghosts leave and eyes re-enter.
const HOUSE_EXIT = { x: 13.5, y: 11 };
const HOUSE_CENTER_Y = 14;

const GHOSTS = [
  { name: 'blinky', color: '#ff0000', home: { x: 13.5, y: 11 }, scatter: { x: 25, y: -3 } },
  { name: 'pinky', color: '#ffb8ff', home: { x: 13.5, y: 14 }, scatter: { x: 2, y: -3 } },
  { name: 'inky', color: '#00ffff', home: { x: 11.5, y: 14 }, scatter: { x: 27, y: 31 } },
  { name: 'clyde', color: '#ffb852', home: { x: 15.5, y: 14 }, scatter: { x: 0, y: 31 } },
];

// Ghost states:
//   house    - bobbing inside the ghost house, waiting to be released
//   leaving  - following a path out through the door
//   active   - roaming the maze (scatter/chase, or random while `frightened`)
//   eaten    - eyes heading back to the house exit
//   entering - eyes following a path back into the house, then leaving again
class Ghost extends Actor {
  constructor(maze, config) {
    super(maze);
    this.name = config.name;
    this.color = config.color;
    this.home = config.home;
    this.scatter = config.scatter;
    this.reset();
  }

  reset() {
    this.x = this.home.x;
    this.y = this.home.y;
    this.state = this.name === 'blinky' ? 'active' : 'house';
    this.dir = this.name === 'blinky' ? DIRS.left : this.name === 'pinky' ? DIRS.down : DIRS.up;
    this.moving = true;
    this.frightened = false;
    this.path = [];
    this.target = this.scatter;
  }

  release() {
    this.state = 'leaving';
    this.path = this.x === HOUSE_EXIT.x
      ? [HOUSE_EXIT]
      : [{ x: this.x, y: HOUSE_CENTER_Y }, { x: HOUSE_EXIT.x, y: HOUSE_CENTER_Y }, HOUSE_EXIT];
  }

  reverse() {
    if (this.state !== 'active') return;
    const back = OPPOSITE[this.dir.name];
    if (!this.atCenter() || this.canMove(back)) this.dir = back;
  }

  update(dt, game) {
    const dist = game.ghostSpeed(this) * dt;
    switch (this.state) {
      case 'house':
        this.bob(dist);
        break;
      case 'leaving':
      case 'entering':
        this.followPath(dist);
        break;
      default:
        this.target = this.computeTarget(game);
        this.advance(dist);
    }
  }

  computeTarget(game) {
    if (this.state === 'eaten') return { x: 13, y: HOUSE_EXIT.y };
    if (game.mode === 'scatter') return this.scatter;
    const pac = game.pacman;
    const px = pac.tileX;
    const py = pac.tileY;
    const d = pac.dir;
    switch (this.name) {
      case 'blinky':
        return { x: px, y: py };
      case 'pinky':
        return { x: px + 4 * d.x, y: py + 4 * d.y };
      case 'inky': {
        // Double the vector from Blinky to the tile two ahead of Pac-Man.
        const blinky = game.ghosts[0];
        return { x: 2 * (px + 2 * d.x) - blinky.tileX, y: 2 * (py + 2 * d.y) - blinky.tileY };
      }
      default: // clyde: chases when far away, retreats to his corner when close
        return (this.x - px) ** 2 + (this.y - py) ** 2 > 64 ? { x: px, y: py } : this.scatter;
    }
  }

  onTileCenter() {
    if (this.state === 'eaten' && this.y === HOUSE_EXIT.y && (this.x === 13 || this.x === 14)) {
      this.state = 'entering';
      this.path = [HOUSE_EXIT, { x: HOUSE_EXIT.x, y: HOUSE_CENTER_Y }];
      this.moving = false;
      return;
    }
    // Ghosts never reverse by choice; they pick the open exit closest to their target.
    const back = OPPOSITE[this.dir.name];
    let options = DIR_PRIORITY.filter(d => d !== back && this.canMove(d));
    if (options.length === 0) options = [back];
    if (this.frightened) {
      this.dir = options[Math.floor(Math.random() * options.length)];
      return;
    }
    let best = options[0];
    let bestDist = Infinity;
    for (const d of options) {
      const dist = (this.x + d.x - this.target.x) ** 2 + (this.y + d.y - this.target.y) ** 2;
      if (dist < bestDist) {
        best = d;
        bestDist = dist;
      }
    }
    this.dir = best;
  }

  bob(dist) {
    this.y += this.dir.y * dist;
    if (this.y <= HOUSE_CENTER_Y - 0.5) {
      this.y = HOUSE_CENTER_Y - 0.5;
      this.dir = DIRS.down;
    } else if (this.y >= HOUSE_CENTER_Y + 0.5) {
      this.y = HOUSE_CENTER_Y + 0.5;
      this.dir = DIRS.up;
    }
  }

  // Moves along axis-aligned waypoints (used inside the house, off the tile grid).
  followPath(dist) {
    while (dist > EPS && this.path.length) {
      const p = this.path[0];
      const dx = p.x - this.x;
      const dy = p.y - this.y;
      if (dx) this.dir = dx < 0 ? DIRS.left : DIRS.right;
      else if (dy) this.dir = dy < 0 ? DIRS.up : DIRS.down;
      const remaining = Math.abs(dx) + Math.abs(dy);
      if (remaining <= dist) {
        this.x = p.x;
        this.y = p.y;
        this.path.shift();
        dist -= remaining;
      } else {
        this.x += Math.sign(dx) * dist;
        this.y += Math.sign(dy) * dist;
        dist = 0;
      }
    }
    if (this.path.length) return;
    if (this.state === 'entering') {
      this.release();
    } else {
      this.state = 'active';
      this.dir = DIRS.left;
      this.moving = true;
    }
  }

  draw(ctx, game) {
    const cx = (this.x + 0.5) * TILE;
    const cy = (this.y + 0.5) * TILE;
    const r = TILE * 0.8;
    const eyesOnly = this.state === 'eaten' || this.state === 'entering';
    const flashing = this.frightened && game.frightTimer < 2 && Math.floor(game.frightTimer * 5) % 2 === 0;

    if (!eyesOnly) {
      ctx.fillStyle = this.frightened ? (flashing ? '#ffffff' : '#2121ff') : this.color;
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.15, r, Math.PI, 0);
      const bottom = cy + r;
      const phase = Math.floor(game.time * 8) % 2;
      for (let i = 0; i <= 6; i++) {
        ctx.lineTo(cx + r - i * (r / 3), bottom - ((i + phase) % 2 ? r * 0.3 : 0));
      }
      ctx.closePath();
      ctx.fill();
    }

    if (this.frightened && !eyesOnly) {
      ctx.fillStyle = flashing ? '#ff0000' : '#ffb8ae';
      ctx.fillRect(cx - r * 0.45, cy - r * 0.4, r * 0.25, r * 0.25);
      ctx.fillRect(cx + r * 0.2, cy - r * 0.4, r * 0.25, r * 0.25);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        ctx.lineTo(cx - r * 0.6 + i * r * 0.2, cy + r * 0.3 + (i % 2 ? -r * 0.15 : 0));
      }
      ctx.stroke();
      return;
    }

    const d = this.dir;
    for (const side of [-1, 1]) {
      const ex = cx + side * r * 0.38 + d.x * r * 0.12;
      const ey = cy - r * 0.2 + d.y * r * 0.12;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, ey, r * 0.27, r * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2121de';
      ctx.beginPath();
      ctx.arc(ex + d.x * r * 0.13, ey + d.y * r * 0.16, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
