import assert from "node:assert/strict";
import test from "node:test";

import {
  assertOrderReadyForAccessBridge,
  isValidOrderTransition,
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

test("isValidOrderTransition allows pending -> gateway_lease_issued and pending -> failed", () => {
  assert.equal(isValidOrderTransition("pending", "gateway_lease_issued"), true);
  assert.equal(isValidOrderTransition("pending", "failed"), true);
});

test("isValidOrderTransition allows gateway_lease_issued -> refunded only", () => {
  assert.equal(isValidOrderTransition("gateway_lease_issued", "refunded"), true);
  assert.equal(isValidOrderTransition("gateway_lease_issued", "failed"), false);
  assert.equal(isValidOrderTransition("gateway_lease_issued", "pending"), false);
});

test("terminal order states cannot move again", () => {
  assert.equal(isValidOrderTransition("failed", "gateway_lease_issued"), false);
  assert.equal(isValidOrderTransition("refunded", "gateway_lease_issued"), false);
});

test("transitionOrderStatus stamps Gateway lease and payment timestamps", () => {
  const leased = transitionOrderStatus(pendingOrder, "gateway_lease_issued", "2026-06-05T00:01:00.000Z");

  assert.equal(leased.status, "gateway_lease_issued");
  assert.equal(leased.paidAt, "2026-06-05T00:01:00.000Z");
  assert.equal(leased.gatewayLeaseIssuedAt, "2026-06-05T00:01:00.000Z");
  assert.equal(leased.updatedAt, "2026-06-05T00:01:00.000Z");
});

test("transitionOrderStatus rejects invalid direct refund", () => {
  assert.throws(
    () => transitionOrderStatus(pendingOrder, "refunded", "2026-06-05T00:01:00.000Z"),
    /cannot move from "pending" to "refunded"/
  );
});

test("chain grant is allowed only after Gateway lease metadata exists", () => {
  assert.throws(
    () => assertOrderReadyForAccessBridge(pendingOrder),
    /must have a Gateway lease/
  );

  const leased = {
    ...transitionOrderStatus(pendingOrder, "gateway_lease_issued", "2026-06-05T00:01:00.000Z"),
    gatewayLeaseToken: "gateway-lease-1",
    gatewayLeaseExpiresAt: "2026-07-05T00:01:00.000Z",
    chainGrantStatus: "pending_chain_grant" as const
  };
  assert.doesNotThrow(() => assertOrderReadyForAccessBridge(leased));
});
