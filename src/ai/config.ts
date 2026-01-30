import type { Genkit } from 'genkit';

let _ai: Genkit | null = null;

export async function getAI(): Promise<Genkit> {
    if (_ai) return _ai;
    const { genkit } = await import('genkit');
    const { googleAI } = await import('@genkit-ai/google-genai');
    _ai = genkit({
        plugins: [googleAI()],
        model: 'gemini-1.5-flash',
    });
    return _ai;
}
