import type { AIProvider, AIProviderName } from './types';

// Cache provider instances
const providerCache = new Map<AIProviderName, AIProvider>();

export async function getAIProvider(name: AIProviderName): Promise<AIProvider> {
  const cached = providerCache.get(name);
  if (cached) return cached;

  let provider: AIProvider;

  switch (name) {
    case 'claude': {
      const { ClaudeProvider } = await import('./claude');
      provider = new ClaudeProvider();
      break;
    }
    case 'openai': {
      const { OpenAIProvider } = await import('./openai');
      provider = new OpenAIProvider();
      break;
    }
    case 'gemini': {
      const { GeminiProvider } = await import('./gemini');
      provider = new GeminiProvider();
      break;
    }
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
