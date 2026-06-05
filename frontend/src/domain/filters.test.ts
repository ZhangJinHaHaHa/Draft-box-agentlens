import { describe, expect, it } from "vitest";

import type { AgentCatalogEntry } from "./catalog";
import {
  applyFilters,
  EMPTY_FILTERS,
  filtersToSearchParams,
  searchParamsToFilters
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

  it("composes 'native + rentable + has audit'", () => {
    const result = applyFilters([baseEntry, nativeEntry], {
      ...EMPTY_FILTERS,
      sources: ["native"],
      hasAudit: true,
      rentable: true
    });
    expect(result).toEqual([nativeEntry]);
  });

  it("composes 'low complexity + has onboarding'", () => {
    const result = applyFilters([baseEntry, nativeEntry], {
      ...EMPTY_FILTERS,
      complexities: ["low"],
      hasOnboarding: true
    });
    expect(result).toEqual([baseEntry]);
  });

  it("returns empty when filters intentionally exclude everything", () => {
    const result = applyFilters([baseEntry, nativeEntry], {
      ...EMPTY_FILTERS,
      sources: ["listed"]
    });
    expect(result).toHaveLength(0);
  });
});

describe("filters URL roundtrip", () => {
  it("encodes and decodes back to the same filter state", () => {
    const filters = {
      ...EMPTY_FILTERS,
      query: "support",
      scenarios: ["customer-support", "knowledge-qa"],
      sources: ["native" as const],
      hasAudit: true,
      rentable: true,
      sort: "trust" as const
    };
    const params = filtersToSearchParams(filters);
    const back = searchParamsToFilters(params);
    expect(back).toEqual(filters);
  });
});
