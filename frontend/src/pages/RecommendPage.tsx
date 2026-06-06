import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, Search, Sparkles, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AppConfig } from "@/config/appConfig";
import { SCENARIO_IDS, SCENARIO_MAP } from "@/data/catalog/scenarios";
import type { AccessType } from "@/domain/catalog";
import { pickText, type I18nText } from "@/domain/i18nText";
import {
  recommendAgents,
  type RecommendationInput,
  type RecommendationCandidate,
  type RecommendationPriority,
  type RecommendationRequest,
  type RecommendationUsageContext
} from "@/domain/recommendation";
import { useCatalog } from "@/hooks/useCatalog";
import type { SupportedLocale } from "@/i18n/config";
import { useLocale } from "@/i18n/useLocale";
import {
  requestRecommendations,
  type RecommendationApiResult,
  type RecommendationSource
} from "@/lib/recommendationClient";
import {
  createMockGoogleUser,
  requestPaidLlmRecommendation,
  type PlatformCreditAccount,
  type PlatformUser
} from "@/lib/platformClient";

const ACCESS_OPTIONS: Array<AccessType | "any"> = ["any", "saas", "api", "cli", "browser_ext", "local", "cloud"];
const PRIORITIES: RecommendationPriority[] = ["ease", "safety", "capability", "price"];
const USAGE_CONTEXTS: RecommendationUsageContext[] = ["solo", "team"];
const DEMO_GOOGLE_SUBJECT = "agentlens-local-demo-user";
const DEMO_GOOGLE_EMAIL = "demo@agentlens.local";

type RecommendationMode = "free" | "paid";

interface VisibleRecommendationCandidate extends RecommendationCandidate {
  reasonTexts?: I18nText[];
  tradeoffTexts?: I18nText[];
  fitScore?: number;
  trustScore?: number;
  riskScore?: number;
  confidence?: RecommendationApiResult["confidence"];
  recommendationType?: RecommendationApiResult["recommendationType"];
}

interface RecommendationRunMeta {
  mode: RecommendationMode;
  engine?: string;
  charged?: boolean;
  fallbackUsed?: boolean;
  fallbackReason?: string;
  costCredits?: number;
  balanceAfter?: number;
}

