import type { AccessBridgeRequest } from "./accessBridge";
import type { DeveloperProfile } from "./developerProfile";
import type { PlatformOrder } from "./orderState";
import type { RefundCase } from "./refundPolicy";

export interface ReputationSnapshot {
  subjectType: "agent" | "developer";
  subjectId: string;
  score: number;
  tier: "low" | "medium" | "high";
  source: "local-farr-adapter";
  updatedAt: string;
  signals: {
    paidOrders: number;
    confirmedAccessBridges: number;
    refunds: number;
    severeRefunds: number;
    developerTrustScore?: number;
  };
}

export function buildAgentReputationSnapshot(
  agentId: string,
  input: {
    orders: readonly PlatformOrder[];
    bridges: readonly AccessBridgeRequest[];
    refunds: readonly RefundCase[];
    developer?: DeveloperProfile;
  },
  at: string
): ReputationSnapshot {
  const paidOrders = input.orders.filter((order) => order.agentId === agentId && order.status === "paid").length;
  const confirmedAccessBridges = input.bridges.filter(
    (bridge) => bridge.agentId === agentId && bridge.status === "confirmed"
  ).length;
  const refunds = input.refunds.filter((refund) => refund.agentId === agentId).length;
  const severeRefunds = input.refunds.filter(
    (refund) =>
      refund.agentId === agentId &&
      (refund.category === "security_incident" || refund.category === "access_delivery_failure")
  ).length;
  const baseScore = 60 + confirmedAccessBridges * 5 + paidOrders * 2 - refunds * 8 - severeRefunds * 12;
  const developerBoost = input.developer ? Math.round((input.developer.trustScore - 50) / 5) : 0;
  const score = clampScore(baseScore + developerBoost);

  return {
    subjectType: "agent",
    subjectId: agentId,
    score,
    tier: score >= 80 ? "high" : score >= 50 ? "medium" : "low",
    source: "local-farr-adapter",
    updatedAt: at,
    signals: {
      paidOrders,
      confirmedAccessBridges,
      refunds,
      severeRefunds,
      developerTrustScore: input.developer?.trustScore
    }
  };
}

export function buildDeveloperReputationSnapshot(
  developer: DeveloperProfile,
  input: {
    linkedAgentIds: readonly string[];
    orders: readonly PlatformOrder[];
    bridges: readonly AccessBridgeRequest[];
    refunds: readonly RefundCase[];
  },
  at: string
): ReputationSnapshot {
  const linkedAgents = new Set(input.linkedAgentIds);
  const paidOrders = input.orders.filter((order) => linkedAgents.has(order.agentId) && order.status === "paid").length;
  const confirmedAccessBridges = input.bridges.filter(
    (bridge) => linkedAgents.has(bridge.agentId) && bridge.status === "confirmed"
  ).length;
  const refunds = input.refunds.filter((refund) => linkedAgents.has(refund.agentId)).length;
  const severeRefunds = input.refunds.filter(
    (refund) =>
      linkedAgents.has(refund.agentId) &&
      (refund.category === "security_incident" || refund.category === "access_delivery_failure")
  ).length;
  const score = clampScore(developer.trustScore + confirmedAccessBridges * 3 + paidOrders - refunds * 6 - severeRefunds * 10);

  return {
    subjectType: "developer",
    subjectId: developer.developerId,
    score,
    tier: score >= 80 ? "high" : score >= 50 ? "medium" : "low",
    source: "local-farr-adapter",
    updatedAt: at,
    signals: {
      paidOrders,
      confirmedAccessBridges,
      refunds,
      severeRefunds,
      developerTrustScore: developer.trustScore
    }
  };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
