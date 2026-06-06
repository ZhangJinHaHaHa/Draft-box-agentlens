import { CheckCircle2, CreditCard, ExternalLink, Loader2, Wallet } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentCatalogEntry } from "@/domain/catalog";
import { isNativeEntry } from "@/domain/catalog";
import { pickText } from "@/domain/i18nText";
import { DEFAULT_LOCALE, isSupportedLocale } from "@/i18n/config";
import {
  createMockGoogleUser,
  createPlatformOrder,
  submitMockPaymentCallback,
  type PlatformAccessBridge,
  type PlatformOrder,
  type PlatformUser
} from "@/lib/platformClient";

interface RentalEntryCardProps {
  entry: AgentCatalogEntry;
  platformApiUrl?: string;
  web2RentalUrl?: string;
  marketplaceConfigured: boolean;
}

const LOCAL_RENTAL_AMOUNT = "20.00";
const LOCAL_RENTAL_CURRENCY = "CREDITS";
const LOCAL_RENTAL_GOOGLE_SUBJECT = "agentlens-local-rental-user";
const LOCAL_RENTAL_EMAIL = "rental@agentlens.local";

export function RentalEntryCard({
  entry,
  platformApiUrl,
  web2RentalUrl,
  marketplaceConfigured
}: RentalEntryCardProps): JSX.Element {
  const { t, i18n } = useTranslation("detail");
  const [platformUser, setPlatformUser] = useState<PlatformUser | null>(null);
  const [order, setOrder] = useState<PlatformOrder | null>(null);
  const [bridge, setBridge] = useState<PlatformAccessBridge | null>(null);
  const [rentalStatus, setRentalStatus] = useState<"idle" | "renting" | "created" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
  const priceLabel = entry.nativePricing?.label
    ? pickText(entry.nativePricing.label, locale)
    : entry.pricingHint
      ? pickText(entry.pricingHint, locale)
      : null;
  const native = isNativeEntry(entry);
  const localRentalEnabled = Boolean(platformApiUrl);
  const web2Description = localRentalEnabled
    ? t("rental.web2.configured")
    : web2RentalUrl
      ? t("rental.web2.externalConfigured")
      : t("rental.web2.disabledReason");

  async function handleCreateLocalRental(): Promise<void> {
    if (!platformApiUrl) {
      return;
    }
    setRentalStatus("renting");
    setErrorMessage(null);

    try {
      const login = await createMockGoogleUser(platformApiUrl, {
        googleSubject: LOCAL_RENTAL_GOOGLE_SUBJECT,
        email: LOCAL_RENTAL_EMAIL
      });
      const createdOrder = await createPlatformOrder(platformApiUrl, {
        userId: login.user.platformUserId,
        agentId: entry.id,
        amount: LOCAL_RENTAL_AMOUNT,
        currency: LOCAL_RENTAL_CURRENCY
      });
      const payment = await submitMockPaymentCallback(platformApiUrl, {
        orderId: createdOrder.orderId,
        paymentProvider: "local-mock",
        providerPaymentId: `local-payment-${entry.id}-${Date.now()}`,
        idempotencyKey: `local-rental:${entry.id}:${login.user.platformUserId}:${Date.now()}`,
        paidAmount: LOCAL_RENTAL_AMOUNT
      });

      setPlatformUser(login.user);
      setOrder(payment.order);
      setBridge(payment.bridge);
      setRentalStatus("created");
    } catch (error) {
      setRentalStatus("error");
      setErrorMessage(error instanceof Error ? error.message : t("rental.web2.unknownError"));
    }
  }

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
          <p className="text-sm text-muted-foreground">{web2Description}</p>
          {localRentalEnabled ? (
            <Button
              className="self-start"
              disabled={rentalStatus === "renting"}
              onClick={() => void handleCreateLocalRental()}
              size="sm"
              type="button"
            >
              {rentalStatus === "renting" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : null}
              {rentalStatus === "renting" ? t("rental.web2.creating") : t("rental.web2.action")}
            </Button>
          ) : web2RentalUrl ? (
            <Button asChild className="self-start" size="sm">
              <a href={web2RentalUrl} target="_blank" rel="noreferrer">
                {t("rental.web2.externalAction")}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </Button>
          ) : (
            <Button className="self-start" disabled size="sm" type="button">
              {t("rental.web2.action")}
            </Button>
          )}
          {rentalStatus === "created" && order && bridge ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                {t("rental.web2.success")}
              </div>
              <dl className="grid gap-1 text-muted-foreground">
                {platformUser ? <RentalMeta label={t("rental.web2.userLabel")} value={platformUser.identity.email} /> : null}
                <RentalMeta label={t("rental.web2.amountLabel")} value={`${order.paidAmount ?? order.amount ?? LOCAL_RENTAL_AMOUNT} ${order.currency ?? LOCAL_RENTAL_CURRENCY}`} />
                <RentalMeta label={t("rental.web2.orderLabel")} value={order.orderId} />
                <RentalMeta label={t("rental.web2.orderStatusLabel")} value={order.status} />
                {order.gatewayLeaseToken ? (
                  <RentalMeta label={t("rental.web2.gatewayLeaseLabel")} value={order.gatewayLeaseToken} />
                ) : null}
                {order.gatewayLeaseExpiresAt ? (
                  <RentalMeta label={t("rental.web2.gatewayLeaseExpiresLabel")} value={order.gatewayLeaseExpiresAt} />
                ) : null}
                <RentalMeta label={t("rental.web2.bridgeLabel")} value={bridge.bridgeId} />
                <RentalMeta label={t("rental.web2.bridgeStatusLabel")} value={bridge.status} />
              </dl>
              <Badge className="mt-3" variant="outline">
                {t("rental.web2.grantPending")}
              </Badge>
            </div>
          ) : null}
          {rentalStatus === "error" && errorMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {t("rental.web2.error", { message: errorMessage })}
            </p>
          ) : null}
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

function RentalMeta({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="grid gap-1 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
      <dt className="text-foreground">{label}</dt>
      <dd className="break-all">{value}</dd>
    </div>
  );
}
