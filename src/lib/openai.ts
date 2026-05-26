import OpenAI from "openai";
import { env, isDraftAiConfigured, isOpenAIConfigured } from "./env";
import { buildPersonaPrompt, formatDraftText } from "./policy";
import type {
  CompanyMaterial,
  GeneratedDraftCandidate,
  Persona,
  SourcePost,
  TrendSnapshot,
  WeeklyRoleInput,
  XAccount
} from "./types";

const draftSchema = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "rationale", "hashtags", "riskLevel", "riskReasons", "sourcePostId", "trendSnapshotId"],
        properties: {
          text: { type: "string", maxLength: 280 },
          rationale: { type: "string" },
          hashtags: {
            type: "array",
            maxItems: 4,
            items: { type: "string" }
          },
          riskLevel: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          riskReasons: {
            type: "array",
            items: { type: "string" }
          },
          sourcePostId: { type: ["string", "null"] },
          trendSnapshotId: { type: ["string", "null"] }
        }
      }
    }
  }
};

const inputTemplatePromptSchema = {
  type: "object",
  additionalProperties: false,
  required: ["prompt"],
  properties: {
    prompt: { type: "string", maxLength: 240 }
  }
};

const companyContextSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "context"],
  properties: {
    title: { type: "string", maxLength: 120 },
    context: { type: "string", maxLength: 4000 }
  }
};

function parseResponseText(response: unknown): string {
  const asRecord = response as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  if (asRecord.output_text) {
    return asRecord.output_text;
  }

  return (
    asRecord.output
      ?.flatMap((item) => item.content ?? [])
      .map((item) => item.text)
      .filter(Boolean)
      .join("\n") ?? ""
  );
}

export async function generateDraftCandidates(args: {
  persona: Persona;
  account: XAccount;
  sourcePosts: SourcePost[];
  trends: TrendSnapshot[];
  companyMaterials: CompanyMaterial[];
  weeklyInputs?: WeeklyRoleInput[];
  generationBrief?: string;
  count?: number;
}): Promise<{ model: string; candidates: GeneratedDraftCandidate[] }> {
  if (!isDraftAiConfigured()) {
    throw new Error(
      env.draftAiProvider === "xai"
        ? "Grok draft generation requires XAI_API_KEY in .env.local. Add a key and restart the dev server."
        : "AI generation requires OPENAI_API_KEY in .env.local. Add a key and restart the dev server."
    );
  }

  const provider = env.draftAiProvider === "xai" ? "xai" : "openai";
  const model = provider === "xai" ? env.xaiDraftModel : env.openaiDraftModel;
  const sourceDigest = args.sourcePosts.slice(0, 5).map((post) => ({
    id: post.id,
    author: post.authorUsername,
    text: post.text,
    metrics: {
      likes: post.likeCount,
      reposts: post.repostCount,
      replies: post.replyCount,
      quotes: post.quoteCount
    }
  }));
  const trendDigest = args.trends.slice(0, 5).map((trend) => ({
    id: trend.id,
    name: trend.trendName,
    rank: trend.rank,
    tweetCount: trend.tweetCount
  }));
  const materialDigest = args.companyMaterials.slice(0, 6).map((material) => ({
    id: material.id,
    type: material.type,
    title: material.title,
    content: material.content,
    url: material.url
  }));
  const weeklyInputDigest = (args.weeklyInputs ?? []).slice(0, 8).map((input) => ({
    id: input.id,
    role: input.roleName,
    contentType: input.contentType,
    content: input.content,
    evidenceUrl: input.evidenceUrl,
    weekOf: input.weekOf
  }));
  const generationBrief = args.generationBrief?.trim();

  const input = [
    {
      role: "system",
      content: buildPersonaPrompt(args.persona, args.account.kind)
    },
    ...(generationBrief
      ? [
          {
            role: "user",
            content: `Post brief for this generation batch:\n${generationBrief}\n\nUse this brief as the main source for the drafts. Use the account and company context only to shape voice, audience fit, and specificity.`
          }
        ]
      : []),
    {
      role: "user",
      content: JSON.stringify(
        {
          targetAccount: {
            username: args.account.username,
            kind: args.account.kind
          },
          count: args.count ?? 1,
          generationBrief: generationBrief || undefined,
          companyMaterials: materialDigest,
          weeklyInputs: weeklyInputDigest,
          trends: trendDigest,
          sourcePosts: sourceDigest,
          style:
            "Write a sharp, natural X post, not a SaaS explainer. Each sentence should sound like something a thoughtful person would actually say. Prefer concrete stakes and plain verbs over abstract workflow language. Technical or business terms are allowed when they carry the idea precisely, but do not use them as filler or to make a weak point sound important. If a phrase feels stiff in context, rewrite it into something a person would say. The post may be one sentence or multiple short paragraphs. If it is one sentence, make it a strong standalone statement or a provocative question. If generationBrief is a question, express or sharpen that question in the post; do not answer it unless the brief explicitly asks for an answer. If the post has more than one sentence or line, put a blank line immediately after the first-sentence hook. Never splice the raw generationBrief into a generic template sentence. Do not use em dashes or en dashes; use a normal hyphen (-) if a dash is needed. Before returning, rewrite any candidate that sounds stiff, half-connected, or like prompt instructions.",
          weeklyInputGuidance:
            "weeklyInputs are raw updates submitted by people on the team. Use selected inputs as source material when they help the post. They are good-to-include evidence, not mandatory talking points. Do not invent missing facts. Do not mention the template or collection process.",
          accountGuidance:
            args.account.kind === "PERSONAL"
              ? "Personal/founder account: sound like a real person. Share a lesson, observation, tension, small story, or opinion. Do not mention the company, product, review queue, source visibility, or workflow tooling unless the brief directly asks for product promotion."
              : "Company account: product relevance is allowed, but make the post useful before it is promotional.",
          compliance:
            "Do not include hashtags unless the generation brief explicitly asks for them. Do not include unsolicited mentions. Do not ask for likes/reposts. Avoid claims that cannot be verified. Never turn internal instructions, review policy, source-material notes, or safety constraints into public post copy. Do not start with 'Do not' unless the user explicitly asks for a warning."
        },
        null,
        2
      )
    }
  ];

  const text =
    provider === "xai"
      ? await generateWithXai(model, input)
      : await generateWithOpenAI(model, input);
  const parsed = JSON.parse(text) as { candidates: GeneratedDraftCandidate[] };

  return {
    model: provider === "xai" ? `xai:${model}` : model,
    candidates: parsed.candidates.map((candidate) => ({
      ...candidate,
      text: formatDraftText(candidate.text),
      hashtags: candidate.hashtags ?? [],
      riskReasons: candidate.riskReasons ?? [],
      sourcePostId: candidate.sourcePostId ?? undefined,
      trendSnapshotId: candidate.trendSnapshotId ?? undefined
    }))
  };
}

