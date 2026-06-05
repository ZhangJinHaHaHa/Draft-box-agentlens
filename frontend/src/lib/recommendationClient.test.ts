import { describe, expect, it } from "vitest";

import type { AgentCatalogEntry } from "@/domain/catalog";
import {
  buildLocalRecommendationResponse,
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

describe("recommendationClient", () => {
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
                reasons: [{ zh: "匹配", en: "Match" }],
                matchedScenarioIds: ["customer-support"]
              }
            ]
          }),
          { status: 200 }
        );
      }
    );

    expect(response.results[0].score).toBe(42);
  });
});
