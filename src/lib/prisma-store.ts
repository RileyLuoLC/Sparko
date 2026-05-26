import { prisma } from "./prisma";
import {
  assessRisk,
  buildDuplicateGroupKey,
  canApproveInteractionForApi,
  extractHashtags,
  formatDraftText,
  normalizePostWhitespace,
  truncateForX,
  validateDraftEditRequest,
  validateScheduleRequest
} from "./policy";
import { enqueueMetricsSync } from "./queue";
import { createPost, createRepost, getAuthenticatedUser, lookupPosts, refreshOAuthAccessToken, type XOAuthTokenResponse } from "./x-api";
import { getDashboardData as getDemoDashboardData } from "./demo-store";
import type {
  AccountAnalytics,
  CompanyMaterial,
  CompanyMaterialType,
  DashboardData,
  DraftPost,
  GeneratedDraftCandidate,
  InteractionSuggestion,
  ScheduledPost,
  SourcePost,
  TrendSnapshot,
  XAccount
} from "./types";

const DEFAULT_WORKSPACE_ID = "workspace_demo";
const DEFAULT_USER_EMAIL = "ops@example.com";
const SETUP_PLACEHOLDER_ROLES = new Set(["Operator", "Needs setup"]);

export function isPrismaStoreConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function toIso(value: Date | string) {
  return new Date(value).toISOString();
}

function publicXAccount(account: any): XAccount {
  const personaRoleLabel = account.persona?.roleLabel;
  const roleLabels =
    Array.isArray(account.roleLabels) && account.roleLabels.length > 0
      ? account.roleLabels.filter((role: string) => role && !SETUP_PLACEHOLDER_ROLES.has(role))
      : personaRoleLabel && !SETUP_PLACEHOLDER_ROLES.has(personaRoleLabel)
        ? [personaRoleLabel]
        : undefined;

  return {
    id: account.id,
    workspaceId: account.workspaceId,
    personaId: account.personaId ?? undefined,
    roleLabels,
    xUserId: account.xUserId,
    username: account.username,
    displayName: account.displayName,
    kind: account.kind,
    status: account.status,
    timezone: account.timezone ?? undefined,
    quotePostsEnabled: account.quotePostsEnabled,
    repliesEnabled: account.repliesEnabled
  };
}

function publicScheduledPost(post: any): ScheduledPost {
  return {
    id: post.id,
    workspaceId: post.workspaceId,
    draftPostId: post.draftPostId ?? undefined,
    xAccountId: post.xAccountId,
    finalText: post.finalText,
    scheduledFor: toIso(post.scheduledFor),
    status: post.status,
    duplicateGroupKey: post.duplicateGroupKey,
    lastError: post.lastError ?? undefined,
    xPublishedPostId: post.xPublishedPostId ?? undefined,
    createdAt: toIso(post.createdAt),
    updatedAt: toIso(post.updatedAt)
  };
}

function publicDraft(draft: any): DraftPost {
  return {
    id: draft.id,
    workspaceId: draft.workspaceId,
    personaId: draft.personaId,
    xAccountId: draft.xAccountId,
    sourcePostId: draft.sourcePostId ?? undefined,
    trendSnapshotId: draft.trendSnapshotId ?? undefined,
    text: draft.text,
    rationale: draft.rationale,
    hashtags: draft.hashtags,
    status: draft.status,
    riskLevel: draft.riskLevel,
    riskReasons: draft.riskReasons,
    aiModel: draft.aiModel,
    createdAt: toIso(draft.createdAt),
    updatedAt: toIso(draft.updatedAt)
  };
}

function publicCompanyMaterial(material: any): CompanyMaterial {
  return {
    id: material.id,
    workspaceId: material.workspaceId,
    title: material.title,
    type: material.type,
    content: material.content,
    url: material.url ?? undefined,
    notes: material.notes ?? undefined,
    createdAt: toIso(material.createdAt),
    updatedAt: toIso(material.updatedAt)
  };
}

function publicSourcePost(post: any): SourcePost {
  return {
    id: post.id,
    workspaceId: post.workspaceId,
    trendSnapshotId: post.trendSnapshotId ?? undefined,
    watchlistAccountId: post.watchlistAccountId ?? undefined,
    xPostId: post.xPostId,
    authorUsername: post.authorUsername,
    authorDisplayName: post.authorDisplayName ?? undefined,
    text: post.text,
    url: post.url,
    likeCount: post.likeCount,
    repostCount: post.repostCount,
    replyCount: post.replyCount,
    quoteCount: post.quoteCount,
    postedAt: toIso(post.postedAt),
    capturedAt: toIso(post.capturedAt),
    origin: "LIVE"
  };
}

function publicTrend(trend: any): TrendSnapshot {
  return {
    id: trend.id,
    workspaceId: trend.workspaceId,
    woeid: trend.woeid,
    trendName: trend.trendName,
    tweetCount: trend.tweetCount ?? undefined,
    rank: trend.rank,
    capturedAt: toIso(trend.capturedAt),
    origin: "LIVE"
  };
}

function publicInteraction(interaction: any): InteractionSuggestion {
  return {
    id: interaction.id,
    workspaceId: interaction.workspaceId,
    xAccountId: interaction.xAccountId,
    sourcePostId: interaction.sourcePostId,
    type: interaction.type,
    suggestedText: interaction.suggestedText ?? undefined,
    rationale: interaction.rationale,
    status: interaction.status,
    riskLevel: interaction.riskLevel,
    riskReasons: interaction.riskReasons,
    createdAt: toIso(interaction.createdAt),
    updatedAt: toIso(interaction.updatedAt)
  };
}

