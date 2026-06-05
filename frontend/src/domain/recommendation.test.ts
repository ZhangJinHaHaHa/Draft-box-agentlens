import { describe, expect, it } from "vitest";

import type { AgentCatalogEntry } from "./catalog";
import { recommendAgents } from "./recommendation";

const supportAgent: AgentCatalogEntry = {
  id: "support-agent",
  source: "listed",
  name: "Support Agent",
  vendor: "Example",
  intro: { zh: "客服知识库自动问答", en: "Customer support knowledge base automation" },
  category: "Support",
  tags: ["support", "knowledge"],
  scenarios: [{ id: "customer-support", label: { zh: "客服自动化", en: "Customer support automation" } }],
  unsuitableScenarios: [{ id: "ide-coding", label: { zh: "IDE 内编程", en: "In-IDE coding" } }],
  recommendedFor: [{ zh: "客服团队", en: "Support teams" }],
  riskLevel: "low",
  riskNotes: [],
  accessTypes: ["saas", "api"],
  complexity: "low",
  hasOnboardingGuide: false
};

const codingAgent: AgentCatalogEntry = {
  id: "coding-agent",
  source: "curated",
  name: "Coding Agent",
  vendor: "Example",
  intro: { zh: "IDE 多文件编码助手", en: "IDE coding assistant for multi-file edits" },
  category: "Coding",
  tags: ["ide", "coding"],
  scenarios: [
    { id: "ide-coding", label: { zh: "IDE 内编程", en: "In-IDE coding" } },
    { id: "developer-assistant", label: { zh: "研发助手", en: "Developer assistant" } }
  ],
  unsuitableScenarios: [{ id: "customer-support", label: { zh: "客服自动化", en: "Customer support automation" } }],
  recommendedFor: [{ zh: "研发团队", en: "Engineering teams" }],
  riskLevel: "medium",
  riskNotes: [],
  accessTypes: ["local", "saas"],
  complexity: "medium",
  hasOnboardingGuide: true
};

const browserAgent: AgentCatalogEntry = {
  id: "browser-agent",
  source: "listed",
  name: "Browser Operator",
  vendor: "Example",
  intro: { zh: "浏览器操作自动化", en: "Browser task automation" },
  category: "Automation",
  tags: ["browser", "automation"],
  scenarios: [{ id: "workflow-automation", label: { zh: "流程自动化", en: "Workflow automation" } }],
  unsuitableScenarios: [],
  recommendedFor: [{ zh: "早期试验团队", en: "Early teams" }],
  riskLevel: "high",
  riskNotes: [],
  accessTypes: ["saas"],
  complexity: "medium",
  hasOnboardingGuide: false
};

const entries = [supportAgent, codingAgent, browserAgent];

describe("recommendAgents", () => {
  it("infers customer support intent from natural language", () => {
    const results = recommendAgents(entries, {
      query: "需要一个低风险 客服 知识库 API 工具"
    });

    expect(results[0].entry.id).toBe("support-agent");
    expect(results[0].matchedScenarioIds).toContain("customer-support");
    expect(results[0].reasons.length).toBeGreaterThan(0);
  });

  it("handles compact Chinese queries without whitespace", () => {
    const results = recommendAgents(entries, {
      query: "客服知识库API低风险"
    });

    expect(results[0].entry.id).toBe("support-agent");
    expect(results[0].matchedScenarioIds).toContain("customer-support");
  });

  it("keeps unsuitable scenarios from winning on source weight alone", () => {
    const results = recommendAgents(entries, {
      query: "support",
      scenarioIds: ["customer-support"],
      limit: 2
    });

    expect(results.map((result) => result.entry.id)).toEqual(["support-agent", "browser-agent"]);
  });

  it("honors self-host and IDE coding preferences", () => {
    const results = recommendAgents(entries, {
      query: "本地 IDE coding",
      priorities: ["self-host"],
      limit: 1
    });

    expect(results[0].entry.id).toBe("coding-agent");
  });

  it("penalizes high-risk agents when the request asks for low risk", () => {
    const results = recommendAgents(entries, {
      query: "自动化 低风险",
      scenarioIds: ["workflow-automation"],
      maxRiskLevel: "low"
    });

    const browserIndex = results.findIndex((result) => result.entry.id === "browser-agent");
    expect(browserIndex === -1 || browserIndex > 0).toBe(true);
  });
});
