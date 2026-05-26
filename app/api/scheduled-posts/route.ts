import { z } from "zod";
import { schedulePost } from "@/lib/demo-store";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { isPrismaStoreConfigured, schedulePostInPrisma } from "@/lib/prisma-store";
import { enqueueScheduledPost } from "@/lib/queue";

const ScheduleSchema = z.object({
  draftPostId: z.string().optional(),
  xAccountId: z.string().min(1),
  finalText: z.string().min(1).max(280),
  scheduledFor: z.string().datetime()
});

export async function POST(request: Request) {
  try {
    const body = ScheduleSchema.parse(await readJson(request));
    const scheduledPost = isPrismaStoreConfigured() ? await schedulePostInPrisma(body) : schedulePost(body);
    const queue = await enqueueScheduledPost(scheduledPost.id, scheduledPost.scheduledFor);

    return jsonOk({
      scheduledPost,
      queue
    });
  } catch (error) {
    return jsonError(error);
  }
}
