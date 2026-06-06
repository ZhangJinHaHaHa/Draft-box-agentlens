import { assertOrderReadyForAccessBridge, type PlatformOrder } from "./orderState";
import { assertEthereumAddress } from "./web2Wallet";

export type AccessBridgeStatus = "pending_chain_grant" | "failed";

export interface AccessBridgeRequest {
  bridgeId: string;
  orderId: string;
  userId: string;
  agentId: string;
  userWalletAddress: string;
  status: AccessBridgeStatus;
  expectedGrantFunction: "grantRentalAccess";
  gatewayLeaseToken: string;
  gatewayLeaseIssuedAt: string;
  gatewayLeaseExpiresAt: string;
  createdAt: string;
  updatedAt: string;
  failedAt?: string;
  failureReason?: string;
}

export function createAccessBridgeRequest(
  input: {
    bridgeId: string;
    order: PlatformOrder;
    userWalletAddress: string;
  },
  at: string
): AccessBridgeRequest {
  assertOrderReadyForAccessBridge(input.order);
  assertEthereumAddress(input.userWalletAddress, "userWalletAddress");
  if (!input.order.gatewayLeaseToken || !input.order.gatewayLeaseIssuedAt || !input.order.gatewayLeaseExpiresAt) {
    throw new Error(`Order "${input.order.orderId}" must have Gateway lease metadata before chain grant can be queued.`);
  }

  return {
    bridgeId: input.bridgeId,
    orderId: input.order.orderId,
    userId: input.order.userId,
    agentId: input.order.agentId,
    userWalletAddress: input.userWalletAddress,
    status: "pending_chain_grant",
    expectedGrantFunction: "grantRentalAccess",
    gatewayLeaseToken: input.order.gatewayLeaseToken,
    gatewayLeaseIssuedAt: input.order.gatewayLeaseIssuedAt,
    gatewayLeaseExpiresAt: input.order.gatewayLeaseExpiresAt,
    createdAt: at,
    updatedAt: at
  };
}

export function markAccessBridgeFailed(
  request: AccessBridgeRequest,
  failureReason: string,
  at: string
): AccessBridgeRequest {
  if (request.status !== "pending_chain_grant") {
    throw new Error(`Cannot fail access bridge request from status "${request.status}".`);
  }
  if (failureReason.trim().length === 0) {
    throw new Error("failureReason is required.");
  }

  return {
    ...request,
    status: "failed",
    failureReason: failureReason.trim(),
    failedAt: at,
    updatedAt: at
  };
}
