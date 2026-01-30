"use client"

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase/provider';
import { getIdToken } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Loader2, ArrowLeft, Copy, Check, Search, Download,
    Play, ChevronDown, ChevronUp, Clock, Zap, TrendingUp,
    MessageSquare, Plus, Mail, Phone, MoreHorizontal
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// --- Types ---
interface LogEntry {
    id: string;
    appName: string;
    windowTitle: string;
    url: string | null;
    durationSeconds: number;
    idleSeconds: number;
    timestamp: string;
    platform: string | null;
}

interface InsightData {
    id: string;
    period: string;
    aiProvider: string;
    createdAt: string;
    periodStart: string;
    periodEnd: string;
    analysis: {
        efficiencyScore: number;
        summary: string;
        repetitiveTasks: Array<{
            description: string;
            frequency: string;
            timeWasted: string;
            suggestion: string;
        }>;
        topApps: Array<{ name: string; hours: number }>;
        automationOpportunities?: Array<{
            title: string;
            description: string;
            estimatedTimeSaved: string;
            difficulty: string;
        }>;
    };
    totalActiveHours: number;
    totalIdleHours: number;
}

interface MilestoneData {
    period: string;
    label: string;
    daysRequired: number;
    daysRemaining: number;
    status: 'completed' | 'ready' | 'in_progress' | 'locked';
    completedAt: string | null;
}

interface ProgressData {
    daysActive: number;
    firstActivity: string | null;
    milestones: MilestoneData[];
}

interface CommunicationEntry {
    id: string;
    userId: string;
    date: string;
    milestone: string;
    method: string;
    notes: string;
    adminId: string;
    createdAt: string;
}

// --- Helpers ---
function formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
}

// --- Components ---

