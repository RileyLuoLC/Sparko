import {
  assessRisk,
  buildDuplicateGroupKey,
  canApproveInteractionForApi,
  extractHashtags,
  formatDraftText,
  normalizePostWhitespace,
  truncateForX,
  validateDraftEditRequest,
  validateScheduleRequest
} from "./policy";
import { isXBearerConfigured, isXUserAccessConfigured } from "./env";
import type {
  AccountAnalytics,
  Approval,
  AuditLog,
  CompanyMaterial,
  CompanyMaterialType,
  DashboardData,
  DraftStatus,
  DraftPost,
  GeneratedDraftCandidate,
  InteractionSuggestion,
  MetricsSnapshot,
  Persona,
  RoleInputTemplate,
  ScheduledPost,
  SignalOrigin,
  SourcePost,
  TrendSnapshot,
  User,
  WeeklyRoleInput,
  WatchlistAccount,
  Workspace,
  XAccount
} from "./types";

type Store = Omit<DashboardData, "analytics">;

const globalForDemoStore = globalThis as unknown as {
  __xOpsDemoStore?: Store;
  __xOpsDemoSequence?: number;
};

let sequence = globalForDemoStore.__xOpsDemoSequence ?? 0;
const nowIso = () => new Date().toISOString();
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
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
const SETUP_PLACEHOLDER_ROLES = new Set(["Operator", "Needs setup"]);
const id = (prefix: string) => {
  sequence += 1;
  globalForDemoStore.__xOpsDemoSequence = sequence;
  return `${prefix}_${sequence.toString(36).padStart(4, "0")}`;
};

function compareRoleNames(a: string, b: string) {
  const aIndex = ROLE_DISPLAY_ORDER.indexOf(a);
  const bIndex = ROLE_DISPLAY_ORDER.indexOf(b);
  if (aIndex !== -1 || bIndex !== -1) {
    return (aIndex === -1 ? ROLE_DISPLAY_ORDER.length : aIndex) - (bIndex === -1 ? ROLE_DISPLAY_ORDER.length : bIndex);
  }
  return a.localeCompare(b);
}

const workspace: Workspace = {
  id: "workspace_demo",
  name: "Example Studio",
  defaultLanguage: "en",
  defaultWoeid: 1,
  appTimezone: "Asia/Shanghai",
  targetMarketTimezone: "America/New_York",
  duplicateWindowHours: 168,
  minPostIntervalMinutes: 1
};

const currentUser: User = {
  id: "user_demo_reviewer",
  workspaceId: workspace.id,
  email: "ops@example.com",
  name: "Ops Reviewer",
  role: "ADMIN"
};

const personas: Persona[] = [
  {
    id: "persona_founder",
    workspaceId: workspace.id,
    name: "Founder Voice",
    roleLabel: "Founder",
    voice: "clear, opinionated, constructive, practical",
    audience: "startup operators, AI builders, early customers",
    contentPillars: [
      "operator lessons from building AI workflows",
      "trust, review, and human judgment in automation",
      "early customer learnings"
    ],
    guardrails: "No hype claims, no financial promises, no competitor attacks.",
    avoidTopics: ["viral bait", "unverified benchmarks", "fundraising rumors"],
    defaultHashtags: ["#AI", "#Startups"]
  },
  {
    id: "persona_product",
    workspaceId: workspace.id,
    name: "Product Voice",
    roleLabel: "Company Official Account",
    voice: "specific, user-centered, concise",
    audience: "product teams evaluating AI workflow tools",
    contentPillars: [
      "approval-first AI workflow design",
      "audit-ready team operations",
      "product details that reduce review friction"
    ],
    guardrails: "Ground posts in workflow observations and avoid roadmap promises.",
    avoidTopics: ["launch claims without a source", "competitor callouts"],
    defaultHashtags: ["#Product", "#AI"]
  },
  {
    id: "persona_devrel",
    workspaceId: workspace.id,
    name: "Developer Advocate",
    roleLabel: "Developer relations",
    voice: "technical, helpful, low-ego",
    audience: "developers building agentic apps and internal tools",
    contentPillars: [
      "implementation patterns for agent workflows",
      "developer handoffs and debugging",
      "practical API constraints"
    ],
    guardrails: "No unverifiable benchmarks, no bait, include concrete takeaway.",
    avoidTopics: ["unsupported performance claims", "security theater"],
    defaultHashtags: ["#DevTools", "#Agents"]
  }
];

const xAccounts: XAccount[] = [
  {
    id: "x_company",
    workspaceId: workspace.id,
    personaId: "persona_product",
    roleLabels: ["Company Official Account", "PM", "Growth"],
    xUserId: "demo_company_user",
    username: "demo_company",
    displayName: "Demo Company",
    kind: "COMPANY",
    status: "CONNECTED",
    timezone: "America/New_York",
    quotePostsEnabled: false,
    repliesEnabled: true
  },
  {
    id: "x_founder",
    workspaceId: workspace.id,
    personaId: "persona_founder",
    roleLabels: ["Founder", "Investor", "Creator"],
    xUserId: "demo_personal_user",
    username: "demo_personal",
    displayName: "Demo Personal",
    kind: "PERSONAL",
    status: "CONNECTED",
    timezone: "America/New_York",
    quotePostsEnabled: true,
    repliesEnabled: true
  }
];

const watchlistAccounts: WatchlistAccount[] = [
  {
    id: "watch_01",
    workspaceId: workspace.id,
    xUserId: "demo_watch_approval",
    username: "example_builder",
    displayName: "Example Builder",
    priority: 90,
    notes: "Product-led growth and AI workflow commentary"
  },
  {
    id: "watch_02",
    workspaceId: workspace.id,
    xUserId: "demo_watch_devtools",
    username: "example_devtools",
    displayName: "Example DevTools",
    priority: 80,
    notes: "Developer tooling trends and launch threads"
  },
  {
    id: "watch_03",
    workspaceId: workspace.id,
    xUserId: "demo_watch_ops",
    username: "example_ops",
    displayName: "Example Ops",
    priority: 75,
    notes: "Useful enterprise AI adoption patterns"
  }
];

const trends: TrendSnapshot[] = [
  {
    id: "trend_agents",
    workspaceId: workspace.id,
    woeid: 1,
    trendName: "AI agents",
    tweetCount: 184000,
    rank: 1,
    capturedAt: hoursAgo(1),
    origin: "DEMO"
  },
  {
    id: "trend_devtools",
    workspaceId: workspace.id,
    woeid: 1,
    trendName: "developer productivity",
    tweetCount: 82000,
    rank: 2,
    capturedAt: hoursAgo(1),
    origin: "DEMO"
  },
  {
    id: "trend_privacy",
    workspaceId: workspace.id,
    woeid: 23424977,
    trendName: "AI governance",
    tweetCount: 41000,
    rank: 3,
    capturedAt: hoursAgo(2),
    origin: "DEMO"
  }
];

const sourcePosts: SourcePost[] = [
  {
    id: "source_01",
    workspaceId: workspace.id,
    trendSnapshotId: "trend_agents",
    watchlistAccountId: "watch_01",
    xPostId: "demo_source_001",
    authorUsername: "example_builder",
    authorDisplayName: "Example Builder",
    text: "The strongest AI agent demos are not the ones doing everything. They are the ones with clear handoffs, approvals, and recovery paths.",
    url: "https://example.com/demo-posts/demo_source_001",
    likeCount: 1840,
    repostCount: 312,
    replyCount: 96,
    quoteCount: 42,
    postedAt: hoursAgo(3),
    capturedAt: hoursAgo(1),
    origin: "DEMO"
  },
  {
    id: "source_02",
    workspaceId: workspace.id,
    trendSnapshotId: "trend_devtools",
    watchlistAccountId: "watch_02",
    xPostId: "demo_source_002",
    authorUsername: "example_devtools",
    authorDisplayName: "Example DevTools",
    text: "Teams are quietly replacing weekly status meetings with automated dev summaries. The trick is making the summary audit-friendly.",
    url: "https://example.com/demo-posts/demo_source_002",
    likeCount: 970,
    repostCount: 160,
    replyCount: 41,
    quoteCount: 18,
    postedAt: hoursAgo(5),
    capturedAt: hoursAgo(1),
    origin: "DEMO"
  },
  {
    id: "source_03",
    workspaceId: workspace.id,
    trendSnapshotId: "trend_privacy",
    watchlistAccountId: "watch_03",
    xPostId: "demo_source_003",
    authorUsername: "example_ops",
    authorDisplayName: "Example Ops",
    text: "@demo_company internal AI tools need boring controls: ownership, logs, approvals, rollback. That is what gets them adopted.",
    url: "https://example.com/demo-posts/demo_source_003",
    likeCount: 640,
    repostCount: 88,
    replyCount: 31,
    quoteCount: 12,
    postedAt: hoursAgo(6),
    capturedAt: hoursAgo(2),
    origin: "DEMO"
  }
];

const companyMaterials: CompanyMaterial[] = [
  {
    id: "material_positioning",
    workspaceId: workspace.id,
    title: "Core positioning",
    type: "POSITIONING",
    content:
      "Example Studio helps teams run review-gated AI workflows for content, ops, and internal automation. The product emphasizes source visibility, human approval, audit logs, and recovery paths.",
    notes: "Use this when explaining what the company does.",
    createdAt: hoursAgo(12),
    updatedAt: hoursAgo(12)
  },
  {
    id: "material_product",
    workspaceId: workspace.id,
    title: "Review queue workflow",
    type: "PRODUCT",
    content:
      "The review queue keeps generated drafts, risk checks, approvals, and scheduled posts in one place so operators can approve or edit before anything goes live.",
    notes: "Good for product-account posts.",
    createdAt: hoursAgo(8),
    updatedAt: hoursAgo(8)
  }
];

