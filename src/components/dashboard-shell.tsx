"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  MessageSquareQuote,
  Pencil,
  PlugZap,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Trash2,
  Users2,
  X as XIcon
} from "lucide-react";
import type {
  CompanyMaterial,
  CompanyMaterialType,
  DashboardData,
  DraftPost,
  GeneratedDraftCandidate,
  InteractionSuggestion,
  Persona,
  ReadinessData,
  ReadinessStatus,
  RoleInputTemplate,
  ScheduledPost,
  WeeklyRoleInput,
  XAccount
} from "@/lib/types";

type PersonaStrategyInput = {
  name: string;
  roleLabel: string;
  roleLabels?: string[];
  voice: string;
  audience: string;
  contentPillars: string[];
  guardrails: string;
  avoidTopics: string[];
  defaultHashtags: string[];
};

type CompanyMaterialInput = {
  title: string;
  type: CompanyMaterialType;
  content: string;
  url?: string;
  notes?: string;
};

type CompanyInformationInput = {
  companyName: string;
  productName: string;
  industry: string;
  productService: string;
  positioning: string;
  competitiveAdvantage: string;
};

type RoleInputTemplateInput = {
  roleName: string;
  contentType: string;
  prompt: string;
  example?: string;
  isActive?: boolean;
};

type RoleInputTemplateBriefInput = {
  roleName: string;
  contentType: string;
  about: string;
  isActive?: boolean;
};

type WeeklyRoleInputInput = {
  xAccountId: string;
  roleInputTemplateId: string;
  content: string;
  evidenceUrl?: string;
  weekOf: string;
};

type DashboardShellProps = {
  mode?: "console" | "background";
};

const BASE_TIME_ZONE_OPTIONS = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney"
];
const PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const ROLE_DISPLAY_ORDER = [
  "Company Official Account",
  "Founder",
  "Investor",
  "Creator",
  "Engineer",
  "Designer",
  "Growth",
  "PM"
];
const ADD_NEW_TYPE_VALUE = "__add_new_type__";
const SETUP_PLACEHOLDER_ROLES = new Set(["Operator", "Needs setup"]);
const LEGACY_AUTOFILL_STRATEGY = {
  voice: "specific, useful, concise",
  audience: "builders and operators on X",
  contentPillars: ["operating lessons", "product observations"],
  guardrails: "Keep posts grounded, specific, and non-salesy."
};
const ROLE_STRATEGY_PLACEHOLDERS: Record<
  string,
  {
    voice: string;
    audience: string;
    contentPillars: string;
    guardrails: string;
    avoidTopics: string;
  }
> = {
  "Company Official Account": {
    voice: "e.g. clear, credible, product-led, helpful",
    audience: "e.g. teams evaluating this product, current users, industry peers",
    contentPillars: "e.g. product launches\ncustomer proof\nuse cases\ncompany point of view",
    guardrails: "e.g. keep claims factual, avoid hype, link to proof when possible",
    avoidTopics: "e.g. unannounced roadmap\ncompetitor attacks\nunsupported performance claims"
  },
  Founder: {
    voice: "e.g. candid, opinionated, practical, founder-led",
    audience: "e.g. operators, early customers, investors, people building in this space",
    contentPillars: "e.g. lessons from building\nmarket observations\ncustomer insights\nbehind the scenes",
    guardrails: "e.g. write from direct experience, be specific, avoid generic founder advice",
    avoidTopics: "e.g. confidential metrics\nteam issues\nfundraising details not ready to share"
  },
  Investor: {
    voice: "e.g. analytical, sharp, thesis-driven, concise",
    audience: "e.g. founders, operators, other investors, ecosystem builders",
    contentPillars: "e.g. market theses\nfounder lessons\ncategory shifts\ncompany-building patterns",
    guardrails: "e.g. separate opinion from facts, avoid investment advice, disclose conflicts when relevant",
    avoidTopics: "e.g. private portfolio data\nunannounced rounds\nspecific buy/sell recommendations"
  },
  Creator: {
    voice: "e.g. curious, memorable, direct, story-driven",
    audience: "e.g. followers interested in your niche, collaborators, potential customers",
    contentPillars: "e.g. personal lessons\noriginal frameworks\ncurated finds\nbehind-the-scenes process",
    guardrails: "e.g. keep posts useful, make one clear point, avoid engagement bait",
    avoidTopics: "e.g. off-brand trends\nprivate life details\nclaims you cannot back up"
  },
  Engineer: {
    voice: "e.g. precise, pragmatic, technically grounded",
    audience: "e.g. engineers, technical founders, product-minded builders",
    contentPillars: "e.g. technical tradeoffs\narchitecture lessons\ndebugging stories\ntooling notes",
    guardrails: "e.g. explain tradeoffs clearly, avoid leaking secrets, make examples understandable",
    avoidTopics: "e.g. credentials\nsecurity-sensitive details\ninternal incidents not cleared to share"
  },
  Designer: {
    voice: "e.g. thoughtful, visual, human-centered, practical",
    audience: "e.g. designers, founders, product teams, creative operators",
    contentPillars: "e.g. design decisions\nbefore-and-after lessons\nuser behavior insights\nvisual systems",
    guardrails: "e.g. explain the why behind design choices, stay constructive, avoid vague taste claims",
    avoidTopics: "e.g. client-confidential work\nunreleased screens\npersonal critiques"
  },
  Growth: {
    voice: "e.g. experimental, data-aware, plainspoken, useful",
    audience: "e.g. founders, marketers, growth leads, operators",
    contentPillars: "e.g. experiments\nconversion lessons\ndistribution insights\npositioning tests",
    guardrails: "e.g. share context with numbers, avoid silver bullets, distinguish signal from guess",
    avoidTopics: "e.g. private funnel data\nspam tactics\nclaims without enough sample size"
  },
  PM: {
    voice: "e.g. structured, strategic, user-focused, concise",
    audience: "e.g. product builders, founders, operators, cross-functional teams",
    contentPillars: "e.g. roadmap tradeoffs\nuser insights\nprioritization lessons\nproduct strategy",
    guardrails: "e.g. make tradeoffs explicit, ground posts in user evidence, avoid roadmap promises",
    avoidTopics: "e.g. unreleased features\ncustomer names without permission\ninternal debates"
  }
};
const DEFAULT_STRATEGY_PLACEHOLDERS = {
  voice: "e.g. clear, distinct, useful, memorable",
  audience: "e.g. the people you want this account to attract",
  contentPillars: "e.g. lessons learned\nstrong opinions\nuseful observations",
  guardrails: "e.g. keep posts specific, grounded, and aligned with the account's point of view",
  avoidTopics: "e.g. anything private, off-brand, or not useful to this audience"
};
const COMPANY_INFORMATION_NOTE = "COMPANY_INFORMATION_PROFILE";
const COMPANY_INFORMATION_TITLE = "Company Information";

const EMPTY_COMPANY_INFORMATION: CompanyInformationInput = {
  companyName: "",
  productName: "",
  industry: "",
  productService: "",
  positioning: "",
  competitiveAdvantage: ""
};

function sortRoleNames(roles: string[]) {
  return [...roles].sort((a, b) => {
    const aIndex = ROLE_DISPLAY_ORDER.indexOf(a);
    const bIndex = ROLE_DISPLAY_ORDER.indexOf(b);
    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? ROLE_DISPLAY_ORDER.length : aIndex) - (bIndex === -1 ? ROLE_DISPLAY_ORDER.length : bIndex);
    }
    return a.localeCompare(b);
  });
}

function getAccountRoleNames(account: XAccount | undefined, persona: Persona | undefined) {
  if (needsAccountSetup(persona)) {
    return ["Needs setup"];
  }

  const roles = account?.roleLabels?.length ? account.roleLabels : persona?.roleLabel ? [persona.roleLabel] : [];
  const cleanRoles = sortRoleNames([...new Set(roles.filter(Boolean))]);
  return cleanRoles.length > 0 ? cleanRoles : ["Needs setup"];
}

function getEditableAccountRoleNames(account: XAccount | undefined, persona: Persona | undefined) {
  const roles = account?.roleLabels?.length ? account.roleLabels : persona?.roleLabel ? [persona.roleLabel] : [];
  return sortRoleNames([...new Set(roles.filter((role) => role && !SETUP_PLACEHOLDER_ROLES.has(role)))]);
}

function needsAccountSetup(persona: Persona | undefined) {
  if (!persona) {
    return true;
  }

  const placeholderRole = !persona.roleLabel.trim() || SETUP_PLACEHOLDER_ROLES.has(persona.roleLabel);
  return (
    placeholderRole ||
    !persona.voice.trim() ||
    !persona.audience.trim() ||
    persona.contentPillars.length === 0
  );
}

function isSameList(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function editablePersonaStrategy(persona: Persona) {
  const clearLegacyAutofill = needsAccountSetup(persona);

  return {
    voice: clearLegacyAutofill && persona.voice === LEGACY_AUTOFILL_STRATEGY.voice ? "" : persona.voice,
    audience: clearLegacyAutofill && persona.audience === LEGACY_AUTOFILL_STRATEGY.audience ? "" : persona.audience,
    contentPillars:
      clearLegacyAutofill && isSameList(persona.contentPillars, LEGACY_AUTOFILL_STRATEGY.contentPillars)
        ? ""
        : persona.contentPillars.join("\n"),
    guardrails: clearLegacyAutofill && persona.guardrails === LEGACY_AUTOFILL_STRATEGY.guardrails ? "" : persona.guardrails,
    avoidTopics: persona.avoidTopics.join("\n"),
    defaultHashtags: persona.defaultHashtags.join(", ")
  };
}

const statusTone: Record<string, string> = {
  CANDIDATE: "neutral",
  NEEDS_REVIEW: "warn",
  APPROVED: "good",
  REJECTED: "bad",
  SCHEDULED: "info",
  PUBLISHED: "good",
  QUEUED: "info",
  FAILED: "bad",
  SUGGESTED: "neutral",
  BLOCKED: "bad",
  EXECUTED: "good"
};

function AppFrame({ mode, children }: { mode: "console" | "background"; children: React.ReactNode }) {
  return (
    <main className="app-shell">
      <div className="app-frame">
        <aside className="app-sidebar" aria-label="Workspace navigation">
          <Link className="brand-mark" href="/">
            <span className="brand-icon">
              <Sparkles size={14} />
            </span>
            <strong>Sparko</strong>
            <small>Your Growth and Branding Tool for X</small>
          </Link>

          <nav className="sidebar-nav">
            <div className="sidebar-section">
              <div className="sidebar-section-head">
                <span>Console</span>
              </div>
              <Link className={mode === "console" ? "sidebar-item active" : "sidebar-item"} href="/#workflow">
                <Sparkles size={14} />
                Workflow
              </Link>
              <Link className="sidebar-item" href="/#review-queue">
                <CheckCircle2 size={14} />
                Review Queue
              </Link>
              <Link className="sidebar-item" href="/#scheduled-posts">
                <Clock3 size={14} />
                Scheduled Posts
              </Link>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section-head">
                <span>Setup</span>
              </div>
              <Link className={mode === "background" ? "sidebar-item active" : "sidebar-item"} href="/background">
                <Users2 size={14} />
                Account Info
              </Link>
              <Link className="sidebar-item" href="/background#company-information">
                <FileText size={14} />
                Company Info
              </Link>
              <Link className="sidebar-item" href="/background#weekly-input-templates">
                <FileText size={14} />
                Input Templates
              </Link>
            </div>
            <p className="sidebar-shoutout">
              If you like this tool, please give us a shoutout on X and tag @RileyLuoLC.
            </p>
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user-row">
              <span className="avatar-dot">XO</span>
              <span>
                <strong>Ops Console</strong>
                <small>Open source console</small>
              </span>
            </div>
          </div>
        </aside>
        <div className="main-pane">{children}</div>
      </div>
    </main>
  );
}

function getDeviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function getTimeZoneOptions(deviceTimeZone: string, selectedTimeZone: string) {
  return [...new Set([deviceTimeZone, selectedTimeZone, ...BASE_TIME_ZONE_OPTIONS].filter(Boolean))];
}

function timeZoneLabel(timeZone: string) {
  return timeZone.replace(/_/g, " ");
}

function defaultScheduleTime(timeZone = getDeviceTimeZone()) {
  const date = new Date();
  date.setSeconds(0, 0);
  return formatDateTimeInTimeZone(date, timeZone);
}

function editableScheduleTime(value: string, timeZone: string) {
  const scheduledFor = new Date(value);
  if (Number.isNaN(scheduledFor.getTime()) || scheduledFor <= new Date()) {
    return defaultScheduleTime(timeZone);
  }
  return formatDateTimeInTimeZone(scheduledFor, timeZone);
}

function currentWeekOf() {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function formatDateTimeLocalParts(parts: { year: number; month: number; day: number; hour: number; minute: number }) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return [
    parts.year,
    "-",
    pad(parts.month),
    "-",
    pad(parts.day),
    "T",
    pad(parts.hour),
    ":",
    pad(parts.minute)
  ].join("");
}

function zonedParts(date: Date, timeZone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second
  };
}

