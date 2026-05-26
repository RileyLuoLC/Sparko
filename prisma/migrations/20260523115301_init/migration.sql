-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EDITOR', 'REVIEWER', 'ANALYST');

-- CreateEnum
CREATE TYPE "XAccountKind" AS ENUM ('COMPANY', 'PERSONAL');

-- CreateEnum
CREATE TYPE "XAccountStatus" AS ENUM ('CONNECTED', 'NEEDS_REAUTH', 'DISABLED');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('CANDIDATE', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'SCHEDULED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "ScheduledPostStatus" AS ENUM ('QUEUED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('REPLY', 'REPOST', 'QUOTE');

-- CreateEnum
CREATE TYPE "InteractionStatus" AS ENUM ('SUGGESTED', 'APPROVED', 'EXECUTED', 'REJECTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CompanyMaterialType" AS ENUM ('POSITIONING', 'PRODUCT', 'CUSTOMER_PROOF', 'ANNOUNCEMENT', 'OTHER');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "defaultWoeid" INTEGER NOT NULL DEFAULT 1,
    "appTimezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "targetMarketTimezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "duplicateWindowHours" INTEGER NOT NULL DEFAULT 168,
    "minPostIntervalMinutes" INTEGER NOT NULL DEFAULT 240,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XAccount" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "personaId" TEXT,
    "xUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "kind" "XAccountKind" NOT NULL,
    "status" "XAccountStatus" NOT NULL DEFAULT 'CONNECTED',
    "timezone" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "quotePostsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "repliesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleLabel" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "contentPillars" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "guardrails" TEXT NOT NULL,
    "avoidTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultHashtags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMaterial" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CompanyMaterialType" NOT NULL DEFAULT 'OTHER',
    "content" TEXT NOT NULL,
    "url" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistAccount" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "xUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "notes" TEXT,
    "lastSeenPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchlistAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendSnapshot" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "woeid" INTEGER NOT NULL,
    "trendName" TEXT NOT NULL,
    "tweetCount" INTEGER,
    "rank" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourcePost" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "trendSnapshotId" TEXT,
    "watchlistAccountId" TEXT,
    "xPostId" TEXT NOT NULL,
    "authorUsername" TEXT NOT NULL,
    "authorDisplayName" TEXT,
    "text" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "repostCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "quoteCount" INTEGER NOT NULL DEFAULT 0,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourcePost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftPost" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "xAccountId" TEXT NOT NULL,
    "sourcePostId" TEXT,
    "trendSnapshotId" TEXT,
    "text" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "hashtags" TEXT[],
    "status" "DraftStatus" NOT NULL DEFAULT 'CANDIDATE',
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "riskReasons" TEXT[],
    "aiModel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "draftPostId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledPost" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "draftPostId" TEXT,
    "xAccountId" TEXT NOT NULL,
    "finalText" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledPostStatus" NOT NULL DEFAULT 'QUEUED',
    "duplicateGroupKey" TEXT NOT NULL,
    "lastError" TEXT,
    "xPublishedPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishAttempt" (
    "id" TEXT NOT NULL,
    "scheduledPostId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB,
    "statusCode" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricsSnapshot" (
    "id" TEXT NOT NULL,
    "xAccountId" TEXT NOT NULL,
    "xPostId" TEXT NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "repostCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "quoteCount" INTEGER NOT NULL DEFAULT 0,
    "impressionCount" INTEGER,
    "urlClickCount" INTEGER,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteractionSuggestion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "xAccountId" TEXT NOT NULL,
    "sourcePostId" TEXT NOT NULL,
    "type" "InteractionType" NOT NULL,
    "suggestedText" TEXT,
    "rationale" TEXT NOT NULL,
    "status" "InteractionStatus" NOT NULL DEFAULT 'SUGGESTED',
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "riskReasons" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InteractionSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_workspaceId_email_key" ON "User"("workspaceId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "XAccount_workspaceId_xUserId_key" ON "XAccount"("workspaceId", "xUserId");

-- CreateIndex
CREATE INDEX "CompanyMaterial_workspaceId_updatedAt_idx" ON "CompanyMaterial"("workspaceId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistAccount_workspaceId_username_key" ON "WatchlistAccount"("workspaceId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "SourcePost_workspaceId_xPostId_key" ON "SourcePost"("workspaceId", "xPostId");

-- CreateIndex
CREATE INDEX "ScheduledPost_workspaceId_scheduledFor_idx" ON "ScheduledPost"("workspaceId", "scheduledFor");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XAccount" ADD CONSTRAINT "XAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XAccount" ADD CONSTRAINT "XAccount_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMaterial" ADD CONSTRAINT "CompanyMaterial_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistAccount" ADD CONSTRAINT "WatchlistAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendSnapshot" ADD CONSTRAINT "TrendSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcePost" ADD CONSTRAINT "SourcePost_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcePost" ADD CONSTRAINT "SourcePost_trendSnapshotId_fkey" FOREIGN KEY ("trendSnapshotId") REFERENCES "TrendSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcePost" ADD CONSTRAINT "SourcePost_watchlistAccountId_fkey" FOREIGN KEY ("watchlistAccountId") REFERENCES "WatchlistAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPost" ADD CONSTRAINT "DraftPost_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPost" ADD CONSTRAINT "DraftPost_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPost" ADD CONSTRAINT "DraftPost_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPost" ADD CONSTRAINT "DraftPost_sourcePostId_fkey" FOREIGN KEY ("sourcePostId") REFERENCES "SourcePost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPost" ADD CONSTRAINT "DraftPost_trendSnapshotId_fkey" FOREIGN KEY ("trendSnapshotId") REFERENCES "TrendSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_draftPostId_fkey" FOREIGN KEY ("draftPostId") REFERENCES "DraftPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPost" ADD CONSTRAINT "ScheduledPost_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPost" ADD CONSTRAINT "ScheduledPost_draftPostId_fkey" FOREIGN KEY ("draftPostId") REFERENCES "DraftPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPost" ADD CONSTRAINT "ScheduledPost_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishAttempt" ADD CONSTRAINT "PublishAttempt_scheduledPostId_fkey" FOREIGN KEY ("scheduledPostId") REFERENCES "ScheduledPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricsSnapshot" ADD CONSTRAINT "MetricsSnapshot_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionSuggestion" ADD CONSTRAINT "InteractionSuggestion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionSuggestion" ADD CONSTRAINT "InteractionSuggestion_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionSuggestion" ADD CONSTRAINT "InteractionSuggestion_sourcePostId_fkey" FOREIGN KEY ("sourcePostId") REFERENCES "SourcePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
