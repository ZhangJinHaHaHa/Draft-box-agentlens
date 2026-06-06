import crypto from "node:crypto";

import {
  createAccessBridgeRequest,
  markAccessBridgeFailed,
  type AccessBridgeRequest
} from "./accessBridge";
import {
  assertPositiveInteger,
  createCreditAccount,
  spendCredits,
  type PlatformCreditAccount,
  type PlatformCreditTransaction
} from "./creditLedger";
import {
  createDeveloperProfile,
  linkAgentToDeveloper,
  type AgentDeveloperLink,
  type DeveloperProfile,
  type DeveloperTrustStatus
} from "./developerProfile";
import {
  isGatewayLeaseIssued,
  transitionOrderStatus,
  type PlatformOrder,
  type PlatformOrderCurrency
} from "./orderState";
import {
  buildAgentReputationSnapshot,
  buildDeveloperReputationSnapshot,
  type ReputationSnapshot
} from "./reputationRead";
import {
  createRefundCase as buildRefundCase,
  resolveRefundCase,
  startRefundReview,
  type RefundCase,
  type RefundEvidence,
  type RefundIssueCategory
} from "./refundPolicy";
import {
  createSettlementLedgerEntry,
  freezeSettlementEntry,
  releaseSettlementEntry,
  resolveSettlementAfterRefund,
  summarizeDeveloperSettlements,
  type DeveloperSettlementSummary,
  type SettlementLedgerEntry
} from "./settlementLedger";
import {
  cancelWalletExport,
  completeWalletExport,
  createGoogleBackedWallet,
  migrateWalletToExternalAddress,
  requestWalletExport,
  type GoogleIdentityProfile,
  type Web2UserWallet
} from "./web2Wallet";
import {
  createUsageReviewRecord,
  inferDimensionRatingsFromOverall,
  summarizeUsageReviews,
  USAGE_REVIEW_DIMENSIONS,
  type UsageReviewDimensionRatings,
  type UsageReviewRecord,
  type UsageReviewSummary
} from "./usageReview";

export interface CreateGoogleMockUserInput {
  googleSubject: string;
  email: string;
  emailVerified?: boolean;
}

export interface CreatePlatformOrderInput {
  userId: string;
  agentId: string;
  amount: string | number;
  currency?: PlatformOrderCurrency;
}

export interface CreateRefundInput {
  orderId: string;
  category: RefundIssueCategory;
  evidence?: RefundEvidence;
}

export interface SubmitUsageReviewInput {
  orderId: string;
  userId: string;
  overallRating: number;
  dimensionRatings?: UsageReviewDimensionRatings;
  capabilityMatched?: boolean;
  safetyIncidentReported?: boolean;
  commentText?: string;
  evidenceUrl?: string;
}

export interface MockPaymentCallbackInput {
  orderId: string;
  paymentProvider: string;
  providerPaymentId: string;
  idempotencyKey: string;
  paidAmount: string | number;
}

export interface PlatformPaymentCallbackRecord {
  idempotencyKey: string;
  orderId: string;
  paymentProvider: string;
  providerPaymentId: string;
  paidAmount: string;
  bridgeId: string;
  createdAt: string;
}

export interface PlatformApiStoreSnapshot {
  users: number;
  creditAccounts: number;
  orders: number;
  accessBridges: number;
  refunds: number;
  usageReviews: number;
  paymentCallbacks: number;
  developerProfiles: number;
  settlements: number;
}

export interface PlatformApiStoreState {
  users: Web2UserWallet[];
  usersByGoogleSubject: Array<[string, string]>;
  creditAccounts: PlatformCreditAccount[];
  creditTransactions: PlatformCreditTransaction[];
  orders: PlatformOrder[];
  bridges: AccessBridgeRequest[];
  bridgeIdsByOrderId: Array<[string, string]>;
  refunds: RefundCase[];
  usageReviews?: UsageReviewRecord[];
  usageReviewIdsByOrderId?: Array<[string, string]>;
  paymentCallbacks?: PlatformPaymentCallbackRecord[];
  developerProfiles?: DeveloperProfile[];
  agentDeveloperLinks?: AgentDeveloperLink[];
  settlements?: SettlementLedgerEntry[];
  settlementIdsByOrderId?: Array<[string, string]>;
  sequences: {
    creditSeq: number;
    orderSeq: number;
    bridgeSeq: number;
    refundSeq: number;
    reviewSeq?: number;
    developerSeq?: number;
    settlementSeq?: number;
  };
}

