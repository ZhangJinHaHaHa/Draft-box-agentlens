import type { RecommendationRequest } from "@/domain/recommendation";

import {
  parseRecommendationApiResponse,
  type RecommendationApiResponse
} from "./recommendationClient";

export interface PlatformUser {
  platformUserId: string;
  walletAddress: string;
  identityWeight: number;
  custodyMode: string;
  identity: {
    provider: "google";
    email: string;
  };
}

export interface PlatformCreditAccount {
  userId: string;
  balance: number;
  updatedAt: string;
}

export interface PlatformMockGoogleLoginResponse {
  user: PlatformUser;
  creditAccount: PlatformCreditAccount;
}

export interface PlatformAccessBridge {
  bridgeId: string;
  orderId: string;
  status: "pending_chain_grant" | "failed";
  expectedGrantFunction: "grantRentalAccess";
  gatewayLeaseToken: string;
  gatewayLeaseIssuedAt: string;
  gatewayLeaseExpiresAt: string;
}

export interface PlatformOrder {
  orderId: string;
  userId: string;
  agentId: string;
  status: "pending" | "gateway_lease_issued" | "failed" | "refunded";
  amount?: string;
  currency?: "USD" | "CREDITS";
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  paidAmount?: string;
  gatewayLeaseToken?: string;
  gatewayLeaseIssuedAt?: string;
  gatewayLeaseExpiresAt?: string;
  chainGrantStatus?: "pending_chain_grant";
}

export interface PlatformMockPaymentCallbackResponse {
  order: PlatformOrder;
  bridge: PlatformAccessBridge;
  idempotentReplay: boolean;
}

export interface PlatformOrderLookupResponse {
  order: PlatformOrder;
  accessBridge: PlatformAccessBridge | null;
}

