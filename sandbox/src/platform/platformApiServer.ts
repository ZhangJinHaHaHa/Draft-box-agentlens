import { createServer, type Server } from "node:http";

import { loadRecommendationCatalog } from "../recommendation/loadRecommendationCatalog";
import {
  createRecommendationLlmClient,
  type RecommendationEngine,
  type RecommendationLlmClient
} from "../recommendation/recommendationLlmClient";
import { parseRecommendationRequest } from "../recommendation/recommendationApiServer";
import { recommendFromCatalog } from "../recommendation/recommendationService";
import type {
  RecommendationCatalogEntry,
  RecommendationPlatformSignals,
  RecommendationResponse
} from "../recommendation/recommendationTypes";
import type { DeveloperTrustStatus } from "./developerProfile";
import type { PlatformOrderCurrency } from "./orderState";
import {
  InMemoryPlatformApiStore,
  PlatformApiError,
  type CreateGoogleMockUserInput
} from "./platformApiStore";
import { createPersistentPlatformApiStore } from "./persistentPlatformApiStore";
import type { PlatformApiConfig } from "./readPlatformApiConfig";
import type { RefundIssueCategory } from "./refundPolicy";
import {
  USAGE_REVIEW_DIMENSIONS,
  type UsageReviewDimensionRatings
} from "./usageReview";

interface PlatformRequestLike extends AsyncIterable<Buffer | string> {
  method?: string;
  url?: string;
}

interface PlatformResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

const REFUND_ISSUE_CATEGORIES = [
  "security_incident",
  "access_delivery_failure",
  "core_capability_failure",
  "agent_unavailable",
  "design_mismatch",
  "user_setup_issue",
  "subjective_quality"
] as const satisfies readonly RefundIssueCategory[];

const REFUND_OUTCOMES = ["approved", "rejected", "partial_refund"] as const;
const DEVELOPER_TRUST_STATUSES = ["unverified", "verified", "suspended"] as const satisfies readonly DeveloperTrustStatus[];

export interface PlatformApiRecommendationDependencies {
  catalog: readonly RecommendationCatalogEntry[];
  llmClient: RecommendationLlmClient;
  costCredits: number;
}

export function createPlatformApiServer(config: PlatformApiConfig): Server {
  const store = createPersistentPlatformApiStore({ stateDir: config.stateDir });
  const recommendationDependencies: PlatformApiRecommendationDependencies = {
    catalog: loadRecommendationCatalog(config.recommendationCatalogPath),
    llmClient: createRecommendationLlmClient(config.recommendationLlm),
    costCredits: config.recommendationCostCredits
  };

  return createServer((request, response) =>
    void handlePlatformApiRequest(request, response, store, recommendationDependencies)
  );
}

