import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb, verifyAdmin } from '@/lib/firebase-admin';

/**
 * GET /api/admin/users/[userId]/communications
 * Returns all communication logs for a user.
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
    const db = getAdminDb();

    const snapshot = await db.collection('communication_logs')
      .where('userId', '==', userId)
      .orderBy('date', 'desc')
      .limit(100)
      .get();

    const communications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate()?.toISOString() || null,
      createdAt: doc.data().createdAt?.toDate()?.toISOString() || null,
    }));

    return NextResponse.json({ communications });
  } catch (error: unknown) {
    console.error('Communications fetch error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load communications';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/users/[userId]/communications
 * Log a communication with a user (email sent, call made, etc.)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Auth required' }, { status: 401 });
    }

    let adminUid: string;
    try {
      adminUid = await verifyAdmin(authHeader.split('Bearer ')[1]);
    } catch {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { userId } = await params;
    const body = await request.json();
    const { milestone, method, notes } = body;

    if (!milestone || !method) {
      return NextResponse.json(
        { error: 'Milestone and method are required' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    const commLog = {
      userId,
      date: Timestamp.now(),
      milestone,
      method,
      notes: notes || '',
      adminId: adminUid,
      createdAt: Timestamp.now(),
    };

    const docRef = await db.collection('communication_logs').add(commLog);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      communication: {
        id: docRef.id,
        ...commLog,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('Communication log error:', error);
    const message = error instanceof Error ? error.message : 'Failed to log communication';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
