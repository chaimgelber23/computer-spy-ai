import type { Timestamp } from 'firebase/firestore';

export type ScanJobStatus = 'Pending' | 'Processing' | 'Complete' | 'Error' | 'Awaiting Reports' | 'In Progress' | 'Awaiting Assignment' | 'Awaiting Report';
export type ScanJobSource = 'direct-scan' | 'file-import' | 'folder-import';
export type ItemType = 'Tefillin' | 'Mezuzah' | 'Torah' | 'Other';
export type UserRole = 'admin' | 'station';
export type AuditLogAction = 'uploaded_report' | 'downloaded_individual_scan' | 'downloaded_all_scans';

export interface ReportVersion {
  id: string;
  fileUrl: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: Timestamp;
  note?: string;
}

export interface Scan {
  id: string;
  originalFileName: string;
  assignedName: string;
  editedName?: string;
  editedBy?: string; // UID of user who edited
  editable?: boolean;
  filePath: string;
  downloadUrl: string;
  uploadedAt: Timestamp;
  fingerprint: string;
  renamedFilename?: string;
  customName: string;
}

export interface ScanJob {
  id: string;
  uploadedAt: Timestamp;
  uploadedBy: string; // user UID (stationId)
  status: ScanJobStatus;
  isCompleted?: boolean;
  notes: string;
  source: ScanJobSource;
  clientName: string;
  itemType: ItemType;
  itemCount?: number; // Physical quantity of items (e.g. 4 Mezuzahs)
  scanCount: number; // Expected number of scan files
  scans: Partial<Scan>[];
  email?: string;
  phone?: string;
  reportFile?: string; // Storage URL for the report
  reportUploadedBy?: string; // UID of admin/checker who uploaded report
  reportedAt?: Timestamp;
  lastDownloadedBy?: string; // UID of user who last downloaded
  lastDownloadAt?: Timestamp;
  fileSize?: number;
  reportUrl?: string; // General purpose report URL field
  assignedTo?: string; // Admin UID who claimed this job
  assignedAt?: Timestamp;
  assignedToName?: string; // Admin display name for easy viewing
  reportHistory?: ReportVersion[];
  externalLink?: string;
  externalLinkType?: 'google_drive' | 'dropbox' | 'other';
  externalLinkVerified?: boolean;
  externalLinkVerifiedBy?: string;
  externalLinkVerifiedAt?: Timestamp;
  jobName?: string; // Auto-generated job name based on itemType and sequence
  hasLetterIssues?: boolean; // True if letter issues were detected during checking
}

export interface AppUser {
  id: string;
  role?: UserRole;
  email?: string;
  name?: string;
  createdAt?: Timestamp;
  photoURL?: string;
  stationPrefix?: string; // e.g., "AAA", "BBB"
  mezuzahSequence?: number; // Current mezuzah batch number
  tefillinSequence?: number; // Current tefillin sequence
  torahSequence?: number; // Current torah sequence
  phone?: string;
  defaultFolderPath?: string; // User's preferred default folder for imports
  preferredScannerId?: string; // User's preferred scanner device ID
  [key: string]: string | number | boolean | Timestamp | undefined;
}

export interface Counters {
  tefillinCounter?: number;
  seferTorahCounter?: number;
}

export interface Station {
  id: string;
  name: string;
  isActive: boolean;
  totalScans?: number;
  waitingJobs?: number;
  completedJobs?: number;
  lastActivityAt?: Timestamp;
  tefillinCount?: number;
  mezuzahCount?: number;
  torahCount?: number;
}

export interface Notification {
  id: string;
  recipientId: string;
  jobId?: string;
  type: 'report_uploaded' | 'admin_message' | 'new_job_submitted';
  message: string;
  fileUrl?: string;
  fileName?: string;
  sentBy?: string;
  sentByName?: string;
  isRead: boolean;
  createdAt: Timestamp;
  hasLetterIssues?: boolean; // True if the associated job has letter issues
  reportFileUrl?: string; // Direct URL to report for download from notification
  stationId?: string; // For new_job_submitted - the station that submitted the job
  stationName?: string; // For new_job_submitted - the station name
}

export interface AuditLog {
  id?: string;
  jobId: string;
  adminUserId: string;
  action: AuditLogAction;
  timestamp: Timestamp;
  details?: Record<string, string | number | boolean>;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  createdAt: Timestamp;
  jobCount?: number;
  lastJobAt?: Timestamp;
}

export interface Scanner {
  id: string;
  name: string;
  manufacturer?: string;
  model?: string;
  isDefault?: boolean;
  scannerUrl?: string;
  capabilities?: {
    colorModes: string[];
    resolutions: number[];
    sources: string[];
    hasAdf: boolean;
  };
}

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
}

export interface WeeklyInsight {
  id?: string;
  createdAt: Timestamp;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  efficiencyScore: number;
  summary: string;
  repetitiveTasks: {
    description: string;
    frequency: string;
    timeWasted: string;
    suggestion: string;
  }[];
  totalActiveHours: number;
  totalIdleHours: number;
  topApps: { name: string; hours: number }[];
}

export interface DataStats {
  totalLogs: number;
  oldestLog: Timestamp | null;
  newestLog: Timestamp | null;
  totalActiveHours: number;
  totalIdleHours: number;
  daysOfData: number;
  isReadyForAnalysis: boolean;
}

// Agent heartbeat for tracking desktop agent status
export interface AgentHeartbeat {
  id?: string;
  userId: string;
  lastSeen: Timestamp;
  platform: string;
  version?: string;
  isActive: boolean;
}

// Analysis result from AI
export interface AnalysisResult {
  id?: string;
  efficiencyScore: number;
  summary: string;
  repetitiveTasks: RepetitiveTask[];
  topApps: AppUsage[];
}

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

