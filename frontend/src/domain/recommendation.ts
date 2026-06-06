import {
  hasAuditEvidence,
  isNativeEntry,
  isRentable,
  type AccessType,
  type AgentCatalogEntry,
  type Complexity,
  type RiskLevel
} from "./catalog";
import type { I18nText } from "./i18nText";
import { computeTrustTier } from "./trustTier";

export type PlatformRecommendationPriority = "low-risk" | "fast-start" | "self-host" | "api-first" | "audited";
export type RecommendationUsageContext = "solo" | "team";
export type GuidedRecommendationPriority = "safety" | "ease" | "capability" | "price";
export type RecommendationPriority = GuidedRecommendationPriority;

export type RecommendationReasonCode =
  | "scenario-match"
  | "task-keyword"
  | "access-match"
  | "low-risk"
  | "easy-start"
  | "trust-evidence"
  | "rentable";

export interface RecommendationRequest {
  query: string;
  scenarioIds?: string[];
  accessTypes?: AccessType[];
  maxRiskLevel?: RiskLevel;
  complexity?: Complexity;
  priorities?: PlatformRecommendationPriority[];
  limit?: number;
}

export interface RecommendationMatch {
  entry: AgentCatalogEntry;
  score: number;
  reasons: I18nText[];
  matchedScenarioIds: string[];
}

export interface RecommendationInput {
  task: string;
  scenarioId?: string;
  usageContext: RecommendationUsageContext;
  preferredAccessType?: AccessType | "any";
  priority: GuidedRecommendationPriority;
  acceptsNative: boolean;
}

export interface RecommendationCandidate {
  entry: AgentCatalogEntry;
  score: number;
  reasonCodes: RecommendationReasonCode[];
  riskWarnings: I18nText[];
  nextStep: I18nText;
}

const DEFAULT_LIMIT = 5;

const RISK_WEIGHT: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
const COMPLEXITY_WEIGHT: Record<Complexity, number> = { low: 0, medium: 1, high: 2 };
const SOURCE_SCORE: Record<AgentCatalogEntry["source"], number> = {
  marketplace: 10,
  curated: 8,
  native: 6,
  listed: 2
};

const SCENARIO_KEYWORDS: Array<{ scenarioId: string; keywords: string[] }> = [
  { scenarioId: "customer-support", keywords: ["客服", "客户支持", "售后", "工单", "support", "customer-service", "ticket", "helpdesk", "help center"] },
  { scenarioId: "devops-sre", keywords: ["运维", "告警", "监控", "devops", "sre", "incident"] },
  { scenarioId: "data-analysis", keywords: ["数据", "分析", "报表", "sql", "analysis", "dashboard"] },
  { scenarioId: "developer-assistant", keywords: ["研发", "开发", "代码", "coding", "developer", "engineer"] },
  { scenarioId: "workflow-automation", keywords: ["自动化", "流程", "集成", "automation", "workflow", "integration"] },
  { scenarioId: "content-generation", keywords: ["内容", "写作", "文案", "视频", "图片", "content", "copy", "image", "video"] },
  { scenarioId: "market-research", keywords: ["调研", "搜索", "竞品", "research", "search", "market"] },
  { scenarioId: "ide-coding", keywords: ["ide", "vscode", "编辑器", "补全", "autocomplete"] },
  { scenarioId: "agentic-coding", keywords: ["自主编程", "长任务", "多文件", "agentic", "multi-file"] },
  { scenarioId: "ui-prototyping", keywords: ["ui", "界面", "原型", "prototype", "design"] },
  { scenarioId: "fullstack-prototyping", keywords: ["全栈", "mvp", "应用", "app builder", "full-stack"] },
  { scenarioId: "knowledge-qa", keywords: ["知识库", "问答", "文档", "qa", "knowledge", "docs", "rag"] },
  { scenarioId: "multimodal-chat", keywords: ["多模态", "图片理解", "语音", "multimodal", "vision"] }
];

const ACCESS_KEYWORDS: Array<{ accessType: AccessType; keywords: string[] }> = [
  { accessType: "api", keywords: ["api", "sdk", "集成"] },
  { accessType: "saas", keywords: ["saas", "网页", "web", "托管"] },
  { accessType: "cli", keywords: ["cli", "terminal", "终端", "命令行"] },
  { accessType: "browser_ext", keywords: ["browser", "extension", "浏览器", "插件"] },
  { accessType: "local", keywords: ["local", "本地", "自托管", "self-host"] },
  { accessType: "cloud", keywords: ["cloud", "云", "托管平台"] }
];

const guidedRiskScore: Record<RiskLevel, number> = {
  low: 4,
  medium: 1,
  high: -5
};

const guidedComplexityScore: Record<Complexity, number> = {
  low: 4,
  medium: 1,
  high: -3
};

