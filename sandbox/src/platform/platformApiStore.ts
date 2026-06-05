import crypto from "node:crypto";

import { createAccessBridgeRequest, type AccessBridgeRequest } from "./accessBridge";
import {
  assertPositiveInteger,
  createCreditAccount,
  spendCredits,
  type PlatformCreditAccount,
  type PlatformCreditTransaction
} from "./creditLedger";
import {
  transitionOrderStatus,
  type PlatformOrder,
  type PlatformOrderCurrency
} from "./orderState";
import {
  createRefundCase as buildRefundCase,
  resolveRefundCase,
  startRefundReview,
  type RefundCase,
  type RefundIssueCategory
} from "./refundPolicy";
import {
  createGoogleBackedWallet,
  type GoogleIdentityProfile,
  type Web2UserWallet
} from "./web2Wallet";

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
  paymentCallbacks: number;
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
  paymentCallbacks?: PlatformPaymentCallbackRecord[];
  sequences: {
    creditSeq: number;
    orderSeq: number;
    bridgeSeq: number;
    refundSeq: number;
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
  private paymentCallbacks = new Map<string, PlatformPaymentCallbackRecord>();
  private creditSeq = 0;
  private orderSeq = 0;
  private bridgeSeq = 0;
  private refundSeq = 0;

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
      paymentCallbacks: this.paymentCallbacks.size
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
      paymentCallbacks: [...this.paymentCallbacks.values()],
      sequences: {
        creditSeq: this.creditSeq,
        orderSeq: this.orderSeq,
        bridgeSeq: this.bridgeSeq,
        refundSeq: this.refundSeq
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
    const paidOrder = {
      ...transitionOrderStatus(order, "paid", at),
      paymentProvider: normalized.paymentProvider,
      providerPaymentId: normalized.providerPaymentId,
      idempotencyKey: normalized.idempotencyKey,
      paidAmount: normalized.paidAmount
    };
    const bridge = createAccessBridgeRequest(
      {
        bridgeId: `access-bridge-${++this.bridgeSeq}`,
        order: paidOrder,
        userWalletAddress: user.walletAddress
      },
      at
    );

    this.orders.set(normalized.orderId, paidOrder);
    this.bridges.set(bridge.bridgeId, bridge);
    this.bridgeIdsByOrderId.set(normalized.orderId, bridge.bridgeId);
    const paymentCallback: PlatformPaymentCallbackRecord = {
      ...normalized,
      bridgeId: bridge.bridgeId,
      createdAt: at
    };
    this.paymentCallbacks.set(normalized.idempotencyKey, paymentCallback);
    this.persist();
    return {
      order: paidOrder,
      bridge,
      paymentCallback,
      idempotentReplay: false
    };
  }

  createRefund(input: CreateRefundInput): RefundCase {
    const order = this.getOrder(input.orderId);
    if (order.status !== "paid") {
      throw new PlatformApiError(400, `Order "${order.orderId}" must be paid before refund review.`);
    }

    const refund = buildRefundCase(
      {
        refundId: `refund-${++this.refundSeq}`,
        orderId: order.orderId,
        userId: order.userId,
        agentId: order.agentId,
        category: input.category
      },
      this.now()
    );

    this.refunds.set(refund.refundId, refund);
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
    input: { reviewNote: string; refundAmount?: string }
  ): RefundCase {
    const refund = resolveRefundCase(this.getRefund(refundId), outcome, input, this.now());
    if (refund.status === "approved") {
      const order = this.getOrder(refund.orderId);
      this.orders.set(order.orderId, transitionOrderStatus(order, "refunded", refund.updatedAt));
    }

    this.refunds.set(refundId, refund);
    this.persist();
    return refund;
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
    this.paymentCallbacks = new Map(
      (state.paymentCallbacks ?? []).map((callback) => [callback.idempotencyKey, callback])
    );
    this.creditSeq = state.sequences.creditSeq;
    this.orderSeq = state.sequences.orderSeq;
    this.bridgeSeq = state.sequences.bridgeSeq;
    this.refundSeq = state.sequences.refundSeq;
  }

  private persist(): void {
    this.onStateChange?.(this.exportState());
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

function deterministicWalletAddress(subject: string): string {
  return `0x${hashHex(`agentlens:web2:wallet:${subject}`).slice(0, 40)}`;
}

function shortHash(value: string): string {
  return hashHex(`agentlens:web2:user:${value}`).slice(0, 12);
}

function hashHex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