export interface PlatformDeveloperProfile {
  developerId: string;
  displayName: string;
  walletAddress: string;
  trustStatus: "unverified" | "verified" | "suspended";
  trustScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformAgentDeveloperLink {
  agentId: string;
  developerId: string;
  linkedAt: string;
}

export interface PlatformSettlement {
  settlementId: string;
  orderId: string;
  agentId: string;
  developerId: string;
  grossAmount: string;
  currency: string;
  platformFeeAmount: string;
  developerShareAmount: string;
  holdbackAmount: string;
  payableAmount: string;
  status: "pending_holdback" | "frozen" | "released" | "refunded";
  updatedAt: string;
}

export interface PlatformReputationSnapshot {
  subjectType: "agent" | "developer";
  subjectId: string;
  score: number;
  tier: "low" | "medium" | "high";
  source: "local-farr-adapter";
  updatedAt: string;
  signals: {
    paidOrders: number;
    gatewayLeasesIssued: number;
    pendingChainGrants: number;
    refunds: number;
    severeRefunds: number;
    reviewCount?: number;
    averageRating?: number | null;
    platformRating?: number | null;
    capabilityMismatchReports?: number;
    safetyIncidentReports?: number;
    developerTrustScore?: number;
  };
}

export type PlatformUsageReviewDimension =
  | "security"
  | "taskExecution"
  | "cognitive"
  | "environment"
  | "engineering"
  | "compliance";

export type PlatformUsageReviewDimensionRatings = Record<PlatformUsageReviewDimension, 0 | 1 | 2>;

export interface PlatformUsageReviewRecord {
  reviewId: string;
  orderId: string;
  userId: string;
  agentId: string;
  overallRating: number;
  dimensionRatings: PlatformUsageReviewDimensionRatings;
  capabilityMatched?: boolean;
  safetyIncidentReported?: boolean;
  commentText?: string;
  commentHash: string;
  createdAt: string;
}

export interface PlatformUsageReviewSummary {
  agentId: string;
  reviewCount: number;
  averageRating: number | null;
  platformRating: number | null;
  capabilityMismatchReports: number;
  safetyIncidentReports: number;
}

export interface PlatformUsageReviewResponse {
  review: PlatformUsageReviewRecord;
  summary: PlatformUsageReviewSummary;
  reputation: PlatformReputationSnapshot;
}

export interface PlatformRefundCase {
  refundId: string;
  orderId: string;
  userId: string;
  agentId: string;
  category:
    | "security_incident"
    | "access_delivery_failure"
    | "core_capability_failure"
    | "agent_unavailable"
    | "design_mismatch"
    | "user_setup_issue"
    | "subjective_quality";
  status: "requested" | "under_review" | "approved" | "rejected" | "partial_refund";
  eligibility: "refundable" | "review_required" | "not_refundable";
  requestedAt: string;
  updatedAt: string;
  reviewerId?: string;
  reviewNote?: string;
  resolvedAt?: string;
  refundAmount?: string;
}

export interface WalletExportResponse {
  user: PlatformUser;
  exportReceipt: {
    receiptId: string;
    privateKeyMaterial: null;
  };
}

export interface PlatformAdminInspect {
  snapshot: {
    users: number;
    creditAccounts: number;
    orders: number;
    accessBridges: number;
    refunds: number;
    paymentCallbacks: number;
    developerProfiles: number;
    settlements: number;
  };
}

export interface PaidLlmRecommendationResponse {
  engine: string;
  charged: boolean;
  fallbackUsed: boolean;
  fallbackReason?: string;
  costCredits: number;
  creditAccount: PlatformCreditAccount;
  recommendation: RecommendationApiResponse;
}

export interface PlatformAgentChatResponse {
  agentId: string;
  answer: string;
  engine: string;
  model: string;
  safetyNotice: string;
}

const PAID_LLM_RECOMMENDATION_TIMEOUT_MS = 45_000;
const PLATFORM_AGENT_CHAT_TIMEOUT_MS = 60_000;

export async function createMockGoogleUser(
  apiBaseUrl: string,
  input: { googleSubject: string; email: string },
  fetchImpl: typeof fetch = fetch
): Promise<PlatformMockGoogleLoginResponse> {
  const payload = await postJson(apiBaseUrl, "/api/web2/google/mock", input, fetchImpl);
  return parseMockGoogleLoginResponse(payload);
}

export async function requestPaidLlmRecommendation(
  apiBaseUrl: string,
  request: RecommendationRequest & { userId: string },
  fetchImpl: typeof fetch = fetch,
  timeoutMs = PAID_LLM_RECOMMENDATION_TIMEOUT_MS
): Promise<PaidLlmRecommendationResponse> {
  const payload = await postJson(apiBaseUrl, "/api/recommendations/llm", request, fetchImpl, timeoutMs);
  return parsePaidLlmRecommendationResponse(payload);
}

export async function invokePlatformAgent(
  apiBaseUrl: string,
  input: {
    agentId: string;
    orderId: string;
    gatewayLeaseToken: string;
    message: string;
    locale: "zh" | "en";
  },
  fetchImpl: typeof fetch = fetch,
  timeoutMs = PLATFORM_AGENT_CHAT_TIMEOUT_MS
): Promise<PlatformAgentChatResponse> {
  const payload = await postJson(apiBaseUrl, "/api/agent-chat", input, fetchImpl, timeoutMs);
  return parsePlatformAgentChatResponse(payload);
}

export async function getPlatformCredits(
  apiBaseUrl: string,
  userId: string,
  fetchImpl: typeof fetch = fetch
): Promise<PlatformCreditAccount> {
  const payload = await getJson(apiBaseUrl, `/api/web2/users/${encodeURIComponent(userId)}/credits`, fetchImpl);
  return parseCreditAccount((payload as { creditAccount?: unknown }).creditAccount);
}

export async function createPlatformOrder(
  apiBaseUrl: string,
  input: { userId: string; agentId: string; amount: string; currency?: "USD" | "CREDITS" },
  fetchImpl: typeof fetch = fetch
): Promise<PlatformOrder> {
  const payload = await postJson(apiBaseUrl, "/api/orders", input, fetchImpl);
  return parsePlatformOrder((payload as { order?: unknown }).order);
}

export async function submitMockPaymentCallback(
  apiBaseUrl: string,
  input: {
    orderId: string;
    paymentProvider: string;
    providerPaymentId: string;
    idempotencyKey: string;
    paidAmount: string;
  },
  fetchImpl: typeof fetch = fetch
): Promise<PlatformMockPaymentCallbackResponse> {
  const payload = await postJson(apiBaseUrl, "/api/payments/mock-callback", input, fetchImpl);
  return parseMockPaymentCallbackResponse(payload);
}

export async function getPlatformOrder(
  apiBaseUrl: string,
  orderId: string,
  fetchImpl: typeof fetch = fetch
): Promise<PlatformOrderLookupResponse> {
  const payload = await getJson(apiBaseUrl, `/api/orders/${encodeURIComponent(orderId)}`, fetchImpl);
  return parsePlatformOrderLookupResponse(payload);
}

export async function createPlatformDeveloper(
  apiBaseUrl: string,
  input: {
    displayName: string;
    walletAddress: string;
    supportContact?: string;
    trustStatus?: "unverified" | "verified" | "suspended";
    trustScore?: number;
  },
  fetchImpl: typeof fetch = fetch
): Promise<PlatformDeveloperProfile> {
  const payload = await postJson(apiBaseUrl, "/api/developers", input, fetchImpl);
  return parseDeveloperProfile((payload as { developer?: unknown }).developer);
}

export async function linkPlatformAgentDeveloper(
  apiBaseUrl: string,
  developerId: string,
  agentId: string,
  fetchImpl: typeof fetch = fetch
): Promise<PlatformAgentDeveloperLink> {
  const payload = await postJson(
    apiBaseUrl,
    `/api/developers/${encodeURIComponent(developerId)}/agents`,
    { agentId },
    fetchImpl
  );
  return parseAgentDeveloperLink((payload as { link?: unknown }).link);
}

export async function getPlatformSettlement(
  apiBaseUrl: string,
  orderId: string,
  fetchImpl: typeof fetch = fetch
): Promise<PlatformSettlement> {
  const payload = await getJson(apiBaseUrl, `/api/settlements/orders/${encodeURIComponent(orderId)}`, fetchImpl);
  return parseSettlement((payload as { settlement?: unknown }).settlement);
}

export async function getAgentReputation(
  apiBaseUrl: string,
  agentId: string,
  fetchImpl: typeof fetch = fetch
): Promise<PlatformReputationSnapshot> {
  const payload = await getJson(apiBaseUrl, `/api/reputation/agents/${encodeURIComponent(agentId)}`, fetchImpl);
  return parseReputation((payload as { reputation?: unknown }).reputation);
}

export async function submitUsageReview(
  apiBaseUrl: string,
  input: {
    orderId: string;
    userId: string;
    overallRating: number;
    dimensionRatings?: PlatformUsageReviewDimensionRatings;
    capabilityMatched?: boolean;
    safetyIncidentReported?: boolean;
    commentText?: string;
  },
  fetchImpl: typeof fetch = fetch
): Promise<PlatformUsageReviewResponse> {
  const payload = await postJson(apiBaseUrl, "/api/reviews", input, fetchImpl);
  return parseUsageReviewResponse(payload);
}

export async function createPlatformRefund(
  apiBaseUrl: string,
  input: {
    orderId: string;
    category: PlatformRefundCase["category"];
    expectedCapability?: string;
    actualFailure?: string;
    agentClaim?: string;
  },
  fetchImpl: typeof fetch = fetch
): Promise<PlatformRefundCase> {
  const payload = await postJson(apiBaseUrl, "/api/refunds", input, fetchImpl);
  return parseRefundCase((payload as { refund?: unknown }).refund);
}

export async function startPlatformRefundReview(
  apiBaseUrl: string,
  refundId: string,
  reviewerId: string,
  fetchImpl: typeof fetch = fetch
): Promise<PlatformRefundCase> {
  const payload = await postJson(
    apiBaseUrl,
    `/api/refunds/${encodeURIComponent(refundId)}/review`,
    { reviewerId },
    fetchImpl
  );
  return parseRefundCase((payload as { refund?: unknown }).refund);
}

export async function resolvePlatformRefund(
  apiBaseUrl: string,
  refundId: string,
  input: {
    outcome: "approved" | "rejected" | "partial_refund";
    reviewNote: string;
    refundAmount?: string;
    operatorReviewFinding?: string;
  },
  fetchImpl: typeof fetch = fetch
): Promise<PlatformRefundCase> {
  const payload = await postJson(
    apiBaseUrl,
    `/api/refunds/${encodeURIComponent(refundId)}/resolve`,
    input,
    fetchImpl
  );
  return parseRefundCase((payload as { refund?: unknown }).refund);
}

export async function requestWalletExport(
  apiBaseUrl: string,
  userId: string,
  input: { freshGoogleAuth: boolean; secondFactorVerified: boolean },
  fetchImpl: typeof fetch = fetch
): Promise<WalletExportResponse> {
  const payload = await postJson(
    apiBaseUrl,
    `/api/web2/users/${encodeURIComponent(userId)}/wallet/export/request`,
    input,
    fetchImpl
  );
  return parseWalletExportResponse(payload);
}

export async function migrateWallet(
  apiBaseUrl: string,
  userId: string,
  input: { targetWalletAddress: string; ownershipProofVerified: boolean },
  fetchImpl: typeof fetch = fetch
): Promise<PlatformUser> {
  const payload = await postJson(
    apiBaseUrl,
    `/api/web2/users/${encodeURIComponent(userId)}/wallet/migrate`,
    input,
    fetchImpl
  );
  return parsePlatformUser((payload as { user?: unknown }).user);
}

export async function getAccessBridge(
  apiBaseUrl: string,
  bridgeId: string,
  fetchImpl: typeof fetch = fetch
): Promise<PlatformAccessBridge> {
  const payload = await getJson(apiBaseUrl, `/api/access-bridges/${encodeURIComponent(bridgeId)}`, fetchImpl);
  return parseAccessBridge((payload as { accessBridge?: unknown }).accessBridge);
}

export async function getPlatformAdminInspect(
  apiBaseUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<PlatformAdminInspect> {
  const payload = await getJson(apiBaseUrl, "/api/admin/inspect", fetchImpl);
  return parsePlatformAdminInspect(payload);
}

async function getJson(
  apiBaseUrl: string,
  path: string,
  fetchImpl: typeof fetch
): Promise<unknown> {
  const baseUrl = apiBaseUrl.replace(/\/+$/, "");
  const response = await fetchImpl(`${baseUrl}${path}`);
  if (!response.ok) {
    throw new Error(await buildPlatformApiStatusError(response));
  }
  return response.json();
}

async function postJson(
  apiBaseUrl: string,
  path: string,
  body: unknown,
  fetchImpl: typeof fetch,
  timeoutMs?: number
): Promise<unknown> {
  const baseUrl = apiBaseUrl.replace(/\/+$/, "");
  const controller = timeoutMs ? new AbortController() : undefined;
  const timeout = controller ? globalThis.setTimeout(() => controller.abort(), timeoutMs) : undefined;
  let response: Response;

  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      ...(controller ? { signal: controller.signal } : {}),
      body: JSON.stringify(body)
    });
  } catch (error) {
    if (isAbortError(error) && timeoutMs) {
      throw new Error(`Platform API request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    if (timeout !== undefined) {
      globalThis.clearTimeout(timeout);
    }
  }

  if (!response.ok) {
    throw new Error(await buildPlatformApiStatusError(response));
  }

  return response.json();
}

async function buildPlatformApiStatusError(response: Response): Promise<string> {
  const statusPrefix = `Platform API responded with status ${response.status}`;
  try {
    const payload = await response.json();
    const detail = (payload as { error?: unknown }).error;
    return typeof detail === "string" && detail.trim().length > 0
      ? `${statusPrefix}: ${detail}`
      : `${statusPrefix}.`;
  } catch {
    return `${statusPrefix}.`;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function parseMockGoogleLoginResponse(payload: unknown): PlatformMockGoogleLoginResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error("Platform login response must be an object.");
  }
  const record = payload as Record<string, unknown>;
  return {
    user: parsePlatformUser(record.user),
    creditAccount: parseCreditAccount(record.creditAccount)
  };
}

function parsePaidLlmRecommendationResponse(payload: unknown): PaidLlmRecommendationResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error("Paid recommendation response must be an object.");
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.engine !== "string") {
    throw new Error("Paid recommendation engine is required.");
  }
  if (typeof record.charged !== "boolean") {
    throw new Error("Paid recommendation charged flag is required.");
  }
  if (typeof record.fallbackUsed !== "boolean") {
    throw new Error("Paid recommendation fallback flag is required.");
  }
  if (typeof record.costCredits !== "number" || !Number.isFinite(record.costCredits)) {
    throw new Error("Paid recommendation costCredits must be a number.");
  }

  return {
    engine: record.engine,
    charged: record.charged,
    fallbackUsed: record.fallbackUsed,
    ...(typeof record.fallbackReason === "string" ? { fallbackReason: record.fallbackReason } : {}),
    costCredits: record.costCredits,
    creditAccount: parseCreditAccount(record.creditAccount),
    recommendation: parseRecommendationApiResponse(record.recommendation)
  };
}

function parsePlatformAgentChatResponse(payload: unknown): PlatformAgentChatResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error("Agent chat response must be an object.");
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.agentId !== "string" || record.agentId.trim().length === 0) {
    throw new Error("Agent chat response agentId is required.");
  }
  if (typeof record.answer !== "string" || record.answer.trim().length === 0) {
    throw new Error("Agent chat response answer is required.");
  }
  if (typeof record.engine !== "string" || record.engine.trim().length === 0) {
    throw new Error("Agent chat response engine is required.");
  }
  if (typeof record.model !== "string" || record.model.trim().length === 0) {
    throw new Error("Agent chat response model is required.");
  }
  if (typeof record.safetyNotice !== "string" || record.safetyNotice.trim().length === 0) {
    throw new Error("Agent chat response safetyNotice is required.");
  }
  return {
    agentId: record.agentId,
    answer: record.answer,
    engine: record.engine,
    model: record.model,
    safetyNotice: record.safetyNotice
  };
}

function parseMockPaymentCallbackResponse(payload: unknown): PlatformMockPaymentCallbackResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error("Mock payment callback response must be an object.");
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.idempotentReplay !== "boolean") {
    throw new Error("Mock payment callback idempotentReplay flag is required.");
  }
  return {
    order: parsePlatformOrder(record.order),
    bridge: parseAccessBridge(record.bridge),
    idempotentReplay: record.idempotentReplay
  };
}

function parsePlatformOrderLookupResponse(payload: unknown): PlatformOrderLookupResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error("Platform order lookup response must be an object.");
  }
  const record = payload as Record<string, unknown>;
  return {
    order: parsePlatformOrder(record.order),
    accessBridge: record.accessBridge === null ? null : parseAccessBridge(record.accessBridge)
  };
}

function parseWalletExportResponse(payload: unknown): WalletExportResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error("Wallet export response must be an object.");
  }
  const record = payload as Record<string, unknown>;
  const exportReceipt = record.exportReceipt as Record<string, unknown> | undefined;
  if (!exportReceipt || typeof exportReceipt.receiptId !== "string" || exportReceipt.privateKeyMaterial !== null) {
    throw new Error("Wallet export response must include a private-key-free receipt.");
  }
  return {
    user: parsePlatformUser(record.user),
    exportReceipt: {
      receiptId: exportReceipt.receiptId,
      privateKeyMaterial: null
    }
  };
}

function parsePlatformOrder(payload: unknown): PlatformOrder {
  if (!payload || typeof payload !== "object") {
    throw new Error("Platform order must be an object.");
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.orderId !== "string" || record.orderId.trim().length === 0) {
    throw new Error("Platform order id is required.");
  }
  if (typeof record.userId !== "string" || record.userId.trim().length === 0) {
    throw new Error("Platform order userId is required.");
  }
  if (typeof record.agentId !== "string" || record.agentId.trim().length === 0) {
    throw new Error("Platform order agentId is required.");
  }
  if (
    record.status !== "pending" &&
    record.status !== "gateway_lease_issued" &&
    record.status !== "failed" &&
    record.status !== "refunded"
  ) {
    throw new Error("Platform order status is invalid.");
  }
  if (record.currency !== undefined && record.currency !== "USD" && record.currency !== "CREDITS") {
    throw new Error("Platform order currency is invalid.");
  }
  if (typeof record.createdAt !== "string" || record.createdAt.trim().length === 0) {
    throw new Error("Platform order createdAt is required.");
  }
  if (typeof record.updatedAt !== "string" || record.updatedAt.trim().length === 0) {
    throw new Error("Platform order updatedAt is required.");
  }
  if (record.chainGrantStatus !== undefined && record.chainGrantStatus !== "pending_chain_grant") {
    throw new Error("Platform order chain grant status is invalid.");
  }

  return {
    orderId: record.orderId.trim(),
    userId: record.userId.trim(),
    agentId: record.agentId.trim(),
    status: record.status,
    ...(readOptionalString(record, "amount") ? { amount: readOptionalString(record, "amount") } : {}),
    ...(record.currency ? { currency: record.currency } : {}),
    createdAt: record.createdAt.trim(),
    updatedAt: record.updatedAt.trim(),
    ...(readOptionalString(record, "paidAt") ? { paidAt: readOptionalString(record, "paidAt") } : {}),
    ...(readOptionalString(record, "paidAmount") ? { paidAmount: readOptionalString(record, "paidAmount") } : {}),
    ...(readOptionalString(record, "gatewayLeaseToken")
      ? { gatewayLeaseToken: readOptionalString(record, "gatewayLeaseToken") }
      : {}),
    ...(readOptionalString(record, "gatewayLeaseIssuedAt")
      ? { gatewayLeaseIssuedAt: readOptionalString(record, "gatewayLeaseIssuedAt") }
      : {}),
    ...(readOptionalString(record, "gatewayLeaseExpiresAt")
      ? { gatewayLeaseExpiresAt: readOptionalString(record, "gatewayLeaseExpiresAt") }
      : {}),
    ...(record.chainGrantStatus ? { chainGrantStatus: record.chainGrantStatus } : {})
  };
}

function parseDeveloperProfile(payload: unknown): PlatformDeveloperProfile {
  if (!payload || typeof payload !== "object") {
    throw new Error("Developer profile must be an object.");
  }
  const record = payload as Record<string, unknown>;
  const trustStatus = record.trustStatus;
  if (trustStatus !== "unverified" && trustStatus !== "verified" && trustStatus !== "suspended") {
    throw new Error("Developer trust status is invalid.");
  }
  const trustScore = readFiniteField(record, "trustScore");
  return {
    developerId: readRequiredStringField(record, "developerId"),
    displayName: readRequiredStringField(record, "displayName"),
    walletAddress: readRequiredStringField(record, "walletAddress"),
    trustStatus,
    trustScore,
    createdAt: readRequiredStringField(record, "createdAt"),
    updatedAt: readRequiredStringField(record, "updatedAt")
  };
}

function parseAgentDeveloperLink(payload: unknown): PlatformAgentDeveloperLink {
  if (!payload || typeof payload !== "object") {
    throw new Error("Agent developer link must be an object.");
  }
  const record = payload as Record<string, unknown>;
  return {
    agentId: readRequiredStringField(record, "agentId"),
    developerId: readRequiredStringField(record, "developerId"),
    linkedAt: readRequiredStringField(record, "linkedAt")
  };
}

function parseSettlement(payload: unknown): PlatformSettlement {
  if (!payload || typeof payload !== "object") {
    throw new Error("Settlement must be an object.");
  }
  const record = payload as Record<string, unknown>;
  const status = record.status;
  if (status !== "pending_holdback" && status !== "frozen" && status !== "released" && status !== "refunded") {
    throw new Error("Settlement status is invalid.");
  }
  return {
    settlementId: readRequiredStringField(record, "settlementId"),
    orderId: readRequiredStringField(record, "orderId"),
    agentId: readRequiredStringField(record, "agentId"),
    developerId: readRequiredStringField(record, "developerId"),
    grossAmount: readRequiredStringField(record, "grossAmount"),
    currency: readRequiredStringField(record, "currency"),
    platformFeeAmount: readRequiredStringField(record, "platformFeeAmount"),
    developerShareAmount: readRequiredStringField(record, "developerShareAmount"),
    holdbackAmount: readRequiredStringField(record, "holdbackAmount"),
    payableAmount: readRequiredStringField(record, "payableAmount"),
    status,
    updatedAt: readRequiredStringField(record, "updatedAt")
  };
}

function parseReputation(payload: unknown): PlatformReputationSnapshot {
  if (!payload || typeof payload !== "object") {
    throw new Error("Reputation snapshot must be an object.");
  }
  const record = payload as Record<string, unknown>;
  const signalsPayload = record.signals;
  if (!signalsPayload || typeof signalsPayload !== "object") {
    throw new Error("Reputation snapshot must include signals.");
  }
  const signals = signalsPayload as Record<string, unknown>;
  if (record.subjectType !== "agent" && record.subjectType !== "developer") {
    throw new Error("Reputation subject type is invalid.");
  }
  if (record.tier !== "low" && record.tier !== "medium" && record.tier !== "high") {
    throw new Error("Reputation tier is invalid.");
  }
  if (record.source !== "local-farr-adapter") {
    throw new Error("Reputation source is invalid.");
  }
  const reviewCount = readOptionalNumber(signals, "reviewCount");
  const averageRating = readOptionalNullableNumber(signals, "averageRating");
  const platformRating = readOptionalNullableNumber(signals, "platformRating");
  const capabilityMismatchReports = readOptionalNumber(signals, "capabilityMismatchReports");
  const safetyIncidentReports = readOptionalNumber(signals, "safetyIncidentReports");
  const developerTrustScore = readOptionalNumber(signals, "developerTrustScore");
  return {
    subjectType: record.subjectType,
    subjectId: readRequiredStringField(record, "subjectId"),
    score: readFiniteField(record, "score"),
    tier: record.tier,
    source: record.source,
    updatedAt: readRequiredStringField(record, "updatedAt"),
    signals: {
      paidOrders: readFiniteField(signals, "paidOrders"),
      gatewayLeasesIssued: readFiniteField(signals, "gatewayLeasesIssued"),
      pendingChainGrants: readFiniteField(signals, "pendingChainGrants"),
      refunds: readFiniteField(signals, "refunds"),
      severeRefunds: readFiniteField(signals, "severeRefunds"),
      ...(reviewCount !== undefined ? { reviewCount } : {}),
      ...(averageRating !== undefined ? { averageRating } : {}),
      ...(platformRating !== undefined ? { platformRating } : {}),
      ...(capabilityMismatchReports !== undefined ? { capabilityMismatchReports } : {}),
      ...(safetyIncidentReports !== undefined ? { safetyIncidentReports } : {}),
      ...(developerTrustScore !== undefined ? { developerTrustScore } : {})
    }
  };
}

function parseUsageReviewResponse(payload: unknown): PlatformUsageReviewResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error("Usage review response must be an object.");
  }
  const record = payload as Record<string, unknown>;
  return {
    review: parseUsageReviewRecord(record.review),
    summary: parseUsageReviewSummary(record.summary),
    reputation: parseReputation(record.reputation)
  };
}

function parseUsageReviewRecord(payload: unknown): PlatformUsageReviewRecord {
  if (!payload || typeof payload !== "object") {
    throw new Error("Usage review must be an object.");
  }
  const record = payload as Record<string, unknown>;
  return {
    reviewId: readRequiredStringField(record, "reviewId"),
    orderId: readRequiredStringField(record, "orderId"),
    userId: readRequiredStringField(record, "userId"),
    agentId: readRequiredStringField(record, "agentId"),
    overallRating: readFiniteField(record, "overallRating"),
    dimensionRatings: parseUsageReviewDimensionRatings(record.dimensionRatings),
    ...(typeof record.capabilityMatched === "boolean" ? { capabilityMatched: record.capabilityMatched } : {}),
    ...(typeof record.safetyIncidentReported === "boolean"
      ? { safetyIncidentReported: record.safetyIncidentReported }
      : {}),
    ...(readOptionalString(record, "commentText") ? { commentText: readOptionalString(record, "commentText") } : {}),
    commentHash: readRequiredStringField(record, "commentHash"),
    createdAt: readRequiredStringField(record, "createdAt")
  };
}

function parseUsageReviewSummary(payload: unknown): PlatformUsageReviewSummary {
  if (!payload || typeof payload !== "object") {
    throw new Error("Usage review summary must be an object.");
  }
  const record = payload as Record<string, unknown>;
  return {
    agentId: readRequiredStringField(record, "agentId"),
    reviewCount: readFiniteField(record, "reviewCount"),
    averageRating: record.averageRating === null ? null : readFiniteField(record, "averageRating"),
    platformRating: record.platformRating === null ? null : readFiniteField(record, "platformRating"),
    capabilityMismatchReports: readFiniteField(record, "capabilityMismatchReports"),
    safetyIncidentReports: readFiniteField(record, "safetyIncidentReports")
  };
}

function parseUsageReviewDimensionRatings(payload: unknown): PlatformUsageReviewDimensionRatings {
  if (!payload || typeof payload !== "object") {
    throw new Error("Usage review dimension ratings must be an object.");
  }
  const record = payload as Record<string, unknown>;
  return {
    security: readDimensionRating(record, "security"),
    taskExecution: readDimensionRating(record, "taskExecution"),
    cognitive: readDimensionRating(record, "cognitive"),
    environment: readDimensionRating(record, "environment"),
    engineering: readDimensionRating(record, "engineering"),
    compliance: readDimensionRating(record, "compliance")
  };
}

function parseRefundCase(payload: unknown): PlatformRefundCase {
  if (!payload || typeof payload !== "object") {
    throw new Error("Refund case must be an object.");
  }
  const record = payload as Record<string, unknown>;
  const category = record.category;
  const status = record.status;
  const eligibility = record.eligibility;
  if (
    category !== "security_incident" &&
    category !== "access_delivery_failure" &&
    category !== "core_capability_failure" &&
    category !== "agent_unavailable" &&
    category !== "design_mismatch" &&
    category !== "user_setup_issue" &&
    category !== "subjective_quality"
  ) {
    throw new Error("Refund category is invalid.");
  }
  if (
    status !== "requested" &&
    status !== "under_review" &&
    status !== "approved" &&
    status !== "rejected" &&
    status !== "partial_refund"
  ) {
    throw new Error("Refund status is invalid.");
  }
  if (eligibility !== "refundable" && eligibility !== "review_required" && eligibility !== "not_refundable") {
    throw new Error("Refund eligibility is invalid.");
  }
  return {
    refundId: readRequiredStringField(record, "refundId"),
    orderId: readRequiredStringField(record, "orderId"),
    userId: readRequiredStringField(record, "userId"),
    agentId: readRequiredStringField(record, "agentId"),
    category,
    status,
    eligibility,
    requestedAt: readRequiredStringField(record, "requestedAt"),
    updatedAt: readRequiredStringField(record, "updatedAt"),
    ...(readOptionalString(record, "reviewerId") ? { reviewerId: readOptionalString(record, "reviewerId") } : {}),
    ...(readOptionalString(record, "reviewNote") ? { reviewNote: readOptionalString(record, "reviewNote") } : {}),
    ...(readOptionalString(record, "resolvedAt") ? { resolvedAt: readOptionalString(record, "resolvedAt") } : {}),
    ...(readOptionalString(record, "refundAmount") ? { refundAmount: readOptionalString(record, "refundAmount") } : {})
  };
}

function parseAccessBridge(payload: unknown): PlatformAccessBridge {
  if (!payload || typeof payload !== "object") {
    throw new Error("Access bridge must be an object.");
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.bridgeId !== "string" || record.bridgeId.trim().length === 0) {
    throw new Error("Access bridge id is required.");
  }
  if (typeof record.orderId !== "string" || record.orderId.trim().length === 0) {
    throw new Error("Access bridge orderId is required.");
  }
  if (record.status !== "pending_chain_grant" && record.status !== "failed") {
    throw new Error("Access bridge status is invalid.");
  }
  if (record.expectedGrantFunction !== "grantRentalAccess") {
    throw new Error("Access bridge expected grant function is invalid.");
  }
  if (typeof record.gatewayLeaseToken !== "string" || record.gatewayLeaseToken.trim().length === 0) {
    throw new Error("Access bridge Gateway lease token is required.");
  }
  if (typeof record.gatewayLeaseIssuedAt !== "string" || record.gatewayLeaseIssuedAt.trim().length === 0) {
    throw new Error("Access bridge Gateway lease issued timestamp is required.");
  }
  if (typeof record.gatewayLeaseExpiresAt !== "string" || record.gatewayLeaseExpiresAt.trim().length === 0) {
    throw new Error("Access bridge Gateway lease expiry timestamp is required.");
  }

  return {
    bridgeId: record.bridgeId.trim(),
    orderId: record.orderId.trim(),
    status: record.status,
    expectedGrantFunction: record.expectedGrantFunction,
    gatewayLeaseToken: record.gatewayLeaseToken.trim(),
    gatewayLeaseIssuedAt: record.gatewayLeaseIssuedAt.trim(),
    gatewayLeaseExpiresAt: record.gatewayLeaseExpiresAt.trim()
  };
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Platform ${key} must be a string.`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readRequiredStringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Platform ${key} must be a non-empty string.`);
  }
  return value.trim();
}

function readFiniteField(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Platform ${key} must be a number.`);
  }
  return value;
}

function readOptionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Platform ${key} must be a number.`);
  }
  return value;
}

function readOptionalNullableNumber(record: Record<string, unknown>, key: string): number | null | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Platform ${key} must be a number.`);
  }
  return value;
}

function readDimensionRating(record: Record<string, unknown>, key: PlatformUsageReviewDimension): 0 | 1 | 2 {
  const value = record[key];
  if (value !== 0 && value !== 1 && value !== 2) {
    throw new Error(`Platform usage review ${key} must be 0, 1, or 2.`);
  }
  return value;
}

function parsePlatformAdminInspect(payload: unknown): PlatformAdminInspect {
  if (!payload || typeof payload !== "object") {
    throw new Error("Platform admin inspect response must be an object.");
  }
  const snapshot = (payload as Record<string, unknown>).snapshot;
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("Platform admin inspect response must include a snapshot.");
  }
  const record = snapshot as Record<string, unknown>;
  return {
    snapshot: {
      users: readFiniteNumber(record, "users"),
      creditAccounts: readFiniteNumber(record, "creditAccounts"),
      orders: readFiniteNumber(record, "orders"),
      accessBridges: readFiniteNumber(record, "accessBridges"),
      refunds: readFiniteNumber(record, "refunds"),
      paymentCallbacks: readFiniteNumber(record, "paymentCallbacks"),
      developerProfiles: readFiniteNumber(record, "developerProfiles"),
      settlements: readFiniteNumber(record, "settlements")
    }
  };
}