export interface CreateDeveloperProfileInput {
  displayName: string;
  walletAddress: string;
  websiteUrl?: string;
  supportContact?: string;
  trustStatus?: DeveloperTrustStatus;
  trustScore?: number;
}

export interface PlatformAdminInspectSnapshot {
  snapshot: PlatformApiStoreSnapshot;
  users: Web2UserWallet[];
  creditAccounts: PlatformCreditAccount[];
  creditTransactions: PlatformCreditTransaction[];
  orders: PlatformOrder[];
  accessBridges: AccessBridgeRequest[];
  refunds: RefundCase[];
  usageReviews: UsageReviewRecord[];
  paymentCallbacks: PlatformPaymentCallbackRecord[];
  developerProfiles: DeveloperProfile[];
  agentDeveloperLinks: AgentDeveloperLink[];
  settlements: SettlementLedgerEntry[];
  reputation: {
    agents: ReputationSnapshot[];
    developers: ReputationSnapshot[];
  };
}

export class PlatformApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export class InMemoryPlatformApiStore {
  private users = new Map<string, Web2UserWallet>();
  private usersByGoogleSubject = new Map<string, string>();
  private creditAccounts = new Map<string, PlatformCreditAccount>();
  private creditTransactions = new Map<string, PlatformCreditTransaction>();
  private orders = new Map<string, PlatformOrder>();
  private bridges = new Map<string, AccessBridgeRequest>();
  private bridgeIdsByOrderId = new Map<string, string>();
  private refunds = new Map<string, RefundCase>();
  private usageReviews = new Map<string, UsageReviewRecord>();
  private usageReviewIdsByOrderId = new Map<string, string>();
  private paymentCallbacks = new Map<string, PlatformPaymentCallbackRecord>();
  private developerProfiles = new Map<string, DeveloperProfile>();
  private agentDeveloperLinks = new Map<string, AgentDeveloperLink>();
  private settlements = new Map<string, SettlementLedgerEntry>();
  private settlementIdsByOrderId = new Map<string, string>();
  private creditSeq = 0;
  private orderSeq = 0;
  private bridgeSeq = 0;
  private refundSeq = 0;
  private reviewSeq = 0;
  private developerSeq = 0;
  private settlementSeq = 0;

  constructor(
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly initialPlatformCredits = 100,
    initialState?: PlatformApiStoreState,
    private readonly onStateChange?: (state: PlatformApiStoreState) => void
  ) {
    if (initialState) {
      this.hydrate(initialState);
    }
  }

  snapshot(): PlatformApiStoreSnapshot {
    return {
      users: this.users.size,
      creditAccounts: this.creditAccounts.size,
      orders: this.orders.size,
      accessBridges: this.bridges.size,
      refunds: this.refunds.size,
      usageReviews: this.usageReviews.size,
      paymentCallbacks: this.paymentCallbacks.size,
      developerProfiles: this.developerProfiles.size,
      settlements: this.settlements.size
    };
  }

  exportState(): PlatformApiStoreState {
    return {
      users: [...this.users.values()],
      usersByGoogleSubject: [...this.usersByGoogleSubject.entries()],
      creditAccounts: [...this.creditAccounts.values()],
      creditTransactions: [...this.creditTransactions.values()],
      orders: [...this.orders.values()],
      bridges: [...this.bridges.values()],
      bridgeIdsByOrderId: [...this.bridgeIdsByOrderId.entries()],
      refunds: [...this.refunds.values()],
      usageReviews: [...this.usageReviews.values()],
      usageReviewIdsByOrderId: [...this.usageReviewIdsByOrderId.entries()],
      paymentCallbacks: [...this.paymentCallbacks.values()],
      developerProfiles: [...this.developerProfiles.values()],
      agentDeveloperLinks: [...this.agentDeveloperLinks.values()],
      settlements: [...this.settlements.values()],
      settlementIdsByOrderId: [...this.settlementIdsByOrderId.entries()],
      sequences: {
        creditSeq: this.creditSeq,
        orderSeq: this.orderSeq,
        bridgeSeq: this.bridgeSeq,
        refundSeq: this.refundSeq,
        reviewSeq: this.reviewSeq,
        developerSeq: this.developerSeq,
        settlementSeq: this.settlementSeq
      }
    };
  }