function formatDateTimeInTimeZone(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  return formatDateTimeLocalParts(parts);
}

function parseDateTimeLocal(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) {
    return undefined;
  }

  const [, year, month, day, hour, minute] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute)
  };
}

function dateTimeLocalToUtc(value: string, timeZone: string) {
  const parts = parseDateTimeLocal(value);
  if (!parts) {
    return undefined;
  }

  const desiredUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  let guess = desiredUtc;

  for (let index = 0; index < 3; index += 1) {
    const current = zonedParts(new Date(guess), timeZone);
    const currentUtc = Date.UTC(current.year, current.month - 1, current.day, current.hour, current.minute);
    guess = desiredUtc - (currentUtc - guess);
  }

  const resolved = new Date(guess);
  return Number.isNaN(resolved.getTime()) ? undefined : resolved;
}

function resolveScheduleTime(value: string, timeZone: string) {
  const selected = dateTimeLocalToUtc(value, timeZone);

  if (!value || !selected) {
    throw new Error("Choose a schedule time.");
  }

  if (selected <= new Date()) {
    throw new Error("Choose a future schedule time.");
  }

  return {
    inputValue: value,
    isoValue: selected.toISOString(),
    adjusted: false
  };
}

function postJson<T>(url: string, body?: unknown): Promise<T> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  }).then(async (response) => {
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Request failed.");
    }
    return payload as T;
  });
}

function patchJson<T>(url: string, body?: unknown): Promise<T> {
  return fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  }).then(async (response) => {
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Request failed.");
    }
    return payload as T;
  });
}

function deleteJson<T>(url: string): Promise<T> {
  return fetch(url, {
    method: "DELETE"
  }).then(async (response) => {
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Request failed.");
    }
    return payload as T;
  });
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function findAccount(data: DashboardData, id: string) {
  return data.xAccounts.find((account) => account.id === id);
}

function findPersona(data: DashboardData, id: string) {
  return data.personas.find((persona) => persona.id === id);
}

function findSource(data: DashboardData, id?: string) {
  return data.sourcePosts.find((source) => source.id === id);
}

function findScheduledPostForDraft(data: DashboardData, draftId: string) {
  return data.scheduledPosts.find((post) => post.draftPostId === draftId);
}

function postCountLabel(count: number) {
  return `${count} ${count > 1 ? "posts" : "post"}`;
}

