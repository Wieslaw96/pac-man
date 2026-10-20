'use strict';

(function () {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  const muteButton = document.getElementById('mute-button');

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
