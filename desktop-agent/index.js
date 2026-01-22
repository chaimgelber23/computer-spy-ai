import activeWin from 'active-win';
import desktopIdle from 'desktop-idle';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import fs from 'fs';
import readline from 'readline';

config();

// --- Configuration ---
const SERVICE_ACCOUNT_PATH = './service-account.json';
const CONFIG_FILE_PATH = './agent-config.json';
const POLL_INTERVAL_MS = 2000;
const IDLE_THRESHOLD_SECONDS = 60;
const CHECKPOINT_INTERVAL_MS = 300000;
const MIN_LOG_DURATION_SECONDS = 2;

// --- Config Management ---
let agentConfig = {
    userId: process.env.USER_ID || 'local-user'
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
let db;
try {
    if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
        initializeApp({
            credential: cert(serviceAccount)
        });
        db = getFirestore();
    } else {
        console.log("\n⚠️  NOTICE: service-account.json not found.");
        console.log("   For this demo, we will try to use default credentials.");
        initializeApp();
        db = getFirestore();
    }
} catch (error) {
    console.error("❌ Failed to initialize Firebase:", error.message);
    process.exit(1);
}

// --- Setup Wizard ---
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

async function runSetup() {
    console.clear();
    console.log("========================================");
    console.log("   🕵️  Computer Spy AI - Agent Setup");
    console.log("========================================");

    if (agentConfig.userId === 'local-user') {
        console.log("\nIt looks like this is your first run (or no user configured).");
        console.log("Please enter your Device Key from the web dashboard.");
        console.log("(Go to Dashboard > Settings to find it)\n");

        while (true) {
            const inputId = await askQuestion("🔑 Enter Device Key: ");
            if (inputId && inputId.trim().length > 5) {
                agentConfig.userId = inputId.trim();
                fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(agentConfig, null, 2));
                console.log("✅ Configuration saved!");
                break;
            } else {
                console.log("❌ Invalid key. Please try again.");
            }
        }
    } else {
        console.log(`\n✅ Using configured User ID: ${agentConfig.userId}`);
        console.log("(Delete agent-config.json to reset)\n");
    }

    // Start main loop
    startTracking();
}


// --- Tracking Logic ---
let currentLog = null;
let lastCheckpointTime = Date.now();
let stats = {
    logsWritten: 0,
    totalActiveTime: 0,
    totalIdleTime: 0,
    sessionStart: new Date().toISOString()
};

async function saveLog(log, isCheckpoint = false) {
    if (!log) return;

    const endTime = Date.now();
    const startTime = log.startTime;
    const grossDuration = (endTime - startTime) / 1000;
    const idleDuration = log.idleTime || 0;
    const activeDuration = Math.max(0, grossDuration - idleDuration);

    if (activeDuration < MIN_LOG_DURATION_SECONDS) return;

    const entry = {
        userId: agentConfig.userId,
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
        await db.collection('activity_logs').add(entry);
        stats.logsWritten++;
        stats.totalActiveTime += activeDuration;

        const marker = isCheckpoint ? "📍 Checkpoint" : "💾 Saved";
        // Shorter log for better UX
        const cleanTitle = entry.windowTitle.length > 40 ? entry.windowTitle.substring(0, 40) + '...' : entry.windowTitle;
        console.log(`${marker}: [${entry.appName}] ${cleanTitle}`);
    } catch (e) {
        console.error("❌ Error saving log:", e.message);
    }
}

function getIdleSeconds() {
    try {
        return desktopIdle.getIdleTime();
    } catch (e) {
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

            // Less verbose idle logging
            if (Math.floor(idleSeconds) % 60 === 0) {
                process.stdout.write(`\r😴 Idle for ${Math.floor(idleSeconds / 60)}m...  `);
            }
        } else if (currentLog) {
            const isSame =
                result &&
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
        // Silent error for cleaner UI, unless critical
    }

    setTimeout(loop, POLL_INTERVAL_MS);
}

function startTracking() {
    console.log("🚀 Agent Active & Tracking...");
    console.log(`   User ID: ${agentConfig.userId}`);
    console.log("   Press Ctrl+C to stop.\n");
    loop();
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log("\n\n🛑 Shutting down...");
    if (currentLog) {
        await saveLog(currentLog, false);
    }
    console.log(`\n📊 Session Stats:`);
    console.log(`   Logs written: ${stats.logsWritten}`);
    console.log(`   Active time: ${(stats.totalActiveTime / 60).toFixed(1)} minutes`);
    process.exit(0);
});

// Start the app
runSetup();
