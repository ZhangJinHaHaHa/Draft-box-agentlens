import { describe, expect, it } from "vitest";

import {
  createMockGoogleUser,
  getPlatformCredits,
  requestPaidLlmRecommendation
} from "./platformClient";

describe("platformClient", () => {
  it("creates a local Google-backed user and credit account", async () => {
    const response = await createMockGoogleUser(
      "https://platform.example/",
      { googleSubject: "google-1", email: "demo@example.com" },
      async (url, init) => {
        expect(url).toBe("https://platform.example/api/web2/google/mock");
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            user: {
              platformUserId: "web2-user-1",
              walletAddress: "0x1111111111111111111111111111111111111111",
              identityWeight: 10,
              custodyMode: "backend_custodied_exportable",
              identity: { provider: "google", email: "demo@example.com" }
            },
            creditAccount: {
              userId: "web2-user-1",
              balance: 100,
              updatedAt: "2026-06-05T00:00:00.000Z"
            }
          }),
          { status: 201 }
        );
      }
    );

    expect(response.user.platformUserId).toBe("web2-user-1");
    expect(response.creditAccount.balance).toBe(100);
  });

  it("requests a paid LLM recommendation and parses charging metadata", async () => {
    const response = await requestPaidLlmRecommendation(
      "https://platform.example",
      {
        userId: "web2-user-1",
        query: "自托管 RAG API",
        limit: 2
      },
      async (url, init) => {
        expect(url).toBe("https://platform.example/api/recommendations/llm");
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            engine: "mock-llm",
            charged: true,
            fallbackUsed: false,
            costCredits: 3,
            creditAccount: {
              userId: "web2-user-1",
              balance: 97,
              updatedAt: "2026-06-05T00:01:00.000Z"
            },
            recommendation: {
              results: [
                {
                  agentId: "dify",
                  score: 88,
                  reasons: [{ zh: "匹配 RAG", en: "Matches RAG" }],
                  matchedScenarioIds: ["knowledge-qa"]
                }
              ]
            }
          }),
          { status: 200 }
        );
      }
    );

    expect(response.engine).toBe("mock-llm");
    expect(response.charged).toBe(true);
    expect(response.creditAccount.balance).toBe(97);
    expect(response.recommendation.results[0].agentId).toBe("dify");
  });

  it("reads platform credits", async () => {
    const account = await getPlatformCredits(
      "https://platform.example/",
      "web2-user-1",
      async (url) => {
        expect(url).toBe("https://platform.example/api/web2/users/web2-user-1/credits");
        return new Response(
          JSON.stringify({
            creditAccount: {
              userId: "web2-user-1",
              balance: 97,
              updatedAt: "2026-06-05T00:01:00.000Z"
            }
          }),
          { status: 200 }
        );
      }
    );

    expect(account.balance).toBe(97);
  });
});
