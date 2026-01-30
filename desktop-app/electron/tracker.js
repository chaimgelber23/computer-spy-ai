/**
 * WorkflowTracker - Runs in Electron's MAIN process.
 * Uses Electron's powerMonitor for idle detection and desktopCapturer for screenshots.
 * Uses active-win for window tracking.
 */

const { powerMonitor, desktopCapturer } = require('electron');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithCustomToken } = require('firebase/auth');
const { getFirestore, collection, addDoc, doc, setDoc, Timestamp } = require('firebase/firestore');

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCKnUHdSBTaLqqwhKrvYUd_he_afE4eUaU",
  authDomain: "computer-spy-ai.firebaseapp.com",
  projectId: "computer-spy-ai",
  storageBucket: "computer-spy-ai.firebasestorage.app",
  messagingSenderId: "253176543219",
  appId: "1:253176543219:web:6db0b7f179593c39a88486"
};

const POLL_INTERVAL_MS = 2000;
const IDLE_THRESHOLD_SECONDS = 60;
const CHECKPOINT_INTERVAL_MS = 300000;
const MIN_LOG_DURATION_SECONDS = 2;
const HEARTBEAT_INTERVAL_MS = 60000;

let activeWinModule = null;

class Tracker {
  constructor() {
    this.isPaused = false;
    this.currentLog = null;
    this.lastCheckpointTime = Date.now();
    this.currentUser = null;
    this.db = null;
    this.config = null;

    this.stats = {
      logsWritten: 0,
      totalActiveTime: 0,
      totalIdleTime: 0,
      errors: 0,
      uniqueAppsSet: new Set(),
    };

    this.currentActivity = {
      appName: 'Starting...',
      windowTitle: 'Initializing...',
    };

    this.pollInterval = null;
    this.heartbeatInterval = null;
  }

  async start(config) {
    this.config = config;

    // Dynamic import of active-win (ESM module)
    try {
      activeWinModule = await import('active-win');
    } catch (e) {
      console.error('Failed to load active-win:', e.message);
    }

    // Init Firebase
    const app = initializeApp(FIREBASE_CONFIG);
    const auth = getAuth(app);
    this.db = getFirestore(app);

    // Auth
    if (config.customToken) {
      try {
        const cred = await signInWithCustomToken(auth, config.customToken);
        this.currentUser = cred.user;
      } catch (e) {
        console.warn('Custom token failed, trying device key...');
      }
    }

    if (!this.currentUser && config.deviceKey && config.serverUrl) {
      try {
        const fetch = (await import('node-fetch')).default;
        const res = await fetch(`${config.serverUrl}/api/register`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceKey: config.deviceKey }),
        });
        const data = await res.json();
        if (data.customToken) {
          const cred = await signInWithCustomToken(auth, data.customToken);
          this.currentUser = cred.user;
        }
      } catch (e) {
        console.error('Re-auth failed:', e.message);
      }
    }

    // Start loops
    this.pollInterval = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    this.poll();

    this.sendHeartbeat();
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS);

    console.log('Tracker started');
  }

  pause() {
    this.isPaused = true;
    if (this.currentLog) {
      this.saveLog(this.currentLog, false);
      this.currentLog = null;
    }
  }

  resume() {
    this.isPaused = false;
  }

  stop() {
    this.isPaused = true;
    clearInterval(this.pollInterval);
    clearInterval(this.heartbeatInterval);
    if (this.currentLog) {
      this.saveLog(this.currentLog, false);
    }
    this.sendHeartbeat(false);
  }

  getStats() {
    return {
      logsWritten: this.stats.logsWritten,
      totalActiveTime: this.stats.totalActiveTime,
      totalIdleTime: this.stats.totalIdleTime,
      uniqueApps: this.stats.uniqueAppsSet.size,
      errors: this.stats.errors,
    };
  }

  getCurrentActivity() {
    return { ...this.currentActivity };
  }

  async poll() {
    if (this.isPaused || !activeWinModule) return;

    try {
      const result = await activeWinModule.default();
      const now = Date.now();

      // Use Electron's powerMonitor for idle detection
      const idleSeconds = powerMonitor.getSystemIdleTime();
      const isIdle = idleSeconds >= IDLE_THRESHOLD_SECONDS;

      if (result) {
        this.currentActivity = {
          appName: result.owner?.name || 'Unknown',
          windowTitle: result.title || 'Unknown',
        };
        this.stats.uniqueAppsSet.add(result.owner?.name || 'Unknown');
      }

      if (isIdle) {
        if (this.currentLog) {
          this.currentLog.idleTime = (this.currentLog.idleTime || 0) + (POLL_INTERVAL_MS / 1000);
        }
        this.stats.totalIdleTime += POLL_INTERVAL_MS / 1000;
        this.currentActivity.windowTitle = `Idle (${Math.floor(idleSeconds / 60)}m)`;
      } else if (this.currentLog) {
        const isSame = result &&
          result.owner &&
          this.currentLog.owner &&
          result.owner.name === this.currentLog.owner.name &&
          result.title === this.currentLog.title;

        const timeSinceCheckpoint = now - this.lastCheckpointTime;

        if (timeSinceCheckpoint >= CHECKPOINT_INTERVAL_MS && isSame) {
          await this.saveLog(this.currentLog, true);
          this.currentLog = { ...result, startTime: now, idleTime: 0 };
          this.lastCheckpointTime = now;
        } else if (!isSame) {
          await this.saveLog(this.currentLog, false);
          this.currentLog = result ? { ...result, startTime: now, idleTime: 0 } : null;
          this.lastCheckpointTime = now;
        }
      } else if (result) {
        this.currentLog = { ...result, startTime: now, idleTime: 0 };
        this.lastCheckpointTime = now;
      }

      if (!isIdle) {
        this.stats.totalActiveTime += POLL_INTERVAL_MS / 1000;
      }
    } catch (e) {
      this.stats.errors++;
    }
  }

  async saveLog(log, isCheckpoint) {
    if (!log || !this.currentUser || !this.db) return;

    const endTime = Date.now();
    const startTime = log.startTime;
    const grossDuration = (endTime - startTime) / 1000;
    const idleDuration = log.idleTime || 0;
    const activeDuration = Math.max(0, grossDuration - idleDuration);

    if (activeDuration < MIN_LOG_DURATION_SECONDS) return;

    const entry = {
      userId: this.currentUser.uid,
      timestamp: Timestamp.fromMillis(startTime),
      endTime: Timestamp.fromMillis(endTime),
      appName: log.owner?.name || 'Unknown',
      windowTitle: log.title || 'Unknown',
      url: log.url || null,
      durationSeconds: activeDuration,
      grossDurationSeconds: grossDuration,
      idleSeconds: idleDuration,
      platform: process.platform,
      isCheckpoint,
    };

    try {
      await addDoc(collection(this.db, 'activity_logs'), entry);
      this.stats.logsWritten++;
    } catch (e) {
      this.stats.errors++;
    }
  }

  async sendHeartbeat(isActive = true) {
    if (!this.currentUser || !this.db) return;

    try {
      await setDoc(
        doc(this.db, 'agent_heartbeats', this.currentUser.uid),
        {
          userId: this.currentUser.uid,
          lastSeen: Timestamp.now(),
          platform: process.platform,
          version: '2.0.0',
          isActive: isActive && !this.isPaused,
        },
        { merge: true }
      );
    } catch (e) {
      // Silently fail
    }
  }
}

module.exports = { Tracker };