export async function handlePlatformApiRequest(
  request: PlatformRequestLike,
  response: PlatformResponseLike,
  store: InMemoryPlatformApiStore,
  recommendationDependencies?: PlatformApiRecommendationDependencies
): Promise<void> {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end("");
    return;
  }

  const url = new URL(request.url ?? "/", "http://agentlens.local");
  const parts = url.pathname.split("/").filter(Boolean);

  try {
    if (request.method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, {
        status: "ok",
        ...store.snapshot(),
        recommendationCostCredits: recommendationDependencies?.costCredits ?? null,
        recommendationEngine: recommendationDependencies?.llmClient.engine ?? null
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/inspect") {
      writeJson(response, 200, store.inspect());
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/web2/google/mock") {
      const payload = await readJsonObject(request);
      const input: CreateGoogleMockUserInput = {
        googleSubject: readRequiredString(payload, "googleSubject"),
        email: readRequiredString(payload, "email"),
        emailVerified: readOptionalBoolean(payload, "emailVerified") ?? true
      };
      const user = store.createGoogleMockUser(input);
      writeJson(response, 201, {
        user,
        creditAccount: store.getCreditAccount(user.platformUserId)
      });
      return;
    }

    if (request.method === "GET" && parts.length === 4 && parts.join("/") !== "" &&
      parts[0] === "api" && parts[1] === "web2" && parts[2] === "users") {
      writeJson(response, 200, {
        user: store.getUser(parts[3]),
        creditAccount: store.getCreditAccount(parts[3])
      });
      return;
    }

    if (
      request.method === "GET" &&
      parts.length === 5 &&
      parts[0] === "api" &&
      parts[1] === "web2" &&
      parts[2] === "users" &&
      parts[4] === "credits"
    ) {
      writeJson(response, 200, { creditAccount: store.getCreditAccount(parts[3]) });
      return;
    }

    if (
      request.method === "POST" &&
      parts.length === 7 &&
      parts[0] === "api" &&
      parts[1] === "web2" &&
      parts[2] === "users" &&
      parts[4] === "wallet" &&
      parts[5] === "export" &&
      parts[6] === "request"
    ) {
      const payload = await readJsonObject(request);
      writeJson(response, 200, store.requestUserWalletExport(parts[3], {
        freshGoogleAuth: readRequiredBoolean(payload, "freshGoogleAuth"),
        secondFactorVerified: readRequiredBoolean(payload, "secondFactorVerified")
      }));
      return;
    }

    if (
      request.method === "POST" &&
      parts.length === 7 &&
      parts[0] === "api" &&
      parts[1] === "web2" &&
      parts[2] === "users" &&
      parts[4] === "wallet" &&
      parts[5] === "export" &&
      parts[6] === "complete"
    ) {
      writeJson(response, 200, { user: store.completeUserWalletExport(parts[3]) });
      return;
    }

    if (
      request.method === "POST" &&
      parts.length === 7 &&
      parts[0] === "api" &&
      parts[1] === "web2" &&
      parts[2] === "users" &&
      parts[4] === "wallet" &&
      parts[5] === "export" &&
      parts[6] === "cancel"
    ) {
      writeJson(response, 200, { user: store.cancelUserWalletExport(parts[3]) });
      return;
    }

    if (
      request.method === "POST" &&
      parts.length === 6 &&
      parts[0] === "api" &&
      parts[1] === "web2" &&
      parts[2] === "users" &&
      parts[4] === "wallet" &&
      parts[5] === "migrate"
    ) {
      const payload = await readJsonObject(request);
      writeJson(response, 200, {
        user: store.migrateUserWallet(parts[3], {
          targetWalletAddress: readRequiredString(payload, "targetWalletAddress"),
          ownershipProofVerified: readRequiredBoolean(payload, "ownershipProofVerified")
        })
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/recommendations/llm") {
      if (!recommendationDependencies) {
        throw new PlatformApiError(500, "Recommendation dependencies are not configured.");
      }
      const payload = await readJsonObject(request);
      const userId = readRequiredString(payload, "userId");
      const recommendation = await createChargedLlmRecommendation(
        store,
        recommendationDependencies,
        userId,
        payload
      );
      writeJson(response, 200, recommendation);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/orders") {
      const payload = await readJsonObject(request);
      const order = store.createOrder({
        userId: readRequiredString(payload, "userId"),
        agentId: readRequiredString(payload, "agentId"),
        amount: readRequiredAmount(payload, "amount"),
        currency: readOptionalCurrency(payload, "currency")
      });
      writeJson(response, 201, { order });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/payments/mock-callback") {
      const payload = await readJsonObject(request);
      writeJson(response, 200, store.applyMockPaymentCallback({
        orderId: readRequiredString(payload, "orderId"),
        paymentProvider: readRequiredString(payload, "paymentProvider"),
        providerPaymentId: readRequiredString(payload, "providerPaymentId"),
        idempotencyKey: readRequiredString(payload, "idempotencyKey"),
        paidAmount: readRequiredAmount(payload, "paidAmount")
      }));
      return;
    }

    if (request.method === "GET" && parts.length === 3 && parts[0] === "api" && parts[1] === "orders") {
      const order = store.getOrder(parts[2]);
      writeJson(response, 200, {
        order,
        accessBridge: store.getAccessBridgeForOrder(order.orderId) ?? null
      });
      return;
    }

    if (request.method === "GET" && parts.length === 3 && parts[0] === "api" && parts[1] === "access-bridges") {
      writeJson(response, 200, { accessBridge: store.getAccessBridge(parts[2]) });
      return;
    }

    if (
      request.method === "POST" &&
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "access-bridges" &&
      parts[3] === "submit"
    ) {
      const payload = await readJsonObject(request);
      writeJson(response, 200, {
        accessBridge: store.submitAccessBridge(parts[2], {
          chainAccessTxHash: readOptionalString(payload, "chainAccessTxHash")
        })
      });
      return;
    }

    if (
      request.method === "POST" &&
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "access-bridges" &&
      parts[3] === "retry"
    ) {
      const payload = await readJsonObject(request);
      writeJson(response, 200, {
        accessBridge: store.submitAccessBridge(parts[2], {
          chainAccessTxHash: readOptionalString(payload, "chainAccessTxHash")
        })
      });
      return;
    }

    if (
      request.method === "POST" &&
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "access-bridges" &&
      parts[3] === "confirm"
    ) {
      writeJson(response, 200, { accessBridge: store.confirmAccessBridge(parts[2]) });
      return;
    }

    if (
      request.method === "POST" &&
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "access-bridges" &&
      parts[3] === "fail"
    ) {
      const payload = await readJsonObject(request);
      writeJson(response, 200, {
        accessBridge: store.failAccessBridge(parts[2], readRequiredString(payload, "failureReason"))
      });
      return;
    }

    if (
      request.method === "POST" &&
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "orders" &&
      parts[3] === "mark-paid"
    ) {
      writeJson(response, 200, store.markOrderPaid(parts[2]));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/refunds") {
      const payload = await readJsonObject(request);
      const refund = store.createRefund({
        orderId: readRequiredString(payload, "orderId"),
        category: readRefundIssueCategory(payload.category),
        evidence: {
          expectedCapability: readOptionalString(payload, "expectedCapability"),
          actualFailure: readOptionalString(payload, "actualFailure"),
          agentClaim: readOptionalString(payload, "agentClaim"),
          userProvidedEvidenceUrl: readOptionalString(payload, "userProvidedEvidenceUrl")
        }
      });
      writeJson(response, 201, { refund });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/reviews") {
      const payload = await readJsonObject(request);
      const review = store.submitUsageReview({
        orderId: readRequiredString(payload, "orderId"),
        userId: readRequiredString(payload, "userId"),
        overallRating: readOverallRating(payload, "overallRating"),
        dimensionRatings: readOptionalUsageReviewDimensionRatings(payload, "dimensionRatings"),
        capabilityMatched: readOptionalBoolean(payload, "capabilityMatched"),
        safetyIncidentReported: readOptionalBoolean(payload, "safetyIncidentReported"),
        commentText: readOptionalString(payload, "commentText"),
        evidenceUrl: readOptionalString(payload, "evidenceUrl")
      });
      writeJson(response, 201, {
        review,
        summary: store.getAgentUsageReviewSummary(review.agentId),
        reputation: store.getAgentReputation(review.agentId)
      });
      return;
    }

    if (request.method === "GET" && parts.length === 3 && parts[0] === "api" && parts[1] === "reviews") {
      writeJson(response, 200, { review: store.getUsageReview(parts[2]) });
      return;
    }

    if (
      request.method === "GET" &&
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "reviews" &&
      parts[2] === "orders"
    ) {
      writeJson(response, 200, { review: store.getUsageReviewForOrder(parts[3]) });
      return;
    }

    if (
      request.method === "GET" &&
      parts.length === 5 &&
      parts[0] === "api" &&
      parts[1] === "reviews" &&
      parts[2] === "agents" &&
      parts[4] === "summary"
    ) {
      writeJson(response, 200, { summary: store.getAgentUsageReviewSummary(parts[3]) });
      return;
    }

    if (request.method === "GET" && parts.length === 3 && parts[0] === "api" && parts[1] === "refunds") {
      writeJson(response, 200, { refund: store.getRefund(parts[2]) });
      return;
    }

    if (
      request.method === "POST" &&
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "refunds" &&
      parts[3] === "review"
    ) {
      const payload = await readJsonObject(request);
      writeJson(response, 200, {
        refund: store.startRefundReview(parts[2], readRequiredString(payload, "reviewerId"))
      });
      return;
    }

    if (
      request.method === "POST" &&
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "refunds" &&
      parts[3] === "resolve"
    ) {
      const payload = await readJsonObject(request);
      writeJson(response, 200, {
        refund: store.resolveRefund(parts[2], readRefundOutcome(payload.outcome), {
          reviewNote: readRequiredString(payload, "reviewNote"),
          refundAmount: readOptionalString(payload, "refundAmount"),
          operatorReviewFinding: readOptionalString(payload, "operatorReviewFinding")
        })
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/developers") {
      const payload = await readJsonObject(request);
      writeJson(response, 201, {
        developer: store.createDeveloperProfile({
          displayName: readRequiredString(payload, "displayName"),
          walletAddress: readRequiredString(payload, "walletAddress"),
          websiteUrl: readOptionalString(payload, "websiteUrl"),
          supportContact: readOptionalString(payload, "supportContact"),
          trustStatus: readOptionalDeveloperTrustStatus(payload.trustStatus),
          trustScore: readOptionalNumber(payload, "trustScore")
        })
      });
      return;
    }

    if (request.method === "GET" && parts.length === 3 && parts[0] === "api" && parts[1] === "developers") {
      writeJson(response, 200, { developer: store.getDeveloperProfile(parts[2]) });
      return;
    }

    if (
      request.method === "POST" &&
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "developers" &&
      parts[3] === "agents"
    ) {
      const payload = await readJsonObject(request);
      writeJson(response, 201, {
        link: store.linkAgentToDeveloper(readRequiredString(payload, "agentId"), parts[2])
      });
      return;
    }

    if (
      request.method === "GET" &&
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "agents" &&
      parts[3] === "developer"
    ) {
      writeJson(response, 200, store.getDeveloperForAgent(parts[2]));
      return;
    }

    if (
      request.method === "GET" &&
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "settlements" &&
      parts[2] === "orders"
    ) {
      writeJson(response, 200, { settlement: store.getSettlementForOrder(parts[3]) });
      return;
    }

    if (
      request.method === "GET" &&
      parts.length === 5 &&
      parts[0] === "api" &&
      parts[1] === "settlements" &&
      parts[2] === "developers" &&
      parts[4] === "summary"
    ) {
      writeJson(response, 200, store.getDeveloperSettlementSummary(parts[3]));
      return;
    }

    if (
      request.method === "POST" &&
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "settlements" &&
      parts[3] === "release"
    ) {
      writeJson(response, 200, { settlement: store.releaseSettlement(parts[2]) });
      return;
    }

    if (
      request.method === "GET" &&
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "reputation" &&
      parts[2] === "agents"
    ) {
      writeJson(response, 200, { reputation: store.getAgentReputation(parts[3]) });
      return;
    }

    if (
      request.method === "GET" &&
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "reputation" &&
      parts[2] === "developers"
    ) {
      writeJson(response, 200, { reputation: store.getDeveloperReputation(parts[3]) });
      return;
    }

    writeJson(response, 404, { error: "not found" });
  } catch (error) {
    const statusCode = error instanceof PlatformApiError ? error.statusCode : 400;
    writeJson(response, statusCode, {
      error: error instanceof Error ? error.message : "Invalid platform API request."
    });
  }
}

async function createChargedLlmRecommendation(
  store: InMemoryPlatformApiStore,
  dependencies: PlatformApiRecommendationDependencies,
  userId: string,
  payload: Record<string, unknown>
): Promise<{
  engine: RecommendationEngine;
  charged: boolean;
  fallbackUsed: boolean;
  fallbackReason?: string;
  costCredits: number;
  creditAccount: ReturnType<InMemoryPlatformApiStore["getCreditAccount"]>;
  creditTransaction?: ReturnType<InMemoryPlatformApiStore["spendPlatformCredits"]>["transaction"];
  recommendation: RecommendationResponse;
}> {
  store.assertCreditsAvailable(userId, dependencies.costCredits);
  const recommendationRequest = parseRecommendationRequest(payload);
  const catalog = enrichRecommendationCatalogWithPlatformSignals(dependencies.catalog, store);
  const baseline = recommendFromCatalog(catalog, recommendationRequest);

  try {
    const recommendation = await dependencies.llmClient.recommend({
      catalog,
      request: recommendationRequest,
      baseline
    });
    const charge = store.spendPlatformCredits(userId, {
      amount: dependencies.costCredits,
      reason: "llm_recommendation"
    });

    return {
      engine: dependencies.llmClient.engine,
      charged: true,
      fallbackUsed: false,
      costCredits: dependencies.costCredits,
      creditAccount: charge.account,
      creditTransaction: charge.transaction,
      recommendation
    };
  } catch (error) {
    return {
      engine: "rules-fallback",
      charged: false,
      fallbackUsed: true,
      fallbackReason: formatRecommendationFallbackReason(error),
      costCredits: dependencies.costCredits,
      creditAccount: store.getCreditAccount(userId),
      recommendation: baseline
    };
  }
}

function enrichRecommendationCatalogWithPlatformSignals(
  catalog: readonly RecommendationCatalogEntry[],
  store: InMemoryPlatformApiStore
): RecommendationCatalogEntry[] {
  return catalog.map((entry) => {
    const reputation = store.getAgentReputation(entry.id);
    const reviewSummary = store.getAgentUsageReviewSummary(entry.id);
    const paidOrders = reputation.signals.paidOrders;
    const hasLocalSignals =
      paidOrders > 0 ||
      reputation.signals.confirmedAccessBridges > 0 ||
      reputation.signals.refunds > 0 ||
      reviewSummary.reviewCount > 0 ||
      reputation.signals.developerTrustScore !== undefined;
    if (!hasLocalSignals) {
      return entry;
    }

    const dynamicSignals: RecommendationPlatformSignals = {
      ...(reviewSummary.platformRating !== null ? { platformRating: reviewSummary.platformRating } : {}),
      reputationScore: reputation.score,
      ...(paidOrders > 0
        ? {
            paidOrders,
            refundRate: reputation.signals.refunds / paidOrders,
            accessBridgeSuccessRate: reputation.signals.confirmedAccessBridges / paidOrders
          }
        : {})
    };

    return {
      ...entry,
      platformSignals: {
        ...entry.platformSignals,
        ...dynamicSignals
      }
    };
  });
}

function formatRecommendationFallbackReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 300);
  }
  return "Recommendation LLM failed.";
}

async function readJsonObject(request: PlatformRequestLike): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  const parsed = rawBody.trim().length === 0 ? {} : JSON.parse(rawBody);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new PlatformApiError(400, "Request body must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function readRequiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PlatformApiError(400, `${key} is required.`);
  }
  return value.trim();
}

