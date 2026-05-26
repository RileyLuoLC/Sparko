import { z } from "zod";
import { approveDraft } from "@/lib/demo-store";
import { jsonError, jsonOk, readJson, routeParam } from "@/lib/http";
import { approveDraftInPrisma, isPrismaStoreConfigured } from "@/lib/prisma-store";

const ApproveSchema = z.object({
  comment: z.string().max(500).optional()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await routeParam(context, "id");
    const body = ApproveSchema.parse(await readJson(request));
    if (isPrismaStoreConfigured()) {
      return jsonOk(await approveDraftInPrisma(id, body));
    }
    return jsonOk(approveDraft(id, body));
  } catch (error) {
    return jsonError(error);
  }
}
