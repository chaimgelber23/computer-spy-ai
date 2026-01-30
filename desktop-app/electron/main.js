const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { Tracker } = require('./tracker');

const store = new Store({
  name: 'workflow-spy-config',
  encryptionKey: 'workflow-spy-2024',
});

let mainWindow = null;
let tray = null;
let tracker = null;

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 520,
    resizable: false,
    frame: true,
    title: 'Workflow Spy',
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../assets/icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Workflow Spy');
  updateTrayMenu(false);

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function updateTrayMenu(isTracking = false, stats = null) {
  const template = [
    {
      label: `Workflow Spy${isTracking ? ' - Active' : ''}`,
      enabled: false,
    },
    { type: 'separator' },
  ];

  if (stats) {
    template.push({
      label: `Logs: ${stats.logsWritten} | Active: ${Math.floor(stats.totalActiveTime / 60)}min`,
      enabled: false,
    });
    template.push({ type: 'separator' });
  }

  template.push(
    {
      label: isTracking ? 'Pause Tracking' : 'Resume Tracking',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('toggle-tracking');
        }
      },
    },
    {
      label: 'Show Window',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        if (tracker) tracker.stop();
        app.isQuitting = true;
        app.quit();
      },
    }
  );

  tray.setContextMenu(Menu.buildFromTemplate(template));
}

// ===== IPC Handlers =====

ipcMain.handle('get-config', () => {
  return {
    deviceKey: store.get('deviceKey'),
    email: store.get('email') || store.get('username'),
    userId: store.get('userId'),
    serverUrl: store.get('serverUrl', ''),
    isRegistered: !!store.get('deviceKey'),
  };
});

ipcMain.handle('save-config', (event, config) => {
  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined) store.set(key, value);
  }
  return true;
});

ipcMain.handle('clear-config', () => {
  store.clear();
  return true;
});

// Tracking IPC
ipcMain.handle('start-tracking', async (event, config) => {
  if (tracker) tracker.stop();
  tracker = new Tracker();
  await tracker.start(config);

  // Send stats to renderer every 2 seconds
  setInterval(() => {
    if (mainWindow && tracker) {
      mainWindow.webContents.send('stats-update', {
        stats: tracker.getStats(),
        activity: tracker.getCurrentActivity(),
      });
      updateTrayMenu(!tracker.isPaused, tracker.getStats());
    }
  }, 2000);

  return true;
});

ipcMain.handle('stop-tracking', () => {
  if (tracker) tracker.stop();
  return true;
});

ipcMain.handle('pause-tracking', () => {
  if (tracker) tracker.pause();
  return true;
});

ipcMain.handle('resume-tracking', () => {
  if (tracker) tracker.resume();
  return true;
});

ipcMain.handle('get-tracking-stats', () => {
  return tracker ? tracker.getStats() : null;
});

ipcMain.handle('get-current-activity', () => {
  return tracker ? tracker.getCurrentActivity() : null;
});

ipcMain.on('update-tray', (event, { isTracking, stats }) => {
  updateTrayMenu(isTracking, stats);
});

ipcMain.on('minimize-to-tray', () => {
  if (mainWindow) mainWindow.hide();
});

// ===== App Lifecycle =====

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // Keep running in tray
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  if (tracker) tracker.stop();
  app.isQuitting = true;
});