function LogsTab({
    logs, isLoading, uniqueApps, filters, setFilters, onCopySelected, onExportCsv
}: {
    logs: LogEntry[];
    isLoading: boolean;
    uniqueApps: string[];
    filters: { days: string; app: string; search: string };
    setFilters: (f: { days: string; app: string; search: string }) => void;
    onCopySelected: (logs: LogEntry[]) => void;
    onExportCsv: () => void;
}) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [copied, setCopied] = useState(false);

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const selectAll = () => {
        if (selectedIds.size === logs.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(logs.map(l => l.id)));
        }
    };

    const handleCopy = () => {
        const selected = logs.filter(l => selectedIds.has(l.id));
        onCopySelected(selected.length > 0 ? selected : logs);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <Select value={filters.days} onValueChange={(v) => setFilters({ ...filters, days: v })}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Time range" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1">Last 24 hours</SelectItem>
                        <SelectItem value="3">Last 3 days</SelectItem>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="14">Last 14 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={filters.app || 'all'} onValueChange={(v) => setFilters({ ...filters, app: v === 'all' ? '' : v })}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All Apps" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Apps</SelectItem>
                        {uniqueApps.map(app => (
                            <SelectItem key={app} value={app}>{app}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search window titles..."
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 items-center">
                <Button variant="outline" size="sm" onClick={selectAll}>
                    {selectedIds.size === logs.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    {copied ? 'Copied!' : `Copy ${selectedIds.size > 0 ? selectedIds.size : 'All'}`}
                </Button>
                <Button variant="outline" size="sm" onClick={onExportCsv}>
                    <Download className="h-4 w-4 mr-1" /> Export CSV
                </Button>
                <span className="text-sm text-muted-foreground ml-auto">
                    {logs.length} logs
                </span>
            </div>

            {/* Log List */}
            {isLoading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <ScrollArea className="h-[600px] border rounded-md">
                    <div className="font-mono text-xs leading-relaxed p-3 space-y-0.5">
                        {logs.map((log) => (
                            <div
                                key={log.id}
                                className={`flex gap-2 py-1 px-2 rounded cursor-pointer hover:bg-muted/50 ${selectedIds.has(log.id) ? 'bg-blue-50 dark:bg-blue-950' : ''}`}
                                onClick={() => toggleSelect(log.id)}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(log.id)}
                                    onChange={() => toggleSelect(log.id)}
                                    className="mt-0.5 shrink-0"
                                />
                                <span className="text-muted-foreground shrink-0 w-[140px]">
                                    {log.timestamp ? formatDate(log.timestamp) : 'Unknown'}
                                </span>
                                <span className="text-blue-600 dark:text-blue-400 shrink-0 w-[120px] truncate" title={log.appName}>
                                    {log.appName}
                                </span>
                                <span className="truncate flex-1" title={log.windowTitle}>
                                    {log.windowTitle}
                                </span>
                                <span className="text-muted-foreground shrink-0 w-[60px] text-right">
                                    {formatDuration(log.durationSeconds)}
                                </span>
                            </div>
                        ))}
                        {logs.length === 0 && (
                            <div className="text-center text-muted-foreground py-12">
                                No activity logs found for the selected filters.
                            </div>
                        )}
                    </div>
                </ScrollArea>
            )}
        </div>
    );
}

function SummariesTab({
    insights, progress, isLoading, onRunAnalysis, isRunning
}: {
    insights: InsightData[];
    progress: ProgressData | null;
    isLoading: boolean;
    onRunAnalysis: (period: string, provider: string) => void;
    isRunning: boolean;
}) {
    const [showHistory, setShowHistory] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState('7-day');
    const [selectedProvider, setSelectedProvider] = useState('claude');

    const latestInsight = insights[0] || null;
    const historicalInsights = insights.slice(1);

    if (isLoading) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Progress Tracker */}
            {progress && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Analysis Progress
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            Active for <strong>{progress.daysActive} days</strong>
                            {progress.firstActivity && (
                                <> since {new Date(progress.firstActivity).toLocaleDateString()}</>
                            )}
                        </p>
                        <div className="space-y-3">
                            {progress.milestones.map((m) => (
                                <div key={m.period} className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${m.status === 'completed' ? 'bg-green-500 text-white' :
                                        m.status === 'ready' ? 'bg-blue-500 text-white' :
                                            m.status === 'in_progress' ? 'bg-yellow-500 text-white' :
                                                'bg-muted text-muted-foreground'
                                        }`}>
                                        {m.status === 'completed' ? '✓' : m.daysRequired}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">{m.label}</span>
                                            <span className="text-xs text-muted-foreground">({m.period})</span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {m.status === 'completed'
                                                ? `Completed ${m.completedAt ? new Date(m.completedAt).toLocaleDateString() : ''}`
                                                : m.status === 'ready'
                                                    ? 'Ready to analyze!'
                                                    : m.status === 'in_progress'
                                                        ? `${m.daysRemaining} days remaining`
                                                        : `${m.daysRemaining} days away`
                                            }
                                        </span>
                                    </div>
                                    {m.status === 'ready' && (
                                        <Badge variant="default" className="bg-blue-500">Ready</Badge>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Run Analysis */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Play className="h-5 w-5" />
                        Run Analysis
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-3 items-end flex-wrap">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Period</label>
                            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="3-day">3-day</SelectItem>
                                    <SelectItem value="7-day">7-day</SelectItem>
                                    <SelectItem value="14-day">14-day</SelectItem>
                                    <SelectItem value="21-day">21-day</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">AI Provider</label>
                            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="claude">Claude</SelectItem>
                                    <SelectItem value="gemini">Gemini</SelectItem>
                                    <SelectItem value="openai">ChatGPT</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={() => onRunAnalysis(selectedPeriod, selectedProvider)}
                            disabled={isRunning}
                        >
                            {isRunning ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...</>
                            ) : (
                                <><Zap className="h-4 w-4 mr-2" /> Run Analysis</>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Latest Summary */}
            {latestInsight ? (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">
                                Latest Summary ({latestInsight.period})
                            </CardTitle>
                            <div className="flex gap-2">
                                <Badge variant="secondary">
                                    {latestInsight.aiProvider}
                                </Badge>
                                <Badge variant="outline">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {latestInsight.createdAt ? new Date(latestInsight.createdAt).toLocaleDateString() : ''}
                                </Badge>
                            </div>
                        </div>
                        <CardDescription>
                            Score: <strong>{latestInsight.analysis.efficiencyScore}/100</strong> |
                            Active: {latestInsight.totalActiveHours.toFixed(1)}h |
                            Idle: {latestInsight.totalIdleHours.toFixed(1)}h
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Summary */}
                        <div>
                            <h4 className="font-semibold mb-2">Summary</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {latestInsight.analysis.summary}
                            </p>
                        </div>

                        {/* Top Apps */}
                        {latestInsight.analysis.topApps?.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-2">Top Apps</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {latestInsight.analysis.topApps.map((app, i) => (
                                        <div key={i} className="bg-muted rounded-md px-3 py-2 text-sm">
                                            <span className="font-medium">{app.name}</span>
                                            <span className="text-muted-foreground ml-2">{app.hours.toFixed(1)}h</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Repetitive Tasks */}
                        {latestInsight.analysis.repetitiveTasks?.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-2">Repetitive Tasks Detected</h4>
                                <div className="space-y-3">
                                    {latestInsight.analysis.repetitiveTasks.map((task, i) => (
                                        <div key={i} className="border rounded-md p-3">
                                            <p className="text-sm font-medium">{task.description}</p>
                                            <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                                                <span>Frequency: {task.frequency}</span>
                                                <span>Time wasted: {task.timeWasted}</span>
                                            </div>
                                            <p className="text-sm mt-2 text-blue-600 dark:text-blue-400">
                                                Suggestion: {task.suggestion}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Automation Opportunities */}
                        {latestInsight.analysis.automationOpportunities && latestInsight.analysis.automationOpportunities.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-2">Automation Opportunities</h4>
                                <div className="space-y-3">
                                    {latestInsight.analysis.automationOpportunities.map((opp, i) => (
                                        <div key={i} className="border rounded-md p-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-sm">{opp.title}</span>
                                                <Badge variant={
                                                    opp.difficulty === 'easy' ? 'default' :
                                                        opp.difficulty === 'medium' ? 'secondary' : 'destructive'
                                                } className="text-xs">
                                                    {opp.difficulty}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{opp.description}</p>
                                            <p className="text-xs text-green-600 mt-1">Saves: {opp.estimatedTimeSaved}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                        No analysis has been run for this user yet. Use the &quot;Run Analysis&quot; button above.
                    </CardContent>
                </Card>
            )}

            {/* History Toggle */}
            {historicalInsights.length > 0 && (
                <div>
                    <Button
                        variant="ghost"
                        onClick={() => setShowHistory(!showHistory)}
                        className="w-full"
                    >
                        {showHistory ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                        {showHistory ? 'Hide' : 'Show'} Earlier Summaries ({historicalInsights.length})
                    </Button>

                    {showHistory && (
                        <div className="space-y-3 mt-3">
                            {historicalInsights.map((insight) => (
                                <Card key={insight.id} className="opacity-80">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm">
                                                {insight.period} - Score: {insight.analysis.efficiencyScore}/100
                                            </CardTitle>
                                            <div className="flex gap-2">
                                                <Badge variant="secondary" className="text-xs">
                                                    {insight.aiProvider}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {insight.createdAt ? new Date(insight.createdAt).toLocaleDateString() : ''}
                                                </span>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground line-clamp-3">
                                            {insight.analysis.summary}
                                        </p>
                                        {insight.analysis.automationOpportunities && insight.analysis.automationOpportunities.length > 0 && (
                                            <p className="text-xs text-blue-600 mt-2">
                                                {insight.analysis.automationOpportunities.length} automation opportunities identified
                                            </p>
                                        )}
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


function CommunicationsTab({
    communications, isLoading, onLogCommunication, milestones
}: {
    communications: CommunicationEntry[];
    isLoading: boolean;
    onLogCommunication: (data: { milestone: string; method: string; notes: string }) => Promise<void>;
    milestones: MilestoneData[];
}) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newMilestone, setNewMilestone] = useState('3-day');
    const [newMethod, setNewMethod] = useState('email');
    const [newNotes, setNewNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const communicatedMilestones = new Set(communications.map(c => c.milestone));

    const handleSubmit = async () => {
        setIsSubmitting(true);
        await onLogCommunication({
            milestone: newMilestone,
            method: newMethod,
            notes: newNotes,
        });
        setIsSubmitting(false);
        setIsDialogOpen(false);
        setNewNotes('');
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Milestone Communication Status */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Milestone Check-ins
                    </CardTitle>
                    <CardDescription>Track which milestones have been communicated to the user.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {['3-day', '7-day', '14-day', '21-day'].map(milestone => {
                            const communicated = communicatedMilestones.has(milestone);
                            const milestoneData = milestones.find(m => m.period === milestone);
                            return (
                                <div key={milestone} className={`border rounded-lg p-3 text-center ${communicated ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-muted/30'}`}>
                                    <div className="font-medium text-sm">{milestone}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {communicated ? 'Contacted' : milestoneData?.status === 'completed' || milestoneData?.status === 'ready' ? 'Ready - Not contacted' : 'Pending'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Log Communication Button + History */}
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Communication History</h3>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" /> Log Communication
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Log Communication</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <Label>Milestone</Label>
                                <Select value={newMilestone} onValueChange={setNewMilestone}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="3-day">3-day check-in</SelectItem>
                                        <SelectItem value="7-day">7-day check-in</SelectItem>
                                        <SelectItem value="14-day">14-day check-in</SelectItem>
                                        <SelectItem value="21-day">21-day check-in</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Method</Label>
                                <Select value={newMethod} onValueChange={setNewMethod}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="email">Email</SelectItem>
                                        <SelectItem value="call">Call</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Notes</Label>
                                <Textarea
                                    placeholder="What was communicated? Key findings shared, etc."
                                    value={newNotes}
                                    onChange={(e) => setNewNotes(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleSubmit} disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                Save
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Communication Timeline */}
            {communications.length > 0 ? (
                <div className="space-y-3">
                    {communications.map(comm => (
                        <Card key={comm.id}>
                            <CardContent className="py-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                            comm.method === 'email' ? 'bg-blue-100 dark:bg-blue-900' :
                                            comm.method === 'call' ? 'bg-green-100 dark:bg-green-900' :
                                            'bg-muted'
                                        }`}>
                                            {comm.method === 'email' ? <Mail className="h-4 w-4 text-blue-600" /> :
                                             comm.method === 'call' ? <Phone className="h-4 w-4 text-green-600" /> :
                                             <MoreHorizontal className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <div className="font-medium text-sm">
                                                {comm.milestone} check-in via {comm.method}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {comm.date ? new Date(comm.date).toLocaleString() : 'Unknown date'}
                                            </div>
                                        </div>
                                    </div>
                                    <Badge variant="outline">{comm.milestone}</Badge>
                                </div>
                                {comm.notes && (
                                    <p className="mt-3 text-sm text-muted-foreground pl-11">
                                        {comm.notes}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                        No communications logged yet. Click &quot;Log Communication&quot; to record an outreach.
                    </CardContent>
                </Card>
            )}
        </div>
    );
}


// --- Main Page ---
export default function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = use(params);
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();

    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const [userData, setUserData] = useState<{ username: string; email?: string } | null>(null);

    // Logs state
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [uniqueApps, setUniqueApps] = useState<string[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(true);
    const [logFilters, setLogFilters] = useState({ days: '7', app: '', search: '' });

    // Insights state
    const [insights, setInsights] = useState<InsightData[]>([]);
    const [progress, setProgress] = useState<ProgressData | null>(null);
    const [isLoadingInsights, setIsLoadingInsights] = useState(true);
    const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);

    // Communications state
    const [communications, setCommunications] = useState<CommunicationEntry[]>([]);
    const [isLoadingComms, setIsLoadingComms] = useState(true);

    // Check admin
    useEffect(() => {
        if (!user?.uid || !firestore) return;
        const checkAdmin = async () => {
            const userDoc = await getDoc(doc(firestore, 'users', user.uid));
            const data = userDoc.data();
            setIsAdmin(data?.role === 'admin');
        };
        checkAdmin();
    }, [user?.uid, firestore]);

    // Load target user data
    useEffect(() => {
        if (!firestore || !isAdmin) return;
        const load = async () => {
            const userDoc = await getDoc(doc(firestore, 'users', userId));
            const data = userDoc.data();
            setUserData({
                username: data?.username || data?.name || data?.email || userId.substring(0, 8),
                email: data?.email || undefined,
            });
        };
        load();
    }, [firestore, isAdmin, userId]);

    // Fetch logs
    const fetchLogs = useCallback(async () => {
        if (!user || !isAdmin) return;
        setIsLoadingLogs(true);
        try {
            const token = await getIdToken(user);
            const params = new URLSearchParams({
                days: logFilters.days,
                ...(logFilters.app && { app: logFilters.app }),
                ...(logFilters.search && { search: logFilters.search }),
            });
            const res = await fetch(`/api/admin/users/${userId}/logs?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setLogs(data.logs || []);
            setUniqueApps(data.uniqueApps || []);
        } catch (err) {
            console.error('Failed to load logs:', err);
        } finally {
            setIsLoadingLogs(false);
        }
    }, [user, isAdmin, userId, logFilters]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    // Fetch insights
    const fetchInsights = useCallback(async () => {
        if (!user || !isAdmin) return;
        setIsLoadingInsights(true);
        try {
            const token = await getIdToken(user);
            const res = await fetch(`/api/admin/users/${userId}/insights`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setInsights(data.insights || []);
            setProgress(data.progress || null);
        } catch (err) {
            console.error('Failed to load insights:', err);
        } finally {
            setIsLoadingInsights(false);
        }
    }, [user, isAdmin, userId]);

    useEffect(() => { fetchInsights(); }, [fetchInsights]);

    // Fetch communications
    const fetchCommunications = useCallback(async () => {
        if (!user || !isAdmin) return;
        setIsLoadingComms(true);
        try {
            const token = await getIdToken(user);
            const res = await fetch(`/api/admin/users/${userId}/communications`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setCommunications(data.communications || []);
        } catch (err) {
            console.error('Failed to load communications:', err);
        } finally {
            setIsLoadingComms(false);
        }
    }, [user, isAdmin, userId]);

    useEffect(() => { fetchCommunications(); }, [fetchCommunications]);

    // Log communication
    const handleLogCommunication = async (data: { milestone: string; method: string; notes: string }) => {
        if (!user) return;
        try {
            const token = await getIdToken(user);
            const res = await fetch(`/api/admin/users/${userId}/communications`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(data),
            });
            const result = await res.json();
            if (result.success) {
                await fetchCommunications();
            } else {
                alert(`Failed to log communication: ${result.error}`);
            }
        } catch (err) {
            console.error('Log communication error:', err);
            alert('Failed to log communication');
        }
    };

    // Run analysis
    const handleRunAnalysis = async (period: string, provider: string) => {
        if (!user) return;
        setIsRunningAnalysis(true);
        try {
            const token = await getIdToken(user);
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ userId, period, provider }),
            });
            const data = await res.json();
            if (data.success) {
                // Refresh insights
                await fetchInsights();
            } else {
                alert(`Analysis failed: ${data.error}`);
            }
        } catch (err) {
            console.error('Analysis error:', err);
            alert('Failed to run analysis');
        } finally {
            setIsRunningAnalysis(false);
        }
    };

    // Copy logs to clipboard
    const handleCopyLogs = (logsToExport: LogEntry[]) => {
        const text = logsToExport.map(l =>
            `${l.timestamp ? formatDate(l.timestamp) : 'Unknown'} | ${l.appName} | ${l.windowTitle} | ${formatDuration(l.durationSeconds)}`
        ).join('\n');
        navigator.clipboard.writeText(text);
    };

    // Export CSV
    const handleExportCsv = () => {
        const header = 'Timestamp,App,Window Title,Duration (seconds),Idle (seconds),URL\n';
        const rows = logs.map(l =>
            `"${l.timestamp || ''}","${l.appName}","${l.windowTitle.replace(/"/g, '""')}",${l.durationSeconds},${l.idleSeconds},"${l.url || ''}"`
        ).join('\n');
        const csv = header + rows;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `activity-logs-${userId.substring(0, 8)}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Loading states
    if (isAdmin === null) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!isAdmin) {
        return <div className="p-4 text-destructive">Access denied.</div>;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/admin')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">
                        {userData?.username || 'Loading...'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {userData?.email && <>{userData.email} | </>}
                        User ID: {userId}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="summaries" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="logs">Activity Logs</TabsTrigger>
                    <TabsTrigger value="summaries">Summaries & Progress</TabsTrigger>
                    <TabsTrigger value="communications">Communications</TabsTrigger>
                </TabsList>

                <TabsContent value="logs" className="mt-4">
                    <LogsTab
                        logs={logs}
                        isLoading={isLoadingLogs}
                        uniqueApps={uniqueApps}
                        filters={logFilters}
                        setFilters={setLogFilters}
                        onCopySelected={handleCopyLogs}
                        onExportCsv={handleExportCsv}
                    />
                </TabsContent>

                <TabsContent value="summaries" className="mt-4">
                    <SummariesTab
                        insights={insights}
                        progress={progress}
                        isLoading={isLoadingInsights}
                        onRunAnalysis={handleRunAnalysis}
                        isRunning={isRunningAnalysis}
                    />
                </TabsContent>

                <TabsContent value="communications" className="mt-4">
                    <CommunicationsTab
                        communications={communications}
                        isLoading={isLoadingComms}
                        onLogCommunication={handleLogCommunication}
                        milestones={progress?.milestones || []}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
