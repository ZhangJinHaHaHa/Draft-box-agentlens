# C-line Status And Next Steps

Date: 2026-06-05

## Current MVP Layer

C-line is currently between MVP-0 and MVP-2 foundation work.

Completed locally:

- MVP-0 listed catalog expansion.
- MVP-0 rule-based recommendation engine.
- Local recommendation API service.
- `/recommend` frontend integration with local recommendation API.
- Fiat / credits order state machine.
- Web2 Google identity + exportable custodial wallet state model.
- Access bridge dry-run state model.
- Refund classification and review state model.
- Local Platform API service for Web2 mock login, order creation, paid callback, automatic access bridge queueing and refund review.
- Local platform credit ledger for Web2 users.
- Paid LLM recommendation endpoint with mock LLM provider, OpenAI-compatible adapter, rule-based candidate fallback and credit charging.
- Frontend `/recommend` paid LLM mode backed by Platform API credits.
- Local JSON persistence for Platform API users, credits, orders, access bridges, refunds and payment callbacks.
- Idempotent mock payment callback endpoint.

Not completed:

- Real Google OAuth callback.
- Real wallet KMS / custody provider.
- Real payment provider.
- Real operator wallet chain write.
- Real settlement ledger.
- FARR dynamic reputation read service.

## What C-line Can Continue Independently

1. Recommendation API quality
   - Expand the backend recommendation catalog beyond the small default fixture.
   - Add scenario-specific weights and operator-curated boosts.
   - Decide whether the frontend should call free rule recommendation, paid LLM recommendation, or both.

2. Web2 identity and wallet service
   - Replace mock Google login endpoint with real Google OAuth callback.
   - Add wallet export / migration API contracts.
   - Add audit events for export, migration and access bridge.

3. Order and refund service
   - Add payment-provider signature verification around the local callback API.
   - Add refund evidence fields and stricter capability-failure validation.

4. Access bridge service
   - Add operator wallet adapter interface.
   - Add HTTP endpoints for submit, confirm, fail and retry.
   - Keep real chain write behind B-line contract confirmation.

5. Settlement policy
   - Add weekly settlement ledger model.
   - Add holdback calculation.
   - Freeze settlement on security incident.

## Artificial Boundaries

C-line can define APIs, state machines and mock services now.

Current validation nails:

- `sandbox/tests/platform/platformApiServer.test.ts` covers health, mock Google wallet creation, order paid bridge queueing, severe incident refund approval, approved refund order finalization and design-mismatch rejection.
- `sandbox/tests/platform/creditLedger.test.ts` covers initial grants, manual grants and insufficient-credit rejection.
- `sandbox/tests/recommendation/recommendationLlmClient.test.ts` covers mock LLM reranking, OpenAI-compatible response parsing and rejection of invented agent ids.
- `sandbox/tests/platform/platformApiServer.test.ts` covers paid LLM recommendation credit charging and insufficient-credit rejection.
- `sandbox/tests/platform/persistentPlatformApiStore.test.ts` covers local state reload after credit spending.
- `sandbox/tests/platform/platformApiServer.test.ts` covers idempotent payment callback replay and 409 conflict handling.
- Browser smoke covers paid `/recommend` with mock Google and balance drop from `100` to `97`.
- HTTP smoke covers persistence and idempotent callback replay after Platform API restart.
- `docs/local-development-runbook.md` includes the local Platform API smoke script for manual verification.

C-line should wait before:

- real operator wallet private-key handling
- production wallet custody
- real payment provider settlement
- contract write integration

Those require team review with B-line and security checks.
