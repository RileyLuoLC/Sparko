import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";

export const QUEUES = {
  publish: "publish-scheduled-posts",
  discovery: "discovery-runs",
  metrics: "metrics-sync"
} as const;

let connection: IORedis | undefined;

function getRedisConnection() {
  if (!env.redisUrl) {
    return undefined;
  }

  if (!connection) {
    connection = new IORedis(env.redisUrl, {
      maxRetriesPerRequest: null
    });
  }

  return connection;
}

export function getQueue(name: (typeof QUEUES)[keyof typeof QUEUES]) {
  const redis = getRedisConnection();
  if (!redis) {
    return undefined;
  }

  return new Queue(name, { connection: redis });
}

export async function enqueueScheduledPost(scheduledPostId: string, scheduledFor: string) {
  const queue = getQueue(QUEUES.publish);
  if (!queue) {
    return { queued: false, reason: "Redis is not configured; post remains in QUEUED status." };
  }

  const delay = Math.max(0, new Date(scheduledFor).getTime() - Date.now());
  const jobId = `publish-${scheduledPostId}`;
  const existingJob = await queue.getJob(jobId);
  await existingJob?.remove();
  await queue.add(
    "publish",
    { scheduledPostId },
    {
      jobId,
      delay,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 60_000
      },
      removeOnComplete: 100,
      removeOnFail: 500
    }
  );

  return { queued: true };
}

export async function enqueueMetricsSync(postIds: string[], delayMs = 0) {
  const queue = getQueue(QUEUES.metrics);
  const uniquePostIds = [...new Set(postIds)].filter(Boolean);
  if (!queue) {
    return { queued: false, reason: "Redis is not configured; metrics sync was not queued." };
  }
  if (uniquePostIds.length === 0) {
    return { queued: false, reason: "No published post ids to sync." };
  }

  await queue.add(
    "sync-metrics",
    { postIds: uniquePostIds },
    {
      delay: Math.max(0, delayMs),
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 60_000
      },
      removeOnComplete: 100,
      removeOnFail: 500
    }
  );

  return { queued: true };
}
