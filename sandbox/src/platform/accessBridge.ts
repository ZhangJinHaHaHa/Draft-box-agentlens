import { assertOrderReadyForAccessBridge, type PlatformOrder } from "./orderState";
import { assertEthereumAddress } from "./web2Wallet";

export type AccessBridgeStatus = "queued" | "submitted" | "confirmed" | "failed";

export interface AccessBridgeRequest {
  bridgeId: string;
  orderId: string;
  userId: string;
  agentId: string;
  userWalletAddress: string;
  status: AccessBridgeStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  confirmedAt?: string;
  failedAt?: string;
  chainAccessTxHash?: string;
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

  return {
    bridgeId: input.bridgeId,
    orderId: input.order.orderId,
    userId: input.order.userId,
    agentId: input.order.agentId,
    userWalletAddress: input.userWalletAddress,
    status: "queued",
    createdAt: at,
    updatedAt: at
  };
}

export function markAccessBridgeSubmitted(
  request: AccessBridgeRequest,
  chainAccessTxHash: string,
  at: string
): AccessBridgeRequest {
  if (request.status !== "queued" && request.status !== "failed") {
    throw new Error(`Cannot submit access bridge request from status "${request.status}".`);
  }
  assertTransactionHash(chainAccessTxHash);

  return {
    ...request,
    status: "submitted",
    chainAccessTxHash,
    submittedAt: at,
    updatedAt: at,
    failureReason: undefined,
    failedAt: undefined
  };
}

export function markAccessBridgeConfirmed(
  request: AccessBridgeRequest,
  at: string
): AccessBridgeRequest {
  if (request.status !== "submitted") {
    throw new Error(`Cannot confirm access bridge request from status "${request.status}".`);
  }

  return {
    ...request,
    status: "confirmed",
    confirmedAt: at,
    updatedAt: at
  };
}

export function markAccessBridgeFailed(
  request: AccessBridgeRequest,
  failureReason: string,
  at: string
): AccessBridgeRequest {
  if (request.status !== "queued" && request.status !== "submitted") {
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

function assertTransactionHash(value: string): void {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("chainAccessTxHash must be a 32-byte transaction hash.");
  }
}
