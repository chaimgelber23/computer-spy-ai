"use client"

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase/provider';
import { getIdToken } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Loader2, UserPlus, Copy, Check, AlertCircle, Shield, Users } from "lucide-react";

interface ManagedUser {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: any;
}

export default function AdminPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);

    // Form state
    const [email, setEmail] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Check if current user is admin
    useEffect(() => {
        if (!user?.uid || !firestore) return;

        const checkAdmin = async () => {
            const userDoc = await getDoc(doc(firestore, 'users', user.uid));
            const data = userDoc.data();
            setIsAdmin(data?.role === 'admin');
        };

        checkAdmin();
    }, [user?.uid, firestore]);

    // Listen to all users
    useEffect(() => {
        if (!firestore || !isAdmin) return;

        const usersQuery = query(
            collection(firestore, 'users'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
            const usersList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ManagedUser));
            setUsers(usersList);
            setIsLoadingUsers(false);
        }, (error) => {
            console.error('Error loading users:', error);
            setIsLoadingUsers(false);
        });

        return () => unsubscribe();
    }, [firestore, isAdmin]);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setIsCreating(true);
        setError(null);
        setSuccess(null);

        try {
            const token = await getIdToken(user);

            const res = await fetch('/api/admin/create-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    email,
                    password,
                    displayName: displayName || undefined
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to create user');
            }

            setSuccess(`User ${email} created successfully! They can now log in with the password you set.`);
            setEmail('');
            setDisplayName('');
            setPassword('');

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsCreating(false);
        }
    };

    const handleCopyUserId = (userId: string) => {
        navigator.clipboard.writeText(userId);
        setCopiedId(userId);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const generatePassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let result = '';
        for (let i = 0; i < 12; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setPassword(result);
    };

    // Loading state
    if (isAdmin === null) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Not admin
    if (!isAdmin) {
        return (
            <div className="max-w-2xl mx-auto space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                            <Shield className="h-5 w-5" />
                            Access Denied
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">
                            You don't have admin access. Contact your administrator to get admin privileges.
                        </p>
                        <p className="text-sm text-muted-foreground mt-4">
                            Your User ID: <code className="bg-muted px-2 py-1 rounded text-xs">{user?.uid}</code>
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Admin Panel</h2>
                <p className="text-muted-foreground">Create and manage user accounts.</p>
            </div>

            {/* Create User Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Create New User
                    </CardTitle>
                    <CardDescription>
                        Create an account for a new user. Share the password with them securely.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleCreateUser} className="space-y-4">
                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {success && (
                            <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20">
                                <Check className="h-4 w-4 text-green-600" />
                                <AlertDescription className="text-green-800 dark:text-green-200">
                                    {success}
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="user@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={isCreating}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="displayName">Display Name (optional)</Label>
                                <Input
                                    id="displayName"
                                    type="text"
                                    placeholder="John Doe"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    disabled={isCreating}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Temporary Password</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="password"
                                    type="text"
                                    placeholder="min. 6 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    disabled={isCreating}
                                    className="font-mono"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={generatePassword}
                                    disabled={isCreating}
                                >
                                    Generate
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Share this password securely with the user. They can change it later.
                            </p>
                        </div>

                        <Button type="submit" disabled={isCreating}>
                            {isCreating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Create User
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Users List */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        All Users ({users.length})
                    </CardTitle>
                    <CardDescription>
                        All registered users and their status.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingUsers ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>User ID</TableHead>
                                    <TableHead>Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((u) => (
                                    <TableRow key={u.id}>
                                        <TableCell className="font-medium">
                                            {u.name || '-'}
                                        </TableCell>
                                        <TableCell>{u.email}</TableCell>
                                        <TableCell>
                                            <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                                                {u.role || 'user'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <code className="text-xs bg-muted px-1 rounded">
                                                    {u.id.substring(0, 8)}...
                                                </code>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => handleCopyUserId(u.id)}
                                                >
                                                    {copiedId === u.id ? (
                                                        <Check className="h-3 w-3 text-green-500" />
                                                    ) : (
                                                        <Copy className="h-3 w-3" />
                                                    )}
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {u.createdAt?.toDate?.()
                                                ? u.createdAt.toDate().toLocaleDateString()
                                                : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {users.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                                            No users yet. Create your first user above.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
