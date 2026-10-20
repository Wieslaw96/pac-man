'use strict';

const MUTED_KEY = 'pacman.muted';

// Opening jingle as [frequency Hz, duration s] pairs (~3.8 s).
const INTRO = [
  [494, 0.12], [988, 0.12], [740, 0.12], [622, 0.12], [988, 0.06], [740, 0.18], [622, 0.24],
  [523, 0.12], [1047, 0.12], [784, 0.12], [659, 0.12], [1047, 0.06], [784, 0.18], [659, 0.24],
  [494, 0.12], [988, 0.12], [740, 0.12], [622, 0.12], [988, 0.06], [740, 0.18], [622, 0.24],
  [622, 0.06], [659, 0.06], [698, 0.12], [698, 0.06], [740, 0.06], [784, 0.12], [784, 0.06],
  [831, 0.06], [880, 0.12], [988, 0.24],
];
const INTRO_LENGTH = INTRO.reduce((sum, [, d]) => sum + d, 0);

// Continuous background sounds: an oscillator whose pitch is wobbled by an LFO.
const LOOPS = {
  siren: { type: 'sine', freq: 340, rise: 160, depth: 110, rate: 2.6, volume: 0.22 },
  fright: { type: 'square', freq: 170, rise: 0, depth: 60, rate: 9, volume: 0.06 },
  eyes: { type: 'square', freq: 900, rise: 0, depth: 300, rate: 14, volume: 0.05 },
};

function loadMuted() {
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

// All sounds are synthesised with Web Audio, so there are no audio files. Browsers only
// allow audio after a user gesture, so nothing plays until unlock() is called from one;
// before that (or without Web Audio support) every method is a no-op.
class Sound {
  constructor() {
    this.ctx = null;
    this.muted = loadMuted();
    this.loopName = null;
    this.loopNodes = null;
    this.wakaFlip = false;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.3;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.3, this.ctx.currentTime, 0.02);
    try {
      localStorage.setItem(MUTED_KEY, this.muted ? '1' : '0');
    } catch {
      // storage unavailable; the setting just won't persist
    }
  }

  // One note, optionally sliding exponentially from `from` to `to` Hz.
  tone(type, from, to, duration, volume = 0.5, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.setValueAtTime(volume, t + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  intro() {
    let t = 0;
    for (const [freq, duration] of INTRO) {
      this.tone('square', freq, freq, duration * 0.9, 0.25, t);
      this.tone('triangle', freq / 4, freq / 4, duration * 0.9, 0.4, t);
      t += duration;
    }
  }

  waka() {
    this.wakaFlip = !this.wakaFlip;
    if (this.wakaFlip) this.tone('triangle', 520, 260, 0.09, 0.6);
    else this.tone('triangle', 260, 520, 0.09, 0.6);
  }

  eatGhost() {
    this.tone('square', 200, 1400, 0.45, 0.25);
  }

  fruit() {
    this.tone('sine', 400, 1000, 0.12, 0.6);
    this.tone('sine', 1000, 400, 0.12, 0.6, 0.12);
  }

  extraLife() {
    for (let i = 0; i < 6; i++) this.tone('square', 1050, 1050, 0.08, 0.2, i * 0.15);
  }

  death(delay = 0) {
    for (let i = 0; i < 10; i++) {
      this.tone('sawtooth', 900 - i * 65, 450 - i * 35, 0.11, 0.25, delay + i * 0.12);
    }
    this.tone('square', 150, 700, 0.1, 0.25, delay + 1.3);
    this.tone('square', 150, 700, 0.1, 0.25, delay + 1.45);
  }

  // Switches the background loop (null stops it). `progress` 0..1 raises the siren pitch
  // as the level is cleared.
  setLoop(name, progress = 0) {
    if (!this.ctx) return;
    if (name !== this.loopName) {
      if (this.loopNodes) {
        this.loopNodes.osc.stop();
        this.loopNodes.lfo.stop();
      }
      this.loopNodes = null;
      this.loopName = name;
      if (!name) return;

      const spec = LOOPS[name];
      const osc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const depth = this.ctx.createGain();
      const gain = this.ctx.createGain();
      osc.type = spec.type;
      osc.frequency.value = spec.freq;
      lfo.frequency.value = spec.rate;
      depth.gain.value = spec.depth;
      gain.gain.value = spec.volume;
      lfo.connect(depth).connect(osc.frequency);
      osc.connect(gain).connect(this.master);
      osc.start();
      lfo.start();
      this.loopNodes = { osc, lfo, spec, freq: spec.freq };
    }
    if (!this.loopNodes) return;
    const { osc, spec } = this.loopNodes;
    const freq = spec.freq + spec.rise * progress;
    if (Math.abs(freq - this.loopNodes.freq) > 1) {
      osc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
      this.loopNodes.freq = freq;
    }
  }
}
