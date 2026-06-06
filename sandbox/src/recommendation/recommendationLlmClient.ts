import { recommendFromCatalog } from "./recommendationService";
import type {
  RecommendationCatalogEntry,
  RecommendationConfidence,
  RecommendationRequest,
  RecommendationResponse,
  RecommendationText,
  RecommendationType
} from "./recommendationTypes";

export type RecommendationLlmProvider = "mock" | "openai";
export type RecommendationEngine = "mock-llm" | "openai" | "rules-fallback";

export interface RecommendationLlmConfig {
  provider: RecommendationLlmProvider;
  apiKey?: string;
  model?: string;
  apiBaseUrl?: string;
  timeoutMs?: number;
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
const OPENAI_DEFAULT_TIMEOUT_MS = 30_000;

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
      const timeoutMs = config.timeoutMs ?? OPENAI_DEFAULT_TIMEOUT_MS;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;

      try {
        response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.apiKey}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: config.model,
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: [
                  "You are AgentLens' selection advisor.",
                  "Primary objective: recommend the AI agents that best fit the user's stated need.",
                  "Use trust and risk signals as tie breakers and explain tradeoffs clearly.",
                  "Never recommend an agent outside the provided candidate catalog.",
                  "Return strict JSON only."
                ].join(" ")
              },
              {
                role: "user",
                content: buildRecommendationLlmPrompt(input)
              }
            ]
          })
        });
      } catch (error) {
        if (isAbortError(error)) {
          throw new Error(`Recommendation LLM request timed out after ${timeoutMs}ms.`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(`Recommendation LLM request failed with status ${response.status}.`);
      }

      const body = await readOpenAiResponseBody(response);
      return parseOpenAiRecommendationResponse(body, input);
    }
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function readOpenAiResponseBody(response: Response): Promise<unknown> {
  const raw = await response.text();
  const trimmed = raw.trim();
  if (trimmed.startsWith("data:")) {
    return parseOpenAiSseBody(trimmed);
  }
  return JSON.parse(trimmed);
}

function parseOpenAiSseBody(raw: string): unknown {
  let content = "";
  let lastJson: unknown;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice("data:".length).trim();
    if (!payload || payload === "[DONE]") continue;
    const parsed = JSON.parse(payload);
    lastJson = parsed;
    const choice = (parsed as { choices?: Array<Record<string, unknown>> }).choices?.[0];
    const message = choice?.message as Record<string, unknown> | undefined;
    const delta = choice?.delta as Record<string, unknown> | undefined;
    const messageContent = extractOpenAiTextContent(message?.content);
    const deltaContent = extractOpenAiTextContent(delta?.content);
    if (messageContent) {
      content += messageContent;
    } else if (deltaContent) {
      content += deltaContent;
    }
  }

  if (content) {
    return { choices: [{ message: { content } }] };
  }
  if (lastJson) {
    return lastJson;
  }
  throw new Error("Recommendation LLM SSE response has no JSON payload.");
}

export function buildRecommendationLlmPrompt(input: RecommendationLlmInput): string {
  const allowedIds = new Set(input.baseline.results.map((result) => result.agentId));
  const baselineById = new Map(input.baseline.results.map((result) => [result.agentId, result]));
  const candidates = input.catalog
    .filter((entry) => allowedIds.has(entry.id))
    .map((entry) => ({
      ...baselineById.get(entry.id),
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
      hasAuditEvidence: entry.hasAuditEvidence ?? false,
      source: entry.source ?? "listed",
      platformSignals: entry.platformSignals ?? null
    }));

  return JSON.stringify({
    task: "Rerank and explain the best-fit AI agent recommendations for the user's request.",
    rankingPrinciples: [
      "Optimize first for user need fit, not platform revenue or source preference.",
      "Use trustScore, riskScore, audit evidence, platform reputation and missing evidence as transparent tie breakers.",
      "Prefer agents with strong fit and acceptable risk over generic high-trust tools that do not match the request.",
      "Surface tradeoffs and missing evidence instead of hiding uncertainty."
    ],
    constraints: [
      "Only use agentId values from candidates.",
      "Do not invent products, prices, audits or capabilities.",
      "Return at most the requested limit.",
      "Each reason and tradeoff must be short and user-facing in zh and en.",
      "fitScore, trustScore and riskScore must be 0-100 integers.",
      "confidence must be high, medium or low.",
      "recommendationType must be best_fit, trusted_pick, fast_start or specialized.",
      "evidenceUsed and missingEvidence must use short snake_case strings from candidate evidence when possible."
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
          fitScore: 0,
          trustScore: 0,
          riskScore: 0,
          confidence: "high | medium | low",
          recommendationType: "best_fit | trusted_pick | fast_start | specialized",
          reasons: [{ zh: "string", en: "string" }],
          tradeoffs: [{ zh: "string", en: "string" }],
          evidenceUsed: ["string"],
          missingEvidence: ["string"],
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
  const outputText = typeof record.output_text === "string" ? record.output_text : "";
  const content = extractOpenAiTextContent(message?.content) || outputText;

  if (!content) {
    throw new Error("Recommendation LLM response has no content.");
  }

  return parseRecommendationLlmJson(content, input);
}

function extractOpenAiTextContent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return "";
      }
      const record = item as Record<string, unknown>;
      if (typeof record.text === "string") {
        return record.text;
      }
      if (typeof record.content === "string") {
        return record.content;
      }
      return "";
    })
    .join("");
}

