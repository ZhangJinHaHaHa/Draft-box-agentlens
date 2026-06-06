import assert from "node:assert/strict";
import test from "node:test";

import { defaultRecommendationCatalog } from "../../src/recommendation/defaultRecommendationCatalog";
import { createMockRecommendationLlmClient } from "../../src/recommendation/recommendationLlmClient";
import {
  handlePlatformApiRequest,
  type PlatformApiRecommendationDependencies
} from "../../src/platform/platformApiServer";
import { InMemoryPlatformApiStore } from "../../src/platform/platformApiStore";

class MockRequest implements AsyncIterable<Buffer> {
  constructor(
    public method: string,
    public url: string,
    private body: unknown = undefined
  ) {}

  async *[Symbol.asyncIterator](): AsyncIterator<Buffer> {
    if (this.body !== undefined) {
      yield Buffer.from(JSON.stringify(this.body));
    }
  }
}

class MockResponse {
  statusCode = 0;
  headers = new Map<string, string>();
  body = "";

  setHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }

  end(body: string): void {
    this.body = body;
  }
}

async function callApi(
  store: InMemoryPlatformApiStore,
  method: string,
  url: string,
  body?: unknown,
  recommendationDependencies?: PlatformApiRecommendationDependencies
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const response = new MockResponse();
  await handlePlatformApiRequest(
    new MockRequest(method, url, body),
    response,
    store,
    recommendationDependencies
  );
  return {
    statusCode: response.statusCode,
    body: JSON.parse(response.body)
  };
}

async function createGoogleUser(store: InMemoryPlatformApiStore): Promise<Record<string, unknown>> {
  const response = await callApi(store, "POST", "/api/web2/google/mock", {
    googleSubject: "google-sub-1",
    email: "user@example.com"
  });
  assert.equal(response.statusCode, 201);
  return response.body.user as Record<string, unknown>;
}

async function createPaidOrder(store: InMemoryPlatformApiStore): Promise<Record<string, unknown>> {
  const user = await createGoogleUser(store);
  const orderResponse = await callApi(store, "POST", "/api/orders", {
    userId: user.platformUserId,
    agentId: "dify",
    amount: "20.00",
    currency: "CREDITS"
  });
  assert.equal(orderResponse.statusCode, 201);

  const order = orderResponse.body.order as Record<string, unknown>;
  const paidResponse = await callApi(store, "POST", `/api/orders/${order.orderId}/mark-paid`);
  assert.equal(paidResponse.statusCode, 200);
  return paidResponse.body.order as Record<string, unknown>;
}

test("platform API returns health snapshot", async () => {
  const store = new InMemoryPlatformApiStore(() => "2026-06-05T00:00:00.000Z");
  const response = await callApi(store, "GET", "/health");

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "ok");
  assert.equal(response.body.users, 0);
  assert.equal(response.body.creditAccounts, 0);
});

test("platform API creates a Google-backed exportable wallet", async () => {
  const store = new InMemoryPlatformApiStore(() => "2026-06-05T00:00:00.000Z");
  const response = await callApi(store, "POST", "/api/web2/google/mock", {
    googleSubject: "google-sub-1",
    email: "user@example.com"
  });
  const user = response.body.user as Record<string, unknown>;
  const creditAccount = response.body.creditAccount as Record<string, unknown>;

  assert.match(user.platformUserId as string, /^web2-user-[0-9a-f]{12}$/);
  assert.match(user.walletAddress as string, /^0x[0-9a-f]{40}$/);
  assert.equal(user.custodyMode, "backend_custodied_exportable");
  assert.equal(user.exportStatus, "not_requested");
  assert.equal(user.identityWeight, 10);
  assert.equal(creditAccount.balance, 100);
});

