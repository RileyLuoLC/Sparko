import type {
  DraftPost,
  InteractionSuggestion,
  RiskLevel,
  ScheduledPost,
  SourcePost,
  Workspace,
  XAccount
} from "./types";

export const X_POST_MAX_CHARS = 280;

const RISK_TERMS = [
  "guaranteed",
  "risk-free",
  "get rich",
  "financial advice",
  "medical advice",
  "political",
  "hate",
  "harass",
  "spam",
  "dm me"
];

export function normalizePostText(input: string): string {
  return input
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[#@]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function buildDuplicateGroupKey(text: string): string {
  return normalizePostText(text).slice(0, 180);
}

export function normalizePostWhitespace(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function truncateForX(input: string, maxChars = X_POST_MAX_CHARS): string {
  const cleaned = normalizePostWhitespace(input);
  if (cleaned.length <= maxChars) {
    return cleaned;
  }

  const suffix = "...";
  return `${cleaned.slice(0, maxChars - suffix.length).trimEnd()}${suffix}`;
}

export function formatDraftText(input: string, maxChars = X_POST_MAX_CHARS): string {
  const cleaned = normalizePostWhitespace(input).replace(/[—–]/g, "-");
  if (cleaned.includes("\n\n")) {
    return truncateForX(cleaned, maxChars);
  }

  const sentenceBreak = cleaned.match(/^(.{6,150}?[.!?。！？])\s+(.+)$/s);
  if (!sentenceBreak) {
    return truncateForX(cleaned, maxChars);
  }

  return truncateForX(`${sentenceBreak[1]}\n\n${sentenceBreak[2]}`, maxChars);
}

export function extractHashtags(text: string): string[] {
  const tags = text.match(/#[A-Za-z0-9_]+/g) ?? [];
  return [...new Set(tags.map((tag) => tag.slice(0, 32)))].slice(0, 4);
}

export function assessRisk(text: string): { riskLevel: RiskLevel; riskReasons: string[] } {
  const normalized = text.toLowerCase();
  const matches = RISK_TERMS.filter((term) => normalized.includes(term));
  const riskReasons: string[] = [];

  if (matches.length > 0) {
    matches.forEach((term) => {
      riskReasons.push(`Contains sensitive claim or outreach language: ${term}`);
    });
  }

  if ((text.match(/@/g) ?? []).length > 1) {
    riskReasons.push("Contains multiple mentions, which can look like unsolicited outreach.");
  }

  if (text.length > X_POST_MAX_CHARS) {
    riskReasons.push("Exceeds X default 280 character limit.");
  }

  if (riskReasons.length >= 2) {
    return { riskLevel: "HIGH", riskReasons };
  }

  if (riskReasons.length === 1) {
    return { riskLevel: "MEDIUM", riskReasons };
  }

  return { riskLevel: "LOW", riskReasons: [] };
}

export function buildPersonaPrompt(persona: {
  name: string;
  roleLabel: string;
  voice: string;
  audience: string;
  contentPillars?: string[];
  guardrails: string;
  avoidTopics?: string[];
  defaultHashtags: string[];
}, accountKind?: XAccount["kind"]): string {
  return [
    `Persona: ${persona.name} (${persona.roleLabel})`,
    `Voice: ${persona.voice}`,
    `Audience: ${persona.audience}`,
    `Content pillars: ${persona.contentPillars?.join(", ") || "none"}`,
    `Guardrails: ${persona.guardrails}`,
    `Avoid topics: ${persona.avoidTopics?.join(", ") || "none"}`,
    accountKind === "PERSONAL"
      ? "This is a personal/founder account: write like a real person with observations, lessons, opinions, doubts, and lived context. Do not default to selling the product, naming the company, or turning every point into a product pitch unless the brief explicitly asks for that."
      : accountKind === "COMPANY"
        ? "This is a company account: product and workflow angles are acceptable, but still keep posts useful, specific, and non-salesy."
        : "Keep the post useful and human; do not default to a product pitch unless the brief explicitly asks for one.",
    "Do not add hashtags unless the user's post brief explicitly asks for hashtags.",
    "A post may be one sentence or multiple short paragraphs.",
    "If it is one sentence, make it a strong standalone statement or a provocative question.",
    "If the user's brief is a question, express or sharpen that question in the post; do not answer it unless the user explicitly asks for an answer.",
    "If it has more than one sentence or line, put a blank line immediately after the first-sentence hook.",
    "Use blank lines between short paragraphs for readability.",
    "Make the writing sharp and natural: clear point of view, plain language, no corporate filler.",
    "Use technical or business terms when they carry the idea precisely, but do not use them as filler or to make a weak point sound important.",
    "Do not use em dashes or en dashes. If a dash is needed, use a normal hyphen: -",
    "Write concise English X posts. Avoid unsolicited mentions, fake urgency, engagement bait, and unverifiable claims.",
    `Keep each post at or below ${X_POST_MAX_CHARS} characters.`
  ].join("\n");
}

export function validateScheduleRequest(args: {
  workspace: Workspace;
  scheduledPosts: ScheduledPost[];
  draft?: DraftPost;
  xAccountId: string;
  text: string;
  scheduledFor: Date;
  now?: Date;
}): { ok: true; duplicateGroupKey: string } | { ok: false; reason: string } {
  const now = args.now ?? new Date();
  const duplicateGroupKey = buildDuplicateGroupKey(args.text);

  if (args.text.trim().length === 0) {
    return { ok: false, reason: "Post text is required." };
  }

  if (args.text.length > X_POST_MAX_CHARS) {
    return { ok: false, reason: `Post text must be ${X_POST_MAX_CHARS} characters or fewer.` };
  }

  if (args.draft && args.draft.status !== "APPROVED") {
    return { ok: false, reason: "Draft must be approved before scheduling." };
  }

  if (args.scheduledFor <= now) {
    return { ok: false, reason: "Scheduled time must be in the future." };
  }

  const duplicateWindowMs = args.workspace.duplicateWindowHours * 60 * 60 * 1000;
  const minIntervalMs = args.workspace.minPostIntervalMinutes * 60 * 1000;

  for (const post of args.scheduledPosts) {
    if (post.status === "CANCELED" || post.status === "FAILED") {
      continue;
    }

    const existingTime = new Date(post.scheduledFor).getTime();
    const requestedTime = args.scheduledFor.getTime();

    if (
      post.duplicateGroupKey === duplicateGroupKey &&
      Math.abs(existingTime - requestedTime) <= duplicateWindowMs
    ) {
      return { ok: false, reason: "Duplicate or near-duplicate content is already scheduled in the safety window." };
    }

    if (
      post.xAccountId === args.xAccountId &&
      Math.abs(existingTime - requestedTime) < minIntervalMs
    ) {
      return {
        ok: false,
        reason: `Posts on the same account must be at least ${formatInterval(args.workspace.minPostIntervalMinutes)} apart.`
      };
    }
  }

  return { ok: true, duplicateGroupKey };
}

function formatInterval(minutes: number) {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function validateDraftEditRequest(args: {
  draft: Pick<DraftPost, "status">;
  text: string;
}): { ok: true; text: string; riskLevel: RiskLevel; riskReasons: string[] } | { ok: false; reason: string } {
  if (args.draft.status === "SCHEDULED" || args.draft.status === "PUBLISHED") {
    return { ok: false, reason: "Scheduled or published drafts cannot be edited." };
  }

  if (args.draft.status === "REJECTED") {
    return { ok: false, reason: "Rejected drafts cannot be edited. Generate or import a new candidate." };
  }

  const text = normalizePostWhitespace(args.text);
  if (!text) {
    return { ok: false, reason: "Draft text is required." };
  }

  if (text.length > X_POST_MAX_CHARS) {
    return { ok: false, reason: `Draft text must be ${X_POST_MAX_CHARS} characters or fewer.` };
  }

  return {
    ok: true,
    text,
    ...assessRisk(text)
  };
}

export function sourcePostSummonedAccount(sourcePost: SourcePost, account: XAccount): boolean {
  return sourcePost.text.toLowerCase().includes(`@${account.username.toLowerCase()}`);
}

export function canApproveInteractionForApi(args: {
  interaction: InteractionSuggestion;
  sourcePost: SourcePost;
  account: XAccount;
}): { ok: true } | { ok: false; reason: string } {
  if (args.interaction.type === "REPLY") {
    if (!args.account.repliesEnabled) {
      return { ok: false, reason: "Replies are disabled for this X account." };
    }

    const repliedToPublishedPost = args.interaction.rationale.includes("replied to a post published by");
    const recentInteractorPost = args.interaction.rationale.includes("recently interacted with");
    if (!sourcePostSummonedAccount(args.sourcePost, args.account) && !repliedToPublishedPost && !recentInteractorPost) {
      return {
        ok: false,
        reason: "X self-serve reply automation requires the source post to explicitly mention or summon the replying account."
      };
    }
  }

  if (args.interaction.type === "QUOTE" && !args.account.quotePostsEnabled) {
    return { ok: false, reason: "Quote posts are not enabled for this X account/API plan." };
  }

  if (args.interaction.riskLevel === "HIGH") {
    return { ok: false, reason: "High-risk interaction suggestions require manual native review." };
  }

  return { ok: true };
}
