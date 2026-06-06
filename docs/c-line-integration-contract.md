# C-line Integration Contract

Date: 2026-06-06
Branch: `codex/c-platform-recommendation-foundation`
PR: draft PR #1

## Summary

C-line has completed a local MVP loop for the independently buildable middleware slice.

This PR does not integrate real Google OAuth, real payment providers, real KMS/private keys, real B/C bridge chain grants or real payout providers. It only provides local mock/adapter boundaries so A-line, B-line and product/security can align interfaces before production integration.

Current local loop:

```text
mock Google user
-> platform credits
-> paid LLM recommendation
-> order creation
-> idempotent payment callback
-> platform Gateway lease issuance
-> pending chain-grant bridge record
-> wallet export/migration mock flow
-> refund evidence review
-> settlement ledger
-> local reputation read
-> admin inspect
```

## Local Run

```bash
cd sandbox
npm run run:platform:api
```

Run the full MVP smoke from another terminal:

```bash
cd sandbox
PLATFORM_API_BASE_URL=http://127.0.0.1:8790 npm run run:platform:mvp-smoke
```

Current validation:

- `cd sandbox && npm test`: 745 passing
- `cd frontend && npm test`: 92 passing
- `cd frontend && npm run build`: passing, with the existing large chunk warning
- `npm run run:platform:mvp-smoke`: passing

## Platform API Endpoints

### User, Wallet and Credits

```http
POST /api/web2/google/mock
GET  /api/web2/users/:userId
GET  /api/web2/users/:userId/credits
POST /api/web2/users/:userId/wallet/export/request
POST /api/web2/users/:userId/wallet/export/complete
POST /api/web2/users/:userId/wallet/export/cancel
POST /api/web2/users/:userId/wallet/migrate
```

Notes:

- Mock Google users start with `100` platform credits.
- Paid LLM recommendation costs `3` credits.
- Wallet export only returns a mock receipt with `privateKeyMaterial: null`.
- Wallet migration requires `ownershipProofVerified: true`.
- Production Google OAuth and custody/KMS are intentionally not wired.

### Paid Recommendation

```http
POST /api/recommendations/llm
```

Example request:

```json
{
  "userId": "web2-user-xxx",
  "query": "I need a self-hosted RAG knowledge base agent with an API.",
  "limit": 2
}
```

Response includes:

- `engine`
- `charged`
- `fallbackUsed`
- `costCredits`
- `creditAccount`
- `recommendation.results`

The LLM can only rerank catalog candidates; invented agent IDs are rejected.

### Orders and Payment Callback

```http
POST /api/orders
GET  /api/orders/:orderId
POST /api/payments/mock-callback
```

Payment callback request:

```json
{
  "orderId": "order-1",
  "paymentProvider": "stripe-mock",
  "providerPaymentId": "pay-1",
  "idempotencyKey": "idem-1",
  "paidAmount": "20.00"
}
```

Rules:

- The callback is idempotent by `idempotencyKey`.
- Replaying the same callback returns the same Gateway-lease-issued order and access bridge.
- Reusing the same key with conflicting payment data returns `409`.
- Real payment webhook signature verification is not implemented yet.

### Access Bridge

```http
GET  /api/access-bridges/:bridgeId
POST /api/access-bridges/:bridgeId/submit
POST /api/access-bridges/:bridgeId/confirm
POST /api/access-bridges/:bridgeId/fail
POST /api/access-bridges/:bridgeId/retry
```

Local state flow:

```text
pending_chain_grant -> failed
```

This is the main contract with B-line. C-line does not submit mock transaction hashes anymore, because the current contract does not expose `grantAccess` and `rentAgent(tokenId, durationDays)` must remain buyer-wallet-only. The local bridge records that platform access is already available through the Gateway lease while the chain grant waits for the B/C bridge function.

Expected future adapter shape:

```ts
grantRentalAccess(input: {
  tokenId: bigint;
  userWalletAddress: string;
  expiresAt: bigint;
  agentId: string;
  orderId: string;
  bridgeId: string;
  amountPaid: string;
}): Promise<{ chainGrantTxHash: string }>;
```

