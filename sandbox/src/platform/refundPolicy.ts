export type RefundCaseStatus = "requested" | "under_review" | "approved" | "rejected" | "partial_refund";

export type RefundIssueCategory =
  | "security_incident"
  | "access_delivery_failure"
  | "core_capability_failure"
  | "agent_unavailable"
  | "design_mismatch"
  | "user_setup_issue"
  | "subjective_quality";

export type RefundEligibility = "refundable" | "review_required" | "not_refundable";

export interface RefundCase {
  refundId: string;
  orderId: string;
  userId: string;
  agentId: string;
  category: RefundIssueCategory;
  status: RefundCaseStatus;
  eligibility: RefundEligibility;
  requestedAt: string;
  updatedAt: string;
  reviewerId?: string;
  reviewNote?: string;
  resolvedAt?: string;
  refundAmount?: string;
}

const ALLOWED_REFUND_TRANSITIONS: Record<RefundCaseStatus, RefundCaseStatus[]> = {
  requested: ["under_review"],
  under_review: ["approved", "rejected", "partial_refund"],
  approved: [],
  rejected: [],
  partial_refund: []
};

export function classifyRefundEligibility(category: RefundIssueCategory): RefundEligibility {
  switch (category) {
    case "security_incident":
    case "access_delivery_failure":
    case "agent_unavailable":
      return "refundable";
    case "core_capability_failure":
      return "review_required";
    case "design_mismatch":
    case "user_setup_issue":
    case "subjective_quality":
      return "not_refundable";
  }
}

export function createRefundCase(
  input: {
    refundId: string;
    orderId: string;
    userId: string;
    agentId: string;
    category: RefundIssueCategory;
  },
  at: string
): RefundCase {
  return {
    ...input,
    status: "requested",
    eligibility: classifyRefundEligibility(input.category),
    requestedAt: at,
    updatedAt: at
  };
}

export function startRefundReview(
  refundCase: RefundCase,
  reviewerId: string,
  at: string
): RefundCase {
  assertValidRefundTransition(refundCase.status, "under_review");
  if (reviewerId.trim().length === 0) {
    throw new Error("reviewerId is required.");
  }

  return {
    ...refundCase,
    status: "under_review",
    reviewerId: reviewerId.trim(),
    updatedAt: at
  };
}

export function resolveRefundCase(
  refundCase: RefundCase,
  outcome: "approved" | "rejected" | "partial_refund",
  input: {
    reviewNote: string;
    refundAmount?: string;
  },
  at: string
): RefundCase {
  assertValidRefundTransition(refundCase.status, outcome);
  if (input.reviewNote.trim().length === 0) {
    throw new Error("reviewNote is required.");
  }
  if ((outcome === "approved" || outcome === "partial_refund") && !input.refundAmount) {
    throw new Error("refundAmount is required for approved refunds.");
  }

  return {
    ...refundCase,
    status: outcome,
    reviewNote: input.reviewNote.trim(),
    ...(input.refundAmount ? { refundAmount: input.refundAmount } : {}),
    resolvedAt: at,
    updatedAt: at
  };
}

export function assertValidRefundTransition(from: RefundCaseStatus, to: RefundCaseStatus): void {
  if (!ALLOWED_REFUND_TRANSITIONS[from].includes(to)) {
    throw new Error(`Invalid refund status transition: cannot move from "${from}" to "${to}".`);
  }
}
