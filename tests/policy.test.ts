import { describe, expect, it } from "vitest";
import {
  assessRisk,
  buildDuplicateGroupKey,
  buildPersonaPrompt,
  canApproveInteractionForApi,
  formatDraftText,
  truncateForX,
  validateDraftEditRequest,
  validateScheduleRequest
} from "../src/lib/policy";
import type {
  DraftPost,
  InteractionSuggestion,
  ScheduledPost,
  SourcePost,
  Workspace,
  XAccount
} from "../src/lib/types";

const workspace: Workspace = {
  id: "workspace",
  name: "Workspace",
  defaultLanguage: "en",
  defaultWoeid: 1,
  appTimezone: "Asia/Shanghai",
  targetMarketTimezone: "America/New_York",
  duplicateWindowHours: 168,
  minPostIntervalMinutes: 240
};

const now = new Date("2026-05-22T00:00:00.000Z");

const approvedDraft: DraftPost = {
  id: "draft",
  workspaceId: "workspace",
  personaId: "persona",
  xAccountId: "account",
  text: "Approved post",
  rationale: "test",
  hashtags: [],
  status: "APPROVED",
  riskLevel: "LOW",
  riskReasons: [],
  aiModel: "test",
  createdAt: now.toISOString(),
  updatedAt: now.toISOString()
};

function scheduled(overrides: Partial<ScheduledPost>): ScheduledPost {
  return {
    id: "scheduled",
    workspaceId: "workspace",
    xAccountId: "account",
    finalText: "Existing post",
    scheduledFor: new Date("2026-05-22T08:00:00.000Z").toISOString(),
    status: "QUEUED",
    duplicateGroupKey: buildDuplicateGroupKey("Existing post"),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides
  };
}

describe("X content policy", () => {
  it("truncates posts to the default X character limit", () => {
    const text = truncateForX("a".repeat(400));
    expect(text).toHaveLength(280);
    expect(text.endsWith("...")).toBe(true);
  });

  it("preserves paragraph breaks when truncating posts", () => {
    expect(truncateForX("Hook.\n\nSecond line.")).toBe("Hook.\n\nSecond line.");
  });

  it("adds a blank line after the hook for multi-sentence drafts", () => {
    expect(formatDraftText("Strong hook. Second sentence with the point.")).toBe(
      "Strong hook.\n\nSecond sentence with the point."
    );
  });

  it("keeps one-sentence drafts as one sentence", () => {
    expect(formatDraftText("The best hiring signal is judgment under pressure.")).toBe(
      "The best hiring signal is judgment under pressure."
    );
  });

  it("flags risky claims and outreach language", () => {
    const risk = assessRisk("This is guaranteed risk-free financial advice. DM me now.");
    expect(risk.riskLevel).toBe("HIGH");
    expect(risk.riskReasons.length).toBeGreaterThan(1);
  });

  it("keeps persona prompt inside the company voice and guardrails", () => {
    const prompt = buildPersonaPrompt({
      name: "Founder Voice",
      roleLabel: "Founder",
      voice: "clear and practical",
      audience: "builders",
      guardrails: "No hype.",
      defaultHashtags: ["#AI"]
    });
    expect(prompt).toContain("Founder Voice");
    expect(prompt).toContain("No hype.");
    expect(prompt).toContain("280");
  });

  it("does not instruct draft generation to add default hashtags", () => {
    const prompt = buildPersonaPrompt({
      name: "Product Voice",
      roleLabel: "Product",
      voice: "specific",
      audience: "operators",
      guardrails: "No hype.",
      defaultHashtags: ["#AI", "#Product"]
    });

    expect(prompt).toContain("Do not add hashtags");
    expect(prompt).not.toContain("#AI");
    expect(prompt).not.toContain("#Product");
  });

  it("allows single-sentence drafts and keeps readable spacing for longer ones", () => {
    const prompt = buildPersonaPrompt({
      name: "Founder Voice",
      roleLabel: "Founder",
      voice: "sharp",
      audience: "operators",
      guardrails: "No hype.",
      defaultHashtags: []
    });

    expect(prompt).toContain("A post may be one sentence");
    expect(prompt).toContain("strong standalone statement or a provocative question");
    expect(prompt).toContain("If the user's brief is a question");
    expect(prompt).toContain("blank line immediately after the first-sentence hook");
  });

  it("pushes generation toward sharp natural language instead of SaaS copy", () => {
    const prompt = buildPersonaPrompt({
      name: "Product Voice",
      roleLabel: "Product",
      voice: "sharp and natural",
      audience: "operators",
      guardrails: "No hype.",
      defaultHashtags: []
    });

    expect(prompt).toContain("sharp and natural");
    expect(prompt).toContain("plain language");
    expect(prompt).toContain("no corporate filler");
    expect(prompt).toContain("Use technical or business terms when they carry the idea precisely");
    expect(prompt).toContain("do not use them as filler");
  });

  it("tells personal accounts not to default to product promotion", () => {
    const prompt = buildPersonaPrompt(
      {
        name: "Founder Voice",
        roleLabel: "Founder",
        voice: "human",
        audience: "builders",
        guardrails: "No hype.",
        defaultHashtags: []
      },
      "PERSONAL"
    );

    expect(prompt).toContain("personal/founder account");
    expect(prompt).toContain("Do not default to selling the product");
  });
});

