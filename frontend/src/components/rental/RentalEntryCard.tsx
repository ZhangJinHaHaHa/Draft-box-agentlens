import { CreditCard, ExternalLink, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentCatalogEntry } from "@/domain/catalog";
import { isNativeEntry } from "@/domain/catalog";
import { pickText } from "@/domain/i18nText";
import { DEFAULT_LOCALE, isSupportedLocale } from "@/i18n/config";

interface RentalEntryCardProps {
  entry: AgentCatalogEntry;
  web2RentalUrl?: string;
  marketplaceConfigured: boolean;
}

export function RentalEntryCard({
  entry,
  web2RentalUrl,
  marketplaceConfigured
}: RentalEntryCardProps): JSX.Element {
  const { t, i18n } = useTranslation("detail");
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
  const priceLabel = entry.nativePricing?.label
    ? pickText(entry.nativePricing.label, locale)
    : entry.pricingHint
      ? pickText(entry.pricingHint, locale)
      : null;
  const native = isNativeEntry(entry);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("rental.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {native ? t("rental.subtitle.native") : t("rental.subtitle.curated")}
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="glass-input flex flex-col gap-3 rounded-md border p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden />
            {t("rental.web2.title")}
          </div>
          <p className="text-sm text-muted-foreground">
            {web2RentalUrl ? t("rental.web2.configured") : t("rental.web2.disabledReason")}
          </p>
          {web2RentalUrl ? (
            <Button asChild className="self-start" size="sm">
              <a href={web2RentalUrl} target="_blank" rel="noreferrer">
                {t("rental.web2.action")}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </Button>
          ) : (
            <Button className="self-start" disabled size="sm" type="button">
              {t("rental.web2.action")}
            </Button>
          )}
        </div>

        <div className="glass-input flex flex-col gap-3 rounded-md border p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
            {t("rental.web3.title")}
          </div>
          {priceLabel ? (
            <p className="text-sm text-foreground">{t("rental.web3.price", { price: priceLabel })}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {marketplaceConfigured
              ? t("rental.web3.marketplaceReadOnly")
              : t("rental.web3.disabledReason")}
          </p>
          <Button className="self-start" disabled size="sm" type="button">
            {t("rental.web3.action")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
