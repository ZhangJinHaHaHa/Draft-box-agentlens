import type { I18nText } from "./i18nText";
import { isNonZeroHash } from "@/lib/chainEvidence";

export type AgentSource = "marketplace" | "curated" | "listed" | "native";

export type RiskLevel = "low" | "medium" | "high";
export type Complexity = "low" | "medium" | "high";

export type AccessType = "api" | "saas" | "cli" | "browser_ext" | "local" | "cloud";

export type TrustTier = 0 | 1 | 2 | 3;

/**
 * Who is behind a marketplace agent. The buyer is really comparing SELLERS —
 * a big firm's agent and a solo practitioner's agent differ in the depth,
 * scale and provenance of the private context that backs them, even within the
 * same category. `kind` drives the badge; `label`/`contextScale` say who they
 * are and what corpus stands behind the service.
 */
export type SellerKind = "solo" | "boutique" | "firm" | "institution" | "platform";

export interface SellerProfile {
  kind: SellerKind;
  /** Who the seller is, e.g. "金衡律师事务所 · 200+ 律师". */
  label: I18nText;
  /** What private context stands behind it, e.g. "十万级案卷库". */
  contextScale: I18nText;
}

export interface ScenarioRef {
  /** Stable identifier — also drives the URL filter and i18n key. */
  id: string;
  label: I18nText;
}

export interface AgentChainEvidence {
  /** True when the latest audit record passed (status === 1). */
  auditPassed?: boolean;
  /** Non-zero report hash on the latest audit record. */
  reportHash?: string;
  /** Non-zero attestation hash recorded by the listener. */
  attestationHash?: string;
  /** Latest reputation score (0-1000 in the v2 contract). */
  reputationScore?: number;
  /** Token id minted by the registry. Mirror of `tokenId` for convenience. */
  tokenId?: string;
  /** Last audit unix timestamp in seconds, useful for sorting. */
  lastAuditAt?: number;
  /** Number of audits ever recorded for this token. */
  auditCount?: number;
}

export interface AgentNativePricing {
  /** Free-form pricing label (e.g. "$0.05 / 1K req"). */
  label?: I18nText;
  /** Whether the agent is rentable on the platform marketplace. */
  rentable?: boolean;
}

export type AgentRuntimeSecurityKind = "platform_image" | "seller_hosted" | "external_tool";

export interface AgentRuntimeSecurity {
  kind: AgentRuntimeSecurityKind;
  label: I18nText;
  description: I18nText;
  /** Short factual evidence label, e.g. "image recognized". */
  evidenceLabel?: I18nText;
}

export interface AgentCatalogEntry {
  /** Stable string id. For native agents this matches `tokenId`. */
  id: string;
  source: AgentSource;
  name: string;
  vendor?: string;
  /** Marketplace agents: structured seller provenance for side-by-side compare. */
  seller?: SellerProfile;
  intro: I18nText;
  category: string;
  tags: string[];
  scenarios: ScenarioRef[];
  unsuitableScenarios: ScenarioRef[];
  recommendedFor: I18nText[];
  riskLevel: RiskLevel;
  riskNotes: I18nText[];
  /** Optional mitigation copy paired with the risk notes. */
  riskMitigation?: I18nText[];
  accessTypes: AccessType[];
  complexity: Complexity;
  hasOnboardingGuide: boolean;
  officialUrl?: string;
  docsUrl?: string;
  pricingHint?: I18nText;
  pricingUrl?: string;
  /** Native-only: maps to the on-chain tokenId. */
  tokenId?: string;
  /** Curated/listed: most recent observation timestamp (ISO date). */
  latestObservedAt?: string;
  /** Curated/listed: short observation summary the timeline can fall back to. */
  observationSummary?: I18nText;
  /** Editorial Tier hint, only used when the rule engine cannot determine a tier deterministically. */
  trustTierHint?: TrustTier;
  /** Optional chain evidence (populated for native or merged native+curated). */
  chainEvidence?: AgentChainEvidence;
  /** Native-only pricing extension. */
  nativePricing?: AgentNativePricing;
  /** Optional editorial tagline shown above the intro on the detail page. */
  tagline?: I18nText;
  /** Buyer-visible runtime boundary signal. This is not a platform security endorsement. */
  runtimeSecurity?: AgentRuntimeSecurity;
}

interface MergeOptions {
  /** Index of native agents by id (preferred merge key). */
  nativeById: Map<string, AgentCatalogEntry>;
  /** Index of native agents by lowercased name (fallback merge key). */
  nativeByName: Map<string, AgentCatalogEntry>;
}

export interface MergeCatalogInput {
  curated: readonly AgentCatalogEntry[];
  listed: readonly AgentCatalogEntry[];
  native: readonly AgentCatalogEntry[];
  /**
   * Seller-listed expert agents (private accumulated context). Optional so
   * existing callers/tests that predate the marketplace tier keep compiling.
   */
  marketplace?: readonly AgentCatalogEntry[];
}

export interface MergedCatalog {
  entries: AgentCatalogEntry[];
  byId: Map<string, AgentCatalogEntry>;
  bySource: Record<AgentSource, AgentCatalogEntry[]>;
}

function buildNativeIndexes(native: readonly AgentCatalogEntry[]): MergeOptions {
  const nativeById = new Map<string, AgentCatalogEntry>();
  const nativeByName = new Map<string, AgentCatalogEntry>();
  for (const entry of native) {
    nativeById.set(entry.id, entry);
    if (entry.name) {
      nativeByName.set(entry.name.trim().toLowerCase(), entry);
    }
  }
  return { nativeById, nativeByName };
}

