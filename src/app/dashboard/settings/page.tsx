"use client"

import { useUser } from '@/firebase/provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import { useState } from 'react';
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
    const { user } = useUser();
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (user?.uid) {
            navigator.clipboard.writeText(user.uid);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (!user) {
        return <div>Please log in to view settings.</div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground">Manage your account and device connections.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Connect a Computer</CardTitle>
                    <CardDescription>
                        To start tracking activity, enter this Device Key into your desktop agent.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Your Device Key</Label>
                        <div className="flex gap-2">
                            <Input
                                value={user.uid}
                                readOnly
                                className="font-mono bg-muted"
                            />
                            <Button variant="outline" size="icon" onClick={handleCopy}>
                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            This key links the desktop agent's data to your account.
                        </p>
                    </div>

                    <div className="rounded-md bg-slate-950 p-4 mt-6">
                        <div className="text-sm text-slate-50 font-mono space-y-2">
                            <p className="text-slate-400"># 1. On your computer:</p>
                            <p>$ node index.js</p>
                            <p className="text-slate-400"># 2. When prompted, paste your key:</p>
                            <p>? Enter your Device Key: <span className="text-green-400">{user.uid}</span></p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