async function ensureWorkspace() {
  const workspace = await prisma.workspace.upsert({
    where: { id: DEFAULT_WORKSPACE_ID },
    update: {
      minPostIntervalMinutes: 1
    },
    create: {
      id: DEFAULT_WORKSPACE_ID,
      name: "X Ops Console",
      defaultLanguage: "en",
      defaultWoeid: 1,
      appTimezone: "Asia/Shanghai",
      targetMarketTimezone: "America/New_York",
      minPostIntervalMinutes: 1
    }
  });

  const user = await prisma.user.upsert({
    where: {
      workspaceId_email: {
        workspaceId: workspace.id,
        email: DEFAULT_USER_EMAIL
      }
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      email: DEFAULT_USER_EMAIL,
      name: "Ops Reviewer",
      role: "ADMIN"
    }
  });

  return { workspace, user };
}

async function ensureDefaultPersona(workspaceId: string) {
  return prisma.persona.upsert({
    where: { id: "persona_default" },
    update: {},
    create: {
      id: "persona_default",
      workspaceId,
      name: "Needs setup",
      roleLabel: "",
      voice: "",
      audience: "",
      contentPillars: [],
      guardrails: "",
      avoidTopics: [],
      defaultHashtags: []
    }
  });
}

async function ensureSetupPersonaForXAccount(workspaceId: string, xUserId: string) {
  return prisma.persona.upsert({
    where: { id: `persona_x_${xUserId}` },
    update: {},
    create: {
      id: `persona_x_${xUserId}`,
      workspaceId,
      name: "Needs setup",
      roleLabel: "",
      voice: "",
      audience: "",
      contentPillars: [],
      guardrails: "",
      avoidTopics: [],
      defaultHashtags: []
    }
  });
}

async function ensureAccountPersona(account: any) {
  if (account.personaId) {
    const persona = await prisma.persona.findUnique({ where: { id: account.personaId } });
    if (persona) {
      return persona;
    }
  }

  const persona = await ensureDefaultPersona(account.workspaceId);
  await prisma.xAccount.update({ where: { id: account.id }, data: { personaId: persona.id } });
  return persona;
}

async function audit(action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  const { workspace, user } = await ensureWorkspace();
  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      action,
      entityType,
      entityId,
      metadata: JSON.parse(JSON.stringify(metadata))
    }
  });
}

function analyticsFor(account: any, scheduledPosts: any[], metrics: any[]): AccountAnalytics {
  const accountMetrics = metrics.filter((item) => item.xAccountId === account.id);
  const accountScheduled = scheduledPosts.filter((post) => post.xAccountId === account.id);
  const published = accountScheduled.filter((post) => post.status === "PUBLISHED").length;
  const failed = accountScheduled.filter((post) => post.status === "FAILED").length;
  const attempts = published + failed;
  const impressions = accountMetrics.reduce((sum, item) => sum + (item.impressionCount ?? 0), 0);
  const engagements = accountMetrics.reduce(
    (sum, item) => sum + item.likeCount + item.repostCount + item.replyCount + item.quoteCount,
    0
  );

  return {
    accountId: account.id,
    engagementRate: impressions > 0 ? Number(((engagements / impressions) * 100).toFixed(2)) : 0,
    publishSuccessRate: attempts > 0 ? Number(((published / attempts) * 100).toFixed(1)) : 100,
    averageLikes:
      accountMetrics.length > 0
        ? Math.round(accountMetrics.reduce((sum, item) => sum + item.likeCount, 0) / accountMetrics.length)
        : 0,
    averageReplies:
      accountMetrics.length > 0
        ? Math.round(accountMetrics.reduce((sum, item) => sum + item.replyCount, 0) / accountMetrics.length)
        : 0,
    bestTimeSlots: ["09:00 ET", "12:30 ET", "17:00 ET"],
    weeklyPublishedCount: accountScheduled.filter((post) => Date.now() - post.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000)
      .length
  };
}

export async function getDashboardDataFromPrisma(): Promise<DashboardData> {
  const { workspace, user } = await ensureWorkspace();
  const [
    personas,
    xAccounts,
    trends,
    sourcePosts,
    drafts,
    approvals,
    scheduledPosts,
    interactions,
    metrics,
    auditLogs,
    companyMaterials
  ] = await Promise.all([
    prisma.persona.findMany({ where: { workspaceId: workspace.id }, orderBy: { updatedAt: "desc" } }),
    prisma.xAccount.findMany({ where: { workspaceId: workspace.id }, include: { persona: true }, orderBy: { updatedAt: "desc" } }),
    prisma.trendSnapshot.findMany({ where: { workspaceId: workspace.id }, orderBy: [{ capturedAt: "desc" }, { rank: "asc" }], take: 40 }),
    prisma.sourcePost.findMany({ where: { workspaceId: workspace.id }, orderBy: { likeCount: "desc" }, take: 80 }),
    prisma.draftPost.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, take: 80 }),
    prisma.approval.findMany({ orderBy: { createdAt: "desc" }, take: 80 }),
    prisma.scheduledPost.findMany({ where: { workspaceId: workspace.id }, orderBy: { scheduledFor: "asc" }, take: 80 }),
    prisma.interactionSuggestion.findMany({ where: { workspaceId: workspace.id }, orderBy: { updatedAt: "desc" }, take: 80 }),
    prisma.metricsSnapshot.findMany({ where: { xAccount: { workspaceId: workspace.id } }, orderBy: { capturedAt: "desc" }, take: 80 }),
    prisma.auditLog.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.companyMaterial.findMany({ where: { workspaceId: workspace.id }, orderBy: { updatedAt: "desc" }, take: 20 })
  ]);
  const demoDefaults = getDemoDashboardData();

  return {
    workspace,
    currentUser: user,
    personas: personas.map((persona: any) => ({
      id: persona.id,
      workspaceId: persona.workspaceId,
      name: persona.name,
      roleLabel: persona.roleLabel,
      voice: persona.voice,
      audience: persona.audience,
      contentPillars: persona.contentPillars ?? [],
      guardrails: persona.guardrails,
      avoidTopics: persona.avoidTopics ?? [],
      defaultHashtags: persona.defaultHashtags
    })),
    xAccounts: xAccounts.map(publicXAccount),
    watchlistAccounts: [],
    companyMaterials: companyMaterials.map(publicCompanyMaterial),
    roleInputTemplates: demoDefaults.roleInputTemplates,
    weeklyInputs: [],
    trends: trends.map(publicTrend),
    sourcePosts: sourcePosts.map(publicSourcePost),
    drafts: drafts.map(publicDraft),
    approvals: approvals.map((approval) => ({
      id: approval.id,
      draftPostId: approval.draftPostId,
      reviewerId: approval.reviewerId,
      decision: approval.decision,
      comment: approval.comment ?? undefined,
      createdAt: toIso(approval.createdAt)
    })),
    scheduledPosts: scheduledPosts.map(publicScheduledPost),
    interactions: interactions.map(publicInteraction),
    metrics: metrics.map((metric) => ({
      id: metric.id,
      xAccountId: metric.xAccountId,
      xPostId: metric.xPostId,
      likeCount: metric.likeCount,
      repostCount: metric.repostCount,
      replyCount: metric.replyCount,
      quoteCount: metric.quoteCount,
      impressionCount: metric.impressionCount ?? undefined,
      urlClickCount: metric.urlClickCount ?? undefined,
      capturedAt: toIso(metric.capturedAt)
    })),
    auditLogs: auditLogs.map((log) => ({
      id: log.id,
      workspaceId: log.workspaceId,
      userId: log.userId ?? undefined,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata as Record<string, unknown>,
      createdAt: toIso(log.createdAt)
    })),
    analytics: xAccounts.map((account) => analyticsFor(account, scheduledPosts, metrics))
  };
}

