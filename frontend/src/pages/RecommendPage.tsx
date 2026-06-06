import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AppConfig } from "@/config/appConfig";
import { SCENARIO_IDS, SCENARIO_MAP } from "@/data/catalog/scenarios";
import type { AccessType } from "@/domain/catalog";
import { pickText } from "@/domain/i18nText";
import {
  recommendAgents,
  type RecommendationInput,
  type RecommendationCandidate,
  type RecommendationPriority,
  type RecommendationUsageContext
} from "@/domain/recommendation";
import { useCatalog } from "@/hooks/useCatalog";
import { useLocale } from "@/i18n/useLocale";
import { getRecommendations, type RecommendationSource } from "@/lib/recommendationClient";

const ACCESS_OPTIONS: Array<AccessType | "any"> = ["any", "saas", "api", "cli", "browser_ext", "local", "cloud"];
const PRIORITIES: RecommendationPriority[] = ["ease", "safety", "capability", "price"];
const USAGE_CONTEXTS: RecommendationUsageContext[] = ["solo", "team"];

export function RecommendPage({ config }: { config: AppConfig }): JSX.Element {
  const { t } = useTranslation("recommend");
  const { t: tc } = useTranslation("common");
  const { buildPath, locale } = useLocale();
  const { entries } = useCatalog({ config });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recommendationState, setRecommendationState] = useState<{
    source: RecommendationSource;
    candidates: RecommendationCandidate[];
    error?: string;
  } | null>(null);
  const [input, setInput] = useState<RecommendationInput>({
    task: "",
    scenarioId: "developer-assistant",
    usageContext: "solo",
    preferredAccessType: "any",
    priority: "ease",
    acceptsNative: false
  });

  const localResults = useMemo(() => recommendAgents(entries, input), [entries, input]);
  const visibleResults = submitted ? recommendationState?.candidates ?? [] : [];

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitted(true);
    setIsSubmitting(true);
    const result = await getRecommendations({
      input,
      catalog: entries,
      fallback: () => localResults
    });
    setRecommendationState(result);
    setIsSubmitting(false);
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

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("form.submitting") : t("form.submit")}
                <Sparkles className="h-4 w-4" aria-hidden />
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

                    <div className="grid gap-3 md:grid-cols-3">
                      <RecommendationBlock label={t("results.why")} value={candidate.reasonCodes.map((code) => t(`reasonCodes.${code}`)).join(" / ")} />
                      <RecommendationBlock label={t("results.risk")} value={candidate.riskWarnings.map((risk) => pickText(risk, locale)).join(" ")} />
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
