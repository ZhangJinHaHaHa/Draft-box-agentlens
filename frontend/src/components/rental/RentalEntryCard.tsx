import { Bot, CheckCircle2, CreditCard, ExternalLink, Hash, Loader2, LockKeyhole, MessageSquare, ReceiptText, RotateCcw, Send, Star, TrendingUp, Wallet } from "lucide-react";
import { useState, type FormEvent, type TextareaHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentCatalogEntry } from "@/domain/catalog";
import { isNativeEntry } from "@/domain/catalog";
import { pickText } from "@/domain/i18nText";
import { DEFAULT_LOCALE, isSupportedLocale } from "@/i18n/config";
import {
  createHostedAgentLease,
  type HostedAgentLeasePayload
} from "@/lib/hostedAgentClient";
import {
  createMockGoogleUser,
  createPlatformDeveloper,
  createPlatformRefund,
  createPlatformOrder,
  getAgentReputation,
  getPlatformSettlement,
  invokePlatformAgent,
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
  type PlatformUsageReviewDimension,
  type PlatformUsageReviewDimensionRatings,
  type PlatformUsageReviewResponse,
  type PlatformUser
} from "@/lib/platformClient";

interface RentalEntryCardProps {
  entry: AgentCatalogEntry;
  platformApiUrl?: string;
  web2RentalUrl?: string;
  hostedAgentApiUrl?: string;
  marketplaceConfigured: boolean;
}

const LOCAL_RENTAL_AMOUNT = "20.00";
const LOCAL_RENTAL_CURRENCY = "CREDITS";
const LOCAL_RENTAL_GOOGLE_SUBJECT = "agentlens-local-rental-user";
const LOCAL_RENTAL_EMAIL = "rental@agentlens.local";
const LOCAL_DEVELOPER_WALLET = "0x3333333333333333333333333333333333333333";
const DEMO_USAGE_REVIEW_COMMENT = "Local MVP-3 demo review: Gateway lease delivered and capability matched.";
const DEMO_DIMENSION_RATINGS: PlatformUsageReviewDimensionRatings = {
  security: 2,
  taskExecution: 2,
  cognitive: 2,
  environment: 1,
  engineering: 2,
  compliance: 2
};
const REVIEW_DIMENSIONS: PlatformUsageReviewDimension[] = [
  "security",
  "taskExecution",
  "cognitive",
  "environment",
  "engineering",
  "compliance"
];

interface DemoChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
}

export function RentalEntryCard({
  entry,
  hostedAgentApiUrl,
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
  const [reviewComment, setReviewComment] = useState(DEMO_USAGE_REVIEW_COMMENT);
  const [refund, setRefund] = useState<PlatformRefundCase | null>(null);
  const [hostedLease, setHostedLease] = useState<HostedAgentLeasePayload | null>(null);
  const [hostedLeaseError, setHostedLeaseError] = useState<string | null>(null);
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
  const hostedGatewayEnabled = Boolean(
    hostedAgentApiUrl &&
      entry.id.startsWith("hst-") &&
      entry.source === "marketplace" &&
      entry.tags.includes("hosted-api")
  );
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
    setHostedLease(null);
    setHostedLeaseError(null);

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
      const nextHostedLease = await createHostedGatewayLeaseIfAvailable({
        hostedAgentApiUrl,
        hostedGatewayEnabled,
        hostedAgentId: entry.id,
        userId: login.user.platformUserId
      });
      const [createdSettlement, createdReputation] = await Promise.all([
        getPlatformSettlement(platformApiUrl, payment.order.orderId),
        getAgentReputation(platformApiUrl, entry.id)
      ]);

      setHostedLease(nextHostedLease.lease);
      setHostedLeaseError(nextHostedLease.error);
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
        dimensionRatings: DEMO_DIMENSION_RATINGS,
        capabilityMatched: true,
        safetyIncidentReported: false,
        commentText: reviewComment.trim() || DEMO_USAGE_REVIEW_COMMENT
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
    <Card id="rental-lifecycle" className="scroll-mt-24">
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
                {hostedLease ? (
                  <>
                    <RentalMeta label={t("rental.web2.hostedGatewayLeaseLabel")} value={hostedLease.accessToken} />
                    <RentalMeta label={t("rental.web2.hostedGatewayLeaseExpiresLabel")} value={hostedLease.expiresAt} />
                  </>
                ) : null}
                <RentalMeta label={t("rental.web2.bridgeLabel")} value={bridge.bridgeId} />
                <RentalMeta label={t("rental.web2.bridgeStatusLabel")} value={bridge.status} />
              </dl>
              <Badge className="mt-3" variant="outline">
                {t("rental.web2.grantPending")}
              </Badge>
              {hostedLease ? (
                <Badge className="mt-3 ml-2" variant="secondary">
                  {t("rental.web2.hostedGatewayReady")}
                </Badge>
              ) : null}
              {hostedLeaseError ? (
                <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-muted-foreground">
                  {t("rental.web2.hostedGatewayWarning", { message: hostedLeaseError })}
                </p>
              ) : null}
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

        <ReviewAndReputationPanel
          isReviewing={lifecycleStatus === "reviewing"}
          onReviewCommentChange={setReviewComment}
          onSubmitReview={handleSubmitUsageReview}
          reputation={reputation}
          reviewComment={reviewComment}
          reviewUnlocked={Boolean(platformUser && order?.gatewayLeaseToken)}
          usageReview={usageReview}
        />

        <MockAgentWorkspace
          entry={entry}
          locale={locale}
          order={order}
          platformApiUrl={platformApiUrl}
          unlocked={rentalStatus === "created" && Boolean(order?.gatewayLeaseToken)}
        />
      </CardContent>
    </Card>
  );
}

