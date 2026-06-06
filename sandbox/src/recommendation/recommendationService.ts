import type {
  RecommendationAccessType,
  RecommendationCatalogEntry,
  RecommendationConfidence,
  RecommendationComplexity,
  RecommendationPriority,
  RecommendationRequest,
  RecommendationResponse,
  RecommendationRiskLevel,
  RecommendationText,
  RecommendationType
} from "./recommendationTypes";

const DEFAULT_LIMIT = 5;
const RISK_WEIGHT: Record<RecommendationRiskLevel, number> = { low: 0, medium: 1, high: 2 };
const COMPLEXITY_WEIGHT: Record<RecommendationComplexity, number> = { low: 0, medium: 1, high: 2 };
const SOURCE_SCORE: Record<NonNullable<RecommendationCatalogEntry["source"]>, number> = {
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
  { scenarioId: "market-research", keywords: ["调研", "搜索", "竞品", "引用", "research", "search", "market", "citation"] },
  { scenarioId: "ide-coding", keywords: ["ide", "vscode", "编辑器", "补全", "autocomplete"] },
  { scenarioId: "agentic-coding", keywords: ["自主编程", "长任务", "多文件", "agentic", "multi-file"] },
  { scenarioId: "ui-prototyping", keywords: ["ui", "界面", "原型", "prototype", "design"] },
  { scenarioId: "fullstack-prototyping", keywords: ["全栈", "mvp", "应用", "app builder", "full-stack"] },
  { scenarioId: "knowledge-qa", keywords: ["知识库", "问答", "文档", "qa", "knowledge", "docs", "rag"] },
  { scenarioId: "multimodal-chat", keywords: ["多模态", "图片理解", "语音", "multimodal", "vision"] }
];

const ACCESS_KEYWORDS: Array<{ accessType: RecommendationAccessType; keywords: string[] }> = [
  { accessType: "api", keywords: ["api", "sdk", "集成"] },
  { accessType: "saas", keywords: ["saas", "网页", "web", "托管"] },
  { accessType: "cli", keywords: ["cli", "terminal", "终端", "命令行"] },
  { accessType: "browser_ext", keywords: ["browser", "extension", "浏览器", "插件"] },
  { accessType: "local", keywords: ["local", "本地", "自托管", "self-host"] },
  { accessType: "cloud", keywords: ["cloud", "云", "托管平台"] }
];

export function recommendFromCatalog(
  catalog: readonly RecommendationCatalogEntry[],
  request: RecommendationRequest
): RecommendationResponse {
  const query = normalize(request.query);
  const scenarioIds = unique([...(request.scenarioIds ?? []), ...inferScenarioIds(query)]);
  const accessTypes = unique([...(request.accessTypes ?? []), ...inferAccessTypes(query)]);
  const maxRiskLevel = request.maxRiskLevel ?? inferMaxRiskLevel(query);
  const complexity = request.complexity ?? inferComplexity(query);
  const priorities = unique([...(request.priorities ?? []), ...inferPriorities(query)]);
  const limit = normalizeLimit(request.limit);

  const results = catalog
    .map((entry, index) =>
      scoreEntry(entry, index, {
        query,
        scenarioIds,
        accessTypes,
        maxRiskLevel,
        complexity,
        priorities
      })
    )
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.agentId.localeCompare(b.agentId))
    .slice(0, limit);

  return {
    interpretation: {
      scenarioIds,
      accessTypes,
      ...(maxRiskLevel ? { maxRiskLevel } : {}),
      ...(complexity ? { complexity } : {}),
      priorities,
      limit
    },
    results
  };
}

interface ScoreContext {
  query: string;
  scenarioIds: string[];
  accessTypes: RecommendationAccessType[];
  maxRiskLevel?: RecommendationRiskLevel;
  complexity?: RecommendationComplexity;
  priorities: RecommendationPriority[];
}

