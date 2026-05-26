import { isXBearerConfigured, isXOAuthConfigured } from "@/lib/env";
import { env } from "@/lib/env";
import { jsonOk } from "@/lib/http";
import { isPrismaStoreConfigured } from "@/lib/prisma-store";
import { prisma } from "@/lib/prisma";
import { QUEUES } from "@/lib/queue";
import type { ReadinessCheck, ReadinessData, ReadinessStatus } from "@/lib/types";
import { Queue } from "bullmq";
import IORedis from "ioredis";

export const dynamic = "force-dynamic";

function check(id: string, label: string, status: ReadinessStatus, detail: string): ReadinessCheck {
  return { id, label, status, detail };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    })
  ]);
}

export async function GET() {
  const checks: ReadinessCheck[] = [];
  let connectedAccountCount = 0;
  let queuedPublishJobs = 0;
  let delayedPublishJobs = 0;
  let failedPublishJobs = 0;
  let workerCount = 0;

  const databaseConfigured = isPrismaStoreConfigured();
  if (!databaseConfigured) {
    checks.push(check("database", "Postgres", "BLOCKED", "DATABASE_URL is missing; the app is using demo memory mode."));
  } else {
    try {
      await withTimeout(prisma.$queryRaw`SELECT 1`, 900, "Postgres check");
      connectedAccountCount = await withTimeout(
        prisma.xAccount.count({ where: { status: "CONNECTED", accessToken: { not: null } } }),
        900,
        "Connected account check"
      );
      checks.push(check("database", "Postgres", "READY", "Database is reachable and real mode is enabled."));
      checks.push(
        check(
          "x-account",
          "Connected X account",
          connectedAccountCount > 0 ? "READY" : "WARN",
            connectedAccountCount > 0
            ? `${connectedAccountCount} OAuth-connected account${connectedAccountCount === 1 ? "" : "s"} in the database.`
            : "No OAuth-connected X account is stored yet. Use Connect X before publishing."
        )
      );
    } catch (error) {
      checks.push(
        check(
          "database",
          "Postgres",
          "BLOCKED",
          error instanceof Error ? `DATABASE_URL is set, but the database check failed: ${error.message}` : "Database check failed."
        )
      );
    }
  }

  const oauthConfigured = isXOAuthConfigured();
  checks.push(
    check(
      "x-oauth",
      "X OAuth",
      oauthConfigured ? "READY" : "BLOCKED",
      oauthConfigured
        ? "X_CLIENT_ID and X_REDIRECT_URI are configured."
        : "Add X_CLIENT_ID and X_REDIRECT_URI to connect accounts."
    )
  );

  const bearerConfigured = isXBearerConfigured();
  checks.push(
    check(
      "x-bearer",
      "X Bearer token",
      bearerConfigured ? "READY" : "WARN",
      bearerConfigured
        ? "X_BEARER_TOKEN is configured for live discovery/search."
        : "X_BEARER_TOKEN is missing; live topic discovery will fall back or return no live signals."
    )
  );

  if (!env.redisUrl) {
    checks.push(check("redis", "Redis queue", "BLOCKED", "REDIS_URL is missing; scheduled posts will stay queued."));
    checks.push(check("worker", "Publish worker", "BLOCKED", "Start Redis and npm run worker for automatic publishing."));
  } else {
    const pingConnection = new IORedis(env.redisUrl, {
      connectTimeout: 750,
      commandTimeout: 750,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null
    });
    let queueConnection: IORedis | undefined;
    let queue: Queue | undefined;
    try {
      await withTimeout(pingConnection.connect(), 900, "Redis connect");
      await withTimeout(pingConnection.ping(), 900, "Redis ping");
      queueConnection = new IORedis(env.redisUrl, {
        connectTimeout: 750,
        commandTimeout: 750,
        lazyConnect: true,
        maxRetriesPerRequest: null,
        retryStrategy: () => null
      });
      await withTimeout(queueConnection.connect(), 900, "Publish queue connect");
      queue = new Queue(QUEUES.publish, { connection: queueConnection });
      const [counts, workers] = await Promise.all([
        withTimeout(queue.getJobCounts("waiting", "delayed", "failed"), 900, "Publish queue check"),
        withTimeout(queue.getWorkersCount(), 900, "Publish worker check")
      ]);
      queuedPublishJobs = counts.waiting ?? 0;
      delayedPublishJobs = counts.delayed ?? 0;
      failedPublishJobs = counts.failed ?? 0;
      workerCount = workers;
      checks.push(check("redis", "Redis queue", "READY", "Redis queue is reachable."));
      checks.push(
        check(
          "worker",
          "Publish worker",
          workerCount > 0 ? "READY" : "WARN",
          workerCount > 0
            ? `${workerCount} worker${workerCount === 1 ? "" : "s"} registered for scheduled publishing.`
            : "Redis is reachable, but no publish worker is registered. Run npm run worker."
        )
      );
    } catch (error) {
      checks.push(
        check(
          "redis",
          "Redis queue",
          "BLOCKED",
          error instanceof Error ? `REDIS_URL is set, but Redis check failed: ${error.message}` : "Redis check failed."
        )
      );
      checks.push(check("worker", "Publish worker", "BLOCKED", "Worker status cannot be checked until Redis is reachable."));
    } finally {
      await queue?.close().catch(() => undefined);
      queueConnection?.disconnect();
      pingConnection.disconnect();
    }
  }

  const canConnectX = oauthConfigured;
  const canDiscoverLiveSignals = bearerConfigured;
  const canPublishAutomatically =
    databaseConfigured &&
    connectedAccountCount > 0 &&
    oauthConfigured &&
    Boolean(env.redisUrl) &&
    workerCount > 0 &&
    !checks.some((item) => item.id === "database" && item.status === "BLOCKED");

  const data: ReadinessData = {
    mode: databaseConfigured ? "REAL" : "DEMO",
    canPublishAutomatically,
    canConnectX,
    canDiscoverLiveSignals,
    connectedAccountCount,
    queuedPublishJobs,
    delayedPublishJobs,
    failedPublishJobs,
    workerCount,
    checks,
    updatedAt: new Date().toISOString()
  };

  return jsonOk(data);
}