const roleInputTemplates: RoleInputTemplate[] = [
  {
    id: "template_founder_progress",
    workspaceId: workspace.id,
    roleName: "Founder",
    contentType: "Build in public",
    prompt: "What founder-level progress, metric, failure, decision, or trade-off can you share from building this week?",
    example:
      "In the past 30 days we moved activation from A to B. The useful change was not adding more onboarding steps; it was removing the first moment of confusion.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_founder_customer",
    workspaceId: workspace.id,
    roleName: "Founder",
    contentType: "Customer insight",
    prompt: "What did you learn from customers this week that changed how you understand the problem, buyer, roadmap, or category?",
    example:
      "After talking to 12 operators, I realized they said they wanted faster drafts, but paid for clearer review ownership.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_founder_market",
    workspaceId: workspace.id,
    roleName: "Founder",
    contentType: "Strong opinion / industry thesis",
    prompt: "What clear founder opinion or industry judgment do you hold right now, and what concrete reason or evidence supports it?",
    example:
      "I am less convinced the category is about replacing operators. I think it is about making teams comfortable delegating repeatable judgment.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_founder_bts",
    workspaceId: workspace.id,
    roleName: "Founder",
    contentType: "Mistake / postmortem",
    prompt: "What costly mistake, wrong assumption, or failed bet can you explain, what did you believe then, and what would you do differently now?",
    example:
      "We spent a month polishing a feature because prospects asked for it. Later we learned it solved sales anxiety, not the user's daily problem.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_founder_numbers",
    workspaceId: workspace.id,
    roleName: "Founder",
    contentType: "Founder framework / checklist",
    prompt: "What founder framework, operating principle, decision checklist, SOP, or anti-pattern could others save and reuse?",
    example:
      "Before adding a feature, I now ask: who asked for it, what pain repeats, what breaks if we say no, and what simpler workaround already exists?",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_founder_demo",
    workspaceId: workspace.id,
    roleName: "Founder",
    contentType: "Product decision",
    prompt: "What product, pricing, positioning, or roadmap decision did you make, and what founder judgment drove it?",
    example:
      "We cut a feature users kept requesting because it would push the product toward configuration, not clearer publishing decisions.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_founder_hiring_culture",
    workspaceId: workspace.id,
    roleName: "Founder",
    contentType: "Hiring / culture",
    prompt: "What specific hiring signal, team behavior, operating habit, or culture principle should candidates understand about how you build?",
    example:
      "When hiring for early roles, I care less about perfect resumes and more about whether someone can create clarity while the problem is still messy.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_founder_personal_story",
    workspaceId: workspace.id,
    roleName: "Founder",
    contentType: "Founder story / belief",
    prompt: "What personal but not overly private founder story, belief, pressure, or long-term choice explains how you think?",
    example:
      "The hardest part of building this company has not been shipping faster. It has been learning which urgent requests deserve a no.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_investor_contrarian",
    workspaceId: workspace.id,
    roleName: "Investor",
    contentType: "Evidence-backed contrarian thesis",
    prompt: "What non-consensus investment judgment do you hold right now, and what evidence or framework supports it?",
    example:
      "I do not think AI coding agents end by replacing programmers. I think they turn software companies from people-management orgs into model-orchestration orgs. My 3 signals are...",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_investor_market_map",
    workspaceId: workspace.id,
    roleName: "Investor",
    contentType: "Industry thesis / market map",
    prompt: "What category, market map, value chain, or opportunity structure are you seeing more clearly this week?",
    example:
      "I am looking at AI + healthcare workflow. The opportunity is less in diagnosis and more in these 4 high-frequency, lower-regulation, budgeted workflows...",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_investor_founder_advice",
    workspaceId: workspace.id,
    roleName: "Investor",
    contentType: "Founder advice",
    prompt: "What practical fundraising, hiring, GTM, deck, or operating advice would help founders this week?",
    example: "The 7 most common seed deck problems I still see, and what I wish founders fixed before the first call.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_investor_deal_memo",
    workspaceId: workspace.id,
    roleName: "Investor",
    contentType: "Lightweight deal memo",
    prompt: "If you were evaluating one company or category today, what 3-5 questions would decide whether it is interesting?",
    example:
      "If I were investing in a vertical AI company today, I would start with 5 questions: is the data hard to replace, is the workflow frequent, does budget already exist...",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_investor_mistake",
    workspaceId: workspace.id,
    roleName: "Investor",
    contentType: "Mistake / missed call",
    prompt: "What did you get wrong before, why were you wrong, and how did your investment framework change?",
    example:
      "I was wrong about creator tools in 2022. The market was real, but I underestimated how much distribution platforms could squeeze tool companies.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_investor_deal_flow",
    workspaceId: workspace.id,
    roleName: "Investor",
    contentType: "Deal flow focus",
    prompt: "What company categories do you want to see next, and what should founders include if they reach out?",
    example:
      "Over the next 60 days I am focused on AI for legal ops, devtools with bottom-up adoption, and B2B prosumer tools with usage-led growth. If you are building here, send product link, users, and growth data.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_creator_process",
    workspaceId: workspace.id,
    roleName: "Creator",
    contentType: "Finished work + process",
    prompt: "What did you publish or finish, and what changed during the process?",
    example:
      "I spent 14 days making this short film. Version 1 was bad, so I changed the pacing, opening, captions, music, and ending CTA.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_creator_before_after",
    workspaceId: workspace.id,
    roleName: "Creator",
    contentType: "Before / after",
    prompt: "What before/after improvement can you show, and what 2-3 changes made the difference?",
    example: "Before: forgettable. After: easier to remember. I only changed the hook, contrast, and final line.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_creator_tutorial",
    workspaceId: workspace.id,
    roleName: "Creator",
    contentType: "Tutorial / checklist",
    prompt: "What reusable template, checklist, or method can other creators save and use?",
    example: "The 12 title templates I use for YouTube videos when the first draft feels flat.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_creator_experiment",
    workspaceId: workspace.id,
    roleName: "Creator",
    contentType: "Experiment / data recap",
    prompt: "What personal content experiment did you run, what were the numbers, and what did you learn?",
    example:
      "I posted 2 X posts a day for 30 days. Followers +1,240, process posts performed best, link posts performed worst, and the best opener was 'I tried...'",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_creator_taste",
    workspaceId: workspace.id,
    roleName: "Creator",
    contentType: "Taste / stance",
    prompt: "What point of view about quality, taste, or your craft do you want to stand behind?",
    example:
      "I stopped making content that is dense but impossible to remember. Good content does not just compress knowledge; it creates a memory.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_creator_participation",
    workspaceId: workspace.id,
    roleName: "Creator",
    contentType: "Participation / feedback",
    prompt: "What specific participation prompt would invite useful replies, and what should people include?",
    example:
      "Drop your landing page below. I will review the first screen only and tell you whether I would keep reading. Include target user, current version, and what you are unsure about.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_engineer_ship",
    workspaceId: workspace.id,
    roleName: "Engineer",
    contentType: "Build in public / demo",
    prompt: "What did you build, ship, prototype, or demo this week, and what surprised you while making it work?",
    example: "I built a tiny RAG eval dashboard this weekend. The surprising part was how quickly bad chunks showed up in the failure cases.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_engineer_debugging",
    workspaceId: workspace.id,
    roleName: "Engineer",
    contentType: "Debugging / pitfall recap",
    prompt: "What bug, failure mode, confusing error, or production issue did you debug, what caused it, and what was the fix?",
    example: "I spent 4 hours debugging a CUDA issue. The fix was a mismatched driver version, not the model code.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_engineer_architecture",
    workspaceId: workspace.id,
    roleName: "Engineer",
    contentType: "Architecture / system design",
    prompt: "What architecture, system design, deployment pattern, or production safety setup can you explain visually or step by step?",
    example: "A simple production agent architecture: task queue, tool sandbox, eval gate, human approval, audit log, retry path.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_engineer_code_snippet",
    workspaceId: workspace.id,
    roleName: "Engineer",
    contentType: "Code snippet / tool script",
    prompt: "What small code snippet, tool script, config, CLI command, or reusable pattern would save another engineer time?",
    example: "Ten lines of Python to compare LLM output consistency across the same prompt and flag unstable answers.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_engineer_benchmark",
    workspaceId: workspace.id,
    roleName: "Engineer",
    contentType: "Benchmark / comparison",
    prompt: "What models, tools, frameworks, prompts, embeddings, or infra choices did you compare, and what result was unexpected?",
    example: "I tested 3 embedding models on my own docs. The best public leaderboard model was not the best one for my retrieval set.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_engineer_paper_takeaway",
    workspaceId: workspace.id,
    roleName: "Engineer",
    contentType: "Paper / new tech takeaway",
    prompt: "What paper, new technique, library, or release has a practical engineering takeaway worth explaining without hype?",
    example: "This paper sounds academic, but the engineering takeaway is simple: better eval data can beat another layer of prompt tricks.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_engineer_strong_opinion",
    workspaceId: workspace.id,
    roleName: "Engineer",
    contentType: "Strong technical opinion",
    prompt: "What technical opinion do you hold that other engineers might debate, and what concrete experience or evidence backs it up?",
    example: "Most RAG problems are not retrieval problems. They are data quality, chunking, and eval problems showing up as retrieval symptoms.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_engineer_learning_roadmap",
    workspaceId: workspace.id,
    roleName: "Engineer",
    contentType: "Learning roadmap",
    prompt: "What learning path, resource sequence, project ladder, or skill roadmap would you recommend from your current technical experience?",
    example: "If I were learning AI engineering from zero in 2026, I would build evals before agents and production logging before fancy orchestration.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_engineer_workflow",
    workspaceId: workspace.id,
    roleName: "Engineer",
    contentType: "Real workflow / stack",
    prompt: "What does your real engineering workflow, stack, tool choice, or build process look like, and what changed recently?",
    example: "My current AI engineering stack: local traces for debugging, evals in CI, cheap models for drafts, stronger models only at review points.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_engineer_poll",
    workspaceId: workspace.id,
    roleName: "Engineer",
    contentType: "Technical poll / debate",
    prompt: "What focused technical question, trade-off, or poll could invite useful replies from engineers with different constraints?",
    example: "For AI apps, would you optimize latency, eval quality, or cost first if you could only pick one this quarter?",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_designer_detail",
    workspaceId: workspace.id,
    roleName: "Designer",
    contentType: "Before / after redesign",
    prompt: "What screen, flow, or component can you show before and after, what problem did the original create, and what changed?",
    example:
      "Before, users could not tell what to do next. After, the main CTA is clearer, secondary details are folded away, and the form order matches intent.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_designer_ux_critique",
    workspaceId: workspace.id,
    roleName: "Designer",
    contentType: "UX critique / teardown",
    prompt: "What product, interaction, onboarding detail, or UX pattern can you critique by explaining its goal, why it works, and what could improve?",
    example:
      "Three small Airbnb UX details: search suggestions reduce blank-state anxiety, price anchors before filtering, and map plus list keeps exploration flexible.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_designer_case_study",
    workspaceId: workspace.id,
    roleName: "Designer",
    contentType: "Mini case study",
    prompt: "What design problem can you turn into a short case study with user pain, old solution, design decisions, iteration, and outcome or lesson?",
    example:
      "I redesigned a dashboard for busy operators. The old UI had 12 metrics, but users only needed 3 to make a decision.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_designer_checklist",
    workspaceId: workspace.id,
    roleName: "Designer",
    contentType: "Design checklist / cheatsheet",
    prompt: "What reusable design checklist, cheatsheet, rule set, interview question list, or audit framework can others save?",
    example:
      "Seven questions before designing any dashboard: who checks it daily, what decision do they make, which metric is actionable, and what can be hidden until needed.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_designer_principle",
    workspaceId: workspace.id,
    roleName: "Designer",
    contentType: "Design principle + example",
    prompt: "What small design principle can you explain with a concrete example that makes the UX difference easy to see?",
    example:
      "Bad UX: Submit. Better UX: Create account. Best UX: Create account - takes 10 seconds. Good microcopy reduces uncertainty.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_designer_decision",
    workspaceId: workspace.id,
    roleName: "Designer",
    contentType: "Design decision rationale",
    prompt: "What design choice did you make, what alternatives did you reject, and what user goal or constraint drove the decision?",
    example:
      "I did not use cards here because the user was not comparing options; they were trying to complete one task.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_designer_career",
    workspaceId: workspace.id,
    roleName: "Designer",
    contentType: "Career / real experience",
    prompt: "What design career lesson, collaboration moment, critique experience, portfolio lesson, or mistake would help another designer?",
    example:
      "One mistake I made early: treating vague feedback like 'make it pop' as a visual request instead of asking what decision the design failed to support.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_designer_discussion",
    workspaceId: workspace.id,
    roleName: "Designer",
    contentType: "Discussion prompt",
    prompt: "What specific design question, A/B choice, pattern debate, or feedback prompt could invite useful comments from designers?",
    example:
      "Which checkout layout feels faster, A or B? I am especially looking at scanning order, trust, and how quickly users understand the next step.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_company_product_update",
    workspaceId: workspace.id,
    roleName: "Company Official Account",
    contentType: "Product update",
    prompt: "What product improvement, launch, or workflow change should customers know about, and what user problem does it address?",
    example:
      "We added per-account scheduling so teams can keep each X account's queue separate instead of managing one mixed calendar.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_company_customer_proof",
    workspaceId: workspace.id,
    roleName: "Company Official Account",
    contentType: "Customer proof",
    prompt: "What customer story, usage signal, quote, or before/after outcome can show the product creating real value?",
    example:
      "A team turned one rough weekly update into three account-specific approved posts without losing review control.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_company_use_case",
    workspaceId: workspace.id,
    roleName: "Company Official Account",
    contentType: "Use case",
    prompt: "What concrete use case should prospective customers understand, and what job does the product help them complete?",
    example:
      "Use weekly inputs from founders, PMs, and growth leads as source material, then turn them into reviewed posts for the right account.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_company_product_insight",
    workspaceId: workspace.id,
    roleName: "Company Official Account",
    contentType: "Product insight",
    prompt: "What product belief, workflow principle, or customer behavior explains why this product decision matters?",
    example:
      "Teams do not only need faster drafts; they need a clear handoff between source material, review, account voice, and scheduling.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_company_education",
    workspaceId: workspace.id,
    roleName: "Company Official Account",
    contentType: "Educational guide",
    prompt: "What practical tip, checklist, or how-to would help customers operate better?",
    example:
      "Before generating posts for multiple accounts, define who each account speaks for, what evidence it can use, and who approves it.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_company_company_pov",
    workspaceId: workspace.id,
    roleName: "Company Official Account",
    contentType: "Company POV",
    prompt: "What clear company point of view should the official account state, and what concrete example makes it credible?",
    example:
      "AI-assisted publishing works better when the system asks for better raw material first, not when it tries to invent everything from a blank prompt.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_growth_user_case",
    workspaceId: workspace.id,
    roleName: "Growth",
    contentType: "Field observation",
    prompt: "What firsthand user, funnel, channel, or onboarding pattern did you notice this week, and what does it suggest?",
    example:
      "After reviewing 10 AI SaaS onboarding flows, the common issue was that products showed features before helping users finish one real task.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_growth_loop",
    workspaceId: workspace.id,
    roleName: "Growth",
    contentType: "Growth model teardown",
    prompt: "What product, campaign, pricing page, referral flow, onboarding path, or lifecycle mechanism can you break down this week?",
    example:
      "Duolingo's strongest retention mechanic is not just streaks; it turns a missed lesson into an emotional event users can recover from.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_growth_experiment",
    workspaceId: workspace.id,
    roleName: "Growth",
    contentType: "Growth experiment recap",
    prompt: "What growth experiment did you run, what was the hypothesis, what changed, what did the data show, and what happens next?",
    example:
      "We cut step 3 of onboarding from 5 fields to 2. Completion rose 18%, activation rose 7%, and lead quality did not obviously drop.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_growth_contrarian",
    workspaceId: workspace.id,
    roleName: "Growth",
    contentType: "Contrarian growth POV",
    prompt: "What growth belief do you disagree with this week, what concrete example supports your view, and what should operators do instead?",
    example:
      "Many B2B SaaS growth problems are positioning problems, not acquisition problems. More traffic just sends more people into a confusing funnel.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_growth_framework",
    workspaceId: workspace.id,
    roleName: "Growth",
    contentType: "Growth framework / checklist",
    prompt: "What reusable growth framework, checklist, or diagnostic questions would help someone make a better decision?",
    example:
      "To judge PLG potential, I look at self-serve start, time to first value, usage frequency, team expansion, aha moment, and sales timing signals.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_growth_failure",
    workspaceId: workspace.id,
    roleName: "Growth",
    contentType: "Failure lesson",
    prompt: "What growth mistake or failed bet did you make, what did it cost, and what principle changed afterward?",
    example:
      "I once scaled a low-CAC channel too quickly, then learned the 30-day retention was terrible. Now I ask whether the users match our ICP first.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_growth_metric",
    workspaceId: workspace.id,
    roleName: "Growth",
    contentType: "Metric interpretation",
    prompt: "What metric are people misreading, what assumption sits underneath it, and how should a growth team interpret it instead?",
    example:
      "Activation rate is not one metric; it is a hypothesis that one user action predicts long-term retention.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_growth_swipe_file",
    workspaceId: workspace.id,
    roleName: "Growth",
    contentType: "Template / swipe file",
    prompt: "What practical growth template, brief, swipe file, checklist, or meeting agenda can others save and reuse?",
    example:
      "A growth experiment brief should define hypothesis, segment, primary metric, guardrail, duration, decision rule, and owner before launch.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_pm_user_problem",
    workspaceId: workspace.id,
    roleName: "PM",
    contentType: "Project retrospective",
    prompt: "What real product decision, shipped work, cut feature, or missed assumption can you review this week, and what did you learn?",
    example:
      "We killed a feature that looked reasonable. The issue was not feasibility; it solved sales anxiety more than a user problem.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_pm_roadmap",
    workspaceId: workspace.id,
    roleName: "PM",
    contentType: "Decision trade-off",
    prompt: "What product trade-off did you face, what did each side optimize for, and why did you choose one path?",
    example:
      "We did not build the most requested feature because it helped 8% of power users but made the new-user path harder for everyone else.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_pm_use_case",
    workspaceId: workspace.id,
    roleName: "PM",
    contentType: "Product teardown",
    prompt: "What product, feature, onboarding flow, pricing choice, or user experience can you break down from a PM perspective?",
    example:
      "The clever part of this feature is not the UI. It lowers the psychological cost of taking the first action.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_pm_contrarian",
    workspaceId: workspace.id,
    roleName: "PM",
    contentType: "Contrarian PM POV",
    prompt: "What PM belief do you disagree with, what specific example supports your view, and what should PMs do differently?",
    example:
      "Good PMs are not better because they write cleaner PRDs. They are better because they know when to say no.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_pm_framework",
    workspaceId: workspace.id,
    roleName: "PM",
    contentType: "Framework / checklist",
    prompt: "What PM framework, checklist, template, or diagnostic questions would help someone make a clearer product decision?",
    example:
      "For prioritization I ask: whose problem is this, how often does it happen, what breaks if we do nothing, is there a lighter solution, and what metric changes?",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_pm_career",
    workspaceId: workspace.id,
    roleName: "PM",
    contentType: "Career / interview lesson",
    prompt: "What PM career, interview, promotion, or collaboration lesson would help someone navigate the role more effectively?",
    example:
      "When an interviewer asks how you prioritize, they are not testing a framework; they are testing whether you understand the business trade-off.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_pm_user_research",
    workspaceId: workspace.id,
    roleName: "PM",
    contentType: "User research observation",
    prompt: "What user research moment, interview quote, behavior, or contradiction revealed something useful this week?",
    example:
      "When users say 'this is nice,' it often means they are being polite, not that they will actually use it.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  },
  {
    id: "template_pm_builder_log",
    workspaceId: workspace.id,
    roleName: "PM",
    contentType: "Builder log",
    prompt: "What are you building, testing, learning, or changing right now, and what early signal did you see?",
    example:
      "We changed the signup CTA from 'create account' to 'analyze your first project.' Clicks went up, but completion did not, so the form is still too heavy.",
    isDefault: true,
    isActive: true,
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10)
  }
];

