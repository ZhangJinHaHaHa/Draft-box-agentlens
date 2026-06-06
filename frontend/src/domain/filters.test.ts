import { describe, expect, it } from "vitest";

import type { AgentCatalogEntry } from "./catalog";
import { curatedAgents } from "@/data/catalog/curated";
import { listedAgents } from "@/data/catalog/listed";
import {
  applyFilters,
  buildCatalogFacets,
  EMPTY_FILTERS,
  getActiveFilterChips,
  filtersToSearchParams,
  mergeFiltersToSearchParams,
  removeFilterChip,
  searchParamsToFilters,
  suggestFilterRelaxation
} from "./filters";

const baseEntry: AgentCatalogEntry = {
  id: "fixture",
  source: "curated",
  name: "Fixture Agent",
  intro: { zh: "测试介绍 customer support", en: "Fixture intro for customer support" },
  category: "test",
  tags: ["coding"],
  scenarios: [{ id: "ide-coding", label: { zh: "IDE 内编程", en: "In-IDE coding" } }],
  unsuitableScenarios: [],
  recommendedFor: [],
  riskLevel: "low",
  riskNotes: [],
  accessTypes: ["api"],
  complexity: "low",
  hasOnboardingGuide: true
};

const nativeEntry: AgentCatalogEntry = {
  ...baseEntry,
  id: "native-1",
  source: "native",
  name: "Native Agent",
  tokenId: "1",
  hasOnboardingGuide: false,
  chainEvidence: { auditPassed: true, reportHash: "0xabc" },
  nativePricing: { rentable: true }
};

describe("applyFilters", () => {
  it("returns all entries when filters are empty", () => {
    const result = applyFilters([baseEntry, nativeEntry], EMPTY_FILTERS);
    expect(result).toHaveLength(2);
  });

  it("matches keyword across name, intro, tag and scenario", () => {
    expect(
      applyFilters([baseEntry, nativeEntry], { ...EMPTY_FILTERS, query: "support" })
    ).toHaveLength(2);
    expect(
      applyFilters([baseEntry, nativeEntry], { ...EMPTY_FILTERS, query: "ide" })
    ).toHaveLength(2);
    expect(
      applyFilters([baseEntry, nativeEntry], { ...EMPTY_FILTERS, query: "nothing-matches" })
    ).toHaveLength(0);
  });

  it("matches keyword across recommendation, risk, mitigation, and observation copy", () => {
    const entry = {
      ...baseEntry,
      recommendedFor: [{ zh: "企业知识库试点", en: "enterprise knowledge base pilots" }],
      riskNotes: [{ zh: "需要人工复核输出", en: "requires human review before rollout" }],
      riskMitigation: [{ zh: "先在沙盒验证", en: "start with sandbox validation" }],
      observationSummary: { zh: "近期价格稳定", en: "recent pricing stayed stable" }
    };

    expect(applyFilters([entry], { ...EMPTY_FILTERS, query: "enterprise" })).toEqual([entry]);
    expect(applyFilters([entry], { ...EMPTY_FILTERS, query: "人工复核" })).toEqual([entry]);
    expect(applyFilters([entry], { ...EMPTY_FILTERS, query: "sandbox" })).toEqual([entry]);
    expect(applyFilters([entry], { ...EMPTY_FILTERS, query: "价格稳定" })).toEqual([entry]);
  });

  it("composes 'native + rentable + has audit'", () => {
    const result = applyFilters([baseEntry, nativeEntry], {
      ...EMPTY_FILTERS,
      sources: ["native"],
      hasAudit: true,
      rentable: true
    });
    expect(result).toEqual([nativeEntry]);
  });

  it("matches explicit category, price, audit status, and score band filters", () => {
    const paidEntry: AgentCatalogEntry = {
      ...baseEntry,
      id: "paid",
      category: "workflow",
      pricingHint: { zh: "付费订阅", en: "Paid subscription" },
      chainEvidence: { auditPassed: false, reportHash: "0xdef" },
      trustTierHint: 0
    };
    const freeEntry: AgentCatalogEntry = {
      ...baseEntry,
      id: "free",
      category: "coding",
      pricingHint: { zh: "免费试用", en: "Free trial" },
      chainEvidence: {
        auditPassed: true,
        reportHash: "0xabc",
        attestationHash: "0xdef",
        reputationScore: 700
      },
      trustTierHint: 3
    };

    expect(
      applyFilters([paidEntry, freeEntry, nativeEntry], {
        ...EMPTY_FILTERS,
        categories: ["coding"],
        priceModes: ["free"],
        auditStatuses: ["passed"],
        scoreBands: ["high"]
      })
    ).toEqual([freeEntry]);

    expect(
      applyFilters([paidEntry, freeEntry, nativeEntry], {
        ...EMPTY_FILTERS,
        categories: ["workflow"],
        priceModes: ["paid"],
        auditStatuses: ["failed"],
        scoreBands: ["low"]
      })
    ).toEqual([paidEntry]);
  });

  it("composes 'low complexity + has onboarding'", () => {
    const result = applyFilters([baseEntry, nativeEntry], {
      ...EMPTY_FILTERS,
      complexities: ["low"],
      hasOnboarding: true
    });
    expect(result).toEqual([baseEntry]);
  });

  it("matches entries by inferred tags", () => {
    const result = applyFilters([baseEntry, nativeEntry], {
      ...EMPTY_FILTERS,
      tags: ["coding"]
    });

    expect(result).toHaveLength(2);
    expect(
      applyFilters([baseEntry, nativeEntry], { ...EMPTY_FILTERS, tags: ["voice"] })
    ).toHaveLength(0);
  });

  it("returns empty when filters intentionally exclude everything", () => {
    const result = applyFilters([baseEntry, nativeEntry], {
      ...EMPTY_FILTERS,
      sources: ["listed"]
    });
    expect(result).toHaveLength(0);
  });
});

