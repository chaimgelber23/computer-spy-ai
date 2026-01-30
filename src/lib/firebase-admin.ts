import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // On Vercel: use FIREBASE_SERVICE_ACCOUNT_KEY env var (JSON string)
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    return initializeApp({
      credential: cert(JSON.parse(serviceAccountKey)),
    });
  }

  // Local dev: uses GOOGLE_APPLICATION_CREDENTIALS file path
  return initializeApp();
}

export function getAdminDb() {
  getAdminApp();
  return getFirestore();
}

export function getAdminAuth() {
  getAdminApp();
  return getAuth();
}

export async function verifyAdmin(token: string): Promise<string> {
  const auth = getAdminAuth();
  const decodedToken = await auth.verifyIdToken(token);
  const uid = decodedToken.uid;
  const db = getAdminDb();
  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.data();
  const adminUids = (process.env.ADMIN_UIDS || '').split(',').map(s => s.trim());
  if (userData?.role !== 'admin' && !adminUids.includes(uid)) {
    throw new Error('Admin access required');
  }
  return uid;
}
