import { CheckCircle2, CreditCard, ExternalLink, Loader2, MessageSquare, ReceiptText, RotateCcw, Wallet } from "lucide-react";
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
  createPlatformDeveloper,
  createPlatformRefund,
  createPlatformOrder,
  getAgentReputation,
  getPlatformSettlement,
  linkPlatformAgentDeveloper,
  resolvePlatformRefund,
  startPlatformRefundReview,
  submitUsageReview,
  submitMockPaymentCallback,
  type PlatformAccessBridge,
  type PlatformDeveloperProfile,
  type PlatformOrder,
  type PlatformRefundCase,
  type PlatformReputationSnapshot,
  type PlatformSettlement,
  type PlatformUsageReviewResponse,
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
const LOCAL_DEVELOPER_WALLET = "0x3333333333333333333333333333333333333333";

export function RentalEntryCard({
  entry,
  platformApiUrl,
  web2RentalUrl,
  marketplaceConfigured
}: RentalEntryCardProps): JSX.Element {
  const { t, i18n } = useTranslation("detail");
  const [platformUser, setPlatformUser] = useState<PlatformUser | null>(null);
  const [developer, setDeveloper] = useState<PlatformDeveloperProfile | null>(null);
  const [order, setOrder] = useState<PlatformOrder | null>(null);
  const [bridge, setBridge] = useState<PlatformAccessBridge | null>(null);
  const [settlement, setSettlement] = useState<PlatformSettlement | null>(null);
  const [reputation, setReputation] = useState<PlatformReputationSnapshot | null>(null);
  const [usageReview, setUsageReview] = useState<PlatformUsageReviewResponse | null>(null);
  const [refund, setRefund] = useState<PlatformRefundCase | null>(null);
  const [rentalStatus, setRentalStatus] = useState<"idle" | "renting" | "created" | "error">("idle");
  const [lifecycleStatus, setLifecycleStatus] = useState<"idle" | "reviewing" | "refunding" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
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
    setLifecycleStatus("idle");
    setErrorMessage(null);
    setLifecycleError(null);

    try {
      const login = await createMockGoogleUser(platformApiUrl, {
        googleSubject: LOCAL_RENTAL_GOOGLE_SUBJECT,
        email: LOCAL_RENTAL_EMAIL
      });
      const demoDeveloper = await createPlatformDeveloper(platformApiUrl, {
        displayName: `${entry.name} Demo Provider`,
        walletAddress: LOCAL_DEVELOPER_WALLET,
        supportContact: "demo@agentlens.local",
        trustStatus: "verified",
        trustScore: 82
      });
      await linkPlatformAgentDeveloper(platformApiUrl, demoDeveloper.developerId, entry.id);
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
      const [createdSettlement, createdReputation] = await Promise.all([
        getPlatformSettlement(platformApiUrl, payment.order.orderId),
        getAgentReputation(platformApiUrl, entry.id)
      ]);

      setPlatformUser(login.user);
      setDeveloper(demoDeveloper);
      setOrder(payment.order);
      setBridge(payment.bridge);
      setSettlement(createdSettlement);
      setReputation(createdReputation);
      setUsageReview(null);
      setRefund(null);
      setRentalStatus("created");
    } catch (error) {
      setRentalStatus("error");
      setErrorMessage(error instanceof Error ? error.message : t("rental.web2.unknownError"));
    }
  }

  async function handleSubmitUsageReview(): Promise<void> {
    if (!platformApiUrl || !order || !platformUser) {
      return;
    }
    setLifecycleStatus("reviewing");
    setLifecycleError(null);

    try {
      const review = await submitUsageReview(platformApiUrl, {
        orderId: order.orderId,
        userId: platformUser.platformUserId,
        overallRating: 5,
        dimensionRatings: {
          security: 2,
          taskExecution: 2,
          cognitive: 2,
          environment: 1,
          engineering: 2,
          compliance: 2
        },
        capabilityMatched: true,
        safetyIncidentReported: false,
        commentText: "Local MVP-3 demo review: Gateway lease delivered and capability matched."
      });
      setUsageReview(review);
      setReputation(review.reputation);
      setLifecycleStatus("idle");
    } catch (error) {
      setLifecycleStatus("error");
      setLifecycleError(error instanceof Error ? error.message : t("rental.lifecycle.unknownError"));
    }
  }

  async function handleRunRefundReview(): Promise<void> {
    if (!platformApiUrl || !order) {
      return;
    }
    setLifecycleStatus("refunding");
    setLifecycleError(null);

    try {
      const createdRefund = await createPlatformRefund(platformApiUrl, {
        orderId: order.orderId,
        category: "core_capability_failure",
        expectedCapability: "The rented agent should complete the promised workflow.",
        actualFailure: "Local MVP-3 demo evidence: operator marks a partial capability issue.",
        agentClaim: "Gateway lease was issued and the capability is available."
      });
      await startPlatformRefundReview(platformApiUrl, createdRefund.refundId, "ops-local-demo");
      const resolvedRefund = await resolvePlatformRefund(platformApiUrl, createdRefund.refundId, {
        outcome: "partial_refund",
        reviewNote: "Local demo operator approved a partial refund while preserving the rental record.",
        refundAmount: "6.00"
      });
      const [updatedSettlement, updatedReputation] = await Promise.all([
        getPlatformSettlement(platformApiUrl, order.orderId),
        getAgentReputation(platformApiUrl, entry.id)
      ]);
      setRefund(resolvedRefund);
      setSettlement(updatedSettlement);
      setReputation(updatedReputation);
      setLifecycleStatus("idle");
    } catch (error) {
      setLifecycleStatus("error");
      setLifecycleError(error instanceof Error ? error.message : t("rental.lifecycle.unknownError"));
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
          {rentalStatus === "created" && order ? (
            <div className="rounded-md border p-3 text-sm">
              <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <ReceiptText className="h-4 w-4 text-muted-foreground" aria-hidden />
                {t("rental.lifecycle.title")}
              </div>
              <dl className="grid gap-1 text-muted-foreground">
                {developer ? <RentalMeta label={t("rental.lifecycle.developerLabel")} value={developer.displayName} /> : null}
                {settlement ? (
                  <>
                    <RentalMeta label={t("rental.lifecycle.settlementLabel")} value={settlement.settlementId} />
                    <RentalMeta label={t("rental.lifecycle.settlementStatusLabel")} value={settlement.status} />
                    <RentalMeta
                      label={t("rental.lifecycle.settlementSplitLabel")}
                      value={t("rental.lifecycle.settlementSplitValue", {
                        platformFee: settlement.platformFeeAmount,
                        developerShare: settlement.developerShareAmount,
                        holdback: settlement.holdbackAmount,
                        currency: settlement.currency
                      })}
                    />
                  </>
                ) : null}
                {reputation ? (
                  <>
                    <RentalMeta label={t("rental.lifecycle.reputationLabel")} value={`${reputation.score} / ${reputation.tier}`} />
                    <RentalMeta
                      label={t("rental.lifecycle.reputationSignalsLabel")}
                      value={t("rental.lifecycle.reputationSignalsValue", {
                        paidOrders: reputation.signals.paidOrders,
                        pendingGrants: reputation.signals.pendingChainGrants,
                        reviews: reputation.signals.reviewCount ?? 0,
                        refunds: reputation.signals.refunds
                      })}
                    />
                  </>
                ) : null}
                {usageReview ? (
                  <RentalMeta
                    label={t("rental.lifecycle.reviewLabel")}
                    value={t("rental.lifecycle.reviewValue", {
                      reviewId: usageReview.review.reviewId,
                      rating: usageReview.summary.platformRating ?? usageReview.review.overallRating
                    })}
                  />
                ) : null}
                {refund ? (
                  <RentalMeta
                    label={t("rental.lifecycle.refundLabel")}
                    value={t("rental.lifecycle.refundValue", {
                      refundId: refund.refundId,
                      status: refund.status,
                      amount: refund.refundAmount ?? "0.00"
                    })}
                  />
                ) : null}
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  disabled={Boolean(usageReview) || lifecycleStatus === "reviewing" || lifecycleStatus === "refunding"}
                  onClick={() => void handleSubmitUsageReview()}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {lifecycleStatus === "reviewing" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {usageReview
                    ? t("rental.lifecycle.reviewedAction")
                    : lifecycleStatus === "reviewing"
                      ? t("rental.lifecycle.reviewingAction")
                      : t("rental.lifecycle.reviewAction")}
                </Button>
                <Button
                  disabled={Boolean(refund) || lifecycleStatus === "reviewing" || lifecycleStatus === "refunding"}
                  onClick={() => void handleRunRefundReview()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {lifecycleStatus === "refunding" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {refund
                    ? t("rental.lifecycle.refundedAction")
                    : lifecycleStatus === "refunding"
                      ? t("rental.lifecycle.refundingAction")
                      : t("rental.lifecycle.refundAction")}
                </Button>
              </div>
              {lifecycleError ? (
                <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {t("rental.lifecycle.error", { message: lifecycleError })}
                </p>
              ) : null}
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
            {native
              ? t("rental.web3.nativeDirect")
              : marketplaceConfigured
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
