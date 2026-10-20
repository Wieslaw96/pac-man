'use strict';

// Electron entry point: shows the browser game (../index.html) in a plain window.
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function createWindow() {
  const win = new BrowserWindow({
    width: 504,   // 1.125x the 448x576 playfield
    height: 648,
    useContentSize: true,
    minWidth: 280,
    minHeight: 360,
    backgroundColor: '#000000',
    title: 'Pac-Man',
    icon: path.join(ROOT, 'build', 'icon.png'),
  });
  win.loadFile(path.join(ROOT, 'index.html'));

  // With the menu removed, F11 has to be wired up by hand.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
}

Menu.setApplicationMenu(null);
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
