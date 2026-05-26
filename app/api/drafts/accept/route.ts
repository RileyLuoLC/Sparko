import { z } from "zod";
import { acceptDraftCandidate, getEntityRefs } from "@/lib/demo-store";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { acceptDraftCandidateInPrisma, isPrismaStoreConfigured } from "@/lib/prisma-store";

const CandidateSchema = z.object({
  text: z.string().min(1).max(1000),
  rationale: z.string().max(1000).optional().default(""),
  hashtags: z.array(z.string()).optional().default([]),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  riskReasons: z.array(z.string()).optional().default([]),
  sourcePostId: z.string().nullish().transform((value) => value ?? undefined),
  trendSnapshotId: z.string().nullish().transform((value) => value ?? undefined)
});

const AcceptDraftSchema = z.object({
  xAccountId: z.string(),
  candidate: CandidateSchema
});

export async function POST(request: Request) {
  try {
    const body = AcceptDraftSchema.parse(await readJson(request));
    if (isPrismaStoreConfigured()) {
      return jsonOk(await acceptDraftCandidateInPrisma({ candidate: body.candidate, accountId: body.xAccountId }));
    }

    const refs = getEntityRefs();
    const account = refs.xAccounts.find((item) => item.id === body.xAccountId);
    if (!account) {
      throw new Error("X account not found.");
    }

    const persona = refs.personas.find((item) => item.id === account.personaId) ?? refs.personas[0];
    return jsonOk(
      acceptDraftCandidate({
        candidate: body.candidate,
        accountId: account.id,
        personaId: persona.id
      })
    );
  } catch (error) {
    return jsonError(error);
  }
}
