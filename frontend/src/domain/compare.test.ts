import { describe, expect, it } from "vitest";

import type { AgentCatalogEntry } from "./catalog";
import { compareAgents, getCompareAttributeDiffs } from "./compare";

const baseEntry: AgentCatalogEntry = {
  id: "base",
  source: "curated",
  name: "Base Agent",
  intro: { zh: "测试", en: "Fixture" },
  category: "test",
  tags: [],
  scenarios: [],
  unsuitableScenarios: [],
  recommendedFor: [],
  riskLevel: "low",
  riskNotes: [],
  accessTypes: ["api"],
  complexity: "low",
  hasOnboardingGuide: true
};

function entry(overrides: Partial<AgentCatalogEntry>): AgentCatalogEntry {
  return { ...baseEntry, ...overrides };
}

describe("compareAgents", () => {
  it("selects a clear low-risk, low-complexity, observed option as try-first", () => {
    const result = compareAgents([
      entry({
        id: "winner",
        latestObservedAt: "2026-06-05",
        observationSummary: { zh: "已观察", en: "Observed" }
      }),
      entry({
        id: "runner-up",
        riskLevel: "medium",
        complexity: "medium",
        hasOnboardingGuide: false
      })
    ]);

    expect(result).toEqual({ conclusion: "try-first", winnerId: "winner" });
  });

  it("requires manual judgment when the scores are too close", () => {
    const result = compareAgents([
      entry({ id: "a" }),
      entry({ id: "b" })
    ]);

    expect(result).toEqual({ conclusion: "manual-judgment" });
  });

  it("avoids all high-risk options that lack chain or audit evidence", () => {
    const result = compareAgents([
      entry({ id: "a", riskLevel: "high" }),
      entry({ id: "b", riskLevel: "high", complexity: "medium" })
    ]);

    expect(result.conclusion).toBe("avoid-for-now");
  });

  it("marks audited but complex options as formal integration work", () => {
    const result = compareAgents([
      entry({
        id: "audited",
        complexity: "high",
        chainEvidence: {
          auditPassed: true,
          reportHash: "0xabc",
          attestationHash: "0xdef",
          reputationScore: 800
        }
      }),
      entry({ id: "ordinary", riskLevel: "medium", complexity: "medium" })
    ]);

    expect(result).toEqual({
      conclusion: "formal-integration",
      winnerId: "audited"
    });
  });

  it("identifies which comparison attributes differ across selected agents", () => {
    const differences = getCompareAttributeDiffs([
      entry({
        id: "a",
        riskLevel: "low",
        complexity: "low",
        seller: {
          kind: "solo",
          label: { zh: "个人专家", en: "Solo expert" },
          contextScale: { zh: "案卷库", en: "Case files" }
        }
      }),
      entry({
        id: "b",
        riskLevel: "high",
        complexity: "low",
        seller: {
          kind: "firm",
          label: { zh: "机构团队", en: "Firm team" },
          contextScale: { zh: "机构知识库", en: "Firm knowledge base" }
        }
      })
    ]);

    expect(differences.riskLevel).toBe(true);
    expect(differences.complexity).toBe(false);
    expect(differences.trustTier).toBe(false);
    expect(differences.seller).toBe(true);
  });

  it("identifies runtime security differences across same-category marketplace agents", () => {
    const differences = getCompareAttributeDiffs([
      entry({
        id: "platform-image",
        source: "marketplace",
        category: "Legal expert agent",
        runtimeSecurity: {
          kind: "platform_image",
          label: { zh: "平台镜像已识别", en: "Platform image recognized" },
          description: { zh: "平台可在云端受控运行。", en: "The platform can run it in a controlled cloud runtime." }
        }
      }),
      entry({
        id: "seller-hosted",
        source: "marketplace",
        category: "Legal expert agent",
        runtimeSecurity: {
          kind: "seller_hosted",
          label: { zh: "未识别镜像", en: "Image not recognized" },
          description: { zh: "买家输入可能暴露给卖家运行环境。", en: "Buyer input may be exposed to the seller runtime." }
        }
      })
    ]);

    expect(differences.runtimeSecurity).toBe(true);
  });
});
