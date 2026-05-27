import { z } from "zod";
import { isOpenAIConfigured } from "@/lib/env";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { extractCompanyContext } from "@/lib/openai";

const ExtractCompanyContextSchema = z.object({
  url: z.string().url().max(500)
});

function extractTitle(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return decodeHtml(title?.replace(/\s+/g, " ").trim() ?? "");
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function htmlToText(html: string) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<\/(h1|h2|h3|p|li|div|section|article|br)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function fallbackContext(url: string, pageTitle: string, pageText: string) {
  const lines = pageText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 40 && line.length < 260)
    .slice(0, 10);
  const title = pageTitle || new URL(url).hostname.replace(/^www\./, "");
  const context = [
    "Positioning",
    ...(lines.slice(0, 3).map((line) => `- ${line}`)),
    "",
    "Product description",
    ...(lines.slice(3, 6).map((line) => `- ${line}`)),
    "",
    "Customer proof",
    ...(lines.slice(6, 8).map((line) => `- ${line}`)),
    "",
    "Launch notes",
    ...(lines.slice(8, 10).map((line) => `- ${line}`))
  ]
    .filter((line, index, all) => line || (all[index - 1] && all[index + 1]))
    .join("\n");

  return {
    title,
    context: context || `Positioning\n- Source page: ${title}\n\nProduct description\n- Review and edit this context before saving.`
  };
}

export async function POST(request: Request) {
  try {
    const body = ExtractCompanyContextSchema.parse(await readJson(request));
    const response = await fetch(body.url, {
      headers: {
        "User-Agent": "Sparko company context extractor"
      },
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
      throw new Error(`Could not fetch that URL (${response.status}).`);
    }

    const html = await response.text();
    const pageTitle = extractTitle(html);
    const pageText = htmlToText(html).slice(0, 18000);

    if (!pageText) {
      throw new Error("Could not find readable text on that page.");
    }

    if (isOpenAIConfigured()) {
      const extracted = await extractCompanyContext({
        url: body.url,
        pageTitle,
        pageText
      });
      return jsonOk({ ...extracted, source: "ai" });
    }

    return jsonOk({ ...fallbackContext(body.url, pageTitle, pageText), model: "local-extractor", source: "local" });
  } catch (error) {
    return jsonError(error);
  }
}
