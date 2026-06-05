import assert from "node:assert/strict";
import test from "node:test";

import { defaultRecommendationCatalog } from "../../src/recommendation/defaultRecommendationCatalog";
import { recommendFromCatalog } from "../../src/recommendation/recommendationService";

test("recommendFromCatalog ranks a customer support API request", () => {
  const response = recommendFromCatalog(defaultRecommendationCatalog, {
    query: "客服 知识库 API",
    limit: 3
  });

  assert.equal(response.results[0].agentId, "intercom-fin");
  assert.ok(response.results[0].matchedScenarioIds.includes("customer-support"));
});

test("recommendFromCatalog ranks self-hosted RAG requests", () => {
  const response = recommendFromCatalog(defaultRecommendationCatalog, {
    query: "自托管 RAG 知识库 API",
    priorities: ["self-host"],
    limit: 2
  });

  assert.deepEqual(
    response.results.map((result) => result.agentId),
    ["dify", "flowise"]
  );
});

test("recommendFromCatalog returns the interpreted request", () => {
  const response = recommendFromCatalog(defaultRecommendationCatalog, {
    query: "我需要自托管 RAG 知识库 API，低风险",
    limit: 4
  });

  assert.ok(response.interpretation.scenarioIds.includes("knowledge-qa"));
  assert.ok(response.interpretation.accessTypes.includes("api"));
  assert.ok(response.interpretation.accessTypes.includes("local"));
  assert.ok(response.interpretation.priorities.includes("self-host"));
  assert.ok(response.interpretation.priorities.includes("api-first"));
  assert.equal(response.interpretation.maxRiskLevel, "low");
  assert.equal(response.interpretation.limit, 4);
});

test("recommendFromCatalog ranks cited market research requests", () => {
  const response = recommendFromCatalog(defaultRecommendationCatalog, {
    query: "需要带引用的竞品调研和搜索",
    limit: 2
  });

  assert.equal(response.results[0].agentId, "perplexity");
  assert.ok(response.results[0].matchedScenarioIds.includes("market-research"));
});

test("recommendFromCatalog ranks long-running multi-file coding requests", () => {
  const response = recommendFromCatalog(defaultRecommendationCatalog, {
    query: "长任务 多文件 IDE 编程",
    limit: 2
  });

  assert.deepEqual(
    response.results.map((result) => result.agentId),
    ["cursor", "windsurf"]
  );
});

test("recommendFromCatalog includes self-hosted workflow candidates", () => {
  const response = recommendFromCatalog(defaultRecommendationCatalog, {
    query: "自托管 自动化 工作流 API",
    limit: 5
  });
  const ids = response.results.map((result) => result.agentId);

  assert.ok(ids.includes("dify"));
  assert.ok(ids.includes("n8n-ai"));
});
