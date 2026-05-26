import { jsonError, jsonOk } from "@/lib/http";
import { isPrismaStoreConfigured, syncAllPublishedPostMetricsInPrisma } from "@/lib/prisma-store";

export async function POST() {
  try {
    if (!isPrismaStoreConfigured()) {
      return jsonOk({ metrics: { data: [] } });
    }

    const metrics = await syncAllPublishedPostMetricsInPrisma();
    return jsonOk({ metrics });
  } catch (error) {
    return jsonError(error);
  }
}
