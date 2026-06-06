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
      entry({ id: "a", riskLevel: "low", complexity: "low" }),
      entry({ id: "b", riskLevel: "high", complexity: "low" })
    ]);

    expect(differences.riskLevel).toBe(true);
    expect(differences.complexity).toBe(false);
    expect(differences.trustTier).toBe(false);
  });
});
