import { z } from "zod";
import { updateXAccountRoles } from "@/lib/demo-store";
import { jsonError, jsonOk, readJson, routeParam } from "@/lib/http";
import { isPrismaStoreConfigured, updateXAccountRolesInPrisma } from "@/lib/prisma-store";

const SETUP_PLACEHOLDER_ROLES = new Set(["Operator", "Needs setup"]);

const XAccountUpdateSchema = z.object({
  roleLabels: z
    .array(z.string().min(1).max(80).refine((role) => !SETUP_PLACEHOLDER_ROLES.has(role), "Select an actual role."))
    .min(1)
    .max(12)
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await routeParam(context, "id");
    const body = XAccountUpdateSchema.parse(await readJson(request));
    if (isPrismaStoreConfigured()) {
      return jsonOk({ account: await updateXAccountRolesInPrisma(id, body.roleLabels) });
    }
    return jsonOk({ account: updateXAccountRoles(id, body.roleLabels) });
  } catch (error) {
    return jsonError(error);
  }
}
