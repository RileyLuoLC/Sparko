import { z } from "zod";
import { deleteDraft, updateDraft, updateDraftAccount } from "@/lib/demo-store";
import { jsonError, jsonOk, readJson, routeParam } from "@/lib/http";
import {
  deleteDraftInPrisma,
  isPrismaStoreConfigured,
  updateDraftAccountInPrisma,
  updateDraftInPrisma
} from "@/lib/prisma-store";

const UpdateDraftSchema = z.object({
  text: z.string().min(1).max(280).optional(),
  xAccountId: z.string().optional(),
  rationale: z.string().max(1000).optional()
}).refine((input) => input.text !== undefined || input.xAccountId !== undefined, {
  message: "Provide draft text or publishing account."
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await routeParam(context, "id");
    const body = UpdateDraftSchema.parse(await readJson(request));

    if (isPrismaStoreConfigured()) {
      const accountUpdate = body.xAccountId ? await updateDraftAccountInPrisma(id, body.xAccountId) : undefined;

      if (body.text !== undefined) {
        return jsonOk({
          ...(await updateDraftInPrisma(id, { text: body.text, rationale: body.rationale })),
          accountUpdate
        });
      }

      return jsonOk({
        draft: accountUpdate?.draft,
        reviewReset: false
      });
    }

    const accountUpdate = body.xAccountId ? updateDraftAccount(id, body.xAccountId) : undefined;

    if (body.text !== undefined) {
      return jsonOk({
        ...updateDraft(id, { text: body.text, rationale: body.rationale }),
        accountUpdate
      });
    }

    return jsonOk({
      draft: accountUpdate?.draft,
      reviewReset: false
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await routeParam(context, "id");
    if (isPrismaStoreConfigured()) {
      return jsonOk({ draft: await deleteDraftInPrisma(id) });
    }
    return jsonOk({ draft: deleteDraft(id) });
  } catch (error) {
    return jsonError(error);
  }
}
