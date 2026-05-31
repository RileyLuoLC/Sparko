import crypto from "node:crypto";
import { env, isXBearerConfigured, isXOAuthConfigured } from "./env";

const X_API_BASE = "https://api.x.com";
const X_AUTH_BASE = "https://x.com/i/oauth2/authorize";

export class XRateLimitError extends Error {
  resetAt?: Date;
  remaining?: number;

  constructor(message: string, response: Response) {
    super(message);
    this.name = "XRateLimitError";
    const reset = response.headers.get("x-rate-limit-reset");
    const remaining = response.headers.get("x-rate-limit-remaining");
    this.resetAt = reset ? new Date(Number(reset) * 1000) : undefined;
    this.remaining = remaining ? Number(remaining) : undefined;
  }
}

export interface OAuthStart {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
}

export type OAuthPurpose = "personalized_trends" | "publishing";

export interface XOAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

const OAUTH_SCOPES: Record<OAuthPurpose, string[]> = {
  personalized_trends: ["tweet.read", "users.read", "offline.access"],
  publishing: ["tweet.read", "tweet.write", "users.read", "offline.access"]
};

function base64Url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function createPkcePair() {
  const codeVerifier = base64Url(crypto.randomBytes(32));
  const codeChallenge = base64Url(crypto.createHash("sha256").update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

export function createOAuthStart(purpose: OAuthPurpose = "personalized_trends", options?: { forceLogin?: boolean }): OAuthStart {
  if (!isXOAuthConfigured()) {
    const state = base64Url(crypto.randomBytes(16));
    return {
      state,
      codeVerifier: "demo-code-verifier",
      authorizationUrl: `${env.appUrl}/?oauth=demo&state=${state}`
    };
  }

  const state = base64Url(crypto.randomBytes(16));
  const { codeVerifier, codeChallenge } = createPkcePair();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.xClientId!,
    redirect_uri: env.xRedirectUri,
    scope: OAUTH_SCOPES[purpose].join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  });
  if (options?.forceLogin) {
    params.set("force_login", "true");
  }

  return {
    state,
    codeVerifier,
    authorizationUrl: `${X_AUTH_BASE}?${params.toString()}`
  };
}

function oauthTokenHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded"
  };

  if (env.xClientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${env.xClientId}:${env.xClientSecret}`).toString("base64")}`;
  }

  return headers;
}

function withClientCredentials(params: URLSearchParams) {
  if (!env.xClientSecret && env.xClientId) {
    params.set("client_id", env.xClientId);
  }
  return params;
}

