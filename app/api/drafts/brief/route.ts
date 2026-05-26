import { z } from "zod";
import { acceptBriefAsDraft, getEntityRefs } from "@/lib/demo-store";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { acceptBriefAsDraftInPrisma, isPrismaStoreConfigured } from "@/lib/prisma-store";

const BriefDraftSchema = z.object({
  xAccountId: z.string(),
  text: z.string().max(280).optional().default(""),
  weeklyInputIds: z.array(z.string()).max(8).optional().default([])
});

export async function POST(request: Request) {
  try {
    const body = BriefDraftSchema.parse(await readJson(request));
    if (isPrismaStoreConfigured()) {
      return jsonOk(await acceptBriefAsDraftInPrisma({ text: body.text, accountId: body.xAccountId }));
    }

    const refs = getEntityRefs();
    const account = refs.xAccounts.find((item) => item.id === body.xAccountId);
    if (!account) {
      throw new Error("X account not found.");
    }

    const selectedWeeklyInputs = body.weeklyInputIds
      .map((id) => refs.weeklyInputs.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const weeklyInputText = selectedWeeklyInputs
      .map((input) => input.content.trim())
      .filter(Boolean)
      .join("\n\n");
    const text = body.text.trim() || weeklyInputText;

    const persona = refs.personas.find((item) => item.id === account.personaId) ?? refs.personas[0];
    return jsonOk(
      acceptBriefAsDraft({
        text,
        accountId: account.id,
        personaId: persona.id
      })
    );
  } catch (error) {
    return jsonError(error);
  }
}
