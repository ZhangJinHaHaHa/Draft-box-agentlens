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

test("platform API creates order and auto-queues access bridge after paid", async () => {
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
  assert.equal(paidOrder.status, "paid");
  assert.equal(bridge.status, "queued");
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
    reviewNote: "The purchased agent works as described; request is a design mismatch."
  });

  assert.equal(resolveResponse.statusCode, 200);
  assert.equal((resolveResponse.body.refund as Record<string, unknown>).status, "rejected");
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
