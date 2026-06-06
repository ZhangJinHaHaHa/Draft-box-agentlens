import { ArrowRight, Loader2, Search, Sparkles, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeading } from "@/components/layout/PageHeading";
import type { AppConfig } from "@/config/appConfig";
import type { AgentCatalogEntry } from "@/domain/catalog";
import { pickText } from "@/domain/i18nText";
import { useCatalog } from "@/hooks/useCatalog";
import { useLocale } from "@/i18n/useLocale";
import {
  buildLocalRecommendationResponse,
  requestRecommendations,
  type RecommendationApiResult
} from "@/lib/recommendationClient";
import {
  createMockGoogleUser,
  requestPaidLlmRecommendation,
  type PlatformCreditAccount,
  type PlatformUser
} from "@/lib/platformClient";

interface RecommendPageProps {
  config: AppConfig;
}

type RecommendationMode = "free" | "paid";

interface RecommendationRunMeta {
  mode: RecommendationMode;
  engine?: string;
  charged?: boolean;
  fallbackUsed?: boolean;
  fallbackReason?: string;
  costCredits?: number;
  balanceAfter?: number;
}

const DEMO_GOOGLE_SUBJECT = "agentlens-local-demo-user";
const DEMO_GOOGLE_EMAIL = "demo@agentlens.local";

