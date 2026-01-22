import { NextRequest, NextResponse } from 'next/server';
import { runAndSaveWeeklyAnalysis } from '@/ai/weeklyAnalysis';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const userId = body.userId || 'local-user';

        const result = await runAndSaveWeeklyAnalysis(userId);

        return NextResponse.json({
            success: true,
            data: result
        });
    } catch (error: any) {
        console.error('Weekly analysis error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        message: 'POST to this endpoint to trigger weekly analysis',
        example: { userId: 'local-user' }
    });
}
