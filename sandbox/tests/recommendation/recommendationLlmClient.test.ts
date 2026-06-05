import assert from "node:assert/strict";
import test from "node:test";

import { defaultRecommendationCatalog } from "../../src/recommendation/defaultRecommendationCatalog";
import {
  buildRecommendationLlmPrompt,
  createMockRecommendationLlmClient,
  createRecommendationLlmClient,
  parseRecommendationLlmJson,
  type FetchLike
} from "../../src/recommendation/recommendationLlmClient";
import { recommendFromCatalog } from "../../src/recommendation/recommendationService";

const request = {
  query: "我需要一个自托管 RAG 知识库 Agent，最好有 API，可以接内部文档。",
  priorities: ["self-host" as const],
  limit: 2
};

const baseline = recommendFromCatalog(defaultRecommendationCatalog, request);

test("mock recommendation LLM reranks baseline candidates without external fetch", async () => {
  const client = createMockRecommendationLlmClient();
  const response = await client.recommend({
    catalog: defaultRecommendationCatalog,
    request,
    baseline
  });

  assert.equal(client.engine, "mock-llm");
  assert.deepEqual(
    response.results.map((result) => result.agentId),
    baseline.results.map((result) => result.agentId)
  );
  assert.match(response.results[0].reasons[0].zh, /LLM/);
});

test("parseRecommendationLlmJson rejects invented agent ids", () => {
  assert.throws(
    () =>
      parseRecommendationLlmJson(
        JSON.stringify({
          results: [
            { agentId: "imaginary-agent", score: 99, reasons: [{ zh: "不存在", en: "Invented" }] }
          ]
        }),
        { catalog: defaultRecommendationCatalog, request, baseline }
      ),
    /valid candidate ids/
  );
});

test("buildRecommendationLlmPrompt only includes baseline candidates", () => {
  const prompt = JSON.parse(
    buildRecommendationLlmPrompt({
      catalog: defaultRecommendationCatalog,
      request,
      baseline
    })
  );

  const candidateIds = prompt.candidates.map((candidate: { id: string }) => candidate.id);
  assert.deepEqual(candidateIds, baseline.results.map((result) => result.agentId));
});

test("openai recommendation client parses valid JSON response", async () => {
  const fetchImpl: FetchLike = async (_input, _init) =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                results: [
                  {
                    agentId: baseline.results[0].agentId,
                    score: 88,
                    reasons: [{ zh: "符合 RAG 和自托管需求", en: "Fits RAG and self-hosting needs" }],
                    matchedScenarioIds: ["knowledge-qa"]
                  }
                ]
              })
            }
          }
        ]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );

  const client = createRecommendationLlmClient(
    { provider: "openai", apiKey: "sk-test", model: "test-model" },
    fetchImpl
  );
  const response = await client.recommend({
    catalog: defaultRecommendationCatalog,
    request,
    baseline
  });

  assert.equal(client.engine, "openai");
  assert.equal(response.results[0].agentId, baseline.results[0].agentId);
  assert.equal(response.results[0].score, 88);
});
