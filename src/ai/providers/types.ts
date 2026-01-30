export type AIProviderName = 'claude' | 'gemini' | 'openai';

export type AnalysisPeriod = '3-day' | '7-day' | '14-day' | '21-day';

export const PERIOD_CONFIGS: Record<AnalysisPeriod, { days: number; label: string; focus: string }> = {
  '3-day': { days: 3, label: 'Initial Patterns', focus: 'basic app usage habits and first impressions' },
  '7-day': { days: 7, label: 'Weekly Rhythm', focus: 'weekly patterns, meeting days, deep work vs shallow work' },
  '14-day': { days: 14, label: 'Deep Patterns', focus: 'recurring workflows, bi-weekly cycles, consistent inefficiencies' },
  '21-day': { days: 21, label: 'Full Analysis', focus: 'comprehensive automation opportunities, established habits, ROI estimates' },
};

export interface CompressedActivityData {
  period: {
    start: string;
    end: string;
    days: number;
    label: string;
  };

  appUsage: Array<{
    appName: string;
    totalHours: number;
    sessionCount: number;
    averageSessionMinutes: number;
    commonTitles: Array<{ title: string; hours: number }>;
  }>;

  dailyPattern: Array<{
    hour: number;
    activeMinutes: number;
    topApp: string;
  }>;

  appSwitchPatterns: Array<{
    sequence: string[];
    occurrences: number;
    avgDurationMinutes: number;
  }>;

  totals: {
    activeHours: number;
    idleHours: number;
    uniqueApps: number;
    totalSessions: number;
  };
}

export interface AnalysisResult {
  efficiencyScore: number;
  summary: string;
  repetitiveTasks: Array<{
    description: string;
    frequency: string;
    timeWasted: string;
    suggestion: string;
  }>;
  topApps: Array<{ name: string; hours: number }>;
  automationOpportunities: Array<{
    title: string;
    description: string;
    estimatedTimeSaved: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
}

export interface AIProvider {
  name: AIProviderName;
  analyze(data: CompressedActivityData, period: AnalysisPeriod): Promise<AnalysisResult>;
}

export function buildAnalysisPrompt(data: CompressedActivityData, period: AnalysisPeriod): string {
  const config = PERIOD_CONFIGS[period];

  const appSummary = data.appUsage
    .slice(0, 15)
    .map(a => `- ${a.appName}: ${a.totalHours.toFixed(1)}h across ${a.sessionCount} sessions (avg ${a.averageSessionMinutes.toFixed(0)}min)`)
    .join('\n');

  const titleDetails = data.appUsage
    .slice(0, 10)
    .map(a => {
      const titles = a.commonTitles
        .slice(0, 5)
        .map(t => `    - "${t.title}" (${t.hours.toFixed(1)}h)`)
        .join('\n');
      return `  ${a.appName}:\n${titles}`;
    })
    .join('\n');

  const hourlyPattern = data.dailyPattern
    .filter(h => h.activeMinutes > 0)
    .map(h => `- ${h.hour}:00: ${h.activeMinutes.toFixed(0)}min active, mostly ${h.topApp}`)
    .join('\n');

  const switchPatterns = data.appSwitchPatterns
    .slice(0, 10)
    .map(p => `- ${p.sequence.join(' → ')} (${p.occurrences}x, avg ${p.avgDurationMinutes.toFixed(1)}min)`)
    .join('\n');

  return `You are a workflow automation consultant analyzing a client's computer usage to identify AI automation opportunities.

ANALYSIS TYPE: ${config.label} (${config.days}-day period)
FOCUS: ${config.focus}

=== ACTIVITY SUMMARY ===
Period: ${data.period.start} to ${data.period.end} (${data.period.days} days)
Total Active Time: ${data.totals.activeHours.toFixed(1)} hours
Total Idle Time: ${data.totals.idleHours.toFixed(1)} hours
Unique Apps Used: ${data.totals.uniqueApps}
Total Sessions: ${data.totals.totalSessions}

=== TOP APPS BY TIME ===
${appSummary}

=== MOST USED WINDOWS/TABS ===
${titleDetails}

=== DAILY TIME PATTERN (AVERAGE) ===
${hourlyPattern}

=== APP SWITCHING PATTERNS ===
${switchPatterns || 'Not enough data for pattern detection'}

=== YOUR TASK ===
Based on this ${config.days}-day analysis, provide:

1. **Efficiency Score** (0-100): How efficiently is this person using their computer?

2. **Summary**: A 2-3 paragraph overview of their workflow habits. Be specific about what you see. Mention specific apps and patterns by name.

3. **Repetitive Tasks**: Identify tasks that are done repeatedly and could be automated. For each:
   - What the task is (be specific, mention apps involved)
   - How often it happens
   - How much time it wastes per week
   - A specific automation suggestion (e.g., "Build a Python script that...", "Use Zapier to...", "Create an AI agent that...")

4. **Automation Opportunities**: For each opportunity, provide:
   - A clear title
   - Detailed description of what to build
   - Estimated time saved per week
   - Difficulty level (easy/medium/hard)

${period === '21-day' ? `
5. **PRIORITY**: Since this is a full 21-day analysis, prioritize the TOP 3 automation opportunities that would save the most time and provide clear ROI. Be very specific about implementation.
` : ''}

Be practical and specific. Think like a consultant who wants to pitch real solutions.

Respond in valid JSON matching this exact structure:
{
  "efficiencyScore": <number 0-100>,
  "summary": "<string>",
  "repetitiveTasks": [
    {
      "description": "<string>",
      "frequency": "<string>",
      "timeWasted": "<string>",
      "suggestion": "<string>"
    }
  ],
  "topApps": [
    { "name": "<string>", "hours": <number> }
  ],
  "automationOpportunities": [
    {
      "title": "<string>",
      "description": "<string>",
      "estimatedTimeSaved": "<string>",
      "difficulty": "easy" | "medium" | "hard"
    }
  ]
}`;
}