function scoreEntry(
  entry: RecommendationCatalogEntry,
  index: number,
  context: ScoreContext
): RecommendationResponse["results"][number] {
  let score = SOURCE_SCORE[entry.source ?? "listed"] - index * 0.01;
  const reasons: RecommendationText[] = [];
  const matchedScenarioIds: string[] = [];
  const evidenceUsed: string[] = [`source:${entry.source ?? "listed"}`];
  const entryScenarioIds = new Set(entry.scenarioIds);
  const unsuitableScenarioIds = new Set(entry.unsuitableScenarioIds);

  for (const scenarioId of context.scenarioIds) {
    if (entryScenarioIds.has(scenarioId)) {
      score += 36;
      matchedScenarioIds.push(scenarioId);
      evidenceUsed.push(`scenario:${scenarioId}`);
      reasons.push({
        zh: `匹配场景：${scenarioId}`,
        en: `Matches scenario: ${scenarioId}`
      });
    }
    if (unsuitableScenarioIds.has(scenarioId)) {
      score -= 42;
    }
  }

  for (const accessType of context.accessTypes) {
    if (entry.accessTypes.includes(accessType)) {
      score += 12;
      evidenceUsed.push(`access:${accessType}`);
    }
  }

  const keywordHits = countKeywordHits(entry, context.query);
  if (keywordHits > 0) {
    score += Math.min(keywordHits * 7, 28);
    evidenceUsed.push("keyword_match");
    reasons.push({
      zh: "名称、标签或说明命中了关键词",
      en: "Name, tags or description match the keywords"
    });
  }

  if (context.maxRiskLevel) {
    const delta = RISK_WEIGHT[context.maxRiskLevel] - RISK_WEIGHT[entry.riskLevel];
    if (delta >= 0) {
      score += entry.riskLevel === "low" ? 8 : 4;
      evidenceUsed.push(`risk:${entry.riskLevel}`);
      reasons.push({ zh: "风险等级符合偏好", en: "Risk level fits the preference" });
    } else {
      score += delta * 20;
    }
  }

  if (context.complexity) {
    score += context.complexity === entry.complexity
      ? 8
      : -Math.abs(COMPLEXITY_WEIGHT[context.complexity] - COMPLEXITY_WEIGHT[entry.complexity]) * 4;
    if (context.complexity === entry.complexity) {
      evidenceUsed.push(`complexity:${entry.complexity}`);
    }
  }

  for (const priority of context.priorities) {
    score += scorePriority(entry, priority, reasons, evidenceUsed);
  }

  if (entry.hasOnboardingGuide) {
    score += 5;
    evidenceUsed.push("onboarding_guide");
  }
  if (entry.hasAuditEvidence) {
    score += 6;
    evidenceUsed.push("audit_evidence");
  }
  if (entry.platformSignals?.developerTrustStatus === "verified") {
    evidenceUsed.push("developer_verified");
  }
  if (entry.platformSignals?.paidOrders && entry.platformSignals.paidOrders > 0) {
    evidenceUsed.push("platform_paid_orders");
  }
  if (entry.platformSignals?.reputationScore !== undefined) {
    evidenceUsed.push("platform_reputation");
  }

  if (reasons.length === 0 && score > 0) {
    reasons.push({ zh: "作为基线候选进入结果", en: "Included as a baseline candidate" });
  }

  const fitScore = computeFitScore(score);
  const trustScore = computeTrustScore(entry);
  const riskScore = computeRiskScore(entry);
  const missingEvidence = computeMissingEvidence(entry);
  const tradeoffs = buildTradeoffs(entry, trustScore, riskScore, missingEvidence);

  return {
    agentId: entry.id,
    score: Math.round(score * 100) / 100,
    fitScore,
    trustScore,
    riskScore,
    confidence: computeConfidence(fitScore, trustScore, missingEvidence),
    recommendationType: pickRecommendationType(entry, context, matchedScenarioIds),
    reasons: reasons.slice(0, 3),
    tradeoffs,
    evidenceUsed: unique(evidenceUsed),
    missingEvidence,
    matchedScenarioIds
  };
}

