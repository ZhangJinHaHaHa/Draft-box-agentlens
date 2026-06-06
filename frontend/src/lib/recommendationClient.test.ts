import { describe, expect, it, vi } from "vitest";

import type { AgentCatalogEntry } from "@/domain/catalog";
import type { RecommendationCandidate, RecommendationInput } from "@/domain/recommendation";
import {
  buildLocalRecommendationResponse,
  getRecommendations,
  requestRecommendations
} from "./recommendationClient";

const entry: AgentCatalogEntry = {
  id: "support-agent",
  source: "listed",
  name: "Support Agent",
  intro: { zh: "客服知识库", en: "Support knowledge base" },
  category: "Support",
  tags: ["support"],
  scenarios: [{ id: "customer-support", label: { zh: "客服自动化", en: "Customer support automation" } }],
  unsuitableScenarios: [],
  recommendedFor: [],
  riskLevel: "low",
  riskNotes: [],
  accessTypes: ["api"],
  complexity: "low",
  hasOnboardingGuide: false
};

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

describe("recommendationClient platform response contract", () => {
  it("builds the public response shape from local catalog entries", () => {
    const response = buildLocalRecommendationResponse([entry], {
      query: "客服 api"
    });

    expect(response.results[0]).toMatchObject({
      agentId: "support-agent",
      matchedScenarioIds: ["customer-support"]
    });
  });

  it("posts to the recommendation API contract", async () => {
    const response = await requestRecommendations(
      "https://recommend.example/",
      { query: "support" },
      async (url, init) => {
        expect(url).toBe("https://recommend.example/api/recommendations");
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            results: [
              {
                agentId: "support-agent",
                score: 42,
                fitScore: 81,
                trustScore: 67,
                riskScore: 18,
                confidence: "high",
                recommendationType: "best_fit",
                reasons: [{ zh: "匹配", en: "Match" }],
                tradeoffs: [{ zh: "需要接入知识库", en: "Requires knowledge-base setup" }],
                evidenceUsed: ["scenario:customer-support"],
                missingEvidence: ["platform_reputation"],
                matchedScenarioIds: ["customer-support"]
              }
            ]
          }),
          { status: 200 }
        );
      }
    );

    expect(response.results[0].score).toBe(42);
    expect(response.results[0]).toMatchObject({
      fitScore: 81,
      trustScore: 67,
      riskScore: 18,
      confidence: "high",
      recommendationType: "best_fit",
      evidenceUsed: ["scenario:customer-support"],
      missingEvidence: ["platform_reputation"]
    });
  });

  it("times out public recommendation API requests instead of waiting forever", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    try {
      const responsePromise = requestRecommendations(
        "https://recommend.example",
        { query: "support" },
        fetchImpl,
        50
      );
      const assertion = expect(responsePromise).rejects.toThrow("Recommendation API request timed out after 50ms.");

      await vi.advanceTimersByTimeAsync(50);

      await assertion;
      expect(fetchImpl).toHaveBeenCalledWith(
        "https://recommend.example/api/recommendations",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

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

  it("falls back to local rules when the recommendation API hangs", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    try {
      const resultPromise = getRecommendations({
        apiUrl: "https://api.example.com/recommend",
        input,
        catalog: [],
        fallback: () => [localCandidate],
        fetchImpl,
        timeoutMs: 50
      });

      await vi.advanceTimersByTimeAsync(50);

      await expect(resultPromise).resolves.toMatchObject({
        source: "api-fallback",
        candidates: [localCandidate],
        error: "Recommendation API request timed out after 50ms."
      });
      expect(fetchImpl).toHaveBeenCalledWith(
        "https://api.example.com/recommend",
        expect.objectContaining({
          method: "POST",
          signal: expect.any(AbortSignal)
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