export async function persistConnectedXAccount(token: XOAuthTokenResponse) {
  const { workspace } = await ensureWorkspace();
  const userResult = await getAuthenticatedUser(token.access_token);
  const user = userResult.data;
  if (!user?.id || !user?.username) {
    throw new Error("X OAuth succeeded, but X did not return the connected user.");
  }
  const setupPersona = await ensureSetupPersonaForXAccount(workspace.id, user.id);

  const account = await prisma.xAccount.upsert({
    where: {
      workspaceId_xUserId: {
        workspaceId: workspace.id,
        xUserId: user.id
      }
    },
    update: {
      username: user.username,
      displayName: user.name ?? user.username,
      status: "CONNECTED",
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null
    },
    create: {
      workspaceId: workspace.id,
      xUserId: user.id,
      username: user.username,
      displayName: user.name ?? user.username,
      personaId: setupPersona.id,
      roleLabels: [],
      kind: "PERSONAL",
      status: "CONNECTED",
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null
    }
  });
  await audit("x_account.connected", "XAccount", account.id, { username: account.username });
  return publicXAccount(account);
}

function cleanRoleLabels(roleLabels: string[]) {
  return [...new Set(roleLabels.map((role) => role.trim()).filter((role) => role && !SETUP_PLACEHOLDER_ROLES.has(role)))];
}

export async function updateXAccountRolesInPrisma(accountId: string, roleLabels: string[]) {
  const cleanRoles = cleanRoleLabels(roleLabels);
  if (cleanRoles.length === 0) {
    throw new Error("Select at least one role for this account.");
  }

  const account = await prisma.xAccount.findUnique({ where: { id: accountId }, include: { persona: true } });
  if (!account) {
    throw new Error("X account not found.");
  }

  const persona = account.persona ?? (await ensureAccountPersona(account));
  const updatedPersona = await prisma.persona.update({
    where: { id: persona.id },
    data: { roleLabel: cleanRoles[0] }
  });
  const updatedAccount = await prisma.xAccount.update({
    where: { id: account.id },
    data: { roleLabels: cleanRoles },
    include: { persona: true }
  });

  await audit("x_account.roles.updated", "XAccount", account.id, { roleLabels: cleanRoles });
  return publicXAccount({ ...updatedAccount, persona: updatedPersona });
}

export async function updatePersonaStrategyInPrisma(
  personaId: string,
  input: Partial<{
    xAccountId: string;
    name: string;
    roleLabel: string;
    roleLabels: string[];
    voice: string;
    audience: string;
    contentPillars: string[];
    guardrails: string;
    avoidTopics: string[];
    defaultHashtags: string[];
  }>,
  xAccountId?: string
) {
  let persona = await prisma.persona.findUnique({ where: { id: personaId } });
  if (!persona) {
    throw new Error("Persona not found.");
  }
  let account =
    xAccountId
      ? await prisma.xAccount.findUnique({ where: { id: xAccountId }, include: { persona: true } })
      : null;
  if (xAccountId && !account) {
    throw new Error("X account not found.");
  }
  if (account && account.personaId === persona.id) {
    const accountCount = await prisma.xAccount.count({ where: { personaId: persona.id } });
    const shouldSplitPersona = persona.id === "persona_default" || accountCount > 1;
    if (shouldSplitPersona) {
      persona = await ensureSetupPersonaForXAccount(account.workspaceId, account.xUserId);
      account = await prisma.xAccount.update({
        where: { id: account.id },
        data: { personaId: persona.id },
        include: { persona: true }
      });
    }
  }

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    data.name = input.name.trim();
  }
  if (input.roleLabel !== undefined) {
    data.roleLabel = input.roleLabel.trim();
  }
  if (input.voice !== undefined) {
    data.voice = input.voice.trim();
  }
  if (input.audience !== undefined) {
    data.audience = input.audience.trim();
  }
  if (input.contentPillars !== undefined) {
    data.contentPillars = input.contentPillars.map((item) => item.trim()).filter(Boolean).slice(0, 8);
  }
  if (input.guardrails !== undefined) {
    data.guardrails = input.guardrails.trim();
  }
  if (input.avoidTopics !== undefined) {
    data.avoidTopics = input.avoidTopics.map((item) => item.trim()).filter(Boolean).slice(0, 8);
  }
  if (input.defaultHashtags !== undefined) {
    data.defaultHashtags = input.defaultHashtags
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 4)
      .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
  }

  const updatedPersona = await prisma.persona.update({ where: { id: persona.id }, data });
  const cleanRoles = input.roleLabels ? cleanRoleLabels(input.roleLabels) : input.roleLabel ? cleanRoleLabels([input.roleLabel]) : [];
  if (account && cleanRoles.length > 0) {
    await prisma.xAccount.update({
      where: { id: account.id },
      data: { roleLabels: cleanRoles }
    });
  } else if (input.roleLabel !== undefined) {
    await prisma.xAccount.updateMany({ where: { personaId: persona.id, roleLabels: { isEmpty: true } }, data: { roleLabels: [input.roleLabel] } });
  }

  await audit("persona.strategy.updated", "Persona", persona.id, {
    name: updatedPersona.name,
    roleLabel: updatedPersona.roleLabel
  });

  return {
    id: updatedPersona.id,
    workspaceId: updatedPersona.workspaceId,
    name: updatedPersona.name,
    roleLabel: updatedPersona.roleLabel,
    voice: updatedPersona.voice,
    audience: updatedPersona.audience,
    contentPillars: updatedPersona.contentPillars ?? [],
    guardrails: updatedPersona.guardrails,
    avoidTopics: updatedPersona.avoidTopics ?? [],
    defaultHashtags: updatedPersona.defaultHashtags,
    createdAt: toIso(updatedPersona.createdAt),
    updatedAt: toIso(updatedPersona.updatedAt)
  };
}

