import type { AgentCatalogEntry } from "@/domain/catalog";
import type {
  RecommendationCandidate,
  RecommendationInput,
  RecommendationReasonCode
} from "@/domain/recommendation";
import type { I18nText } from "@/domain/i18nText";

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
}

export async function getRecommendations({
  apiUrl,
  input,
  catalog,
  fallback,
  fetchImpl = fetch
}: GetRecommendationsOptions): Promise<RecommendationResult> {
  const local = () => ({ source: "local" as const, candidates: fallback() });
  if (!apiUrl) return local();

  try {
    const response = await fetchImpl(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input })
    });
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
