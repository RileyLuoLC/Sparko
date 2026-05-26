import { z } from "zod";
import { updatePersonaStrategy } from "@/lib/demo-store";
import { jsonError, jsonOk, readJson, routeParam } from "@/lib/http";
import { isPrismaStoreConfigured, updatePersonaStrategyInPrisma } from "@/lib/prisma-store";

const SETUP_PLACEHOLDER_ROLES = new Set(["Operator", "Needs setup"]);

const PersonaStrategySchema = z.object({
  xAccountId: z.string().min(1).optional(),
  name: z.string().min(1).max(80).optional(),
  roleLabel: z.string().min(1).max(80).refine((role) => !SETUP_PLACEHOLDER_ROLES.has(role), "Select an actual role.").optional(),
  roleLabels: z
    .array(z.string().min(1).max(80).refine((role) => !SETUP_PLACEHOLDER_ROLES.has(role), "Select an actual role."))
    .min(1)
    .max(12)
    .optional(),
  voice: z.string().min(1).max(500).optional(),
  audience: z.string().min(1).max(500).optional(),
  contentPillars: z.array(z.string().max(160)).max(8).optional(),
  guardrails: z.string().max(1000).optional(),
  avoidTopics: z.array(z.string().max(160)).max(8).optional(),
  defaultHashtags: z.array(z.string().max(40)).max(4).optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await routeParam(context, "id");
    const body = PersonaStrategySchema.parse(await readJson(request));
    if (isPrismaStoreConfigured()) {
      return jsonOk({ persona: await updatePersonaStrategyInPrisma(id, body, body.xAccountId) });
    }
    return jsonOk({ persona: updatePersonaStrategy(id, body) });
  } catch (error) {
    return jsonError(error);
  }
}
