import { z } from "zod";
import { addCompanyMaterial } from "@/lib/demo-store";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { addCompanyMaterialInPrisma, isPrismaStoreConfigured } from "@/lib/prisma-store";

const CompanyMaterialSchema = z.object({
  title: z.string().min(1).max(120),
  type: z.enum(["POSITIONING", "PRODUCT", "CUSTOMER_PROOF", "ANNOUNCEMENT", "OTHER"]).optional(),
  content: z.string().min(1).max(4000),
  url: z.string().max(500).optional(),
  notes: z.string().max(500).optional()
});

export async function POST(request: Request) {
  try {
    const body = CompanyMaterialSchema.parse(await readJson(request));
    const material = isPrismaStoreConfigured() ? await addCompanyMaterialInPrisma(body) : addCompanyMaterial(body);
    return jsonOk({ material });
  } catch (error) {
    return jsonError(error);
  }
}
