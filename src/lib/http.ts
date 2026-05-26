import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Unexpected error.";
  return NextResponse.json({ error: message }, { status });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export async function routeParam(
  context: { params: Promise<Record<string, string>> | Record<string, string> },
  name: string
) {
  const params = await Promise.resolve(context.params);
  return params[name];
}
