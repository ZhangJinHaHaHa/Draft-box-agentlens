import type { AgentCatalogEntry } from "@/domain/catalog";
import type { I18nText } from "@/domain/i18nText";
import {
  recommendAgents,
  type RecommendationCandidate,
  type RecommendationInput,
  type RecommendationReasonCode,
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

export type RecommendationSource = "api" | "local" | "api-fallback";

export interface RecommendationResult {
  source: RecommendationSource;
  candidates: RecommendationCandidate[];
  error?: string;
}

interface RecommendationApiCandidate {
  entryId: string;
  score: number;
  reasonCodes?: RecommendationReasonCode[];
  riskWarnings?: I18nText[];
  nextStep?: I18nText;
}

interface GetRecommendationsOptions {
  apiUrl?: string;
  input: RecommendationInput;
  catalog: readonly AgentCatalogEntry[];
  fallback: () => RecommendationCandidate[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const RECOMMENDATION_API_TIMEOUT_MS = 10_000;

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
  fetchImpl: typeof fetch = fetch,
  timeoutMs = RECOMMENDATION_API_TIMEOUT_MS
): Promise<RecommendationApiResponse> {
  const baseUrl = apiBaseUrl.replace(/\/+$/, "");
  const response = await postRecommendationJson(
    `${baseUrl}/api/recommendations`,
    request,
    fetchImpl,
    timeoutMs
  );

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

export async function getRecommendations({
  apiUrl,
  input,
  catalog,
  fallback,
  fetchImpl = fetch,
  timeoutMs = RECOMMENDATION_API_TIMEOUT_MS
}: GetRecommendationsOptions): Promise<RecommendationResult> {
  const local = () => ({ source: "local" as const, candidates: fallback() });
  if (!apiUrl) return local();

  try {
    const response = await postRecommendationJson(apiUrl, { input }, fetchImpl, timeoutMs);
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok !== true || !Array.isArray(body?.candidates)) {
      return {
        source: "api-fallback",
        candidates: fallback(),
        error: typeof body?.error === "string" ? body.error : "Recommendation API is unavailable."
      };
    }

    const byId = new Map(catalog.map((entry) => [entry.id, entry]));
    const candidates = (body.candidates as RecommendationApiCandidate[])
      .map((candidate) => toRecommendationCandidate(candidate, byId))
      .filter((candidate): candidate is RecommendationCandidate => candidate !== null);

    if (candidates.length === 0) {
      return {
        source: "api-fallback",
        candidates: fallback(),
        error: "Recommendation API returned no catalog-backed candidates."
      };
    }

    return { source: "api", candidates };
  } catch (error) {
    return {
      source: "api-fallback",
      candidates: fallback(),
      error: error instanceof Error ? error.message : "Recommendation API is unavailable."
    };
  }
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

async function postRecommendationJson(
  url: string,
  body: unknown,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<Response> {
  const controller = timeoutMs > 0 ? new AbortController() : undefined;
  const timeout = controller
    ? globalThis.setTimeout(() => controller.abort(), timeoutMs)
    : undefined;

  try {
    return await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      ...(controller ? { signal: controller.signal } : {}),
      body: JSON.stringify(body)
    });
  } catch (error) {
    if (isAbortError(error) && timeoutMs > 0) {
      throw new Error(`Recommendation API request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    if (timeout !== undefined) {
      globalThis.clearTimeout(timeout);
    }
  }
}

function toRecommendationCandidate(
  candidate: RecommendationApiCandidate,
  byId: Map<string, AgentCatalogEntry>
): RecommendationCandidate | null {
  const entry = byId.get(candidate.entryId);
  if (!entry || typeof candidate.score !== "number") return null;

  return {
    entry,
    score: candidate.score,
    reasonCodes: Array.isArray(candidate.reasonCodes) ? candidate.reasonCodes : [],
    riskWarnings: Array.isArray(candidate.riskWarnings) ? candidate.riskWarnings : [],
    nextStep: candidate.nextStep ?? {
      zh: "查看详情页，再决定是否继续。",
      en: "Open the detail page before continuing."
    }
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

function isAbortError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "name" in error &&
      (error as { name?: unknown }).name === "AbortError"
  );
}
