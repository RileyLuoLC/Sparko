import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { id: "workspace_demo" },
    update: {},
    create: {
      id: "workspace_demo",
      name: "Example Studio",
      defaultLanguage: "en",
      defaultWoeid: 1,
      appTimezone: "Asia/Shanghai",
      targetMarketTimezone: "America/New_York"
    }
  });

  const user = await prisma.user.upsert({
    where: {
      workspaceId_email: {
        workspaceId: workspace.id,
        email: "ops@example.com"
      }
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      email: "ops@example.com",
      name: "Ops Reviewer",
      role: "ADMIN"
    }
  });

  const persona = await prisma.persona.upsert({
    where: { id: "persona_product" },
    update: {},
    create: {
      id: "persona_product",
      workspaceId: workspace.id,
      name: "Product Voice",
      roleLabel: "Product",
      voice: "specific, user-centered, concise",
      audience: "product teams evaluating AI workflow tools",
      guardrails: "Ground posts in workflow observations and avoid roadmap promises.",
      defaultHashtags: ["#Product", "#AI"]
    }
  });

  await prisma.xAccount.upsert({
    where: {
      workspaceId_xUserId: {
        workspaceId: workspace.id,
      xUserId: "demo_company_user"
      }
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      personaId: persona.id,
      xUserId: "demo_company_user",
      username: "demo_company",
      displayName: "Demo Company",
      kind: "COMPANY",
      quotePostsEnabled: false,
      repliesEnabled: true
    }
  });

  const founderPersona = await prisma.persona.upsert({
    where: { id: "persona_founder" },
    update: {},
    create: {
      id: "persona_founder",
      workspaceId: workspace.id,
      name: "Founder Voice",
      roleLabel: "Founder",
      voice: "clear, practical, founder-led",
      audience: "builders, operators, and early customers",
      contentPillars: ["building lessons", "product decisions", "customer learnings"],
      guardrails: "Keep posts specific, grounded, and non-salesy.",
      defaultHashtags: []
    }
  });

  await prisma.xAccount.upsert({
    where: {
      workspaceId_xUserId: {
        workspaceId: workspace.id,
        xUserId: "demo_personal_user"
      }
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      personaId: founderPersona.id,
      xUserId: "demo_personal_user",
      username: "demo_personal",
      displayName: "Demo Personal",
      kind: "PERSONAL",
      quotePostsEnabled: false,
      repliesEnabled: true
    }
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      action: "seed.completed",
      entityType: "Workspace",
      entityId: workspace.id,
      metadata: { source: "prisma/seed.ts" }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
