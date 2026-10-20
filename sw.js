'use strict';

// Service worker for the installed web app. Network first, so edits show up on reload;
// the cache is only the offline fallback. FILES must list everything index.html loads.
const CACHE = 'pacman-v1';
const FILES = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'build/icon.png',
  'fonts/press-start-2p-latin-400-normal.woff2',
  'js/maze.js',
  'js/actor.js',
  'js/pacman.js',
  'js/ghost.js',
  'js/input.js',
  'js/sound.js',
  'js/game.js',
  'js/main.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