export async function getGenerationContextFromPrisma(xAccountId?: string) {
  const { workspace } = await ensureWorkspace();
  const account =
    (xAccountId ? await prisma.xAccount.findUnique({ where: { id: xAccountId } }) : null) ??
    (await prisma.xAccount.findFirst({ where: { workspaceId: workspace.id, status: "CONNECTED" }, orderBy: { updatedAt: "desc" } }));
  if (!account) {
    throw new Error("Connect an X account before generating drafts in real mode.");
  }
  const persona = await ensureAccountPersona(account);
  const companyMaterials = await prisma.companyMaterial.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { updatedAt: "desc" },
    take: 20
  });

  return {
    account: publicXAccount({ ...account, persona }),
    persona: {
      id: persona.id,
      workspaceId: persona.workspaceId,
      name: persona.name,
      roleLabel: persona.roleLabel,
      voice: persona.voice,
      audience: persona.audience,
      contentPillars: (persona as any).contentPillars ?? [],
      guardrails: persona.guardrails,
      avoidTopics: (persona as any).avoidTopics ?? [],
      defaultHashtags: persona.defaultHashtags
    },
    companyMaterials: companyMaterials.map((material) => ({
      id: material.id,
      workspaceId: material.workspaceId,
      title: material.title,
      type: material.type,
      content: material.content,
      url: material.url ?? undefined,
      notes: material.notes ?? undefined,
      createdAt: toIso(material.createdAt),
      updatedAt: toIso(material.updatedAt)
    })),
    weeklyInputs: []
  };
}

export async function addCompanyMaterialInPrisma(input: {
  title: string;
  type?: CompanyMaterialType;
  content: string;
  url?: string;
  notes?: string;
}) {
  const { workspace } = await ensureWorkspace();
  const material = await prisma.companyMaterial.create({
    data: {
      workspaceId: workspace.id,
      title: input.title.trim(),
      type: input.type ?? "OTHER",
      content: input.content.trim(),
      url: input.url?.trim() || null,
      notes: input.notes?.trim() || null
    }
  });
  await audit("company_material.created", "CompanyMaterial", material.id, { type: material.type });
  return publicCompanyMaterial(material);
}

export async function updateCompanyMaterialInPrisma(
  materialId: string,
  input: Partial<{
    title: string;
    type: CompanyMaterialType;
    content: string;
    url: string;
    notes: string;
  }>
) {
  const material = await prisma.companyMaterial.update({
    where: { id: materialId },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.content !== undefined ? { content: input.content.trim() } : {}),
      ...(input.url !== undefined ? { url: input.url.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {})
    }
  });
  await audit("company_material.updated", "CompanyMaterial", material.id, { type: material.type });
  return publicCompanyMaterial(material);
}

export async function deleteCompanyMaterialInPrisma(materialId: string) {
  const material = await prisma.companyMaterial.delete({ where: { id: materialId } });
  await audit("company_material.deleted", "CompanyMaterial", material.id, { title: material.title, type: material.type });
  return publicCompanyMaterial(material);
}

export async function addDraftsInPrisma(
  candidates: GeneratedDraftCandidate[],
  accountId: string,
  maxCount = candidates.length,
  statusOverride?: DraftPost["status"],
  options?: { preserveText?: boolean; aiModel?: string }
) {
  const account = await prisma.xAccount.findUnique({ where: { id: accountId } });
  if (!account) {
    throw new Error("X account not found.");
  }
  const persona = await ensureAccountPersona(account);
  const created: DraftPost[] = [];
  const existing = await prisma.draftPost.findMany({
    where: { workspaceId: account.workspaceId },
    select: { text: true }
  });
  const existingKeys = new Set(existing.map((draft) => buildDuplicateGroupKey(draft.text)));

  for (const candidate of candidates) {
    if (created.length >= maxCount) {
      break;
    }

    const text = options?.preserveText ? normalizePostWhitespace(candidate.text) : formatDraftText(candidate.text);
    const duplicateKey = buildDuplicateGroupKey(text);
    if (existingKeys.has(duplicateKey)) {
      continue;
    }

    const risk = assessRisk(text);
    const draft = await prisma.draftPost.create({
      data: {
        workspaceId: account.workspaceId,
        personaId: persona.id,
        xAccountId: account.id,
        sourcePostId: candidate.sourcePostId,
        trendSnapshotId: candidate.trendSnapshotId,
        text,
        rationale: candidate.rationale,
        hashtags: candidate.hashtags.length > 0 ? candidate.hashtags : extractHashtags(text),
        status: statusOverride ?? (risk.riskLevel === "HIGH" ? "NEEDS_REVIEW" : "CANDIDATE"),
        riskLevel: risk.riskLevel,
        riskReasons: [...new Set([...candidate.riskReasons, ...risk.riskReasons])],
        aiModel: options?.aiModel ?? "ai-generated"
      }
    });
    created.push(publicDraft(draft));
    existingKeys.add(duplicateKey);
  }

  await audit("draft.generated", "XAccount", account.id, { count: created.length, personaId: persona.id });
  return created;
}

