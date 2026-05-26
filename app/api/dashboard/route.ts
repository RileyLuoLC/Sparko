import { getDashboardData } from "@/lib/demo-store";
import { jsonOk } from "@/lib/http";
import { getDashboardDataFromPrisma, isPrismaStoreConfigured } from "@/lib/prisma-store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (isPrismaStoreConfigured()) {
    return jsonOk(await getDashboardDataFromPrisma());
  }
  return jsonOk(getDashboardData());
}
