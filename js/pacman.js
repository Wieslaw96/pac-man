'use strict';

const DIR_ANGLE = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2, none: 0 };

class Pacman extends Actor {
  constructor(maze) {
    super(maze);
    this.reset();
  }

  reset() {
    this.x = 13.5;
    this.y = 23;
    this.dir = DIRS.left;
    this.nextDir = DIRS.none;
    this.moving = true;
    this.anim = 0;
  }

  // `wanted` is the player's buffered direction; it is applied at the next tile
  // centre where it is possible, except reversing, which happens immediately.
  update(dt, speed, wanted) {
    if (wanted !== DIRS.none) this.nextDir = wanted;
    if (this.nextDir !== DIRS.none && this.nextDir === OPPOSITE[this.dir.name]) {
      this.dir = this.nextDir;
      this.moving = true;
    }
    this.advance(speed * dt);
    if (this.moving) this.anim += dt;
  }

  onTileCenter() {
    if (this.nextDir !== DIRS.none && this.canMove(this.nextDir)) {
      this.dir = this.nextDir;
      this.moving = true;
    } else {
      this.moving = this.canMove(this.dir);
    }
  }

  // deathProgress is null while alive, otherwise 0..1 through the death animation.
  draw(ctx, deathProgress) {
    drawPacmanShape(ctx, (this.x + 0.5) * TILE, (this.y + 0.5) * TILE, TILE * 0.8,
      this.dir, this.moving ? Math.abs(Math.sin(this.anim * 14)) : 0.6, deathProgress);
  }
}

// open: 0 (closed) .. 1 (wide open). Also used for the lives icons in the HUD.
function drawPacmanShape(ctx, cx, cy, r, dir, open, deathProgress = null) {
  let angle = DIR_ANGLE[dir.name];
  let mouth = 0.04 * Math.PI + open * 0.24 * Math.PI;
  if (deathProgress !== null) {
    angle = -Math.PI / 2;
    mouth = 0.1 * Math.PI + deathProgress * 0.9 * Math.PI;
    if (mouth >= Math.PI - 0.01) return;
  }
  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, angle + mouth, angle - mouth + Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}