const weeklyInputs: WeeklyRoleInput[] = [
  {
    id: "weekly_input_01",
    workspaceId: workspace.id,
    xAccountId: "x_founder",
    roleInputTemplateId: "template_founder_customer",
    roleName: "Founder",
    contentType: "Customer story",
    content: "A founder used the review queue to turn a rough weekly update into three approved posts in one sitting.",
    evidenceUrl: "",
    weekOf: new Date().toISOString().slice(0, 10),
    createdAt: hoursAgo(4),
    updatedAt: hoursAgo(4)
  },
  {
    id: "weekly_input_02",
    workspaceId: workspace.id,
    xAccountId: "x_company",
    roleInputTemplateId: "template_company_use_case",
    roleName: "Company Official Account",
    contentType: "Use case",
    content: "We added per-account scheduling so each X account has its own queue instead of one mixed calendar.",
    evidenceUrl: "",
    weekOf: new Date().toISOString().slice(0, 10),
    createdAt: hoursAgo(3),
    updatedAt: hoursAgo(3)
  }
];

const drafts: DraftPost[] = [
  {
    id: "draft_01",
    workspaceId: workspace.id,
    personaId: "persona_founder",
    xAccountId: "x_founder",
    sourcePostId: "source_01",
    trendSnapshotId: "trend_agents",
    text: "The best AI agents do not remove judgment. They move judgment to the moments where it matters: approvals, exceptions, and recovery paths. That is the difference between a demo and an operating system.",
    rationale: "Turns the trend into a founder-level operating principle.",
    hashtags: [],
    status: "NEEDS_REVIEW",
    riskLevel: "LOW",
    riskReasons: [],
    aiModel: "seeded-demo",
    createdAt: hoursAgo(2),
    updatedAt: hoursAgo(2)
  },
  {
    id: "draft_02",
    workspaceId: workspace.id,
    personaId: "persona_product",
    xAccountId: "x_company",
    sourcePostId: "source_02",
    trendSnapshotId: "trend_devtools",
    text: "A useful AI workflow does three things well: summarizes the work, shows its sources, and makes approval easy. Without those, teams get novelty. With them, they get operating leverage.",
    rationale: "Product voice with a practical checklist.",
    hashtags: [],
    status: "APPROVED",
    riskLevel: "LOW",
    riskReasons: [],
    aiModel: "seeded-demo",
    createdAt: hoursAgo(3),
    updatedAt: hoursAgo(1)
  }
];

