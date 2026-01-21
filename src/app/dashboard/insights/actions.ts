'use server';

import { analyzeActivityFlow } from '@/ai/activityAnalysis';
// import { adminDb } from '@/lib/firebase-admin'; // Use Admin SDK for server-side
import { ActivityLog } from '@/lib/types';
// Note: We need a way to get logs. Client passes them? Or fetch here?
// Fetching here is safer/better.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Ensure Admin is initialized (pattern for Next.js)
// We might need a separate file for this if not existing.
// Assuming we can just fetch logs passed from client for now to avoid Admin SDK setup complexity if not ready.
// Actually, passing 50-100 logs from client is fine.

export async function generateInsightsAction(logs: ActivityLog[]) {
    try {
        // Run the Genkit flow
        const result = await analyzeActivityFlow(logs);
        return result;
    } catch (error: any) {
        console.error("Error generating insights:", error);
        throw new Error(`Failed to generate insights: ${error.message}`);
    }
}
