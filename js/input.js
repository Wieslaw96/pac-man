'use strict';

const KEY_DIRS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

// Keyboard + touch input. `dir` is the last requested direction (held until changed);
// one-shot actions ('start', 'pause', 'mute') are queued and must be consumed each update.
class Input {
  constructor(canvas) {
    this.dir = DIRS.none;
    this.actions = new Set();

    window.addEventListener('keydown', e => {
      const name = KEY_DIRS[e.code];
      if (name) {
        this.dir = DIRS[name];
        e.preventDefault();
      } else if (e.code === 'Enter' || e.code === 'Space') {
        this.actions.add('start');
        e.preventDefault();
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        this.actions.add('pause');
      } else if (e.code === 'KeyM') {
        this.actions.add('mute');
      }
    });

    canvas.addEventListener('click', () => this.actions.add('start'));

    let touchStart = null;
    canvas.addEventListener('touchstart', e => {
      const t = e.changedTouches[0];
      touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchend', e => {
      if (!touchStart) return;
      e.preventDefault(); // suppress the synthetic click
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.x;
      const dy = t.clientY - touchStart.y;
      touchStart = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) {
        this.actions.add('start');
      } else if (Math.abs(dx) > Math.abs(dy)) {
        this.dir = dx < 0 ? DIRS.left : DIRS.right;
      } else {
        this.dir = dy < 0 ? DIRS.up : DIRS.down;
      }
    });
  }

  consume(action) {
    return this.actions.delete(action);
  }

  endFrame() {
    this.actions.clear();
  }
}
