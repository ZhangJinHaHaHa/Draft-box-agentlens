# Local Development Runbook

Date: 2026-06-05

## Frontend Only

Use this path when you want the catalog, search, detail pages and recommendation UI to run without local chain services.

```bash
cd frontend
VITE_AUDIT_RPC_URL=http://127.0.0.1:8545 \
VITE_AUDIT_REGISTRY_ADDRESS=0x1111111111111111111111111111111111111111 \
VITE_AUDIT_CHAIN_ID=31337 \
npm run dev -- --host 127.0.0.1
```

Open:

- `http://127.0.0.1:5173/zh`
- `http://127.0.0.1:5173/zh/agents`
- `http://127.0.0.1:5173/zh/recommend`

The dummy audit env keeps the app out of configuration-error state. Chain-backed native panels may show empty/error states until local chain services are running.

## Recommendation API + Frontend

Terminal 1:

```bash
cd sandbox
npm run run:recommendation:api
```

Default API:

- health: `http://127.0.0.1:8787/health`
- recommend: `POST http://127.0.0.1:8787/api/recommendations`

Terminal 2:

```bash
cd frontend
VITE_AUDIT_RPC_URL=http://127.0.0.1:8545 \
VITE_AUDIT_REGISTRY_ADDRESS=0x1111111111111111111111111111111111111111 \
VITE_AUDIT_CHAIN_ID=31337 \
VITE_PLATFORM_RECOMMENDATION_API_URL=http://127.0.0.1:8787 \
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/zh/recommend`, enter a request such as:

```text
我需要一个自托管 RAG 知识库 Agent，最好有 API，可以接内部文档。
```

Expected result: Dify / Flowise style candidates appear with recommendation reasons.

## Paid LLM Recommendation UI + Platform API

Terminal 1:

```bash
cd sandbox
npm run run:platform:api
```

Terminal 2:

```bash
cd frontend
VITE_AUDIT_RPC_URL=http://127.0.0.1:8545 \
VITE_AUDIT_REGISTRY_ADDRESS=0x1111111111111111111111111111111111111111 \
VITE_AUDIT_CHAIN_ID=31337 \
VITE_PLATFORM_API_URL=http://127.0.0.1:8790 \
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/zh/recommend`, switch to paid LLM mode, connect the local mock Google account, then run the same self-hosted RAG query.

Expected result:

- the local account starts at `100` credits
- paid recommendation uses `mock-llm`
- cost is `3` credits
- balance becomes `97`
- Dify / Flowise style candidates appear

## Platform API Local C-line Flow

Use this path to verify C-line Web2 middleware without real Google OAuth, payment provider, KMS or chain writes.

Terminal:

```bash
cd sandbox
npm run run:platform:api
```

Default API:

- health: `http://127.0.0.1:8790/health`
- mock Google login: `POST http://127.0.0.1:8790/api/web2/google/mock`
- credit balance: `GET http://127.0.0.1:8790/api/web2/users/:userId/credits`
- paid LLM recommendation: `POST http://127.0.0.1:8790/api/recommendations/llm`
- order create: `POST http://127.0.0.1:8790/api/orders`
- paid callback mock: `POST http://127.0.0.1:8790/api/payments/mock-callback`
- refund request: `POST http://127.0.0.1:8790/api/refunds`

Default recommendation charging:

- each mock/LLM recommendation costs `3` platform credits
- mock Google users start with `100` local platform credits
- local default LLM provider is `mock`, so no external API call is made
- local Platform API state persists under `sandbox/.runtime/platform-api`

To use a disposable or explicit state directory:

```bash
cd sandbox
PLATFORM_API_STATE_DIR=/private/tmp/agentlens-platform-api \
npm run run:platform:api
```

To wire a real OpenAI-compatible provider locally:

```bash
cd sandbox
PLATFORM_RECOMMENDATION_LLM_PROVIDER=openai \
PLATFORM_RECOMMENDATION_LLM_API_KEY=... \
PLATFORM_RECOMMENDATION_LLM_MODEL=... \
npm run run:platform:api
```

Smoke script:

```bash
node - <<'NODE'
const api = "http://127.0.0.1:8790";
async function post(path, body = {}) {
  const response = await fetch(`${api}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`${path}: ${JSON.stringify(json)}`);
  return json;
}

