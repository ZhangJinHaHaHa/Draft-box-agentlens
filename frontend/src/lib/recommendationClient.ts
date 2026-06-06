import type { AgentCatalogEntry } from "@/domain/catalog";
import type { I18nText } from "@/domain/i18nText";
import {
  recommendAgents,
  type RecommendationRequest
} from "@/domain/recommendation";

export interface RecommendationApiResult {
  agentId: string;
  score: number;
  fitScore?: number;
  trustScore?: number;
  riskScore?: number;
  confidence?: "high" | "medium" | "low";
  recommendationType?: "best_fit" | "trusted_pick" | "fast_start" | "specialized";
  reasons: I18nText[];
  tradeoffs?: I18nText[];
  evidenceUsed?: string[];
  missingEvidence?: string[];
  matchedScenarioIds: string[];
}

export interface RecommendationApiResponse {
  results: RecommendationApiResult[];
}

export function buildLocalRecommendationResponse(
  entries: readonly AgentCatalogEntry[],
  request: RecommendationRequest
): RecommendationApiResponse {
  return {
    results: recommendAgents(entries, request).map((match) => ({
      agentId: match.entry.id,
      score: match.score,
      reasons: match.reasons,
      matchedScenarioIds: match.matchedScenarioIds
    }))
  };
}

export async function requestRecommendations(
  apiBaseUrl: string,
  request: RecommendationRequest,
  fetchImpl: typeof fetch = fetch
): Promise<RecommendationApiResponse> {
  const baseUrl = apiBaseUrl.replace(/\/+$/, "");
  const response = await fetchImpl(`${baseUrl}/api/recommendations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Recommendation API responded with status ${response.status}.`);
  }

  const payload = await response.json();
  return parseRecommendationApiResponse(payload);
}

export function parseRecommendationApiResponse(payload: unknown): RecommendationApiResponse {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { results?: unknown }).results)) {
    throw new Error("Recommendation API response must include a results array.");
  }

  return {
    results: (payload as { results: unknown[] }).results.map(parseRecommendationApiResult)
  };
}

function parseRecommendationApiResult(payload: unknown): RecommendationApiResult {
  if (!payload || typeof payload !== "object") {
    throw new Error("Recommendation result must be an object.");
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.agentId !== "string" || record.agentId.trim().length === 0) {
    throw new Error("Recommendation result agentId is required.");
  }
  if (typeof record.score !== "number" || !Number.isFinite(record.score)) {
    throw new Error("Recommendation result score must be a finite number.");
  }
  if (!Array.isArray(record.reasons)) {
    throw new Error("Recommendation result reasons must be an array.");
  }
  if (!Array.isArray(record.matchedScenarioIds)) {
    throw new Error("Recommendation result matchedScenarioIds must be an array.");
  }

  return {
    agentId: record.agentId.trim(),
    score: record.score,
    ...(readOptionalScore(record.fitScore) !== undefined ? { fitScore: readOptionalScore(record.fitScore) } : {}),
    ...(readOptionalScore(record.trustScore) !== undefined ? { trustScore: readOptionalScore(record.trustScore) } : {}),
    ...(readOptionalScore(record.riskScore) !== undefined ? { riskScore: readOptionalScore(record.riskScore) } : {}),
    ...(isRecommendationConfidence(record.confidence) ? { confidence: record.confidence } : {}),
    ...(isRecommendationType(record.recommendationType) ? { recommendationType: record.recommendationType } : {}),
    reasons: record.reasons as I18nText[],
    ...(Array.isArray(record.tradeoffs) ? { tradeoffs: record.tradeoffs as I18nText[] } : {}),
    ...(Array.isArray(record.evidenceUsed)
      ? { evidenceUsed: record.evidenceUsed.filter((value): value is string => typeof value === "string") }
      : {}),
    ...(Array.isArray(record.missingEvidence)
      ? { missingEvidence: record.missingEvidence.filter((value): value is string => typeof value === "string") }
      : {}),
    matchedScenarioIds: record.matchedScenarioIds.filter((value): value is string => typeof value === "string")
  };
}

function readOptionalScore(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecommendationConfidence(value: unknown): value is NonNullable<RecommendationApiResult["confidence"]> {
  return value === "high" || value === "medium" || value === "low";
}

function isRecommendationType(value: unknown): value is NonNullable<RecommendationApiResult["recommendationType"]> {
  return value === "best_fit" || value === "trusted_pick" || value === "fast_start" || value === "specialized";
}