test("platform API creates order, issues Gateway lease, and queues pending chain grant after payment", async () => {
  const store = new InMemoryPlatformApiStore(() => "2026-06-05T00:00:00.000Z");
  const user = await createGoogleUser(store);
  const orderResponse = await callApi(store, "POST", "/api/orders", {
    userId: user.platformUserId,
    agentId: "dify",
    amount: "20.00"
  });

  assert.equal(orderResponse.statusCode, 201);
  const order = orderResponse.body.order as Record<string, unknown>;
  assert.equal(order.status, "pending");

  const paidResponse = await callApi(store, "POST", `/api/orders/${order.orderId}/mark-paid`);
  const paidOrder = paidResponse.body.order as Record<string, unknown>;
  const bridge = paidResponse.body.bridge as Record<string, unknown>;

  assert.equal(paidResponse.statusCode, 200);
  assert.equal(paidOrder.status, "gateway_lease_issued");
  assert.equal(paidOrder.chainGrantStatus, "pending_chain_grant");
  assert.match(paidOrder.gatewayLeaseToken as string, /^gateway-lease-[0-9a-f]{32}$/);
  assert.equal(bridge.status, "pending_chain_grant");
  assert.equal(bridge.expectedGrantFunction, "grantRentalAccess");
  assert.equal(bridge.orderId, order.orderId);
  assert.equal(bridge.userWalletAddress, user.walletAddress);
});

test("platform API mock payment callback is idempotent", async () => {
  const store = new InMemoryPlatformApiStore(() => "2026-06-05T00:00:00.000Z");
  const user = await createGoogleUser(store);
  const orderResponse = await callApi(store, "POST", "/api/orders", {
    userId: user.platformUserId,
    agentId: "dify",
    amount: "20.00"
  });
  const order = orderResponse.body.order as Record<string, unknown>;
  const callbackBody = {
    orderId: order.orderId,
    paymentProvider: "stripe-mock",
    providerPaymentId: "pay-1",
    idempotencyKey: "idem-1",
    paidAmount: "20.00"
  };

  const firstResponse = await callApi(store, "POST", "/api/payments/mock-callback", callbackBody);
  const replayResponse = await callApi(store, "POST", "/api/payments/mock-callback", callbackBody);

  const firstBridge = firstResponse.body.bridge as Record<string, unknown>;
  const replayBridge = replayResponse.body.bridge as Record<string, unknown>;

  assert.equal(firstResponse.statusCode, 200);
  assert.equal(replayResponse.statusCode, 200);
  assert.equal(firstResponse.body.idempotentReplay, false);
  assert.equal(replayResponse.body.idempotentReplay, true);
  assert.equal(firstBridge.bridgeId, replayBridge.bridgeId);
});

test("platform API mock payment callback rejects idempotency conflicts", async () => {
  const store = new InMemoryPlatformApiStore(() => "2026-06-05T00:00:00.000Z");
  const user = await createGoogleUser(store);
  const orderResponse = await callApi(store, "POST", "/api/orders", {
    userId: user.platformUserId,
    agentId: "dify",
    amount: "20.00"
  });
  const order = orderResponse.body.order as Record<string, unknown>;

  await callApi(store, "POST", "/api/payments/mock-callback", {
    orderId: order.orderId,
    paymentProvider: "stripe-mock",
    providerPaymentId: "pay-1",
    idempotencyKey: "idem-1",
    paidAmount: "20.00"
  });

  const conflictResponse = await callApi(store, "POST", "/api/payments/mock-callback", {
    orderId: order.orderId,
    paymentProvider: "stripe-mock",
    providerPaymentId: "pay-2",
    idempotencyKey: "idem-1",
    paidAmount: "20.00"
  });

  assert.equal(conflictResponse.statusCode, 409);
  assert.match(conflictResponse.body.error as string, /conflicts/);
});

test("platform API supports severe incident refund approval", async () => {
  const store = new InMemoryPlatformApiStore(() => "2026-06-05T00:00:00.000Z");
  const order = await createPaidOrder(store);

  const refundResponse = await callApi(store, "POST", "/api/refunds", {
    orderId: order.orderId,
    category: "security_incident"
  });
  assert.equal(refundResponse.statusCode, 201);
  const refund = refundResponse.body.refund as Record<string, unknown>;
  assert.equal(refund.eligibility, "refundable");

  const reviewResponse = await callApi(store, "POST", `/api/refunds/${refund.refundId}/review`, {
    reviewerId: "ops-1"
  });
  assert.equal((reviewResponse.body.refund as Record<string, unknown>).status, "under_review");

  const resolveResponse = await callApi(store, "POST", `/api/refunds/${refund.refundId}/resolve`, {
    outcome: "approved",
    reviewNote: "Confirmed security incident.",
    refundAmount: "20.00"
  });
  const orderResponse = await callApi(store, "GET", `/api/orders/${order.orderId}`);

  assert.equal(resolveResponse.statusCode, 200);
  assert.equal((resolveResponse.body.refund as Record<string, unknown>).status, "approved");
  assert.equal((orderResponse.body.order as Record<string, unknown>).status, "refunded");
});

