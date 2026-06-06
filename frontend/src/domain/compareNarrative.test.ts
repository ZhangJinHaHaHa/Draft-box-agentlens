import { describe, expect, it } from "vitest";

import type { AgentCatalogEntry } from "./catalog";
import { buildCompareNarrative } from "./compareNarrative";

function makeAgent(overrides: Partial<AgentCatalogEntry> & { id: string; name: string }): AgentCatalogEntry {
  return {
    source: "marketplace",
    intro: { zh: "占位", en: "placeholder" },
    category: "Expert",
    tags: [],
    scenarios: [{ id: "tax-planning", label: { zh: "税务筹划", en: "Tax planning" } }],
    unsuitableScenarios: [],
    recommendedFor: [],
    riskLevel: "low",
    riskNotes: [],
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: false,
    ...overrides
  };
}

describe("buildCompareNarrative", () => {
  it("returns empty string for fewer than 2 agents", () => {
    const one = [makeAgent({ id: "a", name: "A" })];
    expect(buildCompareNarrative(one, { conclusion: "manual-judgment" }, "zh")).toBe("");
  });

  it("names the winner for a try-first conclusion", () => {
    const agents = [
      makeAgent({ id: "a", name: "甲顾问" }),
      makeAgent({ id: "b", name: "乙顾问", riskLevel: "medium" })
    ];
    const text = buildCompareNarrative(agents, { conclusion: "try-first", winnerId: "a" }, "zh");
    expect(text).toContain("甲顾问");
    expect(text.length).toBeGreaterThan(0);
  });

  it("flags no clear winner for a manual-judgment conclusion", () => {
    const agents = [makeAgent({ id: "a", name: "A" }), makeAgent({ id: "b", name: "B" })];
    const text = buildCompareNarrative(agents, { conclusion: "manual-judgment" }, "zh");
    expect(text).toContain("没有明显赢家");
  });

  it("points at the cheapest comparable price and ignores percentage-only pricing", () => {
    const agents = [
      makeAgent({ id: "a", name: "贵的", pricingHint: { zh: "¥299 / 次", en: "¥299 per call" } }),
      makeAgent({ id: "b", name: "便宜的", pricingHint: { zh: "¥99 / 次", en: "¥99 per call" } }),
      makeAgent({ id: "c", name: "抽成的", pricingHint: { zh: "按 5% 收费", en: "5% fee" } })
    ];
    const text = buildCompareNarrative(agents, { conclusion: "try-first", winnerId: "a" }, "zh");
    // Cheapest of the two ¥-priced ones is named; the percentage-only agent is not the cheapest.
    expect(text).toContain("便宜的");
    expect(text).toContain("¥99");
    expect(text).not.toContain("抽成的（");
  });

  it("produces distinct non-empty prose for zh and en", () => {
    const agents = [
      makeAgent({ id: "a", name: "Alpha" }),
      makeAgent({ id: "b", name: "Beta", riskLevel: "medium" })
    ];
    const result = { conclusion: "try-first", winnerId: "a" } as const;
    const zh = buildCompareNarrative(agents, result, "zh");
    const en = buildCompareNarrative(agents, result, "en");
    expect(zh).not.toBe("");
    expect(en).not.toBe("");
    expect(zh).not.toBe(en);
    expect(en).toContain("Alpha");
  });

  it("anchors the opening on a shared scenario when all agents share one", () => {
    const agents = [
      makeAgent({ id: "a", name: "A" }),
      makeAgent({ id: "b", name: "B" })
    ];
    const text = buildCompareNarrative(agents, { conclusion: "manual-judgment" }, "zh");
    expect(text).toContain("税务筹划");
  });
});
