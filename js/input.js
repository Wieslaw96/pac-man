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

    // Swipes work anywhere on the screen (not just the canvas) and turn as soon as the
    // finger has moved SWIPE_PX, without waiting for it to lift. The origin then moves to
    // the current point, so one continuous drag can steer through several corners.
    // A touch that never moves that far is a tap ('start').
    const SWIPE_PX = 14;
    let touch = null;
    window.addEventListener('touchstart', e => {
      if (e.target.closest && e.target.closest('button, #dpad')) return;
      const t = e.changedTouches[0];
      touch = { id: t.identifier, x: t.clientX, y: t.clientY, swiped: false };
    }, { passive: true });
    window.addEventListener('touchmove', e => {
      if (!touch) return;
      e.preventDefault();
      const t = [...e.changedTouches].find(t => t.identifier === touch.id);
      if (!t) return;
      const dx = t.clientX - touch.x;
      const dy = t.clientY - touch.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.dir = dx < 0 ? DIRS.left : DIRS.right;
      } else {
        this.dir = dy < 0 ? DIRS.up : DIRS.down;
      }
      touch.x = t.clientX;
      touch.y = t.clientY;
      touch.swiped = true;
    }, { passive: false });
    window.addEventListener('touchend', e => {
      if (!touch || ![...e.changedTouches].some(t => t.identifier === touch.id)) return;
      e.preventDefault(); // suppress the synthetic click
      if (!touch.swiped) this.actions.add('start');
      touch = null;
    });
    window.addEventListener('touchcancel', () => { touch = null; });
  }

  consume(action) {
    return this.actions.delete(action);
  }

  endFrame() {
    this.actions.clear();
  }
}
