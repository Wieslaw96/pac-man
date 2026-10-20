'use strict';

const EPS = 1e-6;

// Shared tile-grid movement for Pac-Man and the ghosts.
// Positions are in tile units with integers at tile centres, so x = 13.5 sits exactly
// between two tiles (the arcade start spot). Actors only change direction at tile
// centres, where subclasses decide what to do in onTileCenter().
class Actor {
  constructor(maze) {
    this.maze = maze;
    this.x = 0;
    this.y = 0;
    this.dir = DIRS.none;
    this.moving = false;
  }

  get tileX() { return Math.round(this.x); }
  get tileY() { return Math.round(this.y); }

  atCenter() {
    return Math.abs(this.x - Math.round(this.x)) < EPS && Math.abs(this.y - Math.round(this.y)) < EPS;
  }

  canMove(dir) {
    if (dir === DIRS.none) return false;
    return !this.maze.isBlocked(this.tileX + dir.x, this.tileY + dir.y);
  }

  distToNextCenter() {
    const d = this.dir;
    if (d.x > 0) return Math.floor(this.x + EPS) + 1 - this.x;
    if (d.x < 0) return this.x - (Math.ceil(this.x - EPS) - 1);
    if (d.y > 0) return Math.floor(this.y + EPS) + 1 - this.y;
    if (d.y < 0) return this.y - (Math.ceil(this.y - EPS) - 1);
    return Infinity;
  }

  // Moves `dist` tiles along the current direction, stopping at every tile centre
  // on the way so no turn is ever skipped, however large the step.
  advance(dist) {
    for (let i = 0; i < 8 && dist > EPS; i++) {
      if (this.atCenter()) {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        this.onTileCenter();
        if (!this.moving) return;
      }
      const toCenter = this.distToNextCenter();
      if (dist >= toCenter) {
        this.x = Math.round(this.x + this.dir.x * toCenter);
        this.y = Math.round(this.y + this.dir.y * toCenter);
        dist -= toCenter;
      } else {
        this.x += this.dir.x * dist;
        this.y += this.dir.y * dist;
        dist = 0;
      }
      this.wrapTunnel();
    }
  }

  // Columns -1 and COLS are virtual off-screen tunnel tiles that wrap onto each other.
  wrapTunnel() {
    if (this.x < -1) this.x += COLS + 1;
    else if (this.x > COLS) this.x -= COLS + 1;
  }

  onTileCenter() {}
}
