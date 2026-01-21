import { z } from 'zod';
import { ai } from './config';

const ActivityLogSchema = z.object({
    appName: z.string(),
    windowTitle: z.string(),
    durationSeconds: z.number(),
    timestamp: z.any().optional(), // Flexible
});

const AnalysisResultSchema = z.object({
    repetitiveTasks: z.array(z.object({
        description: z.string(),
        frequency: z.string(),
        timeWasted: z.string(),
        suggestion: z.string(),
    })),
    efficiencyScore: z.number().min(0).max(100),
    summary: z.string(),
});

export const analyzeActivityFlow = ai.defineFlow(
    {
        name: 'analyzeUserActivity',
        inputSchema: z.array(ActivityLogSchema),
        outputSchema: AnalysisResultSchema,
    },
    async (logs) => {
        // Basic aggregation to reduce token usage if needed
        const simplifiedLogs = logs.map(l => ({
            app: l.appName,
            title: l.windowTitle,
            duration: l.durationSeconds
        }));

        const prompt = `
      Analyze the following user activity logs from their computer usage.
      Identify repetitive behaviors, inefficient workflows, or distractions.
      Suggest specific "Agentic" solutions (e.g., "Build a scraper for X", "Automate data entry for Y").
      
      Logs:
      ${JSON.stringify(simplifiedLogs.slice(0, 200))} 
    `;

        const result = await ai.generate({
            prompt: prompt,
            output: { schema: AnalysisResultSchema },
        });

        if (result.output) {
            return result.output;
        } else {
            throw new Error("Failed to generate analysis");
        }
    }
);
