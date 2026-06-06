import type { AccessBridgeRequest } from "./accessBridge";
import type { DeveloperProfile } from "./developerProfile";
import type { PlatformOrder } from "./orderState";
import type { RefundCase } from "./refundPolicy";
import {
  summarizeUsageReviews,
  type UsageReviewRecord
} from "./usageReview";

export interface ReputationSnapshot {
  subjectType: "agent" | "developer";
  subjectId: string;
  score: number;
  tier: "low" | "medium" | "high";
  source: "local-farr-adapter";
  updatedAt: string;
  signals: {
    paidOrders: number;
    gatewayLeasesIssued: number;
    pendingChainGrants: number;
    refunds: number;
    severeRefunds: number;
    reviewCount?: number;
    averageRating?: number | null;
    platformRating?: number | null;
    capabilityMismatchReports?: number;
    safetyIncidentReports?: number;
    developerTrustScore?: number;
  };
}

export function buildAgentReputationSnapshot(
  agentId: string,
  input: {
    orders: readonly PlatformOrder[];
    bridges: readonly AccessBridgeRequest[];
    refunds: readonly RefundCase[];
    reviews?: readonly UsageReviewRecord[];
    developer?: DeveloperProfile;
  },
  at: string
): ReputationSnapshot {
  const paidOrders = input.orders.filter((order) => order.agentId === agentId && Boolean(order.paidAt)).length;
  const gatewayLeasesIssued = input.orders.filter(
    (order) => order.agentId === agentId && order.status === "gateway_lease_issued"
  ).length;
  const pendingChainGrants = input.bridges.filter(
    (bridge) => bridge.agentId === agentId && bridge.status === "pending_chain_grant"
  ).length;
  const refunds = input.refunds.filter((refund) => refund.agentId === agentId).length;
  const severeRefunds = input.refunds.filter(
    (refund) =>
      refund.agentId === agentId &&
      (refund.category === "security_incident" || refund.category === "access_delivery_failure")
  ).length;
  const reviewSummary = summarizeUsageReviews(agentId, input.reviews ?? []);
  const reviewBoost =
    reviewSummary.platformRating === null ? 0 : Math.round((reviewSummary.platformRating - 60) / 5);
  const reviewPenalty =
    reviewSummary.capabilityMismatchReports * 4 + reviewSummary.safetyIncidentReports * 10;
  const baseScore =
    60 + gatewayLeasesIssued * 5 + paidOrders * 2 - refunds * 8 - severeRefunds * 12 + reviewBoost - reviewPenalty;
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
      gatewayLeasesIssued,
      pendingChainGrants,
      refunds,
      severeRefunds,
      reviewCount: reviewSummary.reviewCount,
      averageRating: reviewSummary.averageRating,
      platformRating: reviewSummary.platformRating,
      capabilityMismatchReports: reviewSummary.capabilityMismatchReports,
      safetyIncidentReports: reviewSummary.safetyIncidentReports,
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
    reviews?: readonly UsageReviewRecord[];
  },
  at: string
): ReputationSnapshot {
  const linkedAgents = new Set(input.linkedAgentIds);
  const paidOrders = input.orders.filter((order) => linkedAgents.has(order.agentId) && Boolean(order.paidAt)).length;
  const gatewayLeasesIssued = input.orders.filter(
    (order) => linkedAgents.has(order.agentId) && order.status === "gateway_lease_issued"
  ).length;
  const pendingChainGrants = input.bridges.filter(
    (bridge) => linkedAgents.has(bridge.agentId) && bridge.status === "pending_chain_grant"
  ).length;
  const refunds = input.refunds.filter((refund) => linkedAgents.has(refund.agentId)).length;
  const severeRefunds = input.refunds.filter(
    (refund) =>
      linkedAgents.has(refund.agentId) &&
      (refund.category === "security_incident" || refund.category === "access_delivery_failure")
  ).length;
  const reviews = (input.reviews ?? []).filter((review) => linkedAgents.has(review.agentId));
  const reviewCount = reviews.length;
  const averageRating =
    reviewCount === 0
      ? null
      : Math.round((reviews.reduce((sum, review) => sum + review.overallRating, 0) / reviewCount) * 100) / 100;
  const platformRating = averageRating === null ? null : Math.round(averageRating * 20);
  const capabilityMismatchReports = reviews.filter((review) => review.capabilityMatched === false).length;
  const safetyIncidentReports = reviews.filter((review) => review.safetyIncidentReported === true).length;
  const reviewBoost = platformRating === null ? 0 : Math.round((platformRating - 60) / 6);
  const reviewPenalty = capabilityMismatchReports * 3 + safetyIncidentReports * 8;
  const score = clampScore(
    developer.trustScore + gatewayLeasesIssued * 3 + paidOrders - refunds * 6 - severeRefunds * 10 + reviewBoost - reviewPenalty
  );

  return {
    subjectType: "developer",
    subjectId: developer.developerId,
    score,
    tier: score >= 80 ? "high" : score >= 50 ? "medium" : "low",
    source: "local-farr-adapter",
    updatedAt: at,
    signals: {
      paidOrders,
      gatewayLeasesIssued,
      pendingChainGrants,
      refunds,
      severeRefunds,
      reviewCount,
      averageRating,
      platformRating,
      capabilityMismatchReports,
      safetyIncidentReports,
      developerTrustScore: developer.trustScore
    }
  };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