const approvals: Approval[] = [
  {
    id: "approval_01",
    draftPostId: "draft_02",
    reviewerId: currentUser.id,
    decision: "APPROVED",
    comment: "Clear and safe for product account.",
    createdAt: hoursAgo(1)
  }
];

const scheduledPosts: ScheduledPost[] = [
  {
    id: "scheduled_01",
    workspaceId: workspace.id,
    xAccountId: "x_founder",
    finalText:
      "Useful automation earns trust when the handoff is obvious: what happened, why it happened, and where a person can step in.",
    scheduledFor: hoursFromNow(6),
    status: "QUEUED",
    duplicateGroupKey: buildDuplicateGroupKey(
      "Useful automation earns trust when the handoff is obvious: what happened, why it happened, and where a person can step in."
    ),
    createdAt: hoursAgo(1),
    updatedAt: hoursAgo(1)
  },
  {
    id: "scheduled_02",
    workspaceId: workspace.id,
    xAccountId: "x_company",
    finalText:
      "Teams do not need another autonomous agent demo. They need an ops loop they can trust: draft, review, schedule, publish, learn.",
    scheduledFor: hoursAgo(52),
    status: "PUBLISHED",
    duplicateGroupKey: buildDuplicateGroupKey(
      "Teams do not need another autonomous agent demo. They need an ops loop they can trust: draft, review, schedule, publish, learn."
    ),
    xPublishedPostId: "800001",
    createdAt: hoursAgo(54),
    updatedAt: hoursAgo(52)
  },
  {
    id: "scheduled_03",
    workspaceId: workspace.id,
    xAccountId: "x_founder",
    finalText:
      "AI workflows get adopted when the review step feels boring: clear owner, clear context, clear undo path.",
    scheduledFor: hoursAgo(30),
    status: "PUBLISHED",
    duplicateGroupKey: buildDuplicateGroupKey(
      "AI workflows get adopted when the review step feels boring: clear owner, clear context, clear undo path."
    ),
    xPublishedPostId: "800002",
    createdAt: hoursAgo(32),
    updatedAt: hoursAgo(30)
  }
];

const interactions: InteractionSuggestion[] = [
  {
    id: "interaction_01",
    workspaceId: workspace.id,
    xAccountId: "x_company",
    sourcePostId: "source_03",
    type: "REPLY",
    suggestedText: "Exactly. The boring controls are usually what make AI workflows durable enough for real teams.",
    rationale: "@example_ops replied to a post published by @demo_company, so this is a human-approved reply opportunity.",
    status: "SUGGESTED",
    riskLevel: "LOW",
    riskReasons: [],
    context: {
      kind: "published_post_reply",
      summary: "Demo conversation context for a reply suggestion.",
      posts: [
        {
          id: "800001",
          label: "Your original post",
          username: "demo_company",
          text: "Teams do not need another autonomous agent demo. They need an ops loop they can trust: draft, review, schedule, publish, learn.",
          url: "https://example.com/demo-posts/800001",
          postedAt: hoursAgo(52)
        },
        {
          id: "demo_source_003",
          label: "Their reply",
          username: "example_ops",
          text: "@demo_company internal AI tools need boring controls: ownership, logs, approvals, rollback. That is what gets them adopted.",
          url: "https://example.com/demo-posts/demo_source_003",
          postedAt: hoursAgo(6)
        }
      ]
    },
    createdAt: hoursAgo(1),
    updatedAt: hoursAgo(1)
  },
  {
    id: "interaction_02",
    workspaceId: workspace.id,
    xAccountId: "x_founder",
    sourcePostId: "source_01",
    type: "REPLY",
    suggestedText: "That is the piece I keep coming back to: the handoff matters as much as the automation.",
    rationale: "@example_builder replied to a post published by @demo_personal, so this is a human-approved reply opportunity.",
    status: "SUGGESTED",
    riskLevel: "LOW",
    riskReasons: [],
    context: {
      kind: "published_post_reply",
      summary: "Demo conversation context for a reply suggestion.",
      posts: [
        {
          id: "800002",
          label: "Your original post",
          username: "demo_personal",
          text: "AI workflows get adopted when the review step feels boring: clear owner, clear context, clear undo path.",
          url: "https://example.com/demo-posts/800002",
          postedAt: hoursAgo(30)
        },
        {
          id: "demo_source_001",
          label: "Their reply",
          username: "example_builder",
          text: "The strongest AI agent demos are not the ones doing everything. They are the ones with clear handoffs, approvals, and recovery paths.",
          url: "https://example.com/demo-posts/demo_source_001",
          postedAt: hoursAgo(3)
        }
      ]
    },
    createdAt: hoursAgo(1),
    updatedAt: hoursAgo(1)
  }
];

const metrics: MetricsSnapshot[] = [
  {
    id: "metric_01",
    xAccountId: "x_company",
    xPostId: "800001",
    likeCount: 118,
    repostCount: 18,
    replyCount: 9,
    quoteCount: 4,
    impressionCount: 9200,
    urlClickCount: 76,
    capturedAt: hoursAgo(24)
  },
  {
    id: "metric_02",
    xAccountId: "x_founder",
    xPostId: "800002",
    likeCount: 246,
    repostCount: 31,
    replyCount: 22,
    quoteCount: 9,
    impressionCount: 16800,
    urlClickCount: 140,
    capturedAt: hoursAgo(18)
  }
];

const auditLogs: AuditLog[] = [
  {
    id: "audit_01",
    workspaceId: workspace.id,
    userId: currentUser.id,
    action: "draft.approved",
    entityType: "DraftPost",
    entityId: "draft_02",
    metadata: { mode: "demo" },
    createdAt: hoursAgo(1)
  }
];

const initialStore: Store = {
  workspace,
  currentUser,
  personas,
  xAccounts,
  watchlistAccounts,
  companyMaterials,
  roleInputTemplates,
  weeklyInputs,
  trends,
  sourcePosts,
  drafts,
  approvals,
  scheduledPosts,
  interactions,
  metrics,
  auditLogs
};

const store: Store = globalForDemoStore.__xOpsDemoStore ?? initialStore;
globalForDemoStore.__xOpsDemoStore = store;

function defaultRoleInputTemplate(templateId: string) {
  const template = roleInputTemplates.find((item) => item.id === templateId);
  if (!template) {
    throw new Error(`Default template ${templateId} not found.`);
  }
  return { ...template };
}