async function createHostedGatewayLeaseIfAvailable({
  hostedAgentApiUrl,
  hostedGatewayEnabled,
  hostedAgentId,
  userId
}: {
  hostedAgentApiUrl: string | undefined;
  hostedGatewayEnabled: boolean;
  hostedAgentId: string;
  userId: string;
}): Promise<{ lease: HostedAgentLeasePayload | null; error: string | null }> {
  if (!hostedAgentApiUrl || !hostedGatewayEnabled) {
    return { lease: null, error: null };
  }

  const result = await createHostedAgentLease(
    hostedAgentId,
    {
      userId,
      durationHours: 24,
      maxRequests: 20,
      maxRequestsPerMinute: 5
    },
    { endpointUrl: hostedAgentApiUrl }
  );

  if (!result.ok) {
    return { lease: null, error: result.error };
  }

  return { lease: result.lease, error: null };
}

function MockAgentWorkspace({
  entry,
  locale,
  order,
  platformApiUrl,
  unlocked
}: {
  entry: AgentCatalogEntry;
  locale: typeof DEFAULT_LOCALE;
  order: PlatformOrder | null;
  platformApiUrl?: string;
  unlocked: boolean;
}): JSX.Element {
  const { t } = useTranslation("detail");
  const [messages, setMessages] = useState<DemoChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [invocationStatus, setInvocationStatus] = useState<"idle" | "invoking" | "error">("idle");
  const [invocationError, setInvocationError] = useState<string | null>(null);
  const leaseToken = order?.gatewayLeaseToken ?? "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const prompt = draft.trim();
    if (!unlocked || !platformApiUrl || !order?.gatewayLeaseToken || !prompt || invocationStatus === "invoking") {
      return;
    }

    const now = Date.now();
    setMessages((current) => [...current, { id: `user-${now}`, role: "user", content: prompt }]);
    setDraft("");
    setInvocationStatus("invoking");
    setInvocationError(null);

    try {
      const response = await invokePlatformAgent(platformApiUrl, {
        agentId: entry.id,
        orderId: order.orderId,
        gatewayLeaseToken: order.gatewayLeaseToken,
        message: prompt,
        locale
      });
      setMessages((current) => [
        ...current,
        {
          id: `agent-${now}`,
          role: "agent",
          content: `${response.answer}\n\n${response.safetyNotice}`
        }
      ]);
      setInvocationStatus("idle");
    } catch (error) {
      setInvocationStatus("error");
      setInvocationError(error instanceof Error ? error.message : t("rental.mockAgent.unknownError"));
    }
  }

  return (
    <div className="glass-input flex flex-col gap-3 rounded-md border p-4 md:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Bot className="h-4 w-4 text-muted-foreground" aria-hidden />
          {t("rental.mockAgent.title")}
        </div>
        {leaseToken ? (
          <Badge variant="outline">
            {t("rental.mockAgent.leaseLabel")}: {formatLeaseToken(leaseToken)}
          </Badge>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        {unlocked
          ? t("rental.mockAgent.ready", { agent: entry.name })
          : t("rental.mockAgent.locked")}
      </p>

      <div className="grid min-h-40 gap-3 rounded-md border bg-background/60 p-3">
        {messages.length > 0 ? (
          messages.map((message) => (
            <div
              className={message.role === "user" ? "max-w-[88%] justify-self-end" : "max-w-[88%] justify-self-start"}
              key={message.id}
            >
              <div
                className={
                  message.role === "user"
                    ? "rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "rounded-md border bg-card px-3 py-2 text-sm text-foreground"
                }
              >
                <p className="mb-1 text-xs font-medium opacity-80">
                  {message.role === "user" ? t("rental.mockAgent.user") : t("rental.mockAgent.agentName", { agent: entry.name })}
                </p>
                <p className="whitespace-pre-line leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="self-center text-sm text-muted-foreground">
            {unlocked ? t("rental.mockAgent.empty") : t("rental.mockAgent.lockedEmpty")}
          </p>
        )}
        {invocationStatus === "invoking" ? (
          <div className="max-w-[88%] justify-self-start rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {t("rental.mockAgent.invoking")}
            </div>
          </div>
        ) : null}
      </div>

      {invocationStatus === "error" && invocationError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {t("rental.mockAgent.error", { message: invocationError })}
        </p>
      ) : null}

      <form className="grid gap-2 md:grid-cols-[1fr_auto]" onSubmit={handleSubmit}>
        <textarea
          className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!unlocked || invocationStatus === "invoking"}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("rental.mockAgent.placeholder", { agent: entry.name })}
          value={draft}
        />
        <div className="flex flex-wrap items-start gap-2 md:flex-col">
          <Button disabled={!unlocked || !draft.trim() || invocationStatus === "invoking"} size="sm" type="submit">
            {invocationStatus === "invoking" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Send className="h-3.5 w-3.5" aria-hidden />
            )}
            {invocationStatus === "invoking" ? t("rental.mockAgent.invokingAction") : t("rental.mockAgent.send")}
          </Button>
          <Button
            disabled={!unlocked || invocationStatus === "invoking"}
            onClick={() => setDraft(t("rental.mockAgent.samplePrompt", { agent: entry.name }))}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("rental.mockAgent.sampleAction")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function formatLeaseToken(token: string): string {
  if (token.length <= 22) {
    return token;
  }
  return `${token.slice(0, 14)}...${token.slice(-6)}`;
}

function ReviewAndReputationPanel({
  isReviewing,
  onReviewCommentChange,
  onSubmitReview,
  reputation,
  reviewComment,
  reviewUnlocked,
  usageReview
}: {
  isReviewing: boolean;
  onReviewCommentChange: (value: string) => void;
  onSubmitReview: () => Promise<void>;
  reputation: PlatformReputationSnapshot | null;
  reviewComment: string;
  reviewUnlocked: boolean;
  usageReview: PlatformUsageReviewResponse | null;
}): JSX.Element {
  const { t } = useTranslation("detail");
  const ratings = usageReview?.review.dimensionRatings ?? DEMO_DIMENSION_RATINGS;
  const reviewSubmitted = Boolean(usageReview);
  const canSubmitReview = reviewUnlocked && !reviewSubmitted && !isReviewing;

  return (
    <div className="glass-input md:col-span-2 rounded-md border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
            {reviewUnlocked ? (
              <MessageSquare className="h-4 w-4 text-success" aria-hidden />
            ) : (
              <LockKeyhole className="h-4 w-4 text-muted-foreground" aria-hidden />
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">{t("rental.reviewSection.title")}</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              {reviewUnlocked
                ? t("rental.reviewSection.unlockedDescription")
                : t("rental.reviewSection.lockedDescription")}
            </p>
          </div>
        </div>
        <Badge variant={reviewSubmitted ? "success" : reviewUnlocked ? "outline" : "muted"}>
          {reviewSubmitted
            ? t("rental.reviewSection.submittedBadge")
            : reviewUnlocked
              ? t("rental.reviewSection.unlockedBadge")
              : t("rental.reviewSection.lockedBadge")}
        </Badge>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div className="rounded-md border bg-background/50 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden />
            {t("rental.reviewSection.commentTitle")}
          </div>
          <Textarea
            aria-label={t("rental.reviewSection.commentTitle")}
            className="mt-3"
            disabled={!reviewUnlocked || reviewSubmitted || isReviewing}
            onChange={(event) => onReviewCommentChange(event.target.value)}
            placeholder={t("rental.reviewSection.commentPlaceholder")}
            value={usageReview?.review.commentText ?? reviewComment}
          />
          <p className="mt-2 text-xs text-muted-foreground">{t("rental.reviewSection.commentHint")}</p>
          <div className="mt-3 rounded-md border border-dashed p-3 text-xs">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              {t("rental.reviewSection.commentHash")}
            </div>
            <p className="mt-1 break-all text-muted-foreground">
              {usageReview?.review.commentHash ?? t("rental.reviewSection.commentHashPending")}
            </p>
          </div>
          <Button
            className="mt-3"
            disabled={!canSubmitReview}
            onClick={() => void onSubmitReview()}
            size="sm"
            type="button"
            variant="secondary"
          >
            {isReviewing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Star className="h-3.5 w-3.5" aria-hidden />
            )}
            {reviewSubmitted
              ? t("rental.lifecycle.reviewedAction")
              : reviewUnlocked
                ? isReviewing
                  ? t("rental.lifecycle.reviewingAction")
                  : t("rental.lifecycle.reviewAction")
                : t("rental.reviewSection.submitLocked")}
          </Button>
        </div>

        <div className="grid gap-3">
          <div className="rounded-md border bg-background/50 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" aria-hidden />
              {t("rental.reviewSection.dimensionTitle")}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t("rental.reviewSection.dimensionHint")}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {REVIEW_DIMENSIONS.map((dimension) => (
                <DimensionScore key={dimension} dimension={dimension} score={ratings[dimension]} />
              ))}
            </div>
          </div>

          <div className="rounded-md border bg-background/50 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden />
              {t("rental.reputationSection.title")}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t("rental.reputationSection.description")}</p>
            {reputation ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Metric label={t("rental.reputationSection.score")} value={`${reputation.score} / ${reputation.tier}`} />
                <Metric label={t("rental.reputationSection.orders")} value={String(reputation.signals.paidOrders)} />
                <Metric label={t("rental.reputationSection.reviews")} value={String(reputation.signals.reviewCount ?? 0)} />
                <Metric label={t("rental.reputationSection.pendingGrants")} value={String(reputation.signals.pendingChainGrants)} />
                <Metric label={t("rental.reputationSection.refunds")} value={String(reputation.signals.refunds)} />
                <Metric label={t("rental.reputationSection.updatedAt")} value={reputation.updatedAt} />
              </div>
            ) : (
              <p className="mt-3 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                {t("rental.reputationSection.empty")}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DimensionScore({
  dimension,
  score
}: {
  dimension: PlatformUsageReviewDimension;
  score: 0 | 1 | 2;
}): JSX.Element {
  const { t } = useTranslation("detail");
  const ratingKey = score === 2 ? "good" : score === 1 ? "neutral" : "bad";

  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{t(`nativeChain.dimensions.${dimension}`)}</p>
      <p className="mt-1 text-sm font-medium text-foreground">
        {t("rental.reviewSection.dimensionScore", {
          score,
          label: t(`rental.reviewSection.rating.${ratingKey}`)
        })}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-all text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element {
  return (
    <textarea
      {...props}
      className={[
        "min-h-24 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    />
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
