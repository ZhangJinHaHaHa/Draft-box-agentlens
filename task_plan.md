# C-line MVP Task Plan

Date: 2026-06-06
Branch: `codex/c-platform-recommendation-foundation`
PR policy: commit and push verified C-line MVP work to draft PR #1; keep the PR draft.

## Goal

Build the C-line local MVP into a complete demoable middleware loop without real external services:

1. Mock Web2 user creation.
2. Platform credits and paid LLM recommendation.
3. Order creation and idempotent payment callback.
4. Access bridge lifecycle.
5. Exportable/migratable wallet HTTP surface.
6. Refund evidence and responsibility classification.
7. Developer profile, settlement ledger and local reputation read adapter.
8. Admin inspect and end-to-end HTTP smoke.

## Current MVP Status

MVP-0: complete locally.

- Catalog expansion exists.
- Rule recommendation engine exists.
- Recommendation API exists.
- Frontend `/recommend` integration exists.
- Paid LLM recommendation foundation exists on Platform API.

MVP-1: complete enough for local C-line MVP.

- Developer profile store/API exists.
- `agentId -> developerId` link exists.
- Developer profile data feeds settlement and reputation context.

MVP-2: complete locally.

- Web2 mock Google wallet exists.
- Exportable/migratable custodial wallet API exists.
- Platform credits exist locally.
- Paid LLM recommendation charges credits.
- Frontend paid LLM recommendation UI exists.
- Order state machine exists.
- Mock payment callback is idempotent.
- Access bridge lifecycle API exists.
- Platform API state persists to local JSON.
- Refund evidence and review state machine exist.

MVP-3: local read/ledger foundation complete.

- Settlement ledger MVP exists.
- Weekly settlement periods, 20% platform fee, 80% developer share and 10% holdback exist.
- Refund review freezes settlement; approved/partial refunds mark settlement refunded.
- Local FARR/reputation read adapter exists.
- Admin inspect endpoint exists.

## Phase Status

### Phase 1: Frontend Paid LLM Recommendation UI

Status: complete

Validation:

- Frontend unit tests cover Platform API client behavior.
- Browser smoke passed previously: paid recommendation balance drops from `100` to `97`.

### Phase 2: Platform API Persistence

Status: complete

Validation:

- Persistent store reloads users and credit balances.
- Persistent store reloads developer, bridge and settlement state.

### Phase 3: Payment Callback Idempotency

Status: complete

Validation:

- First callback pays order and creates one bridge.
- Duplicate callback returns the same bridge.
- Conflicting callback returns `409`.

### Phase 4: Access Bridge Lifecycle API

Status: complete

Implemented:

- `GET /api/access-bridges/:bridgeId`
- `POST /api/access-bridges/:bridgeId/submit`
- `POST /api/access-bridges/:bridgeId/confirm`
- `POST /api/access-bridges/:bridgeId/fail`
- `POST /api/access-bridges/:bridgeId/retry`

Validation:

- `queued -> submitted -> confirmed`
- `queued/submitted -> failed`
- `failed -> submitted`
- `confirmed` cannot be resubmitted.

### Phase 5: Wallet Export and Migration HTTP API

Status: complete

Implemented:

- Request wallet export.
- Complete wallet export.
- Cancel wallet export.
- Migrate to external wallet.
- Mock export receipt has `privateKeyMaterial: null`.

Validation:

- Export requires fresh Google auth and second factor flags.
- Migration requires ownership proof and a different EVM address.

### Phase 6: Refund Evidence Fields

Status: complete

Implemented evidence fields:

- `expectedCapability`
- `actualFailure`
- `agentClaim`
- `userProvidedEvidenceUrl`
- `operatorReviewFinding`

Validation:

- `core_capability_failure` requires expected/actual evidence.
- `design_mismatch` rejection requires operator finding.
- Security incident remains refundable.

### Phase 7: Developer Profile Local API

Status: complete

Implemented:

- `POST /api/developers`
- `GET /api/developers/:developerId`
- `POST /api/developers/:developerId/agents`
- `GET /api/agents/:agentId/developer`

Validation:

- Developer profile can be created.
- Agent can link to developer.
- Settlement and reputation can resolve developer context.

### Phase 8: Settlement Ledger MVP

Status: complete

Implemented:

- Settlement entry is created when order becomes paid.
- Platform fee: 20%.
- Developer share: 80%.
- Holdback: 10% of developer share.
- Weekly settlement period.
- Developer settlement summary.
- Settlement release endpoint.
- Refund review freezes settlement.

Validation:

- Paid order creates settlement entry.
- Developer summary returns payable/holdback totals.
- Refund review freezes settlement.
- Approved/partial refund marks settlement refunded.

### Phase 9: FARR/Reputation Local Read Adapter

Status: complete

Implemented:

- `GET /api/reputation/agents/:agentId`
- `GET /api/reputation/developers/:developerId`
- Source is `local-farr-adapter`.

Validation:

- Reputation snapshots include paid orders, confirmed bridges, refunds, severe refunds and developer trust score.

### Phase 10: Platform Admin Inspect API

Status: complete

Implemented:

- `GET /api/admin/inspect`
- Returns users, credit accounts, orders, bridges, refunds, payment callbacks, developer profiles, agent links, settlements and reputation snapshots.

Validation:

- Platform API tests cover admin snapshot counts.
- End-to-end HTTP smoke checks admin inspect after full C-line flow.

### Phase 11: End-to-End HTTP Smoke Script

Status: complete

Implemented:

- `sandbox/scripts/platformMvpSmoke.mjs`
- `npm run run:platform:mvp-smoke`

Smoke covers:

- mock Google user
- paid LLM recommendation
- order create
- idempotent payment callback
- bridge submit/confirm
- wallet export/migration
- refund evidence path
- settlement/reputation/admin inspect

## Verification Commands

```bash
cd sandbox
npm test

cd ../frontend
npm test
npm run build
```

Current known validation:

- Sandbox: 745 tests passing.
- Frontend: 92 tests passing.
- Platform MVP HTTP smoke: passing.

## Explicit Non-Goals

- Do not connect real Google OAuth.
- Do not integrate real payment providers.
- Do not generate, store, display, or export real private keys.
- Do not connect KMS/custody provider.
- Do not write real operator wallet chain transactions.
- Do not mark PR #1 ready.

## Remaining Work After This MVP

- Real Google OAuth callback after auth/security review.
- Real payment provider signature verification.
- Real custody/KMS architecture.
- Real B-line contract write adapter.
- Frontend operator/admin UI beyond the current minimal client integration.
