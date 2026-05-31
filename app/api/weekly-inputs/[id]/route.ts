import { z } from "zod";
import { deleteWeeklyRoleInput, updateWeeklyRoleInput } from "@/lib/demo-store";
import { jsonError, jsonOk, readJson, routeParam } from "@/lib/http";
import {
  deleteWeeklyRoleInputInPrisma,
  isPrismaStoreConfigured,
  updateWeeklyRoleInputInPrisma
} from "@/lib/prisma-store";

const WeeklyInputUpdateSchema = z.object({
  xAccountId: z.string().min(1).optional(),
  roleInputTemplateId: z.string().min(1).optional(),
  content: z.string().min(1).max(2000).optional(),
  evidenceUrl: z.string().max(500).optional(),
  weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await routeParam(context, "id");
    const body = WeeklyInputUpdateSchema.parse(await readJson(request));
    const weeklyInput = isPrismaStoreConfigured()
      ? await updateWeeklyRoleInputInPrisma(id, body)
      : updateWeeklyRoleInput(id, body);
    return jsonOk({ weeklyInput });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await routeParam(context, "id");
    const weeklyInput = isPrismaStoreConfigured() ? await deleteWeeklyRoleInputInPrisma(id) : deleteWeeklyRoleInput(id);
    return jsonOk({ weeklyInput });
  } catch (error) {
    return jsonError(error);
  }
}
