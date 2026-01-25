import { NextRequest, NextResponse } from 'next/server';
import { runAndSaveWeeklyAnalysis } from '@/ai/weeklyAnalysis';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already done
function getAdminApp() {
    if (getApps().length === 0) {
        initializeApp();
    }
    return getApps()[0];
}

// Simple in-memory rate limiter for scalability
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 5; // Max 5 analyses per hour per user
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const userLimit = rateLimitMap.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
        rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
    }

    if (userLimit.count >= RATE_LIMIT_MAX) {
        return { allowed: false, remaining: 0 };
    }

    userLimit.count++;
    return { allowed: true, remaining: RATE_LIMIT_MAX - userLimit.count };
}

export async function POST(request: NextRequest) {
    try {
        getAdminApp();

        // Verify authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, error: 'Authentication required. Please log in.' },
                { status: 401 }
            );
        }

        const token = authHeader.split('Bearer ')[1];
        let userId: string;

        try {
            const decodedToken = await getAuth().verifyIdToken(token);
            userId = decodedToken.uid;
        } catch (authError: any) {
            console.error('Token verification failed:', authError.message);
            return NextResponse.json(
                { success: false, error: 'Invalid or expired token. Please log in again.' },
                { status: 401 }
            );
        }

        // Check rate limit
        const rateLimit = checkRateLimit(userId);
        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Rate limit exceeded. You can run 5 analyses per hour.',
                    retryAfter: '1 hour'
                },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': String(Date.now() + RATE_LIMIT_WINDOW)
                    }
                }
            );
        }

        // Run the analysis
        const result = await runAndSaveWeeklyAnalysis(userId);

        return NextResponse.json(
            { success: true, data: result },
            {
                headers: {
                    'X-RateLimit-Remaining': String(rateLimit.remaining)
                }
            }
        );
    } catch (error: any) {
        console.error('Weekly analysis error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Analysis failed. Please try again.' },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        message: 'POST to this endpoint to trigger weekly analysis',
        requirements: {
            authentication: 'Bearer token required in Authorization header',
            rateLimit: `${RATE_LIMIT_MAX} requests per hour`
        }
    });
}
