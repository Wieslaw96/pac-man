# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running

Pac-Man in plain HTML/JS + Canvas, also packaged as a Windows desktop app with Electron. The game has no build step, linter or test suite: open `index.html` directly in a browser (it works from `file://`), or serve the folder (`python -m http.server`) and reload after edits. There are no external resources; the "Press Start 2P" font is bundled in `fonts/`.

Desktop app (needs `npm install` once):
- `npm start`: runs the game in an Electron window (`electron/main.js` loads `index.html`; F11 toggles fullscreen).
- `npm run dist`: builds a single portable `dist/Pac-Man.exe` (about 95 MB) with electron-builder. The icon comes from `build/icon.png`.
- electron-builder packages only the paths listed in `build.files` in `package.json`. A new top-level file or folder that the game loads must be added there, or it will be missing from the `.exe`.

## Architecture

- **Classic scripts, shared globals.** `index.html` loads `js/*.js` as non-module `<script>` tags in dependency order: `maze → actor → pacman → ghost → input → sound → game → main`. Top-level `const`/`class` declarations are the shared namespace, so a new file must be added to `index.html` after everything it uses. Don't convert to ES modules without also changing how the game is launched, because modules don't load over `file://`.
- **Coordinates are in tile units, with integers at tile centres.** `x = 13.5` sits exactly between two tiles (the start position of Pac-Man and of the ghosts' house exit). Convert to pixels with `(x + 0.5) * TILE`. The maze is drawn after `translate(0, HUD_TOP * TILE)`, so maze row 0 is below the score HUD.
- **Movement (`actor.js`).** `Actor.advance(dist)` moves along `dir` and stops at every tile centre it passes, calling the subclass's `onTileCenter()`. That is the only place turns are decided (Pac-Man applies the buffered `nextDir`, ghosts pick the exit closest to `target`). Walls are checked only at centres, so setting `dir` mid-tile is only safe for reversals. Columns `-1` and `COLS` are virtual tunnel tiles that `wrapTunnel()` joins together, and `Maze.tile()` reports them as open only on `TUNNEL_ROW`.
- **Ghost state machine (`ghost.js`).** `house → leaving → active → eaten → entering → leaving …`. `house`, `leaving` and `entering` move off the grid (`bob` / `followPath` along waypoints), and only `active`/`eaten` use grid movement. `frightened` is a flag on top of a state, not a state of its own. The door counts as a wall for everything; ghosts go through it only by following a path. Each ghost's targeting rule is in `Ghost.computeTarget()`.
- **Game loop (`main.js`, `game.js`).** A fixed 60 Hz `update(dt)` with an accumulator, plus one `draw()` per animation frame. `Game.state` is one of `title | ready | playing | ghostEaten | dying | levelComplete | gameOver`, and `stateTimer` counts down the timed states. `Game` owns all the rules: the scatter/chase schedule (paused while frightened), fright timing, pellet-count and idle-timer ghost releases, fruit, scoring, the extra life and lives. Per-level tuning is in the table functions at the top of `game.js` (`levelSpeeds`, `modeSchedule`, `releaseLimits`, `FRIGHT_TIMES`).
- **Input (`input.js`).** `input.dir` is the last requested direction and stays set. One-shot actions (`'start'`, `'pause'`) must be read with `consume()` during `update`, and `endFrame()` clears whatever is left at the end of each update.
- **Rendering.** Everything is drawn procedurally each frame; there are no image assets. Wall outlines are precomputed in `buildWallSegments()` from `MAP`. `Game.resize()` scales the canvas backing store to its CSS size × devicePixelRatio and applies that scale through `setTransform`, so drawing code always uses logical 448×576 coordinates.
- **Sound (`sound.js`).** Every sound is synthesised with Web Audio; there are no audio files. The `AudioContext` is created only in `Sound.unlock()`, which `main.js` calls on the first key press or tap. Until then, and in Node, every `Sound` method does nothing. `Game` plays one-shot sounds at the moment the matching event happens. `Game.updateSoundLoop()` chooses the single background loop (`siren` / `fright` / `eyes`, or none) from the game state on every update.
- **Mobile / PWA.** Touch input is swipes anywhere on the screen, applied mid-drag once the finger moves 14px (direction), and taps (`'start'`, which also resumes from pause). `#touch-controls` in `index.html` is shown only on touch screens (`hover: none` + `pointer: coarse`): there the canvas runs edge to edge and the controls fill the free space (below it in portrait, beside it in landscape). It holds a D-pad (`#dpad`, one touch area; `main.js` sets `game.input.dir` from the finger's position relative to its centre) and buttons that queue their `data-action` (`pause`, `mute`) on `game.input`. `manifest.webmanifest` + `sw.js` make the game installable; the service worker is registered only over http(s), is network-first, and its `FILES` list must include every file `index.html` loads.
- **Persistence.** The high score (`pacman.highScore`) and the mute setting (`pacman.muted`) are kept in `localStorage`, with every access wrapped in try/catch.

## Verifying changes

There is no test harness in the repo. For logic changes, a quick check is to load the `js/` files (except `main.js`) into a Node `vm` context with stubbed `window`/`document`/canvas (any no-op 2D context Proxy works), then call `game.update(1/60)` many times with random `game.input.dir` values. Assert that Pac-Man and active ghosts never sit on a `WALL` tile.
