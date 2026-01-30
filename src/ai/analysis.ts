'use server';

import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { getAIProvider } from './providers';
import { compressActivityLogs } from './compression';
import type { AIProviderName, AnalysisPeriod, AnalysisResult } from './providers/types';
import { PERIOD_CONFIGS } from './providers/types';

export interface RunAnalysisOptions {
  userId: string;
  period: AnalysisPeriod;
  providerName: AIProviderName;
}

export interface SavedInsight {
  id: string;
  userId: string;
  period: AnalysisPeriod;
  aiProvider: AIProviderName;
  createdAt: FirebaseFirestore.Timestamp;
  periodStart: FirebaseFirestore.Timestamp;
  periodEnd: FirebaseFirestore.Timestamp;
  analysis: AnalysisResult;
  totalActiveHours: number;
  totalIdleHours: number;
}

/**
 * Run analysis for a user over a specific period using a chosen AI provider.
 * Compresses data before sending to AI for better results and lower cost.
 */
export async function runAnalysis(options: RunAnalysisOptions): Promise<SavedInsight> {
  const { userId, period, providerName } = options;
  const db = getAdminDb();
  const config = PERIOD_CONFIGS[period];

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - config.days);

  // Fetch raw logs
  const logsSnapshot = await db.collection('activity_logs')
    .where('userId', '==', userId)
    .where('timestamp', '>=', AdminTimestamp.fromDate(startDate))
    .where('timestamp', '<=', AdminTimestamp.fromDate(endDate))
    .orderBy('timestamp', 'desc')
    .limit(5000) // Get more data since we compress it
    .get();

  if (logsSnapshot.empty) {
    // Save an empty insight so we know we tried
    const emptyResult: AnalysisResult = {
      efficiencyScore: 0,
      summary: `No activity data found for the past ${config.days} days. The desktop agent needs to be running to collect data.`,
      repetitiveTasks: [],
      topApps: [],
      automationOpportunities: [],
    };

    const insight: Omit<SavedInsight, 'id'> = {
      userId,
      period,
      aiProvider: providerName,
      createdAt: AdminTimestamp.now(),
      periodStart: AdminTimestamp.fromDate(startDate),
      periodEnd: AdminTimestamp.fromDate(endDate),
      analysis: emptyResult,
      totalActiveHours: 0,
      totalIdleHours: 0,
    };

    const docRef = await db.collection('insights').add(insight);
    return { id: docRef.id, ...insight };
  }

  // Convert Firestore docs to raw logs
  const rawLogs = logsSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      appName: data.appName as string,
      windowTitle: data.windowTitle as string,
      durationSeconds: data.durationSeconds as number,
      idleSeconds: (data.idleSeconds || 0) as number,
      timestamp: data.timestamp as { toDate(): Date },
    };
  });

  // Compress the data for AI
  const compressedData = compressActivityLogs(rawLogs, config.days, config.label);

  // Run AI analysis
  const provider = await getAIProvider(providerName);
  const analysis = await provider.analyze(compressedData, period);

  // Save the insight
  const insight: Omit<SavedInsight, 'id'> = {
    userId,
    period,
    aiProvider: providerName,
    createdAt: AdminTimestamp.now(),
    periodStart: AdminTimestamp.fromDate(startDate),
    periodEnd: AdminTimestamp.fromDate(endDate),
    analysis,
    totalActiveHours: compressedData.totals.activeHours,
    totalIdleHours: compressedData.totals.idleHours,
  };

  const docRef = await db.collection('insights').add(insight);
  return { id: docRef.id, ...insight };
}

/**
 * Get the analysis progress for a user: which milestones they've hit,
 * which are pending, and when they'll hit the next one.
 */
export async function getUserAnalysisProgress(userId: string) {
  const db = getAdminDb();

  // Get user's first activity log
  const firstLogSnapshot = await db.collection('activity_logs')
    .where('userId', '==', userId)
    .orderBy('timestamp', 'asc')
    .limit(1)
    .get();

  if (firstLogSnapshot.empty) {
    return {
      daysActive: 0,
      firstActivity: null,
      milestones: Object.entries(PERIOD_CONFIGS).map(([period, config]) => ({
        period: period as AnalysisPeriod,
        label: config.label,
        daysRequired: config.days,
        daysRemaining: config.days,
        status: 'locked' as const,
        completedAt: null,
      })),
    };
  }

  const firstActivity = firstLogSnapshot.docs[0].data().timestamp.toDate();
  const now = new Date();
  const daysActive = Math.floor((now.getTime() - firstActivity.getTime()) / (1000 * 60 * 60 * 24));

  // Get existing insights for this user
  const insightsSnapshot = await db.collection('insights')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .get();

  const completedPeriods = new Map<string, Date>();
  for (const doc of insightsSnapshot.docs) {
    const data = doc.data();
    if (!completedPeriods.has(data.period)) {
      completedPeriods.set(data.period, data.createdAt.toDate());
    }
  }

  const milestones = Object.entries(PERIOD_CONFIGS).map(([period, config]) => {
    const completed = completedPeriods.get(period);
    const daysRemaining = Math.max(0, config.days - daysActive);

    let status: 'completed' | 'ready' | 'in_progress' | 'locked';
    if (completed) {
      status = 'completed';
    } else if (daysActive >= config.days) {
      status = 'ready';
    } else if (daysActive >= config.days - 2) {
      status = 'in_progress';
    } else {
      status = 'locked';
    }

    return {
      period: period as AnalysisPeriod,
      label: config.label,
      daysRequired: config.days,
      daysRemaining,
      status,
      completedAt: completed || null,
    };
  });

  return {
    daysActive,
    firstActivity,
    milestones,
  };
}

/**
 * Get all insights for a user, ordered by most recent first.
 */
export async function getUserInsights(userId: string): Promise<SavedInsight[]> {
  const db = getAdminDb();

  const snapshot = await db.collection('insights')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as SavedInsight[];
}
