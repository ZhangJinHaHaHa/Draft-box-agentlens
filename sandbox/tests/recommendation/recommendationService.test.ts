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

test("recommendFromCatalog returns explainable selection metadata", () => {
  const response = recommendFromCatalog(defaultRecommendationCatalog, {
    query: "我想找一个适合代码审计和安全报告生成的 agent，最好可信",
    priorities: ["audited"],
    limit: 3
  });
  const first = response.results[0];

  assert.ok(first.fitScore >= 1 && first.fitScore <= 100);
  assert.ok(first.trustScore >= 0 && first.trustScore <= 100);
  assert.ok(first.riskScore >= 0 && first.riskScore <= 100);
  assert.ok(["high", "medium", "low"].includes(first.confidence));
  assert.ok(["best_fit", "trusted_pick", "fast_start", "specialized"].includes(first.recommendationType));
  assert.ok(first.evidenceUsed.length > 0);
  assert.ok(first.missingEvidence.includes("platform_reputation"));
});

test("platform signals strengthen trust metadata for uploaded agents", () => {
  const response = recommendFromCatalog(
    [
      {
        id: "uploaded-security-agent",
        name: "Uploaded Security Agent",
        intro: {
          zh: "面向代码审计和安全报告的上传 Agent。",
          en: "Uploaded agent for code audit and security reports."
        },
        category: "Security",
        tags: ["coding", "security", "audit"],
        scenarioIds: ["developer-assistant"],
        unsuitableScenarioIds: [],
        riskLevel: "medium",
        accessTypes: ["api"],
        complexity: "medium",
        hasOnboardingGuide: true,
        hasAuditEvidence: true,
        source: "native",
        platformSignals: {
          reputationScore: 880,
          paidOrders: 12,
          refundRate: 0.02,
          gatewayLeaseIssuedRate: 0.98,
          developerTrustStatus: "verified",
          auditCount: 3
        }
      }
    ],
    {
      query: "代码审计 安全报告 API 可信",
      priorities: ["audited"],
      limit: 1
    }
  );
  const result = response.results[0];

  assert.equal(result.agentId, "uploaded-security-agent");
  assert.ok(result.trustScore >= 80);
  assert.ok(result.evidenceUsed.includes("platform_reputation"));
  assert.ok(!result.missingEvidence.includes("platform_usage"));
});