export async function acceptDraftCandidateInPrisma(input: { candidate: GeneratedDraftCandidate; accountId: string }) {
  const [draft] = await addDraftsInPrisma([input.candidate], input.accountId, 1, undefined, {
    aiModel: "selected-candidate"
  });
  if (!draft) {
    throw new Error("Selected draft already exists in the review queue.");
  }
  await audit("draft.candidate.kept", "DraftPost", draft.id, { xAccountId: input.accountId });
  return { draft };
}

export async function acceptBriefAsDraftInPrisma(input: { text: string; accountId: string }) {
  const text = normalizePostWhitespace(input.text);
  if (!text) {
    throw new Error("Add a post brief or select at least one weekly input.");
  }
  if (text.length > 280) {
    throw new Error("Post text must be 280 characters or fewer to post as is.");
  }

  const risk = assessRisk(text);
  const [draft] = await addDraftsInPrisma(
    [
      {
        text,
        rationale: "Posted directly from the brief without rewriting.",
        hashtags: extractHashtags(text),
        riskLevel: risk.riskLevel,
        riskReasons: risk.riskReasons
      }
    ],
    input.accountId,
    1,
    "APPROVED",
    { preserveText: true, aiModel: "brief-as-is" }
  );
  if (!draft) {
    throw new Error("This brief already exists in the review queue.");
  }

  const { user } = await ensureWorkspace();
  const approval = await prisma.approval.create({
    data: {
      draftPostId: draft.id,
      reviewerId: user.id,
      decision: "APPROVED",
      comment: "Posted the brief as is."
    }
  });
  await audit("draft.brief.accepted", "DraftPost", draft.id, { xAccountId: input.accountId });
  return {
    draft,
    approval: {
      id: approval.id,
      draftPostId: approval.draftPostId,
      reviewerId: approval.reviewerId,
      decision: approval.decision,
      comment: approval.comment ?? undefined,
      createdAt: toIso(approval.createdAt)
    }
  };
}

export async function updateDraftAccountInPrisma(draftId: string, accountId: string) {
  const draft = await prisma.draftPost.findUnique({ where: { id: draftId } });
  if (!draft) {
    throw new Error("Draft not found.");
  }

  if (draft.status === "SCHEDULED" || draft.status === "PUBLISHED") {
    throw new Error("Scheduled or published drafts cannot change publishing account.");
  }

  const account = await prisma.xAccount.findUnique({ where: { id: accountId } });
  if (!account) {
    throw new Error("X account not found.");
  }
  const persona = await ensureAccountPersona(account);

  const updated = await prisma.draftPost.update({
    where: { id: draft.id },
    data: {
      xAccountId: account.id,
      personaId: persona.id
    }
  });

  await audit("draft.account.updated", "DraftPost", draft.id, {
    previousAccountId: draft.xAccountId,
    nextAccountId: updated.xAccountId,
    previousPersonaId: draft.personaId,
    nextPersonaId: updated.personaId
  });

  return { draft: publicDraft(updated) };
}

export async function updateDraftInPrisma(
  draftId: string,
  input: { text: string; rationale?: string }
): Promise<{ draft: DraftPost; reviewReset: boolean }> {
  const draft = await prisma.draftPost.findUnique({ where: { id: draftId } });
  if (!draft) {
    throw new Error("Draft not found.");
  }

  const validation = validateDraftEditRequest({ draft: publicDraft(draft), text: input.text });
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const previousStatus = draft.status;
  const previousRiskLevel = draft.riskLevel;
  const reviewReset = previousStatus === "APPROVED";
  const updated = await prisma.draftPost.update({
    where: { id: draft.id },
    data: {
      text: validation.text,
      rationale: input.rationale?.trim() || draft.rationale || "Edited by reviewer.",
      hashtags: extractHashtags(validation.text),
      riskLevel: validation.riskLevel,
      riskReasons: validation.riskReasons,
      status: validation.riskLevel === "HIGH" || reviewReset ? "NEEDS_REVIEW" : "CANDIDATE"
    }
  });

  await audit("draft.edited", "DraftPost", draft.id, {
    previousStatus,
    nextStatus: updated.status,
    previousRiskLevel,
    nextRiskLevel: updated.riskLevel,
    reviewReset
  });

  return { draft: publicDraft(updated), reviewReset };
}

export async function deleteDraftInPrisma(draftId: string) {
  const draft = await prisma.draftPost.findUnique({ where: { id: draftId } });
  if (!draft) {
    throw new Error("Draft not found.");
  }

  if (draft.status === "SCHEDULED" || draft.status === "PUBLISHED") {
    throw new Error("Scheduled or published drafts cannot be deleted from the review queue.");
  }

  const deleted = await prisma.draftPost.delete({ where: { id: draft.id } });
  await audit("draft.deleted", "DraftPost", draft.id, {
    status: draft.status,
    xAccountId: draft.xAccountId
  });
  return publicDraft(deleted);
}

export async function approveDraftInPrisma(draftId: string, input?: { comment?: string }) {
  const draft = await prisma.draftPost.findUnique({ where: { id: draftId } });
  if (!draft) {
    throw new Error("Draft not found.");
  }
  const { user } = await ensureWorkspace();
  const [updated, approval] = await prisma.$transaction([
    prisma.draftPost.update({ where: { id: draft.id }, data: { status: "APPROVED" } }),
    prisma.approval.create({
      data: {
        draftPostId: draft.id,
        reviewerId: user.id,
        decision: "APPROVED",
        comment: input?.comment
      }
    })
  ]);
  await audit("draft.approved", "DraftPost", draft.id, { comment: input?.comment ?? null });
  return {
    draft: publicDraft(updated),
    approval: {
      id: approval.id,
      draftPostId: approval.draftPostId,
      reviewerId: approval.reviewerId,
      decision: approval.decision,
      comment: approval.comment ?? undefined,
      createdAt: toIso(approval.createdAt)
    }
  };
}

