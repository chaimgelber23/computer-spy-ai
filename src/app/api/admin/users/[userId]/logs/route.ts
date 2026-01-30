import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';

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
 * GET /api/admin/users/[userId]/logs
 * Returns activity logs for a specific user with filtering.
 * Query params: ?days=7&app=Chrome&search=gmail&limit=500
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
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const appFilter = searchParams.get('app') || null;
    const search = searchParams.get('search') || null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '1000'), 5000);

    const db = getFirestore();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = db.collection('activity_logs')
      .where('userId', '==', userId)
      .where('timestamp', '>=', Timestamp.fromDate(startDate))
      .orderBy('timestamp', 'desc')
      .limit(limit);

    const snapshot = await query.get();

    let logs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        appName: data.appName,
        windowTitle: data.windowTitle,
        url: data.url || null,
        durationSeconds: data.durationSeconds,
        idleSeconds: data.idleSeconds || 0,
        timestamp: data.timestamp?.toDate()?.toISOString() || null,
        platform: data.platform || null,
      };
    });

    // Client-side filtering for app and search
    if (appFilter) {
      logs = logs.filter(l => l.appName === appFilter);
    }
    if (search) {
      const lower = search.toLowerCase();
      logs = logs.filter(l =>
        l.appName.toLowerCase().includes(lower) ||
        l.windowTitle.toLowerCase().includes(lower) ||
        (l.url && l.url.toLowerCase().includes(lower))
      );
    }

    // Get unique app names for filter dropdown
    const uniqueApps = [...new Set(snapshot.docs.map(d => d.data().appName))].sort();

    return NextResponse.json({
      logs,
      totalCount: logs.length,
      uniqueApps,
    });
  } catch (error: unknown) {
    console.error('Admin user logs error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load logs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
