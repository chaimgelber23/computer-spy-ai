import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyAdmin } from '@/lib/firebase-admin';
import { getUserAnalysisProgress } from '@/ai/analysis';

/**
 * GET /api/admin/users
 * Returns all users with their progress and heartbeat status.
 */
export async function GET(request: NextRequest) {
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

    const db = getAdminDb();

    // Get all users
    const usersSnapshot = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .get();

    // Get all heartbeats
    const heartbeatsSnapshot = await db.collection('agent_heartbeats').get();
    const heartbeats = new Map<string, { lastSeen: Date; isActive: boolean; platform: string }>();
    for (const doc of heartbeatsSnapshot.docs) {
      const data = doc.data();
      heartbeats.set(doc.id, {
        lastSeen: data.lastSeen?.toDate() || new Date(0),
        isActive: data.isActive || false,
        platform: data.platform || 'unknown',
      });
    }

    // Get most recent communication per user
    const commSnapshot = await db.collection('communication_logs')
      .orderBy('date', 'desc')
      .get();
    const lastContacts = new Map<string, { date: Date; milestone: string }>();
    for (const commDoc of commSnapshot.docs) {
      const commData = commDoc.data();
      if (!lastContacts.has(commData.userId)) {
        lastContacts.set(commData.userId, {
          date: commData.date?.toDate() || new Date(0),
          milestone: commData.milestone || 'unknown',
        });
      }
    }

    // Build user list with progress
    const users = await Promise.all(
      usersSnapshot.docs
        .filter(doc => doc.data().role !== 'admin')
        .map(async (doc) => {
          const data = doc.data();
          const heartbeat = heartbeats.get(doc.id);
          const lastContact = lastContacts.get(doc.id);

          let progress;
          try {
            progress = await getUserAnalysisProgress(doc.id);
          } catch {
            progress = { daysActive: 0, firstActivity: null, milestones: [] };
          }

          return {
            id: doc.id,
            username: data.username || data.name || data.email || 'Unknown',
            email: data.email || null,
            role: data.role || 'user',
            createdAt: data.createdAt?.toDate()?.toISOString() || null,
            installedAt: data.installedAt?.toDate()?.toISOString() || data.createdAt?.toDate()?.toISOString() || null,
            platform: heartbeat?.platform || data.platform || null,
            lastSeen: heartbeat?.lastSeen?.toISOString() || null,
            isActive: heartbeat?.isActive || false,
            daysActive: progress.daysActive,
            milestones: progress.milestones,
            lastContact: lastContact ? {
              date: lastContact.date.toISOString(),
              milestone: lastContact.milestone,
            } : null,
          };
        })
    );

    return NextResponse.json({ users });
  } catch (error: unknown) {
    console.error('Admin users error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load users';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
