import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, CompressedActivityData, AnalysisPeriod, AnalysisResult } from './types';
import { buildAnalysisPrompt } from './types';

export class ClaudeProvider implements AIProvider {
  name = 'claude' as const;
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for Claude provider');
    }
    this.client = new Anthropic({ apiKey });
  }

  async analyze(data: CompressedActivityData, period: AnalysisPeriod): Promise<AnalysisResult> {
    const prompt = buildAnalysisPrompt(data, period);

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('Claude returned no text response');
    }

    // Extract JSON from response (Claude may wrap in markdown code blocks)
    let jsonText = textContent.text;
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const result: AnalysisResult = JSON.parse(jsonText.trim());
    return result;
  }
}
