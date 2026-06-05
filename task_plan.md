# C-line MVP Overnight Task Plan

Date: 2026-06-05
Branch: `codex/c-platform-recommendation-foundation`
PR policy for this goal: commit and push a draft PR update after verification; keep PR #1 in draft unless the user explicitly asks to mark it ready.

## Goal

Advance C-line from local MVP-2 foundation toward a demo-ready middleware slice:

1. Users can sign in through local Web2 mock identity.
2. Users have platform credits.
3. Users can consume credits for LLM-assisted recommendation.
4. Orders can move from paid to access bridge queued.
5. Refund and access state are locally inspectable and testable.

The next `/goal` should focus on work C-line can do independently without waiting for real Google OAuth, payment provider, wallet KMS, or chain writes.

## Current MVP Status

MVP-0: mostly complete locally.

- Catalog expansion exists.
- Rule recommendation engine exists.
- Recommendation API exists.
- Frontend `/recommend` integration exists.
- Paid LLM recommendation foundation now exists on Platform API.

MVP-1: only partially covered.

- Developer profile service is not implemented.
- Agent catalog has vendor/source metadata, but no dedicated developer profile API.

MVP-2: local foundation is active.

- Web2 mock Google wallet exists.
- Exportable custodial wallet state model exists.
- Platform credits exist locally.
- Paid LLM recommendation charges credits.
- Frontend paid LLM recommendation UI exists.
- Order state machine exists.
- Paid order creates queued access bridge request.
- Platform API state persists to local JSON.
- Mock payment callback is idempotent.
- Refund policy/state machine exists.
- Approved full refund moves order to `refunded`.

MVP-3: not started.

- FARR/reputation read service not implemented.
- Settlement ledger and reconciliation not implemented.

## Recommended Overnight Scope

### Phase 1: Frontend Paid LLM Recommendation UI

Status: complete

Why:

- Highest demo value.
- Connects the new Platform API credit model to a visible product flow.
- Proves the "LLM recommendation consumes user platform credits" idea.

Implementation:

- Add platform API URL config, separate from recommendation API if needed.
- On `/recommend`, offer free rule recommendation and paid LLM recommendation modes.
- Use a local mock user for MVP if real auth is not available.
- Display cost per LLM recommendation.
- Display balance before/after.
- Show insufficient-credit error.

Validation:

- Frontend unit tests for config/client behavior.
- Browser/local smoke passed: run Platform API and frontend, click paid recommendation, see balance drop from `100` to `97`.
- Frontend `npm test` and `npm run build` pass.

Completion artifact:

- Working `/recommend` paid LLM demo flow.

### Phase 2: Platform API Persistence

Status: complete

Why:

- Current Platform API uses in-memory state.
- Without persistence, user credits/orders/refunds vanish on restart.
- Persistence is needed before realistic payment callbacks.

Implementation:

- Add local JSON file store first, matching existing repo style.
- Persist users, credit accounts, orders, access bridges, refunds.
- Keep store injectable for tests.
- Default runtime path under `.runtime/platform-api`.

Validation:

- Create user and charge LLM recommendation.
- Restart Platform API with the same `PLATFORM_API_STATE_DIR`.
- Read credit account and confirm balance remains `97`.
- Unit test store save/load passed.

Completion artifact:

- Restart-safe local Platform API state.

### Phase 3: Payment Callback Idempotency

Status: complete

Why:

- Real payment providers retry callbacks.
- Duplicate callbacks must not create duplicate access bridge requests.

Implementation:

- Add `paymentProvider`, `providerPaymentId`, `idempotencyKey`, `paidAmount` fields.
- Replace or supplement `/mark-paid` with mock payment callback endpoint.
- Repeated callback with same key returns the existing paid order and bridge.
- Conflicting callback with same key but different order/payment data returns error.

Validation:

- First callback pays order and creates one bridge.
- Second identical callback returns same bridge id.
- Conflicting callback returns 409.
- HTTP smoke passed before and after Platform API restart.

Completion artifact:

- Payment-safe order paid path for later Stripe/fiat integration.

### Phase 4: Wallet Export and Migration HTTP API

Status: pending

Why:

- User selected exportable/migratable custodial wallet mode.
- State machine exists, but no HTTP surface yet.

Implementation:

- Add endpoints:
  - request wallet export
  - complete wallet export
  - cancel wallet export
  - migrate to external wallet
