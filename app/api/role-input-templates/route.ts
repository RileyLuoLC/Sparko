import { z } from "zod";
import { addRoleInputTemplate } from "@/lib/demo-store";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { addRoleInputTemplateInPrisma, isPrismaStoreConfigured } from "@/lib/prisma-store";

const SETUP_PLACEHOLDER_ROLES = new Set(["Operator", "Needs setup"]);
const ActualRoleNameSchema = z.string().min(1).max(80).refine((role) => !SETUP_PLACEHOLDER_ROLES.has(role), "Select an actual role.");

const RoleInputTemplateSchema = z.object({
  roleName: ActualRoleNameSchema,
  contentType: z.string().min(1).max(120),
  prompt: z.string().min(1).max(1000),
  example: z.string().max(500).optional(),
  isActive: z.boolean().optional()
});

export async function POST(request: Request) {
  try {
    const body = RoleInputTemplateSchema.parse(await readJson(request));
    const template = isPrismaStoreConfigured() ? await addRoleInputTemplateInPrisma(body) : addRoleInputTemplate(body);
    return jsonOk({ template });
  } catch (error) {
    return jsonError(error);
  }
}