test("platform API keeps design mismatch as non-refundable review path", async () => {
  const store = new InMemoryPlatformApiStore(() => "2026-06-05T00:00:00.000Z");
  const order = await createPaidOrder(store);

  const refundResponse = await callApi(store, "POST", "/api/refunds", {
    orderId: order.orderId,
    category: "design_mismatch"
  });
  const refund = refundResponse.body.refund as Record<string, unknown>;
  assert.equal(refund.eligibility, "not_refundable");

  await callApi(store, "POST", `/api/refunds/${refund.refundId}/review`, {
    reviewerId: "ops-1"
  });
  const resolveResponse = await callApi(store, "POST", `/api/refunds/${refund.refundId}/resolve`, {
    outcome: "rejected",
    reviewNote: "The purchased agent works as described; request is a design mismatch.",
    operatorReviewFinding: "The requested workflow is outside the published agent design."
  });

  assert.equal(resolveResponse.statusCode, 200);
  assert.equal((resolveResponse.body.refund as Record<string, unknown>).status, "rejected");
});

test("platform API keeps chain grant pending until grantRentalAccess bridge is available", async () => {
  const store = new InMemoryPlatformApiStore(() => "2026-06-05T00:00:00.000Z");
  const order = await createPaidOrder(store);
  const orderResponse = await callApi(store, "GET", `/api/orders/${order.orderId}`);
  const bridge = orderResponse.body.accessBridge as Record<string, unknown>;

  const submitted = await callApi(store, "POST", `/api/access-bridges/${bridge.bridgeId}/submit`);
  const retried = await callApi(store, "POST", `/api/access-bridges/${bridge.bridgeId}/retry`);
  const confirmed = await callApi(store, "POST", `/api/access-bridges/${bridge.bridgeId}/confirm`);
  const failed = await callApi(store, "POST", `/api/access-bridges/${bridge.bridgeId}/fail`, {
    failureReason: "grantRentalAccess bridge unavailable"
  });

  assert.equal(bridge.status, "pending_chain_grant");
  assert.equal(submitted.statusCode, 501);
  assert.match(submitted.body.error as string, /grantRentalAccess/);
  assert.equal(retried.statusCode, 501);
  assert.match(retried.body.error as string, /grantRentalAccess/);
  assert.equal(confirmed.statusCode, 501);
  assert.match(confirmed.body.error as string, /grantRentalAccess/);
  assert.equal((failed.body.accessBridge as Record<string, unknown>).status, "failed");
});

test("platform API accepts one usage review after Gateway lease is issued", async () => {
  const store = new InMemoryPlatformApiStore(() => "2026-06-05T00:00:00.000Z");
  const user = await createGoogleUser(store);
  const orderResponse = await callApi(store, "POST", "/api/orders", {
    userId: user.platformUserId,
    agentId: "dify",
    amount: "20.00",
    currency: "CREDITS"
  });
  const pendingOrder = orderResponse.body.order as Record<string, unknown>;
  const prematureReview = await callApi(store, "POST", "/api/reviews", {
    orderId: pendingOrder.orderId,
    userId: user.platformUserId,
    overallRating: 5
  });

  const paidResponse = await callApi(store, "POST", `/api/orders/${pendingOrder.orderId}/mark-paid`);
  const order = paidResponse.body.order as Record<string, unknown>;
  const reviewResponse = await callApi(store, "POST", "/api/reviews", {
    orderId: order.orderId,
    userId: user.platformUserId,
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
    commentText: "Matched the promised RAG workflow in the demo."
  });
  const duplicateReview = await callApi(store, "POST", "/api/reviews", {
    orderId: order.orderId,
    userId: user.platformUserId,
    overallRating: 4
  });
  const summaryResponse = await callApi(store, "GET", "/api/reviews/agents/dify/summary");
  const orderReviewResponse = await callApi(store, "GET", `/api/reviews/orders/${order.orderId}`);
  const reputationResponse = await callApi(store, "GET", "/api/reputation/agents/dify");

  const review = reviewResponse.body.review as Record<string, unknown>;
  const summary = summaryResponse.body.summary as Record<string, unknown>;
  const reputation = reputationResponse.body.reputation as Record<string, unknown>;
  const reputationSignals = reputation.signals as Record<string, unknown>;

  assert.equal(prematureReview.statusCode, 400);
  assert.match(prematureReview.body.error as string, /Gateway lease/);
  assert.equal(order.status, "gateway_lease_issued");
  assert.equal(reviewResponse.statusCode, 201);
  assert.match(review.commentHash as string, /^0x[0-9a-f]{64}$/);
  assert.equal(summary.reviewCount, 1);
  assert.equal(summary.averageRating, 5);
  assert.equal(summary.platformRating, 100);
  assert.equal((summary.dimensionGoodRatios as Record<string, unknown>).security, 1);
  assert.equal((orderReviewResponse.body.review as Record<string, unknown>).reviewId, review.reviewId);
  assert.equal(reputationSignals.reviewCount, 1);
  assert.equal(reputationSignals.platformRating, 100);
  assert.equal(reputationSignals.gatewayLeasesIssued, 1);
  assert.equal(reputationSignals.pendingChainGrants, 1);
  assert.equal(duplicateReview.statusCode, 409);
});

