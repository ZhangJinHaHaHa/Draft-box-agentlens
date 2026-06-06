import { createHash } from "node:crypto";

export type UsageReviewDimension =
  | "security"
  | "taskExecution"
  | "cognitive"
  | "environment"
  | "engineering"
  | "compliance";

export type UsageReviewDimensionRating = 0 | 1 | 2;

export type UsageReviewDimensionRatings = Record<UsageReviewDimension, UsageReviewDimensionRating>;

export interface UsageReviewRecord {
  reviewId: string;
  orderId: string;
  userId: string;
  agentId: string;
  overallRating: number;
  dimensionRatings: UsageReviewDimensionRatings;
  capabilityMatched?: boolean;
  safetyIncidentReported?: boolean;
  commentText?: string;
  commentHash: string;
  evidenceUrl?: string;
  createdAt: string;
}

export interface UsageReviewSummary {
  agentId: string;
  reviewCount: number;
  averageRating: number | null;
  platformRating: number | null;
  dimensionGoodRatios: Record<UsageReviewDimension, number>;
  capabilityMismatchReports: number;
  safetyIncidentReports: number;
  latestReviewAt?: string;
}

export const USAGE_REVIEW_DIMENSIONS = [
  "security",
  "taskExecution",
  "cognitive",
  "environment",
  "engineering",
  "compliance"
] as const satisfies readonly UsageReviewDimension[];

export function createUsageReviewRecord(
  input: Omit<UsageReviewRecord, "commentHash" | "createdAt">,
  at: string
): UsageReviewRecord {
  return {
    ...input,
    commentHash: computeUsageReviewCommentHash(input.commentText ?? ""),
    createdAt: at
  };
}

export function summarizeUsageReviews(
  agentId: string,
  reviews: readonly UsageReviewRecord[]
): UsageReviewSummary {
  const scoped = reviews.filter((review) => review.agentId === agentId);
  const dimensionGoodRatios = Object.fromEntries(
    USAGE_REVIEW_DIMENSIONS.map((dimension) => {
      const goodCount = scoped.filter((review) => review.dimensionRatings[dimension] === 2).length;
      return [dimension, scoped.length === 0 ? 0 : round(goodCount / scoped.length, 4)];
    })
  ) as Record<UsageReviewDimension, number>;
  const averageRating =
    scoped.length === 0
      ? null
      : round(scoped.reduce((sum, review) => sum + review.overallRating, 0) / scoped.length, 2);

  return {
    agentId,
    reviewCount: scoped.length,
    averageRating,
    platformRating: averageRating === null ? null : Math.round(averageRating * 20),
    dimensionGoodRatios,
    capabilityMismatchReports: scoped.filter((review) => review.capabilityMatched === false).length,
    safetyIncidentReports: scoped.filter((review) => review.safetyIncidentReported === true).length,
    latestReviewAt: scoped
      .map((review) => review.createdAt)
      .sort()
      .at(-1)
  };
}

export function inferDimensionRatingsFromOverall(overallRating: number): UsageReviewDimensionRatings {
  const rating: UsageReviewDimensionRating = overallRating >= 4 ? 2 : overallRating >= 3 ? 1 : 0;
  return Object.fromEntries(
    USAGE_REVIEW_DIMENSIONS.map((dimension) => [dimension, rating])
  ) as UsageReviewDimensionRatings;
}

function computeUsageReviewCommentHash(commentText: string): string {
  return `0x${createHash("sha256").update(commentText).digest("hex")}`;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
