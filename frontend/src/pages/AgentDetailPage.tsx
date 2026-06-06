import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { AgentDetailHeader } from "@/components/agent/AgentDetailHeader";
import { DecisionSummaryCard } from "@/components/decision/DecisionSummaryCard";
import { OfficialResourcesCard } from "@/components/decision/OfficialResourcesCard";
import { RiskExplainCard } from "@/components/decision/RiskExplainCard";
import { ScenarioFitCard } from "@/components/decision/ScenarioFitCard";
import { OnboardingGuideCard } from "@/components/onboarding/OnboardingGuideCard";
import { NativeChainPanel } from "@/components/native/NativeChainPanel";
import { PricingCard } from "@/components/native/PricingCard";
import { RentalEntryCard } from "@/components/rental/RentalEntryCard";
import { TrustEvidenceCard } from "@/components/trust/TrustEvidenceCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocale } from "@/i18n/useLocale";
import type { AppConfig } from "@/config/appConfig";
import { useCatalog } from "@/hooks/useCatalog";
import type { AgentCatalogEntry } from "@/domain/catalog";
import { isNativeEntry } from "@/domain/catalog";
import { pickText } from "@/domain/i18nText";

interface AgentDetailPageProps {
  config: AppConfig;
}

export function AgentDetailPage({ config }: AgentDetailPageProps): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { locale, buildPath } = useLocale();
  const { t } = useTranslation("detail");
  const { byId, nativeStatus } = useCatalog({ config });

  const entry = id ? byId.get(id) : undefined;

  if (!entry) {
    if (nativeStatus === "loading") {
      return (
        <section className="container-page py-24">
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              …
            </CardContent>
          </Card>
        </section>
      );
    }
    return (
      <section className="container-page py-24">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-base font-medium text-foreground">{t("errors.notFound")}</p>
            <Button asChild>
              <Link to={buildPath("/agents")}>{t("errors.tryHome")}</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <AgentDetailHeader entry={entry} />
      <div className="container-page flex flex-col gap-6 py-10">
        <p className="max-w-3xl text-base text-muted-foreground">{pickText(entry.intro, locale)}</p>

        <DecisionSummaryCard entry={entry} />

        <ScenarioFitCard entry={entry} />

        <RiskExplainCard entry={entry} />

        <OnboardingGuideCard entry={entry} />

        <TrustEvidenceCard entry={entry} />

        <RentalEntryCard
          entry={entry}
          marketplaceConfigured={Boolean(config.marketplaceAddress)}
          platformApiUrl={config.platformApiUrl}
          web2RentalUrl={config.rentalWeb2Url}
        />

        {isNativeEntry(entry) ? <NativeBlock entry={entry} config={config} /> : <CuratedBlock entry={entry} />}
      </div>
    </section>
  );
}

function NativeBlock({ entry, config }: { entry: AgentCatalogEntry; config: AppConfig }): JSX.Element {
  const tokenId = entry.tokenId ?? entry.id;

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <PricingCard entry={entry} />
        <OfficialResourcesCard entry={entry} />
      </div>
      <NativeChainPanel config={config} tokenId={tokenId} />
    </>
  );
}

function CuratedBlock({ entry }: { entry: AgentCatalogEntry }): JSX.Element {
  return <OfficialResourcesCard entry={entry} />;
}