- Require fresh Google auth and second factor flags in local mock request.
- Do not expose real private keys.

Validation:

- Export requires both auth flags.
- Complete requires prior request.
- Migration requires ownership proof and a new valid EVM address.

Completion artifact:

- Wallet portability flow that matches the chosen custody design.

### Phase 5: Access Bridge Lifecycle API

Status: pending

Why:

- Paid order currently queues bridge request.
- Operators need a local surface for submit/confirm/fail/retry before real chain write.

Implementation:

- Add bridge query endpoint.
- Add submit endpoint with mock chain tx hash.
- Add confirm endpoint.
- Add fail endpoint and retry path.
- Keep real operator wallet adapter out of scope.

Validation:

- queued -> submitted -> confirmed.
- queued/submitted -> failed.
- failed -> submitted retry.
- Confirmed cannot be resubmitted.

Completion artifact:

- Local operator bridge workflow.

### Phase 6: Refund Evidence Fields

Status: pending

Why:

- Refund policy needs a clearer line between "agent capability failed" and "user design mismatch".

Implementation:

- Add evidence fields to refund request:
  - expectedCapability
  - actualFailure
  - agentClaim
  - userProvidedEvidenceUrl
  - operatorReviewFinding
- Keep current category model.

Validation:

- `core_capability_failure` requires expected/actual evidence.
- `design_mismatch` can be rejected with operator finding.
- Security incident remains refundable path.

Completion artifact:

- More defensible refund review model.

### Phase 7: Developer Profile Local API

Status: optional

Why:

- This moves MVP-1 forward.
- It is valuable but less urgent than recommendation/order/access reliability.

Implementation:

- Add developer profile type and local store.
- Link agentId -> developerId.
- Include displayName, website, supportContact, walletAddress, trust fields.

Validation:

- Create/read profile.
- Agent catalog entry can resolve developer metadata.

Completion artifact:

- MVP-1 developer profile foundation.

## Recommended Execution Order

1. Phase 5: Access bridge lifecycle API.
2. Phase 4: Wallet export/migration HTTP API.
3. Phase 6: Refund evidence fields.
4. Phase 7: Developer profile local API only if time remains.

Reasoning:

- Phase 1 gave immediate demo value.
- Phase 2 and 3 made the money/access path restart-safe and callback-safe.
- Phase 5 is now the next best C-line-only step because it completes the access bridge workflow.
- Phase 4 and 6 harden user trust flows.
- Phase 7 is valuable but can trail because it is less blocking for C-line transaction flow.

## Do Not Do Overnight Without User Approval

- Do not connect real Google OAuth.
- Do not generate, store, display, or export real private keys.
- Do not integrate a real payment provider.
- Do not write real chain transactions with an operator wallet.
- Do not commit, push, or modify PR state.
- Do not remove unrelated user changes.

## Manual Decision Points

1. Should `/recommend` use a temporary mock user id for demo, or should the UI first show a "mock Google login" step?
   - Recommendation: mock login step, because it demonstrates Web2 onboarding and credit creation.

2. Should paid LLM recommendation replace free rules, or coexist?
   - Recommendation: coexist. Free rules are the fallback and transparent baseline.

3. Persistence choice: JSON file store or SQLite?
   - Recommendation: JSON file store for MVP, because it is easy to inspect and matches local test style.

4. Should credits be charged on LLM failure?
   - Current recommendation: no. Charge only when LLM returns a valid recommendation. Fallback to rules is free.

5. Should access bridge be created before or after payment callback confirmation?
   - Current decision: only after `paid`.

## Baseline Verification Commands

```bash
cd sandbox
npm test

cd ../frontend
npm test
npm run build
```

Current known baseline:

- Sandbox: 731 tests passing.
- Frontend: 87 tests passing.
- Frontend build passing with existing large chunk warning.

## Suggested `/goal` Text

```text
/goal 按照 Draft-box-agentlens 根目录 task_plan.md 推进 C 线 MVP：优先完成前端付费 LLM 推荐 UI，然后做 Platform API 本地持久化和 payment callback 幂等；每个阶段都运行对应测试和 HTTP/browser smoke，验证失败就回去修。不要 commit、push 或改 PR 状态，遇到真实 Google/支付/KMS/链写入相关内容只留 mock/adapter，不接真实外部服务。
```