function scorePriority(
  entry: RecommendationCatalogEntry,
  priority: RecommendationPriority,
  reasons: RecommendationText[],
  evidenceUsed: string[]
): number {
  switch (priority) {
    case "low-risk":
      if (entry.riskLevel === "low") {
        reasons.push({ zh: "更偏低风险工具", en: "Favours lower-risk tools" });
        evidenceUsed.push("priority:low-risk");
        return 10;
      }
      return entry.riskLevel === "high" ? -18 : -4;
    case "fast-start":
      if (entry.complexity === "low" || entry.hasOnboardingGuide) {
        reasons.push({ zh: "更容易快速上手", en: "Easier to start quickly" });
        evidenceUsed.push("priority:fast-start");
        return 10;
      }
      return -6;
    case "self-host":
      if (entry.accessTypes.includes("local") || entry.tags.some((tag) => ["open-source", "self-host"].includes(tag))) {
        reasons.push({ zh: "支持本地或自托管路径", en: "Supports local or self-hosted deployment" });
        evidenceUsed.push("priority:self-host");
        return 12;
      }
      return -6;
    case "api-first":
      if (entry.accessTypes.includes("api")) {
        reasons.push({ zh: "适合 API 集成", en: "Fits API-first integration" });
        evidenceUsed.push("priority:api-first");
        return 10;
      }
      return -2;
    case "audited":
      if (entry.hasAuditEvidence) {
        reasons.push({ zh: "已有审计证据", en: "Has audit evidence" });
        evidenceUsed.push("priority:audited");
        return 14;
      }
      return -4;
  }
}

function computeFitScore(rawScore: number): number {
  return Math.round(clamp(rawScore, 1, 100));
}

function computeTrustScore(entry: RecommendationCatalogEntry): number {
  let score = entry.source === "curated" ? 64 : entry.source === "native" ? 60 : 46;
  if (entry.hasAuditEvidence) score += 18;
  if (entry.hasOnboardingGuide) score += 6;
  if (entry.riskLevel === "low") score += 8;
  if (entry.riskLevel === "high") score -= 12;

  const signals = entry.platformSignals;
  if (signals) {
    if (signals.platformRating !== undefined) score += normalizeSignalScore(signals.platformRating) * 0.12;
    if (signals.reputationScore !== undefined) score += normalizeSignalScore(signals.reputationScore) * 0.18;
    if (signals.paidOrders !== undefined) score += Math.min(signals.paidOrders, 20) * 0.5;
    if (signals.auditCount !== undefined) score += Math.min(signals.auditCount, 10);
    if (signals.accessBridgeSuccessRate !== undefined) score += clamp(signals.accessBridgeSuccessRate, 0, 1) * 8;
    if (signals.refundRate !== undefined) score -= clamp(signals.refundRate, 0, 1) * 28;
    if (signals.developerTrustStatus === "verified") score += 10;
    if (signals.developerTrustStatus === "suspended") score -= 35;
  }

  return Math.round(clamp(score, 0, 100));
}

function computeRiskScore(entry: RecommendationCatalogEntry): number {
  let score = entry.riskLevel === "low" ? 18 : entry.riskLevel === "medium" ? 45 : 76;
  if (entry.complexity === "high") score += 8;
  if (entry.hasAuditEvidence) score -= 8;
  const signals = entry.platformSignals;
  if (signals?.refundRate !== undefined) score += clamp(signals.refundRate, 0, 1) * 35;
  if (signals?.accessBridgeSuccessRate !== undefined) score -= clamp(signals.accessBridgeSuccessRate, 0, 1) * 6;
  if (signals?.developerTrustStatus === "suspended") score += 20;
  return Math.round(clamp(score, 0, 100));
}

