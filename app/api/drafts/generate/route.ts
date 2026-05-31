import { z } from "zod";
import { addDrafts, getEntityRefs } from "@/lib/demo-store";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { generateDraftCandidates } from "@/lib/openai";
import { addDraftsInPrisma, getGenerationContextFromPrisma, isPrismaStoreConfigured } from "@/lib/prisma-store";

const GenerateSchema = z.object({
  xAccountId: z.string().optional(),
  count: z.number().int().min(1).max(5).optional(),
  generationBrief: z.string().max(1200).optional(),
  weeklyInputIds: z.array(z.string()).max(8).optional(),
  previewOnly: z.boolean().optional()
});

export async function POST(request: Request) {
  try {
    const body = GenerateSchema.parse(await readJson(request));
    if (isPrismaStoreConfigured()) {
      const refs = await getGenerationContextFromPrisma(body.xAccountId, body.weeklyInputIds ?? []);
      const requestedCount = body.count ?? 1;
      const result = await generateDraftCandidates({
        persona: refs.persona,
        account: refs.account,
        sourcePosts: [],
        trends: [],
        companyMaterials: refs.companyMaterials,
        weeklyInputs: refs.weeklyInputs,
        generationBrief: body.generationBrief,
        count: requestedCount
      });

      if (body.previewOnly) {
        return jsonOk({
          candidates: result.candidates.slice(0, requestedCount),
          model: result.model
        });
      }

      const drafts = await addDraftsInPrisma(result.candidates, refs.account.id, requestedCount, undefined, {
        aiModel: result.model
      });
      return jsonOk({ drafts, model: result.model });
    }

    const refs = getEntityRefs();
    const account = refs.xAccounts.find((item) => item.id === body.xAccountId) ?? refs.xAccounts[0];
    const persona = refs.personas.find((item) => item.id === account.personaId) ?? refs.personas[0];
    const requestedCount = body.count ?? 1;
    const selectedWeeklyInputs = (body.weeklyInputIds ?? [])
      .map((id) => refs.weeklyInputs.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const result = await generateDraftCandidates({
      persona,
      account,
      sourcePosts: [],
      trends: [],
      companyMaterials: refs.companyMaterials,
      weeklyInputs: selectedWeeklyInputs,
      generationBrief: body.generationBrief,
      count: requestedCount
    });

    if (body.previewOnly) {
      return jsonOk({
        candidates: result.candidates.slice(0, requestedCount),
        model: result.model
      });
    }

    const drafts = addDrafts(result.candidates, account.id, persona.id, requestedCount);
    drafts.forEach((draft) => {
      draft.aiModel = result.model;
    });

    return jsonOk({
      drafts,
      model: result.model
    });
  } catch (error) {
    return jsonError(error);
  }
}
