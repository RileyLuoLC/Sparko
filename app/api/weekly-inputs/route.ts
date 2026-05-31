import { z } from "zod";
import { addWeeklyRoleInput } from "@/lib/demo-store";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { addWeeklyRoleInputInPrisma, isPrismaStoreConfigured } from "@/lib/prisma-store";

const WeeklyInputSchema = z.object({
  xAccountId: z.string().min(1),
  roleInputTemplateId: z.string().min(1),
  content: z.string().min(1).max(2000),
  evidenceUrl: z.string().max(500).optional(),
  weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export async function POST(request: Request) {
  try {
    const body = WeeklyInputSchema.parse(await readJson(request));
    const weeklyInput = isPrismaStoreConfigured() ? await addWeeklyRoleInputInPrisma(body) : addWeeklyRoleInput(body);
    return jsonOk({ weeklyInput });
  } catch (error) {
    return jsonError(error);
  }
}
