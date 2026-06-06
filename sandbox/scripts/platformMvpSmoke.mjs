const api = process.env.PLATFORM_API_BASE_URL ?? "http://127.0.0.1:8790";
const runId = `${Date.now()}`;

async function get(path) {
  return request("GET", path);
}

async function post(path, body = {}) {
  return request("POST", path, body);
}

async function request(method, path, body) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const health = await get("/health");
assert(health.status === "ok", "Platform API health check failed.");

const { developer } = await post("/api/developers", {
  displayName: "Dify Labs Smoke",
  walletAddress: "0x3333333333333333333333333333333333333333",
  supportContact: "support@example.com",
  trustStatus: "verified",
  trustScore: 82
});
await post(`/api/developers/${developer.developerId}/agents`, {
  agentId: "dify"
});

const { user } = await post("/api/web2/google/mock", {
  googleSubject: `smoke-google-${runId}`,
  email: `smoke-${runId}@example.com`
});

const paidRecommendation = await post("/api/recommendations/llm", {
  userId: user.platformUserId,
  query: "self-hosted RAG knowledge base API",
  limit: 2
});
assert(paidRecommendation.charged === true, "Paid recommendation was not charged.");
assert(paidRecommendation.creditAccount.balance === 97, "Paid recommendation did not deduct 3 credits.");

const { order } = await post("/api/orders", {
  userId: user.platformUserId,
  agentId: "dify",
  amount: "20.00",
  currency: "CREDITS"
});
const paid = await post("/api/payments/mock-callback", {
  orderId: order.orderId,
  paymentProvider: "stripe-mock",
  providerPaymentId: `pay-smoke-${runId}`,
  idempotencyKey: `idem-smoke-${runId}`,
  paidAmount: "20.00"
});
const replay = await post("/api/payments/mock-callback", {
  orderId: order.orderId,
  paymentProvider: "stripe-mock",
  providerPaymentId: `pay-smoke-${runId}`,
  idempotencyKey: `idem-smoke-${runId}`,
  paidAmount: "20.00"
});
assert(replay.idempotentReplay === true, "Payment callback replay was not idempotent.");
assert(paid.bridge.bridgeId === replay.bridge.bridgeId, "Payment callback replay created a different bridge.");
assert(paid.order.status === "gateway_lease_issued", "Payment did not issue a Gateway lease.");
assert(paid.order.chainGrantStatus === "pending_chain_grant", "Order did not mark chain grant as pending.");
assert(paid.bridge.status === "pending_chain_grant", "Access bridge did not wait for chain grant.");
assert(paid.bridge.expectedGrantFunction === "grantRentalAccess", "Access bridge expects the wrong grant function.");

const exportReady = await post(`/api/web2/users/${user.platformUserId}/wallet/export/request`, {
  freshGoogleAuth: true,
  secondFactorVerified: true
});
assert(exportReady.exportReceipt.privateKeyMaterial === null, "Wallet export leaked private key material.");
await post(`/api/web2/users/${user.platformUserId}/wallet/export/complete`);
const migrated = await post(`/api/web2/users/${user.platformUserId}/wallet/migrate`, {
  targetWalletAddress: "0x2222222222222222222222222222222222222222",
  ownershipProofVerified: true
});
assert(migrated.user.custodyMode === "external_migrated", "Wallet migration did not move to external custody.");

const { order: refundOrder } = await post("/api/orders", {
  userId: user.platformUserId,
  agentId: "dify",
  amount: "12.00",
  currency: "CREDITS"
});
await post("/api/payments/mock-callback", {
  orderId: refundOrder.orderId,
  paymentProvider: "stripe-mock",
  providerPaymentId: `pay-refund-smoke-${runId}`,
  idempotencyKey: `idem-refund-smoke-${runId}`,
  paidAmount: "12.00"
});
const { refund } = await post("/api/refunds", {
  orderId: refundOrder.orderId,
  category: "core_capability_failure",
  expectedCapability: "Agent claims it can ingest internal documents.",
  actualFailure: "Ingestion fails before the first document is indexed.",
  agentClaim: "Self-hosted RAG setup."
});
await post(`/api/refunds/${refund.refundId}/review`, {
  reviewerId: "ops-1"
});
const resolvedRefund = await post(`/api/refunds/${refund.refundId}/resolve`, {
  outcome: "partial_refund",
  reviewNote: "Core capability failure reproduced with supplied evidence.",
  refundAmount: "6.00"
});
assert(resolvedRefund.refund.status === "partial_refund", "Refund evidence path did not resolve.");

const settlement = await get(`/api/settlements/orders/${order.orderId}`);
const summary = await get(`/api/settlements/developers/${developer.developerId}/summary`);
const reputation = await get("/api/reputation/agents/dify");
const inspect = await get("/api/admin/inspect");

assert(settlement.settlement.developerId === developer.developerId, "Settlement did not resolve developer.");
assert(summary.summary.entryCount >= 2, "Developer settlement summary is missing entries.");
assert(reputation.reputation.source === "local-farr-adapter", "Reputation source is not the local adapter.");
assert(inspect.snapshot.users >= 1, "Admin inspect did not include users.");

console.log(JSON.stringify({
  api,
  userId: user.platformUserId,
  developerId: developer.developerId,
  recommendationEngine: paidRecommendation.engine,
  recommendationBalanceAfter: paidRecommendation.creditAccount.balance,
  orderId: order.orderId,
  orderStatus: paid.order.status,
  chainGrantStatus: paid.bridge.status,
  walletCustodyMode: migrated.user.custodyMode,
  refundStatus: resolvedRefund.refund.status,
  settlementStatus: settlement.settlement.status,
  settlementDeveloperId: settlement.settlement.developerId,
  reputationScore: reputation.reputation.score,
  adminSnapshot: inspect.snapshot
}, null, 2));