function findNativeMatch(entry: AgentCatalogEntry, options: MergeOptions): AgentCatalogEntry | undefined {
  if (entry.tokenId) {
    const direct = options.nativeById.get(entry.tokenId);
    if (direct) return direct;
  }
  const direct = options.nativeById.get(entry.id);
  if (direct) return direct;
  if (entry.name) {
    return options.nativeByName.get(entry.name.trim().toLowerCase());
  }
  return undefined;
}

function mergeNativeInto(curated: AgentCatalogEntry, native: AgentCatalogEntry): AgentCatalogEntry {
  return {
    ...curated,
    tokenId: native.tokenId ?? curated.tokenId,
    chainEvidence: { ...curated.chainEvidence, ...native.chainEvidence },
    nativePricing: { ...curated.nativePricing, ...native.nativePricing },
    accessTypes: Array.from(new Set([...curated.accessTypes, ...native.accessTypes])),
    tags: Array.from(new Set([...curated.tags, ...native.tags])),
    /*
     * The curated entry already owns a deeply-edited intro/scenarios/risk story,
     * so we keep those intact even when the on-chain registry knows the agent
     * by another name. We DO surface chain evidence so trustTier can promote.
     */
    source: curated.source
  };
}

/**
 * Combine marketplace, curated, listed and native sources into one ordered list.
 *
 * Ordering: marketplace → curated → listed → native (only the natives that
 * didn't merge into another entry). Marketplace (seller-listed expert agents)
 * leads so the platform's core inventory surfaces first. Within each bucket we
 * keep the input order so editors stay in control of what surfaces first.
 */
export function mergeCatalog({ curated, listed, native, marketplace = [] }: MergeCatalogInput): MergedCatalog {
  const indexes = buildNativeIndexes(native);
  const consumedNativeIds = new Set<string>();

  const mergeBucket = (entry: AgentCatalogEntry): AgentCatalogEntry => {
    const match = findNativeMatch(entry, indexes);
    if (match) {
      consumedNativeIds.add(match.id);
      return mergeNativeInto(entry, match);
    }
    return entry;
  };

  const mergedMarketplace: AgentCatalogEntry[] = marketplace.map(mergeBucket);
  const mergedCurated: AgentCatalogEntry[] = curated.map(mergeBucket);
  const mergedListed: AgentCatalogEntry[] = listed.map(mergeBucket);

  const remainingNative = native.filter((entry) => !consumedNativeIds.has(entry.id));

  const entries = [...mergedMarketplace, ...mergedCurated, ...mergedListed, ...remainingNative];

  const byId = new Map<string, AgentCatalogEntry>();
  for (const entry of entries) {
    byId.set(entry.id, entry);
  }

  return {
    entries,
    byId,
    bySource: {
      marketplace: mergedMarketplace,
      curated: mergedCurated,
      listed: mergedListed,
      native: remainingNative
    }
  };
}

export function isNativeEntry(entry: AgentCatalogEntry): boolean {
  return entry.source === "native" || Boolean(entry.tokenId);
}

const PLATFORM_IMAGE_RUNTIME_SECURITY: AgentRuntimeSecurity = {
  kind: "platform_image",
  label: { zh: "平台镜像已识别", en: "Platform image recognized" },
  description: {
    zh: "卖家已提交 Docker 镜像，平台可在云端受控运行。",
    en: "The seller submitted a Docker image, so the platform can run it in a controlled cloud runtime."
  },
  evidenceLabel: { zh: "镜像已识别", en: "Image recognized" }
};

const SELLER_HOSTED_RUNTIME_SECURITY: AgentRuntimeSecurity = {
  kind: "seller_hosted",
  label: { zh: "未识别镜像", en: "Image not recognized" },
  description: {
    zh: "平台未识别到 Docker 镜像，买家输入可能暴露给卖家运行环境。",
    en: "The platform has not recognized a Docker image, so buyer input may be exposed to the seller runtime."
  }
};

const EXTERNAL_TOOL_RUNTIME_SECURITY: AgentRuntimeSecurity = {
  kind: "external_tool",
  label: { zh: "外部工具 / 不适用", en: "External tool / N/A" },
  description: {
    zh: "这是平台目录中的外部工具，平台不判断其 Docker 镜像运行边界。",
    en: "This is an external tool in the directory, so the platform does not judge its Docker image runtime boundary."
  }
};

export function getRuntimeSecurity(entry: AgentCatalogEntry): AgentRuntimeSecurity {
  if (entry.runtimeSecurity) return entry.runtimeSecurity;
  if (isNativeEntry(entry)) return PLATFORM_IMAGE_RUNTIME_SECURITY;
  if (entry.source === "marketplace") return SELLER_HOSTED_RUNTIME_SECURITY;
  return EXTERNAL_TOOL_RUNTIME_SECURITY;
}

export function hasAuditEvidence(entry: AgentCatalogEntry): boolean {
  const chain = entry.chainEvidence;
  if (!chain) return false;
  return Boolean(
    chain.auditPassed ||
      isNonZeroHash(chain.reportHash) ||
      isNonZeroHash(chain.attestationHash)
  );
}

export function hasOnboarding(entry: AgentCatalogEntry): boolean {
  return entry.hasOnboardingGuide;
}

export function isRentable(entry: AgentCatalogEntry): boolean {
  return Boolean(entry.nativePricing?.rentable);
}
