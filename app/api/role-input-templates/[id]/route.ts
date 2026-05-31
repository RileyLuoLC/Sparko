import { z } from "zod";
import { deleteRoleInputTemplate, updateRoleInputTemplate } from "@/lib/demo-store";
import { jsonError, jsonOk, readJson, routeParam } from "@/lib/http";
import {
  deleteRoleInputTemplateInPrisma,
  isPrismaStoreConfigured,
  updateRoleInputTemplateInPrisma
} from "@/lib/prisma-store";

const SETUP_PLACEHOLDER_ROLES = new Set(["Operator", "Needs setup"]);
const ActualRoleNameSchema = z.string().min(1).max(80).refine((role) => !SETUP_PLACEHOLDER_ROLES.has(role), "Select an actual role.");

const RoleInputTemplateUpdateSchema = z.object({
  roleName: ActualRoleNameSchema.optional(),
  contentType: z.string().min(1).max(120).optional(),
  prompt: z.string().min(1).max(1000).optional(),
  example: z.string().max(500).optional(),
  isActive: z.boolean().optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await routeParam(context, "id");
    const body = RoleInputTemplateUpdateSchema.parse(await readJson(request));
    const template = isPrismaStoreConfigured()
      ? await updateRoleInputTemplateInPrisma(id, body)
      : updateRoleInputTemplate(id, body);
    return jsonOk({ template });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await routeParam(context, "id");
    const template = isPrismaStoreConfigured() ? await deleteRoleInputTemplateInPrisma(id) : deleteRoleInputTemplate(id);
    return jsonOk({ template });
  } catch (error) {
    return jsonError(error);
  }
}
