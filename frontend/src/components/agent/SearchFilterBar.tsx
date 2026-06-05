import { Search, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/useLocale";
import type {
  AccessType,
  AgentSource,
  Complexity,
  RiskLevel,
  TrustTier
} from "@/domain/catalog";
import {
  EMPTY_FILTERS,
  filtersAreEmpty,
  type CatalogFilters,
  type SortKey
} from "@/domain/filters";
import { SCENARIO_IDS, SCENARIO_MAP } from "@/data/catalog/scenarios";
import { pickText } from "@/domain/i18nText";

interface SearchFilterBarProps {
  filters: CatalogFilters;
  onChange: (next: CatalogFilters) => void;
  resultCount: number;
  className?: string;
}

const SOURCE_OPTIONS: AgentSource[] = ["curated", "listed", "native"];
const ACCESS_OPTIONS: AccessType[] = ["api", "saas", "cli", "browser_ext", "local", "cloud"];
const TIER_OPTIONS: TrustTier[] = [3, 2, 1, 0];
const RISK_OPTIONS: RiskLevel[] = ["low", "medium", "high"];
const COMPLEXITY_OPTIONS: Complexity[] = ["low", "medium", "high"];
const SORT_OPTIONS: SortKey[] = ["default", "newest", "trust", "risk", "complexity"];

export function SearchFilterBar({
  filters,
  onChange,
  resultCount,
  className
}: SearchFilterBarProps): JSX.Element {
  const { locale } = useLocale();
  const { t } = useTranslation("agents");
  const { t: tc } = useTranslation("common");
  const { t: tt } = useTranslation("tiers");

  function patch(next: Partial<CatalogFilters>): void {
    onChange({ ...filters, ...next });
  }

  function toggleArray<T extends string | number>(
    key: keyof Pick<
      CatalogFilters,
      "scenarios" | "sources" | "accessTypes" | "trustTiers" | "riskLevels" | "complexities"
    >,
    value: T
  ): void {
    const current = filters[key] as T[];
    const exists = current.includes(value);
    const next = exists ? current.filter((v) => v !== value) : [...current, value];
    onChange({ ...filters, [key]: next } as CatalogFilters);
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={filters.query}
            onChange={(event) => patch({ query: event.target.value })}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
            aria-label={tc("actions.search")}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t("results.count", { count: resultCount })}
          </span>
          <Select value={filters.sort} onValueChange={(value) => patch({ sort: value as SortKey })}>
            <SelectTrigger className="h-9 w-[180px] text-xs">
              <SelectValue placeholder={t("sort.label")} />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`sort.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 py-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            {t("filters.title")}
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={filtersAreEmpty(filters)}
            onClick={() => onChange(EMPTY_FILTERS)}
          >
            {t("filters.clear")}
          </Button>
        </CardHeader>
        <Separator />
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-2 lg:grid-cols-3">
          <FilterGroup label={t("filters.scenario")}>
            {SCENARIO_IDS.map((id) => (
              <Checkbox
                key={id}
                checked={filters.scenarios.includes(id)}
                onChange={() => toggleArray("scenarios", id)}
                label={pickText(SCENARIO_MAP[id], locale)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label={t("filters.type")}>
            {SOURCE_OPTIONS.map((source) => (
              <Checkbox
                key={source}
                checked={filters.sources.includes(source)}
                onChange={() => toggleArray("sources", source)}
                label={tc(`agentSource.${source}`)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label={t("filters.access")}>
            {ACCESS_OPTIONS.map((option) => (
              <Checkbox
                key={option}
                checked={filters.accessTypes.includes(option)}
                onChange={() => toggleArray("accessTypes", option)}
                label={tc(`access.${option}`)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label={t("filters.trustTier")}>
            {TIER_OPTIONS.map((tier) => (
              <Checkbox
                key={tier}
                checked={filters.trustTiers.includes(tier)}
                onChange={() => toggleArray("trustTiers", tier)}
                label={tt(`labels.tier${tier}`)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label={t("filters.risk")}>
            {RISK_OPTIONS.map((option) => (
              <Checkbox
                key={option}
                checked={filters.riskLevels.includes(option)}
                onChange={() => toggleArray("riskLevels", option)}
                label={tc(`risk.${option}`)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label={t("filters.complexity")}>
            {COMPLEXITY_OPTIONS.map((option) => (
              <Checkbox
                key={option}
                checked={filters.complexities.includes(option)}
                onChange={() => toggleArray("complexities", option)}
                label={tc(`complexity.${option}`)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label={tc("agentSource.native")} className="md:col-span-2 lg:col-span-3">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Checkbox
                checked={filters.hasOnboarding}
                onChange={(event) => patch({ hasOnboarding: event.target.checked })}
                label={t("filters.onboarding")}
              />
              <Checkbox
                checked={filters.hasAudit}
                onChange={(event) => patch({ hasAudit: event.target.checked })}
                label={t("filters.audit")}
              />
              <Checkbox
                checked={filters.rentable}
                onChange={(event) => patch({ rentable: event.target.checked })}
                label={t("filters.rentable")}
              />
            </div>
          </FilterGroup>
        </CardContent>
      </Card>
    </div>
  );
}

interface FilterGroupProps {
  label: string;
  className?: string;
  children: React.ReactNode;
}

function FilterGroup({ label, className, children }: FilterGroupProps): JSX.Element {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
