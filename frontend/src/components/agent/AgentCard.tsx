import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen, FileCheck2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/useLocale";
import { pickText } from "@/domain/i18nText";
import type { AgentCatalogEntry } from "@/domain/catalog";
import { hasAuditEvidence } from "@/domain/catalog";
import { computeTrustTier } from "@/domain/trustTier";
import { useCompareSelection } from "@/hooks/useCompareSelection";

import { TrustTierBadge } from "@/components/trust/TrustTierBadge";

import { AgentTypeChip } from "./AgentTypeChip";

interface AgentCardProps {
  entry: AgentCatalogEntry;
  className?: string;
}

export function AgentCard({ entry, className }: AgentCardProps): JSX.Element {
  const { locale, buildPath } = useLocale();
  const { t } = useTranslation("agents");
  const { t: tc } = useTranslation("common");
  const { ids, addId, removeId } = useCompareSelection();
  const tier = computeTrustTier({ entry });
  const auditEvidence = hasAuditEvidence(entry);
  const isCompared = ids.includes(entry.id);

  function handleCompare(): void {
    if (isCompared) {
      removeId(entry.id);
      return;
    }
    addId(entry.id);
  }

  return (
    <article
      className={cn(
        "group flex h-full flex-col gap-4 p-5 surface-card-interactive",
        className
      )}
    >
      <Link to={buildPath(`/agent/${entry.id}`)} className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AgentTypeChip source={entry.source} />
            {entry.hasOnboardingGuide ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <BookOpen className="h-3 w-3" aria-hidden />
                {t("card.onboarding")}
              </span>
            ) : null}
            {auditEvidence ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <FileCheck2 className="h-3 w-3" aria-hidden />
                audit
              </span>
            ) : null}
          </div>
          <TrustTierBadge result={tier} variant="compact" />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-xl font-medium tracking-tight text-foreground">{entry.name}</h3>
            <ArrowUpRight
              className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
              aria-hidden
            />
          </div>
          {(entry.vendor || entry.category) && (
            <p className="text-xs text-muted-foreground">
              {[entry.vendor, entry.category].filter(Boolean).join(" · ")}
            </p>
          )}
          <p className="line-clamp-2 text-sm text-muted-foreground">{pickText(entry.intro, locale)}</p>
        </div>

        {entry.scenarios.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {entry.scenarios.slice(0, 3).map((scenario) => (
              <span
                key={scenario.id}
                className="rounded-md border border-border/70 bg-card/55 px-2 py-0.5 text-[11px] font-medium text-muted-foreground backdrop-blur"
              >
                {pickText(scenario.label, locale)}
              </span>
            ))}
            {entry.scenarios.length > 3 ? (
              <span className="rounded-md border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                +{entry.scenarios.length - 3}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
          <Meta label={t("card.risk")} value={tc(`risk.${entry.riskLevel}`)} />
          <Meta label={t("card.complexity")} value={tc(`complexity.${entry.complexity}`)} />
          <Meta
            label={t("card.onboarding")}
            value={entry.hasOnboardingGuide ? t("card.hasOnboarding") : t("card.noOnboarding")}
          />
        </div>
      </Link>

      <Button
        type="button"
        size="sm"
        variant={isCompared ? "outline" : "secondary"}
        aria-pressed={isCompared}
        disabled={!isCompared && ids.length >= 4}
        onClick={handleCompare}
        className="relative z-10"
      >
        <Plus className={cn("h-3.5 w-3.5", isCompared && "rotate-45")} aria-hidden />
        {isCompared ? t("card.addedToCompare") : t("card.addToCompare")}
      </Button>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="uppercase tracking-wide">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