function upsertDefaultRoleInputTemplate(templateId: string) {
  const nextTemplate = defaultRoleInputTemplate(templateId);
  const existing = store.roleInputTemplates.find((item) => item.id === templateId);
  if (existing) {
    Object.assign(existing, {
      workspaceId: nextTemplate.workspaceId,
      roleName: nextTemplate.roleName,
      contentType: nextTemplate.contentType,
      prompt: nextTemplate.prompt,
      example: nextTemplate.example,
      isDefault: nextTemplate.isDefault,
      isActive: existing.isActive
    });
    return;
  }
  store.roleInputTemplates.push(nextTemplate);
}

function migrateSplitRoleInputTemplates() {
  [
    "template_founder_progress",
    "template_founder_customer",
    "template_founder_market",
    "template_founder_bts",
    "template_founder_numbers",
    "template_founder_demo",
    "template_founder_hiring_culture",
    "template_founder_personal_story"
  ].forEach(upsertDefaultRoleInputTemplate);

  [
    "template_company_product_update",
    "template_company_customer_proof",
    "template_company_use_case",
    "template_company_product_insight",
    "template_company_education",
    "template_company_company_pov"
  ].forEach(upsertDefaultRoleInputTemplate);

  [
    "template_engineer_ship",
    "template_engineer_debugging",
    "template_engineer_architecture",
    "template_engineer_code_snippet",
    "template_engineer_benchmark",
    "template_engineer_paper_takeaway",
    "template_engineer_strong_opinion",
    "template_engineer_learning_roadmap",
    "template_engineer_workflow",
    "template_engineer_poll"
  ].forEach(upsertDefaultRoleInputTemplate);

  [
    "template_designer_detail",
    "template_designer_ux_critique",
    "template_designer_case_study",
    "template_designer_checklist",
    "template_designer_principle",
    "template_designer_decision",
    "template_designer_career",
    "template_designer_discussion"
  ].forEach(upsertDefaultRoleInputTemplate);

  [
    "template_growth_user_case",
    "template_growth_loop",
    "template_growth_experiment",
    "template_growth_contrarian",
    "template_growth_framework",
    "template_growth_failure",
    "template_growth_metric",
    "template_growth_swipe_file"
  ].forEach(upsertDefaultRoleInputTemplate);

  [
    "template_pm_user_problem",
    "template_pm_roadmap",
    "template_pm_use_case",
    "template_pm_contrarian",
    "template_pm_framework",
    "template_pm_career",
    "template_pm_user_research",
    "template_pm_builder_log"
  ].forEach(upsertDefaultRoleInputTemplate);
}

function migrateAccountScopedWeeklyInputs() {
  const companyAccount = store.xAccounts.find((account) => account.id === "x_company") ?? store.xAccounts[0];
  const founderAccount = store.xAccounts.find((account) => account.id === "x_founder") ?? companyAccount;

  store.personas.forEach((persona) => {
    if (persona.id === "persona_product" && ["Product", "PM"].includes(persona.roleLabel)) {
      persona.roleLabel = "Company Official Account";
    }
  });

  store.xAccounts.forEach((account) => {
    const persona = store.personas.find((item) => item.id === account.personaId);
    const hadRoles = Boolean(account.roleLabels?.length);
    if (!hadRoles) {
      account.roleLabels = persona?.roleLabel ? [persona.roleLabel] : [];
    }
    if (!hadRoles && account.id === "x_company") {
      account.roleLabels = ["Company Official Account", "PM", "Growth"];
    }
    if (!hadRoles && account.id === "x_founder") {
      account.roleLabels = ["Founder", "Investor", "Creator"];
    }
  });

  store.weeklyInputs.forEach((input) => {
    if (!input.xAccountId) {
      input.xAccountId = input.roleName === "Founder" ? founderAccount.id : companyAccount.id;
    }
    if (input.id === "weekly_input_02" && ["Engineer", "PM"].includes(input.roleName)) {
      input.xAccountId = companyAccount.id;
      input.roleInputTemplateId = "template_company_use_case";
      input.roleName = "Company Official Account";
      input.contentType = "Use case";
    }
  });
}

export function updateXAccountRoles(accountId: string, roleLabels: string[]) {
  const account = store.xAccounts.find((item) => item.id === accountId);
  if (!account) {
    throw new Error("X account not found.");
  }

  const cleanRoles = [...new Set(cleanList(roleLabels, 12).filter((role) => !SETUP_PLACEHOLDER_ROLES.has(role)))].sort(compareRoleNames);
  if (cleanRoles.length === 0) {
    throw new Error("Select at least one role for this account.");
  }

  account.roleLabels = cleanRoles;

  audit("x_account.roles.updated", "XAccount", account.id, {
    roleLabels: account.roleLabels
  });

  return account;
}

function ensureDemoPublishedPosts() {
  scheduledPosts
    .filter((post) => post.status === "PUBLISHED" && post.xPublishedPostId)
    .forEach((post) => {
      const hasMetric = store.metrics.some((metric) => metric.xPostId === post.xPublishedPostId);
      const alreadyPresent = store.scheduledPosts.some((item) => item.xPublishedPostId === post.xPublishedPostId);

      if (hasMetric && !alreadyPresent) {
        store.scheduledPosts.push({ ...post });
      }
    });
}

const autoDraftModels = new Set(["seeded-demo", "ai-generated", "selected-candidate"]);

function isLowQualityGeneratedDraft(draft: DraftPost) {
  if (!autoDraftModels.has(draft.aiModel)) {
    return false;
  }

  const leakedWritingPrompt =
    /^(A good personal post on|A strong post on|The useful angle on|Specific beats polished\.|One clear claim beats|Do not make)\b/i.test(
      draft.text
    ) ||
    /\b(one observation, one implication|one thing you would do differently|name the user, the pain|strongest X draft points to concrete evidence)\b/i.test(
      draft.text
    );
  const brokenQuestionTemplate =
    /\bFor at this day,/i.test(draft.text) ||
    /\bFor being a founder means\b/i.test(draft.text) ||
    /\bwould have vibe[- ]coded by now (?:gets|is|only becomes)\b/i.test(draft.text);
  const randomLiveNews =
    /\b(DEAL:|Mistral AI acquired|Vienna-based Emmi AI|undisclosed sum|Bloomberg|semiconductor startup)\b/i.test(
      draft.text
    );

  return leakedWritingPrompt || brokenQuestionTemplate || randomLiveNews;
}

function repairLowQualityDrafts() {
  const draftIndexesToRemove: number[] = [];

  store.drafts.forEach((draft, index) => {
    if (draft.status === "SCHEDULED" || draft.status === "PUBLISHED") {
      return;
    }

    const linkedLiveSource = draft.sourcePostId
      ? store.sourcePosts.find((post) => post.id === draft.sourcePostId && post.origin === "LIVE")
      : undefined;
    const linkedLiveTrend = draft.trendSnapshotId
      ? store.trends.find((trend) => trend.id === draft.trendSnapshotId && trend.origin === "LIVE")
      : undefined;
    const looksLikeRandomLiveNews =
      Boolean(linkedLiveSource || linkedLiveTrend) ||
      /\b(DEAL:|Mistral AI|undisclosed sum|Bloomberg|acquired|semiconductor startup)\b/i.test(draft.text);

    if (isLowQualityGeneratedDraft(draft) || (autoDraftModels.has(draft.aiModel) && looksLikeRandomLiveNews)) {
      draftIndexesToRemove.push(index);
      return;
    }

    if (draft.aiModel === "seeded-demo") {
      const nextText = formatDraftText(draft.text);
      const risk = assessRisk(nextText);
      draft.text = nextText;
      draft.hashtags = extractHashtags(nextText);
      draft.riskLevel = risk.riskLevel;
      draft.riskReasons = risk.riskReasons;
      draft.updatedAt = nowIso();
    }
  });

  draftIndexesToRemove
    .sort((a, b) => b - a)
    .forEach((index) => {
      const [draft] = store.drafts.splice(index, 1);
      audit("draft.removed_low_quality", "DraftPost", draft.id, {
        reason: "Removed stale generated draft from review queue."
      });
    });
}

function analyticsFor(account: XAccount): AccountAnalytics {
  const accountMetrics = store.metrics.filter((item) => item.xAccountId === account.id);
  const accountScheduled = store.scheduledPosts.filter((post) => post.xAccountId === account.id);
  const published = accountScheduled.filter((post) => post.status === "PUBLISHED").length;
  const failed = accountScheduled.filter((post) => post.status === "FAILED").length;
  const attempts = published + failed;
  const impressions = accountMetrics.reduce((sum, item) => sum + (item.impressionCount ?? 0), 0);
  const engagements = accountMetrics.reduce(
    (sum, item) => sum + item.likeCount + item.repostCount + item.replyCount + item.quoteCount,
    0
  );

  return {
    accountId: account.id,
    engagementRate: impressions > 0 ? Number(((engagements / impressions) * 100).toFixed(2)) : 0,
    publishSuccessRate: attempts > 0 ? Number(((published / attempts) * 100).toFixed(1)) : 100,
    averageLikes:
      accountMetrics.length > 0
        ? Math.round(accountMetrics.reduce((sum, item) => sum + item.likeCount, 0) / accountMetrics.length)
        : 0,
    averageReplies:
      accountMetrics.length > 0
        ? Math.round(accountMetrics.reduce((sum, item) => sum + item.replyCount, 0) / accountMetrics.length)
        : 0,
    bestTimeSlots: ["09:00 ET", "12:30 ET", "17:00 ET"],
    weeklyPublishedCount: accountScheduled.filter((post) => {
      const createdAt = new Date(post.createdAt).getTime();
      return Date.now() - createdAt < 7 * 24 * 60 * 60 * 1000;
    }).length
  };
}

function audit(action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  store.auditLogs.unshift({
    id: id("audit"),
    workspaceId: workspace.id,
    userId: currentUser.id,
    action,
    entityType,
    entityId,
    metadata,
    createdAt: nowIso()
  });
}

