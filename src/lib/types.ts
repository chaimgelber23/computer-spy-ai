import type { Timestamp } from 'firebase/firestore';

// ===== User Roles =====
export type UserRole = 'admin' | 'user';

// ===== App User =====
export interface AppUser {
  id: string;
  role?: UserRole;
  username?: string;
  email?: string;
  name?: string;
  createdAt?: Timestamp;
  installedAt?: Timestamp;
  photoURL?: string;
  platform?: string;
  lastSeen?: Timestamp;
  isActive?: boolean;
  [key: string]: string | number | boolean | Timestamp | undefined;
}

// ===== Activity Tracking =====
export interface ActivityLog {
  id?: string;
  userId: string;
  timestamp: Timestamp;
  endTime?: Timestamp;
  appName: string;
  windowTitle: string;
  url?: string;
  durationSeconds: number;
  grossDurationSeconds?: number;
  idleSeconds?: number;
  platform?: string;
  isCheckpoint?: boolean;
  // Enhanced tracking fields
  screenshotUrl?: string;
  clipboardActivity?: {
    copyCount: number;
    pasteCount: number;
    textMoved: number;
  };
  typingMetrics?: {
    totalKeystrokes: number;
    averageWPM: number;
  };
}

// ===== Agent Heartbeat =====
export interface AgentHeartbeat {
  id?: string;
  userId: string;
  lastSeen: Timestamp;
  platform: string;
  version?: string;
  isActive: boolean;
}

// ===== AI Analysis =====
export type AIProviderName = 'claude' | 'gemini' | 'openai';
export type AnalysisPeriod = '3-day' | '7-day' | '14-day' | '21-day';

export interface RepetitiveTask {
  description: string;
  frequency: string;
  timeWasted: string;
  suggestion: string;
}

export interface AppUsage {
  name: string;
  hours: number;
}

export interface AutomationOpportunity {
  title: string;
  description: string;
  estimatedTimeSaved: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface AnalysisResult {
  id?: string;
  efficiencyScore: number;
  summary: string;
  repetitiveTasks: RepetitiveTask[];
  topApps: AppUsage[];
  automationOpportunities: AutomationOpportunity[];
}

export interface Insight {
  id?: string;
  userId: string;
  period: AnalysisPeriod;
  aiProvider: AIProviderName;
  createdAt: Timestamp;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  analysis: AnalysisResult;
  totalActiveHours: number;
  totalIdleHours: number;
}

// ===== User Progress =====
export type MilestoneStatus = 'completed' | 'ready' | 'in_progress' | 'locked';

export interface Milestone {
  period: AnalysisPeriod;
  label: string;
  daysRequired: number;
  daysRemaining: number;
  status: MilestoneStatus;
  completedAt: Date | null;
}

export interface UserProgress {
  daysActive: number;
  firstActivity: Date | null;
  milestones: Milestone[];
}

// ===== Data Stats =====
export interface DataStats {
  totalLogs: number;
  oldestLog: Timestamp | null;
  newestLog: Timestamp | null;
  totalActiveHours: number;
  totalIdleHours: number;
  daysOfData: number;
  isReadyForAnalysis: boolean;
}

// ===== Admin Settings =====
export interface AdminSettings {
  defaultAIProvider: AIProviderName;
  autoAnalysisEnabled: boolean;
}

// ===== Communication Log (CRM) =====
export type CommunicationMilestone = '3-day' | '7-day' | '14-day' | '21-day' | 'other';
export type CommunicationMethod = 'email' | 'call' | 'other';

export interface CommunicationLog {
  id?: string;
  userId: string;
  date: Timestamp;
  milestone: CommunicationMilestone;
  method: CommunicationMethod;
  notes: string;
  adminId: string;
  createdAt: Timestamp;
}

// ===== Legacy types kept for backward compatibility =====
export interface WeeklyInsight {
  id?: string;
  createdAt: Timestamp;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  efficiencyScore: number;
  summary: string;
  repetitiveTasks: RepetitiveTask[];
  totalActiveHours: number;
  totalIdleHours: number;
  topApps: AppUsage[];
}