export async function exchangeOAuthCode(args: { code: string; codeVerifier: string }): Promise<XOAuthTokenResponse> {
  if (!isXOAuthConfigured()) {
    return {
      access_token: "demo-access-token",
      refresh_token: "demo-refresh-token",
      expires_in: 7200,
      token_type: "bearer",
      scope: "tweet.read tweet.write users.read"
    };
  }

  const response = await fetch(`${X_API_BASE}/2/oauth2/token`, {
    method: "POST",
    headers: oauthTokenHeaders(),
    body: withClientCredentials(
      new URLSearchParams({
        code: args.code,
        grant_type: "authorization_code",
        redirect_uri: env.xRedirectUri,
        code_verifier: args.codeVerifier
      })
    )
  });

  if (!response.ok) {
    throw new Error(`X OAuth exchange failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

export async function refreshOAuthAccessToken(refreshToken: string): Promise<XOAuthTokenResponse> {
  if (!isXOAuthConfigured()) {
    return {
      access_token: "demo-access-token",
      refresh_token: "demo-refresh-token",
      expires_in: 7200,
      token_type: "bearer",
      scope: "tweet.read users.read offline.access"
    };
  }

  const response = await fetch(`${X_API_BASE}/2/oauth2/token`, {
    method: "POST",
    headers: oauthTokenHeaders(),
    body: withClientCredentials(
      new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    )
  });

  if (!response.ok) {
    throw new Error(`X OAuth refresh failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function xFetch(path: string, init: RequestInit = {}, token = env.xBearerToken) {
  if (!token) {
    throw new Error("X API token is not configured.");
  }

  let response: Response;
  try {
    response = await fetch(`${X_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      }
    });
  } catch (error) {
    const cause =
      error instanceof Error && "cause" in error && error.cause instanceof Error
        ? `: ${error.cause.message}`
        : "";
    throw new Error(`X API network request failed${cause}`);
  }

  if (response.status === 429) {
    throw new XRateLimitError("X API rate limit reached.", response);
  }

  if (!response.ok) {
    throw new Error(`X API request failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

export async function getTrendsByWoeid(woeid: number, maxTrends = 20) {
  if (!isXBearerConfigured()) {
    return {
      data: [
        { trend_name: "AI agents", tweet_count: 184000 },
        { trend_name: "developer productivity", tweet_count: 82000 },
        { trend_name: "AI governance", tweet_count: 41000 }
      ]
    };
  }

  return xFetch(`/2/trends/by/woeid/${woeid}?max_trends=${maxTrends}&trend.fields=trend_name,tweet_count`);
}

export async function getPersonalizedTrends(accessToken = env.xUserAccessToken) {
  if (!accessToken) {
    return {
      data: [
        { trend_name: "AI operators", post_count: 125000, category: "Technology" },
        { trend_name: "founder-led content", post_count: 85000, category: "Business" },
        { trend_name: "product launch notes", post_count: 62000, category: "Product" }
      ]
    };
  }

  return xFetch(
    "/2/users/personalized_trends?personalized_trend.fields=trend_name,post_count,category,trending_since",
    {},
    accessToken
  );
}

export async function countRecentPosts(query: string) {
  if (!isXBearerConfigured()) {
    return {
      data: [],
      meta: {
        total_tweet_count: 20000 + Math.round(Math.random() * 120000)
      }
    };
  }

  const params = new URLSearchParams({
    query,
    granularity: "day",
    "search_count.fields": "start,end,tweet_count"
  });
  return xFetch(`/2/tweets/counts/recent?${params.toString()}`);
}

export async function searchRecentPosts(
  query: string,
  maxResults = 25,
  options: { sortOrder?: "recency" | "relevancy"; token?: string } = {}
) {
  const token = options.token ?? env.xBearerToken;
  if (!token) {
    return {
      data: [],
      includes: { users: [] },
      meta: { result_count: 0 }
    };
  }

  const params = new URLSearchParams({
    query,
    max_results: String(maxResults),
    "tweet.fields": "created_at,public_metrics,author_id,conversation_id,referenced_tweets",
    expansions: "author_id",
    "user.fields": "username,name,verified"
  });
  if (options.sortOrder) {
    params.set("sort_order", options.sortOrder);
  }
  return xFetch(`/2/tweets/search/recent?${params.toString()}`, {}, token);
}

export async function createPost(args: {
  accessToken: string;
  text: string;
  replyToPostId?: string;
  quotePostId?: string;
}) {
  const body: Record<string, unknown> = {
    text: args.text
  };

  if (args.replyToPostId) {
    body.reply = { in_reply_to_tweet_id: args.replyToPostId };
  }

  if (args.quotePostId) {
    body.quote_tweet_id = args.quotePostId;
  }

  return xFetch(
    "/2/tweets",
    {
      method: "POST",
      body: JSON.stringify(body)
    },
    args.accessToken
  );
}

export async function createRepost(args: { accessToken: string; xUserId: string; postId: string }) {
  return xFetch(
    `/2/users/${args.xUserId}/retweets`,
    {
      method: "POST",
      body: JSON.stringify({ tweet_id: args.postId })
    },
    args.accessToken
  );
}

export async function getAuthenticatedUser(accessToken: string) {
  return xFetch("/2/users/me?user.fields=username,name,profile_image_url,verified", {}, accessToken);
}

export async function lookupPosts(ids: string[], token = env.xBearerToken) {
  if (!token || ids.length === 0) {
    return { data: [] };
  }

  const params = new URLSearchParams({
    ids: ids.join(","),
    "tweet.fields": "created_at,public_metrics,author_id,conversation_id,referenced_tweets",
    expansions: "author_id",
    "user.fields": "username,name,verified"
  });
  return xFetch(`/2/tweets?${params.toString()}`, {}, token);
}
