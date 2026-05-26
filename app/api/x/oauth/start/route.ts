import { cookies } from "next/headers";
import { z } from "zod";
import { env, isXOAuthConfigured } from "@/lib/env";
import { jsonOk, readJson } from "@/lib/http";
import { createOAuthStart, type OAuthPurpose } from "@/lib/x-api";

const StartSchema = z.object({
  purpose: z.enum(["personalized_trends", "publishing"]).optional(),
  forceLogin: z.boolean().optional()
});

export async function POST(request: Request) {
  const body = StartSchema.parse(await readJson(request));
  const purpose: OAuthPurpose = body.purpose ?? "personalized_trends";
  const start = createOAuthStart(purpose, { forceLogin: body.forceLogin });
  const cookieStore = await cookies();
  cookieStore.set("x_oauth_state", start.state, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.appUrl.startsWith("https://"),
    maxAge: 10 * 60,
    path: "/"
  });
  cookieStore.set("x_code_verifier", start.codeVerifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.appUrl.startsWith("https://"),
    maxAge: 10 * 60,
    path: "/"
  });
  cookieStore.set("x_oauth_purpose", purpose, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.appUrl.startsWith("https://"),
    maxAge: 10 * 60,
    path: "/"
  });

  return jsonOk({
    authorizationUrl: start.authorizationUrl,
    configured: isXOAuthConfigured(),
    purpose
  });
}
