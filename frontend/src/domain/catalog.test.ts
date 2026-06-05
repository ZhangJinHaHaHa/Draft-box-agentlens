import { describe, expect, it } from "vitest";

import { curatedAgents } from "@/data/catalog/curated";
import { listedAgents } from "@/data/catalog/listed";
import { listOnboardingGuides } from "@/data/catalog/onboarding";
import { mergeCatalog, type AgentCatalogEntry } from "./catalog";
import { computeTrustTier } from "./trustTier";

const fakeNative: AgentCatalogEntry[] = [
  {
    id: "1",
    source: "native",
    name: "Native Demo",
    intro: { zh: "原生", en: "Native demo" },
    category: "Native",
    tags: ["native"],
    scenarios: [],
    unsuitableScenarios: [],
    recommendedFor: [],
    riskLevel: "medium",
    riskNotes: [],
    accessTypes: ["api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    tokenId: "1",
    chainEvidence: { auditPassed: true, reportHash: "0xabc", attestationHash: "0xdef" }
  },
  {
    id: "cursor",
    source: "native",
    name: "Cursor",
    intro: { zh: "原生 Cursor", en: "Native Cursor twin" },
    category: "Native",
    tags: ["native"],
    scenarios: [],
    unsuitableScenarios: [],
    recommendedFor: [],
    riskLevel: "low",
    riskNotes: [],
    accessTypes: ["api"],
    complexity: "low",
    hasOnboardingGuide: false,
    tokenId: "2",
    chainEvidence: { auditPassed: true, reportHash: "0xreport", attestationHash: "0xatt" }
  }
];

describe("curated/listed/native catalog", () => {
  it("ships at least 10 curated agents", () => {
    expect(curatedAgents.length).toBeGreaterThanOrEqual(10);
  });

  it("ships at least 15 listed agents", () => {
    expect(listedAgents.length).toBeGreaterThanOrEqual(15);
  });

  it("every curated agent has a matching onboarding guide", () => {
    const guideIds = new Set(listOnboardingGuides().map((g) => g.agentId));
    for (const entry of curatedAgents) {
      expect(guideIds.has(entry.id), `missing onboarding for ${entry.id}`).toBe(true);
    }
  });

  it("curated agents that match a native id merge chain evidence in", () => {
    const merged = mergeCatalog({
      curated: curatedAgents,
      listed: listedAgents,
      native: fakeNative
    });
    const cursor = merged.byId.get("cursor");
    expect(cursor?.chainEvidence?.attestationHash).toBe("0xatt");
    expect(cursor?.tokenId).toBe("2");
    // The remaining native agent (token #1) becomes its own entry.
    expect(merged.bySource.native.find((entry) => entry.id === "1")).toBeDefined();
    expect(merged.bySource.native.length).toBe(1);
  });

  it("never auto-promotes curated agents to Tier 3 without chain evidence", () => {
    for (const entry of curatedAgents) {
      const tier = computeTrustTier({ entry }).tier;
      expect(tier).toBeLessThanOrEqual(2);
    }
  });

  it("listed agents without observation default to Tier 0", () => {
    for (const entry of listedAgents) {
      const tier = computeTrustTier({ entry }).tier;
      expect(tier).toBe(0);
    }
  });
});
