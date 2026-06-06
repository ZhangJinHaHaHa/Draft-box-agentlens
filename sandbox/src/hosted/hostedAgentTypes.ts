export interface HostedAgentReadme {
  agentName: string;
  displayName?: string;
  summary: string;
  useCases: string[];
  capabilities: string[];
  limitations: string[];
  example?: string;
  integrationType: string;
  docsUrl?: string;
  supportUrl?: string;
}

export interface HostedAgentIntegration {
  endpointUrl: string;
  schemaUrl: string;
  healthcheckUrl?: string;
  authMethod: string;
}

export interface HostedAgentCreateInput {
  readme: HostedAgentReadme;
  integration: HostedAgentIntegration;
  developerAddress?: string;
}

export type HostedAgentStatus = "draft" | "pending_review" | "approved" | "suspended";

export interface HostedAgentFingerprint {
  algorithm: "sha256";
  scope: "hosted-api";
  value: string;
  createdAt: string;
  subject: {
    agentName: string;
    endpointHost: string;
    schemaHost: string;
    developerAddress?: string;
  };
}

export type HostedAgentHealthcheckStatus = "not_configured" | "passed" | "failed";

export interface HostedAgentHealthcheckResult {
  status: HostedAgentHealthcheckStatus;
  checkedAt: string;
  url?: string;
  httpStatus?: number;
  latencyMs?: number;
  error?: string;
}

export interface HostedAgentReviewSubmission {
  reviewKind: "hosted-api-black-box";
  submittedAt: string;
  fingerprint: HostedAgentFingerprint;
  healthcheck: HostedAgentHealthcheckResult;
  notes: string[];
}

export interface HostedAgentApproval {
  approvedAt: string;
  reviewer?: string;
  note?: string;
}

export interface HostedAgentDraft extends HostedAgentCreateInput {
  hostedAgentId: string;
  status: HostedAgentStatus;
  createdAt: string;
  updatedAt: string;
  review?: HostedAgentReviewSubmission;
  approval?: HostedAgentApproval;
}