  inspect(): PlatformAdminInspectSnapshot {
    return {
      snapshot: this.snapshot(),
      users: [...this.users.values()],
      creditAccounts: [...this.creditAccounts.values()],
      creditTransactions: [...this.creditTransactions.values()],
      orders: [...this.orders.values()],
      accessBridges: [...this.bridges.values()],
      refunds: [...this.refunds.values()],
      usageReviews: [...this.usageReviews.values()],
      paymentCallbacks: [...this.paymentCallbacks.values()],
      developerProfiles: [...this.developerProfiles.values()],
      agentDeveloperLinks: [...this.agentDeveloperLinks.values()],
      settlements: [...this.settlements.values()],
      reputation: {
        agents: [...new Set([...this.orders.values()].map((order) => order.agentId))]
          .map((agentId) => this.getAgentReputation(agentId)),
        developers: [...this.developerProfiles.values()]
          .map((developer) => this.getDeveloperReputation(developer.developerId))
      }
    };
  }

  createGoogleMockUser(input: CreateGoogleMockUserInput): Web2UserWallet {
    const identity = readGoogleIdentity(input);
    const existingUserId = this.usersByGoogleSubject.get(identity.subject);
    if (existingUserId) {
      return this.getUser(existingUserId);
    }

    const platformUserId = `web2-user-${shortHash(identity.subject)}`;
    const wallet = createGoogleBackedWallet(
      {
        platformUserId,
        identity,
        walletAddress: deterministicWalletAddress(identity.subject)
      },
      this.now()
    );

    this.users.set(platformUserId, wallet);
    this.usersByGoogleSubject.set(identity.subject, platformUserId);
    const creditAccount = createCreditAccount(platformUserId, this.initialPlatformCredits, this.now());
    this.creditAccounts.set(platformUserId, creditAccount.account);
    if (creditAccount.transaction) {
      this.creditTransactions.set(
        `${platformUserId}:${creditAccount.transaction.transactionId}`,
        creditAccount.transaction
      );
    }
    this.persist();
    return wallet;
  }

  getUser(userId: string): Web2UserWallet {
    const user = this.users.get(userId);
    if (!user) {
      throw new PlatformApiError(404, `User "${userId}" was not found.`);
    }
    return user;
  }

  getCreditAccount(userId: string): PlatformCreditAccount {
    this.getUser(userId);
    const account = this.creditAccounts.get(userId);
    if (!account) {
      throw new PlatformApiError(404, `Credit account for user "${userId}" was not found.`);
    }
    return account;
  }

  assertCreditsAvailable(userId: string, amount: number): void {
    assertPositiveInteger(amount, "amount");
    const account = this.getCreditAccount(userId);
    if (account.balance < amount) {
      throw new PlatformApiError(
        402,
        `Insufficient platform credits: need ${amount}, have ${account.balance}.`
      );
    }
  }

  spendPlatformCredits(
    userId: string,
    input: {
      amount: number;
      reason: "llm_recommendation";
    }
  ): { account: PlatformCreditAccount; transaction: PlatformCreditTransaction } {
    this.assertCreditsAvailable(userId, input.amount);
    const result = spendCredits(
      this.getCreditAccount(userId),
      {
        transactionId: `credit-tx-${++this.creditSeq}`,
        amount: input.amount,
        reason: input.reason
      },
      this.now()
    );

    this.creditAccounts.set(userId, result.account);
    this.creditTransactions.set(`${userId}:${result.transaction.transactionId}`, result.transaction);
    this.persist();
    return result;
  }