async function freshAccountToken(account: any) {
  if (account.accessToken && (!account.tokenExpiresAt || account.tokenExpiresAt.getTime() - Date.now() > 120_000)) {
    return account.accessToken;
  }

  if (!account.refreshToken) {
    throw new Error("Connected X account needs reauthorization.");
  }

  const refreshed = await refreshOAuthAccessToken(account.refreshToken);
  await prisma.xAccount.update({
    where: { id: account.id },
    data: {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? account.refreshToken,
      tokenExpiresAt: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null,
      status: "CONNECTED"
    }
  });
  return refreshed.access_token;
}

export async function schedulePostInPrisma(input: {
  draftPostId?: string;
  xAccountId: string;
  finalText: string;
  scheduledFor: string;
}) {
  const { workspace } = await ensureWorkspace();
  const account = await prisma.xAccount.findUnique({ where: { id: input.xAccountId } });
  if (!account || account.workspaceId !== workspace.id) {
    throw new Error("X account not found.");
  }

  const draft = input.draftPostId ? await prisma.draftPost.findUnique({ where: { id: input.draftPostId } }) : undefined;
  const scheduledFor = new Date(input.scheduledFor);
  if (Number.isNaN(scheduledFor.getTime())) {
    throw new Error("Invalid scheduled time.");
  }

  const scheduledPosts = (await prisma.scheduledPost.findMany({ where: { workspaceId: workspace.id } })).map(publicScheduledPost);
  const validation = validateScheduleRequest({
    workspace,
    scheduledPosts,
    draft: draft ? publicDraft(draft) : undefined,
    xAccountId: account.id,
    text: input.finalText,
    scheduledFor
  });
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const scheduledPost = await prisma.scheduledPost.create({
    data: {
      workspaceId: workspace.id,
      draftPostId: draft?.id,
      xAccountId: account.id,
      finalText: truncateForX(input.finalText),
      scheduledFor,
      status: "QUEUED",
      duplicateGroupKey: validation.duplicateGroupKey
    }
  });

  if (draft) {
    await prisma.draftPost.update({ where: { id: draft.id }, data: { status: "SCHEDULED" } });
  }
  await audit("post.scheduled", "ScheduledPost", scheduledPost.id, {
    draftPostId: draft?.id ?? null,
    xAccountId: account.id,
    scheduledFor: scheduledPost.scheduledFor.toISOString()
  });
  return publicScheduledPost(scheduledPost);
}

export async function updateScheduledPostInPrisma(id: string, input: { scheduledFor: string }) {
  const { workspace } = await ensureWorkspace();
  const scheduledPost = await prisma.scheduledPost.findUnique({
    where: { id },
    include: { draftPost: true }
  });
  if (!scheduledPost || scheduledPost.workspaceId !== workspace.id) {
    throw new Error("Scheduled post not found.");
  }
  if (!["QUEUED", "FAILED"].includes(scheduledPost.status)) {
    throw new Error("Only queued or failed scheduled posts can be rescheduled.");
  }

  const scheduledFor = new Date(input.scheduledFor);
  if (Number.isNaN(scheduledFor.getTime())) {
    throw new Error("Invalid scheduled time.");
  }

  const scheduledPosts = (await prisma.scheduledPost.findMany({
    where: {
      workspaceId: workspace.id,
      id: { not: scheduledPost.id }
    }
  })).map(publicScheduledPost);
  const validation = validateScheduleRequest({
    workspace,
    scheduledPosts,
    xAccountId: scheduledPost.xAccountId,
    text: scheduledPost.finalText,
    scheduledFor
  });
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const updated = await prisma.scheduledPost.update({
    where: { id: scheduledPost.id },
    data: {
      scheduledFor,
      status: "QUEUED",
      lastError: null,
      duplicateGroupKey: validation.duplicateGroupKey
    }
  });
  if (scheduledPost.draftPostId) {
    await prisma.draftPost.update({ where: { id: scheduledPost.draftPostId }, data: { status: "SCHEDULED" } });
  }
  await audit("post.rescheduled", "ScheduledPost", scheduledPost.id, {
    scheduledFor: updated.scheduledFor.toISOString()
  });
  return publicScheduledPost(updated);
}

export async function cancelScheduledPostInPrisma(id: string) {
  const { workspace } = await ensureWorkspace();
  const scheduledPost = await prisma.scheduledPost.findUnique({
    where: { id },
    include: { draftPost: true }
  });
  if (!scheduledPost || scheduledPost.workspaceId !== workspace.id) {
    throw new Error("Scheduled post not found.");
  }
  if (["PUBLISHED", "PUBLISHING", "CANCELED"].includes(scheduledPost.status)) {
    throw new Error("Only queued or failed scheduled posts can be canceled.");
  }

  const updated = await prisma.scheduledPost.update({
    where: { id: scheduledPost.id },
    data: {
      status: "CANCELED",
      lastError: null
    }
  });
  if (scheduledPost.draftPostId && scheduledPost.draftPost?.status === "SCHEDULED") {
    await prisma.draftPost.update({ where: { id: scheduledPost.draftPostId }, data: { status: "APPROVED" } });
  }
  await audit("post.schedule_canceled", "ScheduledPost", scheduledPost.id, {});
  return publicScheduledPost(updated);
}

