import type { AIProvider, AIProviderName } from './types';
import { ClaudeProvider } from './claude';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';

// Cache provider instances
const providerCache = new Map<AIProviderName, AIProvider>();

export function getAIProvider(name: AIProviderName): AIProvider {
  const cached = providerCache.get(name);
  if (cached) return cached;

  let provider: AIProvider;

  switch (name) {
    case 'claude':
      provider = new ClaudeProvider();
      break;
    case 'openai':
      provider = new OpenAIProvider();
      break;
    case 'gemini':
      provider = new GeminiProvider();
      break;
    default:
      throw new Error(`Unknown AI provider: ${name}`);
  }

  providerCache.set(name, provider);
  return provider;
}

export function getAvailableProviders(): AIProviderName[] {
  const available: AIProviderName[] = [];

  if (process.env.ANTHROPIC_API_KEY) available.push('claude');
  if (process.env.GOOGLE_GENAI_API_KEY) available.push('gemini');
  if (process.env.OPENAI_API_KEY) available.push('openai');

  return available;
}

export { type AIProvider, type AIProviderName, type AnalysisPeriod, type AnalysisResult, type CompressedActivityData } from './types';
export { PERIOD_CONFIGS } from './types';
