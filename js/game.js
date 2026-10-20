'use strict';

const BASE_SPEED = 9.47; // tiles per second at the arcade's "100%" speed
const EATEN_SPEED = 15;
const HOUSE_SPEED = BASE_SPEED * 0.5;
const FRIGHT_TIMES = [6, 5, 4, 3, 2, 5, 2, 2, 1, 5, 2, 1, 1, 3, 1, 1, 0, 1]; // seconds, by level
const FRUIT_POS = { x: 13.5, y: 17 };
const FIRST_EXTRA_LIFE = 10000;
const EXTRA_LIFE_EVERY = 20000; // after the first: 30000, 50000, 70000, ...
const MAX_LIFE_ICONS = 5;
const DEATH_TIME = 2;
const HIGH_SCORE_KEY = 'pacman.highScore';

const FRUITS = [
  { name: 'cherry', points: 100, color: '#ff0000' },
  { name: 'strawberry', points: 300, color: '#ff2060' },
  { name: 'orange', points: 500, color: '#ffa040' },
  { name: 'apple', points: 700, color: '#ff3030' },
  { name: 'melon', points: 1000, color: '#40d040' },
  { name: 'galaxian', points: 2000, color: '#ffe000' },
  { name: 'bell', points: 3000, color: '#ffe000' },
  { name: 'key', points: 5000, color: '#60c0ff' },
];
const FRUIT_BY_LEVEL = [0, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7];

function fruitForLevel(level) {
  return FRUITS[FRUIT_BY_LEVEL[Math.min(level, FRUIT_BY_LEVEL.length) - 1]];
}

// Speeds as fractions of BASE_SPEED.
function levelSpeeds(level) {
  if (level === 1) return { pac: 0.8, pacFright: 0.9, ghost: 0.75, ghostFright: 0.5, tunnel: 0.4 };
  if (level <= 4) return { pac: 0.9, pacFright: 0.95, ghost: 0.85, ghostFright: 0.55, tunnel: 0.45 };
  return { pac: 1, pacFright: 1, ghost: 0.95, ghostFright: 0.6, tunnel: 0.5 };
}

// Alternating scatter / chase durations in seconds, starting with scatter.
function modeSchedule(level) {
  if (level === 1) return [7, 20, 7, 20, 5, 20, 5, Infinity];
  if (level <= 4) return [7, 20, 7, 20, 5, 1033, 1 / 60, Infinity];
  return [5, 20, 5, 20, 5, 1037, 1 / 60, Infinity];
}

// Pellets eaten before each house ghost (pinky, inky, clyde) is released.
function releaseLimits(level, lifeLost) {
  if (lifeLost) return [7, 17, 32];
  if (level === 1) return [0, 30, 60];
  if (level === 2) return [0, 0, 50];
  return [0, 0, 0];
}

function loadHighScore() {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveHighScore(score) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    // storage unavailable (private mode etc.); the high score just won't persist
  }
}

