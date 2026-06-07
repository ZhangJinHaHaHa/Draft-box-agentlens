import { scenario } from "@/data/catalog/scenarios";
import type { AgentCatalogEntry, ScenarioRef } from "@/domain/catalog";
import type { I18nText } from "@/domain/i18nText";
import type { HostedAgentDraftPayload, HostedAgentHealthcheckPayload } from "@/lib/hostedAgentClient";

const SCENARIO_MATCHERS: Array<{ id: Parameters<typeof scenario>[0]; keywords: string[] }> = [
  { id: "defi-trading", keywords: ["defi", "交易", "trade", "trading", "wallet", "链上"] },
  { id: "customer-support", keywords: ["客服", "support", "customer", "工单"] },
  { id: "devops-sre", keywords: ["devops", "sre", "运维", "监控", "server", "infra"] },
  { id: "data-analysis", keywords: ["data", "analysis", "分析", "报表", "analytics"] },
  { id: "developer-assistant", keywords: ["code", "coding", "开发", "代码", "developer"] },
  { id: "workflow-automation", keywords: ["workflow", "automation", "流程", "自动化", "agent"] },
  { id: "content-generation", keywords: ["content", "copy", "文案", "生成", "写作"] },
  { id: "market-research", keywords: ["research", "市场", "调研", "投研", "摘要"] },
  { id: "knowledge-qa", keywords: ["knowledge", "qa", "问答", "知识库", "检索"] },
  { id: "multimodal-chat", keywords: ["voice", "image", "多模态", "语音", "图片"] }
];

export function mapHostedAgentsToCatalogEntries(
  drafts: readonly HostedAgentDraftPayload[]
): AgentCatalogEntry[] {
  return drafts
    .filter((draft) => draft.status === "approved")
    .map(mapHostedAgentToCatalogEntry);
}

export function mapHostedAgentToCatalogEntry(draft: HostedAgentDraftPayload): AgentCatalogEntry {
  const displayName = draft.readme.displayName?.trim() || draft.readme.agentName;
  const scenarios = mapUseCasesToScenarios(draft.readme.useCases);
  const healthcheck = draft.review?.healthcheck;
  const fingerprint = draft.review?.fingerprint.value;
  const observedAt = draft.approval?.approvedAt ?? draft.review?.submittedAt ?? draft.updatedAt;
  const platformImageDemo = isPlatformImageDemo(draft);

  return {
    id: draft.hostedAgentId,
    source: "marketplace",
    name: displayName,
    vendor: formatDeveloperVendor(draft.developerAddress),
    seller: {
      kind: "solo",
      label: {
        zh: draft.developerAddress ? `开发者 ${shortAddress(draft.developerAddress)}` : "托管 API 开发者",
        en: draft.developerAddress ? `Developer ${shortAddress(draft.developerAddress)}` : "Hosted API developer"
      },
      contextScale: {
        zh: "开发者 README、接口 schema、黑盒审核与 Gateway 计量记录",
        en: "Developer README, API schema, black-box review and Gateway metering"
      }
    },
    intro: asText(draft.readme.summary),
    tagline: platformImageDemo
      ? {
          zh: "提交镜像路径演示，平台负责更强审计与托管边界",
          en: "Image-submission path demo with stronger platform audit and runtime boundaries"
        }
      : {
          zh: "开发者托管运行，平台负责访问权与计量",
          en: "Seller-hosted runtime with platform access and metering"
        },
    category: platformImageDemo ? "Developer-listed platform image Agent" : "Developer-listed hosted Agent",
    tags: buildHostedTags(draft),
    scenarios,
    unsuitableScenarios: [],
    recommendedFor: buildRecommendedFor(draft),
    riskLevel: "medium",
    riskNotes: buildRiskNotes(draft, platformImageDemo),
    riskMitigation: [
      platformImageDemo
        ? {
            zh: "路演 MVP 先验证租赁、评价和信誉闭环；真实生产托管还需要容器 runtime、出口策略和密钥隔离。",
            en: "Use the roadshow MVP to verify rental, review and reputation flow; production hosting still needs container runtime, egress policy and secret isolation."
          }
        : {
            zh: "先用低敏感样例和小额租赁验证能力，再决定是否传入真实业务数据。",
            en: "Start with low-sensitivity samples and a small rental before sending real business data."
          }
    ],
    accessTypes: buildAccessTypes(draft.readme.integrationType),
    complexity: draft.readme.docsUrl || draft.readme.example ? "low" : "medium",
    hasOnboardingGuide: Boolean(draft.readme.docsUrl || draft.readme.example),
    docsUrl: draft.readme.docsUrl,
    officialUrl: draft.readme.supportUrl,
    pricingHint: {
      zh: "本地 MVP：支持租赁测试，正式价格待开发者确认",
      en: "Local MVP: rentable test path; production pricing to be confirmed by developer"
    },
    nativePricing: {
      rentable: true,
      label: {
        zh: "本地 MVP 租赁测试",
        en: "Local MVP rental test"
      }
    },
    latestObservedAt: observedAt,
    observationSummary: buildObservationSummary(healthcheck, fingerprint),
    runtimeSecurity: buildRuntimeSecurity(platformImageDemo)
  };
}

function buildHostedTags(draft: HostedAgentDraftPayload): string[] {
  const platformImageDemo = isPlatformImageDemo(draft);
  const raw = [
    "hosted-api",
    "developer-listed",
    "rentable",
    ...(platformImageDemo ? ["platform-image", "docker-image", "platform-hosted-demo"] : ["seller-hosted"]),
    draft.readme.integrationType,
    ...draft.readme.useCases,
    ...draft.readme.capabilities
  ];

  return Array.from(
    new Set(
      raw
        .flatMap((value) => value.split(/[,\s/|]+/u))
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 1)
        .slice(0, 16)
    )
  );
}

