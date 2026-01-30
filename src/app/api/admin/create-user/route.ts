import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, verifyAdmin } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    try {
        // Verify the requesting user is an admin
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, error: 'Authentication required' },
                { status: 401 }
            );
        }

        try {
            await verifyAdmin(authHeader.split('Bearer ')[1]);
        } catch {
            return NextResponse.json(
                { success: false, error: 'Admin access required' },
                { status: 403 }
            );
        }

        // Get request body
        const { email, password, displayName } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { success: false, error: 'Email and password are required' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { success: false, error: 'Password must be at least 6 characters' },
                { status: 400 }
            );
        }

        const adminAuth = getAdminAuth();
        const db = getAdminDb();

        // Create the user
        const newUser = await adminAuth.createUser({
            email,
            password,
            displayName: displayName || email.split('@')[0],
            emailVerified: false,
        });

        // Create user document in Firestore
        await db.collection('users').doc(newUser.uid).set({
            id: newUser.uid,
            email: newUser.email,
            name: displayName || email.split('@')[0],
            role: 'user',
            createdAt: new Date(),
        });

        return NextResponse.json({
            success: true,
            data: {
                uid: newUser.uid,
                email: newUser.email,
                displayName: newUser.displayName,
            }
        });

    } catch (error: unknown) {
        console.error('Create user error:', error);

        const err = error as { code?: string; message?: string };

        if (err.code === 'auth/email-already-exists') {
            return NextResponse.json(
                { success: false, error: 'A user with this email already exists' },
                { status: 400 }
            );
        }

        if (err.code === 'auth/invalid-email') {
            return NextResponse.json(
                { success: false, error: 'Invalid email address' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: false, error: err.message || 'Failed to create user' },
            { status: 500 }
        );
    }
}
