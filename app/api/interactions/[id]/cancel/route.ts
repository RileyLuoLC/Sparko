import { cancelInteraction } from "@/lib/demo-store";
import { jsonError, jsonOk, routeParam } from "@/lib/http";
import { cancelInteractionInPrisma, isPrismaStoreConfigured } from "@/lib/prisma-store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await routeParam(context, "id");
    if (isPrismaStoreConfigured()) {
      return jsonOk(await cancelInteractionInPrisma(id));
    }
    return jsonOk(cancelInteraction(id));
  } catch (error) {
    return jsonError(error);
  }
}
