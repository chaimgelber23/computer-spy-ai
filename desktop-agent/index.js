import activeWin from 'active-win';
import desktopIdle from 'desktop-idle';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, setDoc, Timestamp } from 'firebase/firestore';
import { config } from 'dotenv';
import fs from 'fs';
import readline from 'readline';

config();

// --- Configuration ---
const CONFIG_FILE_PATH = './agent-config.json';
const POLL_INTERVAL_MS = 2000;
const IDLE_THRESHOLD_SECONDS = 60;
const CHECKPOINT_INTERVAL_MS = 300000; // 5 minutes
const MIN_LOG_DURATION_SECONDS = 2;
const HEARTBEAT_INTERVAL_MS = 60000; // 1 minute
const AGENT_VERSION = '2.0.0';

// Firebase config - same as web app
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCKnUHdSBTaLqqwhKrvYUd_he_afE4eUaU",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "computer-spy-ai.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "computer-spy-ai",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "computer-spy-ai.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "253176543219",
    appId: process.env.FIREBASE_APP_ID || "1:253176543219:web:6db0b7f179593c39a88486"
};

// --- Config Management ---
let agentConfig = {
    email: null,
    // Note: We don't store password for security - user enters it each time
};

if (fs.existsSync(CONFIG_FILE_PATH)) {
    try {
        const savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf8'));
        agentConfig = { ...agentConfig, ...savedConfig };
    } catch (e) {
        console.warn("⚠️ Could not read agent-config.json");
    }
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Current user
let currentUser = null;

// --- Setup Wizard ---
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

async function runSetup() {
    console.clear();
    console.log("========================================");
    console.log("   🕵️  Computer Spy AI - Desktop Agent");
    console.log(`   Version: ${AGENT_VERSION}`);
    console.log("========================================");

    // Get email
    let email = agentConfig.email;
    if (!email) {
        console.log("\nPlease log in with your Computer Spy AI account.\n");
        email = await askQuestion("📧 Email: ");
        email = email.trim();
    } else {
        console.log(`\n📧 Logging in as: ${email}`);
        console.log("   (Delete agent-config.json to use a different account)\n");
    }

    // Get password
    const password = await askQuestion("🔑 Password: ");

    console.log("\n🔌 Signing in...");

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        currentUser = userCredential.user;

        // Save email for next time (but not password!)
        agentConfig.email = email;
        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(agentConfig, null, 2));

        console.log("✅ Signed in successfully!");

        // Verify connection by sending first heartbeat
        console.log("🔌 Verifying connection...");
        const connected = await sendHeartbeat(true);
        if (!connected) {
            console.error("❌ Could not connect to server. Please try again.");
            process.exit(1);
        }

        // Start main loop
        rl.close();
        startTracking();

    } catch (error) {
        console.error("\n❌ Login failed:", error.message);

        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            console.error("   Please check your email and password.");
        } else if (error.code === 'auth/too-many-requests') {
            console.error("   Too many failed attempts. Please try again later.");
        } else if (error.code === 'auth/network-request-failed') {
            console.error("   Network error. Please check your internet connection.");
        }

        // Clear saved email on auth error
        agentConfig.email = null;
        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(agentConfig, null, 2));

        process.exit(1);
    }
}


// --- Heartbeat System ---
let heartbeatInterval = null;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;

async function sendHeartbeat(isInitial = false) {
    if (!currentUser) return false;

    try {
        const heartbeatData = {
            userId: currentUser.uid,
            lastSeen: Timestamp.now(),
            platform: process.platform,
            version: AGENT_VERSION,
            isActive: true
        };

        // Use set with merge to update or create
        await setDoc(doc(db, 'agent_heartbeats', currentUser.uid), heartbeatData, { merge: true });

        if (isInitial) {
            console.log("✅ Connection verified!");
        }
        consecutiveErrors = 0;
        return true;
    } catch (e) {
        consecutiveErrors++;
        if (isInitial) {
            console.error("❌ Heartbeat failed:", e.message);
        } else if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.error(`\n❌ Lost connection to server (${consecutiveErrors} failures). Retrying...`);
        }
        return false;
    }
}

function startHeartbeat() {
    sendHeartbeat();
    heartbeatInterval = setInterval(() => sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
}

async function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    // Mark agent as inactive
    if (currentUser) {
        try {
            await setDoc(doc(db, 'agent_heartbeats', currentUser.uid), {
                isActive: false,
                lastSeen: Timestamp.now()
            }, { merge: true });
        } catch (e) {
            // Ignore errors on shutdown
        }
    }
}


// --- Tracking Logic ---
let currentLog = null;
let lastCheckpointTime = Date.now();
let stats = {
    logsWritten: 0,
    totalActiveTime: 0,
    totalIdleTime: 0,
    errors: 0,
    sessionStart: new Date().toISOString()
};