function parsePlatformUser(payload: unknown): PlatformUser {
  if (!payload || typeof payload !== "object") {
    throw new Error("Platform user must be an object.");
  }
  const record = payload as Record<string, unknown>;
  const identity = record.identity as Record<string, unknown> | undefined;
  if (typeof record.platformUserId !== "string" || record.platformUserId.trim().length === 0) {
    throw new Error("Platform user id is required.");
  }
  if (typeof record.walletAddress !== "string" || record.walletAddress.trim().length === 0) {
    throw new Error("Platform wallet address is required.");
  }
  if (typeof record.identityWeight !== "number" || !Number.isFinite(record.identityWeight)) {
    throw new Error("Platform identity weight must be a number.");
  }
  if (typeof record.custodyMode !== "string") {
    throw new Error("Platform custody mode is required.");
  }
  if (!identity || identity.provider !== "google" || typeof identity.email !== "string") {
    throw new Error("Platform user Google identity is required.");
  }

  return {
    platformUserId: record.platformUserId.trim(),
    walletAddress: record.walletAddress.trim(),
    identityWeight: record.identityWeight,
    custodyMode: record.custodyMode,
    identity: {
      provider: "google",
      email: identity.email
    }
  };
}

function readFiniteNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Platform admin inspect ${key} must be a number.`);
  }
  return value;
}

function parseCreditAccount(payload: unknown): PlatformCreditAccount {
  if (!payload || typeof payload !== "object") {
    throw new Error("Platform credit account must be an object.");
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.userId !== "string" || record.userId.trim().length === 0) {
    throw new Error("Platform credit account userId is required.");
  }
  if (typeof record.balance !== "number" || !Number.isFinite(record.balance)) {
    throw new Error("Platform credit account balance must be a number.");
  }
  if (typeof record.updatedAt !== "string") {
    throw new Error("Platform credit account updatedAt is required.");
  }

  return {
    userId: record.userId.trim(),
    balance: record.balance,
    updatedAt: record.updatedAt
  };
}
