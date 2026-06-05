import { recommendFromCatalog } from "./recommendationService";
import type {
  RecommendationCatalogEntry,
  RecommendationRequest,
  RecommendationResponse,
  RecommendationText
} from "./recommendationTypes";

export type RecommendationLlmProvider = "mock" | "openai";
export type RecommendationEngine = "mock-llm" | "openai" | "rules-fallback";

export interface RecommendationLlmConfig {
  provider: RecommendationLlmProvider;
  apiKey?: string;
  model?: string;
  apiBaseUrl?: string;
}

export interface RecommendationLlmClient {
  engine: Exclude<RecommendationEngine, "rules-fallback">;
  recommend(input: RecommendationLlmInput): Promise<RecommendationResponse>;
}

export interface RecommendationLlmInput {
  catalog: readonly RecommendationCatalogEntry[];
  request: RecommendationRequest;
  baseline: RecommendationResponse;
}

export type FetchLike = typeof fetch;

const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";

export function createRecommendationLlmClient(
  config: RecommendationLlmConfig,
  fetchImpl: FetchLike = fetch
): RecommendationLlmClient {
  switch (config.provider) {
    case "mock":
      return createMockRecommendationLlmClient();
    case "openai":
      return createOpenAiRecommendationLlmClient(config, fetchImpl);
  }
}

export function createMockRecommendationLlmClient(): RecommendationLlmClient {
  return {
    engine: "mock-llm",
    async recommend(input: RecommendationLlmInput): Promise<RecommendationResponse> {
      const baseline = input.baseline.results.length > 0
        ? input.baseline
        : recommendFromCatalog(input.catalog, input.request);

      return {
        interpretation: baseline.interpretation,
        results: baseline.results.map((result, index) => ({
          ...result,
          score: Math.max(1, Math.round((result.score + 3 - index * 0.1) * 100) / 100),
          reasons: withLlmReason(result.reasons)
        }))
      };
    }
  };
}

function createOpenAiRecommendationLlmClient(
  config: RecommendationLlmConfig,
  fetchImpl: FetchLike
): RecommendationLlmClient {
  if (!config.apiKey) {
    throw new Error("PLATFORM_RECOMMENDATION_LLM_API_KEY is required for openai provider.");
  }
  if (!config.model) {
    throw new Error("PLATFORM_RECOMMENDATION_LLM_MODEL is required for openai provider.");
  }

  return {
    engine: "openai",
    async recommend(input: RecommendationLlmInput): Promise<RecommendationResponse> {
      const baseUrl = (config.apiBaseUrl ?? OPENAI_DEFAULT_BASE_URL).replace(/\/+$/, "");
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "You recommend AI agents only from the provided candidate catalog. Return strict JSON."
            },
            {
              role: "user",
              content: buildRecommendationLlmPrompt(input)
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Recommendation LLM request failed with status ${response.status}.`);
      }

      const body = await response.json();
      return parseOpenAiRecommendationResponse(body, input);
    }
  };
}

export function buildRecommendationLlmPrompt(input: RecommendationLlmInput): string {
  const allowedIds = new Set(input.baseline.results.map((result) => result.agentId));
  const candidates = input.catalog
    .filter((entry) => allowedIds.has(entry.id))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      intro: entry.intro,
      category: entry.category,
      tags: entry.tags,
      scenarioIds: entry.scenarioIds,
      unsuitableScenarioIds: entry.unsuitableScenarioIds,
      riskLevel: entry.riskLevel,
      accessTypes: entry.accessTypes,
      complexity: entry.complexity,
      hasAuditEvidence: entry.hasAuditEvidence ?? false
    }));

  return JSON.stringify({
    task: "Rerank and explain the best AI agent recommendations for the user's request.",
    constraints: [
      "Only use agentId values from candidates.",
      "Do not invent products, prices, audits or capabilities.",
      "Return at most the requested limit.",
      "Each reason must be short and user-facing in zh and en."
    ],
    userRequest: input.request,
    baselineInterpretation: input.baseline.interpretation,
    baselineResults: input.baseline.results,
    candidates,
    outputSchema: {
      results: [
        {
          agentId: "candidate id",
          score: 0,
          reasons: [{ zh: "string", en: "string" }],
          matchedScenarioIds: ["scenario id"]
        }
      ]
    }
  });
}

function parseOpenAiRecommendationResponse(
  body: unknown,
  input: RecommendationLlmInput
): RecommendationResponse {
  const record = body as Record<string, unknown>;
  const choices = record.choices as Array<Record<string, unknown>> | undefined;
  const message = choices?.[0]?.message as Record<string, unknown> | undefined;
  const content = typeof message?.content === "string" ? message.content : "";

  if (!content) {
    throw new Error("Recommendation LLM response has no content.");
  }

  return parseRecommendationLlmJson(content, input);
}

export function parseRecommendationLlmJson(
  content: string,
  input: RecommendationLlmInput
): RecommendationResponse {
  const parsed = JSON.parse(stripJsonFence(content));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Recommendation LLM response must be a JSON object.");
  }

  const allowedIds = new Set(input.baseline.results.map((result) => result.agentId));
  const results = (parsed as { results?: unknown }).results;
  if (!Array.isArray(results)) {
    throw new Error("Recommendation LLM response results must be an array.");
  }

  const normalizedResults = results
    .map((item) => normalizeLlmResult(item, allowedIds))
    .filter((item): item is RecommendationResponse["results"][number] => item !== undefined)
    .slice(0, input.baseline.interpretation.limit);

  if (normalizedResults.length === 0) {
    throw new Error("Recommendation LLM response did not include valid candidate ids.");
  }

  return {
    interpretation: input.baseline.interpretation,
    results: normalizedResults
  };
}

function normalizeLlmResult(
  item: unknown,
  allowedIds: Set<string>
): RecommendationResponse["results"][number] | undefined {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return undefined;
  }
  const record = item as Record<string, unknown>;
  if (typeof record.agentId !== "string" || !allowedIds.has(record.agentId)) {
    return undefined;
  }

  const score = typeof record.score === "number" && Number.isFinite(record.score)
    ? record.score
    : 1;

  return {
    agentId: record.agentId,
    score: Math.round(score * 100) / 100,
    reasons: normalizeReasons(record.reasons),
    matchedScenarioIds: Array.isArray(record.matchedScenarioIds)
      ? record.matchedScenarioIds.filter((item): item is string => typeof item === "string")
      : []
  };
}

function normalizeReasons(value: unknown): RecommendationText[] {
  if (!Array.isArray(value)) {
    return [{ zh: "LLM 根据需求语义给出推荐", en: "LLM selected this based on request semantics" }];
  }

  const reasons = value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return undefined;
      }
      const record = item as Record<string, unknown>;
      if (typeof record.zh !== "string" || typeof record.en !== "string") {
        return undefined;
      }
      return { zh: record.zh.trim(), en: record.en.trim() };
    })
    .filter((item): item is RecommendationText => Boolean(item?.zh && item.en))
    .slice(0, 3);

  return reasons.length > 0
    ? reasons
    : [{ zh: "LLM 根据需求语义给出推荐", en: "LLM selected this based on request semantics" }];
}

function withLlmReason(reasons: RecommendationText[]): RecommendationText[] {
  return [
    { zh: "LLM 语义推荐候选", en: "LLM semantic recommendation candidate" },
    ...reasons
  ].slice(0, 3);
}

function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1].trim() : trimmed;
}
