'use strict';

(function () {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  const muteButton = document.getElementById('mute-button');
  const dpad = document.getElementById('dpad');

  // Fixed 60 Hz simulation step, decoupled from the display refresh rate.
  const STEP = 1 / 60;
  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    accumulator += Math.min(0.25, (now - last) / 1000);
    last = now;
    while (accumulator >= STEP) {
      game.update(STEP);
      accumulator -= STEP;
    }
    game.draw();
    muteButton.setAttribute('aria-pressed', String(game.sound.muted));
    if (dpad.dataset.dir !== game.input.dir.name) dpad.dataset.dir = game.input.dir.name;
    requestAnimationFrame(frame);
  }

  // Browsers only allow audio to start from a user gesture.
  for (const type of ['keydown', 'pointerdown', 'touchend']) {
    window.addEventListener(type, () => game.sound.unlock());
  }
  window.addEventListener('resize', () => game.resize());

  // On-screen buttons feed the same one-shot actions as the keyboard.
  for (const button of document.querySelectorAll('[data-action]')) {
    button.addEventListener('click', () => game.input.actions.add(button.dataset.action));
  }

  // D-pad: the direction is the arm under the finger, measured from the pad's centre, so
  // sliding the finger round the pad turns without lifting it. A small dead zone in the
  // middle keeps the current direction.
  function steer(e) {
    const r = dpad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.max(Math.abs(dx), Math.abs(dy)) < r.width * 0.1) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      game.input.dir = dx < 0 ? DIRS.left : DIRS.right;
    } else {
      game.input.dir = dy < 0 ? DIRS.up : DIRS.down;
    }
  }
  dpad.addEventListener('pointerdown', e => {
    dpad.setPointerCapture(e.pointerId);
    steer(e);
  });
  dpad.addEventListener('pointermove', e => {
    if (dpad.hasPointerCapture(e.pointerId)) steer(e);
  });

  // Offline support for the installed web app; service workers need http(s), so skip under file://.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.pause();
  });

  // Canvas text doesn't trigger web-font loading by itself.
  document.fonts.load('16px "Press Start 2P"');

  requestAnimationFrame(frame);
})();
