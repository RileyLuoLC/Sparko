import { z } from "zod";
import { addRoleInputTemplate } from "@/lib/demo-store";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { generateRoleInputTemplatePrompt } from "@/lib/openai";
import { addRoleInputTemplateInPrisma, isPrismaStoreConfigured } from "@/lib/prisma-store";

const SETUP_PLACEHOLDER_ROLES = new Set(["Operator", "Needs setup"]);
const ActualRoleNameSchema = z.string().min(1).max(80).refine((role) => !SETUP_PLACEHOLDER_ROLES.has(role), "Select an actual role.");

const RoleInputTemplateBriefSchema = z.object({
  roleName: ActualRoleNameSchema,
  contentType: z.string().min(1).max(120),
  about: z.string().min(1).max(1000),
  isActive: z.boolean().optional()
});

export async function POST(request: Request) {
  try {
    const body = RoleInputTemplateBriefSchema.parse(await readJson(request));
    const result = await generateRoleInputTemplatePrompt({
      roleName: body.roleName,
      contentType: body.contentType,
      about: body.about
    });

    const templateInput = {
      roleName: body.roleName,
      contentType: body.contentType,
      prompt: result.prompt,
      isActive: body.isActive ?? true
    };
    const template = isPrismaStoreConfigured()
      ? await addRoleInputTemplateInPrisma(templateInput)
      : addRoleInputTemplate(templateInput);

    return jsonOk({ template, model: result.model });
  } catch (error) {
    return jsonError(error);
  }
}
