import { isGatewayLeaseIssued, type PlatformOrder } from "./orderState";
import type { RefundCase } from "./refundPolicy";

export type SettlementStatus = "pending_holdback" | "frozen" | "released" | "refunded";

export interface SettlementLedgerEntry {
  settlementId: string;
  orderId: string;
  agentId: string;
  developerId: string;
  grossAmount: string;
  currency: string;
  platformFeeAmount: string;
  developerShareAmount: string;
  holdbackAmount: string;
  payableAmount: string;
  periodStart: string;
  periodEnd: string;
  status: SettlementStatus;
  createdAt: string;
  updatedAt: string;
  releasedAt?: string;
  frozenAt?: string;
  freezeReason?: string;
  refundId?: string;
}

export interface DeveloperSettlementSummary {
  developerId: string;
  entryCount: number;
  pendingGrossAmount: string;
  payableAmount: string;
  holdbackAmount: string;
  releasedAmount: string;
  frozenAmount: string;
  refundedAmount: string;
}

export function createSettlementLedgerEntry(
  input: {
    settlementId: string;
    order: PlatformOrder;
    developerId: string;
  },
  at: string
): SettlementLedgerEntry {
  if (!isGatewayLeaseIssued(input.order)) {
    throw new Error("Settlement entries can only be created for Gateway lease issued orders.");
  }
  const gross = parseAmount(input.order.paidAmount ?? input.order.amount ?? "0");
  const developerShare = gross * 0.8;
  const holdback = developerShare * 0.1;
  const period = resolveWeeklyPeriod(at);

  return {
    settlementId: input.settlementId,
    orderId: input.order.orderId,
    agentId: input.order.agentId,
    developerId: input.developerId,
    grossAmount: formatAmount(gross),
    currency: input.order.currency ?? "CREDITS",
    platformFeeAmount: formatAmount(gross * 0.2),
    developerShareAmount: formatAmount(developerShare),
    holdbackAmount: formatAmount(holdback),
    payableAmount: formatAmount(developerShare - holdback),
    periodStart: period.start,
    periodEnd: period.end,
    status: "pending_holdback",
    createdAt: at,
    updatedAt: at
  };
}

export function releaseSettlementEntry(entry: SettlementLedgerEntry, at: string): SettlementLedgerEntry {
  if (entry.status !== "pending_holdback") {
    throw new Error(`Cannot release settlement from status "${entry.status}".`);
  }

  return {
    ...entry,
    status: "released",
    releasedAt: at,
    updatedAt: at
  };
}

export function freezeSettlementEntry(
  entry: SettlementLedgerEntry,
  reason: string,
  refundId: string | undefined,
  at: string
): SettlementLedgerEntry {
  if (entry.status === "released" || entry.status === "refunded") {
    return entry;
  }
  const normalizedReason = reason.trim();
  if (normalizedReason.length === 0) {
    throw new Error("freeze reason is required.");
  }

  return {
    ...entry,
    status: "frozen",
    freezeReason: normalizedReason,
    refundId,
    frozenAt: at,
    updatedAt: at
  };
}

export function resolveSettlementAfterRefund(
  entry: SettlementLedgerEntry,
  refund: RefundCase,
  at: string
): SettlementLedgerEntry {
  if (refund.status === "approved" || refund.status === "partial_refund") {
    return {
      ...entry,
      status: "refunded",
      refundId: refund.refundId,
      updatedAt: at
    };
  }
  if (refund.status === "rejected" && entry.status === "frozen") {
    return {
      ...entry,
      status: "pending_holdback",
      updatedAt: at
    };
  }
  return entry;
}

export function summarizeDeveloperSettlements(
  developerId: string,
  entries: readonly SettlementLedgerEntry[]
): DeveloperSettlementSummary {
  const scoped = entries.filter((entry) => entry.developerId === developerId);
  return {
    developerId,
    entryCount: scoped.length,
    pendingGrossAmount: sumByStatus(scoped, ["pending_holdback"], "grossAmount"),
    payableAmount: sumByStatus(scoped, ["pending_holdback"], "payableAmount"),
    holdbackAmount: sumByStatus(scoped, ["pending_holdback"], "holdbackAmount"),
    releasedAmount: sumByStatus(scoped, ["released"], "developerShareAmount"),
    frozenAmount: sumByStatus(scoped, ["frozen"], "developerShareAmount"),
    refundedAmount: sumByStatus(scoped, ["refunded"], "developerShareAmount")
  };
}

function sumByStatus(
  entries: readonly SettlementLedgerEntry[],
  statuses: readonly SettlementStatus[],
  field: keyof Pick<
    SettlementLedgerEntry,
    "grossAmount" | "payableAmount" | "holdbackAmount" | "developerShareAmount"
  >
): string {
  const total = entries
    .filter((entry) => statuses.includes(entry.status))
    .reduce((sum, entry) => sum + parseAmount(entry[field]), 0);
  return formatAmount(total);
}

function resolveWeeklyPeriod(at: string): { start: string; end: string } {
  const date = new Date(at);
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function parseAmount(value: string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("amount must be a non-negative decimal.");
  }
  return amount;
}

function formatAmount(value: number): string {
  return value.toFixed(2);
}
