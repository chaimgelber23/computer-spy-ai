'use server';

import { z } from 'zod';
import { ai } from './config';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';

// Initialize Admin SDK if not already done
function getAdminDb() {
    if (getApps().length === 0) {
        // In production, this uses GOOGLE_APPLICATION_CREDENTIALS
        initializeApp();
    }
    return getFirestore();
}

const AnalysisResultSchema = z.object({
    repetitiveTasks: z.array(z.object({
        description: z.string(),
        frequency: z.string(),
        timeWasted: z.string(),
        suggestion: z.string(),
    })),
    efficiencyScore: z.number().min(0).max(100),
    summary: z.string(),
    topApps: z.array(z.object({
        name: z.string(),
        hours: z.number()
    })).optional()
});

export const weeklyAnalysisFlow = ai.defineFlow(
    {
        name: 'weeklyActivityAnalysis',
        inputSchema: z.object({
            userId: z.string().default('local-user'),
            daysBack: z.number().default(7)
        }),
        outputSchema: AnalysisResultSchema,
    },
    async (input) => {
        const db = getAdminDb();

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - input.daysBack);

        // Query logs from past week
        const logsSnapshot = await db.collection('activity_logs')
            .where('userId', '==', input.userId)
            .where('timestamp', '>=', AdminTimestamp.fromDate(startDate))
            .where('timestamp', '<=', AdminTimestamp.fromDate(endDate))
            .orderBy('timestamp', 'desc')
            .limit(500)
            .get();

        if (logsSnapshot.empty) {
            return {
                repetitiveTasks: [],
                efficiencyScore: 0,
                summary: "No activity data found for the past week. Keep the desktop agent running to collect data.",
                topApps: []
            };
        }

        const logs = logsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                app: data.appName,
                title: data.windowTitle,
                duration: data.durationSeconds,
                idleTime: data.idleSeconds || 0
            };
        });

        // Aggregate by app for summary
        const appTotals: Record<string, number> = {};
        let totalActive = 0;
        let totalIdle = 0;

        logs.forEach(log => {
            appTotals[log.app] = (appTotals[log.app] || 0) + log.duration;
            totalActive += log.duration;
            totalIdle += log.idleTime;
        });

        const topApps = Object.entries(appTotals)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([name, seconds]) => ({ name, hours: seconds / 3600 }));

        const prompt = `
You are analyzing a user's computer activity to identify workflow inefficiencies and suggest automation opportunities.

Activity Summary (${input.daysBack} days):
- Total active time: ${(totalActive / 3600).toFixed(1)} hours
- Total idle time: ${(totalIdle / 3600).toFixed(1)} hours
- Apps used: ${Object.keys(appTotals).length}

Top Apps by Time:
${topApps.map(a => `- ${a.name}: ${a.hours.toFixed(1)} hours`).join('\n')}

Detailed Activity Logs (sample):
${JSON.stringify(logs.slice(0, 150))}

Based on this data:
1. Identify repetitive workflows that could be automated (e.g., "User frequently switches between Excel and a web form - suggest building a data entry automation")
2. Identify potential distractions or time sinks
3. Provide an efficiency score (0-100)
4. Give specific, actionable suggestions for building AI agents to help their workflow

Be specific and practical. Focus on patterns that suggest automation opportunities.
`;

        const result = await ai.generate({
            prompt: prompt,
            output: { schema: AnalysisResultSchema },
        });

        if (result.output) {
            return {
                ...result.output,
                topApps
            };
        } else {
            throw new Error("Failed to generate analysis");
        }
    }
);

// Function to run weekly analysis and save results
export async function runAndSaveWeeklyAnalysis(userId: string = 'local-user') {
    const db = getAdminDb();

    const result = await weeklyAnalysisFlow({ userId, daysBack: 7 });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    // Calculate totals from the analysis
    const totalActiveHours = result.topApps?.reduce((sum, app) => sum + app.hours, 0) || 0;

    const insight = {
        createdAt: AdminTimestamp.now(),
        periodStart: AdminTimestamp.fromDate(startDate),
        periodEnd: AdminTimestamp.fromDate(endDate),
        efficiencyScore: result.efficiencyScore,
        summary: result.summary,
        repetitiveTasks: result.repetitiveTasks,
        topApps: result.topApps || [],
        totalActiveHours,
        totalIdleHours: 0, // Would need to sum from logs
        userId
    };

    const docRef = await db.collection('weekly_insights').add(insight);

    return {
        id: docRef.id,
        ...result
    };
}