function buildRiskNotes(draft: HostedAgentDraftPayload, platformImageDemo: boolean): I18nText[] {
  if (platformImageDemo) {
    return [
      {
        zh: "该条目代表提交 Docker 镜像后的平台托管路径；当前路演 MVP 用演示 endpoint 串起租赁、评价和信誉闭环，真实容器长期运行仍需 production runtime。",
        en: "This entry represents the Docker-image submission path. The roadshow MVP uses a demo endpoint to exercise rental, review and reputation flow; production container hosting still needs the production runtime."
      },
      ...draft.readme.limitations.map(asText)
    ];
  }

  return [
    {
      zh: "该 Agent 未提交 Docker 镜像，运行环境在开发者侧；高敏感数据应先确认卖家的数据处理边界。",
      en: "This Agent did not submit a Docker image, so the runtime remains seller-hosted; verify data-handling boundaries before sending sensitive input."
    },
    ...draft.readme.limitations.map(asText)
  ];
}

function buildRuntimeSecurity(platformImageDemo: boolean): AgentCatalogEntry["runtimeSecurity"] {
  if (platformImageDemo) {
    return {
      kind: "platform_image",
      label: {
        zh: "已提交镜像（平台托管演示）",
        en: "Image submitted (platform-hosted demo)"
      },
      description: {
        zh: "开发者提交 Docker 镜像后，平台可绑定版本指纹、运行沙箱审计，并在受控 runtime 中提供租赁访问。当前 MVP 用演示 endpoint 表达这条路径。",
        en: "After a developer submits a Docker image, AgentLens can bind a version fingerprint, run sandbox audit and serve rentals from a controlled runtime. This MVP uses a demo endpoint to represent that path."
      },
      evidenceLabel: {
        zh: "镜像路径 Demo 指纹",
        en: "Image-path demo fingerprint"
      }
    };
  }

  return {
    kind: "seller_hosted",
    label: {
      zh: "未提交镜像（卖家托管）",
      en: "No image submitted (seller-hosted)"
    },
    description: {
      zh: "平台通过 Gateway 做访问权、限流和计量，但不会在平台云端运行该 Agent 的镜像。",
      en: "AgentLens can provide Gateway access control, rate limits and metering, but does not run this Agent image in the platform cloud."
    },
    evidenceLabel: {
      zh: "Hosted 指纹",
      en: "Hosted fingerprint"
    }
  };
}

function isPlatformImageDemo(draft: HostedAgentDraftPayload): boolean {
  const text = [
    draft.readme.agentName,
    draft.readme.displayName,
    draft.readme.integrationType,
    ...draft.readme.useCases,
    ...draft.readme.capabilities
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("platform-image") ||
    text.includes("docker-image") ||
    text.includes("image-submitted") ||
    text.includes("submitted-image") ||
    text.includes("已提交镜像") ||
    text.includes("提交镜像")
  );
}

function buildRecommendedFor(draft: HostedAgentDraftPayload): I18nText[] {
  const useCases = draft.readme.useCases.length > 0 ? draft.readme.useCases : [draft.readme.summary];
  return useCases.slice(0, 4).map((value) => ({
    zh: value,
    en: value
  }));
}

function mapUseCasesToScenarios(useCases: readonly string[]): ScenarioRef[] {
  const text = useCases.join(" ").toLowerCase();
  const matched = SCENARIO_MATCHERS.filter((matcher) =>
    matcher.keywords.some((keyword) => text.includes(keyword.toLowerCase()))
  ).map((matcher) => scenario(matcher.id));

  if (matched.length > 0) {
    return dedupeScenarios(matched).slice(0, 3);
  }

  return [scenario("workflow-automation")];
}

function buildAccessTypes(integrationType: string): AgentCatalogEntry["accessTypes"] {
  const normalized = integrationType.toLowerCase();
  if (normalized.includes("browser")) return ["browser_ext", "cloud"];
  if (normalized.includes("local")) return ["local", "api"];
  if (normalized.includes("saas")) return ["saas", "api"];
  return ["api", "cloud"];
}

function buildObservationSummary(
  healthcheck: HostedAgentHealthcheckPayload | undefined,
  fingerprint: string | undefined
): I18nText {
  const fingerprintLabel = fingerprint ? ` fingerprint ${shortHash(fingerprint)}` : "";
  if (healthcheck?.status === "passed") {
    return {
      zh: `本地 MVP 黑盒审核通过健康检查${fingerprintLabel}。`,
      en: `Local MVP black-box review passed healthcheck${fingerprintLabel}.`
    };
  }
  if (healthcheck?.status === "failed") {
    return {
      zh: `本地 MVP 已生成 hosted 指纹，但健康检查失败，需人工复核。`,
      en: "Local MVP generated a hosted fingerprint, but healthcheck failed and needs manual review."
    };
  }
  return {
    zh: `本地 MVP 已生成 hosted 指纹，endpoint 需人工验证。`,
    en: "Local MVP generated a hosted fingerprint; endpoint needs manual validation."
  };
}

function formatDeveloperVendor(address: string | undefined): string {
  return address ? `Developer ${shortAddress(address)}` : "Hosted API developer";
}

function asText(value: string): I18nText {
  return {
    zh: value,
    en: value
  };
}

function dedupeScenarios(items: ScenarioRef[]): ScenarioRef[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function shortAddress(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function shortHash(value: string): string {
  const normalized = value.replace(/^sha256:/, "");
  return normalized.length > 14 ? `${normalized.slice(0, 10)}...` : normalized;
}
