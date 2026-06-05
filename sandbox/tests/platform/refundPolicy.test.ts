import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyRefundEligibility,
  createRefundCase,
  resolveRefundCase,
  startRefundReview
} from "../../src/platform/refundPolicy";

test("classifyRefundEligibility separates severe incidents from design issues", () => {
  assert.equal(classifyRefundEligibility("security_incident"), "refundable");
  assert.equal(classifyRefundEligibility("access_delivery_failure"), "refundable");
  assert.equal(classifyRefundEligibility("core_capability_failure"), "review_required");
  assert.equal(classifyRefundEligibility("design_mismatch"), "not_refundable");
  assert.equal(classifyRefundEligibility("subjective_quality"), "not_refundable");
});

test("createRefundCase records initial eligibility", () => {
  const refundCase = createRefundCase(
    {
      refundId: "refund-1",
      orderId: "order-1",
      userId: "user-1",
      agentId: "dify",
      category: "core_capability_failure"
    },
    "2026-06-05T00:00:00.000Z"
  );

  assert.equal(refundCase.status, "requested");
  assert.equal(refundCase.eligibility, "review_required");
});

test("refund lifecycle supports requested -> under_review -> approved", () => {
  const refundCase = createRefundCase(
    {
      refundId: "refund-1",
      orderId: "order-1",
      userId: "user-1",
      agentId: "dify",
      category: "security_incident"
    },
    "2026-06-05T00:00:00.000Z"
  );
  const reviewing = startRefundReview(refundCase, "ops-1", "2026-06-05T00:01:00.000Z");
  const approved = resolveRefundCase(
    reviewing,
    "approved",
    { reviewNote: "Confirmed security incident.", refundAmount: "100.00" },
    "2026-06-05T00:02:00.000Z"
  );

  assert.equal(reviewing.status, "under_review");
  assert.equal(approved.status, "approved");
  assert.equal(approved.refundAmount, "100.00");
});

test("refund lifecycle rejects direct approval from requested", () => {
  const refundCase = createRefundCase(
    {
      refundId: "refund-1",
      orderId: "order-1",
      userId: "user-1",
      agentId: "dify",
      category: "security_incident"
    },
    "2026-06-05T00:00:00.000Z"
  );

  assert.throws(
    () =>
      resolveRefundCase(
        refundCase,
        "approved",
        { reviewNote: "No direct approval.", refundAmount: "100.00" },
        "2026-06-05T00:02:00.000Z"
      ),
    /cannot move from "requested" to "approved"/
  );
});

test("approved refunds require an amount", () => {
  const reviewing = startRefundReview(
    createRefundCase(
      {
        refundId: "refund-1",
        orderId: "order-1",
        userId: "user-1",
        agentId: "dify",
        category: "security_incident"
      },
      "2026-06-05T00:00:00.000Z"
    ),
    "ops-1",
    "2026-06-05T00:01:00.000Z"
  );

  assert.throws(
    () =>
      resolveRefundCase(
        reviewing,
        "approved",
        { reviewNote: "Confirmed." },
        "2026-06-05T00:02:00.000Z"
      ),
    /refundAmount is required/
  );
});
