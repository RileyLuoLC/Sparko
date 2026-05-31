export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  appTimezone: process.env.APP_TIMEZONE ?? "Asia/Shanghai",
  targetMarketTimezone: process.env.TARGET_MARKET_TIMEZONE ?? "America/New_York",
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  xClientId: process.env.X_CLIENT_ID,
  xClientSecret: process.env.X_CLIENT_SECRET,
  xRedirectUri: process.env.X_REDIRECT_URI ?? "http://localhost:3000/api/x/oauth/callback",
  xBearerToken: process.env.X_BEARER_TOKEN,
  xUserAccessToken: process.env.X_USER_ACCESS_TOKEN,
  draftAiProvider: (process.env.DRAFT_AI_PROVIDER ?? "openai").toLowerCase(),
  replyAiProvider: process.env.REPLY_AI_PROVIDER?.toLowerCase(),
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiDraftModel: process.env.OPENAI_DRAFT_MODEL ?? "gpt-5-mini",
  openaiReplyModel: process.env.OPENAI_REPLY_MODEL ?? process.env.OPENAI_DRAFT_MODEL ?? "gpt-5-mini",
  openaiStrategyModel: process.env.OPENAI_STRATEGY_MODEL ?? "gpt-5.1",
  xaiApiKey: process.env.XAI_API_KEY,
  xaiBaseUrl: process.env.XAI_BASE_URL ?? "https://api.x.ai/v1",
  xaiDraftModel: process.env.XAI_DRAFT_MODEL ?? "grok-4.3",
  xaiReplyModel: process.env.XAI_REPLY_MODEL ?? process.env.XAI_DRAFT_MODEL ?? "grok-4.3",
  xaiStrategyModel: process.env.XAI_STRATEGY_MODEL ?? process.env.XAI_DRAFT_MODEL ?? "grok-4.3",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
  anthropicDraftModel: process.env.ANTHROPIC_DRAFT_MODEL ?? "claude-sonnet-4-20250514",
  anthropicReplyModel: process.env.ANTHROPIC_REPLY_MODEL ?? process.env.ANTHROPIC_DRAFT_MODEL ?? "claude-sonnet-4-20250514",
  anthropicStrategyModel:
    process.env.ANTHROPIC_STRATEGY_MODEL ?? process.env.ANTHROPIC_DRAFT_MODEL ?? "claude-sonnet-4-20250514"
};

export function isOpenAIConfigured() {
  return Boolean(env.openaiApiKey);
}

export function isDraftAiConfigured() {
  if (env.draftAiProvider === "xai" || env.draftAiProvider === "grok") {
    return Boolean(env.xaiApiKey);
  }

  if (env.draftAiProvider === "claude" || env.draftAiProvider === "anthropic") {
    return Boolean(env.anthropicApiKey);
  }

  return isOpenAIConfigured();
}

export function isXOAuthConfigured() {
  return Boolean(env.xClientId && env.xRedirectUri);
}

export function isXBearerConfigured() {
  return Boolean(env.xBearerToken);
}

export function isXUserAccessConfigured() {
  return Boolean(env.xUserAccessToken);
}