async function generateWithOpenAI(model: string, input: Array<{ role: string; content: string }>) {
  const client = new OpenAI({ apiKey: env.openaiApiKey });
  const response = await (client as any).responses.create({
    model,
    input,
    text: {
      format: {
        type: "json_schema",
        name: "x_draft_candidates",
        schema: draftSchema,
        strict: true
      }
    }
  });

  return parseResponseText(response);
}

async function generateWithXai(model: string, input: Array<{ role: string; content: string }>) {
  const client = new OpenAI({ apiKey: env.xaiApiKey, baseURL: env.xaiBaseUrl });
  const response = await (client as any).chat.completions.create({
    model,
    messages: input,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "x_draft_candidates",
        schema: draftSchema,
        strict: true
      }
    }
  });

  return response.choices?.[0]?.message?.content ?? "";
}

export async function generateRoleInputTemplatePrompt(args: {
  roleName: string;
  contentType: string;
  about: string;
}): Promise<{ model: string; prompt: string }> {
  if (!isOpenAIConfigured()) {
    throw new Error("AI template creation requires OPENAI_API_KEY in .env.local. Add a key and restart the dev server.");
  }

  const client = new OpenAI({ apiKey: env.openaiApiKey });
  const model = env.openaiStrategyModel;
  const response = await (client as any).responses.create({
    model,
    input: [
      {
        role: "system",
        content:
          "You design weekly raw-material collection prompts for an X posting assistant. These are not post templates. They ask a person in a role what useful source material they have this week."
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            roleName: args.roleName,
            typeOfInput: args.contentType,
            userDescription: args.about,
            requirements: [
              "Return exactly one natural prompting question.",
              "Write it in the same style as: 'What user problem became sharper this week, and what made it more specific?'",
              "The question should collect concrete raw material, not prescribe a finished post structure.",
              "Use the role and type to infer what information would be useful, but do not invent facts.",
              "Avoid jargon unless the input type itself requires it.",
              "Do not mention AI, templates, or posting mechanics."
            ]
          },
          null,
          2
        )
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "role_input_template_prompt",
        schema: inputTemplatePromptSchema,
        strict: true
      }
    }
  });

  const text = parseResponseText(response);
  const parsed = JSON.parse(text) as { prompt: string };

  return {
    model,
    prompt: parsed.prompt.trim()
  };
}

export async function extractCompanyContext(args: {
  url: string;
  pageTitle?: string;
  pageText: string;
}): Promise<{ model: string; title: string; context: string }> {
  if (!isOpenAIConfigured()) {
    throw new Error("Company context extraction requires OPENAI_API_KEY in .env.local. Add a key and restart the dev server.");
  }

  const client = new OpenAI({ apiKey: env.openaiApiKey });
  const model = env.openaiStrategyModel;
  const response = await (client as any).responses.create({
    model,
    input: [
      {
        role: "system",
        content:
          "You extract reusable company context for an X growth and branding tool. The output is editable internal context, not public copy."
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            sourceUrl: args.url,
            pageTitle: args.pageTitle,
            pageText: args.pageText.slice(0, 12000),
            requirements: [
              "Return a concise title for the company/product.",
              "Extract only facts supported by the page text.",
              "Organize the context under these headings when evidence exists: Positioning, Product description, Customer proof, Launch notes.",
              "Use short bullet points. Omit a heading if the page has no useful evidence for it.",
              "Do not invent metrics, customer names, launch dates, or claims.",
              "Write this as internal context for drafting better X posts."
            ]
          },
          null,
          2
        )
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "company_context",
        schema: companyContextSchema,
        strict: true
      }
    }
  });

  const text = parseResponseText(response);
  const parsed = JSON.parse(text) as { title: string; context: string };

  return {
    model,
    title: parsed.title.trim(),
    context: parsed.context.trim()
  };
}