function drawText(ctx, text, x, y, color, size = 16, align = 'center') {
  ctx.fillStyle = color;
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function drawFruit(ctx, fruit, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  if (fruit.name === 'cherry') {
    ctx.strokeStyle = '#d08040';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, r * 0.2);
    ctx.quadraticCurveTo(0, -r * 0.4, r * 0.5, -r * 0.8);
    ctx.moveTo(r * 0.35, r * 0.35);
    ctx.quadraticCurveTo(r * 0.3, -r * 0.3, r * 0.5, -r * 0.8);
    ctx.stroke();
    ctx.fillStyle = fruit.color;
    for (const [x, y] of [[-r * 0.4, r * 0.35], [r * 0.35, r * 0.5]]) {
      ctx.beginPath();
      ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (fruit.name === 'key') {
    ctx.fillStyle = fruit.color;
    ctx.fillRect(-r * 0.5, -r * 0.9, r, r * 0.55);
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(-r * 0.12, -r * 0.35, r * 0.24, r * 1.25);
    ctx.fillRect(r * 0.12, r * 0.4, r * 0.25, r * 0.15);
    ctx.fillRect(r * 0.12, r * 0.7, r * 0.25, r * 0.15);
  } else {
    ctx.fillStyle = fruit.color;
    ctx.beginPath();
    ctx.arc(0, r * 0.1, r * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#40c040';
    ctx.beginPath();
    ctx.ellipse(r * 0.2, -r * 0.7, r * 0.3, r * 0.15, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Game states: title -> ready -> playing <-> ghostEaten; playing -> dying -> ready | gameOver;
// playing -> levelComplete -> ready. `stateTimer` counts down the timed states.
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1;
    this.input = new Input(canvas);
    this.sound = new Sound();
    this.maze = new Maze();
    this.pacman = new Pacman(this.maze);
    this.ghosts = GHOSTS.map(config => new Ghost(this.maze, config));
    this.highScore = loadHighScore();
    this.score = 0;
    this.lives = 0;
    this.level = 1;
    this.time = 0;
    this.paused = false;
    this.popups = [];
    this.fruit = null;
    this.state = 'title';
    this.stateTimer = 0;
    this.resize();
  }

  // Match the canvas backing store to its CSS size so drawing stays crisp at any scale.
  resize() {
    const cssWidth = this.canvas.clientWidth || WIDTH;
    this.scale = (cssWidth / WIDTH) * (window.devicePixelRatio || 1);
    this.canvas.width = Math.round(WIDTH * this.scale);
    this.canvas.height = Math.round(HEIGHT * this.scale);
  }

  get mode() {
    return this.modeIndex % 2 === 0 ? 'scatter' : 'chase';
  }

  newGame() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.nextExtraLife = FIRST_EXTRA_LIFE;
    this.startLevel();
    this.stateTimer = INTRO_LENGTH + 0.4;
    this.sound.intro();
  }

  startLevel() {
    this.maze.reset();
    this.dotsEaten = 0;
    this.lifeLost = false;
    this.resetActors();
  }

  resetActors() {
    this.pacman.reset();
    this.ghosts.forEach(g => g.reset());
    this.input.dir = DIRS.none;
    this.modeIndex = 0;
    this.modeTimer = 0;
    this.frightTimer = 0;
    this.ghostCombo = 0;
    this.dotCounter = 0;
    this.releaseTimer = 0;
    this.fruit = null;
    this.popups = [];
    this.state = 'ready';
    this.stateTimer = 2;
  }

  pause() {
    if (this.state !== 'title' && this.state !== 'gameOver') this.paused = true;
  }

  update(dt) {
    if (this.input.consume('mute')) this.sound.toggleMute();
    if (this.input.consume('pause') && this.state !== 'title' && this.state !== 'gameOver') {
      this.paused = !this.paused;
    }
    if (this.paused && this.input.consume('start')) this.paused = false;
    if (this.paused) {
      this.sound.setLoop(null);
      this.input.endFrame();
      return;
    }

    this.time += dt;
    this.stateTimer -= dt;
    switch (this.state) {
      case 'title':
        if (this.input.consume('start')) this.newGame();
        break;
      case 'ready':
        if (this.stateTimer <= 0) this.state = 'playing';
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'ghostEaten':
        if (this.stateTimer <= 0) this.state = 'playing';
        break;
      case 'dying':
        if (this.stateTimer <= 0) this.afterDeath();
        break;
      case 'levelComplete':
        if (this.stateTimer <= 0) {
          this.level++;
          this.startLevel();
        }
        break;
      case 'gameOver':
        if (this.stateTimer <= 0 || (this.stateTimer < 2 && this.input.consume('start'))) {
          this.state = 'title';
        }
        break;
    }

    for (const p of this.popups) p.timer -= dt;
    this.popups = this.popups.filter(p => p.timer > 0);
    this.updateSoundLoop();
    this.input.endFrame();
  }

  updateSoundLoop() {
    let loop = null;
    if (this.state === 'playing') {
      if (this.ghosts.some(g => g.state === 'eaten' || g.state === 'entering')) loop = 'eyes';
      else if (this.frightTimer > 0) loop = 'fright';
      else loop = 'siren';
    }
    this.sound.setLoop(loop, 1 - this.maze.pelletsLeft / this.maze.totalPellets);
  }

  updatePlaying(dt) {
    this.updateModes(dt);

    const pac = this.pacman;
    pac.update(dt, this.pacSpeed(), this.input.dir);
    this.eatPellet(pac.tileX, pac.tileY);
    if (this.maze.pelletsLeft === 0) {
      this.state = 'levelComplete';
      this.stateTimer = 2;
      saveHighScore(this.highScore);
      return;
    }
    this.updateFruit(dt);

    this.releaseGhosts(dt);
    for (const g of this.ghosts) g.update(dt, this);
    this.checkCollisions();
  }

  // Scatter/chase timer; it is paused while the ghosts are frightened.
  updateModes(dt) {
    if (this.frightTimer > 0) {
      this.frightTimer -= dt;
      if (this.frightTimer <= 0) this.ghosts.forEach(g => { g.frightened = false; });
      return;
    }
    const schedule = modeSchedule(this.level);
    this.modeTimer += dt;
    if (this.modeTimer >= schedule[this.modeIndex]) {
      this.modeTimer = 0;
      this.modeIndex++;
      this.ghosts.forEach(g => g.reverse());
    }
  }

  pacSpeed() {
    const s = levelSpeeds(this.level);
    return BASE_SPEED * (this.frightTimer > 0 ? s.pacFright : s.pac);
  }

  ghostSpeed(ghost) {
    const s = levelSpeeds(this.level);
    if (ghost.state === 'eaten' || ghost.state === 'entering') return EATEN_SPEED;
    if (ghost.state === 'house' || ghost.state === 'leaving') return HOUSE_SPEED;
    if (this.maze.isTunnel(ghost.tileX, ghost.tileY)) return BASE_SPEED * s.tunnel;
    if (ghost.frightened) return BASE_SPEED * s.ghostFright;
    return BASE_SPEED * s.ghost;
  }

  eatPellet(x, y) {
    const eaten = this.maze.eat(x, y);
    if (!eaten) return;
    this.dotsEaten++;
    this.dotCounter++;
    this.releaseTimer = 0;
    this.sound.waka();
    if (eaten === PELLET) {
      this.addScore(10);
    } else {
      this.addScore(50);
      this.frighten();
    }
    if (this.dotsEaten === 70 || this.dotsEaten === 170) {
      this.fruit = { ...fruitForLevel(this.level), timer: 9.5 };
    }
  }

  frighten() {
    const duration = FRIGHT_TIMES[this.level - 1] ?? 0;
    this.frightTimer = duration;
    this.ghostCombo = 0;
    for (const g of this.ghosts) {
      g.reverse();
      if (duration > 0 && g.state !== 'eaten' && g.state !== 'entering') g.frightened = true;
    }
  }

  updateFruit(dt) {
    if (!this.fruit) return;
    this.fruit.timer -= dt;
    const pac = this.pacman;
    if (Math.abs(pac.x - FRUIT_POS.x) < 0.6 && Math.abs(pac.y - FRUIT_POS.y) < 0.5) {
      this.addScore(this.fruit.points);
      this.sound.fruit();
      this.popups.push({ x: FRUIT_POS.x, y: FRUIT_POS.y, text: String(this.fruit.points), color: '#ffb8ff', timer: 2 });
      this.fruit = null;
    } else if (this.fruit.timer <= 0) {
      this.fruit = null;
    }
  }

  // Releases house ghosts in order, by pellet count or after a stretch with no pellets eaten.
  releaseGhosts(dt) {
    const next = this.ghosts.find(g => g.state === 'house');
    if (!next) return;
    this.releaseTimer += dt;
    const limit = releaseLimits(this.level, this.lifeLost)[this.ghosts.indexOf(next) - 1];
    if (this.dotCounter >= limit || this.releaseTimer >= (this.level < 5 ? 4 : 3)) {
      next.release();
      this.releaseTimer = 0;
    }
  }

  checkCollisions() {
    const pac = this.pacman;
    for (const g of this.ghosts) {
      if (g.state !== 'active') continue;
      if (Math.abs(g.x - pac.x) >= 0.6 || Math.abs(g.y - pac.y) >= 0.6) continue;
      if (g.frightened) {
        this.eatGhost(g);
      } else {
        this.state = 'dying';
        this.stateTimer = DEATH_TIME;
        this.sound.death(0.5); // starts with the shrinking animation, after the freeze
        return;
      }
    }
  }

  eatGhost(ghost) {
    this.ghostCombo++;
    const points = 200 * 2 ** (this.ghostCombo - 1);
    this.addScore(points);
    this.sound.eatGhost();
    ghost.state = 'eaten';
    ghost.frightened = false;
    this.eatenGhost = ghost;
    this.popups.push({ x: ghost.x, y: ghost.y, text: String(points), color: '#00ffff', timer: 0.6 });
    this.state = 'ghostEaten';
    this.stateTimer = 0.6;
  }

  afterDeath() {
    this.lives--;
    saveHighScore(this.highScore);
    if (this.lives <= 0) {
      this.state = 'gameOver';
      this.stateTimer = 4;
      return;
    }
    this.resetActors();
    this.lifeLost = true;
  }

  addScore(points) {
    this.score += points;
    while (this.score >= this.nextExtraLife) {
      this.nextExtraLife += EXTRA_LIFE_EVERY;
      this.lives++;
      this.sound.extraLife();
      this.popups.push({ x: this.pacman.x, y: this.pacman.y - 1.5, text: '1UP', color: '#ffff00', timer: 1.5 });
    }
    if (this.score > this.highScore) this.highScore = this.score;
  }

  draw() {
    const ctx = this.ctx;
    const s = this.state;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    this.drawHud();

    ctx.save();
    ctx.translate(0, HUD_TOP * TILE);
    const flash = s === 'levelComplete' && Math.floor(this.stateTimer * 4) % 2 === 0;
    const showPower = s !== 'playing' || this.paused || Math.floor(this.time * 5) % 2 === 0;
    this.maze.draw(ctx, flash ? '#ffffff' : '#2121de', showPower);
    if (this.fruit) drawFruit(ctx, this.fruit, (FRUIT_POS.x + 0.5) * TILE, (FRUIT_POS.y + 0.5) * TILE, TILE * 0.7);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, COLS * TILE, ROWS * TILE);
    ctx.clip();
    const deathElapsed = s === 'dying' ? DEATH_TIME - this.stateTimer : 0;
    const showGhosts = s === 'ready' || s === 'playing' || s === 'ghostEaten' || (s === 'dying' && deathElapsed < 0.5);
    if (showGhosts) {
      for (const g of this.ghosts) {
        if (!(s === 'ghostEaten' && g === this.eatenGhost)) g.draw(ctx, this);
      }
    }
    if (s !== 'title' && s !== 'gameOver' && s !== 'ghostEaten') {
      this.pacman.draw(ctx, s === 'dying' && deathElapsed >= 0.5 ? Math.min(1, (deathElapsed - 0.5) / 1.5) : null);
    }
    ctx.restore();

    for (const p of this.popups) {
      drawText(ctx, p.text, (p.x + 0.5) * TILE, (p.y + 0.5) * TILE, p.color, 10);
    }
    if (s === 'ready') drawText(ctx, 'READY!', 14 * TILE, 17.5 * TILE, '#ffff00');
    if (s === 'gameOver') drawText(ctx, 'GAME  OVER', 14 * TILE, 17.5 * TILE, '#ff0000');
    ctx.restore();

    this.drawFooter();
    if (s === 'title') this.drawTitle();
    if (this.paused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      drawText(ctx, 'PAUSED', WIDTH / 2, HEIGHT / 2, '#ffff00');
      drawText(ctx, 'P OR TAP TO RESUME', WIDTH / 2, HEIGHT / 2 + 32, '#ffffff', 10);
    }
  }

  drawHud() {
    const ctx = this.ctx;
    if (this.state === 'title' || Math.floor(this.time * 3) % 2 === 0) {
      drawText(ctx, '1UP', 3 * TILE, TILE, '#ffffff', 16, 'left');
    }
    drawText(ctx, String(this.score || '00'), 7 * TILE, 2 * TILE, '#ffffff', 16, 'right');
    drawText(ctx, 'HIGH SCORE', 14 * TILE, TILE, '#ffffff');
    drawText(ctx, String(this.highScore || '00'), 17 * TILE, 2 * TILE, '#ffffff', 16, 'right');
    if (this.sound.muted) drawText(ctx, 'MUTED', 27 * TILE, 2 * TILE, '#ffb8ae', 10, 'right');
  }

  drawFooter() {
    const ctx = this.ctx;
    const y = (HUD_TOP + ROWS + 1) * TILE;
    for (let i = 0; i < Math.min(this.lives - 1, MAX_LIFE_ICONS); i++) {
      drawPacmanShape(ctx, (3 + i * 2) * TILE, y, TILE * 0.7, DIRS.left, 0.8);
    }
    if (this.state === 'title') return;
    for (let i = 0; i < Math.min(this.level, 7); i++) {
      drawFruit(ctx, fruitForLevel(this.level - i), (25 - i * 2) * TILE, y, TILE * 0.7);
    }
  }

  drawTitle() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, HUD_TOP * TILE, WIDTH, ROWS * TILE);
    drawText(ctx, 'PAC-MAN', WIDTH / 2, 10 * TILE, '#ffff00', 32);
    GHOSTS.forEach((g, i) => drawText(ctx, g.name.toUpperCase(), WIDTH / 2, (14 + i * 1.5) * TILE, g.color, 12));
    drawText(ctx, 'PRESS ENTER OR TAP', WIDTH / 2, 23 * TILE, '#ffffff', 12);
    drawText(ctx, 'ARROWS/WASD/SWIPE TO MOVE', WIDTH / 2, 26 * TILE, '#ffb8ae', 10);
    drawText(ctx, 'P TO PAUSE  M TO MUTE', WIDTH / 2, 27.5 * TILE, '#ffb8ae', 10);
    drawText(ctx, 'EXTRA LIFE AT 10000', WIDTH / 2, 30 * TILE, '#ffff00', 10);
    drawText(ctx, 'AND EVERY 20000 AFTER', WIDTH / 2, 31.5 * TILE, '#ffff00', 10);
  }
}