  createOrder(input: CreatePlatformOrderInput): PlatformOrder {
    const user = this.getUser(input.userId);
    const agentId = readRequiredTrimmed(input.agentId, "agentId");
    const orderId = `order-${++this.orderSeq}`;
    const at = this.now();
    const order: PlatformOrder = {
      orderId,
      userId: user.platformUserId,
      agentId,
      status: "pending",
      amount: normalizeAmount(input.amount),
      currency: input.currency ?? "CREDITS",
      createdAt: at,
      updatedAt: at
    };

    this.orders.set(orderId, order);
    this.persist();
    return order;
  }

  getOrder(orderId: string): PlatformOrder {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new PlatformApiError(404, `Order "${orderId}" was not found.`);
    }
    return order;
  }

  getAccessBridgeForOrder(orderId: string): AccessBridgeRequest | undefined {
    const bridgeId = this.bridgeIdsByOrderId.get(orderId);
    return bridgeId ? this.bridges.get(bridgeId) : undefined;
  }

  getAccessBridge(bridgeId: string): AccessBridgeRequest {
    const bridge = this.bridges.get(bridgeId);
    if (!bridge) {
      throw new PlatformApiError(404, `Access bridge "${bridgeId}" was not found.`);
    }
    return bridge;
  }

  failAccessBridge(bridgeId: string, failureReason: string): AccessBridgeRequest {
    const bridge = markAccessBridgeFailed(this.getAccessBridge(bridgeId), failureReason, this.now());
    this.bridges.set(bridgeId, bridge);
    this.persist();
    return bridge;
  }

  requestUserWalletExport(
    userId: string,
    auth: { freshGoogleAuth: boolean; secondFactorVerified: boolean }
  ): { user: Web2UserWallet; exportReceipt: { receiptId: string; privateKeyMaterial: null } } {
    const user = requestWalletExport(this.getUser(userId), auth, this.now());
    this.users.set(userId, user);
    this.persist();
    return {
      user,
      exportReceipt: {
        receiptId: `wallet-export-${shortHash(`${userId}:${user.exportRequestedAt ?? this.now()}`)}`,
        privateKeyMaterial: null
      }
    };
  }

  completeUserWalletExport(userId: string): Web2UserWallet {
    const user = completeWalletExport(this.getUser(userId), this.now());
    this.users.set(userId, user);
    this.persist();
    return user;
  }

  cancelUserWalletExport(userId: string): Web2UserWallet {
    const user = cancelWalletExport(this.getUser(userId), this.now());
    this.users.set(userId, user);
    this.persist();
    return user;
  }

  migrateUserWallet(
    userId: string,
    input: { targetWalletAddress: string; ownershipProofVerified: boolean }
  ): Web2UserWallet {
    const user = migrateWalletToExternalAddress(
      this.getUser(userId),
      input.targetWalletAddress,
      input.ownershipProofVerified,
      this.now()
    );
    this.users.set(userId, user);
    this.persist();
    return user;
  }

  markOrderPaid(orderId: string): { order: PlatformOrder; bridge: AccessBridgeRequest } {
    const order = this.getOrder(orderId);
    const result = this.applyMockPaymentCallback({
      orderId,
      paymentProvider: "local-mock",
      providerPaymentId: `mock-payment-${orderId}`,
      idempotencyKey: `mock-paid:${orderId}`,
      paidAmount: order.amount ?? "0.00000001"
    });

    return { order: result.order, bridge: result.bridge };
  }

  applyMockPaymentCallback(input: MockPaymentCallbackInput): {
    order: PlatformOrder;
    bridge: AccessBridgeRequest;
    paymentCallback: PlatformPaymentCallbackRecord;
    idempotentReplay: boolean;
  } {
    const paidAmount = normalizeAmount(input.paidAmount);
    const normalized = {
      orderId: readRequiredTrimmed(input.orderId, "orderId"),
      paymentProvider: readRequiredTrimmed(input.paymentProvider, "paymentProvider"),
      providerPaymentId: readRequiredTrimmed(input.providerPaymentId, "providerPaymentId"),
      idempotencyKey: readRequiredTrimmed(input.idempotencyKey, "idempotencyKey"),
      paidAmount
    };
    const existingCallback = this.paymentCallbacks.get(normalized.idempotencyKey);
    if (existingCallback) {
      assertPaymentCallbackReplayMatches(existingCallback, normalized);
      const replayedOrder = this.getOrder(existingCallback.orderId);
      const replayedBridge = this.bridges.get(existingCallback.bridgeId);
      if (!replayedBridge) {
        throw new PlatformApiError(500, `Access bridge "${existingCallback.bridgeId}" was not found.`);
      }

      return {
        order: replayedOrder,
        bridge: replayedBridge,
        paymentCallback: existingCallback,
        idempotentReplay: true
      };
    }

    const order = this.getOrder(normalized.orderId);
    const user = this.getUser(order.userId);
    const at = this.now();
    const gatewayLease = createGatewayLease(normalized.orderId, user.platformUserId, at);
    const leasedOrder = {
      ...transitionOrderStatus(order, "gateway_lease_issued", at),
      paymentProvider: normalized.paymentProvider,
      providerPaymentId: normalized.providerPaymentId,
      idempotencyKey: normalized.idempotencyKey,
      paidAmount: normalized.paidAmount,
      gatewayLeaseToken: gatewayLease.token,
      gatewayLeaseExpiresAt: gatewayLease.expiresAt,
      chainGrantStatus: "pending_chain_grant" as const
    };
    const bridge = createAccessBridgeRequest(
      {
        bridgeId: `access-bridge-${++this.bridgeSeq}`,
        order: leasedOrder,
        userWalletAddress: user.walletAddress
      },
      at
    );

    this.orders.set(normalized.orderId, leasedOrder);
    this.bridges.set(bridge.bridgeId, bridge);
    this.bridgeIdsByOrderId.set(normalized.orderId, bridge.bridgeId);
    const settlement = createSettlementLedgerEntry(
      {
        settlementId: `settlement-${++this.settlementSeq}`,
        order: leasedOrder,
        developerId: this.agentDeveloperLinks.get(leasedOrder.agentId)?.developerId ?? "unassigned-developer"
      },
      at
    );
    this.settlements.set(settlement.settlementId, settlement);
    this.settlementIdsByOrderId.set(leasedOrder.orderId, settlement.settlementId);
    const paymentCallback: PlatformPaymentCallbackRecord = {
      ...normalized,
      bridgeId: bridge.bridgeId,
      createdAt: at
    };
    this.paymentCallbacks.set(normalized.idempotencyKey, paymentCallback);
    this.persist();
    return {
      order: leasedOrder,
      bridge,
      paymentCallback,
      idempotentReplay: false
    };
  }

  createRefund(input: CreateRefundInput): RefundCase {
    const order = this.getOrder(input.orderId);
    if (!isGatewayLeaseIssued(order)) {
      throw new PlatformApiError(400, `Order "${order.orderId}" must have a Gateway lease before refund review.`);
    }

    const refund = buildRefundCase(
      {
        refundId: `refund-${++this.refundSeq}`,
        orderId: order.orderId,
        userId: order.userId,
        agentId: order.agentId,
        category: input.category,
        evidence: input.evidence
      },
      this.now()
    );

    this.refunds.set(refund.refundId, refund);
    this.freezeSettlementForOrder(order.orderId, `Refund review opened: ${input.category}`, refund.refundId);
    this.persist();
    return refund;
  }

  getRefund(refundId: string): RefundCase {
    const refund = this.refunds.get(refundId);
    if (!refund) {
      throw new PlatformApiError(404, `Refund "${refundId}" was not found.`);
    }
    return refund;
  }

  startRefundReview(refundId: string, reviewerId: string): RefundCase {
    const refund = startRefundReview(this.getRefund(refundId), reviewerId, this.now());
    this.refunds.set(refundId, refund);
    this.persist();
    return refund;
  }

  resolveRefund(
    refundId: string,
    outcome: "approved" | "rejected" | "partial_refund",
    input: { reviewNote: string; refundAmount?: string; operatorReviewFinding?: string }
  ): RefundCase {
    const refund = resolveRefundCase(this.getRefund(refundId), outcome, input, this.now());
    if (refund.status === "approved") {
      const order = this.getOrder(refund.orderId);
      this.orders.set(order.orderId, transitionOrderStatus(order, "refunded", refund.updatedAt));
    }

    this.refunds.set(refundId, refund);
    this.resolveSettlementForRefund(refund);
    this.persist();
    return refund;
  }

  submitUsageReview(input: SubmitUsageReviewInput): UsageReviewRecord {
    const order = this.getOrder(input.orderId);
    const user = this.getUser(input.userId);
    if (order.userId !== user.platformUserId) {
      throw new PlatformApiError(403, `User "${user.platformUserId}" cannot review order "${order.orderId}".`);
    }
    if (!isGatewayLeaseIssued(order)) {
      throw new PlatformApiError(400, `Order "${order.orderId}" must have a Gateway lease before usage review.`);
    }
    if (!order.gatewayLeaseToken) {
      throw new PlatformApiError(400, `Order "${order.orderId}" is missing Gateway lease metadata.`);
    }
    if (this.usageReviewIdsByOrderId.has(order.orderId)) {
      throw new PlatformApiError(409, `Order "${order.orderId}" has already been reviewed.`);
    }

    const overallRating = normalizeOverallRating(input.overallRating);
    const review = createUsageReviewRecord(
      {
        reviewId: `usage-review-${++this.reviewSeq}`,
        orderId: order.orderId,
        userId: user.platformUserId,
        agentId: order.agentId,
        overallRating,
        dimensionRatings: normalizeDimensionRatings(input.dimensionRatings, overallRating),
        capabilityMatched: input.capabilityMatched,
        safetyIncidentReported: input.safetyIncidentReported,
        commentText: normalizeOptionalText(input.commentText),
        evidenceUrl: normalizeOptionalText(input.evidenceUrl)
      },
      this.now()
    );

    this.usageReviews.set(review.reviewId, review);
    this.usageReviewIdsByOrderId.set(order.orderId, review.reviewId);
    this.persist();
    return review;
  }

  getUsageReview(reviewId: string): UsageReviewRecord {
    const review = this.usageReviews.get(reviewId);
    if (!review) {
      throw new PlatformApiError(404, `Usage review "${reviewId}" was not found.`);
    }
    return review;
  }

  getUsageReviewForOrder(orderId: string): UsageReviewRecord | null {
    const reviewId = this.usageReviewIdsByOrderId.get(orderId);
    return reviewId ? this.getUsageReview(reviewId) : null;
  }

  getAgentUsageReviewSummary(agentId: string): UsageReviewSummary {
    return summarizeUsageReviews(agentId, [...this.usageReviews.values()]);
  }

  createDeveloperProfile(input: CreateDeveloperProfileInput): DeveloperProfile {
    const developerId = `developer-${++this.developerSeq}`;
    const developer = createDeveloperProfile({ ...input, developerId }, this.now());
    this.developerProfiles.set(developerId, developer);
    this.persist();
    return developer;
  }

  getDeveloperProfile(developerId: string): DeveloperProfile {
    const developer = this.developerProfiles.get(developerId);
    if (!developer) {
      throw new PlatformApiError(404, `Developer "${developerId}" was not found.`);
    }
    return developer;
  }

  linkAgentToDeveloper(agentId: string, developerId: string): AgentDeveloperLink {
    this.getDeveloperProfile(developerId);
    const link = linkAgentToDeveloper({ agentId, developerId }, this.now());
    this.agentDeveloperLinks.set(link.agentId, link);
    this.persist();
    return link;
  }

  getDeveloperForAgent(agentId: string): { link: AgentDeveloperLink; developer: DeveloperProfile } {
    const link = this.agentDeveloperLinks.get(agentId);
    if (!link) {
      throw new PlatformApiError(404, `Developer link for agent "${agentId}" was not found.`);
    }
    return {
      link,
      developer: this.getDeveloperProfile(link.developerId)
    };
  }

  getSettlementForOrder(orderId: string): SettlementLedgerEntry {
    const settlementId = this.settlementIdsByOrderId.get(orderId);
    if (!settlementId) {
      throw new PlatformApiError(404, `Settlement for order "${orderId}" was not found.`);
    }
    const settlement = this.settlements.get(settlementId);
    if (!settlement) {
      throw new PlatformApiError(404, `Settlement "${settlementId}" was not found.`);
    }
    return settlement;
  }

  getDeveloperSettlementSummary(developerId: string): {
    summary: DeveloperSettlementSummary;
    entries: SettlementLedgerEntry[];
  } {
    const entries = [...this.settlements.values()].filter((entry) => entry.developerId === developerId);
    return {
      summary: summarizeDeveloperSettlements(developerId, entries),
      entries
    };
  }

  releaseSettlement(settlementId: string): SettlementLedgerEntry {
    const entry = this.getSettlement(settlementId);
    const released = releaseSettlementEntry(entry, this.now());
    this.settlements.set(settlementId, released);
    this.persist();
    return released;
  }

  getAgentReputation(agentId: string): ReputationSnapshot {
    const developer = this.agentDeveloperLinks.get(agentId)?.developerId;
    return buildAgentReputationSnapshot(
      agentId,
      {
        orders: [...this.orders.values()],
        bridges: [...this.bridges.values()],
        refunds: [...this.refunds.values()],
        reviews: [...this.usageReviews.values()],
        developer: developer ? this.developerProfiles.get(developer) : undefined
      },
      this.now()
    );
  }

  getDeveloperReputation(developerId: string): ReputationSnapshot {
    const developer = this.getDeveloperProfile(developerId);
    const linkedAgentIds = [...this.agentDeveloperLinks.values()]
      .filter((link) => link.developerId === developerId)
      .map((link) => link.agentId);
    return buildDeveloperReputationSnapshot(
      developer,
      {
        linkedAgentIds,
        orders: [...this.orders.values()],
        bridges: [...this.bridges.values()],
        refunds: [...this.refunds.values()],
        reviews: [...this.usageReviews.values()]
      },
      this.now()
    );
  }

  private hydrate(state: PlatformApiStoreState): void {
    this.users = new Map(state.users.map((user) => [user.platformUserId, user]));
    this.usersByGoogleSubject = new Map(state.usersByGoogleSubject);
    this.creditAccounts = new Map(state.creditAccounts.map((account) => [account.userId, account]));
    this.creditTransactions = new Map(
      state.creditTransactions.map((transaction) => [
        `${transaction.userId}:${transaction.transactionId}`,
        transaction
      ])
    );
    this.orders = new Map(state.orders.map((order) => [order.orderId, order]));
    this.bridges = new Map(state.bridges.map((bridge) => [bridge.bridgeId, bridge]));
    this.bridgeIdsByOrderId = new Map(state.bridgeIdsByOrderId);
    this.refunds = new Map(state.refunds.map((refund) => [refund.refundId, refund]));
    this.usageReviews = new Map(
      (state.usageReviews ?? []).map((review) => [review.reviewId, review])
    );
    this.usageReviewIdsByOrderId = new Map(state.usageReviewIdsByOrderId ?? []);
    this.paymentCallbacks = new Map(
      (state.paymentCallbacks ?? []).map((callback) => [callback.idempotencyKey, callback])
    );
    this.developerProfiles = new Map(
      (state.developerProfiles ?? []).map((developer) => [developer.developerId, developer])
    );
    this.agentDeveloperLinks = new Map(
      (state.agentDeveloperLinks ?? []).map((link) => [link.agentId, link])
    );
    this.settlements = new Map(
      (state.settlements ?? []).map((settlement) => [settlement.settlementId, settlement])
    );
    this.settlementIdsByOrderId = new Map(state.settlementIdsByOrderId ?? []);
    this.creditSeq = state.sequences.creditSeq;
    this.orderSeq = state.sequences.orderSeq;
    this.bridgeSeq = state.sequences.bridgeSeq;
    this.refundSeq = state.sequences.refundSeq;
    this.reviewSeq = state.sequences.reviewSeq ?? this.usageReviews.size;
    this.developerSeq = state.sequences.developerSeq ?? 0;
    this.settlementSeq = state.sequences.settlementSeq ?? 0;
  }

  private persist(): void {
    this.onStateChange?.(this.exportState());
  }

  private getSettlement(settlementId: string): SettlementLedgerEntry {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) {
      throw new PlatformApiError(404, `Settlement "${settlementId}" was not found.`);
    }
    return settlement;
  }

  private freezeSettlementForOrder(orderId: string, reason: string, refundId: string): void {
    const settlementId = this.settlementIdsByOrderId.get(orderId);
    if (!settlementId) return;
    const settlement = this.settlements.get(settlementId);
    if (!settlement) return;
    this.settlements.set(settlementId, freezeSettlementEntry(settlement, reason, refundId, this.now()));
  }

  private resolveSettlementForRefund(refund: RefundCase): void {
    const settlementId = this.settlementIdsByOrderId.get(refund.orderId);
    if (!settlementId) return;
    const settlement = this.settlements.get(settlementId);
    if (!settlement) return;
    this.settlements.set(settlementId, resolveSettlementAfterRefund(settlement, refund, refund.updatedAt));
  }
}

