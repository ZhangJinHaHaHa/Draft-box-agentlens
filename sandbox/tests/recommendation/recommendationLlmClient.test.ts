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
  assert.equal(prompt.task, "Analyze AgentLens platform agents and return the best recommendations for the user's request.");
  assert.equal(prompt.rankingPrinciples[0], "Optimize first for user need fit, not platform revenue or source preference.");
  assert.equal(prompt.platformDecisionContext.sourceOfTruth, "Use only the supplied candidates and their capabilityProfile/platformEvidence fields.");
  assert.ok(prompt.analysisInstructions.some((instruction: string) => instruction.includes("Compare every candidate's capabilityProfile")));
  assert.equal(Array.isArray(prompt.candidates[0].capabilityProfile.capabilityTags), true);
  assert.equal(typeof prompt.candidates[0].baselineAssessment.fitScore, "number");
  assert.ok(prompt.constraints.some((constraint: string) => constraint.includes("fitScore")));
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
                    fitScore: 91,
                    trustScore: 76,
                    riskScore: 22,
                    confidence: "high",
                    recommendationType: "best_fit",
                    reasons: [{ zh: "符合 RAG 和自托管需求", en: "Fits RAG and self-hosting needs" }],
                    tradeoffs: [{ zh: "需要自行配置知识库", en: "Requires configuring the knowledge base" }],
                    evidenceUsed: ["scenario:knowledge-qa", "priority:self-host"],
                    missingEvidence: ["platform_usage"],
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
  assert.equal(response.results[0].fitScore, 91);
  assert.equal(response.results[0].confidence, "high");
  assert.equal(response.results[0].recommendationType, "best_fit");
  assert.deepEqual(response.results[0].evidenceUsed, ["scenario:knowledge-qa", "priority:self-host"]);
});

test("openai recommendation client aborts slow requests", async () => {
  const fetchImpl: FetchLike = async (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      assert.ok(signal);
      signal.addEventListener(
        "abort",
        () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        },
        { once: true }
      );
    });

  const client = createRecommendationLlmClient(
    { provider: "openai", apiKey: "sk-test", model: "test-model", timeoutMs: 5 },
    fetchImpl
  );

  await assert.rejects(
    () =>
      client.recommend({
        catalog: defaultRecommendationCatalog,
        request,
        baseline
      }),
    /timed out after 5ms/
  );
});

test("openai recommendation client falls back to baseline selection metadata", async () => {
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
                    score: 77,
                    reasons: [{ zh: "匹配需求", en: "Matches the need" }],
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

  assert.equal(response.results[0].fitScore, baseline.results[0].fitScore);
  assert.equal(response.results[0].trustScore, baseline.results[0].trustScore);
  assert.equal(response.results[0].riskScore, baseline.results[0].riskScore);
  assert.equal(response.results[0].confidence, baseline.results[0].confidence);
  assert.equal(response.results[0].recommendationType, baseline.results[0].recommendationType);
  assert.deepEqual(response.results[0].missingEvidence, baseline.results[0].missingEvidence);
});

test("openai recommendation client parses data-prefixed SSE responses", async () => {
  const content = JSON.stringify({
    results: [
      {
        agentId: baseline.results[0].agentId,
        score: 82,
        fitScore: 82,
        trustScore: 70,
        riskScore: 20,
        confidence: "medium",
        recommendationType: "best_fit",
        reasons: [{ zh: "适合需求", en: "Fits the need" }],
        tradeoffs: [],
        evidenceUsed: ["scenario:knowledge-qa"],
        missingEvidence: ["platform_usage"],
        matchedScenarioIds: ["knowledge-qa"]
      }
    ]
  });
  const fetchImpl: FetchLike = async (_input, _init) =>
    new Response(
      [
        `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}`,
        "data: [DONE]"
      ].join("\n\n"),
      { status: 200, headers: { "content-type": "text/event-stream" } }
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

  assert.equal(response.results[0].agentId, baseline.results[0].agentId);
  assert.equal(response.results[0].score, 82);
  assert.equal(response.results[0].fitScore, 82);
});