export function recommendAgents(
  entries: readonly AgentCatalogEntry[],
  request: RecommendationRequest
): RecommendationMatch[];
export function recommendAgents(
  entries: readonly AgentCatalogEntry[],
  input: RecommendationInput
): RecommendationCandidate[];
export function recommendAgents(
  entries: readonly AgentCatalogEntry[],
  input: RecommendationRequest | RecommendationInput
): RecommendationMatch[] | RecommendationCandidate[] {
  return "query" in input
    ? recommendPlatformAgents(entries, input)
    : recommendGuidedAgents(entries, input);
}

function recommendPlatformAgents(
  entries: readonly AgentCatalogEntry[],
  request: RecommendationRequest
): RecommendationMatch[] {
  const query = normalize(request.query);
  const scenarioIds = unique([
    ...(request.scenarioIds ?? []),
    ...inferScenarioIds(query)
  ]);
  const accessTypes = unique([
    ...(request.accessTypes ?? []),
    ...inferAccessTypes(query)
  ]);
  const maxRiskLevel = request.maxRiskLevel ?? inferMaxRiskLevel(query);
  const complexity = request.complexity ?? inferComplexity(query);
  const priorities = unique([
    ...(request.priorities ?? []),
    ...inferPriorities(query)
  ]);
  const limit = normalizeLimit(request.limit);

  return entries
    .map((entry, index) => scorePlatformEntry(entry, index, {
      query,
      scenarioIds,
      accessTypes,
      maxRiskLevel,
      complexity,
      priorities
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit);
}

interface PlatformScoreContext {
  query: string;
  scenarioIds: string[];
  accessTypes: AccessType[];
  maxRiskLevel?: RiskLevel;
  complexity?: Complexity;
  priorities: PlatformRecommendationPriority[];
}

function scorePlatformEntry(entry: AgentCatalogEntry, index: number, context: PlatformScoreContext): RecommendationMatch {
  let score = SOURCE_SCORE[entry.source] - index * 0.01;
  const reasons: I18nText[] = [];
  const matchedScenarioIds: string[] = [];
  const scenarioMap = new Map(entry.scenarios.map((item) => [item.id, item]));
  const unsuitableIds = new Set(entry.unsuitableScenarios.map((item) => item.id));

  for (const scenarioId of context.scenarioIds) {
    const scenario = scenarioMap.get(scenarioId);
    if (scenario) {
      score += 36;
      matchedScenarioIds.push(scenarioId);
      reasons.push({
        zh: `匹配场景：${scenario.label.zh}`,
        en: `Matches scenario: ${scenario.label.en}`
      });
    }
    if (unsuitableIds.has(scenarioId)) {
      score -= 42;
    }
  }

  for (const accessType of context.accessTypes) {
    if (entry.accessTypes.includes(accessType)) {
      score += 12;
    }
  }

  const keywordHits = countKeywordHits(entry, context.query);
  if (keywordHits > 0) {
    score += Math.min(keywordHits * 7, 28);
    reasons.push({
      zh: "名称、标签或说明命中了你的关键词",
      en: "Name, tags or description match your keywords"
    });
  }

  if (context.maxRiskLevel) {
    const delta = RISK_WEIGHT[context.maxRiskLevel] - RISK_WEIGHT[entry.riskLevel];
    if (delta >= 0) {
      score += entry.riskLevel === "low" ? 8 : 4;
      reasons.push({
        zh: "风险等级符合偏好",
        en: "Risk level fits the preference"
      });
    } else {
      score += delta * 20;
    }
  }

  if (context.complexity) {
    score += context.complexity === entry.complexity
      ? 8
      : -Math.abs(COMPLEXITY_WEIGHT[context.complexity] - COMPLEXITY_WEIGHT[entry.complexity]) * 4;
  }

  for (const priority of context.priorities) {
    score += scorePlatformPriority(entry, priority, reasons);
  }

  const tier = computeTrustTier({ entry }).tier;
  score += tier * 4;
  if (entry.hasOnboardingGuide) {
    score += 5;
  }
  if (hasAuditEvidence(entry)) {
    score += 6;
  }

  if (reasons.length === 0 && score > 0) {
    reasons.push({
      zh: "作为基线候选进入结果",
      en: "Included as a baseline candidate"
    });
  }

  return {
    entry,
    score: Math.round(score * 100) / 100,
    reasons: reasons.slice(0, 3),
    matchedScenarioIds
  };
}

function scorePlatformPriority(
  entry: AgentCatalogEntry,
  priority: PlatformRecommendationPriority,
  reasons: I18nText[]
): number {
  switch (priority) {
    case "low-risk":
      if (entry.riskLevel === "low") {
        reasons.push({ zh: "更偏低风险工具", en: "Favours lower-risk tools" });
        return 10;
      }
      return entry.riskLevel === "high" ? -18 : -4;
    case "fast-start":
      if (entry.complexity === "low" || entry.hasOnboardingGuide) {
        reasons.push({ zh: "更容易快速上手", en: "Easier to start quickly" });
        return 10;
      }
      return -6;
    case "self-host":
      if (entry.accessTypes.includes("local") || entry.tags.some((tag) => ["open-source", "self-host"].includes(tag))) {
        reasons.push({ zh: "支持本地或自托管路径", en: "Supports local or self-hosted deployment" });
        return 12;
      }
      return -6;
    case "api-first":
      if (entry.accessTypes.includes("api")) {
        reasons.push({ zh: "适合 API 集成", en: "Fits API-first integration" });
        return 10;
      }
      return -2;
    case "audited":
      if (hasAuditEvidence(entry)) {
        reasons.push({ zh: "已有链上审计证据", en: "Has on-chain audit evidence" });
        return 14;
      }
      return -4;
  }
}

function recommendGuidedAgents(
  entries: readonly AgentCatalogEntry[],
  input: RecommendationInput
): RecommendationCandidate[] {
  return entries
    .filter((entry) => input.acceptsNative || !isNativeEntry(entry))
    .map((entry) => scoreGuidedEntry(entry, input))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, DEFAULT_LIMIT);
}

function scoreGuidedEntry(entry: AgentCatalogEntry, input: RecommendationInput): RecommendationCandidate {
  const reasonCodes = new Set<RecommendationReasonCode>();
  let score = 0;

  if (input.scenarioId && entry.scenarios.some((scenario) => scenario.id === input.scenarioId)) {
    score += 12;
    reasonCodes.add("scenario-match");
  }

  const keywordScore = scoreGuidedKeywords(entry, input.task);
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

  score += guidedRiskScore[entry.riskLevel];
  score += guidedComplexityScore[entry.complexity];
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

function inferScenarioIds(query: string): string[] {
  return SCENARIO_KEYWORDS
    .filter((rule) => rule.keywords.some((keyword) => query.includes(normalize(keyword))))
    .map((rule) => rule.scenarioId);
}

function inferAccessTypes(query: string): AccessType[] {
  return ACCESS_KEYWORDS
    .filter((rule) => rule.keywords.some((keyword) => query.includes(normalize(keyword))))
    .map((rule) => rule.accessType);
}

function inferMaxRiskLevel(query: string): RiskLevel | undefined {
  if (["低风险", "稳妥", "合规", "safe", "low risk", "compliance"].some((keyword) => query.includes(keyword))) {
    return "low";
  }
  if (["可接受中等风险", "medium risk"].some((keyword) => query.includes(keyword))) {
    return "medium";
  }
  return undefined;
}

function inferComplexity(query: string): Complexity | undefined {
  if (["简单", "快速", "新手", "easy", "simple", "fast"].some((keyword) => query.includes(keyword))) {
    return "low";
  }
  if (["高级", "复杂", "可编排", "advanced", "complex"].some((keyword) => query.includes(keyword))) {
    return "high";
  }
  return undefined;
}

function inferPriorities(query: string): PlatformRecommendationPriority[] {
  const priorities: PlatformRecommendationPriority[] = [];
  if (["低风险", "稳妥", "合规", "safe", "compliance"].some((keyword) => query.includes(keyword))) {
    priorities.push("low-risk");
  }
  if (["快速", "上手", "新手", "fast", "easy"].some((keyword) => query.includes(keyword))) {
    priorities.push("fast-start");
  }
  if (["自托管", "本地", "开源", "self-host", "open-source"].some((keyword) => query.includes(keyword))) {
    priorities.push("self-host");
  }
  if (["api", "sdk", "集成"].some((keyword) => query.includes(keyword))) {
    priorities.push("api-first");
  }
  if (["审计", "可信", "attestation", "audited"].some((keyword) => query.includes(keyword))) {
    priorities.push("audited");
  }
  return priorities;
}

function countKeywordHits(entry: AgentCatalogEntry, query: string): number {
  if (!query) return 0;
  const haystack = normalize([
    entry.name,
    entry.vendor ?? "",
    entry.category,
    entry.intro.zh,
    entry.intro.en,
    ...entry.tags,
    ...entry.recommendedFor.flatMap((item) => [item.zh, item.en])
  ].join(" "));

  return collectQueryTerms(query)
    .filter((token) => token.length >= 2)
    .filter((token, idx, arr) => arr.indexOf(token) === idx)
    .filter((token) => haystack.includes(token)).length;
}

function collectQueryTerms(query: string): string[] {
  return [
    ...query.split(/\s+/),
    ...SCENARIO_KEYWORDS.flatMap((rule) => rule.keywords),
    ...ACCESS_KEYWORDS.flatMap((rule) => rule.keywords)
  ]
    .map(normalize)
    .filter((token) => token.length >= 2)
    .filter((token) => query.includes(token));
}

function scoreGuidedKeywords(entry: AgentCatalogEntry, task: string): number {
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

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeLimit(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(10, Math.trunc(value)));
}

function unique<T>(values: T[]): T[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}
