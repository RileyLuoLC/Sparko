import * as nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { Worker } = await import("bullmq");
const { default: IORedis } = await import("ioredis");
const { env } = await import("../src/lib/env");
const {
  isPrismaStoreConfigured,
  publishDueScheduledPostsInPrisma,
  publishScheduledPost,
  syncMetricsForPublishedPosts
} = await import("../src/lib/prisma-store");
const { QUEUES } = await import("../src/lib/queue");
const { lookupPosts } = await import("../src/lib/x-api");

if (!env.redisUrl) {
  console.log("REDIS_URL is not configured. Worker is idle; scheduled posts will remain queued.");
  process.exit(0);
}

const connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });

const publishWorker = new Worker(
  QUEUES.publish,
  async (job) => {
    console.log(`Publishing scheduled post ${job.data.scheduledPostId}`);
    if (!isPrismaStoreConfigured()) {
      return { scheduledPostId: job.data.scheduledPostId, status: "demo-mode-noop" };
    }
    return publishScheduledPost(job.data.scheduledPostId);
  },
  { connection }
);

const metricsWorker = new Worker(
  QUEUES.metrics,
  async (job) => {
    const postIds = Array.isArray(job.data.postIds) ? job.data.postIds : [];
    const metrics = isPrismaStoreConfigured() ? await syncMetricsForPublishedPosts(postIds) : await lookupPosts(postIds);
    console.log(`Synced metrics for ${postIds.length} posts`);
    return metrics;
  },
  { connection }
);

publishWorker.on("failed", (job, error) => {
  console.error(`Publish job ${job?.id} failed`, error);
});

metricsWorker.on("failed", (job, error) => {
  console.error(`Metrics job ${job?.id} failed`, error);
});

let duePublishScanRunning = false;

async function publishOverdueQueuedPosts() {
  if (!isPrismaStoreConfigured() || duePublishScanRunning) {
    return;
  }

  duePublishScanRunning = true;
  try {
    const results = await publishDueScheduledPostsInPrisma();
    if (results.length > 0) {
      console.log(`Processed ${results.length} overdue queued scheduled post(s).`);
    }
  } catch (error) {
    console.error("Overdue scheduled post scan failed", error);
  } finally {
    duePublishScanRunning = false;
  }
}

void publishOverdueQueuedPosts();
setInterval(() => {
  void publishOverdueQueuedPosts();
}, 15_000);

console.log("Workers are running.");
