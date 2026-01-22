"use client"

import { useMemo } from 'react';
import { collection, query, orderBy, limit, Timestamp, where } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { ActivityLog } from '@/lib/types';
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from 'date-fns';

export default function ActivityPage() {
    const firestore = useFirestore();

    const { user } = useUser();

    const logsQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'activity_logs'),
            where('userId', '==', user.uid),
            orderBy('timestamp', 'desc'),
            limit(50)
        );
    }, [firestore, user]);

    const { data: logs, isLoading } = useCollection<ActivityLog>(logsQuery);

    if (isLoading) {
        return <div className="p-8">Loading activity logs...</div>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>
                        Real-time log of your computer usage.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>App</TableHead>
                                <TableHead>Window Title</TableHead>
                                <TableHead>Duration</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs?.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="font-medium">
                                        {log.timestamp ? format(log.timestamp.toDate(), 'HH:mm:ss') : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{log.appName}</Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[300px] truncate" title={log.windowTitle}>
                                        {log.windowTitle}
                                    </TableCell>
                                    <TableCell>
                                        {log.durationSeconds.toFixed(1)}s
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && (!logs || logs.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                                        No activity logs found. Start the desktop agent!
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
