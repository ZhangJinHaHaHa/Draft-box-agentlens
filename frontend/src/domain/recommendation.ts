import { hasAuditEvidence, type AccessType, type AgentCatalogEntry, type Complexity, type RiskLevel } from "./catalog";
import type { I18nText } from "./i18nText";
import { computeTrustTier } from "./trustTier";

export type RecommendationPriority = "low-risk" | "fast-start" | "self-host" | "api-first" | "audited";

export interface RecommendationRequest {
  query: string;
  scenarioIds?: string[];
  accessTypes?: AccessType[];
  maxRiskLevel?: RiskLevel;
  complexity?: Complexity;
  priorities?: RecommendationPriority[];
  limit?: number;
}

export interface RecommendationMatch {
  entry: AgentCatalogEntry;
  score: number;
  reasons: I18nText[];
  matchedScenarioIds: string[];
}

const DEFAULT_LIMIT = 5;

const RISK_WEIGHT: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
const COMPLEXITY_WEIGHT: Record<Complexity, number> = { low: 0, medium: 1, high: 2 };
const SOURCE_SCORE: Record<AgentCatalogEntry["source"], number> = {
  curated: 8,
  native: 6,
  listed: 2
};

const SCENARIO_KEYWORDS: Array<{ scenarioId: string; keywords: string[] }> = [
  { scenarioId: "customer-support", keywords: ["客服", "客户支持", "工单", "support", "ticket", "helpdesk"] },
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
  { scenarioId: "knowledge-qa", keywords: ["知识库", "问答", "文档", "qa", "knowledge", "docs"] },
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

export function recommendAgents(
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
    .map((entry, index) => scoreEntry(entry, index, {
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

interface ScoreContext {
  query: string;
  scenarioIds: string[];
  accessTypes: AccessType[];
  maxRiskLevel?: RiskLevel;
  complexity?: Complexity;
  priorities: RecommendationPriority[];
}

function scoreEntry(entry: AgentCatalogEntry, index: number, context: ScoreContext): RecommendationMatch {
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
    score += context.complexity === entry.complexity ? 8 : -Math.abs(COMPLEXITY_WEIGHT[context.complexity] - COMPLEXITY_WEIGHT[entry.complexity]) * 4;
  }

  for (const priority of context.priorities) {
    score += scorePriority(entry, priority, reasons);
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

function scorePriority(
  entry: AgentCatalogEntry,
  priority: RecommendationPriority,
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

function inferPriorities(query: string): RecommendationPriority[] {
  const priorities: RecommendationPriority[] = [];
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

  return query
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token, idx, arr) => arr.indexOf(token) === idx)
    .filter((token) => haystack.includes(token)).length;
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
