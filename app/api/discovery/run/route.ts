import { cookies } from "next/headers";
import { z } from "zod";
import { runDiscovery } from "@/lib/demo-store";
import { env, isXBearerConfigured, isXUserAccessConfigured } from "@/lib/env";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { isPrismaStoreConfigured, recordDiscoveryInPrisma } from "@/lib/prisma-store";
import {
  getPersonalizedTrends,
  getTrendsByWoeid,
  refreshOAuthAccessToken,
  searchRecentPosts
} from "@/lib/x-api";

const DiscoverySchema = z.object({
  source: z.enum(["TOPIC", "LOCATION", "PERSONALIZED"]).optional(),
  keywords: z.array(z.string().min(1)).max(8).optional(),
  woeid: z.number().int().positive().optional()
});

type LiveTweet = {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    quote_count?: number;
  };
};

type LiveUser = {
  id: string;
  username?: string;
  name?: string;
};

function quoteTerm(value: string) {
  const trimmed = value.replace(/["()]/g, " ").replace(/\s+/g, " ").trim();
  return trimmed.includes(" ") ? `"${trimmed}"` : trimmed;
}

function domainSubject(area: string) {
  const normalized = area.toLowerCase();
  if (normalized.includes("ai product")) {
    return '(AI OR "artificial intelligence") (product OR app OR tool OR startup)';
  }
  if (normalized.includes("startup")) {
    return "(startup OR startups OR founder)";
  }
  if (normalized.includes("ai")) {
    return `(AI OR "artificial intelligence" OR ${quoteTerm(area)})`;
  }
  return quoteTerm(area);
}

function domainDiscoveryQuery(area: string) {
  const eventTerms = [
    "launch",
    "launched",
    "launches",
    "announced",
    "announces",
    "released",
    "releases",
    "unveiled",
    "funding",
    "raises",
    "raised",
    "acquired",
    "acquisition",
    "partnership",
    '"new product"'
  ].join(" OR ");
  return `${domainSubject(area)} (${eventTerms}) lang:en -is:retweet -is:reply`;
}

function postSignalScore(tweet: LiveTweet) {
  const metrics = tweet.public_metrics;
  return (
    (metrics?.like_count ?? 0) +
    (metrics?.retweet_count ?? 0) * 2 +
    (metrics?.reply_count ?? 0) +
    (metrics?.quote_count ?? 0) * 3
  );
}

function eventTitleFromPost(text: string, area: string) {
  const cleaned = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned;
  const compact = sentence.length > 92 ? `${sentence.slice(0, 89).trim()}...` : sentence;
  return compact || `New ${area} signal`;
}

async function getUserAccessTokenFromCookies() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("x_access_token")?.value ?? env.xUserAccessToken;
  if (accessToken) {
    return accessToken;
  }

  const refreshToken = cookieStore.get("x_refresh_token")?.value;
  if (!refreshToken) {
    return undefined;
  }

  const refreshed = await refreshOAuthAccessToken(refreshToken);
  const secure = env.appUrl.startsWith("https://");
  const accessMaxAge = Math.max(60, (refreshed.expires_in ?? 7200) - 60);
  cookieStore.set("x_access_token", refreshed.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: accessMaxAge,
    path: "/"
  });
  cookieStore.set("x_token_expires_at", new Date(Date.now() + (refreshed.expires_in ?? 7200) * 1000).toISOString(), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: accessMaxAge,
    path: "/"
  });
  if (refreshed.refresh_token) {
    cookieStore.set("x_refresh_token", refreshed.refresh_token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: 60 * 60 * 24 * 30,
      path: "/"
    });
  }
  return refreshed.access_token;
}

