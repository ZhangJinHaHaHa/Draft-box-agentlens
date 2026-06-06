# C-line Status And Next Steps

Date: 2026-06-06

## Current MVP Layer

C-line is now at local MVP-3 foundation for the independently buildable middleware slice.

Completed locally:

- MVP-0 listed catalog expansion.
- MVP-0 rule-based recommendation engine.
- Local recommendation API service.
- `/recommend` frontend integration with local recommendation API.
- Fiat / credits order state machine.
- Web2 Google identity + exportable custodial wallet state model.
- Access bridge dry-run state model.
- Refund classification and review state model.
- Local Platform API service for Web2 mock login, order creation, payment callback, automatic Gateway lease issuance, pending chain-grant records and refund review.
- Local platform credit ledger for Web2 users.
- Paid LLM recommendation endpoint with mock LLM provider, OpenAI-compatible adapter, rule-based candidate fallback and credit charging.
- Frontend `/recommend` paid LLM mode backed by Platform API credits.
- Local JSON persistence for Platform API users, credits, orders, access bridges, refunds and payment callbacks.
- Idempotent mock payment callback endpoint.
- Access bridge API for read/fail plus submit, confirm and retry endpoints that return `501` until B/C bridge adds `grantRentalAccess(...)`.
- Wallet export and migration HTTP API with no private key material returned.
- Refund evidence fields and responsibility classification rules.
- Developer Profile local API and `agentId -> developerId` links.
- Settlement Ledger MVP with platform fee, developer share, holdback, refund freeze and developer summary.
- FARR/Reputation local read adapter.
- Platform Admin Inspect API.
- End-to-end Platform MVP HTTP smoke script.

Not completed:

- Real Google OAuth callback.
- Real wallet KMS / custody provider.
- Real payment provider.
- Real B/C bridge chain grant.
- Production settlement ledger and payout integration.
- Real FARR dynamic reputation read service.

## What C-line Can Continue Independently

1. Recommendation API quality
   - Expand the backend recommendation catalog beyond the small default fixture.
   - Add scenario-specific weights and operator-curated boosts.
   - Decide whether the frontend should call free rule recommendation, paid LLM recommendation, or both.

2. Web2 identity and wallet service
   - Replace mock Google login endpoint with real Google OAuth callback.
   - Add audit events for export, migration and access bridge.

3. Order and refund service
   - Add payment-provider signature verification around the local callback API.
   - Add real payment provider adapter behind the existing idempotent callback path.

4. Access bridge service
   - Add `grantRentalAccess(...)` adapter after B/C bridge lands.
   - Keep real chain grant behind B-line contract confirmation.

5. Settlement policy
   - Add payout provider integration.
   - Add dispute windows and production reconciliation.
   - Review holdback policy with product/security.

## Artificial Boundaries

C-line can define APIs, state machines and mock services now.

Current validation nails:

- `sandbox/tests/platform/platformApiServer.test.ts` covers health, mock Google wallet creation, Gateway lease issuance, pending chain-grant bridge records, severe incident refund approval, approved refund order finalization and design-mismatch rejection.
- `sandbox/tests/platform/creditLedger.test.ts` covers initial grants, manual grants and insufficient-credit rejection.
- `sandbox/tests/recommendation/recommendationLlmClient.test.ts` covers mock LLM reranking, OpenAI-compatible response parsing and rejection of invented agent ids.
- `sandbox/tests/platform/platformApiServer.test.ts` covers paid LLM recommendation credit charging and insufficient-credit rejection.
- `sandbox/tests/platform/persistentPlatformApiStore.test.ts` covers local state reload after credit spending.
- `sandbox/tests/platform/persistentPlatformApiStore.test.ts` covers local state reload for developer, bridge and settlement state.
- `sandbox/tests/platform/platformApiServer.test.ts` covers idempotent payment callback replay and 409 conflict handling.
- `sandbox/tests/platform/platformApiServer.test.ts` covers bridge lifecycle, wallet export/migration, refund evidence, developer profile, settlement, reputation and admin inspect.
- Browser smoke covers paid `/recommend` with mock Google and balance drop from `100` to `97`.
- HTTP smoke covers the full local C-line MVP loop through `npm run run:platform:mvp-smoke`.
- `docs/local-development-runbook.md` includes the local Platform API smoke script for manual verification.

C-line should wait before:

- real B/C bridge chain-grant signing
- production wallet custody
- real payment provider settlement
- contract write integration

Those require team review with B-line and security checks.