const { user } = await post("/api/web2/google/mock", {
  googleSubject: "google-smoke-1",
  email: "smoke@example.com"
});
const paidRecommendation = await post("/api/recommendations/llm", {
  userId: user.platformUserId,
  query: "我需要一个自托管 RAG 知识库 Agent，最好有 API，可以接内部文档。",
  limit: 2
});
const { order } = await post("/api/orders", {
  userId: user.platformUserId,
  agentId: "dify",
  amount: "20.00",
  currency: "CREDITS"
});
const paymentCallback = {
  orderId: order.orderId,
  paymentProvider: "stripe-mock",
  providerPaymentId: "pay-smoke-1",
  idempotencyKey: "idem-smoke-1",
  paidAmount: "20.00"
};
const paid = await post("/api/payments/mock-callback", paymentCallback);
const replay = await post("/api/payments/mock-callback", paymentCallback);
const { refund } = await post("/api/refunds", {
  orderId: order.orderId,
  category: "security_incident"
});
const reviewing = await post(`/api/refunds/${refund.refundId}/review`, {
  reviewerId: "ops-1"
});
const resolved = await post(`/api/refunds/${refund.refundId}/resolve`, {
  outcome: "approved",
  reviewNote: "Confirmed security incident.",
  refundAmount: "20.00"
});
const finalOrderResponse = await fetch(`${api}/api/orders/${order.orderId}`);
const finalOrder = await finalOrderResponse.json();

console.log(JSON.stringify({
  walletMode: user.custodyMode,
  walletAddress: user.walletAddress,
  recommendationEngine: paidRecommendation.engine,
  recommendationCharged: paidRecommendation.charged,
  recommendationBalanceAfter: paidRecommendation.creditAccount.balance,
  recommendedAgentIds: paidRecommendation.recommendation.results.map((item) => item.agentId),
  orderStatus: paid.order.status,
  accessBridgeStatus: paid.bridge.status,
  callbackReplay: replay.idempotentReplay,
  callbackBridgeStable: paid.bridge.bridgeId === replay.bridge.bridgeId,
  refundEligibility: refund.eligibility,
  reviewStatus: reviewing.refund.status,
  refundStatus: resolved.refund.status,
  finalOrderStatus: finalOrder.order.status
}, null, 2));
NODE
```

Expected result:

- wallet mode is `backend_custodied_exportable`
- paid recommendation engine is `mock-llm`
- recommendation costs credits and recommends Dify / Flowise style candidates for self-hosted RAG
- order status becomes `paid`
- access bridge status is `queued`
- duplicate payment callback returns the same bridge and `callbackReplay: true`
- security incident refund is `refundable` and can be approved
- approved full refund moves the order to `refunded`

## Validation

```bash
cd frontend
npm test
npm run build

cd ../sandbox
npm test
```

Current C-line validation nails:

1. `GET /health` returns service status and in-memory counters.
2. Mock Google login creates a Web2 user with an exportable custodial wallet and identity weight `10`.
3. Mock Google login creates a local platform credit account with `100` credits.
4. Paid LLM recommendation consumes `3` credits and can only recommend catalog candidates.
5. Local Platform API state persists across restart when `PLATFORM_API_STATE_DIR` is reused.
6. Creating an order and receiving a mock payment callback auto-queues one access bridge request.
7. Duplicate payment callbacks are idempotent and return the existing access bridge.
8. Conflicting payment callback replay returns `409`.
9. Security incidents enter the refundable path and can be approved after review.
10. Approved full refunds move the order to `refunded`.
11. Design mismatch cases stay non-refundable and should be rejected unless ops overrides policy.

## Full Local Chain Path

Full Web3 e2e requires these services before frontend can display real native data:

1. Polygon Edge local chain.
2. Deployed `AgentAuditRegistry` metadata at `contracts/deployments/polygon-edge-local/AgentAuditRegistry.json`.
3. Optional report gateway and appeal API.

Once deployment metadata exists, generate frontend env:

```bash
cd frontend
npm run env:polygon-edge-local:write
npm run dev -- --host 127.0.0.1
```
