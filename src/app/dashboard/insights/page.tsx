"use client"

import { useState, useMemo, useEffect } from 'react';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { useFirestore, useUser, useAuth } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { WeeklyInsight, DataStats, AnalysisResult, RepetitiveTask, AppUsage } from '@/lib/types';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles, AlertCircle } from "lucide-react"
import { getDataStats } from './stats-action';
import { DataMaturityTimeline } from '@/components/DataMaturityTimeline';
import { getIdToken } from 'firebase/auth';

export default function InsightsPage() {
    const firestore = useFirestore();
    const auth = useAuth();
    const { user } = useUser();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
    const [stats, setStats] = useState<DataStats | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch stats on load
    useEffect(() => {
        if (user?.uid) {
            getDataStats(user.uid).then(setStats).catch(console.error);
        }
    }, [user]);

    // Fetch historical insights
    const historyQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'weekly_insights'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
    }, [firestore, user]);

    const { data: history } = useCollection<WeeklyInsight>(historyQuery);

    const handleAnalyze = async () => {
        if (!user) return;
        setIsAnalyzing(true);
        setError(null);

        try {
            // Get the user's ID token for authentication
            const token = await getIdToken(user);

            const res = await fetch('/api/analyze/weekly', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ userId: user.uid })
            });

            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || `Request failed with status ${res.status}`);
            }

            if (json.success) {
                setCurrentAnalysis(json.data);
                // Refresh stats
                getDataStats(user.uid).then(setStats).catch(console.error);
            } else {
                throw new Error(json.error || 'Analysis failed');
            }
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';
            console.error('Analysis error:', e);
            setError(errorMessage);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">AI Insights</h2>
                    <p className="text-muted-foreground">AI-powered workflow analysis and automation suggestions.</p>
                </div>
                <Button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || (stats !== null && !stats.isReadyForAnalysis)}
                    size="lg"
                    className={stats !== null && !stats.isReadyForAnalysis ? "opacity-50" : ""}
                >
                    {isAnalyzing ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Running Analysis...
                        </>
                    ) : (
                        <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Run Weekly Analysis
                        </>
                    )}
                </Button>
            </div>

            {/* Error Alert */}
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Analysis Failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Timeline */}
            {stats && (
                <DataMaturityTimeline daysOfData={stats.daysOfData} />
            )}

            {/* Analysis Result */}
            {(currentAnalysis || (history && history.length > 0)) && (
                <div className="space-y-6">
                    {currentAnalysis && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-semibold">Latest Analysis Result</h3>
                                <Badge variant="secondary">Just Now</Badge>
                            </div>
                            <InsightView analysis={currentAnalysis} />
                        </div>
                    )}

                    {history && history.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold mt-12">History</h3>
                            {history.map((report) => (
                                <Card key={report.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                                    <CardHeader>
                                        <div className="flex justify-between">
                                            <div>
                                                <CardTitle>Weekly Report</CardTitle>
                                                <CardDescription>
                                                    {report.periodStart?.toDate().toLocaleDateString()} - {report.periodEnd?.toDate().toLocaleDateString()}
                                                </CardDescription>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-bold">{report.efficiencyScore}%</div>
                                                <div className="text-xs text-muted-foreground">Efficiency</div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="line-clamp-2 text-muted-foreground">{report.summary}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

interface InsightViewProps {
    analysis: AnalysisResult;
}

function InsightView({ analysis }: InsightViewProps) {
    return (
        <div className="grid gap-6">
            {/* Efficiency Score */}
            <Card>
                <CardHeader>
                    <CardTitle>Efficiency Score</CardTitle>
                    <CardDescription>Based on focus and repetitive patterns</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <Progress value={analysis.efficiencyScore} className="h-4 flex-1" />
                        <span className="text-2xl font-bold">{analysis.efficiencyScore}%</span>
                    </div>
                </CardContent>
            </Card>

            {/* Summary */}
            <Card>
                <CardHeader>
                    <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="leading-7">{analysis.summary}</p>
                </CardContent>
            </Card>

            {/* Top Apps */}
            {analysis.topApps && analysis.topApps.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Top Applications</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {analysis.topApps.map((app: AppUsage, i: number) => (
                                <div key={i} className="flex justify-between items-center text-sm">
                                    <span className="font-medium">{app.name}</span>
                                    <span className="text-muted-foreground">{app.hours.toFixed(1)} hrs</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Repetitive Tasks */}
            {analysis.repetitiveTasks && analysis.repetitiveTasks.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Repetitive Workflows Detected</CardTitle>
                        <CardDescription>These tasks consume significant time and could be automated.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {analysis.repetitiveTasks.map((task: RepetitiveTask, idx: number) => (
                            <Alert key={idx}>
                                <AlertTitle className="flex justify-between items-center">
                                    <span>{task.description}</span>
                                    <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                                        {task.timeWasted} wasted
                                    </span>
                                </AlertTitle>
                                <AlertDescription className="mt-2">
                                    <p className="mb-2"><strong>Suggestion:</strong> {task.suggestion}</p>
                                    <p className="text-xs text-muted-foreground mt-1">Frequency: {task.frequency}</p>
                                </AlertDescription>
                            </Alert>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
