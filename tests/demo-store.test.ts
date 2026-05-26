import { describe, expect, it } from "vitest";
import {
  acceptBriefAsDraft,
  acceptDraftCandidate,
  addRoleInputTemplate,
  addWeeklyRoleInput,
  deleteRoleInputTemplate,
  deleteWeeklyRoleInput,
  getDashboardData,
  getEntityRefs,
  updateXAccountRoles,
  updateRoleInputTemplate,
  updateWeeklyRoleInput
} from "../src/lib/demo-store";

describe("demo store draft flow", () => {
  it("seeds investor and creator weekly input templates in the intended role order", () => {
    const templates = getDashboardData().roleInputTemplates;
    const roles = [...new Set(templates.map((template) => template.roleName))];
    const companyTemplates = templates.filter((template) => template.roleName === "Company Official Account");
    const founderTemplates = templates.filter((template) => template.roleName === "Founder");
    const investorTemplates = templates.filter((template) => template.roleName === "Investor");
    const creatorTemplates = templates.filter((template) => template.roleName === "Creator");
    const engineerTemplates = templates.filter((template) => template.roleName === "Engineer");
    const designerTemplates = templates.filter((template) => template.roleName === "Designer");
    const growthTemplates = templates.filter((template) => template.roleName === "Growth");
    const pmTemplates = templates.filter((template) => template.roleName === "PM");

    expect(roles.slice(0, 4)).toEqual(["Company Official Account", "Founder", "Investor", "Creator"]);
    expect(companyTemplates.map((template) => template.contentType)).toEqual([
      "Company POV",
      "Customer proof",
      "Educational guide",
      "Product insight",
      "Product update",
      "Use case"
    ]);
    expect(founderTemplates.map((template) => template.contentType)).toEqual([
      "Build in public",
      "Customer insight",
      "Founder framework / checklist",
      "Founder story / belief",
      "Hiring / culture",
      "Mistake / postmortem",
      "Product decision",
      "Strong opinion / industry thesis"
    ]);
    expect(investorTemplates).toHaveLength(6);
    expect(creatorTemplates).toHaveLength(6);
    expect(investorTemplates.map((template) => template.contentType)).toEqual([
      "Deal flow focus",
      "Evidence-backed contrarian thesis",
      "Founder advice",
      "Industry thesis / market map",
      "Lightweight deal memo",
      "Mistake / missed call"
    ]);
    expect(creatorTemplates.map((template) => template.contentType)).toEqual([
      "Before / after",
      "Experiment / data recap",
      "Finished work + process",
      "Participation / feedback",
      "Taste / stance",
      "Tutorial / checklist"
    ]);
    expect(engineerTemplates.map((template) => template.contentType)).toEqual([
      "Architecture / system design",
      "Benchmark / comparison",
      "Build in public / demo",
      "Code snippet / tool script",
      "Debugging / pitfall recap",
      "Learning roadmap",
      "Paper / new tech takeaway",
      "Real workflow / stack",
      "Strong technical opinion",
      "Technical poll / debate"
    ]);
    expect(designerTemplates.map((template) => template.contentType)).toEqual([
      "Before / after redesign",
      "Career / real experience",
      "Design checklist / cheatsheet",
      "Design decision rationale",
      "Design principle + example",
      "Discussion prompt",
      "Mini case study",
      "UX critique / teardown"
    ]);
    expect(growthTemplates.map((template) => template.contentType)).toEqual([
      "Contrarian growth POV",
      "Failure lesson",
      "Field observation",
      "Growth experiment recap",
      "Growth framework / checklist",
      "Growth model teardown",
      "Metric interpretation",
      "Template / swipe file"
    ]);
    expect(pmTemplates.map((template) => template.contentType)).toEqual([
      "Builder log",
      "Career / interview lesson",
      "Contrarian PM POV",
      "Decision trade-off",
      "Framework / checklist",
      "Product teardown",
      "Project retrospective",
      "User research observation"
    ]);
  });

  it("keeps generated candidates in review instead of approving them automatically", () => {
    const refs = getEntityRefs();
    const account = refs.xAccounts[0];
    const persona = refs.personas.find((item) => item.id === account.personaId) ?? refs.personas[0];
    const approvalCountBefore = getDashboardData().approvals.length;

    const result = acceptDraftCandidate({
      accountId: account.id,
      personaId: persona.id,
      candidate: {
        text: "A good review step should make the final post feel calmer, not slower.",
        rationale: "Kept from generated options.",
        hashtags: [],
        riskLevel: "LOW",
        riskReasons: [],
        sourcePostId: undefined,
        trendSnapshotId: undefined
      }
    });

    expect(result.draft.status).toBe("CANDIDATE");
    expect(getDashboardData().approvals.length).toBe(approvalCountBefore);
  });

  it("lets one X account carry multiple weekly input roles", () => {
    const companyAccount = getDashboardData().xAccounts.find((account) => account.id === "x_company");

    expect(companyAccount?.roleLabels).toEqual(["Company Official Account", "PM", "Growth"]);

    const updatedAccount = updateXAccountRoles("x_company", ["Growth", "Company Official Account"]);
    expect(updatedAccount.roleLabels).toEqual(["Company Official Account", "Growth"]);
  });

  it("supports custom role input templates and weekly inputs", () => {
    const template = addRoleInputTemplate({
      roleName: "Founder",
      contentType: "Changed my mind",
      prompt: "What did you change your mind about this week?",
      example: "I used to think X, but this week Y changed my mind."
    });

    expect(template.isDefault).toBe(false);
    expect(getDashboardData().roleInputTemplates.some((item) => item.id === template.id)).toBe(true);

    const updatedTemplate = updateRoleInputTemplate(template.id, {
      contentType: "Changed my mind / lesson",
      isActive: true
    });
    expect(updatedTemplate.contentType).toBe("Changed my mind / lesson");

    const founderAccount = getEntityRefs().xAccounts.find((account) => account.id === "x_founder") ?? getEntityRefs().xAccounts[0];
    const weeklyInput = addWeeklyRoleInput({
      xAccountId: founderAccount.id,
      roleInputTemplateId: template.id,
      content: "A customer cared less about speed and more about knowing exactly what changed.",
      evidenceUrl: "https://example.com/customer-note",
      weekOf: "2026-05-18"
    });

    expect(weeklyInput.roleName).toBe("Founder");
    expect(weeklyInput.xAccountId).toBe(founderAccount.id);
    expect(weeklyInput.contentType).toBe("Changed my mind / lesson");
    expect(getEntityRefs().weeklyInputs.some((item) => item.id === weeklyInput.id)).toBe(true);

    const updatedInput = updateWeeklyRoleInput(weeklyInput.id, {
      content: "A customer cared less about speed and more about trusting each change."
    });
    expect(updatedInput.content).toContain("trusting each change");

    deleteWeeklyRoleInput(weeklyInput.id);
    deleteRoleInputTemplate(template.id);
  });

  it("can save selected weekly input content as an approved draft", () => {
    const refs = getEntityRefs();
    const weeklyInput = refs.weeklyInputs[0];
    const account = refs.xAccounts[0];
    const persona = refs.personas.find((item) => item.id === account.personaId) ?? refs.personas[0];

    const result = acceptBriefAsDraft({
      text: `${weeklyInput.content} (${Date.now()})`,
      accountId: account.id,
      personaId: persona.id
    });

    expect(result.draft.status).toBe("APPROVED");
    expect(result.draft.text).toContain(weeklyInput.content);
  });
});
