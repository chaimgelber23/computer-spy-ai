import { NextRequest, NextResponse } from 'next/server';
import { runAnalysis } from '@/ai/analysis';
import { verifyAdmin } from '@/lib/firebase-admin';
import type { AIProviderName, AnalysisPeriod } from '@/ai/providers/types';

// Rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;

function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const limit = rateLimitMap.get(key);

  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (limit.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  limit.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - limit.count };
}

/**
 * POST /api/analyze
 * Run AI analysis for a user. Admin only.
 *
 * Body: {
 *   userId: string,         // Target user to analyze
 *   period: AnalysisPeriod, // '3-day' | '7-day' | '14-day' | '21-day'
 *   provider: AIProviderName // 'claude' | 'gemini' | 'openai'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    let adminUid: string;

    try {
      adminUid = await verifyAdmin(token);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Rate limit per admin
    const rateLimit = checkRateLimit(adminUid);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 10 analyses per hour.' },
        { status: 429 }
      );
    }

    // Parse body
    const body = await request.json();
    const { userId, period, provider } = body as {
      userId: string;
      period: AnalysisPeriod;
      provider: AIProviderName;
    };

    if (!userId || !period || !provider) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: userId, period, provider' },
        { status: 400 }
      );
    }

    const validPeriods: AnalysisPeriod[] = ['3-day', '7-day', '14-day', '21-day'];
    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        { success: false, error: `Invalid period. Must be one of: ${validPeriods.join(', ')}` },
        { status: 400 }
      );
    }

    const validProviders: AIProviderName[] = ['claude', 'gemini', 'openai'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { success: false, error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      );
    }

    // Run analysis
    const result = await runAnalysis({
      userId,
      period,
      providerName: provider,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    console.error('Analysis error:', error);
    const message = error instanceof Error ? error.message : 'Analysis failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
