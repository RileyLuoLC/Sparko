import { getAnalyticsForAccount } from "@/lib/demo-store";
import { jsonError, jsonOk, routeParam } from "@/lib/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await routeParam(context, "id");
    return jsonOk(getAnalyticsForAccount(id));
  } catch (error) {
    return jsonError(error, 404);
  }
}