B-line needs to confirm:

- `grantRentalAccess(uint256 tokenId, address buyer, uint64 expiresAt, bytes32 orderIdHash, uint256 amountPaid)`
- rental-granted event fields
- `onlyOperator` permissions
- whether `orderId` or `bridgeId` should be recorded on chain
- on-chain idempotency or duplicate-write behavior
- confirmation strategy for C-line to clear or finalize `pending_chain_grant`

### Refund Evidence

```http
POST /api/refunds
GET  /api/refunds/:refundId
POST /api/refunds/:refundId/review
POST /api/refunds/:refundId/resolve
```

Refund evidence fields:

```json
{
  "expectedCapability": "Agent claims it can ingest internal documents.",
  "actualFailure": "Ingestion fails before the first document is indexed.",
  "agentClaim": "Self-hosted RAG setup.",
  "userProvidedEvidenceUrl": "https://...",
  "operatorReviewFinding": "The request is outside the published agent claim."
}
```

Current rules:

- `security_incident`, `access_delivery_failure` and `agent_unavailable` are refundable.
- `core_capability_failure` is review-required and must include `expectedCapability` and `actualFailure`.
- `design_mismatch`, `user_setup_issue` and `subjective_quality` are not refundable by default.
- Rejecting a `design_mismatch` refund requires `operatorReviewFinding`.

Product/security needs to confirm:

- exact refund SLA
- partial refund percentage rules
- what counts as core capability failure
- what counts as design mismatch
- whether security incidents always freeze settlement immediately

### Developer, Settlement and Reputation

```http
POST /api/developers
GET  /api/developers/:developerId
POST /api/developers/:developerId/agents
GET  /api/agents/:agentId/developer

GET  /api/settlements/orders/:orderId
GET  /api/settlements/developers/:developerId/summary
POST /api/settlements/:settlementId/release

GET  /api/reputation/agents/:agentId
GET  /api/reputation/developers/:developerId
```

Current settlement MVP defaults:

- platform fee: `20%`
- developer share: `80%`
- holdback: `10%` of developer share
- settlement period: weekly
- refund review freezes settlement
- approved or partial refund marks settlement as refunded

The reputation endpoint is a local derived adapter with source `local-farr-adapter`; it is not a real chain/service FARR read.

Product/business needs to confirm:

- platform fee
- developer share
- holdback ratio and duration
- whether high-trust developers get lower holdback
- payout timing and dispute window

### Admin Inspect

```http
GET /api/admin/inspect
```

This endpoint is for local demo/debug. It returns local users, credits, orders, access bridges, refunds, payment callbacks, developer profiles, agent links, settlements and reputation snapshots.

## Frontend Touchpoints

Frontend already has:

- `/recommend` paid LLM mode through `VITE_PLATFORM_API_URL`
- typed Platform API client helpers for:
  - paid recommendation
  - wallet export
  - wallet migration
  - access bridge read
  - admin inspect

Recommended hackathon UI next:

```text
Platform Console / Demo Panel

1. User / Wallet / Credits
2. Paid Recommendation / Order
3. Access Bridge
4. Refund / Settlement / Reputation
```

This can be a small demo panel rather than a polished production UI.

## Explicit Boundaries

Do not treat this PR as production-ready for:

- real Google OAuth
- real payment webhook verification
- real KMS/custody/private-key export
- real B/C bridge chain grants
- real payout and production settlement
- real FARR dynamic read service

The PR is best used as the local integration contract and demo foundation.

## PR Recommendation

Keep PR #1 as draft until the team confirms the integration contracts above.

Recommended flow:

1. Share this document in the team group.
2. Ask B-line to confirm the `grantRentalAccess` contract/event and `onlyOperator` flow.
3. Ask A-line whether to build a minimal Platform Console from the existing endpoints.
4. Ask product/security to confirm refund and settlement rules.
5. After those decisions, either:
   - keep this as an integration branch and continue iterating, or
   - split/clean up into smaller PRs if the team wants a safer merge path.

For hackathon speed, merging the draft PR is acceptable only after at least one teammate reviews the interface surface and everyone agrees this mock/local layer is allowed in the main branch.