function readOptionalString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new PlatformApiError(400, `${key} must be a string.`);
  }
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function readOptionalBoolean(payload: Record<string, unknown>, key: string): boolean | undefined {
  const value = payload[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") {
    throw new PlatformApiError(400, `${key} must be a boolean.`);
  }
  return value;
}

function readRequiredBoolean(payload: Record<string, unknown>, key: string): boolean {
  const value = payload[key];
  if (typeof value !== "boolean") {
    throw new PlatformApiError(400, `${key} must be a boolean.`);
  }
  return value;
}

function readOptionalNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PlatformApiError(400, `${key} must be a number.`);
  }
  return value;
}

function readOverallRating(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
    throw new PlatformApiError(400, `${key} must be an integer from 1 to 5.`);
  }
  return value;
}

function readOptionalUsageReviewDimensionRatings(
  payload: Record<string, unknown>,
  key: string
): UsageReviewDimensionRatings | undefined {
  const value = payload[key];
  if (value === undefined || value === null) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PlatformApiError(400, `${key} must be a JSON object.`);
  }
  const record = value as Record<string, unknown>;
  const ratings: Partial<UsageReviewDimensionRatings> = {};
  for (const dimension of USAGE_REVIEW_DIMENSIONS) {
    const rating = record[dimension];
    if (rating !== 0 && rating !== 1 && rating !== 2) {
      throw new PlatformApiError(400, `${key}.${dimension} must be 0, 1, or 2.`);
    }
    ratings[dimension] = rating;
  }
  return ratings as UsageReviewDimensionRatings;
}