async function saveLog(log, isCheckpoint = false) {
    if (!log || !currentUser) return;

    const endTime = Date.now();
    const startTime = log.startTime;
    const grossDuration = (endTime - startTime) / 1000;
    const idleDuration = log.idleTime || 0;
    const activeDuration = Math.max(0, grossDuration - idleDuration);

    if (activeDuration < MIN_LOG_DURATION_SECONDS) return;

    const entry = {
        userId: currentUser.uid,
        timestamp: Timestamp.fromMillis(startTime),
        endTime: Timestamp.fromMillis(endTime),
        appName: log.owner ? log.owner.name : "Unknown",
        windowTitle: log.title || "Unknown",
        url: log.url || null,
        durationSeconds: activeDuration,
        grossDurationSeconds: grossDuration,
        idleSeconds: idleDuration,
        platform: process.platform,
        isCheckpoint: isCheckpoint
    };

    try {
        await addDoc(collection(db, 'activity_logs'), entry);
        stats.logsWritten++;
        stats.totalActiveTime += activeDuration;

        const marker = isCheckpoint ? "📍 Checkpoint" : "💾 Saved";
        // Shorter log for better UX
        const cleanTitle = entry.windowTitle.length > 40 ? entry.windowTitle.substring(0, 40) + '...' : entry.windowTitle;
        console.log(`${marker}: [${entry.appName}] ${cleanTitle}`);
    } catch (e) {
        stats.errors++;
        console.error("❌ Error saving log:", e.message);

        // If too many errors, show troubleshooting info
        if (stats.errors % 10 === 0) {
            console.error(`\n⚠️ ${stats.errors} errors so far. Check your internet connection.`);
        }
    }
}

function getIdleSeconds() {
    try {
        return desktopIdle.getIdleTime();
    } catch (e) {
        // Only log once, not every poll
        if (!getIdleSeconds.errorLogged) {
            console.warn("⚠️ Could not get idle time. Idle detection disabled.");
            getIdleSeconds.errorLogged = true;
        }
        return 0;
    }
}

async function loop() {
    try {
        const result = await activeWin();
        const now = Date.now();
        const idleSeconds = getIdleSeconds();
        const isIdle = idleSeconds >= IDLE_THRESHOLD_SECONDS;

        if (isIdle) {
            if (currentLog) {
                currentLog.idleTime = (currentLog.idleTime || 0) + (POLL_INTERVAL_MS / 1000);
            }
            stats.totalIdleTime += POLL_INTERVAL_MS / 1000;

            // Less verbose idle logging - only show every minute
            if (Math.floor(idleSeconds) % 60 === 0 && idleSeconds > 0) {
                process.stdout.write(`\r😴 Idle for ${Math.floor(idleSeconds / 60)}m...  `);
            }
        } else if (currentLog) {
            const isSame =
                result &&
                result.owner &&
                currentLog.owner &&
                result.owner.name === currentLog.owner.name &&
                result.title === currentLog.title;

            const timeSinceCheckpoint = now - lastCheckpointTime;

            if (timeSinceCheckpoint >= CHECKPOINT_INTERVAL_MS && isSame) {
                await saveLog(currentLog, true);
                currentLog = { ...result, startTime: now, idleTime: 0 };
                lastCheckpointTime = now;
            } else if (!isSame) {
                await saveLog(currentLog, false);
                currentLog = result ? { ...result, startTime: now, idleTime: 0 } : null;
                lastCheckpointTime = now;
            }
        } else if (result) {
            currentLog = { ...result, startTime: now, idleTime: 0 };
            lastCheckpointTime = now;
        }

    } catch (error) {
        // Log errors but don't spam
        if (!loop.lastError || Date.now() - loop.lastError > 60000) {
            console.error(`\n⚠️ Tracking error: ${error.message}`);
            loop.lastError = Date.now();
        }
    }

    setTimeout(loop, POLL_INTERVAL_MS);
}

function startTracking() {
    console.log("\n🚀 Agent Active & Tracking...");
    console.log(`   Logged in as: ${currentUser.email}`);
    console.log(`   Platform: ${process.platform}`);
    console.log("   Press Ctrl+C to stop.\n");

    // Start heartbeat
    startHeartbeat();

    // Start main tracking loop
    loop();
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log("\n\n🛑 Shutting down...");

    // Save any pending log
    if (currentLog) {
        await saveLog(currentLog, false);
    }

    // Stop heartbeat and mark as inactive
    await stopHeartbeat();

    // Print session stats
    console.log(`\n📊 Session Stats:`);
    console.log(`   Session started: ${stats.sessionStart}`);
    console.log(`   Logs written: ${stats.logsWritten}`);
    console.log(`   Active time: ${(stats.totalActiveTime / 60).toFixed(1)} minutes`);
    console.log(`   Idle time: ${(stats.totalIdleTime / 60).toFixed(1)} minutes`);
    if (stats.errors > 0) {
        console.log(`   Errors: ${stats.errors}`);
    }

    process.exit(0);
});

// Handle uncaught errors gracefully
process.on('uncaughtException', async (error) => {
    console.error('\n❌ Unexpected error:', error.message);
    console.error('   The agent will continue running...');
});

process.on('unhandledRejection', async (reason) => {
    console.error('\n❌ Unhandled promise rejection:', reason);
    console.error('   The agent will continue running...');
});

// Start the app
runSetup();
