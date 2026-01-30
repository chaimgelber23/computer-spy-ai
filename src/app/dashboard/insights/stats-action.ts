'use server';

import { ActivityLog, DataStats } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

export async function getDataStats(userId: string = 'local-user'): Promise<DataStats> {
    const db = getAdminDb();

    // Get oldest and newest log to determine range
    const oldestQuery = await db.collection('activity_logs')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'asc')
        .limit(1)
        .get();

    const newestQuery = await db.collection('activity_logs')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

    if (oldestQuery.empty) {
        return {
            totalLogs: 0,
            oldestLog: null,
            newestLog: null,
            totalActiveHours: 0,
            totalIdleHours: 0,
            daysOfData: 0,
            isReadyForAnalysis: false
        };
    }

    const oldestLog = oldestQuery.docs[0].data();
    const newestLog = newestQuery.docs[0].data();

    const start = oldestLog.timestamp.toDate();
    const end = newestLog.timestamp.toDate();
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const daysOfData = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Get basic count (approximation for total logs if > 1000, but exact fit for now)
    const countSnapshot = await db.collection('activity_logs')
        .where('userId', '==', userId)
        .count()
        .get();

    // We could do an aggregation query for total duration, but it's expensive.
    // For now, estimating based on a sample relative to days might be safer, 
    // or just say "Calculation included in weekly report" 
    // BUT user wants to know if they have enough data.

    return {
        totalLogs: countSnapshot.data().count,
        oldestLog: oldestLog.timestamp,
        newestLog: newestLog.timestamp,
        totalActiveHours: 0, // Todo: heavy calc
        totalIdleHours: 0, // Todo: heavy calc
        daysOfData: daysOfData,
        isReadyForAnalysis: daysOfData >= 3
    };
}