export async function publishScheduledPost(scheduledPostId: string) {
  const scheduledPost = await prisma.scheduledPost.findUnique({
    where: { id: scheduledPostId },
    include: { xAccount: true }
  });
  if (!scheduledPost) {
    throw new Error("Scheduled post not found.");
  }
  if (scheduledPost.status === "PUBLISHED") {
    return publicScheduledPost(scheduledPost);
  }
  if (scheduledPost.status === "CANCELED") {
    return publicScheduledPost(scheduledPost);
  }
  if (scheduledPost.scheduledFor.getTime() > Date.now() + 5_000) {
    return publicScheduledPost(scheduledPost);
  }

  const attemptNumber = (await prisma.publishAttempt.count({ where: { scheduledPostId } })) + 1;
  await prisma.scheduledPost.update({ where: { id: scheduledPost.id }, data: { status: "PUBLISHING", lastError: null } });

  try {
    const accessToken = await freshAccountToken(scheduledPost.xAccount);
    const payload = { text: scheduledPost.finalText };
    const response = await createPost({ accessToken, text: scheduledPost.finalText });
    const xPublishedPostId = response?.data?.id;
    if (!xPublishedPostId) {
      throw new Error("X create post response did not include a post id.");
    }

    await prisma.publishAttempt.create({
      data: {
        scheduledPostId,
        attemptNumber,
        requestPayload: payload,
        responsePayload: response,
        statusCode: 200
      }
    });
    const updated = await prisma.scheduledPost.update({
      where: { id: scheduledPost.id },
      data: { status: "PUBLISHED", xPublishedPostId, lastError: null }
    });
    if (scheduledPost.draftPostId) {
      await prisma.draftPost.update({ where: { id: scheduledPost.draftPostId }, data: { status: "PUBLISHED" } });
    }
    await audit("post.published", "ScheduledPost", scheduledPost.id, { xPublishedPostId });
    await enqueueMetricsSync([xPublishedPostId]);
    await enqueueMetricsSync([xPublishedPostId], 15 * 60 * 1000);
    return publicScheduledPost(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "X publish failed.";
    if (
      message.includes("Unsupported Authentication") ||
      message.includes("Application-Only") ||
      message.includes("Unauthorized") ||
      message.includes("401") ||
      message.includes("403")
    ) {
      await prisma.xAccount.update({ where: { id: scheduledPost.xAccountId }, data: { status: "NEEDS_REAUTH" } });
    }
    await prisma.publishAttempt.create({
      data: {
        scheduledPostId,
        attemptNumber,
        requestPayload: { text: scheduledPost.finalText },
        error: message
      }
    });
    await prisma.scheduledPost.update({ where: { id: scheduledPost.id }, data: { status: "FAILED", lastError: message } });
    await audit("post.publish_failed", "ScheduledPost", scheduledPost.id, { error: message });
    throw error;
  }
}

export async function publishDueScheduledPostsInPrisma(limit = 20) {
  const duePosts = await prisma.scheduledPost.findMany({
    where: {
      status: "QUEUED",
      scheduledFor: {
        lte: new Date()
      }
    },
    orderBy: {
      scheduledFor: "asc"
    },
    take: limit
  });

  const results = [];
  for (const post of duePosts) {
    try {
      results.push(await publishScheduledPost(post.id));
    } catch (error) {
      results.push({
        id: post.id,
        status: "FAILED",
        error: error instanceof Error ? error.message : "Publish failed."
      });
    }
  }

  return results;
}

function interactionDraft(type: "REPLY" | "REPOST" | "QUOTE", sourcePost: SourcePost, account: XAccount) {
  if (type === "REPOST") {
    return {
      suggestedText: undefined,
      rationale: "High-signal source post worth amplifying from this account.",
      riskLevel: "LOW" as const,
      riskReasons: []
    };
  }
  const text =
    type === "REPLY"
      ? `Thanks for mentioning us. The useful part is keeping the review loop explicit before anything ships.`
      : `Useful signal: ${sourcePost.text.replace(/https?:\/\/\S+/g, "").slice(0, 160).trim()}`;
  const risk = assessRisk(text);
  return {
    suggestedText: truncateForX(text),
    rationale:
      type === "REPLY"
        ? `The source post mentioned @${account.username}, so this is eligible for human-approved API reply.`
        : "The source post has strong public engagement and can be handled as a quote-post suggestion.",
    ...risk
  };
}

async function suggestInteractionForSourcePost(sourcePost: SourcePost) {
  const account = await prisma.xAccount.findFirst({
    where: { workspaceId: sourcePost.workspaceId, status: "CONNECTED" },
    orderBy: { updatedAt: "desc" }
  });
  if (!account) {
    return undefined;
  }

  const publicAccount = publicXAccount(account);
  const mentioned = sourcePost.text.toLowerCase().includes(`@${account.username.toLowerCase()}`);
  const signalScore = sourcePost.likeCount + sourcePost.repostCount * 2 + sourcePost.replyCount + sourcePost.quoteCount * 3;
  const type = mentioned ? "REPLY" : account.quotePostsEnabled && signalScore >= 50 ? "QUOTE" : "REPOST";
  const existing = await prisma.interactionSuggestion.findFirst({
    where: { workspaceId: sourcePost.workspaceId, xAccountId: account.id, sourcePostId: sourcePost.id, type }
  });
  if (existing) {
    return publicInteraction(existing);
  }

  const draft = interactionDraft(type, sourcePost, publicAccount);
  const interaction = await prisma.interactionSuggestion.create({
    data: {
      workspaceId: sourcePost.workspaceId,
      xAccountId: account.id,
      sourcePostId: sourcePost.id,
      type,
      suggestedText: draft.suggestedText,
      rationale: draft.rationale,
      riskLevel: draft.riskLevel ?? "LOW",
      riskReasons: draft.riskReasons ?? []
    }
  });
  return publicInteraction(interaction);
}

export async function recordDiscoveryInPrisma(input: {
  keywords?: string[];
  woeid?: number;
  trendInputs?: Array<{ trendName: string; tweetCount?: number }>;
  sourcePostInputs?: Array<{
    trendName: string;
    xPostId: string;
    authorUsername: string;
    authorDisplayName?: string;
    text: string;
    url: string;
    likeCount?: number;
    repostCount?: number;
    replyCount?: number;
    quoteCount?: number;
    postedAt?: string;
  }>;
}) {
  const { workspace } = await ensureWorkspace();
  const trendInputs: Array<{ trendName: string; tweetCount?: number }> = input.trendInputs?.length
    ? input.trendInputs
    : (input.keywords ?? ["AI product"]).map((keyword) => ({ trendName: keyword }));
  const trends: TrendSnapshot[] = [];
  const sourcePosts: SourcePost[] = [];
  const interactions: InteractionSuggestion[] = [];

  for (const [index, trendInput] of trendInputs.slice(0, 12).entries()) {
    const trend = await prisma.trendSnapshot.create({
      data: {
        workspaceId: workspace.id,
        woeid: input.woeid ?? workspace.defaultWoeid,
        trendName: trendInput.trendName,
        tweetCount: trendInput.tweetCount,
        rank: index + 1
      }
    });
    const publicTrendItem = publicTrend(trend);
    trends.push(publicTrendItem);

    const matchingPosts = input.sourcePostInputs?.filter((post) => post.trendName === trendInput.trendName) ?? [];
    for (const postInput of matchingPosts.slice(0, 4)) {
      const post = await prisma.sourcePost.upsert({
        where: {
          workspaceId_xPostId: {
            workspaceId: workspace.id,
            xPostId: postInput.xPostId
          }
        },
        update: {
          trendSnapshotId: trend.id,
          authorUsername: postInput.authorUsername,
          authorDisplayName: postInput.authorDisplayName,
          text: postInput.text,
          url: postInput.url,
          likeCount: postInput.likeCount ?? 0,
          repostCount: postInput.repostCount ?? 0,
          replyCount: postInput.replyCount ?? 0,
          quoteCount: postInput.quoteCount ?? 0,
          postedAt: postInput.postedAt ? new Date(postInput.postedAt) : new Date()
        },
        create: {
          workspaceId: workspace.id,
          trendSnapshotId: trend.id,
          xPostId: postInput.xPostId,
          authorUsername: postInput.authorUsername,
          authorDisplayName: postInput.authorDisplayName,
          text: postInput.text,
          url: postInput.url,
          likeCount: postInput.likeCount ?? 0,
          repostCount: postInput.repostCount ?? 0,
          replyCount: postInput.replyCount ?? 0,
          quoteCount: postInput.quoteCount ?? 0,
          postedAt: postInput.postedAt ? new Date(postInput.postedAt) : new Date()
        }
      });
      const publicPost = publicSourcePost(post);
      sourcePosts.push(publicPost);
      const interaction = await suggestInteractionForSourcePost(publicPost);
      if (interaction) {
        interactions.push(interaction);
      }
    }
  }

  await audit("discovery.run", "Workspace", workspace.id, {
    createdTrends: trends.length,
    liveSourcePosts: sourcePosts.length,
    interactionSuggestions: interactions.length
  });
  return { trends, sourcePosts, interactions };
}

export async function approveInteractionInPrisma(interactionId: string) {
  const interaction = await prisma.interactionSuggestion.findUnique({
    where: { id: interactionId },
    include: { sourcePost: true, xAccount: true }
  });
  if (!interaction) {
    throw new Error("Interaction suggestion not found.");
  }

  const publicInteractionItem = publicInteraction(interaction);
  const publicSource = publicSourcePost(interaction.sourcePost);
  const publicAccount = publicXAccount(interaction.xAccount);
  const apiEligibility = canApproveInteractionForApi({
    interaction: publicInteractionItem,
    sourcePost: publicSource,
    account: publicAccount
  });
  if (!apiEligibility.ok) {
    const blocked = await prisma.interactionSuggestion.update({
      where: { id: interaction.id },
      data: { status: "BLOCKED" }
    });
    await audit("interaction.reviewed", "InteractionSuggestion", interaction.id, {
      status: "BLOCKED",
      reason: apiEligibility.reason
    });
    return { interaction: publicInteraction(blocked), apiEligible: false, reason: apiEligibility.reason };
  }

  const accessToken = await freshAccountToken(interaction.xAccount);
  if (interaction.type === "REPOST") {
    await createRepost({ accessToken, xUserId: interaction.xAccount.xUserId, postId: interaction.sourcePost.xPostId });
  } else {
    await createPost({
      accessToken,
      text: interaction.suggestedText ?? "",
      replyToPostId: interaction.type === "REPLY" ? interaction.sourcePost.xPostId : undefined,
      quotePostId: interaction.type === "QUOTE" ? interaction.sourcePost.xPostId : undefined
    });
  }

  const executed = await prisma.interactionSuggestion.update({
    where: { id: interaction.id },
    data: { status: "EXECUTED" }
  });
  await audit("interaction.executed", "InteractionSuggestion", interaction.id, { type: interaction.type });
  return { interaction: publicInteraction(executed), apiEligible: true };
}

export async function syncMetricsForPublishedPosts(postIds: string[]) {
  const posts = await prisma.scheduledPost.findMany({
    where: { xPublishedPostId: { in: postIds } },
    include: { xAccount: true }
  });
  let metrics;
  try {
    const token = posts[0]?.xAccount ? await freshAccountToken(posts[0].xAccount) : undefined;
    metrics = await lookupPosts(postIds, token);
  } catch {
    metrics = await lookupPosts(postIds);
  }
  const tweets = metrics?.data ?? [];
  for (const tweet of tweets) {
    const post = posts.find((item) => item.xPublishedPostId === tweet.id);
    if (!post) {
      continue;
    }
    await prisma.metricsSnapshot.create({
      data: {
        xAccountId: post.xAccountId,
        xPostId: tweet.id,
        likeCount: tweet.public_metrics?.like_count ?? 0,
        repostCount: tweet.public_metrics?.retweet_count ?? 0,
        replyCount: tweet.public_metrics?.reply_count ?? 0,
        quoteCount: tweet.public_metrics?.quote_count ?? 0
      }
    });
  }
  return metrics;
}

export async function syncAllPublishedPostMetricsInPrisma() {
  const { workspace } = await ensureWorkspace();
  const posts = await prisma.scheduledPost.findMany({
    where: {
      workspaceId: workspace.id,
      status: "PUBLISHED",
      xPublishedPostId: { not: null }
    },
    select: { xPublishedPostId: true }
  });
  const postIds = posts.map((post) => post.xPublishedPostId).filter((id): id is string => Boolean(id));
  return syncMetricsForPublishedPosts(postIds);
}