export async function POST(request: Request) {
  try {
    const body = DiscoverySchema.parse(await readJson(request));
    const source = body.source ?? "TOPIC";
    const cookieStore = await cookies();
    const hasCookieToken = Boolean(cookieStore.get("x_access_token")?.value ?? cookieStore.get("x_refresh_token")?.value);
    const requestedKeywords = body.keywords?.filter(Boolean);
    const defaultKeywords = requestedKeywords?.length
      ? requestedKeywords
      : ["AI product"];
    let liveError: string | undefined;
    let liveTrends: { data?: Array<{ trend_name?: string; tweet_count?: number; post_count?: number }> } | undefined;
    let configured = source === "PERSONALIZED" ? isXUserAccessConfigured() || hasCookieToken : isXBearerConfigured();
    const trendInputs: Array<{ trendName: string; tweetCount?: number }> = [];
    const sourcePostInputs: Array<{
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
    }> = [];

    if (source === "TOPIC") {
      for (const area of defaultKeywords.slice(0, 3)) {
        const searchResult = await searchRecentPosts(domainDiscoveryQuery(area), 20, { sortOrder: "relevancy" }).catch(
          (error) => {
            liveError ??= error instanceof Error ? error.message : "X domain discovery search failed.";
            return undefined;
          }
        );

        const usersById = new Map(
          ((searchResult?.includes?.users ?? []) as LiveUser[]).map((user) => [user.id, user])
        );
        const tweets = ((searchResult?.data ?? []) as LiveTweet[])
          .slice()
          .sort((a, b) => postSignalScore(b) - postSignalScore(a))
          .slice(0, 3);

        if (!configured && tweets.length === 0) {
          trendInputs.push({
            trendName: `${area}: new launches, funding, and market moves`,
            tweetCount: undefined
          });
        }

        tweets.forEach((tweet) => {
          const trendName = eventTitleFromPost(tweet.text, area);
          const score = postSignalScore(tweet);
          trendInputs.push({
            trendName,
            tweetCount: score > 0 ? score : undefined
          });
          const author = tweet.author_id ? usersById.get(tweet.author_id) : undefined;
          const username = author?.username ?? "x";
          sourcePostInputs.push({
            trendName,
            xPostId: tweet.id,
            authorUsername: username,
            authorDisplayName: author?.name,
            text: tweet.text,
            url: `https://x.com/${username}/status/${tweet.id}`,
            likeCount: tweet.public_metrics?.like_count,
            repostCount: tweet.public_metrics?.retweet_count,
            replyCount: tweet.public_metrics?.reply_count,
            quoteCount: tweet.public_metrics?.quote_count,
            postedAt: tweet.created_at
          });
        });
      }

      if (!configured && trendInputs.length === 0) {
        defaultKeywords.slice(0, 3).forEach((area) => {
          trendInputs.push({
            trendName: `${area}: new launches, funding, and market moves`
          });
        });
      }
    } else if (source === "PERSONALIZED") {
      const accessToken = await getUserAccessTokenFromCookies().catch((error) => {
        liveError = error instanceof Error ? error.message : "X OAuth refresh failed.";
        return undefined;
      });
      configured = Boolean(accessToken);
      if (accessToken) {
        liveTrends = await getPersonalizedTrends(accessToken).catch((error) => {
          liveError = error instanceof Error ? error.message : "X personalized trends failed.";
          return undefined;
        });
      }
    } else {
      liveTrends = await getTrendsByWoeid(body.woeid ?? 1, 10).catch((error) => {
        liveError = error instanceof Error ? error.message : "X location trends failed.";
        return undefined;
      });
    }

    if (configured && liveError && trendInputs.length === 0 && !liveTrends) {
      return jsonOk({
        trends: [],
        sourcePosts: [],
        source,
        live: false,
        needsAuth: false,
        liveError,
        demoFallback: false
      });
    }

    if (source === "PERSONALIZED" && !configured) {
      return jsonOk({
        trends: [],
        sourcePosts: [],
        source,
        live: false,
        needsAuth: true,
        demoFallback: false
      });
    }

    const liveTrendKeywords = liveTrends?.data
      ?.map((trend: { trend_name?: string }) => trend.trend_name)
      .filter((trendName): trendName is string => Boolean(trendName))
      .slice(0, 4);
    const keywords =
      source === "TOPIC" ? defaultKeywords : liveTrendKeywords?.length ? liveTrendKeywords : requestedKeywords;
    const discoveryInput = {
      ...body,
      keywords,
      trendInputs,
      sourcePostInputs,
      origin: configured ? ("LIVE" as const) : ("DEMO" as const)
    };
    const result = isPrismaStoreConfigured()
      ? await recordDiscoveryInPrisma(discoveryInput)
      : runDiscovery(discoveryInput);
    return jsonOk({
      ...result,
      source,
      live: source === "TOPIC" ? Boolean(configured && !liveError) : Boolean(liveTrends && configured && !liveError),
      needsAuth: source === "PERSONALIZED" && !configured,
      liveError,
      demoFallback: !configured
    });
  } catch (error) {
    return jsonError(error);
  }
}
