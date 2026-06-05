import { describe, expect, it } from "vitest";

import type { AgentCatalogEntry } from "./catalog";
import { computeTrustTier, REPUTATION_TIER3_THRESHOLD } from "./trustTier";

const baseEntry: AgentCatalogEntry = {
  id: "fixture",
  source: "curated",
  name: "Fixture Agent",
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
  hasOnboardingGuide: false
};

describe("computeTrustTier", () => {
  it("returns Tier 0 when only baseline metadata is present", () => {
    const result = computeTrustTier({ entry: baseEntry });
    expect(result.tier).toBe(0);
    expect(result.reasons).toContain("noEvidence");
    expect(result.evidence).toHaveLength(0);
  });

  it("Tier 1 fires for curated agents with at least one observation summary", () => {
    const entry: AgentCatalogEntry = {
      ...baseEntry,
      latestObservedAt: "2025-04-01",
      observationSummary: { zh: "ok", en: "ok" }
    };
    const result = computeTrustTier({ entry });
    expect(result.tier).toBe(1);
    expect(result.reasons).toEqual(["hasObservation"]);
    expect(result.evidence[0].value).toBe("2025-04-01");
  });

  it("Tier 1 does NOT fire when only one of the observation fields exists", () => {
    const result = computeTrustTier({
      entry: { ...baseEntry, latestObservedAt: "2025-04-01" }
    });
    expect(result.tier).toBe(0);
    expect(result.reasons).toEqual(["noEvidence"]);
  });

  it("Tier 2 fires when an audit passed, even without attestation hash", () => {
    const entry: AgentCatalogEntry = {
      ...baseEntry,
      source: "native",
      tokenId: "1",
      chainEvidence: { auditPassed: true, reportHash: "0xreport" }
    };
    const result = computeTrustTier({ entry });
    expect(result.tier).toBe(2);
    expect(result.reasons).toContain("hasAuditPassed");
    expect(result.reasons).toContain("hasReportHash");
  });

  it("Tier 2 fires when only an attestation hash exists", () => {
    const entry: AgentCatalogEntry = {
      ...baseEntry,
      source: "native",
      tokenId: "1",
      chainEvidence: { attestationHash: "0xatt" }
    };
    const result = computeTrustTier({ entry });
    expect(result.tier).toBe(2);
  });

  it("Tier 3 only fires when audit passed + report + attestation + reputation are all set", () => {
    const entry: AgentCatalogEntry = {
      ...baseEntry,
      source: "native",
      tokenId: "1",
      chainEvidence: {
        auditPassed: true,
        reportHash: "0xreport",
        attestationHash: "0xatt",
        reputationScore: REPUTATION_TIER3_THRESHOLD
      }
    };
    expect(computeTrustTier({ entry }).tier).toBe(3);
  });

  it("Tier 3 falls back to Tier 2 when reputation is below threshold", () => {
    const entry: AgentCatalogEntry = {
      ...baseEntry,
      source: "native",
      tokenId: "1",
      chainEvidence: {
        auditPassed: true,
        reportHash: "0xreport",
        attestationHash: "0xatt",
        reputationScore: REPUTATION_TIER3_THRESHOLD - 1
      }
    };
    expect(computeTrustTier({ entry }).tier).toBe(2);
  });

  it("zero-value hashes do not count as evidence", () => {
    const entry: AgentCatalogEntry = {
      ...baseEntry,
      source: "native",
      tokenId: "1",
      chainEvidence: {
        reportHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        attestationHash: "0x0000000000000000000000000000000000000000000000000000000000000000"
      }
    };
    const result = computeTrustTier({ entry });
    expect(result.tier).toBe(0);
  });

  it("curated entries without chain evidence cannot be promoted to Tier 3 by trustTierHint", () => {
    const entry: AgentCatalogEntry = {
      ...baseEntry,
      latestObservedAt: "2025-04-01",
      observationSummary: { zh: "ok", en: "ok" },
      trustTierHint: 3
    };
    const result = computeTrustTier({ entry });
    // trustTierHint can only DOWNGRADE — Tier 1 from observation stays.
    expect(result.tier).toBe(1);
  });

  it("trustTierHint downgrades when below the computed tier", () => {
    const entry: AgentCatalogEntry = {
      ...baseEntry,
      source: "native",
      tokenId: "1",
      chainEvidence: { auditPassed: true, reportHash: "0xreport" },
      trustTierHint: 0
    };
    const result = computeTrustTier({ entry });
    expect(result.tier).toBe(0);
  });

  it("override chainEvidence parameter wins over entry chainEvidence", () => {
    const entry: AgentCatalogEntry = {
      ...baseEntry,
      source: "native",
      chainEvidence: { auditPassed: false }
    };
    const result = computeTrustTier({
      entry,
      chainEvidence: { auditPassed: true, reportHash: "0xreport" }
    });
    expect(result.tier).toBe(2);
  });
});
