import { NextRequest, NextResponse } from 'next/server';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin
function getAdminApp() {
    if (getApps().length === 0) {
        // Check for service account in environment or file
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            initializeApp();
        } else {
            // For development, use project config
            initializeApp({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'computer-spy-ai',
            });
        }
    }
    return getApps()[0];
}

// Admin user IDs that can create accounts (add your UID here after first login)
const ADMIN_UIDS = process.env.ADMIN_UIDS?.split(',') || [];

export async function POST(request: NextRequest) {
    try {
        getAdminApp();
        const adminAuth = getAdminAuth();
        const db = getFirestore();

        // Verify the requesting user is an admin
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, error: 'Authentication required' },
                { status: 401 }
            );
        }

        const token = authHeader.split('Bearer ')[1];
        let requestingUserId: string;

        try {
            const decodedToken = await adminAuth.verifyIdToken(token);
            requestingUserId = decodedToken.uid;
        } catch (authError) {
            return NextResponse.json(
                { success: false, error: 'Invalid token' },
                { status: 401 }
            );
        }

        // Check if user is admin
        const userDoc = await db.collection('users').doc(requestingUserId).get();
        const userData = userDoc.data();
        const isAdmin = userData?.role === 'admin' || ADMIN_UIDS.includes(requestingUserId);

        if (!isAdmin) {
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
            createdBy: requestingUserId,
        });

        return NextResponse.json({
            success: true,
            data: {
                uid: newUser.uid,
                email: newUser.email,
                displayName: newUser.displayName,
            }
        });

    } catch (error: any) {
        console.error('Create user error:', error);

        // Handle specific Firebase errors
        if (error.code === 'auth/email-already-exists') {
            return NextResponse.json(
                { success: false, error: 'A user with this email already exists' },
                { status: 400 }
            );
        }

        if (error.code === 'auth/invalid-email') {
            return NextResponse.json(
                { success: false, error: 'Invalid email address' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: false, error: error.message || 'Failed to create user' },
            { status: 500 }
        );
    }
}