test("platform API recommendation catalog uses local review and reputation signals", async () => {
  const store = new InMemoryPlatformApiStore(() => "2026-06-05T00:00:00.000Z");
  const order = await createPaidOrder(store);
  await callApi(store, "POST", "/api/reviews", {
    orderId: order.orderId,
    userId: order.userId,
    overallRating: 5,
    capabilityMatched: true
  });

  let capturedDifySignals:
    | {
        platformRating?: number;
        paidOrders?: number;
        gatewayLeaseIssuedRate?: number;
      }
    | undefined;
  const response = await callApi(
    store,
    "POST",
    "/api/recommendations/llm",
    {
      userId: order.userId,
      query: "自托管 RAG 知识库 API",
      limit: 2
    },
    {
      catalog: defaultRecommendationCatalog,
      costCredits: 3,
      llmClient: {
        engine: "mock-llm",
        async recommend(input) {
          capturedDifySignals = input.catalog.find((entry) => entry.id === "dify")?.platformSignals;
          return input.baseline;
        }
      }
    }
  );

  assert.equal(response.statusCode, 200);
  assert.equal(capturedDifySignals?.platformRating, 100);
  assert.equal(capturedDifySignals?.paidOrders, 1);
  assert.equal(capturedDifySignals?.gatewayLeaseIssuedRate, 1);
});

test("platform API exposes wallet export and migration flows without private key material", async () => {
  const store = new InMemoryPlatformApiStore(() => "2026-06-05T00:00:00.000Z");
  const user = await createGoogleUser(store);

  const weakAuth = await callApi(store, "POST", `/api/web2/users/${user.platformUserId}/wallet/export/request`, {
    freshGoogleAuth: true,
    secondFactorVerified: false
  });
  const exportResponse = await callApi(store, "POST", `/api/web2/users/${user.platformUserId}/wallet/export/request`, {
    freshGoogleAuth: true,
    secondFactorVerified: true
  });
  const completeResponse = await callApi(store, "POST", `/api/web2/users/${user.platformUserId}/wallet/export/complete`);
  const migrateResponse = await callApi(store, "POST", `/api/web2/users/${user.platformUserId}/wallet/migrate`, {
    targetWalletAddress: "0x2222222222222222222222222222222222222222",
    ownershipProofVerified: true
  });

  assert.equal(weakAuth.statusCode, 400);
  assert.equal(exportResponse.statusCode, 200);
  assert.equal((exportResponse.body.user as Record<string, unknown>).exportStatus, "ready");
  assert.equal((exportResponse.body.exportReceipt as Record<string, unknown>).privateKeyMaterial, null);
  assert.equal((completeResponse.body.user as Record<string, unknown>).exportStatus, "completed");
  assert.equal((migrateResponse.body.user as Record<string, unknown>).custodyMode, "external_migrated");
  assert.equal((migrateResponse.body.user as Record<string, unknown>).walletAddress, "0x2222222222222222222222222222222222222222");
});