export function RecommendPage({ config }: { config: AppConfig }): JSX.Element {
  const { t } = useTranslation("recommend");
  const { t: tc } = useTranslation("common");
  const { buildPath, locale } = useLocale();
  const { entries } = useCatalog({ config });
  const [mode, setMode] = useState<RecommendationMode>("free");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recommendationState, setRecommendationState] = useState<{
    source: RecommendationSource;
    candidates: VisibleRecommendationCandidate[];
    error?: string;
  } | null>(null);
  const [runMeta, setRunMeta] = useState<RecommendationRunMeta | null>(null);
  const [platformUser, setPlatformUser] = useState<PlatformUser | null>(null);
  const [creditAccount, setCreditAccount] = useState<PlatformCreditAccount | null>(null);
  const [platformStatus, setPlatformStatus] = useState<"idle" | "connecting" | "ready" | "error">("idle");
  const [platformError, setPlatformError] = useState<string | null>(null);
  const [input, setInput] = useState<RecommendationInput>({
    task: "",
    scenarioId: "developer-assistant",
    usageContext: "solo",
    preferredAccessType: "any",
    priority: "ease",
    acceptsNative: false
  });

  const localResults = useMemo(() => recommendAgents(entries, input), [entries, input]);
  const catalogById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const localById = useMemo(() => new Map(localResults.map((candidate) => [candidate.entry.id, candidate])), [localResults]);
  const visibleResults = submitted ? recommendationState?.candidates ?? [] : [];
  const visiblePlatformError = platformError ?? (!config.platformApiUrl ? t("errors.platformApiMissing") : null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitted(true);
    setIsSubmitting(true);
    setRunMeta(null);

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
          ...buildPlatformRecommendationRequest(input)
        });
        setCreditAccount(response.creditAccount);
        const candidates = mapApiResultsToCandidates(response.recommendation.results, catalogById, localById);
        setRecommendationState({
          source: response.fallbackUsed ? "api-fallback" : "api",
          candidates: candidates.length > 0 ? candidates : localResults,
          ...(response.fallbackReason ? { error: response.fallbackReason } : {})
        });
        setRunMeta({
          mode,
          engine: response.engine,
          charged: response.charged,
          fallbackUsed: response.fallbackUsed,
          fallbackReason: response.fallbackReason,
          costCredits: response.costCredits,
          balanceAfter: response.creditAccount.balance
        });
      } else if (config.recommendationApiUrl) {
        const response = await requestRecommendations(config.recommendationApiUrl, buildPlatformRecommendationRequest(input));
        const candidates = mapApiResultsToCandidates(response.results, catalogById, localById);
        setRecommendationState({
          source: "api",
          candidates: candidates.length > 0 ? candidates : localResults,
          ...(candidates.length === 0 ? { error: t("results.emptyHint") } : {})
        });
        setRunMeta({ mode });
      } else {
        setRecommendationState({ source: "local", candidates: localResults });
        setRunMeta({ mode });
      }
    } catch (error) {
      setRecommendationState({
        source: "api-fallback",
        candidates: mode === "free" ? localResults : [],
        error: error instanceof Error ? error.message : t("errors.generic")
      });
      setRunMeta({
        mode,
        fallbackUsed: true
      });
    } finally {
      setIsSubmitting(false);
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
    } catch (error) {
      setPlatformError(error instanceof Error ? error.message : t("errors.generic"));
      setPlatformStatus("error");
    }
  }

  return (
    <section className="container-page py-12">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-display text-3xl sm:text-5xl">{t("page.title")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{t("page.subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("form.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-5"
              onSubmit={(event) => void handleSubmit(event)}
            >
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

              <div className="flex flex-col gap-2">
                <Label htmlFor="recommend-task">{t("form.task")}</Label>
                <textarea
                  id="recommend-task"
                  value={input.task}
                  onChange={(event) => setInput((current) => ({ ...current, task: event.target.value }))}
                  rows={5}
                  className="glass-input min-h-32 rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={t("form.taskPlaceholder")}
                />
              </div>

              <Field label={t("form.scenario")}>
                <Select
                  value={input.scenarioId ?? "none"}
                  onValueChange={(value) => setInput((current) => ({ ...current, scenarioId: value === "none" ? undefined : value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("form.noScenario")}</SelectItem>
                    {SCENARIO_IDS.map((id) => (
                      <SelectItem key={id} value={id}>
                        {pickText(SCENARIO_MAP[id], locale)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label={t("form.usageContext")}>
                <Select
                  value={input.usageContext}
                  onValueChange={(value) => setInput((current) => ({ ...current, usageContext: value as RecommendationUsageContext }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {USAGE_CONTEXTS.map((value) => (
                      <SelectItem key={value} value={value}>{t(`form.usage.${value}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label={t("form.access")}>
                <Select
                  value={input.preferredAccessType ?? "any"}
                  onValueChange={(value) => setInput((current) => ({ ...current, preferredAccessType: value as AccessType | "any" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_OPTIONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value === "any" ? t("form.anyAccess") : tc(`access.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label={t("form.priority")}>
                <Select
                  value={input.priority}
                  onValueChange={(value) => setInput((current) => ({ ...current, priority: value as RecommendationPriority }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((value) => (
                      <SelectItem key={value} value={value}>{t(`form.priorities.${value}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Checkbox
                checked={input.acceptsNative}
                onChange={(event) => setInput((current) => ({ ...current, acceptsNative: event.target.checked }))}
                label={t("form.acceptsNative")}
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

              <Button type="submit" disabled={isSubmitting || (mode === "paid" && !platformUser)} className="self-start">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {isSubmitting
                  ? t("form.submitting")
                  : mode === "paid"
                    ? t("form.submitPaid")
                    : t("form.submitFree")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {submitted && recommendationState ? (
            <Card
              className={
                recommendationState.source === "api"
                  ? "border-success/40 bg-success/10"
                  : recommendationState.source === "api-fallback"
                    ? "border-warning/40 bg-warning/10"
                    : undefined
              }
            >
              <CardContent className="px-6 py-4 text-sm text-foreground">
                {t(`results.sources.${recommendationState.source}`)}
                {recommendationState.error ? (
                  <span className="ml-2 text-muted-foreground">{recommendationState.error}</span>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
          {submitted && runMeta ? (
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
          {submitted && runMeta?.fallbackReason ? (
            <p className="rounded-md border border-amber-300/40 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              {runMeta.fallbackReason}
            </p>
          ) : null}
          {!submitted ? (
            <Card>
              <CardContent className="px-6 py-10 text-sm text-muted-foreground">
                {t("results.initial")}
              </CardContent>
            </Card>
          ) : visibleResults.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col gap-3 px-6 py-10">
                <p className="font-medium text-foreground">{t("results.empty")}</p>
                <p className="text-sm text-muted-foreground">{t("results.emptyHint")}</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {visibleResults.length < 3 ? (
                <Card className="border-warning/40 bg-warning/10">
                  <CardContent className="px-6 py-4 text-sm text-foreground">
                    {t("results.tooFew", { count: visibleResults.length })}
                  </CardContent>
                </Card>
              ) : null}
              {visibleResults.map((candidate, index) => (
                <Card key={candidate.entry.id}>
                  <CardContent className="flex flex-col gap-4 px-6 py-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">#{index + 1}</Badge>
                          <Badge variant="outline">{t("results.score", { score: candidate.score })}</Badge>
                        </div>
                        <h2 className="text-xl font-medium tracking-tight">{candidate.entry.name}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{pickText(candidate.entry.intro, locale)}</p>
                      </div>
                      <Button asChild size="sm" variant="secondary">
                        <Link to={buildPath(`/agent/${candidate.entry.id}`)}>
                          {tc("actions.viewDetails")}
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      </Button>
                    </div>

                    {hasSelectionMetadata(candidate) ? (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {typeof candidate.fitScore === "number" ? (
                          <Badge variant="outline">{t("results.selection.fit")}: {Math.round(candidate.fitScore)}</Badge>
                        ) : null}
                        {typeof candidate.trustScore === "number" ? (
                          <Badge variant="outline">{t("results.selection.trust")}: {Math.round(candidate.trustScore)}</Badge>
                        ) : null}
                        {typeof candidate.riskScore === "number" ? (
                          <Badge variant="outline">{t("results.selection.risk")}: {Math.round(candidate.riskScore)}</Badge>
                        ) : null}
                        {candidate.confidence ? (
                          <Badge variant="secondary">
                            {t("results.selection.confidence", { value: t(`results.confidence.${candidate.confidence}`) })}
                          </Badge>
                        ) : null}
                        {candidate.recommendationType ? (
                          <Badge variant="secondary">{t(`results.recommendationType.${candidate.recommendationType}`)}</Badge>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="grid gap-3 md:grid-cols-3">
                      <RecommendationBlock label={t("results.why")} value={formatWhy(candidate, (key) => t(key), locale)} />
                      <RecommendationBlock label={t("results.risk")} value={formatRisk(candidate, locale)} />
                      <RecommendationBlock label={t("results.nextStep")} value={pickText(candidate.nextStep, locale)} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function buildPlatformRecommendationRequest(input: RecommendationInput): RecommendationRequest {
  const priorities = mapPriority(input.priority);
  return {
    query: [
      input.task,
      `usage=${input.usageContext}`,
      `priority=${input.priority}`,
      `acceptsNative=${input.acceptsNative ? "yes" : "no"}`
    ].filter(Boolean).join("\n"),
    ...(input.scenarioId ? { scenarioIds: [input.scenarioId] } : {}),
    ...(input.preferredAccessType && input.preferredAccessType !== "any" ? { accessTypes: [input.preferredAccessType] } : {}),
    ...(input.priority === "safety" ? { maxRiskLevel: "low" as const } : {}),
    ...(input.priority === "ease" ? { complexity: "low" as const } : {}),
    ...(priorities.length > 0 ? { priorities } : {}),
    limit: 5
  };
}

function mapPriority(priority: RecommendationPriority): NonNullable<RecommendationRequest["priorities"]> {
  switch (priority) {
    case "safety":
      return ["low-risk", "audited"];
    case "ease":
      return ["fast-start"];
    case "capability":
      return ["api-first", "audited"];
    case "price":
      return [];
  }
}

function mapApiResultsToCandidates(
  results: RecommendationApiResult[],
  catalogById: Map<string, VisibleRecommendationCandidate["entry"]>,
  localById: Map<string, RecommendationCandidate>
): VisibleRecommendationCandidate[] {
  return results
    .map((result): VisibleRecommendationCandidate | null => {
      const entry = catalogById.get(result.agentId);
      if (!entry) return null;
      const local = localById.get(result.agentId);
      const candidate: VisibleRecommendationCandidate = {
        entry,
        score: result.score,
        reasonCodes: local?.reasonCodes ?? [],
        riskWarnings: local?.riskWarnings ?? [],
        nextStep: result.reasons[0] ?? local?.nextStep ?? {
          zh: "查看详情页，再决定是否继续。",
          en: "Open the detail page before continuing."
        }
      };
      if (result.reasons.length > 0) candidate.reasonTexts = result.reasons;
      if (result.tradeoffs?.length) candidate.tradeoffTexts = result.tradeoffs;
      if (typeof result.fitScore === "number") candidate.fitScore = result.fitScore;
      if (typeof result.trustScore === "number") candidate.trustScore = result.trustScore;
      if (typeof result.riskScore === "number") candidate.riskScore = result.riskScore;
      if (result.confidence) candidate.confidence = result.confidence;
      if (result.recommendationType) candidate.recommendationType = result.recommendationType;
      return candidate;
    })
    .filter((candidate): candidate is VisibleRecommendationCandidate => candidate !== null);
}

function formatWhy(
  candidate: VisibleRecommendationCandidate,
  translate: (key: string) => string,
  locale: SupportedLocale
): string {
  const reasonText = formatTextList(candidate.reasonTexts, locale);
  if (reasonText) return reasonText;
  const reasonCodes = candidate.reasonCodes.map((code) => translate(`reasonCodes.${code}`)).join(" / ");
  return reasonCodes || "-";
}

function formatRisk(candidate: VisibleRecommendationCandidate, locale: SupportedLocale): string {
  const tradeoffs = formatTextList(candidate.tradeoffTexts, locale);
  if (tradeoffs) return tradeoffs;
  const risks = formatTextList(candidate.riskWarnings, locale);
  return risks || "-";
}

function formatTextList(items: I18nText[] | undefined, locale: SupportedLocale): string {
  return items?.map((item) => pickText(item, locale)).filter(Boolean).join(" ") ?? "";
}

function hasSelectionMetadata(candidate: VisibleRecommendationCandidate): boolean {
  return Boolean(
    typeof candidate.fitScore === "number" ||
      typeof candidate.trustScore === "number" ||
      typeof candidate.riskScore === "number" ||
      candidate.confidence ||
      candidate.recommendationType
  );
}

function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function RecommendationBlock({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
