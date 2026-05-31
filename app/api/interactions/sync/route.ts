import { jsonError, jsonOk } from "@/lib/http";
import { isPrismaStoreConfigured, syncReplyInteractionSuggestionsInPrisma } from "@/lib/prisma-store";

export async function POST() {
  try {
    if (!isPrismaStoreConfigured()) {
      return jsonOk({ scannedPublishedPosts: 0, scannedRecentInteractors: 0, skippedUnsuitablePosts: 0, sourcePosts: [], interactions: [] });
    }

    return jsonOk(await syncReplyInteractionSuggestionsInPrisma());
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Interaction sync failed.", 400);
  }
}
