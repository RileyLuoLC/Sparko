import { z } from "zod";
import { cancelScheduledPost, updateScheduledPost } from "@/lib/demo-store";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import {
  cancelScheduledPostInPrisma,
  isPrismaStoreConfigured,
  updateScheduledPostInPrisma
} from "@/lib/prisma-store";
import { enqueueScheduledPost } from "@/lib/queue";

const UpdateScheduledPostSchema = z.object({
  scheduledFor: z.string().datetime()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = UpdateScheduledPostSchema.parse(await readJson(request));
    const scheduledPost = isPrismaStoreConfigured()
      ? await updateScheduledPostInPrisma(id, body)
      : updateScheduledPost(id, body);
    const queue = await enqueueScheduledPost(scheduledPost.id, scheduledPost.scheduledFor);

    return jsonOk({
      scheduledPost,
      queue
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const scheduledPost = isPrismaStoreConfigured()
      ? await cancelScheduledPostInPrisma(id)
      : cancelScheduledPost(id);

    return jsonOk({ scheduledPost });
  } catch (error) {
    return jsonError(error);
  }
}
