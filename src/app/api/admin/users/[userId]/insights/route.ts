import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getUserInsights, getUserAnalysisProgress } from '@/ai/analysis';

function getAdminApp() {
  if (getApps().length === 0) {
    initializeApp();
  }
  return getApps()[0];
}

async function verifyAdmin(token: string): Promise<string> {
  getAdminApp();
  const decodedToken = await getAuth().verifyIdToken(token);
  const uid = decodedToken.uid;
  const db = getFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.data();
  const adminUids = (process.env.ADMIN_UIDS || '').split(',').map(s => s.trim());
  if (userData?.role !== 'admin' && !adminUids.includes(uid)) {
    throw new Error('Admin access required');
  }
  return uid;
}

/**
 * GET /api/admin/users/[userId]/insights
 * Returns all insights and progress for a specific user.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Auth required' }, { status: 401 });
    }

    try {
      await verifyAdmin(authHeader.split('Bearer ')[1]);
    } catch {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { userId } = await params;

    const [insights, progress] = await Promise.all([
      getUserInsights(userId),
      getUserAnalysisProgress(userId),
    ]);

    // Serialize Firestore timestamps to ISO strings
    const serializedInsights = insights.map(insight => ({
      id: insight.id,
      userId: insight.userId,
      period: insight.period,
      aiProvider: insight.aiProvider,
      createdAt: (insight.createdAt as unknown as { toDate(): Date })?.toDate?.()?.toISOString() || null,
      periodStart: (insight.periodStart as unknown as { toDate(): Date })?.toDate?.()?.toISOString() || null,
      periodEnd: (insight.periodEnd as unknown as { toDate(): Date })?.toDate?.()?.toISOString() || null,
      analysis: insight.analysis,
      totalActiveHours: insight.totalActiveHours,
      totalIdleHours: insight.totalIdleHours,
    }));

    return NextResponse.json({
      insights: serializedInsights,
      progress: {
        daysActive: progress.daysActive,
        firstActivity: progress.firstActivity?.toISOString() || null,
        milestones: progress.milestones.map(m => ({
          ...m,
          completedAt: m.completedAt?.toISOString() || null,
        })),
      },
    });
  } catch (error: unknown) {
    console.error('Admin user insights error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load insights';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
