import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useSearchParams } from "react-router-dom";

import { AgentList } from "@/components/agent/AgentList";
import { SearchFilterBar } from "@/components/agent/SearchFilterBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeading } from "@/components/layout/PageHeading";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppConfig } from "@/config/appConfig";
import { useCatalog } from "@/hooks/useCatalog";
import {
  EMPTY_FILTERS,
  applyFilters,
  buildCatalogFacets,
  filtersAreEmpty,
  mergeFiltersToSearchParams,
  searchParamsToFilters,
  suggestFilterRelaxation,
  type FilterChip,
  type CatalogFilters
} from "@/domain/filters";
import { rankEntriesForNeed } from "@/domain/needMatchRank";
import { buildNeedParserTaxonomy, toFiltersFromNeedParse } from "@/domain/needParser";
import { useLocale } from "@/i18n/useLocale";
import { parseNeedWithLlm } from "@/lib/needParserClient";

interface AgentListPageProps {
  config: AppConfig;
}

export function AgentListPage({ config }: AgentListPageProps): JSX.Element {
  const { t } = useTranslation("agents");
  const { locale } = useLocale();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilters = useMemo(() => searchParamsToFilters(searchParams), []);
  const [filters, setFilters] = useState<CatalogFilters>(initialFilters);
  const [semanticParseError, setSemanticParseError] = useState("");
  const lastSemanticQueryRef = useRef("");

  const { entries, nativeStatus } = useCatalog({ config });
  const facets = useMemo(() => buildCatalogFacets(entries), [entries]);
  const taxonomy = useMemo(() => buildNeedParserTaxonomy(entries), [entries]);
  const filtered = useMemo(
    () => rankEntriesForNeed(applyFilters(entries, filters), filters),
    [entries, filters]
  );
  const relaxationSuggestion = useMemo(
    () => suggestFilterRelaxation(entries, filters),
    [entries, filters]
  );
  const llmNeedParserUnavailable =
    searchParams.get("llm") === "unavailable" ||
    (typeof location.state === "object" &&
      location.state !== null &&
      "llmNeedParserUnavailable" in location.state &&
      location.state.llmNeedParserUnavailable === true);

  useEffect(() => {
    setSearchParams((current) => {
      const next = mergeFiltersToSearchParams(current, filters);
      if (llmNeedParserUnavailable) {
        next.set("llm", "unavailable");
      }
      return next;
    }, { replace: true });
  }, [filters, llmNeedParserUnavailable, setSearchParams]);

  useEffect(() => {
    const query = filters.query.trim();
    if (!query || filters.need.trim() || entries.length === 0 || filtered.length > 0) return;
    if (lastSemanticQueryRef.current === query) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (lastSemanticQueryRef.current === query) return;
      lastSemanticQueryRef.current = query;
      void parseNeedWithLlm({ query, locale, taxonomy }).then((parsed) => {
        if (cancelled) return;
        if (parsed.ok) {
          setSemanticParseError("");
          setFilters(toFiltersFromNeedParse(parsed.result, query));
          return;
        }
        setSemanticParseError(parsed.error);
      });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [entries.length, filtered.length, filters.need, filters.query, locale, taxonomy]);

  const handleChange = useCallback((next: CatalogFilters) => {
    setFilters(next);
  }, []);

  const isLoadingNative = nativeStatus === "loading" && entries.length === 0;

  return (
    <section className="container-page py-12">
      <PageHeading title={t("title")} description={t("subtitle")} />
      <div className="mt-10 flex flex-col gap-8">
        {llmNeedParserUnavailable ? (
          <Card>
            <CardContent className="px-6 py-4 text-sm text-muted-foreground">
              {t("results.llmUnavailable")}
            </CardContent>
          </Card>
        ) : null}
        {semanticParseError ? (
          <Card>
            <CardContent className="px-6 py-4 text-sm text-destructive">
              {t("results.llmUnavailable")}
            </CardContent>
          </Card>
        ) : null}
        <SearchFilterBar filters={filters} facets={facets} onChange={handleChange} resultCount={filtered.length} />
        {isLoadingNative ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} className="h-44" />
            ))}
          </div>
        ) : (
          <AgentList
            entries={filtered}
            emptyState={
              <Card>
                <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
                  <p className="text-base font-medium">{t("results.empty")}</p>
                  <p className="max-w-md text-sm text-muted-foreground">{t("results.emptyHint")}</p>
                  {!filtersAreEmpty(filters) && relaxationSuggestion ? (
                    <p className="max-w-md text-sm text-foreground">
                      {t("results.relaxHint", {
                        filter: describeRelaxationChip(relaxationSuggestion.chip),
                        count: relaxationSuggestion.resultCount
                      })}
                    </p>
                  ) : null}
                  {!filtersAreEmpty(filters) ? (
                    <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
                      {t("filters.clear")}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            }
          />
        )}
      </div>
    </section>
  );
}

function describeRelaxationChip(chip: FilterChip): string {
  switch (chip.kind) {
    case "query":
      return `"${String(chip.value)}"`;
    case "need":
      return `need:${String(chip.value)}`;
    case "scenario":
      return `scenario:${String(chip.value)}`;
    case "tag":
      return `tag:${String(chip.value)}`;
    case "category":
      return `category:${String(chip.value)}`;
    case "source":
      return `source:${String(chip.value)}`;
    case "access":
      return `access:${String(chip.value)}`;
    case "trustTier":
      return `tier:${String(chip.value)}`;
    case "risk":
      return `risk:${String(chip.value)}`;
    case "complexity":
      return `complexity:${String(chip.value)}`;
    case "price":
      return `price:${String(chip.value)}`;
    case "auditStatus":
      return `auditStatus:${String(chip.value)}`;
    case "score":
      return `score:${String(chip.value)}`;
    case "hasOnboarding":
      return "onboarding";
    case "hasAudit":
      return "audit";
    case "rentable":
      return "rentable";
    case "sort":
      return `sort:${String(chip.value)}`;
  }
}
