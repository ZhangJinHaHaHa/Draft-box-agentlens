import assert from "node:assert/strict";
import test from "node:test";

import {
  createAccessBridgeRequest,
  markAccessBridgeConfirmed,
  markAccessBridgeFailed,
  markAccessBridgeSubmitted
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

const paidOrder = transitionOrderStatus(pendingOrder, "paid", "2026-06-05T00:01:00.000Z");

test("createAccessBridgeRequest requires a paid order", () => {
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
    /must be paid/
  );
});

test("createAccessBridgeRequest queues an access bridge for a paid order", () => {
  const bridge = createAccessBridgeRequest(
    {
      bridgeId: "bridge-1",
      order: paidOrder,
      userWalletAddress: "0x1111111111111111111111111111111111111111"
    },
    "2026-06-05T00:02:00.000Z"
  );

  assert.equal(bridge.status, "queued");
  assert.equal(bridge.orderId, "order-1");
  assert.equal(bridge.agentId, "dify");
});

test("access bridge request follows queued -> submitted -> confirmed", () => {
  const queued = createAccessBridgeRequest(
    {
      bridgeId: "bridge-1",
      order: paidOrder,
      userWalletAddress: "0x1111111111111111111111111111111111111111"
    },
    "2026-06-05T00:02:00.000Z"
  );
  const submitted = markAccessBridgeSubmitted(
    queued,
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "2026-06-05T00:03:00.000Z"
  );
  const confirmed = markAccessBridgeConfirmed(submitted, "2026-06-05T00:04:00.000Z");

  assert.equal(submitted.status, "submitted");
  assert.equal(confirmed.status, "confirmed");
  assert.equal(confirmed.confirmedAt, "2026-06-05T00:04:00.000Z");
});

test("failed bridge requests can be retried", () => {
  const queued = createAccessBridgeRequest(
    {
      bridgeId: "bridge-1",
      order: paidOrder,
      userWalletAddress: "0x1111111111111111111111111111111111111111"
    },
    "2026-06-05T00:02:00.000Z"
  );
  const failed = markAccessBridgeFailed(queued, "operator wallet unavailable", "2026-06-05T00:03:00.000Z");
  const retried = markAccessBridgeSubmitted(
    failed,
    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "2026-06-05T00:04:00.000Z"
  );

  assert.equal(failed.status, "failed");
  assert.equal(retried.status, "submitted");
  assert.equal(retried.failureReason, undefined);
});