describe("buildCatalogFacets", () => {
  it("only exposes filter facets that can match the current static catalog", () => {
    const facets = buildCatalogFacets([...curatedAgents, ...listedAgents]);

    expect(facets.scenarioIds).not.toEqual(expect.arrayContaining(["defi-trading", "devops-sre"]));
    expect(facets.sources).not.toContain("native");
    expect(facets.trustTiers).not.toEqual(expect.arrayContaining([2, 3]));
    expect(facets.toggles.hasAudit).toBe(false);
    expect(facets.toggles.rentable).toBe(false);

    expect(facets.tags).toEqual(
      expect.arrayContaining(["ide", "open-source", "research", "self-host", "coding", "search"])
    );
    expect(facets.tags).not.toEqual(expect.arrayContaining(["anthropic", "byom", "browser"]));
  });

  it("exposes category, price, audit status, and score facets from current entries", () => {
    const facets = buildCatalogFacets([baseEntry, nativeEntry]);

    expect(facets.categories).toEqual(["test"]);
    expect(facets.priceModes).toEqual(expect.arrayContaining(["rentable", "unknown"]));
    expect(facets.auditStatuses).toEqual(expect.arrayContaining(["passed", "no-audit"]));
    expect(facets.scoreBands).toEqual(expect.arrayContaining(["medium", "unknown"]));
  });
});

describe("filters URL roundtrip", () => {
  it("encodes and decodes back to the same filter state", () => {
    const filters = {
      ...EMPTY_FILTERS,
      query: "support",
      need: "客服知识库自动回复",
      scenarios: ["customer-support", "knowledge-qa"],
      tags: ["support", "knowledge"],
      sources: ["native" as const],
      categories: ["workflow"],
      priceModes: ["rentable" as const],
      auditStatuses: ["passed" as const],
      scoreBands: ["high" as const],
      hasAudit: true,
      rentable: true,
      sort: "trust" as const
    };
    const params = filtersToSearchParams(filters);
    const back = searchParamsToFilters(params);
    expect(back).toEqual(filters);
  });

  it("merges filter params without dropping compare ids or unrelated params", () => {
    const current = new URLSearchParams("ids=claude-code,cursor&risk=high&view=compact");
    const next = mergeFiltersToSearchParams(current, {
      ...EMPTY_FILTERS,
      riskLevels: ["low"],
      priceModes: ["paid"]
    });

    expect(next.toString()).toBe("ids=claude-code%2Ccursor&view=compact&risk=low&price=paid");
  });
});

describe("filter chips and relaxation suggestions", () => {
  it("returns stable active filter chips for removable constraints", () => {
    const chips = getActiveFilterChips({
      ...EMPTY_FILTERS,
      query: "support",
      need: "客服知识库自动回复",
      tags: ["support"],
      sources: ["native"],
      categories: ["workflow"],
      priceModes: ["rentable"],
      auditStatuses: ["passed"],
      scoreBands: ["high"],
      accessTypes: ["api"],
      hasAudit: true
    });

    expect(chips.map((chip) => chip.id)).toEqual([
      "query",
      "need",
      "tag:support",
      "category:workflow",
      "source:native",
      "access:api",
      "price:rentable",
      "auditStatus:passed",
      "score:high",
      "hasAudit"
    ]);
  });

  it("removes an inferred tag chip", () => {
    const filters = {
      ...EMPTY_FILTERS,
      tags: ["support", "knowledge"]
    };

    expect(removeFilterChip(filters, { id: "tag:support", kind: "tag", value: "support" })).toEqual({
      ...EMPTY_FILTERS,
      tags: ["knowledge"]
    });
  });

  it("suggests removing the constraint that recovers the most results", () => {
    const suggestion = suggestFilterRelaxation([baseEntry, nativeEntry], {
      ...EMPTY_FILTERS,
      sources: ["listed"],
      hasOnboarding: true
    });

    expect(suggestion).toMatchObject({
      chip: { id: "source:listed" },
      resultCount: 1
    });
  });
});
