import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { randomUUID } from 'crypto';

/**
 * POST /api/register
 * Register a new user with just an email (no password).
 * Returns a device key for authentication.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, platform } = body as { email: string; platform: string };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'A valid email address is required' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const db = getAdminDb();

    // Check if email is already registered
    const existingUsers = await db.collection('users')
      .where('email', '==', cleanEmail)
      .limit(1)
      .get();

    if (!existingUsers.empty) {
      return NextResponse.json(
        { error: 'This email is already registered.' },
        { status: 409 }
      );
    }

    // Generate device key
    const deviceKey = randomUUID();

    // Create a Firebase auth user with email
    const auth = getAdminAuth();
    const userRecord = await auth.createUser({
      email: cleanEmail,
      displayName: cleanEmail.split('@')[0],
    });

    // Create user document
    await db.collection('users').doc(userRecord.uid).set({
      email: cleanEmail,
      username: cleanEmail.split('@')[0],
      role: 'user',
      deviceKey,
      platform: platform || 'unknown',
      createdAt: Timestamp.now(),
      installedAt: Timestamp.now(),
      lastSeen: Timestamp.now(),
      isActive: false,
    });

    // Generate custom token for the desktop app to sign in with
    const customToken = await auth.createCustomToken(userRecord.uid);

    return NextResponse.json({
      success: true,
      deviceKey,
      userId: userRecord.uid,
      customToken,
      email: cleanEmail,
    });
  } catch (error: unknown) {
    console.error('Registration error:', error);
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/register
 * Re-authenticate with a device key (for returning users).
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceKey } = body as { deviceKey: string };

    if (!deviceKey) {
      return NextResponse.json(
        { error: 'Device key required' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // Find user by device key
    const usersSnapshot = await db.collection('users')
      .where('deviceKey', '==', deviceKey)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return NextResponse.json(
        { error: 'Invalid device key. Please register again.' },
        { status: 401 }
      );
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    // Generate new custom token
    const auth = getAdminAuth();
    const customToken = await auth.createCustomToken(userDoc.id);

    // Update last seen
    await userDoc.ref.update({
      lastSeen: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      userId: userDoc.id,
      email: userData.email || userData.username,
      customToken,
    });
  } catch (error: unknown) {
    console.error('Login error:', error);
    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
