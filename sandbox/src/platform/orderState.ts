export type PlatformOrderStatus = "pending" | "paid" | "failed" | "refunded";
export type PlatformOrderCurrency = "USD" | "CREDITS";

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
  chainAccessTxHash?: string;
}

const ALLOWED_TRANSITIONS: Record<PlatformOrderStatus, PlatformOrderStatus[]> = {
  pending: ["paid", "failed"],
  paid: ["refunded"],
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
    ...(to === "paid" ? { paidAt: at } : {}),
    ...(to === "failed" && details.failureReason ? { failureReason: details.failureReason } : {}),
    ...(to === "refunded" ? { refundedAt: at } : {})
  };
}

export function assertOrderReadyForAccessBridge(order: PlatformOrder): void {
  if (order.status !== "paid") {
    throw new Error(`Order "${order.orderId}" must be paid before access can be bridged.`);
  }
  if (order.chainAccessTxHash) {
    throw new Error(`Order "${order.orderId}" already has a chain access transaction.`);
  }
}

export function markOrderAccessBridged(
  order: PlatformOrder,
  chainAccessTxHash: string,
  at: string
): PlatformOrder {
  assertOrderReadyForAccessBridge(order);
  if (!/^0x[0-9a-fA-F]{64}$/.test(chainAccessTxHash)) {
    throw new Error("chainAccessTxHash must be a 32-byte transaction hash.");
  }

  return {
    ...order,
    chainAccessTxHash,
    updatedAt: at
  };
}
