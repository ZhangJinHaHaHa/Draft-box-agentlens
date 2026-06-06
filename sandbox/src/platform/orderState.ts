export type PlatformOrderStatus = "pending" | "gateway_lease_issued" | "failed" | "refunded";
export type PlatformOrderCurrency = "USD" | "CREDITS";
export type ChainGrantStatus = "pending_chain_grant";

export interface PlatformOrder {
  orderId: string;
  userId: string;
  agentId: string;
  status: PlatformOrderStatus;
  amount?: string;
  currency?: PlatformOrderCurrency;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  paymentProvider?: string;
  providerPaymentId?: string;
  idempotencyKey?: string;
  paidAmount?: string;
  refundedAt?: string;
  failureReason?: string;
  gatewayLeaseToken?: string;
  gatewayLeaseIssuedAt?: string;
  gatewayLeaseExpiresAt?: string;
  chainGrantStatus?: ChainGrantStatus;
}

const ALLOWED_TRANSITIONS: Record<PlatformOrderStatus, PlatformOrderStatus[]> = {
  pending: ["gateway_lease_issued", "failed"],
  gateway_lease_issued: ["refunded"],
  failed: [],
  refunded: []
};

export function isValidOrderTransition(
  from: PlatformOrderStatus,
  to: PlatformOrderStatus
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertValidOrderTransition(
  from: PlatformOrderStatus,
  to: PlatformOrderStatus
): void {
  if (!isValidOrderTransition(from, to)) {
    throw new Error(`Invalid order status transition: cannot move from "${from}" to "${to}".`);
  }
}

export function transitionOrderStatus(
  order: PlatformOrder,
  to: PlatformOrderStatus,
  at: string,
  details: { failureReason?: string } = {}
): PlatformOrder {
  assertValidOrderTransition(order.status, to);

  return {
    ...order,
    status: to,
    updatedAt: at,
    ...(to === "gateway_lease_issued" ? { paidAt: at, gatewayLeaseIssuedAt: at } : {}),
    ...(to === "failed" && details.failureReason ? { failureReason: details.failureReason } : {}),
    ...(to === "refunded" ? { refundedAt: at } : {})
  };
}

export function isGatewayLeaseIssued(order: PlatformOrder): boolean {
  return order.status === "gateway_lease_issued";
}

export function assertOrderReadyForAccessBridge(order: PlatformOrder): void {
  if (!isGatewayLeaseIssued(order)) {
    throw new Error(`Order "${order.orderId}" must have a Gateway lease before chain grant can be queued.`);
  }
  if (order.chainGrantStatus && order.chainGrantStatus !== "pending_chain_grant") {
    throw new Error(`Order "${order.orderId}" has an unsupported chain grant status.`);
  }
}
