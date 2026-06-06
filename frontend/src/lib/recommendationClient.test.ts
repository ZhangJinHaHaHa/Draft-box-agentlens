import { describe, expect, it, vi } from "vitest";

import type { RecommendationCandidate, RecommendationInput } from "@/domain/recommendation";
import { getRecommendations } from "./recommendationClient";

const input: RecommendationInput = {
  task: "coding",
  usageContext: "solo",
  priority: "ease",
  acceptsNative: false
};

const apiCandidate = {
  entryId: "cursor",
  score: 99,
  reasonCodes: ["scenario-match"],
  riskWarnings: [{ zh: "低风险", en: "Low risk" }],
  nextStep: { zh: "查看详情", en: "Open details" }
};

const localCandidate: RecommendationCandidate = {
  entry: {
    id: "cursor",
    source: "curated",
    name: "Cursor",
    intro: { zh: "Cursor", en: "Cursor" },
    category: "test",
    tags: ["coding"],
    scenarios: [],
    unsuitableScenarios: [],
    recommendedFor: [],
    riskLevel: "low",
    riskNotes: [],
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: true
  },
  score: 12,
  reasonCodes: ["low-risk"],
  riskWarnings: [{ zh: "低风险", en: "Low risk" }],
  nextStep: { zh: "查看详情", en: "Open details" }
};

describe("getRecommendations", () => {
  it("uses the recommendation API when configured and successful", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, candidates: [apiCandidate] })
    });

    const result = await getRecommendations({
      apiUrl: "https://api.example.com/recommend",
      input,
      catalog: [localCandidate.entry],
      fallback: () => [localCandidate],
      fetchImpl
    });

    expect(result.source).toBe("api");
    expect(result.candidates[0]?.score).toBe(99);
    expect(fetchImpl).toHaveBeenCalledWith("https://api.example.com/recommend", expect.objectContaining({ method: "POST" }));
  });

  it("falls back to local rules when the API is not configured", async () => {
    const result = await getRecommendations({
      input,
      catalog: [],
      fallback: () => [localCandidate]
    });

    expect(result.source).toBe("local");
    expect(result.candidates).toEqual([localCandidate]);
  });

  it("falls back to local rules and reports API failure", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "down" })
    });

    const result = await getRecommendations({
      apiUrl: "https://api.example.com/recommend",
      input,
      catalog: [],
      fallback: () => [localCandidate],
      fetchImpl
    });

    expect(result.source).toBe("api-fallback");
    expect(result.error).toBe("down");
    expect(result.candidates).toEqual([localCandidate]);
  });
});
