import type { AccessType, AgentCatalogEntry, Complexity, RiskLevel } from "./catalog";
import { isNativeEntry, isRentable } from "./catalog";
import { computeTrustTier } from "./trustTier";
import type { I18nText } from "./i18nText";

export type RecommendationUsageContext = "solo" | "team";
export type RecommendationPriority = "safety" | "ease" | "capability" | "price";

export type RecommendationReasonCode =
  | "scenario-match"
  | "task-keyword"
  | "access-match"
  | "low-risk"
  | "easy-start"
  | "trust-evidence"
  | "rentable";

export interface RecommendationInput {
  task: string;
  scenarioId?: string;
  usageContext: RecommendationUsageContext;
  preferredAccessType?: AccessType | "any";
  priority: RecommendationPriority;
  acceptsNative: boolean;
}

export interface RecommendationCandidate {
  entry: AgentCatalogEntry;
  score: number;
  reasonCodes: RecommendationReasonCode[];
  riskWarnings: I18nText[];
  nextStep: I18nText;
}

const riskScore: Record<RiskLevel, number> = {
  low: 4,
  medium: 1,
  high: -5
};

const complexityScore: Record<Complexity, number> = {
  low: 4,
  medium: 1,
  high: -3
};

export function recommendAgents(
  entries: readonly AgentCatalogEntry[],
  input: RecommendationInput
): RecommendationCandidate[] {
  return entries
    .filter((entry) => input.acceptsNative || !isNativeEntry(entry))
    .map((entry) => scoreEntry(entry, input))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, 5);
}

function scoreEntry(entry: AgentCatalogEntry, input: RecommendationInput): RecommendationCandidate {
  const reasonCodes = new Set<RecommendationReasonCode>();
  let score = 0;

  if (input.scenarioId && entry.scenarios.some((scenario) => scenario.id === input.scenarioId)) {
    score += 12;
    reasonCodes.add("scenario-match");
  }

  const keywordScore = scoreKeywords(entry, input.task);
  if (keywordScore > 0) {
    score += keywordScore;
    reasonCodes.add("task-keyword");
  }

  if (
    input.preferredAccessType &&
    input.preferredAccessType !== "any" &&
    entry.accessTypes.includes(input.preferredAccessType)
  ) {
    score += 4;
    reasonCodes.add("access-match");
  }

  score += riskScore[entry.riskLevel];
  score += complexityScore[entry.complexity];
  score += computeTrustTier({ entry }).tier * 2;

  if (entry.riskLevel === "low") reasonCodes.add("low-risk");
  if (entry.complexity === "low" || entry.hasOnboardingGuide) reasonCodes.add("easy-start");
  if (computeTrustTier({ entry }).tier >= 1) reasonCodes.add("trust-evidence");
  if (isRentable(entry)) reasonCodes.add("rentable");

  if (input.usageContext === "team") {
    score += entry.hasOnboardingGuide ? 2 : -1;
    score += entry.riskLevel === "high" ? -2 : 1;
  }

  switch (input.priority) {
    case "safety":
      score += entry.riskLevel === "low" ? 5 : entry.riskLevel === "medium" ? 1 : -6;
      score += computeTrustTier({ entry }).tier >= 2 ? 3 : 0;
      break;
    case "ease":
      score += entry.complexity === "low" ? 5 : entry.complexity === "medium" ? 1 : -4;
      score += entry.hasOnboardingGuide ? 3 : 0;
      break;
    case "capability":
      score += entry.scenarios.length + Math.min(entry.tags.length, 6);
      break;
    case "price":
      score += entry.pricingHint || entry.pricingUrl || entry.nativePricing?.label ? 3 : 0;
      break;
  }

  return {
    entry,
    score,
    reasonCodes: [...reasonCodes],
    riskWarnings: entry.riskNotes.length > 0 ? entry.riskNotes.slice(0, 2) : [fallbackRisk(entry.riskLevel)],
    nextStep: getNextStep(entry)
  };
}

function scoreKeywords(entry: AgentCatalogEntry, task: string): number {
  const tokens = tokenize(task);
  if (tokens.length === 0) return 0;
  const haystack = [
    entry.name,
    entry.vendor,
    entry.category,
    entry.intro.zh,
    entry.intro.en,
    ...entry.tags,
    ...entry.scenarios.flatMap((scenario) => [scenario.id, scenario.label.zh, scenario.label.en]),
    ...entry.recommendedFor.flatMap((item) => [item.zh, item.en])
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  const matches = tokens.filter((token) => haystack.includes(token)).length;
  return Math.min(matches * 3, 12);
}

function tokenize(input: string): string[] {
  return Array.from(new Set(input.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []));
}

function fallbackRisk(riskLevel: RiskLevel): I18nText {
  if (riskLevel === "high") {
    return {
      zh: "高风险工具；正式接入前需要审计、隔离和人工复核。",
      en: "High-risk tool; require audit, isolation, and human review before formal use."
    };
  }
  if (riskLevel === "medium") {
    return {
      zh: "中等风险；先用低权限数据试跑。",
      en: "Medium risk; pilot with low-privilege data first."
    };
  }
  return {
    zh: "低风险不等于无风险；仍建议小范围试用。",
    en: "Low risk is not no risk; still start with a narrow trial."
  };
}

function getNextStep(entry: AgentCatalogEntry): I18nText {
  if (entry.hasOnboardingGuide) {
    return {
      zh: "打开详情页的起步指南，先完成最小试用。",
      en: "Open the detail page guide and complete a minimal trial."
    };
  }
  if (entry.officialUrl) {
    return {
      zh: "先访问官方入口，核对文档、价格和使用限制。",
      en: "Open the official route first; check docs, pricing, and usage limits."
    };
  }
  return {
    zh: "先查看详情页风险和证据，再决定是否继续。",
    en: "Inspect the detail-page risks and evidence before continuing."
  };
}
