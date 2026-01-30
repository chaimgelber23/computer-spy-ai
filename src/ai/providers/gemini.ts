import { ai } from '../config';
import type { AIProvider, CompressedActivityData, AnalysisPeriod, AnalysisResult } from './types';
import { buildAnalysisPrompt } from './types';
import { z } from 'zod';

const AnalysisResultSchema = z.object({
  efficiencyScore: z.number().min(0).max(100),
  summary: z.string(),
  repetitiveTasks: z.array(z.object({
    description: z.string(),
    frequency: z.string(),
    timeWasted: z.string(),
    suggestion: z.string(),
  })),
  topApps: z.array(z.object({
    name: z.string(),
    hours: z.number(),
  })),
  automationOpportunities: z.array(z.object({
    title: z.string(),
    description: z.string(),
    estimatedTimeSaved: z.string(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
  })),
});

export class GeminiProvider implements AIProvider {
  name = 'gemini' as const;

  async analyze(data: CompressedActivityData, period: AnalysisPeriod): Promise<AnalysisResult> {
    const prompt = buildAnalysisPrompt(data, period);

    const result = await ai.generate({
      prompt,
      output: { schema: AnalysisResultSchema },
    });

    if (result.output) {
      return result.output as AnalysisResult;
    }

    throw new Error('Gemini returned no structured output');
  }
}
