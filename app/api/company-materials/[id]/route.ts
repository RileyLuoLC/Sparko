import { z } from "zod";
import { deleteCompanyMaterial, updateCompanyMaterial } from "@/lib/demo-store";
import { jsonError, jsonOk, readJson, routeParam } from "@/lib/http";
import {
  deleteCompanyMaterialInPrisma,
  isPrismaStoreConfigured,
  updateCompanyMaterialInPrisma
} from "@/lib/prisma-store";

const CompanyMaterialUpdateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  type: z.enum(["POSITIONING", "PRODUCT", "CUSTOMER_PROOF", "ANNOUNCEMENT", "OTHER"]).optional(),
  content: z.string().min(1).max(4000).optional(),
  url: z.string().max(500).optional(),
  notes: z.string().max(500).optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await routeParam(context, "id");
    const body = CompanyMaterialUpdateSchema.parse(await readJson(request));
    const material = isPrismaStoreConfigured()
      ? await updateCompanyMaterialInPrisma(id, body)
      : updateCompanyMaterial(id, body);
    return jsonOk({ material });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await routeParam(context, "id");
    const material = isPrismaStoreConfigured() ? await deleteCompanyMaterialInPrisma(id) : deleteCompanyMaterial(id);
    return jsonOk({ material });
  } catch (error) {
    return jsonError(error);
  }
}
