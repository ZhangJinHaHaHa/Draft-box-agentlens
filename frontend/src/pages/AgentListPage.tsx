import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

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
  filtersAreEmpty,
  filtersToSearchParams,
  searchParamsToFilters,
  type CatalogFilters
} from "@/domain/filters";

interface AgentListPageProps {
  config: AppConfig;
}

export function AgentListPage({ config }: AgentListPageProps): JSX.Element {
  const { t } = useTranslation("agents");
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilters = useMemo(() => searchParamsToFilters(searchParams), []);
  const [filters, setFilters] = useState<CatalogFilters>(initialFilters);

  const { entries, nativeStatus } = useCatalog({ config });
  const filtered = useMemo(() => applyFilters(entries, filters), [entries, filters]);

  useEffect(() => {
    const next = filtersToSearchParams(filters);
    setSearchParams(next, { replace: true });
  }, [filters, setSearchParams]);

  const handleChange = useCallback((next: CatalogFilters) => {
    setFilters(next);
  }, []);

  const isLoadingNative = nativeStatus === "loading" && entries.length === 0;

  return (
    <section className="container-page py-12">
      <PageHeading title={t("title")} description={t("subtitle")} />
      <div className="mt-10 flex flex-col gap-8">
        <SearchFilterBar filters={filters} onChange={handleChange} resultCount={filtered.length} />
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
