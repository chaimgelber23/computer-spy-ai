"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Circle, Clock, Loader2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface DataMaturityTimelineProps {
    daysOfData: number;
}

export function DataMaturityTimeline({ daysOfData }: DataMaturityTimelineProps) {
    const phases = [
        {
            name: "Phase 1: Baselines",
            description: "Learning your most used apps and basic habits.",
            duration: "1-3 Days",
            minDays: 1,
            completedAt: 3
        },
        {
            name: "Phase 2: Patterns",
            description: "Identifying repetitive workflows and distractions.",
            duration: "3-7 Days",
            minDays: 3,
            completedAt: 7
        },
        {
            name: "Phase 3: Deep Insights",
            description: "Full workflow optimization & agent suggestions.",
            duration: "2 Weeks+",
            minDays: 14,
            completedAt: 999
        }
    ];

    // Calculate progress (capped at 14 days for visual purposes)
    const progress = Math.min((daysOfData / 14) * 100, 100);

    return (
        <Card className="border-2 border-primary/10">
            <CardHeader className="pb-4">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Data Learning Progress</CardTitle>
                    <Badge variant={daysOfData >= 7 ? "default" : "outline"}>
                        {daysOfData} Days Collected
                    </Badge>
                </div>
                <CardDescription>
                    The AI gets smarter as it observes you for longer periods.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Started</span>
                            <span>Target: 2 Weeks</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                    </div>

                    {/* Timeline Steps */}
                    <div className="relative space-y-0 pl-2">
                        {/* Vertical line */}
                        <div className="absolute left-[11px] top-2 bottom-4 w-px bg-border" />

                        {phases.map((phase, index) => {
                            const isCompleted = daysOfData >= phase.completedAt;
                            const isActive = daysOfData >= phase.minDays && daysOfData < phase.completedAt;
                            const isLocked = daysOfData < phase.minDays;

                            return (
                                <div key={index} className="relative flex gap-4 pb-6 last:pb-0 group">
                                    <div className={`
                                        z-10 mt-1 h-6 w-6 rounded-full border-2 flex items-center justify-center bg-background
                                        ${isCompleted ? "border-green-500 text-green-500" :
                                            isActive ? "border-blue-500 text-blue-500 animate-pulse" :
                                                "border-muted text-muted-foreground"}
                                    `}>
                                        {isCompleted ? <CheckCircle2 className="h-3 w-3" /> :
                                            isActive ? <Clock className="h-3 w-3" /> :
                                                <Circle className="h-3 w-3" />}
                                    </div>
                                    <div className="flex-1 space-y-1 pt-0.5">
                                        <div className="flex justify-between items-center">
                                            <h4 className={`text-sm font-semibold ${isLocked ? "text-muted-foreground" : ""}`}>
                                                {phase.name}
                                            </h4>
                                            <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                                                {phase.duration}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {phase.description}
                                        </p>

                                        {isActive && (
                                            <div className="mt-2 text-xs font-medium text-blue-600 bg-blue-50 p-2 rounded flex items-center gap-2">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Currently analyzing at this level...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Prompt to wait */}
                    {daysOfData < 7 && (
                        <div className="bg-amber-50 p-3 rounded-md text-sm text-amber-800 border border-amber-200">
                            <strong>Tip:</strong> Keep the desktop agent running in the background. You'll get the best results after completing Phase 2.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