function readRequiredAmount(payload: Record<string, unknown>, key: string): string | number {
  const value = payload[key];
  if (typeof value !== "string" && typeof value !== "number") {
    throw new PlatformApiError(400, `${key} is required.`);
  }
  return value;
}

function readOptionalCurrency(
  payload: Record<string, unknown>,
  key: string
): PlatformOrderCurrency | undefined {
  const value = payload[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (value !== "USD" && value !== "CREDITS") {
    throw new PlatformApiError(400, `${key} must be USD or CREDITS.`);
  }
  return value;
}

function readRefundIssueCategory(value: unknown): RefundIssueCategory {
  if (
    typeof value !== "string" ||
    !REFUND_ISSUE_CATEGORIES.includes(value as RefundIssueCategory)
  ) {
    throw new PlatformApiError(
      400,
      `category must be one of: ${REFUND_ISSUE_CATEGORIES.join(", ")}.`
    );
  }
  return value as RefundIssueCategory;
}

function readRefundOutcome(value: unknown): "approved" | "rejected" | "partial_refund" {
  if (typeof value !== "string" || !REFUND_OUTCOMES.includes(value as typeof REFUND_OUTCOMES[number])) {
    throw new PlatformApiError(400, `outcome must be one of: ${REFUND_OUTCOMES.join(", ")}.`);
  }
  return value as "approved" | "rejected" | "partial_refund";
}

function readOptionalDeveloperTrustStatus(value: unknown): DeveloperTrustStatus | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !DEVELOPER_TRUST_STATUSES.includes(value as DeveloperTrustStatus)) {
    throw new PlatformApiError(400, `trustStatus must be one of: ${DEVELOPER_TRUST_STATUSES.join(", ")}.`);
  }
  return value as DeveloperTrustStatus;
}

function writeJson(response: PlatformResponseLike, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(`${JSON.stringify(body)}\n`);
}

function setCorsHeaders(response: PlatformResponseLike): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}
