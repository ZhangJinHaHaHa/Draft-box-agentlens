import type {
  AccessType,
  AgentCatalogEntry,
  AgentSource,
  Complexity,
  RiskLevel,
  TrustTier
} from "./catalog";
import { hasAuditEvidence, isRentable } from "./catalog";
import { computeTrustTier } from "./trustTier";

export type SortKey = "default" | "newest" | "trust" | "risk" | "complexity";

export interface CatalogFilters {
  query: string;
  scenarios: string[];
  sources: AgentSource[];
  accessTypes: AccessType[];
  trustTiers: TrustTier[];
  riskLevels: RiskLevel[];
  complexities: Complexity[];
  hasOnboarding: boolean;
  hasAudit: boolean;
  rentable: boolean;
  sort: SortKey;
}

export const EMPTY_FILTERS: CatalogFilters = {
  query: "",
  scenarios: [],
  sources: [],
  accessTypes: [],
  trustTiers: [],
  riskLevels: [],
  complexities: [],
  hasOnboarding: false,
  hasAudit: false,
  rentable: false,
  sort: "default"
};

export function filtersAreEmpty(filters: CatalogFilters): boolean {
  return (
    !filters.query &&
    filters.scenarios.length === 0 &&
    filters.sources.length === 0 &&
    filters.accessTypes.length === 0 &&
    filters.trustTiers.length === 0 &&
    filters.riskLevels.length === 0 &&
    filters.complexities.length === 0 &&
    !filters.hasOnboarding &&
    !filters.hasAudit &&
    !filters.rentable &&
    (filters.sort === "default" || filters.sort === undefined)
  );
}

const RISK_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
const COMPLEXITY_ORDER: Record<Complexity, number> = { low: 0, medium: 1, high: 2 };

function matchesQuery(entry: AgentCatalogEntry, query: string): boolean {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  if (entry.name.toLowerCase().includes(needle)) return true;
  if (entry.vendor?.toLowerCase().includes(needle)) return true;
  if (entry.intro.zh.toLowerCase().includes(needle)) return true;
  if (entry.intro.en.toLowerCase().includes(needle)) return true;
  if (entry.tags.some((tag) => tag.toLowerCase().includes(needle))) return true;
  if (
    entry.scenarios.some(
      (s) =>
        s.id.toLowerCase().includes(needle) ||
        s.label.zh.toLowerCase().includes(needle) ||
        s.label.en.toLowerCase().includes(needle)
    )
  ) {
    return true;
  }
  if (entry.category.toLowerCase().includes(needle)) return true;
  return false;
}

function matchesScenarios(entry: AgentCatalogEntry, scenarios: string[]): boolean {
  if (scenarios.length === 0) return true;
  const ids = new Set(entry.scenarios.map((s) => s.id));
  return scenarios.some((id) => ids.has(id));
}

function matchesSource(entry: AgentCatalogEntry, sources: AgentSource[]): boolean {
  if (sources.length === 0) return true;
  return sources.includes(entry.source);
}

function matchesAccess(entry: AgentCatalogEntry, accessTypes: AccessType[]): boolean {
  if (accessTypes.length === 0) return true;
  const set = new Set(entry.accessTypes);
  return accessTypes.some((value) => set.has(value));
}

function matchesTrust(entry: AgentCatalogEntry, tiers: TrustTier[]): boolean {
  if (tiers.length === 0) return true;
  const tier = computeTrustTier({ entry }).tier;
  return tiers.includes(tier);
}

function matchesRisk(entry: AgentCatalogEntry, levels: RiskLevel[]): boolean {
  if (levels.length === 0) return true;
  return levels.includes(entry.riskLevel);
}

function matchesComplexity(entry: AgentCatalogEntry, levels: Complexity[]): boolean {
  if (levels.length === 0) return true;
  return levels.includes(entry.complexity);
}

function matchesOnboarding(entry: AgentCatalogEntry, required: boolean): boolean {
  return !required || entry.hasOnboardingGuide;
}

function matchesAudit(entry: AgentCatalogEntry, required: boolean): boolean {
  if (!required) return true;
  return hasAuditEvidence(entry);
}

