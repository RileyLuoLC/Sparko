import { z } from "zod";
import { deleteRoleInputTemplate, updateRoleInputTemplate } from "@/lib/demo-store";
import { jsonError, jsonOk, readJson, routeParam } from "@/lib/http";

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
    return jsonOk({ template: updateRoleInputTemplate(id, body) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await routeParam(context, "id");
    return jsonOk({ template: deleteRoleInputTemplate(id) });
  } catch (error) {
    return jsonError(error);
  }
}
