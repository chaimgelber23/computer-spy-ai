import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp();

const PERIOD_CONFIGS = {
  '3-day': { days: 3, label: 'Initial Patterns', focus: 'basic app usage habits and first impressions' },
  '7-day': { days: 7, label: 'Weekly Rhythm', focus: 'weekly patterns, meeting days, deep work vs shallow work' },
  '14-day': { days: 14, label: 'Deep Patterns', focus: 'recurring workflows, bi-weekly cycles, consistent inefficiencies' },
  '21-day': { days: 21, label: 'Full Analysis', focus: 'comprehensive automation opportunities, established habits, ROI estimates' },
};

/**
 * Runs every hour to check if any user has hit an analysis milestone.
 * If they have, automatically runs the analysis.
 */
export const checkAnalysisMilestones = onSchedule(
  {
    schedule: 'every 1 hours',
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '1GiB',
    secrets: ['ANTHROPIC_API_KEY'],
  },
  async () => {
    const db = getFirestore();
    console.log('Checking analysis milestones...');

    // Get all non-admin users
    const usersSnapshot = await db.collection('users')
      .where('role', '==', 'user')
      .get();

    let analysisCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      try {
        // Get first activity log
        const firstLogSnapshot = await db.collection('activity_logs')
          .where('userId', '==', userId)
          .orderBy('timestamp', 'asc')
          .limit(1)
          .get();

        if (firstLogSnapshot.empty) continue;

        const firstActivity = firstLogSnapshot.docs[0].data().timestamp.toDate();
        const now = new Date();
        const daysActive = Math.floor((now.getTime() - firstActivity.getTime()) / (1000 * 60 * 60 * 24));

        // Check each milestone
        for (const [period, config] of Object.entries(PERIOD_CONFIGS)) {
          if (daysActive < config.days) continue;

          // Check if we already have an insight for this period
          const existingInsight = await db.collection('insights')
            .where('userId', '==', userId)
            .where('period', '==', period)
            .limit(1)
            .get();

          if (!existingInsight.empty) continue;

          // Run analysis for this milestone
          console.log(`Running ${period} analysis for user ${userId} (${daysActive} days active)`);
          await runAnalysisForUser(db, userId, period, config);
          analysisCount++;

          // Rate limit: max 5 analyses per function invocation
          if (analysisCount >= 5) {
            console.log('Rate limit reached, stopping');
            return;
          }
        }
      } catch (e) {
        console.error(`Error processing user ${userId}:`, e.message);
      }
    }

    console.log(`Completed. Ran ${analysisCount} analyses.`);
  }
);

async function runAnalysisForUser(db, userId, period, config) {
  // Fetch activity logs
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - config.days);

  const logsSnapshot = await db.collection('activity_logs')
    .where('userId', '==', userId)
    .where('timestamp', '>=', Timestamp.fromDate(startDate))
    .where('timestamp', '<=', Timestamp.fromDate(endDate))
    .orderBy('timestamp', 'desc')
    .limit(5000)
    .get();

  if (logsSnapshot.empty) {
    console.log(`No logs for user ${userId}, skipping`);
    return;
  }

  // Compress data
  const rawLogs = logsSnapshot.docs.map(doc => doc.data());
  const compressed = compressLogs(rawLogs, config.days, config.label);

  // Build prompt
  const prompt = buildPrompt(compressed, period, config);

  // Call AI (Claude by default for automatic analysis)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not configured');
    return;
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent) throw new Error('No text response from Claude');

  let jsonText = textContent.text;
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonText = jsonMatch[1];

  const analysis = JSON.parse(jsonText.trim());

  // Save insight
  await db.collection('insights').add({
    userId,
    period,
    aiProvider: 'claude',
    createdAt: Timestamp.now(),
    periodStart: Timestamp.fromDate(startDate),
    periodEnd: Timestamp.fromDate(endDate),
    analysis,
    totalActiveHours: compressed.totals.activeHours,
    totalIdleHours: compressed.totals.idleHours,
    automatic: true,
  });

  console.log(`Saved ${period} insight for user ${userId}`);
}

function compressLogs(logs, periodDays, periodLabel) {
  const appMap = new Map();
  let totalActiveSeconds = 0;
  let totalIdleSeconds = 0;

  for (const log of logs) {
    const app = log.appName || 'Unknown';
    const existing = appMap.get(app) || { totalSeconds: 0, sessionCount: 0, titles: new Map() };
    existing.totalSeconds += log.durationSeconds || 0;
    existing.sessionCount += 1;

    const title = log.windowTitle || 'Unknown';
    existing.titles.set(title, (existing.titles.get(title) || 0) + (log.durationSeconds || 0));
    appMap.set(app, existing);

    totalActiveSeconds += log.durationSeconds || 0;
    totalIdleSeconds += log.idleSeconds || 0;
  }

  const appUsage = Array.from(appMap.entries())
    .map(([appName, data]) => ({
      appName,
      totalHours: data.totalSeconds / 3600,
      sessionCount: data.sessionCount,
      averageSessionMinutes: data.sessionCount > 0 ? (data.totalSeconds / data.sessionCount) / 60 : 0,
      commonTitles: Array.from(data.titles.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([title, seconds]) => ({ title: title.substring(0, 80), hours: seconds / 3600 })),
    }))
    .sort((a, b) => b.totalHours - a.totalHours);

  return {
    period: { days: periodDays, label: periodLabel },
    appUsage,
    totals: {
      activeHours: totalActiveSeconds / 3600,
      idleHours: totalIdleSeconds / 3600,
      uniqueApps: appMap.size,
      totalSessions: logs.length,
    },
  };
}

function buildPrompt(data, period, config) {
  const appSummary = data.appUsage.slice(0, 15)
    .map(a => `- ${a.appName}: ${a.totalHours.toFixed(1)}h (${a.sessionCount} sessions)`)
    .join('\n');

  const titleDetails = data.appUsage.slice(0, 10)
    .map(a => {
      const titles = a.commonTitles.slice(0, 5)
        .map(t => `    - "${t.title}" (${t.hours.toFixed(1)}h)`)
        .join('\n');
      return `  ${a.appName}:\n${titles}`;
    })
    .join('\n');

  return `You are a workflow automation consultant analyzing a client's computer usage.

ANALYSIS TYPE: ${config.label} (${config.days}-day period)
FOCUS: ${config.focus}

=== ACTIVITY SUMMARY ===
Total Active Time: ${data.totals.activeHours.toFixed(1)} hours
Total Idle Time: ${data.totals.idleHours.toFixed(1)} hours
Unique Apps: ${data.totals.uniqueApps}
Sessions: ${data.totals.totalSessions}

=== TOP APPS ===
${appSummary}

=== WINDOW DETAILS ===
${titleDetails}

Provide:
1. Efficiency Score (0-100)
2. Summary (2-3 paragraphs about their workflow)
3. Repetitive tasks that could be automated
4. Specific automation opportunities with time-saved estimates

Respond in JSON:
{
  "efficiencyScore": <number>,
  "summary": "<string>",
  "repetitiveTasks": [{"description":"","frequency":"","timeWasted":"","suggestion":""}],
  "topApps": [{"name":"","hours":<number>}],
  "automationOpportunities": [{"title":"","description":"","estimatedTimeSaved":"","difficulty":"easy|medium|hard"}]
}`;
}
