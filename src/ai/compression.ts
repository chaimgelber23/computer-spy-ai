import type { CompressedActivityData } from './providers/types';

interface RawLog {
  appName: string;
  windowTitle: string;
  durationSeconds: number;
  idleSeconds?: number;
  timestamp: { toDate(): Date } | Date;
}

/**
 * Compresses raw activity logs into an aggregated format optimized for AI analysis.
 * Reduces token usage by ~80% while preserving patterns the AI needs to see.
 */
export function compressActivityLogs(
  logs: RawLog[],
  periodDays: number,
  periodLabel: string
): CompressedActivityData {
  if (logs.length === 0) {
    return emptyData(periodDays, periodLabel);
  }

  // Sort by timestamp
  const sorted = [...logs].sort((a, b) => {
    const aTime = toDate(a.timestamp).getTime();
    const bTime = toDate(b.timestamp).getTime();
    return aTime - bTime;
  });

  const startDate = toDate(sorted[0].timestamp);
  const endDate = toDate(sorted[sorted.length - 1].timestamp);

  // --- App Usage Aggregation ---
  const appMap = new Map<string, {
    totalSeconds: number;
    sessionCount: number;
    titles: Map<string, number>;
  }>();

  for (const log of sorted) {
    const existing = appMap.get(log.appName);
    if (existing) {
      existing.totalSeconds += log.durationSeconds;
      existing.sessionCount += 1;
      const titleTime = existing.titles.get(log.windowTitle) || 0;
      existing.titles.set(log.windowTitle, titleTime + log.durationSeconds);
    } else {
      const titles = new Map<string, number>();
      titles.set(log.windowTitle, log.durationSeconds);
      appMap.set(log.appName, {
        totalSeconds: log.durationSeconds,
        sessionCount: 1,
        titles,
      });
    }
  }

  const appUsage = Array.from(appMap.entries())
    .map(([appName, data]) => ({
      appName,
      totalHours: data.totalSeconds / 3600,
      sessionCount: data.sessionCount,
      averageSessionMinutes: data.sessionCount > 0
        ? (data.totalSeconds / data.sessionCount) / 60
        : 0,
      commonTitles: Array.from(data.titles.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([title, seconds]) => ({
          title: truncateTitle(title, 80),
          hours: seconds / 3600,
        })),
    }))
    .sort((a, b) => b.totalHours - a.totalHours);

  // --- Hourly Pattern ---
  const hourBuckets = new Map<number, { totalMinutes: number; appMinutes: Map<string, number>; dayCount: Set<string> }>();

  for (const log of sorted) {
    const date = toDate(log.timestamp);
    const hour = date.getHours();
    const dayKey = date.toISOString().split('T')[0];

    const bucket = hourBuckets.get(hour) || {
      totalMinutes: 0,
      appMinutes: new Map<string, number>(),
      dayCount: new Set<string>(),
    };

    bucket.totalMinutes += log.durationSeconds / 60;
    bucket.dayCount.add(dayKey);
    const appMin = bucket.appMinutes.get(log.appName) || 0;
    bucket.appMinutes.set(log.appName, appMin + log.durationSeconds / 60);

    hourBuckets.set(hour, bucket);
  }

  const dailyPattern = Array.from(hourBuckets.entries())
    .map(([hour, data]) => {
      const numDays = Math.max(data.dayCount.size, 1);
      let topApp = '';
      let topMinutes = 0;
      for (const [app, minutes] of data.appMinutes) {
        if (minutes > topMinutes) {
          topApp = app;
          topMinutes = minutes;
        }
      }
      return {
        hour,
        activeMinutes: data.totalMinutes / numDays,
        topApp,
      };
    })
    .sort((a, b) => a.hour - b.hour);

  // --- App Switch Patterns ---
  const appSwitchPatterns = detectAppSwitchPatterns(sorted);

  // --- Totals ---
  let totalActiveSeconds = 0;
  let totalIdleSeconds = 0;

  for (const log of sorted) {
    totalActiveSeconds += log.durationSeconds;
    totalIdleSeconds += log.idleSeconds || 0;
  }

  return {
    period: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
      days: periodDays,
      label: periodLabel,
    },
    appUsage,
    dailyPattern,
    appSwitchPatterns,
    totals: {
      activeHours: totalActiveSeconds / 3600,
      idleHours: totalIdleSeconds / 3600,
      uniqueApps: appMap.size,
      totalSessions: sorted.length,
    },
  };
}

/**
 * Detects repeated sequences of app switches.
 * e.g., Excel → Chrome → Excel happening 15 times/day
 */
function detectAppSwitchPatterns(
  sortedLogs: RawLog[]
): CompressedActivityData['appSwitchPatterns'] {
  if (sortedLogs.length < 3) return [];

  // Build app sequence (deduplicate consecutive same-app)
  const appSequence: { app: string; durationSeconds: number }[] = [];
  for (const log of sortedLogs) {
    const last = appSequence[appSequence.length - 1];
    if (last && last.app === log.appName) {
      last.durationSeconds += log.durationSeconds;
    } else {
      appSequence.push({ app: log.appName, durationSeconds: log.durationSeconds });
    }
  }

  // Find 2-app and 3-app patterns
  const patternCounts = new Map<string, { count: number; totalDuration: number }>();

  // 2-app patterns
  for (let i = 0; i < appSequence.length - 1; i++) {
    const key = `${appSequence[i].app}|${appSequence[i + 1].app}`;
    const existing = patternCounts.get(key) || { count: 0, totalDuration: 0 };
    existing.count += 1;
    existing.totalDuration += appSequence[i].durationSeconds + appSequence[i + 1].durationSeconds;
    patternCounts.set(key, existing);
  }

  // 3-app patterns
  for (let i = 0; i < appSequence.length - 2; i++) {
    const key = `${appSequence[i].app}|${appSequence[i + 1].app}|${appSequence[i + 2].app}`;
    const existing = patternCounts.get(key) || { count: 0, totalDuration: 0 };
    existing.count += 1;
    existing.totalDuration += appSequence[i].durationSeconds + appSequence[i + 1].durationSeconds + appSequence[i + 2].durationSeconds;
    patternCounts.set(key, existing);
  }

  return Array.from(patternCounts.entries())
    .filter(([, data]) => data.count >= 3) // Only patterns that repeat 3+ times
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 15)
    .map(([key, data]) => ({
      sequence: key.split('|'),
      occurrences: data.count,
      avgDurationMinutes: (data.totalDuration / data.count) / 60,
    }));
}

function toDate(timestamp: { toDate(): Date } | Date): Date {
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'object' && 'toDate' in timestamp) return timestamp.toDate();
  return new Date(timestamp as unknown as string);
}

function truncateTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength - 3) + '...';
}

function emptyData(periodDays: number, periodLabel: string): CompressedActivityData {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - periodDays);

  return {
    period: {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
      days: periodDays,
      label: periodLabel,
    },
    appUsage: [],
    dailyPattern: [],
    appSwitchPatterns: [],
    totals: {
      activeHours: 0,
      idleHours: 0,
      uniqueApps: 0,
      totalSessions: 0,
    },
  };
}
