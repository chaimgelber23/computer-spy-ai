import activeWin from 'active-win';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

config();

// --- Configuration ---
// Path to service account key. 
// USER MUST PROVIDE THIS FILE: service-account.json
const SERVICE_ACCOUNT_PATH = './service-account.json';

// Initialize Firebase
let db;
try {
    if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
        initializeApp({
            credential: cert(serviceAccount)
        });
        db = getFirestore();
        console.log("Firebase initialized with Service Account.");
    } else {
        console.warn("WARNING: service-account.json not found. Database writes will fail unless GOOGLE_APPLICATION_CREDENTIALS is set.");
        initializeApp(); // Try default credentials
        db = getFirestore();
    }
} catch (error) {
    console.error("Failed to initialize Firebase:", error);
    process.exit(1);
}

// --- State ---
let currentLog = null;
let lastCheckTime = Date.now();
const POLL_INTERVAL_MS = 2000; // Check every 2 seconds
const IDLE_THRESHOLD_MS = 60000; // 1 minute (not implemented deeply active-win has no idle, need 'desktop-idle' or similar, strict to active-win for now)

// We will just log active window changes.

async function saveLog(log) {
    if (!log) return;
    
    // Calculate duration
    const endTime = Date.now();
    const startTime = log.startTime;
    const durationSeconds = (endTime - startTime) / 1000;

    if (durationSeconds < 1) return; // Ignore very short glitches

    const entry = {
        userId: "local-user", // TODO: Configurable user ID
        timestamp: Timestamp.fromMillis(startTime),
        endTime: Timestamp.fromMillis(endTime),
        appName: log.owner ? log.owner.name : "Unknown",
        windowTitle: log.title || "Unknown",
        url: log.url || null, // Only available on macOS with permission, or specific browsers
        durationSeconds: durationSeconds,
        platform: process.platform
    };

    try {
        await db.collection('activity_logs').add(entry);
        console.log(`Saved: [${entry.appName}] ${entry.windowTitle} (${entry.durationSeconds.toFixed(1)}s)`);
    } catch (e) {
        console.error("Error saving log:", e.message);
    }
}

async function loop() {
    try {
        const result = await activeWin();
        
        const now = Date.now();

        if (currentLog) {
            // Check if changed
            const isSame = 
                result && 
                result.owner.name === currentLog.owner.name && 
                result.title === currentLog.title &&
                result.url === currentLog.url;

            if (!isSame) {
                // Window changed, save previous
                await saveLog(currentLog);
                
                // Start new log
                if (result) {
                    currentLog = {
                        ...result,
                        startTime: now
                    };
                } else {
                    currentLog = null; // No active window?
                }
            } else {
                 // Still same window, do nothing (accumulate time)
                 // Maybe checkpoint if too long?
            }
        } else {
            if (result) {
                currentLog = {
                    ...result,
                    startTime: now
                };
            }
        }

    } catch (error) {
        console.error("Error getting active window:", error);
    }

    setTimeout(loop, POLL_INTERVAL_MS);
}

console.log("Starting Desktop Agent...");
loop();