function matchesRentable(entry: AgentCatalogEntry, required: boolean): boolean {
  if (!required) return true;
  return isRentable(entry);
}

export function applyFilters(
  entries: readonly AgentCatalogEntry[],
  filters: CatalogFilters
): AgentCatalogEntry[] {
  const filtered = entries.filter(
    (entry) =>
      matchesQuery(entry, filters.query) &&
      matchesScenarios(entry, filters.scenarios) &&
      matchesSource(entry, filters.sources) &&
      matchesAccess(entry, filters.accessTypes) &&
      matchesTrust(entry, filters.trustTiers) &&
      matchesRisk(entry, filters.riskLevels) &&
      matchesComplexity(entry, filters.complexities) &&
      matchesOnboarding(entry, filters.hasOnboarding) &&
      matchesAudit(entry, filters.hasAudit) &&
      matchesRentable(entry, filters.rentable)
  );

  return sortEntries(filtered, filters.sort);
}

export function sortEntries(entries: AgentCatalogEntry[], sort: SortKey): AgentCatalogEntry[] {
  if (sort === "default") return entries;

  const arr = [...entries];

  switch (sort) {
    case "newest":
      arr.sort((a, b) => {
        const lhs = (a.latestObservedAt ?? "0000-00-00").localeCompare(b.latestObservedAt ?? "0000-00-00");
        return -lhs;
      });
      break;
    case "trust":
      arr.sort((a, b) => computeTrustTier({ entry: b }).tier - computeTrustTier({ entry: a }).tier);
      break;
    case "risk":
      arr.sort((a, b) => RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel]);
      break;
    case "complexity":
      arr.sort((a, b) => COMPLEXITY_ORDER[a.complexity] - COMPLEXITY_ORDER[b.complexity]);
      break;
  }

  return arr;
}

export interface UrlFilterEncoding {
  query?: string;
  scenarios?: string[];
  sources?: string[];
  accessTypes?: string[];
  trustTiers?: number[];
  riskLevels?: string[];
  complexities?: string[];
  hasOnboarding?: boolean;
  hasAudit?: boolean;
  rentable?: boolean;
  sort?: SortKey;
}

export function filtersToSearchParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.scenarios.length) params.set("scenario", filters.scenarios.join(","));
  if (filters.sources.length) params.set("source", filters.sources.join(","));
  if (filters.accessTypes.length) params.set("access", filters.accessTypes.join(","));
  if (filters.trustTiers.length) params.set("tier", filters.trustTiers.join(","));
  if (filters.riskLevels.length) params.set("risk", filters.riskLevels.join(","));
  if (filters.complexities.length) params.set("complexity", filters.complexities.join(","));
  if (filters.hasOnboarding) params.set("onboarding", "1");
  if (filters.hasAudit) params.set("audit", "1");
  if (filters.rentable) params.set("rentable", "1");
  if (filters.sort && filters.sort !== "default") params.set("sort", filters.sort);
  return params;
}

export function searchParamsToFilters(params: URLSearchParams): CatalogFilters {
  const sortRaw = params.get("sort");
  const allowedSort: SortKey[] = ["default", "newest", "trust", "risk", "complexity"];
  const sort = allowedSort.includes(sortRaw as SortKey) ? (sortRaw as SortKey) : "default";

  return {
    query: params.get("q") ?? "",
    scenarios: splitCsv(params.get("scenario")),
    sources: splitCsv(params.get("source")) as AgentSource[],
    accessTypes: splitCsv(params.get("access")) as AccessType[],
    trustTiers: splitCsv(params.get("tier"))
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => [0, 1, 2, 3].includes(value)) as TrustTier[],
    riskLevels: splitCsv(params.get("risk")) as RiskLevel[],
    complexities: splitCsv(params.get("complexity")) as Complexity[],
    hasOnboarding: params.get("onboarding") === "1",
    hasAudit: params.get("audit") === "1",
    rentable: params.get("rentable") === "1",
    sort
  };
}

function splitCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
