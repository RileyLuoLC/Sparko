export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type DraftStatus = "CANDIDATE" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED" | "SCHEDULED" | "PUBLISHED";
export type ScheduledPostStatus = "QUEUED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "CANCELED";
export type InteractionType = "REPLY" | "REPOST" | "QUOTE";
export type InteractionStatus = "SUGGESTED" | "APPROVED" | "EXECUTED" | "REJECTED" | "BLOCKED";
export type XAccountKind = "COMPANY" | "PERSONAL";
export type XAccountStatus = "CONNECTED" | "NEEDS_REAUTH" | "DISABLED";
export type CompanyMaterialType = "POSITIONING" | "PRODUCT" | "CUSTOMER_PROOF" | "ANNOUNCEMENT" | "OTHER";
export type SignalOrigin = "DEMO" | "LIVE";

export interface Workspace {
  id: string;
  name: string;
  defaultLanguage: string;
  defaultWoeid: number;
  appTimezone: string;
  targetMarketTimezone: string;
  duplicateWindowHours: number;
  minPostIntervalMinutes: number;
}

export interface User {
  id: string;
  workspaceId: string;
  email: string;
  name: string;
  role: "ADMIN" | "EDITOR" | "REVIEWER" | "ANALYST";
}

export interface Persona {
  id: string;
  workspaceId: string;
  name: string;
  roleLabel: string;
  voice: string;
  audience: string;
  contentPillars: string[];
  guardrails: string;
  avoidTopics: string[];
  defaultHashtags: string[];
}

export interface XAccount {
  id: string;
  workspaceId: string;
  personaId?: string;
  roleLabels?: string[];
  xUserId: string;
  username: string;
  displayName: string;
  kind: XAccountKind;
  status: XAccountStatus;
  timezone?: string;
  quotePostsEnabled: boolean;
  repliesEnabled: boolean;
}

export interface WatchlistAccount {
  id: string;
  workspaceId: string;
  xUserId: string;
  username: string;
  displayName: string;
  priority: number;
  notes?: string;
  lastSeenPostId?: string;
}

export interface TrendSnapshot {
  id: string;
  workspaceId: string;
  woeid: number;
  trendName: string;
  tweetCount?: number;
  rank: number;
  capturedAt: string;
  origin?: SignalOrigin;
}

export interface SourcePost {
  id: string;
  workspaceId: string;
  trendSnapshotId?: string;
  watchlistAccountId?: string;
  xPostId: string;
  authorUsername: string;
  authorDisplayName?: string;
  text: string;
  url: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  quoteCount: number;
  postedAt: string;
  capturedAt: string;
  origin?: SignalOrigin;
}

export interface CompanyMaterial {
  id: string;
  workspaceId: string;
  title: string;
  type: CompanyMaterialType;
  content: string;
  url?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleInputTemplate {
  id: string;
  workspaceId: string;
  roleName: string;
  contentType: string;
  prompt: string;
  example?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyRoleInput {
  id: string;
  workspaceId: string;
  xAccountId: string;
  roleInputTemplateId: string;
  roleName: string;
  contentType: string;
  content: string;
  evidenceUrl?: string;
  weekOf: string;
  createdAt: string;
  updatedAt: string;
}

export interface DraftPost {
  id: string;
  workspaceId: string;
  personaId: string;
  xAccountId: string;
  sourcePostId?: string;
  trendSnapshotId?: string;
  text: string;
  rationale: string;
  hashtags: string[];
  status: DraftStatus;
  riskLevel: RiskLevel;
  riskReasons: string[];
  aiModel: string;
  createdAt: string;
  updatedAt: string;
}

export interface Approval {
  id: string;
  draftPostId: string;
  reviewerId: string;
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  comment?: string;
  createdAt: string;
}

export interface ScheduledPost {
  id: string;
  workspaceId: string;
  draftPostId?: string;
  xAccountId: string;
  finalText: string;
  scheduledFor: string;
  status: ScheduledPostStatus;
  duplicateGroupKey: string;
  lastError?: string;
  xPublishedPostId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublishAttempt {
  id: string;
  scheduledPostId: string;
  attemptNumber: number;
  statusCode?: number;
  error?: string;
  createdAt: string;
}

export interface MetricsSnapshot {
  id: string;
  xAccountId: string;
  xPostId: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  quoteCount: number;
  impressionCount?: number;
  urlClickCount?: number;
  capturedAt: string;
}

export interface InteractionSuggestion {
  id: string;
  workspaceId: string;
  xAccountId: string;
  sourcePostId: string;
  type: InteractionType;
  suggestedText?: string;
  rationale: string;
  status: InteractionStatus;
  riskLevel: RiskLevel;
  riskReasons: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  workspaceId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AccountAnalytics {
  accountId: string;
  engagementRate: number;
  publishSuccessRate: number;
  averageLikes: number;
  averageReplies: number;
  bestTimeSlots: string[];
  weeklyPublishedCount: number;
}

export interface DashboardData {
  workspace: Workspace;
  currentUser: User;
  personas: Persona[];
  xAccounts: XAccount[];
  watchlistAccounts: WatchlistAccount[];
  companyMaterials: CompanyMaterial[];
  roleInputTemplates: RoleInputTemplate[];
  weeklyInputs: WeeklyRoleInput[];
  trends: TrendSnapshot[];
  sourcePosts: SourcePost[];
  drafts: DraftPost[];
  approvals: Approval[];
  scheduledPosts: ScheduledPost[];
  interactions: InteractionSuggestion[];
  metrics: MetricsSnapshot[];
  auditLogs: AuditLog[];
  analytics: AccountAnalytics[];
}

export type ReadinessStatus = "READY" | "WARN" | "BLOCKED";

export interface ReadinessCheck {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
}

export interface ReadinessData {
  mode: "REAL" | "DEMO";
  canPublishAutomatically: boolean;
  canConnectX: boolean;
  canDiscoverLiveSignals: boolean;
  connectedAccountCount: number;
  queuedPublishJobs: number;
  delayedPublishJobs: number;
  failedPublishJobs: number;
  workerCount: number;
  checks: ReadinessCheck[];
  updatedAt: string;
}

export interface GeneratedDraftCandidate {
  text: string;
  rationale: string;
  hashtags: string[];
  riskLevel: RiskLevel;
  riskReasons: string[];
  sourcePostId?: string;
  trendSnapshotId?: string;
}
