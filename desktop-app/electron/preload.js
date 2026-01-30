const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  clearConfig: () => ipcRenderer.invoke('clear-config'),

  // Tracking - delegated to main process (which has access to native modules)
  startTracking: (config) => ipcRenderer.invoke('start-tracking', config),
  stopTracking: () => ipcRenderer.invoke('stop-tracking'),
  pauseTracking: () => ipcRenderer.invoke('pause-tracking'),
  resumeTracking: () => ipcRenderer.invoke('resume-tracking'),
  getTrackingStats: () => ipcRenderer.invoke('get-tracking-stats'),
  getCurrentActivity: () => ipcRenderer.invoke('get-current-activity'),

  // Tray
  updateTray: (data) => ipcRenderer.send('update-tray', data),
  minimizeToTray: () => ipcRenderer.send('minimize-to-tray'),

  // Events from main
  onToggleTracking: (callback) => ipcRenderer.on('toggle-tracking', callback),
  onStatsUpdate: (callback) => ipcRenderer.on('stats-update', (_, data) => callback(data)),

  // Platform info
  platform: process.platform,
});