describe("scheduling policy", () => {
  it("rejects scheduling drafts that have not been approved", () => {
    const result = validateScheduleRequest({
      workspace,
      scheduledPosts: [],
      draft: { ...approvedDraft, status: "NEEDS_REVIEW" },
      xAccountId: "account",
      text: "A post",
      scheduledFor: new Date("2026-05-22T09:00:00.000Z"),
      now
    });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: "Draft must be approved before scheduling." });
  });

  it("blocks duplicate content across accounts inside the safety window", () => {
    const result = validateScheduleRequest({
      workspace,
      scheduledPosts: [scheduled({ xAccountId: "other", duplicateGroupKey: buildDuplicateGroupKey("Same idea") })],
      draft: approvedDraft,
      xAccountId: "account",
      text: "Same idea",
      scheduledFor: new Date("2026-05-22T12:00:00.000Z"),
      now
    });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      reason: "Duplicate or near-duplicate content is already scheduled in the safety window."
    });
  });

  it("allows same-account posts close together when the content is different", () => {
    const result = validateScheduleRequest({
      workspace,
      scheduledPosts: [scheduled({ xAccountId: "account" })],
      draft: approvedDraft,
      xAccountId: "account",
      text: "A different post",
      scheduledFor: new Date("2026-05-22T10:00:00.000Z"),
      now
    });
    expect(result.ok).toBe(true);
  });
});

describe("draft edit policy", () => {
  it("normalizes reviewer edits and reassesses risk", () => {
    const result = validateDraftEditRequest({
      draft: { ...approvedDraft, status: "CANDIDATE" },
      text: "  This   is a cleaner reviewer edit.  "
    });

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({
      text: "This is a cleaner reviewer edit.",
      riskLevel: "LOW",
      riskReasons: []
    });
  });

  it("blocks edits after a draft has been scheduled", () => {
    const result = validateDraftEditRequest({
      draft: { ...approvedDraft, status: "SCHEDULED" },
      text: "A late rewrite."
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: "Scheduled or published drafts cannot be edited." });
  });
});

describe("interaction policy", () => {
  const account: XAccount = {
    id: "account",
    workspaceId: "workspace",
    xUserId: "123",
    username: "demo_company",
    displayName: "Demo Company",
    kind: "COMPANY",
    status: "CONNECTED",
    quotePostsEnabled: false,
    repliesEnabled: true
  };

  const sourcePost: SourcePost = {
    id: "source",
    workspaceId: "workspace",
    xPostId: "tweet",
    authorUsername: "operator",
    text: "Internal AI tools need approvals and logs.",
    url: "https://x.com/operator/status/tweet",
    likeCount: 1,
    repostCount: 1,
    replyCount: 1,
    quoteCount: 1,
    postedAt: now.toISOString(),
    capturedAt: now.toISOString()
  };

  const reply: InteractionSuggestion = {
    id: "interaction",
    workspaceId: "workspace",
    xAccountId: "account",
    sourcePostId: "source",
    type: "REPLY",
    suggestedText: "Agreed.",
    rationale: "test",
    status: "SUGGESTED",
    riskLevel: "LOW",
    riskReasons: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  it("blocks API replies when the source post did not summon the account", () => {
    const result = canApproveInteractionForApi({ interaction: reply, sourcePost, account });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      reason: "X self-serve reply automation requires the source post to explicitly mention or summon the replying account."
    });
  });

  it("allows replies when the source post explicitly mentions the account", () => {
    const result = canApproveInteractionForApi({
      interaction: reply,
      sourcePost: { ...sourcePost, text: "@demo_company approvals and logs matter." },
      account
    });
    expect(result.ok).toBe(true);
  });

  it("blocks quote posts when the account has no quote capability", () => {
    const result = canApproveInteractionForApi({
      interaction: { ...reply, type: "QUOTE" },
      sourcePost,
      account
    });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: "Quote posts are not enabled for this X account/API plan." });
  });
});
