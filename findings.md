# C-line Findings

Date: 2026-06-05

## Architecture Findings

The current recommendation stack has two layers:

- Rule recommendation:
  - deterministic keyword and weighted scoring
  - useful as a free baseline and LLM candidate generator
  - weak at deep semantic matching
- Paid LLM recommendation:
  - exposed from Platform API
  - charges platform credits
  - reranks and explains only allowed catalog candidates
  - rejects invented agent ids

This hybrid design should remain:

- rules provide fallback, auditability, and candidate guardrails
- LLM provides semantic ranking and user-facing explanations

## Current C-line Design Decisions

- Web2 access bridge strategy: after an order is `paid`, platform operator wallet should write on-chain access right.
- Current local implementation stops at queued access bridge request.
- Google login is allowed for Web2 onboarding.
- Wallet model is backend-custodied, exportable, and migratable.
- Local mock users get deterministic EVM addresses, but no real private keys.
- Platform credits are local integer balances.
- LLM recommendation currently costs `3` credits.
- Mock Google users currently start with `100` credits.
- Platform API now persists local state to JSON.
- Mock payment callbacks are keyed by `idempotencyKey`.
- Duplicate callbacks return the existing paid order and access bridge.
- Conflicting callbacks with the same idempotency key return 409.
- Refunds are reserved for severe/platform/security/core-capability failures.
- Design mismatch, user setup issues, and subjective quality are non-refundable by default.

## Current Implementation Findings

Implemented locally:

- Recommendation API service.
- Frontend `/recommend` page with local recommendation API integration.
- Platform API local service.
- Web2 mock Google user creation.
- Exportable custodial wallet state model.
- Credit ledger.
- Paid mock LLM recommendation endpoint.
- Frontend paid LLM recommendation mode.
- Local Platform API persistence.
- Mock payment callback idempotency.
- Order state machine.
- Access bridge request state model.
- Refund policy and review model.

Important limits:

- Real Google OAuth is not wired.
- Real payment provider is not wired.
- Real KMS/custody provider is not wired.
- Real operator wallet chain write is not wired.
- Settlement/FARR are not implemented.

## Verification Findings

Passing baseline:

- `sandbox npm test`: 737 tests passing.
- `frontend npm test`: 90 tests passing.
- `frontend npm run build`: passing with existing large chunk warning.
- Browser smoke for paid LLM recommendation:
  - initial balance `100`
  - recommendation engine `mock-llm`
  - cost `3`
  - balance after recommendation `97`
  - recommended agent ids `dify`, `flowise`
- HTTP smoke for Platform API persistence and payment callback idempotency:
  - paid recommendation balance after charge remains `97`
  - first payment callback creates `access-bridge-1`
  - identical replay returns the same bridge with `idempotentReplay = true`
  - conflicting replay returns `409`
  - after restart, balance/order/bridge/callback replay are restored from disk

## Repo Findings

- Markdown files are ignored by the repo ignore rules.
- If planning/docs should enter a later PR, use force add for markdown files.
- Current branch already has many uncommitted local changes.
- Do not revert unrelated user changes.
