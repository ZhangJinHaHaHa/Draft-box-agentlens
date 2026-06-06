# C-line Findings

Date: 2026-06-06

## Architecture Findings

The C-line local MVP now has three cooperating layers:

- Recommendation:
  - free deterministic rules
  - paid LLM reranking through Platform API
  - rule fallback and catalog-only guardrails
- Transaction/access middleware:
  - mock Web2 user
  - platform credits
  - order
  - idempotent payment callback
  - access bridge lifecycle
- Trust/ops middleware:
  - wallet export/migration state
  - refund evidence and review
  - developer profile
  - settlement ledger
  - local FARR/reputation read adapter
  - admin inspect

This keeps the demo local and reviewable while preserving clear boundaries for later real Google OAuth, payment providers, KMS/custody and B/C bridge chain grants.

## Current C-line Design Decisions

- Web2 access bridge strategy follows PR review option A: after payment, the platform issues a Gateway lease and records `pending_chain_grant` for later B/C bridge processing.
- Current implementation does not submit a chain grant; submit/retry/confirm wait for `grantRentalAccess(...)`.
- Google login remains local mock only.
- Wallet model is backend-custodied, exportable and migratable.
- Mock wallet export returns a receipt with `privateKeyMaterial: null`.
- Platform credits are local integer balances.
- LLM recommendation costs `3` credits.
- Mock Google users start with `100` credits.
- Payment callbacks are keyed by `idempotencyKey`.
- Duplicate callbacks return the existing Gateway-lease-issued order and bridge.
- Conflicting callbacks with the same idempotency key return `409`.
- Refunds are reserved for severe/platform/security/core-capability failures.
- Core capability failure requires expected/actual evidence.
- Design mismatch rejection requires an operator finding.
- Settlement MVP uses:
  - 20% platform fee
  - 80% developer share
  - 10% holdback from developer share
  - weekly settlement period
- Refund review freezes settlement; approved/partial refunds mark settlement refunded.
- Reputation source is local fixture/derived adapter: `local-farr-adapter`.

## Current Implementation Findings

Implemented locally:

- Recommendation API service.
- Frontend `/recommend` page with local recommendation API integration.
- Frontend paid LLM recommendation mode.
- Platform API local service.
- Web2 mock Google user creation.
- Exportable/migratable custodial wallet API.
- Credit ledger.
- Paid mock LLM recommendation endpoint.
- Local Platform API persistence.
- Mock payment callback idempotency.
- Order state machine.
- Access bridge lifecycle API.
- Refund evidence and review model.
- Developer profile API.
- Settlement ledger MVP.
- Local FARR/reputation read adapter.
- Platform admin inspect API.
- End-to-end HTTP smoke script.

Important limits:

- Real Google OAuth is not wired.
- Real payment provider is not wired.
- Real KMS/custody provider is not wired.
- Real private keys are not generated or exposed.
- Real B/C bridge chain grant is not wired.
- FARR is local derived data, not a real chain/service read.

## Verification Findings

Passing baseline:

- `npm test --prefix sandbox -- platform/orderState.test.ts platform/accessBridge.test.ts platform/platformApiServer.test.ts platform/persistentPlatformApiStore.test.ts recommendation/recommendationService.test.ts`: 754 tests passing.
- `npm test --prefix frontend`: 93 tests passing.
- `npm run build --prefix frontend`: passing with the existing large chunk warning.
- Platform MVP HTTP smoke: not rerun in this sandbox because local port listening was blocked.

The smoke script now checks:

- paid recommendation charges credits and leaves balance `97`
- payment callback replay is idempotent
- access bridge remains `pending_chain_grant` while Gateway lease access is available
- wallet can move to `external_migrated`
- refund evidence path resolves to `partial_refund`
- settlement resolves developer profile
- reputation returns `local-farr-adapter`
- admin inspect sees the full local state

## Repo Findings

- Markdown files are ignored by repo ignore rules, so planning/docs updates require `git add -f`.
- Keep generated `dist`, `node_modules` and tsbuildinfo out of commits.
- Current C-line work should stay on `codex/c-platform-recommendation-foundation`.
