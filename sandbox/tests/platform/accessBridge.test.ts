import assert from "node:assert/strict";
import test from "node:test";

import {
  createAccessBridgeRequest,
  markAccessBridgeFailed
} from "../../src/platform/accessBridge";
import { transitionOrderStatus, type PlatformOrder } from "../../src/platform/orderState";

const pendingOrder: PlatformOrder = {
  orderId: "order-1",
  userId: "user-1",
  agentId: "dify",
  status: "pending",
  createdAt: "2026-06-05T00:00:00.000Z",
  updatedAt: "2026-06-05T00:00:00.000Z"
};

const leasedOrder: PlatformOrder = {
  ...transitionOrderStatus(pendingOrder, "gateway_lease_issued", "2026-06-05T00:01:00.000Z"),
  gatewayLeaseToken: "gateway-lease-1",
  gatewayLeaseExpiresAt: "2026-07-05T00:01:00.000Z",
  chainGrantStatus: "pending_chain_grant"
};

test("createAccessBridgeRequest requires a Gateway lease issued order", () => {
  assert.throws(
    () =>
      createAccessBridgeRequest(
        {
          bridgeId: "bridge-1",
          order: pendingOrder,
          userWalletAddress: "0x1111111111111111111111111111111111111111"
        },
        "2026-06-05T00:02:00.000Z"
      ),
    /must have a Gateway lease/
  );
});

test("createAccessBridgeRequest queues a pending chain grant for a Gateway lease", () => {
  const bridge = createAccessBridgeRequest(
    {
      bridgeId: "bridge-1",
      order: leasedOrder,
      userWalletAddress: "0x1111111111111111111111111111111111111111"
    },
    "2026-06-05T00:02:00.000Z"
  );

  assert.equal(bridge.status, "pending_chain_grant");
  assert.equal(bridge.orderId, "order-1");
  assert.equal(bridge.agentId, "dify");
  assert.equal(bridge.expectedGrantFunction, "grantRentalAccess");
  assert.equal(bridge.gatewayLeaseToken, "gateway-lease-1");
});

test("createAccessBridgeRequest requires Gateway lease metadata", () => {
  const missingMetadata = transitionOrderStatus(pendingOrder, "gateway_lease_issued", "2026-06-05T00:01:00.000Z");

  assert.throws(
    () =>
      createAccessBridgeRequest(
        {
          bridgeId: "bridge-1",
          order: missingMetadata,
          userWalletAddress: "0x1111111111111111111111111111111111111111"
        },
        "2026-06-05T00:02:00.000Z"
      ),
    /must have Gateway lease metadata/
  );
});

test("pending chain grant requests can be marked failed", () => {
  const pending = createAccessBridgeRequest(
    {
      bridgeId: "bridge-1",
      order: leasedOrder,
      userWalletAddress: "0x1111111111111111111111111111111111111111"
    },
    "2026-06-05T00:02:00.000Z"
  );
  const failed = markAccessBridgeFailed(pending, "grantRentalAccess bridge unavailable", "2026-06-05T00:03:00.000Z");

  assert.equal(failed.status, "failed");
  assert.equal(failed.failureReason, "grantRentalAccess bridge unavailable");
});