test("platform API requires evidence for core capability refund claims", async () => {
  const store = new InMemoryPlatformApiStore(() => "2026-06-05T00:00:00.000Z");
  const order = await createPaidOrder(store);

  const missingEvidence = await callApi(store, "POST", "/api/refunds", {
    orderId: order.orderId,
    category: "core_capability_failure"
  });
  const withEvidence = await callApi(store, "POST", "/api/refunds", {
    orderId: order.orderId,
    category: "core_capability_failure",
    expectedCapability: "Agent claims it can ingest internal docs.",
    actualFailure: "It repeatedly fails before indexing the first document.",
    agentClaim: "Self-hosted RAG setup."
  });

  assert.equal(missingEvidence.statusCode, 400);
  assert.match(missingEvidence.body.error as string, /expectedCapability and actualFailure/);
  assert.equal(withEvidence.statusCode, 201);
  assert.equal((withEvidence.body.refund as Record<string, unknown>).eligibility, "review_required");
});

test("platform API links developers, creates settlement entries and exposes local reputation", async () => {
  const store = new InMemoryPlatformApiStore(() => "2026-06-05T00:00:00.000Z");
  const developerResponse = await callApi(store, "POST", "/api/developers", {
    displayName: "Dify Labs",
    walletAddress: "0x3333333333333333333333333333333333333333",
    supportContact: "support@example.com",
    trustStatus: "verified",
    trustScore: 82
  });
  const developer = developerResponse.body.developer as Record<string, unknown>;
  await callApi(store, "POST", `/api/developers/${developer.developerId}/agents`, {
    agentId: "dify"
  });
  const user = await createGoogleUser(store);
  const orderResponse = await callApi(store, "POST", "/api/orders", {
    userId: user.platformUserId,
    agentId: "dify",
    amount: "20.00",
    currency: "CREDITS"
  });
  const order = orderResponse.body.order as Record<string, unknown>;
  const paid = await callApi(store, "POST", "/api/payments/mock-callback", {
    orderId: order.orderId,
    paymentProvider: "stripe-mock",
    providerPaymentId: "pay-1",
    idempotencyKey: "idem-1",
    paidAmount: "20.00"
  });
  assert.equal((paid.body.order as Record<string, unknown>).status, "gateway_lease_issued");

  const settlementResponse = await callApi(store, "GET", `/api/settlements/orders/${order.orderId}`);
  const summaryResponse = await callApi(store, "GET", `/api/settlements/developers/${developer.developerId}/summary`);
  const agentReputationResponse = await callApi(store, "GET", "/api/reputation/agents/dify");
  const adminResponse = await callApi(store, "GET", "/api/admin/inspect");

  const settlement = settlementResponse.body.settlement as Record<string, unknown>;
  const summary = summaryResponse.body.summary as Record<string, unknown>;
  const reputation = agentReputationResponse.body.reputation as Record<string, unknown>;
  const snapshot = adminResponse.body.snapshot as Record<string, unknown>;

  assert.equal(developerResponse.statusCode, 201);
  assert.equal(settlement.developerId, developer.developerId);
  assert.equal(settlement.platformFeeAmount, "4.00");
  assert.equal(settlement.developerShareAmount, "16.00");
  assert.equal(settlement.holdbackAmount, "1.60");
  assert.equal(summary.payableAmount, "14.40");
  assert.equal(reputation.source, "local-farr-adapter");
  assert.equal(snapshot.developerProfiles, 1);
  assert.equal(snapshot.settlements, 1);
});

