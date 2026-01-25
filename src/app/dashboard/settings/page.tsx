"use client"

import { useUser, useFirestore, useAuth } from '@/firebase/provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Wifi, WifiOff, Monitor, Key, Loader2, AlertCircle, Check } from "lucide-react"
import { useState, useEffect, useMemo } from 'react';
import { Label } from "@/components/ui/label";
import { doc, onSnapshot } from 'firebase/firestore';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { AgentHeartbeat } from '@/lib/types';

export default function SettingsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const auth = useAuth();
    const [agentStatus, setAgentStatus] = useState<AgentHeartbeat | null>(null);

    // Password change state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    // Listen to agent heartbeat
    useEffect(() => {
        if (!user?.uid || !firestore) return;

        const unsubscribe = onSnapshot(
            doc(firestore, 'agent_heartbeats', user.uid),
            (snapshot) => {
                if (snapshot.exists()) {
                    setAgentStatus(snapshot.data() as AgentHeartbeat);
                } else {
                    setAgentStatus(null);
                }
            },
            (error) => {
                console.error('Error listening to heartbeat:', error);
            }
        );

        return () => unsubscribe();
    }, [user?.uid, firestore]);

    // Check if agent is online (heartbeat within last 2 minutes)
    const isAgentOnline = useMemo(() => {
        if (!agentStatus?.lastSeen || !agentStatus?.isActive) return false;
        const lastSeen = agentStatus.lastSeen.toDate();
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        return lastSeen > twoMinutesAgo;
    }, [agentStatus]);

    const getLastSeenText = () => {
        if (!agentStatus?.lastSeen) return 'Never connected';
        const lastSeen = agentStatus.lastSeen.toDate();
        const diffMs = Date.now() - lastSeen.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 2) return 'Just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        return `${diffDays} days ago`;
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.email) return;

        setPasswordError(null);
        setPasswordSuccess(false);

        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            setPasswordError('Password must be at least 6 characters');
            return;
        }

        setIsChangingPassword(true);

        try {
            // Re-authenticate first
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);

            // Update password
            await updatePassword(user, newPassword);

            setPasswordSuccess(true);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            console.error('Password change error:', err);
            if (err.code === 'auth/wrong-password') {
                setPasswordError('Current password is incorrect');
            } else if (err.code === 'auth/weak-password') {
                setPasswordError('New password is too weak');
            } else {
                setPasswordError('Failed to change password. Please try again.');
            }
        } finally {
            setIsChangingPassword(false);
        }
    };

    if (!user) {
        return <div className="p-8">Please log in to view settings.</div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground">Manage your account and device connections.</p>
            </div>

            {/* Agent Status Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Monitor className="h-5 w-5" />
                                Desktop Agent Status
                            </CardTitle>
                            <CardDescription>
                                Real-time connection status of your desktop agent.
                            </CardDescription>
                        </div>
                        <Badge variant={isAgentOnline ? "default" : "secondary"} className={isAgentOnline ? "bg-green-500" : ""}>
                            {isAgentOnline ? (
                                <>
                                    <Wifi className="h-3 w-3 mr-1" />
                                    Online
                                </>
                            ) : (
                                <>
                                    <WifiOff className="h-3 w-3 mr-1" />
                                    Offline
                                </>
                            )}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-muted-foreground">Last Seen</p>
                            <p className="font-medium">{getLastSeenText()}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Platform</p>
                            <p className="font-medium">{agentStatus?.platform || 'Unknown'}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Version</p>
                            <p className="font-medium">{agentStatus?.version || 'Unknown'}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Status</p>
                            <p className="font-medium">{agentStatus?.isActive ? 'Tracking' : 'Stopped'}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Setup Instructions */}
            <Card>
                <CardHeader>
                    <CardTitle>Connect a Computer</CardTitle>
                    <CardDescription>
                        Follow these simple steps to start tracking your activity.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Step 1: Get the Agent */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</div>
                            <Label className="text-base font-semibold">Get the Desktop Agent</Label>
                        </div>
                        <div className="ml-8 space-y-2">
                            <p className="text-sm text-muted-foreground">
                                Download or clone the desktop agent to your computer.
                            </p>
                            <div className="rounded-md bg-slate-950 p-4">
                                <div className="text-sm text-slate-50 font-mono space-y-1">
                                    <p className="text-slate-400"># Navigate to the desktop-agent folder</p>
                                    <p>$ cd desktop-agent</p>
                                    <p className="text-slate-400"># Install dependencies</p>
                                    <p>$ npm install</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Run */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</div>
                            <Label className="text-base font-semibold">Run the Agent</Label>
                        </div>
                        <div className="ml-8 space-y-2">
                            <div className="rounded-md bg-slate-950 p-4">
                                <div className="text-sm text-slate-50 font-mono space-y-1">
                                    <p className="text-slate-400"># Start the agent</p>
                                    <p>$ node index.js</p>
                                    <p className="text-slate-400"># When prompted, log in with your account:</p>
                                    <p>📧 Email: <span className="text-green-400">{user.email}</span></p>
                                    <p>🔑 Password: <span className="text-slate-400">your password</span></p>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Use the same email and password you use to log in here. The agent will start tracking automatically.
                            </p>
                        </div>
                    </div>

                    {/* Step 3: Done */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</div>
                            <Label className="text-base font-semibold">You're All Set!</Label>
                        </div>
                        <div className="ml-8">
                            <p className="text-sm text-muted-foreground">
                                Leave the agent running in the background. After a few days of data collection,
                                visit the <strong>AI Insights</strong> page to get personalized automation suggestions.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Account Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Account Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-muted-foreground">Email</p>
                            <p className="font-medium">{user.email}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Display Name</p>
                            <p className="font-medium">{user.displayName || 'Not set'}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Change Password */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        Change Password
                    </CardTitle>
                    <CardDescription>
                        Update your account password.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                        {passwordError && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{passwordError}</AlertDescription>
                            </Alert>
                        )}

                        {passwordSuccess && (
                            <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20">
                                <Check className="h-4 w-4 text-green-600" />
                                <AlertDescription className="text-green-800 dark:text-green-200">
                                    Password changed successfully!
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="currentPassword">Current Password</Label>
                            <Input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                                disabled={isChangingPassword}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="newPassword">New Password</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                minLength={6}
                                disabled={isChangingPassword}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm New Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                                disabled={isChangingPassword}
                            />
                        </div>

                        <Button type="submit" disabled={isChangingPassword}>
                            {isChangingPassword ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Changing...
                                </>
                            ) : (
                                'Change Password'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
