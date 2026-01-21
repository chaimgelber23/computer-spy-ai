"use client"

import { useState, useMemo } from 'react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { ActivityLog } from '@/lib/types';
import { generateInsightsAction } from './actions';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Sparkles, CheckCircle } from "lucide-react"

export default function InsightsPage() {
    const firestore = useFirestore();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<any>(null); // Type this properly if possible

    const logsQuery = useMemo(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'activity_logs'),
            orderBy('timestamp', 'desc'),
            limit(200) // Analyze last 200 events
        );
    }, [firestore]);

    const { data: logs } = useCollection<ActivityLog>(logsQuery);

    const handleAnalyze = async () => {
        if (!logs || logs.length === 0) return;
        setIsAnalyzing(true);
        try {
            const result = await generateInsightsAction(logs);
            setAnalysis(result);
        } catch (e) {
            console.error(e);
            alert("Failed to analyze. check console.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">AI Insights</h2>
                    <p className="text-muted-foreground">AI-powered analysis of your work patterns.</p>
                </div>
                <Button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !logs || logs.length === 0}
                    size="lg"
                >
                    {isAnalyzing ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generate New Insights
                        </>
                    )}
                </Button>
            </div>

            {analysis && (
                <div className="grid gap-6">
                    {/* Efficiency Score */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Efficiency Score</CardTitle>
                            <CardDescription>Based on focus and repetitive patterns</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4">
                                <Progress value={analysis.efficiencyScore} className="h-4" />
                                <span className="text-2xl font-bold">{analysis.efficiencyScore}%</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Repetitive Tasks */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Repetitive Workflows Detected</CardTitle>
                            <CardDescription>These tasks consume significant time and could be automated.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {analysis.repetitiveTasks.map((task: any, idx: number) => (
                                <Alert key={idx}>
                                    <AlertTitle className="flex justify-between items-center">
                                        <span>{task.description}</span>
                                        <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                                            {task.timeWasted} wasted
                                        </span>
                                    </AlertTitle>
                                    <AlertDescription className="mt-2">
                                        <p className="mb-2"><strong>Suggestion:</strong> {task.suggestion}</p>
                                    </AlertDescription>
                                </Alert>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Summary */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Weekly Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="leading-7">{analysis.summary}</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {!analysis && (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                    <Sparkles className="mx-auto h-12 w-12 mb-4 opacity-20" />
                    <h3 className="text-lg font-semibold">No Analysis Generated Yet</h3>
                    <p>Click the button above to analyze your recent tracking data.</p>
                </div>
            )}
        </div>
    );
}
