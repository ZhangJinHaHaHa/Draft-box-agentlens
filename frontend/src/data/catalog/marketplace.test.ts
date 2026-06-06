import { describe, expect, it } from "vitest";

import { computeTrustTier } from "@/domain/trustTier";
import { isNativeEntry } from "@/domain/catalog";
import { marketplaceAgents } from "./marketplace";

describe("marketplace expert agents", () => {
  it("ships at least 10 expert agents", () => {
    expect(marketplaceAgents.length).toBeGreaterThanOrEqual(10);
  });

  it("every entry is tagged source = marketplace", () => {
    for (const entry of marketplaceAgents) {
      expect(entry.source, entry.id).toBe("marketplace");
    }
  });

  it("ids are unique", () => {
    const ids = marketplaceAgents.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("carries no tokenId so the detail page renders the editorial block, not the chain panel", () => {
    for (const entry of marketplaceAgents) {
      expect(entry.tokenId, entry.id).toBeUndefined();
      // isNativeEntry must be false → AgentDetailPage routes to CuratedBlock.
      expect(isNativeEntry(entry), entry.id).toBe(false);
    }
  });

  it("does not link out to a vendor site (sellers live on-platform)", () => {
    for (const entry of marketplaceAgents) {
      expect(entry.officialUrl, entry.id).toBeUndefined();
    }
  });

  it("every entry has at least one scenario with resolvable zh/en labels", () => {
    for (const entry of marketplaceAgents) {
      expect(entry.scenarios.length, entry.id).toBeGreaterThan(0);
      for (const ref of entry.scenarios) {
        expect(ref.id, entry.id).toBeTruthy();
        expect(ref.label.zh, ref.id).toBeTruthy();
        expect(ref.label.en, ref.id).toBeTruthy();
      }
    }
  });

  it("every I18nText field carries both zh and en", () => {
    for (const entry of marketplaceAgents) {
      expect(entry.intro.zh && entry.intro.en, entry.id).toBeTruthy();
      expect(entry.seller?.label.zh && entry.seller.label.en, entry.id).toBeTruthy();
      expect(entry.seller?.contextScale.zh && entry.seller.contextScale.en, entry.id).toBeTruthy();
      for (const item of entry.recommendedFor) {
        expect(item.zh && item.en, entry.id).toBeTruthy();
      }
      for (const note of entry.riskNotes) {
        expect(note.zh && note.en, entry.id).toBeTruthy();
      }
      if (entry.pricingHint) {
        expect(entry.pricingHint.zh && entry.pricingHint.en, entry.id).toBeTruthy();
      }
    }
  });

  it("every marketplace agent identifies the seller and private context behind it", () => {
    for (const entry of marketplaceAgents) {
      expect(entry.seller, entry.id).toBeDefined();
      expect(entry.seller?.kind, entry.id).toMatch(/^(solo|boutique|firm|institution|platform)$/);
      expect(entry.seller?.label.zh, entry.id).toBeTruthy();
      expect(entry.seller?.contextScale.zh, entry.id).toBeTruthy();
    }
  });

  it("offers some rentable agents for the marketplace rental flow", () => {
    const rentable = marketplaceAgents.filter((entry) => entry.nativePricing?.rentable);
    expect(rentable.length).toBeGreaterThan(0);
  });

  it("trust is earned, not claimed: tiers stay within 0..1 (no chain evidence yet)", () => {
    const tiers = marketplaceAgents.map((entry) => computeTrustTier({ entry }).tier);
    for (const tier of tiers) {
      expect(tier).toBeLessThanOrEqual(1);
    }
    // Observation-backed sellers reach Tier 1; un-observed ones sit at Tier 0.
    expect(tiers).toContain(1);
    expect(tiers).toContain(0);
  });
});
