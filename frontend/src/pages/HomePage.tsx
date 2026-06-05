import { ArrowRight, Compass, Eye, Lightbulb, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { AgentList } from "@/components/agent/AgentList";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale } from "@/i18n/useLocale";
import { cn } from "@/lib/utils";
import type { AppConfig } from "@/config/appConfig";
import { useCatalog } from "@/hooks/useCatalog";

interface HomePageProps {
  config: AppConfig;
}

const SCENARIO_TILES: Array<{ key: string; scenarioId: string }> = [
  { key: "defi", scenarioId: "defi-trading" },
  { key: "support", scenarioId: "customer-support" },
  { key: "devops", scenarioId: "devops-sre" },
  { key: "data", scenarioId: "data-analysis" },
  { key: "dev", scenarioId: "developer-assistant" },
  { key: "automation", scenarioId: "workflow-automation" },
  { key: "content", scenarioId: "content-generation" },
  { key: "research", scenarioId: "market-research" }
];

const WHY_ICONS: Record<string, JSX.Element> = {
  facts: <Eye className="h-5 w-5" aria-hidden />,
  evidence: <ShieldCheck className="h-5 w-5" aria-hidden />,
  next: <Compass className="h-5 w-5" aria-hidden />
};

export function HomePage({ config }: HomePageProps): JSX.Element {
  const navigate = useNavigate();
  const { buildPath } = useLocale();
  const { t } = useTranslation("home");
  const { t: tc } = useTranslation("common");

  const { bySource, nativeStatus, nativeError } = useCatalog({ config });
  const curatedShowcase = bySource.curated.slice(0, 6);
  const nativeShowcase = bySource.native.slice(0, 3);

  const [query, setQuery] = useState("");

  function submitSearch(): void {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("q", query.trim());
    }
    const search = params.toString();
    navigate({
      pathname: buildPath("/agents"),
      search: search ? `?${search}` : undefined
    });
  }

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="container-page pt-24 pb-20">
        <div className="flex flex-col items-start gap-6 max-w-3xl">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t("hero.eyebrow")}
          </span>
          <h1 className="text-display text-4xl sm:text-5xl md:text-6xl">{t("hero.title")}</h1>
          <p className="text-base text-muted-foreground sm:text-lg">{t("hero.subtitle")}</p>

          <form
            className="mt-2 flex w-full max-w-2xl flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
          >
            <Input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("hero.searchPlaceholder")}
              className="h-12 flex-1 text-base"
              aria-label={tc("actions.search")}
            />
            <Button type="submit" size="lg">
              {t("hero.primaryCta")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="link" className="px-0 text-sm">
              <Link to={buildPath("/recommend")}>
                {t("hero.secondaryCta")}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Divider />

      {/* Scenario tiles */}
      <section className="container-page py-20">
        <SectionHeading title={t("scenarios.title")} description={t("scenarios.subtitle")} />
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {SCENARIO_TILES.map((tile) => (
            <Link
              key={tile.key}
              to={`${buildPath("/agents")}?scenario=${tile.scenarioId}`}
              className={cn(
                "group flex h-28 flex-col justify-between rounded-lg border border-border bg-card p-4 transition-colors",
                "hover:border-foreground/40"
              )}
            >
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {String(SCENARIO_TILES.indexOf(tile) + 1).padStart(2, "0")}
              </span>
              <div className="flex items-end justify-between">
                <span className="text-base font-medium text-foreground">
                  {t(`scenarios.items.${tile.key}`)}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Divider />

      {/* Curated showcase */}
      <section className="container-page py-20">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <SectionHeading title={t("curated.title")} description={t("curated.subtitle")} />
          <Button asChild variant="ghost" size="sm" className="md:self-end">
            <Link to={buildPath("/agents")}>
              {t("curated.viewAll")}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        </div>
        <div className="mt-10">
          <AgentList entries={curatedShowcase} />
        </div>
      </section>

      <Divider />

      {/* Native showcase */}
      <section className="container-page py-20">
        <SectionHeading title={t("native.title")} description={t("native.subtitle")} />
        <div className="mt-10">
          {nativeStatus === "loading" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <Skeleton key={idx} className="h-44" />
              ))}
            </div>
          ) : nativeShowcase.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-start gap-3 px-6 py-10">
                <p className="text-sm text-muted-foreground">{t("native.empty")}</p>
                {nativeError ? (
                  <p className="text-xs text-muted-foreground/80">{nativeError}</p>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <AgentList entries={nativeShowcase} />
          )}
        </div>
      </section>

      <Divider />

      {/* Why */}
      <section className="container-page py-20">
        <SectionHeading title={t("why.title")} description={t("why.subtitle")} />
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {(["facts", "evidence", "next"] as const).map((key) => (
            <Card key={key}>
              <CardContent className="flex flex-col gap-3 px-6 py-8">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                  {WHY_ICONS[key]}
                </span>
                <h3 className="text-lg font-medium tracking-tight">{t(`why.items.${key}.title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`why.items.${key}.body`)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Divider />

      {/* Trust footer block */}
      <section className="container-page py-20">
        <Card>
          <CardContent className="flex flex-col gap-4 px-6 py-10 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-foreground/5 text-foreground">
                <Lightbulb className="h-5 w-5" aria-hidden />
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-medium tracking-tight">{t("trust.title")}</h3>
                <p className="text-sm text-muted-foreground">{t("trust.subtitle")}</p>
              </div>
            </div>
            <Button variant="secondary" asChild>
              <Link to={`${buildPath("/agents")}?source=native`}>
                {tc("agentSource.native")}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Divider(): JSX.Element {
  return <div className="container-page" aria-hidden><div className="h-px w-full bg-border" /></div>;
}

interface SectionHeadingProps {
  title: string;
  description?: string;
}

function SectionHeading({ title, description }: SectionHeadingProps): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-display text-2xl sm:text-4xl">{title}</h2>
      {description ? <p className="max-w-2xl text-base text-muted-foreground">{description}</p> : null}
    </div>
  );
}