function listFromText(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hashtagsFromText(value: string) {
  return listFromText(value).map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
}

function materialTypeLabel(type: CompanyMaterialType) {
  return type
    .toLowerCase()
    .split("_")
    .map((item) => item[0].toUpperCase() + item.slice(1))
    .join(" ");
}

function findCompanyInformationMaterial(materials: CompanyMaterial[]) {
  return (
    materials.find((material) => material.notes === COMPANY_INFORMATION_NOTE) ??
    materials.find((material) => material.title === COMPANY_INFORMATION_TITLE)
  );
}

function sectionValue(content: string, heading: string) {
  const pattern = new RegExp(`${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n([\\s\\S]*?)(?=\\n\\n[A-Z][^\\n]+\\n|$)`, "i");
  return content.match(pattern)?.[1]?.trim() ?? "";
}

function parseCompanyInformation(material?: CompanyMaterial): CompanyInformationInput {
  if (!material) {
    return EMPTY_COMPANY_INFORMATION;
  }

  return {
    companyName: sectionValue(material.content, "Company Name"),
    productName: sectionValue(material.content, "Product Name"),
    industry: sectionValue(material.content, "Industry"),
    productService: sectionValue(material.content, "Product / Service"),
    positioning: sectionValue(material.content, "Positioning"),
    competitiveAdvantage: sectionValue(material.content, "Competitive Advantage")
  };
}

function formatCompanyInformation(input: CompanyInformationInput) {
  return [
    ["Company Name", input.companyName],
    ["Product Name", input.productName],
    ["Industry", input.industry],
    ["Product / Service", input.productService],
    ["Positioning", input.positioning],
    ["Competitive Advantage", input.competitiveAdvantage]
  ]
    .map(([heading, value]) => `${heading}\n${value.trim()}`)
    .join("\n\n");
}

export function DashboardShell({ mode = "console" }: DashboardShellProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [generationBrief, setGenerationBrief] = useState("");
  const [draftCandidates, setDraftCandidates] = useState<GeneratedDraftCandidate[]>([]);
  const [selectedWeeklyInputIds, setSelectedWeeklyInputIds] = useState<string[]>([]);
  const [deviceTimeZone, setDeviceTimeZone] = useState("UTC");
  const [scheduleTimeZone, setScheduleTimeZone] = useState("UTC");
  const [scheduleTime, setScheduleTime] = useState(() => defaultScheduleTime("UTC"));
  const [scheduleTimeTouched, setScheduleTimeTouched] = useState(false);
  const [notice, setNotice] = useState("Ready");
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [isPending, startTransition] = useTransition();
  const initialHashScrollDoneRef = useRef(false);

  const refresh = () => {
    startTransition(async () => {
      const [next, nextReadiness] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }).then((response) => response.json()),
        fetch("/api/readiness", { cache: "no-store" }).then((response) => response.json())
      ]);
      setData(next);
      setReadiness(nextReadiness);
      setSelectedAccountId((current) => current || next.xAccounts[0]?.id || "");
      setSelectedPersonaId((current) => current || next.xAccounts[0]?.personaId || next.personas[0]?.id || "");
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (mode !== "console") {
      return;
    }

    const intervalId = window.setInterval(() => {
      refresh();
    }, 15_000);

    return () => window.clearInterval(intervalId);
  }, [mode]);

  useEffect(() => {
    const timeZone = getDeviceTimeZone();
    setDeviceTimeZone(timeZone);
    setScheduleTimeZone((current) => (current === "UTC" ? timeZone : current));
    setScheduleTime((current) => (scheduleTimeTouched ? current : defaultScheduleTime(timeZone)));
  }, []);

  useEffect(() => {
    const oauthStatus = new URLSearchParams(window.location.search).get("oauth");
    if (!oauthStatus) {
      return;
    }

    setNotice(
      oauthStatus === "connected"
        ? "X OAuth connected. Personalized trends can use the authorized account."
        : `X OAuth ${oauthStatus}.`
    );
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const selectedAccount = useMemo(
    () => data?.xAccounts.find((account) => account.id === selectedAccountId),
    [data, selectedAccountId]
  );

  const selectedPersona = useMemo(
    () => data?.personas.find((persona) => persona.id === selectedPersonaId),
    [data, selectedPersonaId]
  );
  const accountSetupNeeded = needsAccountSetup(selectedPersona);
  const shouldShowNotice = isPending || notice !== "Ready";

  const selectAccount = (accountId: string) => {
    setSelectedAccountId(accountId);
    setDraftCandidates([]);
    setSelectedWeeklyInputIds([]);
    const account = data?.xAccounts.find((item) => item.id === accountId);
    if (account?.personaId) {
      setSelectedPersonaId(account.personaId);
    }
  };

  const runAction = (label: string, action: () => Promise<unknown>) => {
    startTransition(async () => {
      try {
        setNotice(`${label}...`);
        const result = await action();
        const [next, nextReadiness] = await Promise.all([
          fetch("/api/dashboard", { cache: "no-store" }).then((response) => response.json()),
          fetch("/api/readiness", { cache: "no-store" }).then((response) => response.json())
        ]);
        setData(next);
        setReadiness(nextReadiness);
        setNotice(typeof result === "string" ? result : `${label} complete`);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Action failed.");
      }
    });
  };

  const connectX = () =>
    runAction("OAuth start", async () => {
      const configuredOrigin = new URL(PUBLIC_APP_URL).origin;
      if (window.location.origin !== configuredOrigin) {
        window.location.href = `${configuredOrigin}${window.location.pathname}${window.location.search}${window.location.hash}`;
        return "Opening the OAuth-safe localhost URL. Click Add X Account again after the page reloads.";
      }

      const result = await postJson<{ authorizationUrl: string; configured: boolean }>("/api/x/oauth/start", {
        purpose: "publishing",
        forceLogin: (data?.xAccounts.length ?? 0) > 0
      });
      if (result.configured) {
        window.location.href = result.authorizationUrl;
      } else {
        setNotice("Add X_CLIENT_ID and X_REDIRECT_URI for live X publishing OAuth.");
      }
    });

  const generate = () =>
    runAction("Draft generation", async () => {
      const currentBrief = generationBrief.trim();
      const result = await postJson<{ candidates: GeneratedDraftCandidate[]; model: string }>("/api/drafts/generate", {
        xAccountId: selectedAccountId,
        count: 3,
        generationBrief: currentBrief || undefined,
        weeklyInputIds: selectedWeeklyInputIds,
        previewOnly: true
      });

      setDraftCandidates(result.candidates);

      if (result.candidates.length === 0) {
        return "No draft options created. Change the post brief or background information and try again.";
      }

      return currentBrief
        ? `Generated ${result.candidates.length} draft options from the current post brief. Keep one or more, or regenerate.`
        : `Generated ${result.candidates.length} draft options. Keep one or more, or regenerate.`;
    });

  const keepCandidate = (candidate: GeneratedDraftCandidate) =>
    runAction("Draft selection", async () => {
      await postJson<{ draft: DraftPost }>("/api/drafts/accept", {
        xAccountId: selectedAccountId,
        candidate
      });
      setDraftCandidates((current) => current.filter((item) => item !== candidate));
      return "Saved selected draft to Review Queue. You can keep another option from this batch.";
    });

  const postBriefAsIs = () =>
    runAction("Brief post", async () => {
      await postJson<{ draft: DraftPost }>("/api/drafts/brief", {
        xAccountId: selectedAccountId,
        text: generationBrief.trim(),
        weeklyInputIds: selectedWeeklyInputIds
      });
      setDraftCandidates([]);
      return generationBrief.trim()
        ? "Saved the post brief to Review Queue as approved."
        : "Saved selected weekly input(s) to Review Queue as approved.";
    });

  const approve = (draft: DraftPost) =>
    runAction("Approval", () => postJson(`/api/drafts/${draft.id}/approve`, { comment: "Approved from console" }));

  const updateDraft = (draft: DraftPost, input: { text: string }) =>
    runAction("Draft edit", () => patchJson(`/api/drafts/${draft.id}`, input));

  const updateDraftPublishingAccount = (draft: DraftPost, xAccountId: string) =>
    runAction("Publishing account update", () => patchJson(`/api/drafts/${draft.id}`, { xAccountId }));

  const deleteDraftPost = (draft: DraftPost) =>
    runAction("Draft delete", async () => {
      await deleteJson(`/api/drafts/${draft.id}`);
      setData((current) =>
        current
          ? {
              ...current,
              drafts: current.drafts.filter((item) => item.id !== draft.id)
            }
          : current
      );
      return "Draft deleted from Review Queue.";
    });

  const savePersonaStrategy = (persona: Persona, input: PersonaStrategyInput) =>
    runAction("Account information save", () => patchJson(`/api/personas/${persona.id}`, { ...input, xAccountId: selectedAccountId }));

  const addMaterial = (input: CompanyMaterialInput) =>
    runAction("Company information save", () => postJson("/api/company-materials", input));

  const updateMaterial = (material: CompanyMaterial, input: CompanyMaterialInput) =>
    runAction("Company information update", () => patchJson(`/api/company-materials/${material.id}`, input));

  const deleteMaterial = (material: CompanyMaterial) =>
    runAction("Company information delete", () => deleteJson(`/api/company-materials/${material.id}`));

  const addRoleTemplate = (input: RoleInputTemplateInput) =>
    runAction("Template save", () => postJson("/api/role-input-templates", input));

  const addRoleTemplateFromBrief = (input: RoleInputTemplateBriefInput) =>
    runAction("Template save", () => postJson("/api/role-input-templates/from-brief", input));

  const updateRoleTemplate = (template: RoleInputTemplate, input: RoleInputTemplateInput) =>
    runAction("Template update", () => patchJson(`/api/role-input-templates/${template.id}`, input));

  const deleteRoleTemplate = (template: RoleInputTemplate) =>
    runAction("Template delete", () => deleteJson(`/api/role-input-templates/${template.id}`));

  const addWeeklyInput = (input: WeeklyRoleInputInput) =>
    runAction("Weekly input save", () => postJson("/api/weekly-inputs", input));

  const deleteWeeklyInput = (input: WeeklyRoleInput) =>
    runAction("Weekly input delete", () => {
      setSelectedWeeklyInputIds((current) => current.filter((id) => id !== input.id));
      return deleteJson(`/api/weekly-inputs/${input.id}`);
    });

  const schedule = (draft: DraftPost) =>
    runAction("Scheduling", async () => {
      const resolvedTime = resolveScheduleTime(scheduleTime, scheduleTimeZone);

      if (draft.status !== "APPROVED") {
        await postJson(`/api/drafts/${draft.id}/approve`, { comment: "Approved for scheduling from console" });
      }

      await postJson("/api/scheduled-posts", {
        draftPostId: draft.id,
        xAccountId: draft.xAccountId,
        finalText: draft.text,
        scheduledFor: resolvedTime.isoValue
      });

      return `Scheduling complete (${scheduleTimeZone})`;
    });

  const updateScheduledPostTime = (post: ScheduledPost, value: string, timeZone: string) =>
    runAction("Schedule update", async () => {
      const resolvedTime = resolveScheduleTime(value, timeZone);
      await patchJson(`/api/scheduled-posts/${post.id}`, {
        scheduledFor: resolvedTime.isoValue
      });
      return `Schedule updated (${timeZone})`;
    });

  const cancelScheduledPost = (post: ScheduledPost) =>
    runAction("Schedule cancel", async () => {
      await deleteJson(`/api/scheduled-posts/${post.id}`);
      return "Schedule canceled. The draft is back in Approved.";
    });

  const approveInteraction = (interaction: InteractionSuggestion) =>
    runAction("Interaction review", () => postJson(`/api/interactions/${interaction.id}/approve`));

  useEffect(() => {
    const scrollToHash = () => {
      const targetId = window.location.hash.replace("#", "");
      if (!targetId) {
        return;
      }
      window.requestAnimationFrame(() => {
        document.getElementById(targetId)?.scrollIntoView({ block: "start" });
      });
    };

    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  useEffect(() => {
    if (!data || initialHashScrollDoneRef.current) {
      return;
    }

    initialHashScrollDoneRef.current = true;
    const timeoutId = window.setTimeout(() => {
      const targetId = window.location.hash.replace("#", "");
      if (!targetId) {
        return;
      }
      document.getElementById(targetId)?.scrollIntoView({ block: "start" });
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [data]);

  if (!data) {
    return (
      <main className="app-shell loading-shell">
        <div className="loader-line">
          <RefreshCw className="spin" size={18} />
          <span>Loading console</span>
        </div>
      </main>
    );
  }

  if (mode === "background") {
    return (
      <AppFrame mode="background">
        <header className="topbar">
          <div>
            <h1>Setup</h1>
          </div>
          <div className="topbar-actions">
            <Link className="icon-button secondary" href="/">
              <ArrowLeft size={17} />
              Back to Console
            </Link>
          </div>
        </header>

        <section className="background-selector account-only-selector">
          <label>
            <span>Account</span>
            <CustomSelect
              value={selectedAccountId}
              onChange={selectAccount}
              ariaLabel="Account"
              options={data.xAccounts.map((account) => ({
                value: account.id,
                label: `@${account.username} · ${account.kind.toLowerCase()}`
              }))}
            />
          </label>
        </section>

        <section className="background-page-grid">
          <StrategyPanel
            data={data}
            selectedAccount={selectedAccount}
            selectedPersona={selectedPersona}
            onSavePersona={savePersonaStrategy}
            onAddMaterial={addMaterial}
            onUpdateMaterial={updateMaterial}
            onDeleteMaterial={deleteMaterial}
            pending={isPending}
            fullWidth
          />
          <RoleTemplatePanel
            data={data}
            onAddTemplate={addRoleTemplate}
            onUpdateTemplate={updateRoleTemplate}
            onDeleteTemplate={deleteRoleTemplate}
            pending={isPending}
          />
        </section>
      </AppFrame>
    );
  }

  return (
    <AppFrame mode="console">
      <header className="topbar">
        <div>
          <h1>Grow & Brand on X</h1>
        </div>
        <div className="topbar-actions">
          <ReadinessBadge readiness={readiness} />
          <button className="icon-button secondary" onClick={connectX} disabled={isPending}>
            <PlugZap size={17} />
            {data.xAccounts.length > 0 ? "Add Another X Account" : "Connect X"}
          </button>
        </div>
      </header>

      <AccountContextBar
        data={data}
        selectedAccountId={selectedAccountId}
        onSelectAccount={selectAccount}
        selectedAccount={selectedAccount}
        selectedPersona={selectedPersona}
      />

      {readiness && !readiness.canPublishAutomatically ? (
        <ReadinessPanel readiness={readiness} onRefresh={refresh} pending={isPending} />
      ) : null}

      {accountSetupNeeded ? <AccountSetupPrompt selectedAccount={selectedAccount} selectedPersona={selectedPersona} /> : null}

      <section className="top-action-grid" id="workflow">
        <WeeklyInputPanel
          data={data}
          selectedAccount={selectedAccount}
          selectedPersona={selectedPersona}
          selectedWeeklyInputIds={selectedWeeklyInputIds}
          setSelectedWeeklyInputIds={setSelectedWeeklyInputIds}
          onAddWeeklyInput={addWeeklyInput}
          onDeleteWeeklyInput={deleteWeeklyInput}
          onAddTemplateFromBrief={addRoleTemplateFromBrief}
          pending={isPending}
        />
        <DraftPostPanel
          data={data}
          selectedAccountId={selectedAccountId}
          generationBrief={generationBrief}
          setGenerationBrief={setGenerationBrief}
          draftCandidates={draftCandidates}
          selectedWeeklyInputIds={selectedWeeklyInputIds}
          setSelectedWeeklyInputIds={setSelectedWeeklyInputIds}
          scheduleTime={scheduleTime}
          setScheduleTime={(value) => {
            setScheduleTimeTouched(true);
            setScheduleTime(value);
          }}
          scheduleTimeZone={scheduleTimeZone}
          setScheduleTimeZone={setScheduleTimeZone}
          deviceTimeZone={deviceTimeZone}
          onGenerate={generate}
          onKeepCandidate={keepCandidate}
          onPostBriefAsIs={postBriefAsIs}
          accountSetupNeeded={accountSetupNeeded}
          pending={isPending}
        />
      </section>

      {shouldShowNotice ? (
        <div className="notice-row">
          <span className={isPending ? "pulse-dot active" : "pulse-dot"} />
          <span>{notice}</span>
        </div>
      ) : null}

      <section className="dashboard-grid">
        <ReviewQueue
          data={data}
          onApprove={approve}
          onUpdateDraft={updateDraft}
          onChangeDraftAccount={updateDraftPublishingAccount}
          onDeleteDraft={deleteDraftPost}
          onSchedule={schedule}
          scheduleTime={scheduleTime}
          setScheduleTime={(value) => {
            setScheduleTimeTouched(true);
            setScheduleTime(value);
          }}
          scheduleTimeZone={scheduleTimeZone}
          setScheduleTimeZone={setScheduleTimeZone}
          deviceTimeZone={deviceTimeZone}
          pending={isPending}
        />
        <InteractionPanel data={data} onApprove={approveInteraction} pending={isPending} />
        <ContentCalendar
          data={data}
          onUpdateScheduledPost={updateScheduledPostTime}
          onCancelScheduledPost={cancelScheduledPost}
          deviceTimeZone={deviceTimeZone}
          pending={isPending}
        />
      </section>
    </AppFrame>
  );
}

function AccountContextBar({
  data,
  selectedAccountId,
  onSelectAccount,
  selectedAccount,
  selectedPersona
}: {
  data: DashboardData;
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  selectedAccount?: XAccount;
  selectedPersona?: Persona;
}) {
  const roleSummary = getAccountRoleNames(selectedAccount, selectedPersona).join(", ");

  return (
    <section className="account-context-bar">
      <label className="account-highlight-control">
        <span>Account</span>
        <CustomSelect
          value={selectedAccountId}
          onChange={onSelectAccount}
          ariaLabel="Account"
          highlight
          options={data.xAccounts.map((account) => ({
            value: account.id,
            label: `@${account.username} · ${account.kind.toLowerCase()}`
          }))}
        />
      </label>
      <div className="persona-inline">
        <span>Role</span>
        <div className="persona-value-row">
          <strong>{roleSummary || "Not set"}</strong>
        </div>
      </div>
    </section>
  );
}

type CustomSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

function CustomSelect({
  value,
  options,
  onChange,
  disabled,
  ariaLabel,
  highlight
}: {
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel: string;
  highlight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!selectRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className={`custom-select${open ? " open" : ""}${disabled ? " disabled" : ""}${highlight ? " highlight" : ""}`} ref={selectRef}>
      <button
        type="button"
        className="custom-select-button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedOption?.label ?? ""}</span>
        <ChevronDown size={16} />
      </button>
      {open ? (
        <div className="custom-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? "custom-select-option selected" : "custom-select-option"}
              disabled={option.disabled}
              key={option.value}
              onClick={() => {
                if (option.disabled) {
                  return;
                }
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function readinessTone(status: ReadinessStatus) {
  if (status === "READY") {
    return "good";
  }
  if (status === "WARN") {
    return "warn";
  }
  return "bad";
}

function ReadinessBadge({ readiness }: { readiness: ReadinessData | null }) {
  if (!readiness) {
    return (
      <span className="readiness-compact" aria-label="Checking publishing readiness">
        <RefreshCw size={15} className="spin" />
        <Badge tone="neutral">checking</Badge>
      </span>
    );
  }

  const blocked = readiness.checks.filter((item) => item.status === "BLOCKED").length;
  const warnings = readiness.checks.filter((item) => item.status === "WARN").length;
  const tone = readiness.canPublishAutomatically ? "good" : blocked > 0 ? "bad" : "warn";
  const label = readiness.canPublishAutomatically ? "publish ready" : blocked > 0 ? `${blocked} blocked` : `${warnings} warnings`;

  return (
    <span className={`readiness-compact ${tone}`} aria-label="Publishing readiness">
      <ShieldCheck size={15} />
      <span>{label}</span>
    </span>
  );
}

function AccountSetupPrompt({
  selectedAccount,
  selectedPersona
}: {
  selectedAccount?: XAccount;
  selectedPersona?: Persona;
}) {
  return (
    <section className="account-setup-prompt" aria-label="Account setup required">
      <div className="account-setup-main">
        <TriangleAlert size={18} />
        <div className="account-setup-copy">
          <strong>Shape the voice and build a profile worth following.</strong>
          <span>
            Add role, tone, audience, and content pillars so {selectedAccount ? `@${selectedAccount.username}` : "this account"} can draft sharper posts that attract the right people.
          </span>
        </div>
      </div>
      <div className="account-setup-actions">
        <Link className="icon-button compact accent" href="/background">
          <FileText size={16} />
          Set Identity
        </Link>
      </div>
    </section>
  );
}

function ReadinessPanel({
  readiness,
  onRefresh,
  pending
}: {
  readiness: ReadinessData | null;
  onRefresh: () => void;
  pending: boolean;
}) {
  const blocked = readiness?.checks.filter((item) => item.status === "BLOCKED").length ?? 0;
  const warnings = readiness?.checks.filter((item) => item.status === "WARN").length ?? 0;
  const headline = readiness
    ? readiness.canPublishAutomatically
      ? "Real publishing is ready"
      : blocked > 0
        ? "Real publishing is blocked"
        : "Real publishing needs attention"
    : "Checking real-mode readiness";

  return (
    <section className="readiness-panel" aria-label="Real mode readiness">
      <div className="readiness-summary">
        <div className="readiness-heading">
          <ShieldCheck size={17} />
          <div>
            <strong>{headline}</strong>
            <span>
              {readiness
                ? `${readiness.mode.toLowerCase()} mode · ${readiness.connectedAccountCount} account${readiness.connectedAccountCount === 1 ? "" : "s"} · ${readiness.workerCount} worker${readiness.workerCount === 1 ? "" : "s"}`
                : "Loading checks"}
            </span>
          </div>
        </div>
        <div className="readiness-actions">
          {readiness ? (
            <>
              <Badge tone={readiness.canPublishAutomatically ? "good" : blocked > 0 ? "bad" : "warn"}>
                {readiness.canPublishAutomatically ? "publish ready" : `${blocked} blocked`}
              </Badge>
              <Badge tone={warnings > 0 ? "warn" : "neutral"}>{warnings} warnings</Badge>
            </>
          ) : null}
          <button className="icon-button compact secondary" onClick={onRefresh} disabled={pending}>
            <RefreshCw size={15} className={pending ? "spin" : undefined} />
            Refresh
          </button>
        </div>
      </div>

      {readiness ? (
        <div className="readiness-checks">
          {readiness.checks.map((item) => (
            <div className="readiness-check" key={item.id}>
              <Badge tone={readinessTone(item.status)}>{item.status.toLowerCase()}</Badge>
              <div>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="readiness-empty">
          <RefreshCw className="spin" size={16} />
          <span>Checking Postgres, Redis, worker, and X credentials</span>
        </div>
      )}

      {readiness ? (
        <div className="readiness-queue">
          <span>Queue</span>
          <strong>{readiness.queuedPublishJobs}</strong>
          <span>waiting</span>
          <strong>{readiness.delayedPublishJobs}</strong>
          <span>scheduled</span>
          <strong>{readiness.failedPublishJobs}</strong>
          <span>failed</span>
        </div>
      ) : null}
    </section>
  );
}

function WeeklyInputPanel({
  data,
  selectedAccount,
  selectedPersona,
  selectedWeeklyInputIds,
  setSelectedWeeklyInputIds,
  onAddWeeklyInput,
  onDeleteWeeklyInput,
  onAddTemplateFromBrief,
  pending
}: {
  data: DashboardData;
  selectedAccount?: XAccount;
  selectedPersona?: Persona;
  selectedWeeklyInputIds: string[];
  setSelectedWeeklyInputIds: (ids: string[]) => void;
  onAddWeeklyInput: (input: WeeklyRoleInputInput) => void;
  onDeleteWeeklyInput: (input: WeeklyRoleInput) => void;
  onAddTemplateFromBrief: (input: RoleInputTemplateBriefInput) => void;
  pending: boolean;
}) {
  const activeTemplates = useMemo(() => data.roleInputTemplates.filter((template) => template.isActive), [data.roleInputTemplates]);
  const accountRoleNames = useMemo(
    () => getEditableAccountRoleNames(selectedAccount, selectedPersona),
    [selectedAccount, selectedPersona]
  );
  const [roleName, setRoleName] = useState(accountRoleNames[0] ?? "");
  const templatesForRole = activeTemplates.filter((template) => template.roleName === roleName);
  const [templateId, setTemplateId] = useState(templatesForRole[0]?.id ?? "");
  const accountWeeklyInputs = data.weeklyInputs.filter((input) => input.xAccountId === selectedAccount?.id);
  const [weekOf, setWeekOf] = useState(currentWeekOf);
  const [content, setContent] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [isAddingType, setIsAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeAbout, setNewTypeAbout] = useState("");
  const [pendingNewTypeName, setPendingNewTypeName] = useState<string | null>(null);
  const selectedTemplate = activeTemplates.find((template) => template.id === templateId);

  useEffect(() => {
    if (accountRoleNames.length > 0 && !accountRoleNames.includes(roleName)) {
      setRoleName(accountRoleNames[0]);
    } else if (accountRoleNames.length === 0 && roleName) {
      setRoleName("");
    }
  }, [accountRoleNames, roleName]);

  useEffect(() => {
    const nextTemplates = activeTemplates.filter((template) => template.roleName === roleName);
    if (nextTemplates.length > 0 && !nextTemplates.some((template) => template.id === templateId)) {
      setTemplateId(nextTemplates[0].id);
    } else if (nextTemplates.length === 0 && templateId) {
      setTemplateId("");
    }
  }, [activeTemplates, roleName, templateId]);

  useEffect(() => {
    if (!pendingNewTypeName) {
      return;
    }
    const newTemplate = activeTemplates.find(
      (template) => template.roleName === roleName && template.contentType === pendingNewTypeName
    );
    if (newTemplate) {
      setTemplateId(newTemplate.id);
      setPendingNewTypeName(null);
    }
  }, [activeTemplates, pendingNewTypeName, roleName]);

  const resetNewTypeForm = () => {
    setIsAddingType(false);
    setNewTypeName("");
    setNewTypeAbout("");
  };

  const saveNewType = () => {
    const contentType = newTypeName.trim();
    const about = newTypeAbout.trim();
    if (!roleName || !contentType || !about) {
      return;
    }

    onAddTemplateFromBrief({
      roleName,
      contentType,
      about,
      isActive: true
    });
    setPendingNewTypeName(contentType);
    resetNewTypeForm();
  };

  const saveInput = () => {
    if (!selectedAccount || !templateId || !content.trim()) {
      return;
    }

    onAddWeeklyInput({
      xAccountId: selectedAccount.id,
      roleInputTemplateId: templateId,
      content: content.trim(),
      evidenceUrl: evidenceUrl.trim() || undefined,
      weekOf
    });
    setContent("");
    setEvidenceUrl("");
  };

  const toggleWeeklyInput = (inputId: string) => {
    setSelectedWeeklyInputIds(
      selectedWeeklyInputIds.includes(inputId)
        ? selectedWeeklyInputIds.filter((id) => id !== inputId)
        : [...selectedWeeklyInputIds, inputId]
    );
  };

  return (
    <section className="panel top-action-panel weekly-input-panel">
      <div className="panel-title">
        <div>
          <Users2 size={18} />
          <h2>Collect Weekly Inputs</h2>
        </div>
        <Link className="icon-button compact" href="/background#weekly-input-templates">
          <FileText size={16} />
          Edit Input Templates
        </Link>
      </div>
      <div className="weekly-input-form">
        <label className="weekly-role-control">
          <span>Role</span>
          <CustomSelect
            value={roleName}
            onChange={(value) => {
              setRoleName(value);
              setIsAddingType(false);
            }}
            ariaLabel="Role"
            disabled={accountRoleNames.length === 0}
            options={
              accountRoleNames.length === 0
                ? [{ value: "", label: "Add a role first" }]
                : accountRoleNames.map((role) => ({ value: role, label: role }))
            }
          />
        </label>
        <label>
          <span>Week of</span>
          <input type="date" value={weekOf} onChange={(event) => setWeekOf(event.target.value)} />
        </label>
        <div className="weekly-type-control field-block">
          <span>Type of Input</span>
          <CustomSelect
            value={isAddingType ? ADD_NEW_TYPE_VALUE : templateId}
            onChange={(value) => {
              if (value === ADD_NEW_TYPE_VALUE) {
                setIsAddingType(true);
                return;
              }
              setIsAddingType(false);
              setTemplateId(value);
            }}
            ariaLabel="Type of Input"
            disabled={templatesForRole.length === 0 && !roleName}
            options={[
              ...templatesForRole.map((template) => ({ value: template.id, label: template.contentType })),
              { value: ADD_NEW_TYPE_VALUE, label: "+ Add New Type" }
            ]}
          />
        </div>
        {isAddingType ? (
          <div className="inline-template-form">
            <label>
              <span>New type</span>
              <input
                value={newTypeName}
                onChange={(event) => setNewTypeName(event.target.value)}
                placeholder="Launch lesson, pricing signal..."
              />
            </label>
            <label>
              <span>What specific information or question is it about</span>
              <textarea
                value={newTypeAbout}
                onChange={(event) => setNewTypeAbout(event.target.value)}
                placeholder="Example: what roadmap tradeoff became clearer this week, and what user signal changed your mind?"
              />
            </label>
            <div className="inline-template-actions">
              <button className="icon-button compact accent" disabled={pending || !newTypeName.trim() || !newTypeAbout.trim()} onClick={saveNewType}>
                <Plus size={15} />
                Save Type
              </button>
              <button className="icon-button compact secondary" disabled={pending} onClick={resetNewTypeForm}>
                <XIcon size={15} />
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        <label className="weekly-input-content">
          <span>Raw input</span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={selectedTemplate?.prompt ?? "What happened this week?"}
          />
          {selectedTemplate?.example ? <small>Example: {selectedTemplate.example}</small> : null}
        </label>
        <label className="weekly-evidence-control">
          <span>Evidence URL</span>
          <input value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="Optional" />
        </label>
        <button className="icon-button accent save-input-button" disabled={pending || !selectedAccount || !templateId || !content.trim()} onClick={saveInput}>
          <Plus size={16} />
          Save Input
        </button>
      </div>

      <div className="weekly-input-list">
        {accountWeeklyInputs.slice(0, 5).map((input) => (
          <article className="weekly-input-card" key={input.id}>
            <div>
              <strong>
                {input.roleName} · {input.contentType}
              </strong>
              <span>{input.weekOf}</span>
            </div>
            <p>{input.content}</p>
            <div className="weekly-input-actions">
              <button className="icon-button compact secondary" disabled={pending} onClick={() => toggleWeeklyInput(input.id)}>
                <CheckCircle2 size={15} />
                {selectedWeeklyInputIds.includes(input.id) ? "Selected" : "Use"}
              </button>
              <button className="icon-button compact subtle-danger" disabled={pending} onClick={() => onDeleteWeeklyInput(input)}>
                <Trash2 size={15} />
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DraftPostPanel({
  data,
  selectedAccountId,
  generationBrief,
  setGenerationBrief,
  draftCandidates,
  selectedWeeklyInputIds,
  setSelectedWeeklyInputIds,
  scheduleTime,
  setScheduleTime,
  scheduleTimeZone,
  setScheduleTimeZone,
  deviceTimeZone,
  onGenerate,
  onKeepCandidate,
  onPostBriefAsIs,
  accountSetupNeeded,
  pending
}: {
  data: DashboardData;
  selectedAccountId: string;
  generationBrief: string;
  setGenerationBrief: (value: string) => void;
  draftCandidates: GeneratedDraftCandidate[];
  selectedWeeklyInputIds: string[];
  setSelectedWeeklyInputIds: (ids: string[]) => void;
  scheduleTime: string;
  setScheduleTime: (value: string) => void;
  scheduleTimeZone: string;
  setScheduleTimeZone: (value: string) => void;
  deviceTimeZone: string;
  onGenerate: () => void;
  onKeepCandidate: (candidate: GeneratedDraftCandidate) => void;
  onPostBriefAsIs: () => void;
  accountSetupNeeded: boolean;
  pending: boolean;
}) {
  const recentWeeklyInputs = data.weeklyInputs.filter((input) => input.xAccountId === selectedAccountId).slice(0, 8);
  const toggleWeeklyInput = (inputId: string) => {
    setSelectedWeeklyInputIds(
      selectedWeeklyInputIds.includes(inputId)
        ? selectedWeeklyInputIds.filter((id) => id !== inputId)
        : [...selectedWeeklyInputIds, inputId]
    );
  };

  return (
    <section className="panel top-action-panel draft-post-panel">
      <div className="panel-title">
        <div>
          <Sparkles size={18} />
          <h2>Draft Your Post</h2>
        </div>
        <Link className="icon-button compact" href="/background">
          <FileText size={16} />
          Edit Account Information
        </Link>
      </div>

      <div className="draft-controls">
        <label className="schedule-control">
          <span>Schedule time</span>
          <input type="datetime-local" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} />
        </label>
        <label className="time-zone-control">
          <span>Time zone</span>
          <CustomSelect
            value={scheduleTimeZone}
            onChange={setScheduleTimeZone}
            ariaLabel="Time zone"
            options={getTimeZoneOptions(deviceTimeZone, scheduleTimeZone).map((timeZone) => ({
              value: timeZone,
              label: timeZoneLabel(timeZone)
            }))}
          />
        </label>
        <label className="brief-control">
          <span>Post brief</span>
          <textarea
            value={generationBrief}
            onChange={(event) => setGenerationBrief(event.target.value)}
            placeholder="(Optional)"
          />
        </label>
      </div>
      <div className="weekly-source-picker">
        <div className="section-subhead">
          <div>
            <FileText size={16} />
            <strong>Use weekly inputs</strong>
          </div>
          <span>{selectedWeeklyInputIds.length} selected</span>
        </div>
        {recentWeeklyInputs.length > 0 ? (
          <div className="weekly-source-list">
            {recentWeeklyInputs.map((input) => (
              <label className="weekly-source-card" key={input.id}>
                <input
                  type="checkbox"
                  checked={selectedWeeklyInputIds.includes(input.id)}
                  onChange={() => toggleWeeklyInput(input.id)}
                />
                <div>
                  <strong>
                    {input.roleName} · {input.contentType}
                  </strong>
                  <span>{input.content}</span>
                </div>
              </label>
            ))}
          </div>
        ) : (
          <div className="empty-inline">No weekly inputs yet.</div>
        )}
      </div>
      {accountSetupNeeded ? (
        <div className="draft-gate-note">
          <TriangleAlert size={15} />
          <span>Complete account identity first so generated posts sound distinct, relevant, and worth following.</span>
        </div>
      ) : null}
      <div className="draft-submit-row">
        <button className="icon-button secondary" onClick={onPostBriefAsIs} disabled={pending || accountSetupNeeded}>
          <FileText size={17} />
          Post as is
        </button>
        <button className="icon-button accent" onClick={onGenerate} disabled={pending || accountSetupNeeded}>
          <Sparkles size={17} />
          {draftCandidates.length > 0 ? "Regenerate" : "Generate"}
        </button>
      </div>
      {draftCandidates.length > 0 ? (
        <div className="candidate-list">
          {draftCandidates.map((candidate, index) => (
            <article className="candidate-card" key={`${candidate.text}-${index}`}>
              <div className="candidate-head">
                <strong>Option {index + 1}</strong>
                <Badge tone={candidate.riskLevel === "LOW" ? "good" : candidate.riskLevel === "MEDIUM" ? "warn" : "bad"}>
                  {candidate.riskLevel.toLowerCase()} risk
                </Badge>
              </div>
              <p>{candidate.text}</p>
              <div className="candidate-footer">
                <span>{candidate.text.length}/280</span>
                <button className="icon-button compact accent" disabled={pending} onClick={() => onKeepCandidate(candidate)}>
                  <CheckCircle2 size={16} />
                  Keep
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ReviewQueue({
  data,
  onApprove,
  onUpdateDraft,
  onChangeDraftAccount,
  onDeleteDraft,
  onSchedule,
  scheduleTime,
  setScheduleTime,
  scheduleTimeZone,
  setScheduleTimeZone,
  deviceTimeZone,
  pending
}: {
  data: DashboardData;
  onApprove: (draft: DraftPost) => void;
  onUpdateDraft: (draft: DraftPost, input: { text: string }) => void;
  onChangeDraftAccount: (draft: DraftPost, xAccountId: string) => void;
  onDeleteDraft: (draft: DraftPost) => void;
  onSchedule: (draft: DraftPost) => void;
  scheduleTime: string;
  setScheduleTime: (value: string) => void;
  scheduleTimeZone: string;
  setScheduleTimeZone: (value: string) => void;
  deviceTimeZone: string;
  pending: boolean;
}) {
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [changingAccountDraftId, setChangingAccountDraftId] = useState<string | null>(null);
  const [schedulingDraftId, setSchedulingDraftId] = useState<string | null>(null);
  const [draftPendingDelete, setDraftPendingDelete] = useState<DraftPost | null>(null);
  const [editText, setEditText] = useState("");

  const startEdit = (draft: DraftPost) => {
    setEditingDraftId(draft.id);
    setChangingAccountDraftId(null);
    setSchedulingDraftId(null);
    setDraftPendingDelete(null);
    setEditText(draft.text);
  };

  const saveEdit = (draft: DraftPost) => {
    onUpdateDraft(draft, { text: editText });
    setEditingDraftId(null);
  };

  const changeDraftAccount = (draft: DraftPost, xAccountId: string) => {
    setChangingAccountDraftId(null);
    setSchedulingDraftId(null);
    setDraftPendingDelete(null);
    if (xAccountId !== draft.xAccountId) {
      onChangeDraftAccount(draft, xAccountId);
    }
  };

  const openScheduleForm = (draft: DraftPost) => {
    setEditingDraftId(null);
    setChangingAccountDraftId(null);
    setDraftPendingDelete(null);
    setSchedulingDraftId((current) => (current === draft.id ? null : draft.id));
  };

  const openApprovalSchedule = (draft: DraftPost) => {
    setEditingDraftId(null);
    setChangingAccountDraftId(null);
    setDraftPendingDelete(null);
    setSchedulingDraftId(draft.id);
  };

  const confirmDeleteDraft = () => {
    if (!draftPendingDelete) {
      return;
    }
    onDeleteDraft(draftPendingDelete);
    setDraftPendingDelete(null);
  };

  const reviewGroups = [
    {
      title: "Needs Review",
      tone: "needs-review",
      drafts: data.drafts.filter((draft) => draft.status === "CANDIDATE" || draft.status === "NEEDS_REVIEW")
    },
    {
      title: "Approved",
      tone: "approved",
      drafts: data.drafts.filter((draft) => draft.status === "APPROVED")
    }
  ].map((group) => ({
    ...group,
    drafts: group.drafts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }));
  const reviewDraftCount = reviewGroups.reduce((total, group) => total + group.drafts.length, 0);
  const reviewDraftMeta = `${reviewDraftCount} ${reviewDraftCount === 1 ? "draft" : "drafts"}`;
  const deleteAccount = draftPendingDelete ? findAccount(data, draftPendingDelete.xAccountId) : undefined;

  return (
    <section className="panel span-6" id="review-queue">
      <PanelTitle icon={<CheckCircle2 size={18} />} title="Review Queue" meta={reviewDraftMeta} />
      <div className="review-groups">
        {reviewGroups.map((group) => (
          <div className="review-group" key={group.title}>
            <div className={`review-group-head ${group.tone}`}>
              <div className="review-group-label">
                {group.tone === "needs-review" ? <TriangleAlert size={14} /> : <CheckCircle2 size={14} />}
                <strong>{group.title}</strong>
              </div>
              <span>{group.drafts.length}</span>
            </div>
            {group.drafts.length > 0 ? (
              <div className="draft-list">
                {group.drafts.map((draft) => {
                  const account = findAccount(data, draft.xAccountId);
                  const persona = findPersona(data, draft.personaId);
                  const accountRoles = persona ? getAccountRoleNames(account, persona).join(", ") : "Role";
                  const isEditing = editingDraftId === draft.id;
                  const isScheduling = schedulingDraftId === draft.id;
                  const canEdit = ["CANDIDATE", "NEEDS_REVIEW", "APPROVED"].includes(draft.status);
                  const canDelete = draft.status !== "SCHEDULED" && draft.status !== "PUBLISHED";
                  return (
                    <article className="draft-card" key={draft.id}>
                      <div className="draft-head">
                        <div>
                          <div className="draft-account-line">
                            <strong>@{account?.username ?? "unknown"}</strong>
                          </div>
                          <span>{accountRoles}</span>
                        </div>
                        {!isEditing && canEdit ? (
                          <button
                            className="change-account-button"
                            disabled={pending}
                            onClick={() =>
                              setChangingAccountDraftId((current) => (current === draft.id ? null : draft.id))
                            }
                          >
                            Change Account
                          </button>
                        ) : null}
                      </div>
                      {!isEditing && canEdit && changingAccountDraftId === draft.id ? (
                        <div className="draft-account-picker">
                          <CustomSelect
                            value={draft.xAccountId}
                            onChange={(value) => changeDraftAccount(draft, value)}
                            ariaLabel="Publishing account"
                            disabled={pending}
                            options={data.xAccounts.map((item) => ({
                              value: item.id,
                              label: `@${item.username} · ${item.kind.toLowerCase()}`
                            }))}
                          />
                          <button
                            className="change-account-cancel"
                            disabled={pending}
                            onClick={() => setChangingAccountDraftId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : null}
                      {isEditing ? (
                        <div className="draft-edit-form">
                          <label>
                            <span>Draft text</span>
                            <textarea
                              className="draft-textarea"
                              maxLength={280}
                              value={editText}
                              onChange={(event) => setEditText(event.target.value)}
                            />
                          </label>
                          <div className="draft-edit-footer">
                            <span>{editText.length}/280</span>
                            <div className="button-row">
                              <button
                                className="icon-button compact accent"
                                disabled={pending || !editText.trim() || editText.length > 280}
                                onClick={() => saveEdit(draft)}
                              >
                                <Save size={16} />
                                Save
                              </button>
                              <button
                                className="icon-button compact secondary"
                                disabled={pending}
                                onClick={() => setEditingDraftId(null)}
                              >
                                <XIcon size={16} />
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p>{draft.text}</p>
                      )}
                      {!isEditing ? (
                        <div className="button-row">
                          {canEdit ? (
                            <button className="icon-button compact secondary" disabled={pending} onClick={() => startEdit(draft)}>
                              <Pencil size={16} />
                              Edit
                            </button>
                          ) : null}
                          {draft.status !== "APPROVED" ? (
                            <button
                              className="icon-button compact accent"
                              disabled={pending}
                              onClick={() => openApprovalSchedule(draft)}
                            >
                              <CheckCircle2 size={16} />
                              Approve
                            </button>
                          ) : null}
                          {draft.status === "APPROVED" && !isScheduling ? (
                            <button
                              className="icon-button compact accent"
                              disabled={pending}
                              onClick={() => openScheduleForm(draft)}
                            >
                              <CalendarPlus size={16} />
                              Schedule
                            </button>
                          ) : null}
                          {canDelete ? (
                            <button
                              className="icon-button compact subtle-danger"
                              disabled={pending}
                              onClick={() => setDraftPendingDelete(draft)}
                            >
                              <Trash2 size={16} />
                              Delete
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {!isEditing && isScheduling ? (
                        <div className="draft-schedule-form">
                          <div className="draft-schedule-fields">
                            <label>
                              <span>Schedule time</span>
                              <input
                                type="datetime-local"
                                value={scheduleTime}
                                onChange={(event) => setScheduleTime(event.target.value)}
                              />
                            </label>
                            <label>
                              <span>Time zone</span>
                              <CustomSelect
                                value={scheduleTimeZone}
                                onChange={setScheduleTimeZone}
                                ariaLabel="Time zone"
                                options={getTimeZoneOptions(deviceTimeZone, scheduleTimeZone).map((timeZone) => ({
                                  value: timeZone,
                                  label: timeZoneLabel(timeZone)
                                }))}
                              />
                            </label>
                          </div>
                          <div className="draft-schedule-actions">
                            <button className="icon-button compact accent" disabled={pending} onClick={() => onSchedule(draft)}>
                              <CalendarPlus size={16} />
                              Schedule Post
                            </button>
                            {draft.status !== "APPROVED" ? (
                              <button
                                className="icon-button compact secondary"
                                disabled={pending}
                                onClick={() => {
                                  setSchedulingDraftId(null);
                                  onApprove(draft);
                                }}
                              >
                                <CheckCircle2 size={16} />
                                Approve only
                              </button>
                            ) : null}
                            <button
                              className="icon-button compact secondary"
                              disabled={pending}
                              onClick={() => setSchedulingDraftId(null)}
                            >
                              <XIcon size={16} />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="review-group-empty">No drafts in this group.</div>
            )}
          </div>
        ))}
      </div>
      <DraftDeleteDialog
        draft={draftPendingDelete}
        accountUsername={deleteAccount?.username}
        pending={pending}
        onCancel={() => setDraftPendingDelete(null)}
        onConfirm={confirmDeleteDraft}
      />
    </section>
  );
}

function DraftDeleteDialog({
  draft,
  accountUsername,
  pending,
  onCancel,
  onConfirm
}: {
  draft: DraftPost | null;
  accountUsername?: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!draft) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-draft-title">
        <div className="confirm-dialog-icon danger">
          <Trash2 size={19} />
        </div>
        <div className="confirm-dialog-copy">
          <h3 id="delete-draft-title">Delete this draft?</h3>
          <p>
            Remove this post from Review Queue
            {accountUsername ? ` for @${accountUsername}` : ""}. This will not affect anything already scheduled or published.
          </p>
        </div>
        <div className="confirm-dialog-preview">{draft.text}</div>
        <div className="confirm-dialog-actions">
          <button className="icon-button secondary" disabled={pending} onClick={onCancel}>
            <XIcon size={16} />
            Cancel
          </button>
          <button className="icon-button danger" disabled={pending} onClick={onConfirm}>
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function ContentCalendar({
  data,
  onUpdateScheduledPost,
  onCancelScheduledPost,
  deviceTimeZone,
  pending
}: {
  data: DashboardData;
  onUpdateScheduledPost: (post: ScheduledPost, value: string, timeZone: string) => void;
  onCancelScheduledPost: (post: ScheduledPost) => void;
  deviceTimeZone: string;
  pending: boolean;
}) {
  const scheduledAccountGroups = data.xAccounts.map((account) => ({
    account,
    persona: account.personaId ? findPersona(data, account.personaId) : undefined,
    posts: data.scheduledPosts
      .filter((post) => post.xAccountId === account.id && ["QUEUED", "PUBLISHING", "FAILED"].includes(post.status))
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
  }));
  const publishedPosts = data.scheduledPosts
    .filter((post) => post.status === "PUBLISHED")
    .sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime())
    .slice(0, 12);

  return (
    <>
      <section className="panel span-12" id="scheduled-posts">
        <PanelTitle icon={<Clock3 size={18} />} title="Scheduled Posts" meta={`${data.xAccounts.length} accounts`} />
        <div className="calendar-account-list">
          {scheduledAccountGroups.map(({ account, persona, posts }) => (
            <ScheduledAccountTimeline
              key={account.id}
              account={account}
              persona={persona}
              posts={posts}
              onUpdateScheduledPost={onUpdateScheduledPost}
              onCancelScheduledPost={onCancelScheduledPost}
              deviceTimeZone={deviceTimeZone}
              pending={pending}
            />
          ))}
        </div>
      </section>
      <section className="panel span-12" id="published-posts">
        <PanelTitle
          icon={<CheckCircle2 size={18} />}
          title="Published Posts"
          meta={`${publishedPosts.length} ${publishedPosts.length === 1 ? "post" : "posts"}`}
        />
        {publishedPosts.length > 0 ? (
          <div className="published-post-grid">
            {publishedPosts.map((post) => (
              <PublishedPostCard key={post.id} post={post} account={findAccount(data, post.xAccountId)} />
            ))}
          </div>
        ) : (
          <div className="empty-inline">No published posts yet.</div>
        )}
      </section>
    </>
  );
}

function ScheduledAccountTimeline({
  account,
  persona,
  posts,
  onUpdateScheduledPost,
  onCancelScheduledPost,
  deviceTimeZone,
  pending
}: {
  account: XAccount;
  persona?: Persona;
  posts: ScheduledPost[];
  onUpdateScheduledPost: (post: ScheduledPost, value: string, timeZone: string) => void;
  onCancelScheduledPost: (post: ScheduledPost) => void;
  deviceTimeZone: string;
  pending: boolean;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [scrollState, setScrollState] = useState({ canScrollLeft: false, canScrollRight: false });

  const updateScrollState = () => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const maxScrollLeft = track.scrollWidth - track.clientWidth;
    setScrollState({
      canScrollLeft: track.scrollLeft > 4,
      canScrollRight: track.scrollLeft < maxScrollLeft - 4
    });
  };

  useEffect(() => {
    updateScrollState();
    const track = trackRef.current;
    if (!track) {
      return;
    }

    track.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      track.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [posts.length]);

  const scrollTimeline = (direction: -1 | 1) => {
    trackRef.current?.scrollBy({ left: direction * 340, behavior: "smooth" });
    window.setTimeout(updateScrollState, 360);
  };

  return (
    <article className="calendar-account-section">
      <div className="calendar-account-head">
        <div>
          <strong>@{account.username}</strong>
          <span>
            {persona ? getAccountRoleNames(account, persona).join(", ") : account.kind.toLowerCase()}
          </span>
        </div>
        <Badge tone={posts.length > 0 ? "info" : "neutral"}>{postCountLabel(posts.length)}</Badge>
      </div>
      <div className="calendar-timeline-wrap">
        <div className="calendar-timeline" ref={trackRef}>
          {posts.length > 0
            ? posts.map((post) => (
                <CalendarItem
                  key={post.id}
                  post={post}
                  onUpdateScheduledPost={onUpdateScheduledPost}
                  onCancelScheduledPost={onCancelScheduledPost}
                  deviceTimeZone={deviceTimeZone}
                  pending={pending}
                />
              ))
            : <div className="calendar-empty-strip" aria-hidden="true" />}
        </div>
        {posts.length > 0 ? (
          <>
            <button
              className="calendar-scroll-button left"
              disabled={!scrollState.canScrollLeft}
              onClick={() => scrollTimeline(-1)}
              aria-label={`Scroll ${account.username} scheduled posts left`}
            >
              <ArrowLeft size={16} />
            </button>
            <button
              className="calendar-scroll-button right"
              disabled={!scrollState.canScrollRight}
              onClick={() => scrollTimeline(1)}
              aria-label={`Scroll ${account.username} scheduled posts right`}
            >
              <ArrowRight size={16} />
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

function CalendarItem({
  post,
  onUpdateScheduledPost,
  onCancelScheduledPost,
  deviceTimeZone,
  pending
}: {
  post: ScheduledPost;
  onUpdateScheduledPost: (post: ScheduledPost, value: string, timeZone: string) => void;
  onCancelScheduledPost: (post: ScheduledPost) => void;
  deviceTimeZone: string;
  pending: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTimeZone, setEditTimeZone] = useState(deviceTimeZone);
  const [editTime, setEditTime] = useState(() => editableScheduleTime(post.scheduledFor, deviceTimeZone));
  const canChangeSchedule = ["QUEUED", "FAILED"].includes(post.status);

  useEffect(() => {
    if (!isEditing) {
      setEditTimeZone(deviceTimeZone);
      setEditTime(editableScheduleTime(post.scheduledFor, deviceTimeZone));
    }
  }, [deviceTimeZone, isEditing, post.scheduledFor]);

  return (
    <article className="calendar-card">
      <div className="calendar-card-head">
        <strong>{formatTime(post.scheduledFor)}</strong>
        <Badge tone={statusTone[post.status]}>{post.status}</Badge>
      </div>
      <p>{post.finalText}</p>
      {post.status === "FAILED" && post.lastError ? (
        <div className="calendar-error">
          <strong>Publish failed</strong>
          <span>{post.lastError}</span>
        </div>
      ) : null}
      {canChangeSchedule ? (
        <div className="calendar-card-actions">
          <button className="icon-button compact secondary" disabled={pending} onClick={() => setIsEditing((current) => !current)}>
            <Pencil size={15} />
            Reschedule
          </button>
          <button className="icon-button compact subtle-danger" disabled={pending} onClick={() => onCancelScheduledPost(post)}>
            <XIcon size={15} />
            Cancel
          </button>
        </div>
      ) : null}
      {canChangeSchedule && isEditing ? (
        <div className="calendar-edit-form">
          <label>
            <span>Schedule time</span>
            <input type="datetime-local" value={editTime} onChange={(event) => setEditTime(event.target.value)} />
          </label>
          <label>
            <span>Time zone</span>
            <CustomSelect
              value={editTimeZone}
              onChange={(value) => {
                setEditTimeZone(value);
              }}
              ariaLabel="Scheduled post time zone"
              options={getTimeZoneOptions(deviceTimeZone, editTimeZone).map((timeZone) => ({
                value: timeZone,
                label: timeZoneLabel(timeZone)
              }))}
            />
          </label>
          <div className="button-row">
            <button
              className="icon-button compact accent"
              disabled={pending || !editTime}
              onClick={() => {
                setIsEditing(false);
                onUpdateScheduledPost(post, editTime, editTimeZone);
              }}
            >
              <Save size={15} />
              Save Time
            </button>
            <button className="icon-button compact secondary" disabled={pending} onClick={() => setIsEditing(false)}>
              <XIcon size={15} />
              Close
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function PublishedPostCard({ post, account }: { post: ScheduledPost; account?: XAccount }) {
  const postUrl = post.xPublishedPostId && account ? `https://x.com/${account.username}/status/${post.xPublishedPostId}` : undefined;

  return (
    <article className="published-post-card">
      <div className="published-post-head">
        <div className="published-post-meta">
          <strong>@{account?.username ?? "unknown"}</strong>
          <span>{formatTime(post.scheduledFor)}</span>
        </div>
        <Badge tone="good">PUBLISHED</Badge>
      </div>
      <p>{post.finalText}</p>
      {postUrl ? (
        <a className="icon-button compact secondary published-post-link" href={postUrl} target="_blank" rel="noreferrer">
          View on X
          <ArrowRight size={15} />
        </a>
      ) : null}
    </article>
  );
}

function InteractionPanel({
  data,
  onApprove,
  pending
}: {
  data: DashboardData;
  onApprove: (interaction: InteractionSuggestion) => void;
  pending: boolean;
}) {
  const [reviewingInteractionId, setReviewingInteractionId] = useState<string | null>(null);
  const pendingCount = data.interactions.filter((interaction) => interaction.status === "SUGGESTED").length;

  return (
    <section className="panel span-6" id="interaction-suggestions">
      <PanelTitle
        icon={<MessageSquareQuote size={18} />}
        title="Interaction Suggestions"
        meta={`${pendingCount} pending`}
      />
      <div className="interaction-list">
        {data.interactions.slice(0, 4).map((interaction) => {
          const account = findAccount(data, interaction.xAccountId);
          const source = findSource(data, interaction.sourcePostId);
          const isReviewing = reviewingInteractionId === interaction.id;
          return (
            <article className="interaction-card" key={interaction.id}>
              <div className="draft-head">
                <div>
                  <strong>{interaction.type}</strong>
                  <span>@{account?.username ?? "unknown"} to @{source?.authorUsername ?? "source"}</span>
                </div>
                <Badge tone={statusTone[interaction.status]}>{interaction.status}</Badge>
              </div>
              <p>{interaction.suggestedText}</p>
              {isReviewing ? (
                <div className="interaction-review-box">
                  <div>
                    <strong>Source</strong>
                    <p>{source?.text ?? "Source post unavailable."}</p>
                  </div>
                  <div className="draft-meta">
                    <Badge tone={interaction.riskLevel === "LOW" ? "good" : interaction.riskLevel === "MEDIUM" ? "warn" : "bad"}>
                      {interaction.riskLevel.toLowerCase()} risk
                    </Badge>
                    {interaction.riskReasons.length > 0 ? <span>{interaction.riskReasons.join("; ")}</span> : <span>No risk flags</span>}
                  </div>
                  <div className="button-row">
                    <button className="icon-button compact accent" disabled={pending} onClick={() => onApprove(interaction)}>
                      <CheckCircle2 size={16} />
                      Approve
                    </button>
                    <button
                      className="icon-button compact secondary"
                      disabled={pending}
                      onClick={() => setReviewingInteractionId(null)}
                    >
                      <XIcon size={16} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="button-row">
                {interaction.status === "SUGGESTED" && !isReviewing ? (
                  <button
                    className="icon-button compact"
                    disabled={pending}
                    onClick={() => setReviewingInteractionId(interaction.id)}
                  >
                    <ShieldCheck size={16} />
                    Review
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function StrategyPanel({
  data,
  selectedAccount,
  selectedPersona,
  onSavePersona,
  onAddMaterial,
  onUpdateMaterial,
  onDeleteMaterial,
  pending,
  fullWidth = false
}: {
  data: DashboardData;
  selectedAccount?: XAccount;
  selectedPersona?: Persona;
  onSavePersona: (persona: Persona, input: PersonaStrategyInput) => void;
  onAddMaterial: (input: CompanyMaterialInput) => void;
  onUpdateMaterial: (material: CompanyMaterial, input: CompanyMaterialInput) => void;
  onDeleteMaterial: (material: CompanyMaterial) => void;
  pending: boolean;
  fullWidth?: boolean;
}) {
  const [personaForm, setPersonaForm] = useState({
    name: "",
    roleLabel: "",
    voice: "",
    audience: "",
    contentPillars: "",
    guardrails: "",
    avoidTopics: "",
    defaultHashtags: ""
  });
  const [companyInfoForm, setCompanyInfoForm] = useState<CompanyInformationInput>(EMPTY_COMPANY_INFORMATION);
  const [accountRoleLabels, setAccountRoleLabels] = useState<string[]>([]);
  const [accountInfoSaveState, setAccountInfoSaveState] = useState<"idle" | "saved">("idle");
  const [companyInfoSaveState, setCompanyInfoSaveState] = useState<"idle" | "saved">("idle");
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const companyInformationMaterial = useMemo(
    () => findCompanyInformationMaterial(data.companyMaterials),
    [data.companyMaterials]
  );
  const availableRoleNames = useMemo(
    () =>
      sortRoleNames([
        ...new Set([
          ...ROLE_DISPLAY_ORDER,
          ...data.roleInputTemplates.map((template) => template.roleName),
          ...accountRoleLabels
        ])
      ]),
    [accountRoleLabels, data.roleInputTemplates]
  );
  const primarySelectedRole = accountRoleLabels[0] ?? "";
  const strategyPlaceholders = ROLE_STRATEGY_PLACEHOLDERS[primarySelectedRole] ?? DEFAULT_STRATEGY_PLACEHOLDERS;

  useEffect(() => {
    if (!selectedPersona) {
      return;
    }

    const editableStrategy = editablePersonaStrategy(selectedPersona);

    setPersonaForm({
      name: selectedPersona.name,
      roleLabel: selectedPersona.roleLabel,
      voice: editableStrategy.voice,
      audience: editableStrategy.audience,
      contentPillars: editableStrategy.contentPillars,
      guardrails: editableStrategy.guardrails,
      avoidTopics: editableStrategy.avoidTopics,
      defaultHashtags: editableStrategy.defaultHashtags
    });
  }, [selectedPersona]);

  useEffect(() => {
    setAccountRoleLabels(getEditableAccountRoleNames(selectedAccount, selectedPersona));
    setAccountInfoSaveState("idle");
  }, [selectedAccount?.id, selectedPersona?.id]);

  useEffect(() => {
    setCompanyInfoForm(parseCompanyInformation(companyInformationMaterial));
    setCompanyInfoSaveState("idle");
  }, [companyInformationMaterial?.id, companyInformationMaterial?.updatedAt]);

  const markAccountInfoDirty = () => {
    setAccountInfoSaveState("idle");
  };

  const savePersona = () => {
    if (!selectedPersona || accountRoleLabels.length === 0) {
      return;
    }

    const primaryRoleLabel = accountRoleLabels[0];

    onSavePersona(selectedPersona, {
      name: personaForm.name,
      roleLabel: primaryRoleLabel,
      roleLabels: accountRoleLabels,
      voice: personaForm.voice,
      audience: personaForm.audience,
      contentPillars: listFromText(personaForm.contentPillars),
      guardrails: personaForm.guardrails,
      avoidTopics: listFromText(personaForm.avoidTopics),
      defaultHashtags: hashtagsFromText(personaForm.defaultHashtags)
    });
    setAccountInfoSaveState("saved");
  };

  const toggleAccountRole = (role: string) => {
    markAccountInfoDirty();
    setAccountRoleLabels((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : sortRoleNames([...current, role])
    );
  };

  const addAccountRole = () => {
    const nextRole = newRoleName.trim();
    if (!nextRole) {
      return;
    }

    setAccountRoleLabels((current) => sortRoleNames([...new Set([...current, nextRole])]));
    markAccountInfoDirty();
    setNewRoleName("");
    setIsAddingRole(false);
  };
  const saveButtonLabel = accountInfoSaveState === "saved" ? "Success" : pending ? "Saving..." : "Save Account Information";

  const markCompanyInfoDirty = () => {
    setCompanyInfoSaveState("idle");
  };

  const saveCompanyInformation = () => {
    const input = {
      title: companyInfoForm.companyName.trim() || companyInfoForm.productName.trim() || COMPANY_INFORMATION_TITLE,
      type: "POSITIONING" as CompanyMaterialType,
      content: formatCompanyInformation(companyInfoForm),
      notes: COMPANY_INFORMATION_NOTE
    };

    if (companyInformationMaterial) {
      onUpdateMaterial(companyInformationMaterial, input);
    } else {
      onAddMaterial(input);
    }
    setCompanyInfoSaveState("saved");
  };

  const companyInfoReady = Object.values(companyInfoForm).some((value) => value.trim().length > 0);
  const companySaveButtonLabel = companyInfoSaveState === "saved" ? "Success" : pending ? "Saving..." : "Save Company Information";

  return (
    <>
      <section className={`panel ${fullWidth ? "span-6" : "span-4"}`} id="account-information">
        <PanelTitle
          icon={<Users2 size={18} />}
          title="Account Information"
          meta={`@${selectedAccount?.username ?? "account"}`}
        />
        <div className="strategy-column">
          <div className="selected-account-row">
            <Users2 size={17} />
            <div>
              <strong>@{selectedAccount?.username ?? "Select account"}</strong>
              <span>
                {selectedAccount?.displayName ?? "Account"} · {selectedAccount?.kind.toLowerCase() ?? "profile"}
              </span>
            </div>
          </div>

          <div className="account-role-picker">
            <div className="field-label-row">
              <span>Account roles</span>
              <div className="role-action-row">
                <button className="icon-button compact secondary" disabled={pending} onClick={() => setIsAddingRole(true)}>
                  <Plus size={15} />
                  Add New Role
                </button>
              </div>
            </div>
            {isAddingRole ? (
              <div className="add-role-row">
                <input
                  value={newRoleName}
                  onChange={(event) => setNewRoleName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addAccountRole();
                    }
                  }}
                  placeholder="Founder, PM, Growth..."
                />
                <button className="icon-button compact accent" disabled={pending || !newRoleName.trim()} onClick={addAccountRole}>
                  <Plus size={15} />
                  Add Role
                </button>
                <button
                  className="icon-button compact secondary"
                  disabled={pending}
                  onClick={() => {
                    setNewRoleName("");
                    setIsAddingRole(false);
                  }}
                >
                  <XIcon size={15} />
                  Cancel
                </button>
              </div>
            ) : null}
            <div className="role-chip-grid">
              {availableRoleNames.map((role) => (
                <label key={role} className={accountRoleLabels.includes(role) ? "role-chip selected" : "role-chip"}>
                  <input
                    type="checkbox"
                    checked={accountRoleLabels.includes(role)}
                    onChange={() => toggleAccountRole(role)}
                  />
                  <span>{role}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="strategy-form">
            <label>
              <span>Tone</span>
              <textarea
                value={personaForm.voice}
                onChange={(event) => {
                  markAccountInfoDirty();
                  setPersonaForm((current) => ({ ...current, voice: event.target.value }));
                }}
                placeholder={strategyPlaceholders.voice}
              />
            </label>
            <label>
              <span>Audience</span>
              <textarea
                value={personaForm.audience}
                onChange={(event) => {
                  markAccountInfoDirty();
                  setPersonaForm((current) => ({ ...current, audience: event.target.value }));
                }}
                placeholder={strategyPlaceholders.audience}
              />
            </label>
            <label>
              <span>Content pillars</span>
              <textarea
                value={personaForm.contentPillars}
                onChange={(event) => {
                  markAccountInfoDirty();
                  setPersonaForm((current) => ({ ...current, contentPillars: event.target.value }));
                }}
                placeholder={strategyPlaceholders.contentPillars}
              />
            </label>
            <label>
              <span>Guardrails (optional)</span>
              <textarea
                value={personaForm.guardrails}
                onChange={(event) => {
                  markAccountInfoDirty();
                  setPersonaForm((current) => ({ ...current, guardrails: event.target.value }));
                }}
                placeholder={strategyPlaceholders.guardrails}
              />
            </label>
            <label>
              <span>Avoid topics (optional)</span>
              <textarea
                value={personaForm.avoidTopics}
                onChange={(event) => {
                  markAccountInfoDirty();
                  setPersonaForm((current) => ({ ...current, avoidTopics: event.target.value }));
                }}
                placeholder={strategyPlaceholders.avoidTopics}
              />
            </label>
            <button
              className="icon-button accent"
              disabled={pending || !selectedPersona || accountRoleLabels.length === 0}
              onClick={savePersona}
            >
              {accountInfoSaveState === "saved" ? <CheckCircle2 size={16} /> : <Save size={16} />}
              {saveButtonLabel}
            </button>
          </div>
        </div>
      </section>

      <section className={`panel ${fullWidth ? "span-6" : "span-4"}`} id="company-information">
        <PanelTitle
          icon={<FileText size={18} />}
          title="Company Information"
          meta={companyInformationMaterial ? "Saved" : "Not saved"}
        />
        <div className="strategy-column">
          <div className="company-info-form">
            <label>
              <span>Company Name</span>
              <input
                value={companyInfoForm.companyName}
                onChange={(event) => {
                  markCompanyInfoDirty();
                  setCompanyInfoForm((current) => ({ ...current, companyName: event.target.value }));
                }}
              />
            </label>
            <label>
              <span>Product Name</span>
              <input
                value={companyInfoForm.productName}
                onChange={(event) => {
                  markCompanyInfoDirty();
                  setCompanyInfoForm((current) => ({ ...current, productName: event.target.value }));
                }}
              />
            </label>
            <label>
              <span>Industry</span>
              <input
                value={companyInfoForm.industry}
                onChange={(event) => {
                  markCompanyInfoDirty();
                  setCompanyInfoForm((current) => ({ ...current, industry: event.target.value }));
                }}
              />
            </label>
            <label>
              <span>Product/Service</span>
              <textarea
                value={companyInfoForm.productService}
                onChange={(event) => {
                  markCompanyInfoDirty();
                  setCompanyInfoForm((current) => ({ ...current, productService: event.target.value }));
                }}
              />
            </label>
            <label>
              <span>Positioning</span>
              <textarea
                value={companyInfoForm.positioning}
                onChange={(event) => {
                  markCompanyInfoDirty();
                  setCompanyInfoForm((current) => ({ ...current, positioning: event.target.value }));
                }}
              />
            </label>
            <label>
              <span>Competitive Advantage</span>
              <textarea
                value={companyInfoForm.competitiveAdvantage}
                onChange={(event) => {
                  markCompanyInfoDirty();
                  setCompanyInfoForm((current) => ({ ...current, competitiveAdvantage: event.target.value }));
                }}
              />
            </label>
            <button
              className="icon-button accent"
              disabled={pending || !companyInfoReady}
              onClick={saveCompanyInformation}
            >
              {companyInfoSaveState === "saved" ? <CheckCircle2 size={16} /> : <Save size={16} />}
              {companySaveButtonLabel}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function RoleTemplatePanel({
  data,
  onAddTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  pending
}: {
  data: DashboardData;
  onAddTemplate: (input: RoleInputTemplateInput) => void;
  onUpdateTemplate: (template: RoleInputTemplate, input: RoleInputTemplateInput) => void;
  onDeleteTemplate: (template: RoleInputTemplate) => void;
  pending: boolean;
}) {
  const roles = sortRoleNames([...new Set(data.roleInputTemplates.map((template) => template.roleName))]);
  const [selectedRole, setSelectedRole] = useState(roles[0] ?? "Founder");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState<RoleInputTemplateInput>({
    roleName: selectedRole,
    contentType: "",
    prompt: "",
    example: "",
    isActive: true
  });
  const templatesForRole = data.roleInputTemplates.filter((template) => template.roleName === selectedRole);
  const editingTemplate = data.roleInputTemplates.find((template) => template.id === editingTemplateId);

  useEffect(() => {
    if (roles.length > 0 && !roles.includes(selectedRole)) {
      setSelectedRole(roles[0]);
    }
  }, [roles, selectedRole]);

  useEffect(() => {
    if (!editingTemplateId) {
      setTemplateForm((current) => ({ ...current, roleName: selectedRole }));
    }
  }, [editingTemplateId, selectedRole]);

  const resetTemplateForm = () => {
    setEditingTemplateId(null);
    setTemplateForm({
      roleName: selectedRole,
      contentType: "",
      prompt: "",
      example: "",
      isActive: true
    });
  };

  const editTemplate = (template: RoleInputTemplate) => {
    setSelectedRole(template.roleName);
    setEditingTemplateId(template.id);
    setTemplateForm({
      roleName: template.roleName,
      contentType: template.contentType,
      prompt: template.prompt,
      example: template.example ?? "",
      isActive: template.isActive
    });
  };

  const saveTemplate = () => {
    const input = {
      ...templateForm,
      roleName: templateForm.roleName.trim(),
      contentType: templateForm.contentType.trim(),
      prompt: templateForm.prompt.trim(),
      example: templateForm.example?.trim() || undefined,
      isActive: editingTemplate ? templateForm.isActive ?? true : true
    };

    if (editingTemplate) {
      onUpdateTemplate(editingTemplate, input);
    } else {
      onAddTemplate(input);
      setSelectedRole(input.roleName);
    }
    resetTemplateForm();
  };

  const removeTemplate = (template: RoleInputTemplate) => {
    if (!window.confirm(`Delete "${template.contentType}"?`)) {
      return;
    }
    if (editingTemplateId === template.id) {
      resetTemplateForm();
    }
    onDeleteTemplate(template);
  };

  const templateReady =
    templateForm.roleName.trim().length > 0 &&
    templateForm.contentType.trim().length > 0 &&
    templateForm.prompt.trim().length > 0;

  return (
    <section className="panel span-12" id="weekly-input-templates">
      <PanelTitle
        icon={<FileText size={18} />}
        title="Weekly Input Templates"
        meta={`${data.roleInputTemplates.length} Templates`}
      />
      <div className="template-layout">
        <div className="template-form">
          <div className="material-form-title">
            <strong>{editingTemplate ? "Edit input template" : "Add custom input template"}</strong>
            {editingTemplate ? (
              <button className="icon-button compact secondary" disabled={pending} onClick={resetTemplateForm}>
                <XIcon size={16} />
                Cancel
              </button>
            ) : null}
          </div>
          <label>
            <span>Role</span>
            <input
              value={templateForm.roleName}
              onChange={(event) => setTemplateForm((current) => ({ ...current, roleName: event.target.value }))}
              placeholder="Founder, Investor, Creator..."
            />
          </label>
          <label>
            <span>Content type</span>
            <input
              value={templateForm.contentType}
              onChange={(event) => setTemplateForm((current) => ({ ...current, contentType: event.target.value }))}
              placeholder="Customer story, demo, market thesis..."
            />
          </label>
          <label>
            <span>Question to ask</span>
            <textarea
              value={templateForm.prompt}
              onChange={(event) => setTemplateForm((current) => ({ ...current, prompt: event.target.value }))}
              placeholder="What should this person share each week?"
            />
          </label>
          <label>
            <span>Example answer</span>
            <textarea
              value={templateForm.example ?? ""}
              onChange={(event) => setTemplateForm((current) => ({ ...current, example: event.target.value }))}
              placeholder="Optional"
            />
          </label>
          {editingTemplate ? (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={templateForm.isActive ?? true}
                onChange={(event) => setTemplateForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
              <span>Show this template in weekly collection</span>
            </label>
          ) : null}
          <button className="icon-button accent" disabled={pending || !templateReady} onClick={saveTemplate}>
            {editingTemplate ? <Save size={16} /> : <Plus size={16} />}
            {editingTemplate ? "Save Template" : "Add Template"}
          </button>
        </div>
        <div className="template-browser">
          <label>
            <span>View role</span>
            <CustomSelect
              value={selectedRole}
              onChange={setSelectedRole}
              ariaLabel="View role"
              options={roles.map((role) => ({ value: role, label: role }))}
            />
          </label>
          <div className="template-list">
            {templatesForRole.map((template) => (
              <article className="template-card" key={template.id}>
                <div className="template-card-head">
                  <div>
                    <strong>{template.contentType}</strong>
                    <span>
                      {template.isDefault ? "Default" : "Custom"} · {template.isActive ? "Active" : "Hidden"}
                    </span>
                  </div>
                  <div className="template-card-actions">
                    <button className="icon-button compact secondary" disabled={pending} onClick={() => editTemplate(template)}>
                      <Pencil size={15} />
                      Edit
                    </button>
                    <button className="icon-button compact subtle-danger" disabled={pending} onClick={() => removeTemplate(template)}>
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                </div>
                <p>{template.prompt}</p>
                {template.example ? <small>Example: {template.example}</small> : null}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MaterialCard({
  material,
  onEdit,
  pending
}: {
  material: CompanyMaterial;
  onEdit: (material: CompanyMaterial) => void;
  pending: boolean;
}) {
  return (
    <article className="material-card">
      <div className="material-head">
        <FileText size={16} />
        <div>
          <strong>{material.title}</strong>
          <span>{materialTypeLabel(material.type)}</span>
        </div>
        <button className="icon-button compact secondary" disabled={pending} onClick={() => onEdit(material)}>
          <Pencil size={16} />
          Edit
        </button>
      </div>
      <p>{material.content}</p>
    </article>
  );
}

function PanelTitle({ icon, title, meta }: { icon: React.ReactNode; title: string; meta: string }) {
  return (
    <div className="panel-title">
      <div>
        {icon}
        <h2>{title}</h2>
      </div>
      <span>{meta}</span>
    </div>
  );
}

function Badge({ tone, children }: { tone?: string; children: React.ReactNode }) {
  return <span className={`badge ${tone ?? "neutral"}`}>{children}</span>;
}
