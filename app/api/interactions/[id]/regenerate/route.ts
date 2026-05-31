import { regenerateReplyInteraction } from "@/lib/demo-store";
import { jsonError, jsonOk, routeParam } from "@/lib/http";
import { isPrismaStoreConfigured, regenerateReplyInteractionSuggestionInPrisma } from "@/lib/prisma-store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await routeParam(context, "id");
    if (isPrismaStoreConfigured()) {
      return jsonOk(await regenerateReplyInteractionSuggestionInPrisma(id));
    }
    return jsonOk(regenerateReplyInteraction(id));
  } catch (error) {
    return jsonError(error);
  }
}