function computeConfidence(
  fitScore: number,
  trustScore: number,
  missingEvidence: string[]
): RecommendationConfidence {
  if (fitScore >= 70 && trustScore >= 68 && missingEvidence.length <= 1) return "high";
  if (fitScore >= 45 && trustScore >= 45) return "medium";
  return "low";
}

function pickRecommendationType(
  entry: RecommendationCatalogEntry,
  context: ScoreContext,
  matchedScenarioIds: string[]
): RecommendationType {
  if (context.priorities.includes("audited") && entry.hasAuditEvidence) return "trusted_pick";
  if (context.priorities.includes("fast-start") && (entry.complexity === "low" || entry.hasOnboardingGuide)) {
    return "fast_start";
  }
  if (matchedScenarioIds.length > 0) return "best_fit";
  return "specialized";
}

function computeMissingEvidence(entry: RecommendationCatalogEntry): string[] {
  const missing: string[] = [];
  if (!entry.hasAuditEvidence) missing.push("audit_evidence");
  if (!entry.hasOnboardingGuide) missing.push("onboarding_guide");
  if (!entry.platformSignals?.reputationScore) missing.push("platform_reputation");
  if (entry.platformSignals?.paidOrders === undefined) missing.push("platform_usage");
  if (entry.platformSignals?.refundRate === undefined) missing.push("refund_history");
  return missing.slice(0, 5);
}

function buildTradeoffs(
  entry: RecommendationCatalogEntry,
  trustScore: number,
  riskScore: number,
  missingEvidence: string[]
): RecommendationText[] {
  const tradeoffs: RecommendationText[] = [];
  if (missingEvidence.includes("audit_evidence")) {
    tradeoffs.push({
      zh: "暂未看到平台审计证据，适合先小范围试用。",
      en: "No platform audit evidence yet, so start with a limited trial."
    });
  }
  if (entry.complexity === "high") {
    tradeoffs.push({
      zh: "能力更复杂，上手和集成成本可能更高。",
      en: "The capability is more complex, so onboarding and integration may take longer."
    });
  }
  if (riskScore >= 60) {
    tradeoffs.push({
      zh: "风险分较高，建议确认权限边界和失败兜底。",
      en: "Risk is elevated; verify permission boundaries and fallback plans."
    });
  }
  if (trustScore < 50) {
    tradeoffs.push({
      zh: "平台可信信号还不充分，需要更多使用和信誉数据。",
      en: "Platform trust signals are still limited and need more usage or reputation data."
    });
  }
  return tradeoffs.slice(0, 2);
}

function normalizeSignalScore(value: number): number {
  return clamp(value > 100 ? value / 10 : value, 0, 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function inferScenarioIds(query: string): string[] {
  return SCENARIO_KEYWORDS
    .filter((rule) => rule.keywords.some((keyword) => query.includes(normalize(keyword))))
    .map((rule) => rule.scenarioId);
}

function inferAccessTypes(query: string): RecommendationAccessType[] {
  return ACCESS_KEYWORDS
    .filter((rule) => rule.keywords.some((keyword) => query.includes(normalize(keyword))))
    .map((rule) => rule.accessType);
}

function inferMaxRiskLevel(query: string): RecommendationRiskLevel | undefined {
  if (["低风险", "稳妥", "合规", "safe", "low risk", "compliance"].some((keyword) => query.includes(keyword))) {
    return "low";
  }
  if (["可接受中等风险", "medium risk"].some((keyword) => query.includes(keyword))) {
    return "medium";
  }
  return undefined;
}

function inferComplexity(query: string): RecommendationComplexity | undefined {
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

function countKeywordHits(entry: RecommendationCatalogEntry, query: string): number {
  if (!query) return 0;
  const haystack = normalize([
    entry.name,
    entry.vendor ?? "",
    entry.category,
    entry.intro.zh,
    entry.intro.en,
    ...entry.tags
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