test("platform API freezes settlement while a refund is under review", async () => {
  const store = new InMemoryPlatformApiStore(() => "2026-06-05T00:00:00.000Z");
  const developerResponse = await callApi(store, "POST", "/api/developers", {
    displayName: "Dify Labs",
    walletAddress: "0x3333333333333333333333333333333333333333"
  });
  const developer = developerResponse.body.developer as Record<string, unknown>;
  await callApi(store, "POST", `/api/developers/${developer.developerId}/agents`, {
    agentId: "dify"
  });
  const order = await createPaidOrder(store);
  const refundResponse = await callApi(store, "POST", "/api/refunds", {
    orderId: order.orderId,
    category: "security_incident"
  });
  const frozen = await callApi(store, "GET", `/api/settlements/orders/${order.orderId}`);

  await callApi(store, "POST", `/api/refunds/${(refundResponse.body.refund as Record<string, unknown>).refundId}/review`, {
    reviewerId: "ops-1"
  });
  await callApi(store, "POST", `/api/refunds/${(refundResponse.body.refund as Record<string, unknown>).refundId}/resolve`, {
    outcome: "approved",
    reviewNote: "Confirmed security incident.",
    refundAmount: "20.00"
  });
  const refunded = await callApi(store, "GET", `/api/settlements/orders/${order.orderId}`);

  assert.equal((frozen.body.settlement as Record<string, unknown>).status, "frozen");
  assert.equal((refunded.body.settlement as Record<string, unknown>).status, "refunded");
});

test("platform API rejects order creation for an unknown user", async () => {
  const store = new InMemoryPlatformApiStore(() => "2026-06-05T00:00:00.000Z");
  const response = await callApi(store, "POST", "/api/orders", {
    userId: "missing-user",
    agentId: "dify",
    amount: "20.00"
  });

  assert.equal(response.statusCode, 404);
  assert.match(response.body.error as string, /missing-user/);
});

test("platform API charges credits for mock LLM recommendations", async () => {
  const store = new InMemoryPlatformApiStore(() => "2026-06-05T00:00:00.000Z");
  const dependencies: PlatformApiRecommendationDependencies = {
    catalog: defaultRecommendationCatalog,
    llmClient: createMockRecommendationLlmClient(),
    costCredits: 3
  };
  const user = await createGoogleUser(store);

  const response = await callApi(
    store,
    "POST",
    "/api/recommendations/llm",
    {
      userId: user.platformUserId,
      query: "自托管 RAG 知识库 API",
      limit: 2
    },
    dependencies
  );

  const recommendation = response.body.recommendation as Record<string, unknown>;
  const creditAccount = response.body.creditAccount as Record<string, unknown>;

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.engine, "mock-llm");
  assert.equal(response.body.charged, true);
  assert.equal(creditAccount.balance, 97);
  assert.deepEqual(
    (recommendation.results as Array<{ agentId: string }>).map((result) => result.agentId),
    ["dify", "flowise"]
  );
});

test("platform API exposes fallback reason without charging credits when LLM fails", async () => {
  const store = new InMemoryPlatformApiStore(() => "2026-06-05T00:00:00.000Z");
  const dependencies: PlatformApiRecommendationDependencies = {
    catalog: defaultRecommendationCatalog,
    llmClient: {
      engine: "openai",
      async recommend() {
        throw new Error("synthetic LLM failure");
      }
    },
    costCredits: 3
  };
  const user = await createGoogleUser(store);

  const response = await callApi(
    store,
    "POST",
    "/api/recommendations/llm",
    {
      userId: user.platformUserId,
      query: "自托管 RAG 知识库 API",
      limit: 2
    },
    dependencies
  );

  const creditAccount = response.body.creditAccount as Record<string, unknown>;
  const recommendation = response.body.recommendation as Record<string, unknown>;

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.engine, "rules-fallback");
  assert.equal(response.body.charged, false);
  assert.equal(response.body.fallbackUsed, true);
  assert.match(response.body.fallbackReason as string, /synthetic LLM failure/);
  assert.equal(creditAccount.balance, 100);
  assert.ok((recommendation.results as unknown[]).length > 0);
});

test("platform API rejects LLM recommendations when credits are insufficient", async () => {
  const store = new InMemoryPlatformApiStore(() => "2026-06-05T00:00:00.000Z", 2);
  const dependencies: PlatformApiRecommendationDependencies = {
    catalog: defaultRecommendationCatalog,
    llmClient: createMockRecommendationLlmClient(),
    costCredits: 3
  };
  const user = await createGoogleUser(store);

  const response = await callApi(
    store,
    "POST",
    "/api/recommendations/llm",
    {
      userId: user.platformUserId,
      query: "自托管 RAG 知识库 API",
      limit: 2
    },
    dependencies
  );

  assert.equal(response.statusCode, 402);
  assert.match(response.body.error as string, /Insufficient platform credits/);
});
