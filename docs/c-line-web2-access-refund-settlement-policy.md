# C-line Web2 Access, Refund and Settlement Policy

Date: 2026-06-06

## Current Decisions

1. Web2 access uses option A from PR review: after payment, the platform issues a Gateway lease immediately and records `pending_chain_grant` for later B/C bridge processing.
2. Google account login is allowed as the first Web2 identity path.
3. Web2 wallets use a backend-custodied model with user-controlled export / migration.
4. Refunds are reserved for severe incidents, reproducible core-capability failures, and platform/agent-side delivery failures.

## Google Login And Wallet Creation

Recommended MVP flow:

1. User signs in with Google OAuth / OpenID Connect.
2. Backend verifies the Google ID token and stores:
   - `platformUserId`
   - Google subject ID `sub`
   - email verification state
   - risk flags
3. Backend creates a wallet for the user.
4. The wallet address is attached to the platform user and used for `hasAccess`.
5. After payment, the platform issues a Gateway lease for that user; the user can access the Agent through the platform while the chain grant remains pending.

Security rule:

- Do not generate or store a private key in frontend code.
- Do not show the private key to the user by default.
- For MVP, use a custodial wallet service with encrypted keys controlled by backend/KMS.
- Users must be able to export or migrate their wallet after strong re-authentication.
- For production, prefer passkey / WebAuthn smart accounts, MPC, or account abstraction while preserving an exit path.

Export / migration rules:

- Require fresh Google re-auth plus a second factor before export.
- Show the private key or encrypted keystore only once inside an explicit export flow.
- Never send the private key through email, logs, analytics, support chat, or browser storage.
- Add a short delay / cooldown for first export to reduce account-takeover damage.
- Record an audit event for export start, completion, cancellation, and migration.
- Let users migrate access to an external wallet by signing an ownership proof with the target wallet.
- After migration, keep the old custodial wallet read-only unless the user explicitly keeps both wallets linked.

Initial weight:

- Google verified email gives the user an initial Web2 identity confidence weight.
- Suggested default: `identityWeight = 10` on a 0-100 scale.
- Increase only after successful paid usage, non-disputed reviews, and age of account.
- Keep identity weight separate from agent reputation; a verified user should not be able to inflate an Agent score by identity alone.

## Access Bridge

Trigger:

```text
order.status: pending -> gateway_lease_issued
order.chainGrantStatus: pending_chain_grant
```

Bridge action:

```text
wait for B/C bridge grantRentalAccess(tokenId, buyer, expiresAt, orderIdHash, amountPaid)
```

The bridge must be idempotent:

- one order can record only one Gateway lease and pending chain-grant bridge
- retry/submit/confirm are blocked locally until `grantRentalAccess(...)` exists
- duplicate payment callbacks must not issue duplicate Gateway leases or bridge records

Local foundation:

- `sandbox/src/platform/web2Wallet.ts` defines Google-backed wallet creation, export and migration rules.
- `sandbox/src/platform/accessBridge.ts` defines `pending_chain_grant` / `failed` access bridge requests.
- `POST /api/payments/mock-callback` moves an order to `gateway_lease_issued` through an idempotent local payment callback.
- Local payment callback replay returns the existing access bridge instead of creating a duplicate.
- Local Platform API exposes bridge query, submit, confirm, fail and retry endpoints.
- Platform API state persists locally so access bridge requests survive restart.
- Submit, confirm and retry return `501` until B/C bridge adds `grantRentalAccess(...)`; no operator calls `rentAgent`, because `rentAgent` grants access to `msg.sender`.

## Refund Categories

Refundable severe incidents:

- Security breach caused by the Agent or platform integration.
- Data exfiltration or unauthorized external action.
- Agent violates its declared sandbox / manifest boundary.
- Paid access is not delivered because bridge/writeback failed and cannot be repaired quickly.
- Agent is unavailable for a material part of the paid access window.

Possibly refundable capability failures:

- User paid for a clearly advertised core capability.
- User followed documented setup steps.
- Failure is reproducible with supplied evidence.
- The failure affects the main paid scenario, not a side request.

Usually not refundable design or expectation issues:

- User asks for a scenario the Agent does not claim to support.
- User dislikes tone/style but the core task succeeds.
- User provides incomplete credentials, documents, or integration setup.
- Prompt quality or workflow design is the primary cause.
- A prototype/experimental Agent is used outside its stated limitations.

## Capability Insufficiency vs Design Issue

Capability insufficiency:

- The Agent claims it can perform the task.
- The task is inside the listed supported scenarios.
- The user provides required inputs.
- The Agent repeatedly fails in a reproducible way.

Design issue:

- The Agent was not designed for the scenario.
- The setup flow or prompt asks for unsupported behavior.
- The user needs custom workflow design, not a refund event.
- The output is subjectively unsatisfying but within stated limitations.

## Refund Workflow

States:

```text
requested -> under_review -> approved | rejected | partial_refund
```

Required evidence:

- orderId
- agentId
- userId
- issue category
- logs or screenshots
- expected behavior
- actual behavior
- agent claim
- operator review finding for design-mismatch rejection

Decision target:

- Security incidents: immediate freeze and manual review.
- Bridge failure: refund or repair within a fixed SLA.
- Capability insufficiency: partial or full refund after reproduction.
- Design issue: reject refund and provide guidance.

Local foundation:

- `sandbox/src/platform/refundPolicy.ts` classifies refundable, review-required and non-refundable cases.
- `core_capability_failure` is review-required and now requires expected/actual evidence.
- `design_mismatch`, `user_setup_issue` and `subjective_quality` are not refundable by default.
- Local Platform API freezes settlement while refund review is open.

## Settlement

MVP proposal:

- Platform fee: 20%
- Developer share: 80%
- Settlement period: weekly
- Holdback: 10% of developer share for 7 days to cover refunds/disputes

Security incident rule:

- Freeze settlement for affected Agent until review completes.
- If the Agent is responsible, use unpaid settlement / holdback for refunds before platform subsidy.

Local foundation:

- `sandbox/src/platform/settlementLedger.ts` creates one settlement entry when an order becomes `gateway_lease_issued`.
- Local settlement entries calculate platform fee, developer share, holdback and payable amount.
- Developer summary is available through `GET /api/settlements/developers/:developerId/summary`.
- Refund review freezes settlement; approved or partial refunds mark settlement as refunded.
- `sandbox/src/platform/reputationRead.ts` provides local FARR-style reputation snapshots for agents and developers.

Open decisions:

- Exact B/C bridge operator permissions and confirmation strategy.
- Refund SLA duration.
- Whether high-trust Agents get lower holdback.
