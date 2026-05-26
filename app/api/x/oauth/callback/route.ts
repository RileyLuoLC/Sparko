import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { isPrismaStoreConfigured, persistConnectedXAccount } from "@/lib/prisma-store";
import { exchangeOAuthCode, type XOAuthTokenResponse } from "@/lib/x-api";

function setOAuthTokenCookies(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  token: XOAuthTokenResponse
) {
  const secure = env.appUrl.startsWith("https://");
  const accessMaxAge = Math.max(60, (token.expires_in ?? 7200) - 60);
  const expiresAt = new Date(Date.now() + (token.expires_in ?? 7200) * 1000).toISOString();

  cookieStore.set("x_access_token", token.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: accessMaxAge,
    path: "/"
  });
  cookieStore.set("x_token_expires_at", expiresAt, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: accessMaxAge,
    path: "/"
  });

  if (token.refresh_token) {
    cookieStore.set("x_refresh_token", token.refresh_token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: 60 * 60 * 24 * 30,
      path: "/"
    });
  }

  if (token.scope) {
    cookieStore.set("x_token_scope", token.scope, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: 60 * 60 * 24 * 30,
      path: "/"
    });
  }
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("x_oauth_state")?.value;
  const codeVerifier = cookieStore.get("x_code_verifier")?.value;
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");

  if (!state || state !== expectedState || !codeVerifier) {
    return NextResponse.redirect(`${env.appUrl}/?oauth=state-mismatch`);
  }

  if (code) {
    const token = await exchangeOAuthCode({ code, codeVerifier });
    setOAuthTokenCookies(cookieStore, token);
    if (isPrismaStoreConfigured()) {
      await persistConnectedXAccount(token);
    }
  }

  cookieStore.delete("x_oauth_state");
  cookieStore.delete("x_code_verifier");
  cookieStore.delete("x_oauth_purpose");
  return NextResponse.redirect(`${env.appUrl}/?oauth=connected`);
}