export function getDashboardData(): DashboardData {
  migrateSplitRoleInputTemplates();
  migrateAccountScopedWeeklyInputs();
  ensureDemoPublishedPosts();
  repairLowQualityDrafts();

  const hideDemoSignals = isXBearerConfigured() || isXUserAccessConfigured();
  const referencedSourceIds = new Set(
    [...store.drafts.map((draft) => draft.sourcePostId), ...store.interactions.map((interaction) => interaction.sourcePostId)].filter(
      Boolean
    )
  );
  const visibleTrends = store.trends.filter((trend) => !hideDemoSignals || trend.origin === "LIVE");
  const visibleSourcePosts = store.sourcePosts.filter(
    (post) => !hideDemoSignals || post.origin === "LIVE" || referencedSourceIds.has(post.id)
  );

  return {
    ...store,
    companyMaterials: [...store.companyMaterials].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ),
    roleInputTemplates: [...store.roleInputTemplates].sort((a, b) => {
      const roleCompare = compareRoleNames(a.roleName, b.roleName);
      if (roleCompare !== 0) {
        return roleCompare;
      }
      return a.contentType.localeCompare(b.contentType);
    }),
    weeklyInputs: [...store.weeklyInputs].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ),
    trends: [...visibleTrends].sort((a, b) => a.rank - b.rank),
    sourcePosts: [...visibleSourcePosts].sort((a, b) => b.likeCount - a.likeCount),
    drafts: [...store.drafts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    scheduledPosts: [...store.scheduledPosts].sort(
      (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
    ),
    interactions: [...store.interactions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    auditLogs: [...store.auditLogs].slice(0, 20),
    analytics: store.xAccounts.map(analyticsFor)
  };
}

type DiscoveryTrendInput = {
  trendName: string;
  tweetCount?: number;
};

type DiscoverySourcePostInput = {
  trendName: string;
  xPostId: string;
  authorUsername: string;
  authorDisplayName?: string;
  text: string;
  url: string;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  quoteCount?: number;
  postedAt?: string;
};

export function runDiscovery(input?: {
  keywords?: string[];
  woeid?: number;
  trendInputs?: DiscoveryTrendInput[];
  sourcePostInputs?: DiscoverySourcePostInput[];
  origin?: SignalOrigin;
}) {
  const requestedKeywords = input?.keywords?.filter(Boolean);
  const keywords = requestedKeywords?.length ? requestedKeywords : ["AI agents", "developer productivity", "AI workflow"];
  const woeid = input?.woeid ?? workspace.defaultWoeid;
  const origin = input?.origin ?? "DEMO";
  const capturedAt = nowIso();
  const createdTrends: TrendSnapshot[] = [];
  const createdPosts: SourcePost[] = [];
  const trendInputs: DiscoveryTrendInput[] =
    input?.trendInputs?.length
      ? input.trendInputs
      : keywords.slice(0, 4).map((keyword) => ({ trendName: keyword }));

  trendInputs.slice(0, 4).forEach((trendInput, index) => {
    const keyword = trendInput.trendName;
    const trend: TrendSnapshot = {
      id: id("trend"),
      workspaceId: workspace.id,
      woeid,
      trendName: keyword,
      tweetCount: trendInput.tweetCount ?? 20000 + Math.round(Math.random() * 120000),
      rank: index + 1,
      capturedAt,
      origin
    };
    store.trends.unshift(trend);
    createdTrends.push(trend);

    const livePosts = input?.sourcePostInputs?.filter((post) => post.trendName === keyword).slice(0, 2) ?? [];
    if (livePosts.length > 0) {
      livePosts.forEach((livePost) => {
        const post: SourcePost = {
          id: id("source"),
          workspaceId: workspace.id,
          trendSnapshotId: trend.id,
          xPostId: livePost.xPostId,
          authorUsername: livePost.authorUsername,
          authorDisplayName: livePost.authorDisplayName,
          text: livePost.text,
          url: livePost.url,
          likeCount: livePost.likeCount ?? 0,
          repostCount: livePost.repostCount ?? 0,
          replyCount: livePost.replyCount ?? 0,
          quoteCount: livePost.quoteCount ?? 0,
          postedAt: livePost.postedAt ?? capturedAt,
          capturedAt,
          origin: "LIVE"
        };
        store.sourcePosts.unshift(post);
        createdPosts.push(post);
      });
      return;
    }

    if (origin === "LIVE") {
      return;
    }

    const watch = store.watchlistAccounts[index % store.watchlistAccounts.length];
    const post: SourcePost = {
      id: id("source"),
      workspaceId: workspace.id,
      trendSnapshotId: trend.id,
      watchlistAccountId: watch.id,
      xPostId: `${Date.now()}${index}`,
      authorUsername: watch.username,
      authorDisplayName: watch.displayName,
      text: `Fresh signal on ${keyword}: teams are rewarding tools that make the workflow easier to trust, not just faster to automate.`,
      url: `https://x.com/${watch.username}/status/${Date.now()}${index}`,
      likeCount: 300 + Math.round(Math.random() * 1500),
      repostCount: 20 + Math.round(Math.random() * 280),
      replyCount: 8 + Math.round(Math.random() * 90),
      quoteCount: 4 + Math.round(Math.random() * 40),
      postedAt: hoursAgo(1 + index),
      capturedAt,
      origin: "DEMO"
    };
    store.sourcePosts.unshift(post);
    createdPosts.push(post);
  });

  audit("discovery.run", "Workspace", workspace.id, {
    keywords,
    woeid,
    createdTrends: createdTrends.length,
    liveSourcePosts: input?.sourcePostInputs?.length ?? 0
  });
  return { trends: createdTrends, sourcePosts: createdPosts };
}

const cleanList = (items: string[] | undefined, limit = 8) =>
  (items ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);

export function updatePersonaStrategy(
  personaId: string,
  input: Partial<{
    name: string;
    roleLabel: string;
    voice: string;
    audience: string;
    contentPillars: string[];
    guardrails: string;
    avoidTopics: string[];
    defaultHashtags: string[];
  }>
) {
  const persona = store.personas.find((item) => item.id === personaId);
  if (!persona) {
    throw new Error("Persona not found.");
  }

  if (input.name !== undefined) {
    persona.name = input.name.trim();
  }
  if (input.roleLabel !== undefined) {
    persona.roleLabel = input.roleLabel.trim();
  }
  if (input.voice !== undefined) {
    persona.voice = input.voice.trim();
  }
  if (input.audience !== undefined) {
    persona.audience = input.audience.trim();
  }
  if (input.contentPillars !== undefined) {
    persona.contentPillars = cleanList(input.contentPillars);
  }
  if (input.guardrails !== undefined) {
    persona.guardrails = input.guardrails.trim();
  }
  if (input.avoidTopics !== undefined) {
    persona.avoidTopics = cleanList(input.avoidTopics);
  }
  if (input.defaultHashtags !== undefined) {
    persona.defaultHashtags = cleanList(input.defaultHashtags, 4).map((tag) =>
      tag.startsWith("#") ? tag : `#${tag}`
    );
  }

  audit("persona.strategy.updated", "Persona", persona.id, {
    name: persona.name,
    roleLabel: persona.roleLabel
  });

  return persona;
}

export function addCompanyMaterial(input: {
  title: string;
  type?: CompanyMaterialType;
  content: string;
  url?: string;
  notes?: string;
}) {
  const material: CompanyMaterial = {
    id: id("material"),
    workspaceId: workspace.id,
    title: input.title.trim(),
    type: input.type ?? "OTHER",
    content: input.content.trim(),
    url: input.url?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  store.companyMaterials.unshift(material);
  audit("company_material.created", "CompanyMaterial", material.id, { type: material.type });
  return material;
}

export function updateCompanyMaterial(
  materialId: string,
  input: Partial<{
    title: string;
    type: CompanyMaterialType;
    content: string;
    url: string;
    notes: string;
  }>
) {
  const material = store.companyMaterials.find((item) => item.id === materialId);
  if (!material) {
    throw new Error("Company material not found.");
  }

  if (input.title !== undefined) {
    material.title = input.title.trim();
  }
  if (input.type !== undefined) {
    material.type = input.type;
  }
  if (input.content !== undefined) {
    material.content = input.content.trim();
  }
  if (input.url !== undefined) {
    material.url = input.url.trim() || undefined;
  }
  if (input.notes !== undefined) {
    material.notes = input.notes.trim() || undefined;
  }

  material.updatedAt = nowIso();
  audit("company_material.updated", "CompanyMaterial", material.id, { type: material.type });
  return material;
}

export function deleteCompanyMaterial(materialId: string) {
  const index = store.companyMaterials.findIndex((item) => item.id === materialId);
  if (index === -1) {
    throw new Error("Company material not found.");
  }

  const [material] = store.companyMaterials.splice(index, 1);
  audit("company_material.deleted", "CompanyMaterial", material.id, { title: material.title, type: material.type });
  return material;
}

export function addRoleInputTemplate(input: {
  roleName: string;
  contentType: string;
  prompt: string;
  example?: string;
  isActive?: boolean;
}) {
  const template: RoleInputTemplate = {
    id: id("template"),
    workspaceId: workspace.id,
    roleName: input.roleName.trim(),
    contentType: input.contentType.trim(),
    prompt: input.prompt.trim(),
    example: input.example?.trim() || undefined,
    isDefault: false,
    isActive: input.isActive ?? true,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  store.roleInputTemplates.unshift(template);
  audit("role_input_template.created", "RoleInputTemplate", template.id, {
    roleName: template.roleName,
    contentType: template.contentType
  });
  return template;
}

export function updateRoleInputTemplate(
  templateId: string,
  input: Partial<{
    roleName: string;
    contentType: string;
    prompt: string;
    example: string;
    isActive: boolean;
  }>
) {
  const template = store.roleInputTemplates.find((item) => item.id === templateId);
  if (!template) {
    throw new Error("Role input template not found.");
  }

  if (input.roleName !== undefined) {
    template.roleName = input.roleName.trim();
  }
  if (input.contentType !== undefined) {
    template.contentType = input.contentType.trim();
  }
  if (input.prompt !== undefined) {
    template.prompt = input.prompt.trim();
  }
  if (input.example !== undefined) {
    template.example = input.example.trim() || undefined;
  }
  if (input.isActive !== undefined) {
    template.isActive = input.isActive;
  }

  template.updatedAt = nowIso();
  audit("role_input_template.updated", "RoleInputTemplate", template.id, {
    roleName: template.roleName,
    contentType: template.contentType
  });
  return template;
}

export function deleteRoleInputTemplate(templateId: string) {
  const index = store.roleInputTemplates.findIndex((item) => item.id === templateId);
  if (index === -1) {
    throw new Error("Role input template not found.");
  }

  const [template] = store.roleInputTemplates.splice(index, 1);
  audit("role_input_template.deleted", "RoleInputTemplate", template.id, {
    roleName: template.roleName,
    contentType: template.contentType
  });
  return template;
}

export function addWeeklyRoleInput(input: {
  xAccountId: string;
  roleInputTemplateId: string;
  content: string;
  evidenceUrl?: string;
  weekOf: string;
}) {
  const account = store.xAccounts.find((item) => item.id === input.xAccountId);
  if (!account) {
    throw new Error("X account not found.");
  }
  const template = store.roleInputTemplates.find((item) => item.id === input.roleInputTemplateId);
  if (!template) {
    throw new Error("Role input template not found.");
  }

  const weeklyInput: WeeklyRoleInput = {
    id: id("weekly_input"),
    workspaceId: workspace.id,
    xAccountId: account.id,
    roleInputTemplateId: template.id,
    roleName: template.roleName,
    contentType: template.contentType,
    content: input.content.trim(),
    evidenceUrl: input.evidenceUrl?.trim() || undefined,
    weekOf: input.weekOf,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  store.weeklyInputs.unshift(weeklyInput);
  audit("weekly_input.created", "WeeklyRoleInput", weeklyInput.id, {
    xAccountId: weeklyInput.xAccountId,
    roleName: weeklyInput.roleName,
    contentType: weeklyInput.contentType
  });
  return weeklyInput;
}

export function updateWeeklyRoleInput(
  weeklyInputId: string,
  input: Partial<{
    roleInputTemplateId: string;
    xAccountId: string;
    content: string;
    evidenceUrl: string;
    weekOf: string;
  }>
) {
  const weeklyInput = store.weeklyInputs.find((item) => item.id === weeklyInputId);
  if (!weeklyInput) {
    throw new Error("Weekly input not found.");
  }

  if (input.roleInputTemplateId !== undefined) {
    const template = store.roleInputTemplates.find((item) => item.id === input.roleInputTemplateId);
    if (!template) {
      throw new Error("Role input template not found.");
    }
    weeklyInput.roleInputTemplateId = template.id;
    weeklyInput.roleName = template.roleName;
    weeklyInput.contentType = template.contentType;
  }
  if (input.xAccountId !== undefined) {
    const account = store.xAccounts.find((item) => item.id === input.xAccountId);
    if (!account) {
      throw new Error("X account not found.");
    }
    weeklyInput.xAccountId = account.id;
  }
  if (input.content !== undefined) {
    weeklyInput.content = input.content.trim();
  }
  if (input.evidenceUrl !== undefined) {
    weeklyInput.evidenceUrl = input.evidenceUrl.trim() || undefined;
  }
  if (input.weekOf !== undefined) {
    weeklyInput.weekOf = input.weekOf;
  }

  weeklyInput.updatedAt = nowIso();
  audit("weekly_input.updated", "WeeklyRoleInput", weeklyInput.id, {
    roleName: weeklyInput.roleName,
    contentType: weeklyInput.contentType
  });
  return weeklyInput;
}

export function deleteWeeklyRoleInput(weeklyInputId: string) {
  const index = store.weeklyInputs.findIndex((item) => item.id === weeklyInputId);
  if (index === -1) {
    throw new Error("Weekly input not found.");
  }

  const [weeklyInput] = store.weeklyInputs.splice(index, 1);
  audit("weekly_input.deleted", "WeeklyRoleInput", weeklyInput.id, {
    roleName: weeklyInput.roleName,
    contentType: weeklyInput.contentType
  });
  return weeklyInput;
}

export function addDrafts(
  candidates: GeneratedDraftCandidate[],
  accountId: string,
  personaId: string,
  maxCount = candidates.length,
  statusOverride?: DraftStatus,
  options?: { preserveText?: boolean }
): DraftPost[] {
  const created: DraftPost[] = [];
  const existingKeys = new Set(store.drafts.map((draft) => buildDuplicateGroupKey(draft.text)));

  for (const candidate of candidates) {
    if (created.length >= maxCount) {
      break;
    }

    const text = options?.preserveText ? normalizePostWhitespace(candidate.text) : formatDraftText(candidate.text);
    const duplicateKey = buildDuplicateGroupKey(text);
    if (existingKeys.has(duplicateKey)) {
      continue;
    }

    const risk = assessRisk(text);
    const draft: DraftPost = {
      id: id("draft"),
      workspaceId: workspace.id,
      personaId,
      xAccountId: accountId,
      sourcePostId: candidate.sourcePostId,
      trendSnapshotId: candidate.trendSnapshotId,
      text,
      rationale: candidate.rationale,
      hashtags: candidate.hashtags.length > 0 ? candidate.hashtags : extractHashtags(text),
      status: statusOverride ?? (risk.riskLevel === "HIGH" ? "NEEDS_REVIEW" : "CANDIDATE"),
      riskLevel: risk.riskLevel,
      riskReasons: [...new Set([...candidate.riskReasons, ...risk.riskReasons])],
      aiModel: "ai-generated",
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    store.drafts.unshift(draft);
    existingKeys.add(duplicateKey);
    created.push(draft);
  }

  audit("draft.generated", "XAccount", accountId, { count: created.length, personaId });
  return created;
}

export function acceptDraftCandidate(input: {
  candidate: GeneratedDraftCandidate;
  accountId: string;
  personaId: string;
}) {
  const [draft] = addDrafts([input.candidate], input.accountId, input.personaId, 1);
  if (!draft) {
    throw new Error("Selected draft already exists in the review queue.");
  }

  draft.aiModel = "selected-candidate";

  audit("draft.candidate.kept", "DraftPost", draft.id, {
    xAccountId: input.accountId,
    personaId: input.personaId
  });

  return { draft };
}

export function acceptBriefAsDraft(input: { text: string; accountId: string; personaId: string }) {
  const text = normalizePostWhitespace(input.text);
  if (!text) {
    throw new Error("Add a post brief or select at least one weekly input.");
  }

  if (text.length > 280) {
    throw new Error("Post text must be 280 characters or fewer to post as is.");
  }

  const risk = assessRisk(text);
  const [draft] = addDrafts(
    [
      {
        text,
        rationale: "Posted directly from the brief without rewriting.",
        hashtags: extractHashtags(text),
        riskLevel: risk.riskLevel,
        riskReasons: risk.riskReasons,
        sourcePostId: undefined,
        trendSnapshotId: undefined
      }
    ],
    input.accountId,
    input.personaId,
    1,
    "APPROVED",
    { preserveText: true }
  );

  if (!draft) {
    throw new Error("This brief already exists in the review queue.");
  }

  draft.aiModel = "brief-as-is";

  const approval: Approval = {
    id: id("approval"),
    draftPostId: draft.id,
    reviewerId: currentUser.id,
    decision: "APPROVED",
    comment: "Posted the brief as is.",
    createdAt: nowIso()
  };
  store.approvals.unshift(approval);

  audit("draft.brief.accepted", "DraftPost", draft.id, {
    xAccountId: input.accountId,
    personaId: input.personaId
  });

  return { draft, approval };
}

export function updateDraftAccount(draftId: string, accountId: string) {
  const draft = store.drafts.find((item) => item.id === draftId);
  if (!draft) {
    throw new Error("Draft not found.");
  }

  if (draft.status === "SCHEDULED" || draft.status === "PUBLISHED") {
    throw new Error("Scheduled or published drafts cannot change publishing account.");
  }

  const account = store.xAccounts.find((item) => item.id === accountId);
  if (!account) {
    throw new Error("X account not found.");
  }

  const previousAccountId = draft.xAccountId;
  const previousPersonaId = draft.personaId;
  draft.xAccountId = account.id;
  draft.personaId = account.personaId ?? draft.personaId;
  draft.updatedAt = nowIso();

  audit("draft.account.updated", "DraftPost", draft.id, {
    previousAccountId,
    nextAccountId: draft.xAccountId,
    previousPersonaId,
    nextPersonaId: draft.personaId
  });

  return { draft };
}

export function approveDraft(draftId: string, input?: { comment?: string }) {
  const draft = store.drafts.find((item) => item.id === draftId);
  if (!draft) {
    throw new Error("Draft not found.");
  }

  draft.status = "APPROVED";
  draft.updatedAt = nowIso();

  const approval: Approval = {
    id: id("approval"),
    draftPostId: draft.id,
    reviewerId: currentUser.id,
    decision: "APPROVED",
    comment: input?.comment,
    createdAt: nowIso()
  };
  store.approvals.unshift(approval);
  audit("draft.approved", "DraftPost", draft.id, { comment: input?.comment ?? null });
  return { draft, approval };
}

export function updateDraft(
  draftId: string,
  input: { text: string; rationale?: string }
): { draft: DraftPost; reviewReset: boolean } {
  const draft = store.drafts.find((item) => item.id === draftId);
  if (!draft) {
    throw new Error("Draft not found.");
  }

  const validation = validateDraftEditRequest({ draft, text: input.text });
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const previousStatus = draft.status;
  const previousRiskLevel = draft.riskLevel;
  const reviewReset = previousStatus === "APPROVED";

  draft.text = validation.text;
  draft.rationale = input.rationale?.trim() || draft.rationale || "Edited by reviewer.";
  draft.hashtags = extractHashtags(validation.text);
  draft.riskLevel = validation.riskLevel;
  draft.riskReasons = validation.riskReasons;
  draft.status = validation.riskLevel === "HIGH" || reviewReset ? "NEEDS_REVIEW" : "CANDIDATE";
  draft.updatedAt = nowIso();

  audit("draft.edited", "DraftPost", draft.id, {
    previousStatus,
    nextStatus: draft.status,
    previousRiskLevel,
    nextRiskLevel: draft.riskLevel,
    reviewReset
  });

  return { draft, reviewReset };
}

export function deleteDraft(draftId: string) {
  const index = store.drafts.findIndex((item) => item.id === draftId);
  if (index === -1) {
    throw new Error("Draft not found.");
  }

  const draft = store.drafts[index];
  if (draft.status === "SCHEDULED" || draft.status === "PUBLISHED") {
    throw new Error("Scheduled or published drafts cannot be deleted from the review queue.");
  }

  store.drafts.splice(index, 1);
  audit("draft.deleted", "DraftPost", draft.id, {
    status: draft.status,
    xAccountId: draft.xAccountId
  });
  return draft;
}

export function schedulePost(input: {
  draftPostId?: string;
  interactionSuggestionId?: string;
  xAccountId: string;
  finalText: string;
  scheduledFor: string;
  replyToPostId?: string;
  quotePostId?: string;
}) {
  const draft = input.draftPostId ? store.drafts.find((item) => item.id === input.draftPostId) : undefined;
  const interaction = input.interactionSuggestionId
    ? store.interactions.find((item) => item.id === input.interactionSuggestionId)
    : undefined;
  const account = store.xAccounts.find((item) => item.id === input.xAccountId);

  if (!account) {
    throw new Error("X account not found.");
  }

  const scheduledFor = new Date(input.scheduledFor);
  if (Number.isNaN(scheduledFor.getTime())) {
    throw new Error("Invalid scheduled time.");
  }

  const validation = validateScheduleRequest({
    workspace,
    scheduledPosts: store.scheduledPosts,
    draft,
    xAccountId: account.id,
    text: input.finalText,
    scheduledFor
  });

  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const scheduledPost: ScheduledPost = {
    id: id("scheduled"),
    workspaceId: workspace.id,
    draftPostId: draft?.id,
    interactionSuggestionId: interaction?.id,
    xAccountId: account.id,
    finalText: truncateForX(input.finalText),
    scheduledFor: scheduledFor.toISOString(),
    status: "QUEUED",
    duplicateGroupKey: validation.duplicateGroupKey,
    replyToPostId: input.replyToPostId,
    quotePostId: input.quotePostId,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  if (draft) {
    draft.status = "SCHEDULED";
    draft.updatedAt = nowIso();
  }
  if (interaction) {
    interaction.status = "APPROVED";
    interaction.updatedAt = nowIso();
  }

  store.scheduledPosts.push(scheduledPost);
  audit("post.scheduled", "ScheduledPost", scheduledPost.id, {
    draftPostId: draft?.id ?? null,
    interactionSuggestionId: interaction?.id ?? null,
    xAccountId: account.id,
    scheduledFor: scheduledPost.scheduledFor,
    replyToPostId: input.replyToPostId ?? null,
    quotePostId: input.quotePostId ?? null
  });
  return scheduledPost;
}

export function updateScheduledPost(id: string, input: { scheduledFor: string }) {
  const scheduledPost = store.scheduledPosts.find((item) => item.id === id);
  if (!scheduledPost) {
    throw new Error("Scheduled post not found.");
  }
  if (!["QUEUED", "FAILED"].includes(scheduledPost.status)) {
    throw new Error("Only queued or failed scheduled posts can be rescheduled.");
  }

  const scheduledFor = new Date(input.scheduledFor);
  if (Number.isNaN(scheduledFor.getTime())) {
    throw new Error("Invalid scheduled time.");
  }

  const draft = scheduledPost.draftPostId ? store.drafts.find((item) => item.id === scheduledPost.draftPostId) : undefined;
  const validation = validateScheduleRequest({
    workspace,
    scheduledPosts: store.scheduledPosts.filter((item) => item.id !== scheduledPost.id),
    xAccountId: scheduledPost.xAccountId,
    text: scheduledPost.finalText,
    scheduledFor
  });
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  scheduledPost.scheduledFor = scheduledFor.toISOString();
  scheduledPost.status = "QUEUED";
  scheduledPost.lastError = undefined;
  scheduledPost.duplicateGroupKey = validation.duplicateGroupKey;
  scheduledPost.updatedAt = nowIso();
  if (draft) {
    draft.status = "SCHEDULED";
    draft.updatedAt = nowIso();
  }
  audit("post.rescheduled", "ScheduledPost", scheduledPost.id, {
    scheduledFor: scheduledPost.scheduledFor
  });
  return scheduledPost;
}

export function cancelScheduledPost(id: string) {
  const scheduledPost = store.scheduledPosts.find((item) => item.id === id);
  if (!scheduledPost) {
    throw new Error("Scheduled post not found.");
  }
  if (["PUBLISHED", "PUBLISHING", "CANCELED"].includes(scheduledPost.status)) {
    throw new Error("Only queued or failed scheduled posts can be canceled.");
  }

  scheduledPost.status = "CANCELED";
  scheduledPost.lastError = undefined;
  scheduledPost.updatedAt = nowIso();

  const draft = scheduledPost.draftPostId ? store.drafts.find((item) => item.id === scheduledPost.draftPostId) : undefined;
  if (draft?.status === "SCHEDULED") {
    draft.status = "APPROVED";
    draft.updatedAt = nowIso();
  }
  const interaction = scheduledPost.interactionSuggestionId
    ? store.interactions.find((item) => item.id === scheduledPost.interactionSuggestionId)
    : undefined;
  if (interaction?.status === "APPROVED") {
    interaction.status = "SUGGESTED";
    interaction.updatedAt = nowIso();
  }
  audit("post.schedule_canceled", "ScheduledPost", scheduledPost.id, {});
  return scheduledPost;
}

export function approveInteraction(interactionId: string) {
  const interaction = store.interactions.find((item) => item.id === interactionId);
  if (!interaction) {
    throw new Error("Interaction suggestion not found.");
  }

  const sourcePost = store.sourcePosts.find((item) => item.id === interaction.sourcePostId);
  const account = store.xAccounts.find((item) => item.id === interaction.xAccountId);
  if (!sourcePost || !account) {
    throw new Error("Interaction source or account missing.");
  }

  const apiEligibility = canApproveInteractionForApi({ interaction, sourcePost, account });
  interaction.status = apiEligibility.ok ? "APPROVED" : "BLOCKED";
  interaction.updatedAt = nowIso();

  audit("interaction.reviewed", "InteractionSuggestion", interaction.id, {
    status: interaction.status,
    reason: apiEligibility.ok ? null : apiEligibility.reason
  });

  return {
    interaction,
    apiEligible: apiEligibility.ok,
    reason: apiEligibility.ok ? undefined : apiEligibility.reason
  };
}

export function cancelInteraction(interactionId: string) {
  const interaction = store.interactions.find((item) => item.id === interactionId);
  if (!interaction) {
    throw new Error("Interaction suggestion not found.");
  }
  if (interaction.status === "EXECUTED") {
    throw new Error("Executed interaction suggestions cannot be canceled.");
  }

  const previousStatus = interaction.status;
  interaction.status = "REJECTED";
  interaction.updatedAt = nowIso();

  audit("interaction.rejected", "InteractionSuggestion", interaction.id, {
    previousStatus
  });

  return { interaction };
}

export function regenerateReplyInteraction(interactionId: string) {
  const interaction = store.interactions.find((item) => item.id === interactionId);
  if (!interaction) {
    throw new Error("Reply suggestion not found.");
  }
  if (interaction.type !== "REPLY") {
    throw new Error("Only reply suggestions can be regenerated.");
  }
  if (!["SUGGESTED", "BLOCKED"].includes(interaction.status)) {
    throw new Error("Only pending reply suggestions can be regenerated.");
  }

  const sourcePost = store.sourcePosts.find((item) => item.id === interaction.sourcePostId);
  if (!sourcePost) {
    throw new Error("Reply source not found.");
  }

  interaction.suggestedText =
    sourcePost.text.length > 80
      ? "That is a useful way to frame it. The part I would double-click is where this shows up in the actual workflow."
      : "That is fair. What part of this felt most true from your side?";
  interaction.riskLevel = "LOW";
  interaction.riskReasons = [];
  interaction.status = "SUGGESTED";
  interaction.updatedAt = nowIso();

  audit("interaction.regenerated", "InteractionSuggestion", interaction.id, {
    sourcePostId: interaction.sourcePostId,
    xAccountId: interaction.xAccountId
  });

  return { interaction };
}

export function getAnalyticsForAccount(accountId: string): AccountAnalytics {
  const account = store.xAccounts.find((item) => item.id === accountId);
  if (!account) {
    throw new Error("X account not found.");
  }

  return analyticsFor(account);
}

export function getEntityRefs() {
  return {
    workspace,
    currentUser,
    personas: store.personas,
    xAccounts: store.xAccounts,
    companyMaterials: store.companyMaterials,
    roleInputTemplates: store.roleInputTemplates,
    weeklyInputs: store.weeklyInputs,
    sourcePosts: store.sourcePosts,
    trends: store.trends
  };
}
