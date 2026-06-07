import type { RecommendationLlmConfig } from "../recommendation/recommendationLlmClient";

export interface NeedParserTaxonomy {
  scenarioIds: string[];
  tags: string[];
  accessTypes: string[];
  riskLevels: string[];
  complexities: string[];
}

export interface NeedParserRequest {
  query: string;
  locale: "zh" | "en";
  taxonomy: NeedParserTaxonomy;
}

export interface NeedParseResult {
  scenarioIds: string[];
  tags: string[];
  accessTypes: string[];
  riskLevels: string[];
  complexities: string[];
  hasAudit: boolean;
  hasOnboarding: boolean;
  confidence: number;
  unmatchedTerms: string[];
}

export type NeedParserFetchLike = typeof fetch;

const DEFAULT_TIMEOUT_MS = 30_000;

export async function parseNeedWithConfiguredLlm(
  request: NeedParserRequest,
  config: RecommendationLlmConfig,
  fetchImpl: NeedParserFetchLike = fetch
): Promise<NeedParseResult> {
  if (config.provider !== "openai") {
    return parseNeedLocally(request);
  }
  if (!config.apiKey || !config.model) {
    return parseNeedLocally(request);
  }

  const baseUrl = (config.apiBaseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        max_tokens: 1024,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You translate a user's natural-language need into AgentLens catalog filters.",
              "Return JSON only. Do not recommend agents directly.",
              "Use only values from the provided taxonomy. Unknown values must be omitted.",
              "Only set hasAudit, hasOnboarding, riskLevels, or complexities when the user explicitly asks for those constraints.",
              "Do not infer audit, onboarding, risk, or complexity merely because a task sounds important.",
              "Do not wrap the final JSON object in Markdown fences.",
              "Schema: scenarioIds:string[], tags:string[], accessTypes:string[], riskLevels:string[], complexities:string[], hasAudit:boolean, hasOnboarding:boolean, confidence:number, unmatchedTerms:string[].",
              "confidence must be a number from 0 to 1."
            ].join(" ")
          },
          {
            role: "user",
            content: JSON.stringify(request)
          }
        ]
      })
    });

    if (!response.ok) {
      return parseNeedLocally(request);
    }

    const body = await response.json().catch(() => ({}));
    const content = extractOpenAiTextContent(body);
    if (!content) {
      return parseNeedLocally(request);
    }
    return mergeNeedParseResults(
      sanitizeNeedParseResult(parseJsonObjectFromText(content), request.taxonomy),
      parseNeedLocally(request)
    );
  } catch {
    return parseNeedLocally(request);
  } finally {
    clearTimeout(timeout);
  }
}

export function parseNeedParserRequest(payload: unknown): NeedParserRequest {
  const record = isRecord(payload) ? payload : {};
  const query = typeof record.query === "string" ? record.query.trim() : "";
  if (!query) {
    throw new Error("query is required.");
  }

  return {
    query,
    locale: record.locale === "en" ? "en" : "zh",
    taxonomy: normalizeTaxonomy(record.taxonomy)
  };
}

export function parseNeedLocally(input: NeedParserRequest): NeedParseResult {
  const normalized = input.query.trim().toLowerCase();
  const scenarioIds = pickAllowed(input.taxonomy.scenarioIds, [
    [["客服", "客户", "工单", "售后", "support", "ticket", "helpdesk"], "customer-support"],
    [["知识库", "问答", "文档", "引用", "knowledge", "docs", "rag", "qa"], "knowledge-qa"],
    [["研发", "代码", "编程", "coding", "developer", "ide"], "developer-assistant"],
    [["运维", "监控", "告警", "devops", "sre", "incident"], "devops-sre"],
    [["数据", "分析", "报表", "sql", "dashboard", "analysis"], "data-analysis"],
    [["自动化", "流程", "workflow", "automation"], "workflow-automation"],
    [["内容", "写作", "图片", "视频", "content", "copy", "image", "video"], "content-generation"],
    [["调研", "搜索", "竞品", "research", "market"], "market-research"],
    [["原型", "界面", "ui", "prototype"], "ui-prototyping"]
  ], normalized);
  const accessTypes = pickAllowed(input.taxonomy.accessTypes, [
    [["api", "sdk", "接口"], "api"],
    [["网页", "web", "saas"], "saas"],
    [["本地", "自托管", "local", "self-host"], "local"],
    [["命令行", "终端", "cli"], "cli"]
  ], normalized);

  return {
    scenarioIds,
    tags: input.taxonomy.tags.filter((tag) => normalized.includes(tag.toLowerCase())).slice(0, 6),
    accessTypes,
    riskLevels: /低风险|安全|safe|low risk/.test(normalized) && input.taxonomy.riskLevels.includes("low")
      ? ["low"]
      : [],
    complexities: /简单|快速|容易|simple|easy|fast/.test(normalized) && input.taxonomy.complexities.includes("low")
      ? ["low"]
      : [],
    hasAudit: /审计|可信|验证|audit|verified|attestation/.test(normalized),
    hasOnboarding: /上手|教程|指南|guide|tutorial|onboarding/.test(normalized),
    confidence: scenarioIds.length > 0 || accessTypes.length > 0 ? 0.55 : 0.25,
    unmatchedTerms: []
  };
}