export function RecommendPage({ config }: RecommendPageProps): JSX.Element {
  const { t } = useTranslation("recommend");
  const { locale, buildPath } = useLocale();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<RecommendationApiResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<RecommendationMode>("free");
  const [platformUser, setPlatformUser] = useState<PlatformUser | null>(null);
  const [creditAccount, setCreditAccount] = useState<PlatformCreditAccount | null>(null);
  const [platformStatus, setPlatformStatus] = useState<"idle" | "connecting" | "ready" | "error">("idle");
  const [platformError, setPlatformError] = useState<string | null>(null);
  const [runMeta, setRunMeta] = useState<RecommendationRunMeta | null>(null);
  const { entries, byId } = useCatalog({ config, skipNative: true });
  const visiblePlatformError = platformError ?? (!config.platformApiUrl ? t("errors.platformApiMissing") : null);

  const visibleResults = useMemo(
    () => {
      const mapped: Array<{ result: RecommendationApiResult; entry: AgentCatalogEntry }> = [];
      for (const result of results) {
        const entry = byId.get(result.agentId);
        if (entry) {
          mapped.push({ result, entry });
        }
      }
      return mapped;
    },
    [byId, results]
  );

  async function submit(): Promise<void> {
    if (!query.trim()) {
      setResults([]);
      setStatus("idle");
      setRunMeta(null);
      return;
    }

    setStatus("loading");
    setError(null);
    try {
      if (mode === "paid") {
        if (!config.platformApiUrl) {
          throw new Error(t("errors.platformApiMissing"));
        }
        if (!platformUser) {
          throw new Error(t("errors.connectFirst"));
        }
        const response = await requestPaidLlmRecommendation(config.platformApiUrl, {
          userId: platformUser.platformUserId,
          query,
          limit: 5
        });
        setCreditAccount(response.creditAccount);
        setResults(response.recommendation.results);
        setRunMeta({
          mode,
          engine: response.engine,
          charged: response.charged,
          fallbackUsed: response.fallbackUsed,
          fallbackReason: response.fallbackReason,
          costCredits: response.costCredits,
          balanceAfter: response.creditAccount.balance
        });
      } else {
        const response = config.recommendationApiUrl
          ? await requestRecommendations(config.recommendationApiUrl, { query, limit: 5 })
          : buildLocalRecommendationResponse(entries, { query, limit: 5 });
        setResults(response.results);
        setRunMeta({ mode });
      }
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
      setResults([]);
      setRunMeta(null);
      setStatus("error");
    }
  }

  async function connectMockGoogle(): Promise<void> {
    if (!config.platformApiUrl) {
      setPlatformError(t("errors.platformApiMissing"));
      setPlatformStatus("error");
      return;
    }

    setPlatformStatus("connecting");
    setPlatformError(null);
    try {
      const response = await createMockGoogleUser(config.platformApiUrl, {
        googleSubject: DEMO_GOOGLE_SUBJECT,
        email: DEMO_GOOGLE_EMAIL
      });
      setPlatformUser(response.user);
      setCreditAccount(response.creditAccount);
      setPlatformStatus("ready");
    } catch (err) {
      setPlatformError(err instanceof Error ? err.message : t("errors.generic"));
      setPlatformStatus("error");
    }
  }

  return (
    <section className="container-page py-12">
      <PageHeading title={t("page.title")} description={t("page.subtitle")} />

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardContent className="flex flex-col gap-4 px-6 py-6">
            <label className="text-sm font-medium" htmlFor="recommend-query">
              {t("form.label")}
            </label>
            <Tabs value={mode} onValueChange={(value) => setMode(value as RecommendationMode)}>
              <TabsList className="h-auto flex-wrap gap-2 border-b-0">
                <TabsTrigger value="free" className="gap-2 rounded-md border border-border px-3 data-[state=active]:border-foreground data-[state=active]:after:hidden">
                  <Search className="h-4 w-4" aria-hidden />
                  {t("form.modes.free")}
                </TabsTrigger>
                <TabsTrigger value="paid" className="gap-2 rounded-md border border-border px-3 data-[state=active]:border-foreground data-[state=active]:after:hidden">
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {t("form.modes.paid")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <textarea
              id="recommend-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("form.placeholder")}
              className="min-h-36 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            {mode === "paid" ? (
              <div className="rounded-md border border-border bg-muted/30 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
                      <span className="text-sm font-medium">{t("platform.title")}</span>
                      <Badge variant="secondary">{t("platform.cost", { count: 3 })}</Badge>
                    </div>
                    <p className="break-all text-xs text-muted-foreground">
                      {platformUser
                        ? t("platform.connected", { email: platformUser.identity.email })
                        : t("platform.disconnected")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void connectMockGoogle()}
                    disabled={platformStatus === "connecting" || !config.platformApiUrl}
                  >
                    {platformStatus === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    {platformUser ? t("platform.refresh") : t("platform.connect")}
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge variant={creditAccount ? "success" : "muted"}>
                    {t("platform.balance", { count: creditAccount?.balance ?? 0 })}
                  </Badge>
                  {platformUser ? <Badge variant="outline">{platformUser.walletAddress}</Badge> : null}
                </div>
                {visiblePlatformError ? <p className="mt-3 text-sm text-destructive">{visiblePlatformError}</p> : null}
              </div>
            ) : null}
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={status === "loading" || (mode === "paid" && !platformUser)}
              className="self-start"
            >
              {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {mode === "paid" ? t("form.submitPaid") : t("form.submitFree")}
            </Button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {status === "idle" ? (
            <Card>
              <CardContent className="px-6 py-10 text-sm text-muted-foreground">
                {t("results.idle")}
              </CardContent>
            </Card>
          ) : null}

          {status === "done" && visibleResults.length === 0 ? (
            <Card>
              <CardContent className="px-6 py-10 text-sm text-muted-foreground">
                {t("results.empty")}
              </CardContent>
            </Card>
          ) : null}

          {status === "done" && runMeta ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant={runMeta.mode === "paid" ? "success" : "secondary"}>
                {runMeta.mode === "paid" ? t("results.meta.paid") : t("results.meta.free")}
              </Badge>
              {runMeta.engine ? <Badge variant="outline">{runMeta.engine}</Badge> : null}
              {runMeta.charged ? <Badge variant="outline">{t("results.meta.charged", { count: runMeta.costCredits ?? 0 })}</Badge> : null}
              {typeof runMeta.balanceAfter === "number" ? (
                <Badge variant="outline">{t("results.meta.balanceAfter", { count: runMeta.balanceAfter })}</Badge>
              ) : null}
              {runMeta.fallbackUsed ? <Badge variant="warning">{t("results.meta.fallback")}</Badge> : null}
            </div>
          ) : null}
          {status === "done" && runMeta?.fallbackReason ? (
            <p className="rounded-md border border-amber-300/40 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              {runMeta.fallbackReason}
            </p>
          ) : null}

          {visibleResults.map(({ entry, result }, index) => (
            <Card key={entry.id}>
              <CardContent className="flex flex-col gap-4 px-6 py-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      #{index + 1} · {Math.round(result.score)}
                    </span>
                    <h2 className="text-xl font-medium tracking-tight">{entry.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {[entry.vendor, entry.category].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={buildPath(`/agent/${entry.id}`)}>
                      {t("results.open")}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{pickText(entry.intro, locale)}</p>
                {hasSelectionMetadata(result) ? (
                  <div className="grid gap-3 rounded-md border border-border bg-muted/25 px-3 py-3 text-xs sm:grid-cols-3">
                    {typeof result.fitScore === "number" ? (
                      <MetricPill label={t("results.selection.fit")} value={result.fitScore} />
                    ) : null}
                    {typeof result.trustScore === "number" ? (
                      <MetricPill label={t("results.selection.trust")} value={result.trustScore} />
                    ) : null}
                    {typeof result.riskScore === "number" ? (
                      <MetricPill label={t("results.selection.risk")} value={result.riskScore} />
                    ) : null}
                    <div className="flex flex-wrap gap-2 sm:col-span-3">
                      {result.confidence ? (
                        <Badge variant="outline">
                          {t("results.selection.confidence", { value: t(`results.confidence.${result.confidence}`) })}
                        </Badge>
                      ) : null}
                      {result.recommendationType ? (
                        <Badge variant="secondary">{t(`results.recommendationType.${result.recommendationType}`)}</Badge>
                      ) : null}
                      {result.evidenceUsed?.slice(0, 4).map((item) => (
                        <Badge key={item} variant="success">{formatSignal(item)}</Badge>
                      ))}
                      {result.missingEvidence?.slice(0, 3).map((item) => (
                        <Badge key={item} variant="warning">{formatSignal(item)}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-col gap-2">
                  {result.reasons.map((reason, reasonIndex) => (
                    <p key={reasonIndex} className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                      {pickText(reason, locale)}
                    </p>
                  ))}
                  {result.tradeoffs?.map((tradeoff, tradeoffIndex) => (
                    <p key={`tradeoff-${tradeoffIndex}`} className="rounded-md border border-amber-300/40 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                      {pickText(tradeoff, locale)}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function MetricPill({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{Math.round(value)}</span>
    </div>
  );
}

function hasSelectionMetadata(result: RecommendationApiResult): boolean {
  return Boolean(
    typeof result.fitScore === "number" ||
      typeof result.trustScore === "number" ||
      typeof result.riskScore === "number" ||
      result.confidence ||
      result.recommendationType ||
      result.evidenceUsed?.length ||
      result.missingEvidence?.length
  );
}

function formatSignal(value: string): string {
  return value.replace(/[_:]/g, " ");
}
