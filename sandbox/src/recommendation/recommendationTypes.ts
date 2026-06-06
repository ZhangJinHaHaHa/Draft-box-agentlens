export type RecommendationRiskLevel = "low" | "medium" | "high";
export type RecommendationComplexity = "low" | "medium" | "high";
export type RecommendationAccessType = "api" | "saas" | "cli" | "browser_ext" | "local" | "cloud";
export type RecommendationPriority = "low-risk" | "fast-start" | "self-host" | "api-first" | "audited";
export type RecommendationConfidence = "high" | "medium" | "low";
export type RecommendationType = "best_fit" | "trusted_pick" | "fast_start" | "specialized";

export interface RecommendationText {
  zh: string;
  en: string;
}

export interface RecommendationPlatformSignals {
  platformRating?: number;
  reputationScore?: number;
  paidOrders?: number;
  refundRate?: number;
  gatewayLeaseIssuedRate?: number;
  developerTrustStatus?: "unverified" | "verified" | "suspended";
  auditCount?: number;
}

export interface RecommendationCatalogEntry {
  id: string;
  name: string;
  vendor?: string;
  intro: RecommendationText;
  category: string;
  tags: string[];
  scenarioIds: string[];
  unsuitableScenarioIds: string[];
  riskLevel: RecommendationRiskLevel;
  accessTypes: RecommendationAccessType[];
  complexity: RecommendationComplexity;
  hasOnboardingGuide: boolean;
  hasAuditEvidence?: boolean;
  platformSignals?: RecommendationPlatformSignals;
  source?: "curated" | "marketplace" | "listed" | "native";
}

export interface RecommendationRequest {
  query: string;
  scenarioIds?: string[];
  accessTypes?: RecommendationAccessType[];
  maxRiskLevel?: RecommendationRiskLevel;
  complexity?: RecommendationComplexity;
  priorities?: RecommendationPriority[];
  limit?: number;
}

export interface RecommendationResult {
  agentId: string;
  score: number;
  fitScore: number;
  trustScore: number;
  riskScore: number;
  confidence: RecommendationConfidence;
  recommendationType: RecommendationType;
  reasons: RecommendationText[];
  tradeoffs: RecommendationText[];
  evidenceUsed: string[];
  missingEvidence: string[];
  matchedScenarioIds: string[];
}

export interface RecommendationInterpretation {
  scenarioIds: string[];
  accessTypes: RecommendationAccessType[];
  maxRiskLevel?: RecommendationRiskLevel;
  complexity?: RecommendationComplexity;
  priorities: RecommendationPriority[];
  limit: number;
}

export interface RecommendationResponse {
  interpretation: RecommendationInterpretation;
  results: RecommendationResult[];
}