function extractOpenAiTextContent(value: unknown): string {
  if (!isRecord(value)) return "";
  const choices = Array.isArray(value.choices) ? value.choices : [];
  const choice = choices.find(isRecord);
  const message = isRecord(choice?.message) ? choice.message : undefined;
  const content = message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (!isRecord(item)) return "";
        if (typeof item.text === "string") return item.text;
        if (typeof item.content === "string") return item.content;
        return "";
      })
      .join("");
  }
  return typeof value.output_text === "string" ? value.output_text : "";
}

function parseJsonObjectFromText(content: string): unknown {
  try {
    return JSON.parse(stripJsonFence(content));
  } catch {
    const jsonObject = findFirstJsonObject(content);
    if (!jsonObject) {
      throw new Error("LLM need parse response did not include a JSON object.");
    }
    return JSON.parse(jsonObject);
  }
}

function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1].trim() : trimmed;
}

function findFirstJsonObject(content: string): string | undefined {
  const start = content.indexOf("{");
  if (start === -1) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < content.length; index += 1) {
    const char = content[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return content.slice(start, index + 1);
      }
    }
  }
  return undefined;
}

function normalizeTaxonomy(value: unknown): NeedParserTaxonomy {
  const record = isRecord(value) ? value : {};
  return {
    scenarioIds: stringArray(record.scenarioIds),
    tags: stringArray(record.tags),
    accessTypes: stringArray(record.accessTypes),
    riskLevels: stringArray(record.riskLevels),
    complexities: stringArray(record.complexities)
  };
}

function sanitizeNeedParseResult(value: unknown, taxonomy: NeedParserTaxonomy): NeedParseResult {
  const record = isRecord(value) ? value : {};
  return {
    scenarioIds: allowlistedStrings(record.scenarioIds, taxonomy.scenarioIds),
    tags: allowlistedStrings(record.tags, taxonomy.tags),
    accessTypes: allowlistedStrings(record.accessTypes, taxonomy.accessTypes),
    riskLevels: allowlistedStrings(record.riskLevels, taxonomy.riskLevels),
    complexities: allowlistedStrings(record.complexities, taxonomy.complexities),
    hasAudit: record.hasAudit === true,
    hasOnboarding: record.hasOnboarding === true,
    confidence: normalizeConfidence(record.confidence),
    unmatchedTerms: stringArray(record.unmatchedTerms).slice(0, 8)
  };
}

function mergeNeedParseResults(primary: NeedParseResult, fallback: NeedParseResult): NeedParseResult {
  return {
    scenarioIds: unique([...primary.scenarioIds, ...fallback.scenarioIds]),
    tags: unique([...primary.tags, ...fallback.tags]),
    accessTypes: unique([...primary.accessTypes, ...fallback.accessTypes]),
    riskLevels: unique([...primary.riskLevels, ...fallback.riskLevels]),
    complexities: unique([...primary.complexities, ...fallback.complexities]),
    hasAudit: primary.hasAudit || fallback.hasAudit,
    hasOnboarding: primary.hasOnboarding || fallback.hasOnboarding,
    confidence: Math.max(primary.confidence, fallback.confidence),
    unmatchedTerms: unique([...primary.unmatchedTerms, ...fallback.unmatchedTerms]).slice(0, 8)
  };
}

function pickAllowed<T extends string>(
  allowed: readonly T[],
  rules: Array<[keywords: string[], value: T]>,
  normalizedQuery: string
): T[] {
  return rules
    .filter(([keywords, value]) => allowed.includes(value) && keywords.some((keyword) => normalizedQuery.includes(keyword)))
    .map(([, value]) => value);
}

function allowlistedStrings(value: unknown, allowed: readonly string[]): string[] {
  const allowedSet = new Set(allowed);
  return unique(stringArray(value)).filter((item) => allowedSet.has(item));
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeConfidence(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
