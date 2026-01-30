// App state
let isTracking = false;

// UI Elements
const setupScreen = document.getElementById('setup-screen');
const trackingScreen = document.getElementById('tracking-screen');
const setupError = document.getElementById('setup-error');

// Initialize
async function init() {
  const config = await window.electronAPI.getConfig();

  if (config.isRegistered && config.serverUrl) {
    showTrackingScreen(config.email);
    await window.electronAPI.startTracking(config);
    isTracking = true;
    updateStatusUI(true);
  } else {
    if (config.serverUrl) {
      document.getElementById('server-url').value = config.serverUrl;
    }
  }

  // Listen for stats updates from main process
  window.electronAPI.onStatsUpdate((data) => {
    if (data.stats) {
      document.getElementById('stat-logs').textContent = data.stats.logsWritten;
      document.getElementById('stat-active').textContent = formatMinutes(data.stats.totalActiveTime);
      document.getElementById('stat-idle').textContent = formatMinutes(data.stats.totalIdleTime);
      document.getElementById('stat-apps').textContent = data.stats.uniqueApps;
    }
    if (data.activity) {
      document.getElementById('current-app').textContent = data.activity.appName || 'Unknown';
      document.getElementById('current-title').textContent = data.activity.windowTitle || '';
    }
  });

  // Listen for tray toggle
  window.electronAPI.onToggleTracking(() => {
    toggleTracking();
  });
}

// Registration
async function handleRegister() {
  const email = document.getElementById('email').value.trim();
  const serverUrl = document.getElementById('server-url').value.trim();
  const btn = document.getElementById('btn-register');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showError('Please enter a valid email address');
    return;
  }

  if (!serverUrl) {
    showError('Server URL is required');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Setting up...';
  hideError();

  try {
    const res = await fetch(`${serverUrl}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        platform: window.electronAPI.platform,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    // Save config
    await window.electronAPI.saveConfig({
      deviceKey: data.deviceKey,
      email: data.email,
      userId: data.userId,
      serverUrl,
    });

    // Show confirmation screen (not tracking screen)
    showConfirmationScreen();

    // Start tracking in background
    await window.electronAPI.startTracking({
      deviceKey: data.deviceKey,
      email: data.email,
      userId: data.userId,
      serverUrl,
      customToken: data.customToken,
    });
    isTracking = true;
    updateStatusUI(true);

  } catch (err) {
    showError(err.message);
    btn.disabled = false;
    btn.textContent = 'Get Started';
  }
}

// Screens
function showConfirmationScreen() {
  setupScreen.style.display = 'none';
  trackingScreen.style.display = 'none';
  document.getElementById('confirmation-screen').style.display = 'flex';
}

function showTrackingScreen(email) {
  setupScreen.style.display = 'none';
  document.getElementById('confirmation-screen').style.display = 'none';
  trackingScreen.style.display = 'flex';
  document.getElementById('username-display').textContent = `Monitoring: ${email || ''}`;
}

function showError(msg) {
  setupError.textContent = msg;
  setupError.style.display = 'block';
}

function hideError() {
  setupError.style.display = 'none';
}

// Tracking controls
async function toggleTracking() {
  isTracking = !isTracking;

  if (isTracking) {
    await window.electronAPI.resumeTracking();
  } else {
    await window.electronAPI.pauseTracking();
  }

  updateStatusUI(isTracking);
}

function updateStatusUI(tracking) {
  const badge = document.getElementById('status-badge');
  const text = document.getElementById('status-text');
  const btn = document.getElementById('btn-pause');

  if (tracking) {
    badge.className = 'status-badge active';
    text.textContent = 'Tracking';
    btn.textContent = 'Pause';
  } else {
    badge.className = 'status-badge paused';
    text.textContent = 'Paused';
    btn.textContent = 'Resume';
  }
}

function formatMinutes(seconds) {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function minimizeToTray() {
  window.electronAPI.minimizeToTray();
}

// Start
init();
