import OpenAI from 'openai';
import type { AIProvider, CompressedActivityData, AnalysisPeriod, AnalysisResult } from './types';
import { buildAnalysisPrompt } from './types';

export class OpenAIProvider implements AIProvider {
  name = 'openai' as const;
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required for OpenAI provider');
    }
    this.client = new OpenAI({ apiKey });
  }

  async analyze(data: CompressedActivityData, period: AnalysisPeriod): Promise<AnalysisResult> {
    const prompt = buildAnalysisPrompt(data, period);

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a workflow automation consultant. Always respond in valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned no content');
    }

    const result: AnalysisResult = JSON.parse(content);
    return result;
  }
}