export function parseRecommendationLlmJson(
  content: string,
  input: RecommendationLlmInput
): RecommendationResponse {
  const parsed = JSON.parse(stripJsonFence(content));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Recommendation LLM response must be a JSON object.");
  }

  const baselineById = new Map(input.baseline.results.map((result) => [result.agentId, result]));
  const results = (parsed as { results?: unknown }).results;
  if (!Array.isArray(results)) {
    throw new Error("Recommendation LLM response results must be an array.");
  }

  const normalizedResults = results
    .map((item) => normalizeLlmResult(item, baselineById))
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
  baselineById: Map<string, RecommendationResponse["results"][number]>
): RecommendationResponse["results"][number] | undefined {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return undefined;
  }
  const record = item as Record<string, unknown>;
  if (typeof record.agentId !== "string") {
    return undefined;
  }
  const baseline = baselineById.get(record.agentId);
  if (!baseline) {
    return undefined;
  }

  const score = typeof record.score === "number" && Number.isFinite(record.score)
    ? record.score
    : baseline.score;

  return {
    agentId: record.agentId,
    score: Math.round(score * 100) / 100,
    fitScore: normalizeBoundedScore(record.fitScore, baseline.fitScore),
    trustScore: normalizeBoundedScore(record.trustScore, baseline.trustScore),
    riskScore: normalizeBoundedScore(record.riskScore, baseline.riskScore),
    confidence: normalizeConfidence(record.confidence, baseline.confidence),
    recommendationType: normalizeRecommendationType(record.recommendationType, baseline.recommendationType),
    reasons: normalizeTextArray(record.reasons, baseline.reasons, 3),
    tradeoffs: normalizeTextArray(record.tradeoffs, baseline.tradeoffs, 2),
    evidenceUsed: normalizeStringArray(record.evidenceUsed, baseline.evidenceUsed, 8),
    missingEvidence: normalizeStringArray(record.missingEvidence, baseline.missingEvidence, 6),
    matchedScenarioIds: Array.isArray(record.matchedScenarioIds)
      ? record.matchedScenarioIds.filter((item): item is string => typeof item === "string")
      : baseline.matchedScenarioIds
  };
}

function normalizeTextArray(
  value: unknown,
  fallback: RecommendationText[],
  limit: number
): RecommendationText[] {
  if (!Array.isArray(value)) {
    return fallback.length > 0
      ? fallback.slice(0, limit)
      : [{ zh: "LLM 根据需求语义给出推荐", en: "LLM selected this based on request semantics" }];
  }

  const texts = value
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
    .slice(0, limit);

  return texts.length > 0 ? texts : fallback.slice(0, limit);
}

function normalizeBoundedScore(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.round(Math.max(0, Math.min(100, value)));
}

function normalizeConfidence(value: unknown, fallback: RecommendationConfidence): RecommendationConfidence {
  return value === "high" || value === "medium" || value === "low" ? value : fallback;
}

function normalizeRecommendationType(value: unknown, fallback: RecommendationType): RecommendationType {
  return value === "best_fit" || value === "trusted_pick" || value === "fast_start" || value === "specialized"
    ? value
    : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[], limit: number): string[] {
  if (!Array.isArray(value)) {
    return fallback.slice(0, limit);
  }
  const strings = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
  return strings.length > 0 ? strings : fallback.slice(0, limit);
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
