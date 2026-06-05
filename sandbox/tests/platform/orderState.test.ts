import assert from "node:assert/strict";
import test from "node:test";

import {
  assertOrderReadyForAccessBridge,
  isValidOrderTransition,
  markOrderAccessBridged,
  transitionOrderStatus,
  type PlatformOrder
} from "../../src/platform/orderState";

const pendingOrder: PlatformOrder = {
  orderId: "order-1",
  userId: "user-1",
  agentId: "agent-1",
  status: "pending",
  createdAt: "2026-06-05T00:00:00.000Z",
  updatedAt: "2026-06-05T00:00:00.000Z"
};

test("isValidOrderTransition allows pending -> paid and pending -> failed", () => {
  assert.equal(isValidOrderTransition("pending", "paid"), true);
  assert.equal(isValidOrderTransition("pending", "failed"), true);
});

test("isValidOrderTransition allows paid -> refunded only", () => {
  assert.equal(isValidOrderTransition("paid", "refunded"), true);
  assert.equal(isValidOrderTransition("paid", "failed"), false);
  assert.equal(isValidOrderTransition("paid", "pending"), false);
});

test("terminal order states cannot move again", () => {
  assert.equal(isValidOrderTransition("failed", "paid"), false);
  assert.equal(isValidOrderTransition("refunded", "paid"), false);
});

test("transitionOrderStatus stamps paidAt and updatedAt", () => {
  const paid = transitionOrderStatus(pendingOrder, "paid", "2026-06-05T00:01:00.000Z");

  assert.equal(paid.status, "paid");
  assert.equal(paid.paidAt, "2026-06-05T00:01:00.000Z");
  assert.equal(paid.updatedAt, "2026-06-05T00:01:00.000Z");
});

test("transitionOrderStatus rejects invalid direct refund", () => {
  assert.throws(
    () => transitionOrderStatus(pendingOrder, "refunded", "2026-06-05T00:01:00.000Z"),
    /cannot move from "pending" to "refunded"/
  );
});

test("access bridge is allowed only after paid", () => {
  assert.throws(
    () => assertOrderReadyForAccessBridge(pendingOrder),
    /must be paid before access can be bridged/
  );

  const paid = transitionOrderStatus(pendingOrder, "paid", "2026-06-05T00:01:00.000Z");
  assert.doesNotThrow(() => assertOrderReadyForAccessBridge(paid));
});

test("markOrderAccessBridged records one chain transaction", () => {
  const paid = transitionOrderStatus(pendingOrder, "paid", "2026-06-05T00:01:00.000Z");
  const bridged = markOrderAccessBridged(
    paid,
    "0x1111111111111111111111111111111111111111111111111111111111111111",
    "2026-06-05T00:02:00.000Z"
  );

  assert.equal(
    bridged.chainAccessTxHash,
    "0x1111111111111111111111111111111111111111111111111111111111111111"
  );
  assert.throws(
    () => markOrderAccessBridged(
      bridged,
      "0x2222222222222222222222222222222222222222222222222222222222222222",
      "2026-06-05T00:03:00.000Z"
    ),
    /already has a chain access transaction/
  );
});
