"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase/provider';
import { getIdToken } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Loader2, Shield, Users, Eye, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MilestoneData {
    period: string;
    label: string;
    daysRequired: number;
    daysRemaining: number;
    status: 'completed' | 'ready' | 'in_progress' | 'locked';
    completedAt: string | null;
}

interface AdminUser {
    id: string;
    username: string;
    email: string | null;
    role: string;
    createdAt: string | null;
    installedAt: string | null;
    platform: string | null;
    lastSeen: string | null;
    isActive: boolean;
    daysActive: number;
    milestones: MilestoneData[];
    lastContact: {
        date: string;
        milestone: string;
    } | null;
}

function MilestoneIndicator({ milestones }: { milestones: MilestoneData[] }) {
    return (
        <div className="flex gap-1 items-center">
            {milestones.map((m) => {
                let color = 'bg-muted';
                let title = `${m.label}: ${m.daysRemaining} days away`;

                if (m.status === 'completed') {
                    color = 'bg-green-500';
                    title = `${m.label}: Completed`;
                } else if (m.status === 'ready') {
                    color = 'bg-blue-500';
                    title = `${m.label}: Ready to analyze`;
                } else if (m.status === 'in_progress') {
                    color = 'bg-yellow-500';
                    title = `${m.label}: ${m.daysRemaining}d away`;
                }

                return (
                    <div
                        key={m.period}
                        className={`w-3 h-3 rounded-full ${color}`}
                        title={title}
                    />
                );
            })}
        </div>
    );
}

function formatLastSeen(lastSeen: string | null): string {
    if (!lastSeen) return 'Never';
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
}

export default function AdminPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();

    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Check admin status
    useEffect(() => {
        if (!user?.uid || !firestore) return;
        const checkAdmin = async () => {
            const userDoc = await getDoc(doc(firestore, 'users', user.uid));
            const data = userDoc.data();
            setIsAdmin(data?.role === 'admin');
        };
        checkAdmin();
    }, [user?.uid, firestore]);

    // Load users
    useEffect(() => {
        if (!isAdmin || !user) return;
        const loadUsers = async () => {
            try {
                const token = await getIdToken(user);
                const res = await fetch('/api/admin/users', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.users) {
                    setUsers(data.users);
                }
            } catch (err) {
                console.error('Failed to load users:', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadUsers();
    }, [isAdmin, user]);

    if (isAdmin === null) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

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
                            You don&apos;t have admin access.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Workflow Spy - Admin</h2>
                <p className="text-muted-foreground">Monitor users and their workflow analysis progress.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        All Users ({users.length})
                    </CardTitle>
                    <CardDescription>
                        Click on a user to view their activity logs and AI analysis.
                        <br />
                        <span className="text-xs mt-1 inline-flex gap-2 items-center">
                            Progress:
                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> done</span>
                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> ready</span>
                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> soon</span>
                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted inline-block" /> locked</span>
                        </span>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Installed</TableHead>
                                    <TableHead>Days Active</TableHead>
                                    <TableHead>Last Seen</TableHead>
                                    <TableHead>Last Contact</TableHead>
                                    <TableHead>Progress (3d / 7d / 14d / 21d)</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((u) => (
                                    <TableRow
                                        key={u.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => router.push(`/dashboard/admin/users/${u.id}`)}
                                    >
                                        <TableCell className="font-medium">
                                            <div>
                                                {u.username}
                                                {u.email && <div className="text-xs text-muted-foreground">{u.email}</div>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {u.isActive ? (
                                                <Badge variant="default" className="bg-green-600">
                                                    <Wifi className="h-3 w-3 mr-1" /> Online
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">
                                                    <WifiOff className="h-3 w-3 mr-1" /> Offline
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                            {formatDate(u.installedAt)}
                                        </TableCell>
                                        <TableCell>
                                            {u.daysActive} days
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {formatLastSeen(u.lastSeen)}
                                        </TableCell>
                                        <TableCell>
                                            {u.lastContact ? (
                                                <div className="text-xs">
                                                    <span className="font-medium">{u.lastContact.milestone}</span>
                                                    <br />
                                                    <span className="text-muted-foreground">{formatDate(u.lastContact.date)}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">No contact</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <MilestoneIndicator milestones={u.milestones} />
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/dashboard/admin/users/${u.id}`);
                                                }}
                                            >
                                                <Eye className="h-4 w-4 mr-1" />
                                                View
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {users.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                            No users yet. Users will appear here once they install the Workflow Spy desktop app.
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