function readGoogleIdentity(input: CreateGoogleMockUserInput): GoogleIdentityProfile {
  const subject = readRequiredTrimmed(input.googleSubject, "googleSubject");
  const email = readRequiredTrimmed(input.email, "email");
  if (!email.includes("@")) {
    throw new PlatformApiError(400, "email must look like an email address.");
  }

  return {
    provider: "google",
    subject,
    email,
    emailVerified: input.emailVerified ?? true
  };
}

function readRequiredTrimmed(value: string, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PlatformApiError(400, `${fieldName} is required.`);
  }
  return value.trim();
}

function normalizeAmount(value: string | number): string {
  const amount = typeof value === "number" ? String(value) : value.trim();
  if (!/^\d+(\.\d{1,8})?$/.test(amount) || Number(amount) <= 0) {
    throw new PlatformApiError(400, "amount must be a positive decimal.");
  }
  return amount;
}

function normalizeOverallRating(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new PlatformApiError(400, "overallRating must be an integer from 1 to 5.");
  }
  return value;
}

function normalizeDimensionRatings(
  ratings: UsageReviewDimensionRatings | undefined,
  overallRating: number
): UsageReviewDimensionRatings {
  if (!ratings) {
    return inferDimensionRatingsFromOverall(overallRating);
  }

  const normalized: Partial<UsageReviewDimensionRatings> = {};
  for (const dimension of USAGE_REVIEW_DIMENSIONS) {
    const value = ratings[dimension];
    if (value !== 0 && value !== 1 && value !== 2) {
      throw new PlatformApiError(400, `dimensionRatings.${dimension} must be 0, 1, or 2.`);
    }
    normalized[dimension] = value;
  }
  return normalized as UsageReviewDimensionRatings;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}

function assertPaymentCallbackReplayMatches(
  existing: PlatformPaymentCallbackRecord,
  incoming: Omit<PlatformPaymentCallbackRecord, "bridgeId" | "createdAt">
): void {
  if (
    existing.orderId !== incoming.orderId ||
    existing.paymentProvider !== incoming.paymentProvider ||
    existing.providerPaymentId !== incoming.providerPaymentId ||
    existing.paidAmount !== incoming.paidAmount
  ) {
    throw new PlatformApiError(
      409,
      `Payment callback idempotency key "${incoming.idempotencyKey}" conflicts with an existing callback.`
    );
  }
}

function createGatewayLease(orderId: string, userId: string, issuedAt: string): { token: string; expiresAt: string } {
  const expiresAt = new Date(new Date(issuedAt).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return {
    token: `gateway-lease-${hashHex(`agentlens:gateway-lease:${orderId}:${userId}:${issuedAt}`).slice(0, 32)}`,
    expiresAt
  };
}

function deterministicWalletAddress(subject: string): string {
  return `0x${hashHex(`agentlens:web2:wallet:${subject}`).slice(0, 40)}`;
}

function shortHash(value: string): string {
  return hashHex(`agentlens:web2:user:${value}`).slice(0, 12);
}

function hashHex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
