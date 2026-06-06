export interface HostedAgentReadmePayload {
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

export interface HostedAgentIntegrationPayload {
  endpointUrl: string;
  schemaUrl: string;
  healthcheckUrl?: string;
  authMethod: string;
}

export interface HostedAgentDraftInput {
  readme: HostedAgentReadmePayload;
  integration: HostedAgentIntegrationPayload;
  developerAddress?: string;
}

export type HostedAgentDraftResult =
  | {
      ok: true;
      hostedAgentId: string;
      status: string;
      createdAt?: string;
    }
  | {
      ok: false;
      error: string;
    };

export interface HostedAgentFingerprintPayload {
  algorithm: string;
  scope: string;
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

export interface HostedAgentHealthcheckPayload {
  status: HostedAgentHealthcheckStatus;
  checkedAt: string;
  url?: string;
  httpStatus?: number;
  latencyMs?: number;
  error?: string;
}

export type HostedAgentReviewResult =
  | {
      ok: true;
      hostedAgentId: string;
      status: string;
      submittedAt?: string;
      fingerprint: HostedAgentFingerprintPayload;
      healthcheck: HostedAgentHealthcheckPayload;
      notes: string[];
    }
  | {
      ok: false;
      error: string;
    };

export interface HostedAgentApprovalPayload {
  approvedAt: string;
  reviewer?: string;
  note?: string;
}

export type HostedAgentApprovalResult =
  | {
      ok: true;
      hostedAgentId: string;
      status: string;
      approval?: HostedAgentApprovalPayload;
    }
  | {
      ok: false;
      error: string;
    };

export interface HostedAgentSecretInput {
  authHeaderName: string;
  authHeaderValue: string;
}

export type HostedAgentSecretResult =
  | {
      ok: true;
      hostedAgentId: string;
      secretConfigured: boolean;
      authHeaderName: string;
      updatedAt?: string;
    }
  | {
      ok: false;
      error: string;
    };

export interface HostedAgentLeaseInput {
  userId: string;
  durationHours: number;
  maxRequests: number;
  maxRequestsPerMinute?: number;
}

export interface HostedAgentLeasePayload {
  leaseId: string;
  hostedAgentId: string;
  userId: string;
  accessToken: string;
  createdAt: string;
  expiresAt: string;
  maxRequests: number;
  maxRequestsPerMinute: number;
  requestCount: number;
}

export type HostedAgentLeaseResult =
  | {
      ok: true;
      hostedAgentId: string;
      lease: HostedAgentLeasePayload;
    }
  | {
      ok: false;
      error: string;
    };

export type HostedAgentInvokeResult =
  | {
      ok: true;
      requestId: string;
      hostedAgentId?: string;
      leaseId?: string;
      downstreamStatus?: number;
      latencyMs?: number;
      response?: unknown;
    }
  | {
      ok: false;
      error: string;
      requestId?: string;
    };

export interface HostedAgentGatewaySummaryPayload {
  secretConfigured: boolean;
  activeLeaseCount: number;
  totalRequestCount: number;
  failedRequestCount: number;
  latestRequestAt?: string;
}

export type HostedAgentGatewaySummaryResult =
  | {
      ok: true;
      hostedAgentId: string;
      status: string;
      gateway: HostedAgentGatewaySummaryPayload;
    }
  | {
      ok: false;
      error: string;
    };

export interface HostedAgentClientDependencies {
  endpointUrl: string;
  fetchImpl?: typeof fetch;
}

export async function submitHostedAgentDraft(
  input: HostedAgentDraftInput,
  { endpointUrl, fetchImpl = fetch }: HostedAgentClientDependencies
): Promise<HostedAgentDraftResult> {
  let response: Response;

  try {
    response = await fetchImpl(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
  } catch {
    return {
      ok: false,
      error: "Failed to save the hosted Agent draft."
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: (await readErrorMessage(response)) ?? "The hosted Agent draft was rejected."
    };
  }

  const payload = await readJsonPayload(response);
  const hostedAgentId = readStringField(payload, "hostedAgentId");

  if (!hostedAgentId) {
    return {
      ok: false,
      error: "The hosted Agent API returned an invalid response."
    };
  }

  return {
    ok: true,
    hostedAgentId,
    status: readStringField(payload, "status") ?? "draft",
    createdAt: readStringField(payload, "createdAt")
  };
}

export async function submitHostedAgentForReview(
  hostedAgentId: string,
  { endpointUrl, fetchImpl = fetch }: HostedAgentClientDependencies
): Promise<HostedAgentReviewResult> {
  let response: Response;

  try {
    response = await fetchImpl(buildHostedReviewUrl(endpointUrl, hostedAgentId), {
      method: "POST"
    });
  } catch {
    return {
      ok: false,
      error: "Failed to submit the hosted Agent for review."
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: (await readErrorMessage(response)) ?? "The hosted Agent review submission was rejected."
    };
  }

  const payload = await readJsonPayload(response);
  const parsed = parseHostedReviewPayload(payload);

  if (!parsed) {
    return {
      ok: false,
      error: "The hosted Agent API returned an invalid review response."
    };
  }

  return parsed;
}

export async function approveHostedAgent(
  hostedAgentId: string,
  input: { reviewer?: string; note?: string },
  dependencies: HostedAgentClientDependencies
): Promise<HostedAgentApprovalResult> {
  const response = await postHostedSubresource(
    hostedAgentId,
    "approve",
    input,
    dependencies,
    "Failed to approve the hosted Agent.",
    "The hosted Agent approval was rejected."
  );
  if (!response.ok) return response;

  const hostedAgentIdField = readStringField(response.payload, "hostedAgentId");
  if (!hostedAgentIdField) {
    return { ok: false, error: "The hosted Agent API returned an invalid approval response." };
  }

  return {
    ok: true,
    hostedAgentId: hostedAgentIdField,
    status: readStringField(response.payload, "status") ?? "approved",
    ...(parseApproval(readRecordField(response.payload, "approval"))
      ? { approval: parseApproval(readRecordField(response.payload, "approval")) }
      : {})
  };
}

export async function configureHostedAgentSecret(
  hostedAgentId: string,
  input: HostedAgentSecretInput,
  dependencies: HostedAgentClientDependencies
): Promise<HostedAgentSecretResult> {
  const response = await postHostedSubresource(
    hostedAgentId,
    "secret",
    input,
    dependencies,
    "Failed to configure the hosted Agent gateway secret.",
    "The hosted Agent gateway secret was rejected."
  );
  if (!response.ok) return response;

  const hostedAgentIdField = readStringField(response.payload, "hostedAgentId");
  const authHeaderName = readStringField(response.payload, "authHeaderName");
  if (!hostedAgentIdField || !authHeaderName) {
    return { ok: false, error: "The hosted Agent API returned an invalid secret response." };
  }

  return {
    ok: true,
    hostedAgentId: hostedAgentIdField,
    secretConfigured: readBooleanField(response.payload, "secretConfigured") ?? false,
    authHeaderName,
    updatedAt: readStringField(response.payload, "updatedAt")
  };
}

export async function createHostedAgentLease(
  hostedAgentId: string,
  input: HostedAgentLeaseInput,
  dependencies: HostedAgentClientDependencies
): Promise<HostedAgentLeaseResult> {
  const response = await postHostedSubresource(
    hostedAgentId,
    "leases",
    input,
    dependencies,
    "Failed to create the hosted Agent lease.",
    "The hosted Agent lease was rejected."
  );
  if (!response.ok) return response;

  const hostedAgentIdField = readStringField(response.payload, "hostedAgentId");
  const lease = parseLease(readRecordField(response.payload, "lease"));
  if (!hostedAgentIdField || !lease) {
    return { ok: false, error: "The hosted Agent API returned an invalid lease response." };
  }

  return {
    ok: true,
    hostedAgentId: hostedAgentIdField,
    lease
  };
}

export async function invokeHostedAgent(
  hostedAgentId: string,
  accessToken: string,
  payload: unknown,
  { endpointUrl, fetchImpl = fetch }: HostedAgentClientDependencies
): Promise<HostedAgentInvokeResult> {
  let response: Response;

  try {
    response = await fetchImpl(buildHostedSubresourceUrl(endpointUrl, hostedAgentId, "invoke"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });
  } catch {
    return {
      ok: false,
      error: "Failed to invoke the hosted Agent gateway."
    };
  }

  const responsePayload = await readJsonPayload(response);
  if (!response.ok) {
    return {
      ok: false,
      error: readStringField(responsePayload, "error") ?? "The hosted Agent gateway invocation failed.",
      requestId: readStringField(responsePayload, "requestId")
    };
  }

  const requestId = readStringField(responsePayload, "requestId");
  if (!requestId) {
    return { ok: false, error: "The hosted Agent API returned an invalid invocation response." };
  }

  return {
    ok: true,
    requestId,
    hostedAgentId: readStringField(responsePayload, "hostedAgentId"),
    leaseId: readStringField(responsePayload, "leaseId"),
    downstreamStatus: readNumberField(responsePayload, "downstreamStatus"),
    latencyMs: readNumberField(responsePayload, "latencyMs"),
    response: readUnknownField(responsePayload, "response")
  };
}

export async function getHostedAgentGatewaySummary(
  hostedAgentId: string,
  { endpointUrl, fetchImpl = fetch }: HostedAgentClientDependencies
): Promise<HostedAgentGatewaySummaryResult> {
  let response: Response;

  try {
    response = await fetchImpl(buildHostedSubresourceUrl(endpointUrl, hostedAgentId, "gateway"), {
      method: "GET"
    });
  } catch {
    return {
      ok: false,
      error: "Failed to load the hosted Agent gateway summary."
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: (await readErrorMessage(response)) ?? "The hosted Agent gateway summary could not be loaded."
    };
  }

  const payload = await readJsonPayload(response);
  const hostedAgentIdField = readStringField(payload, "hostedAgentId");
  const gateway = parseGatewaySummary(readRecordField(payload, "gateway"));
  if (!hostedAgentIdField || !gateway) {
    return { ok: false, error: "The hosted Agent API returned an invalid gateway summary." };
  }

  return {
    ok: true,
    hostedAgentId: hostedAgentIdField,
    status: readStringField(payload, "status") ?? "unknown",
    gateway
  };
}

function buildHostedReviewUrl(endpointUrl: string, hostedAgentId: string): string {
  return buildHostedSubresourceUrl(endpointUrl, hostedAgentId, "submit-review");
}

function buildHostedSubresourceUrl(endpointUrl: string, hostedAgentId: string, subresource: string): string {
  return `${endpointUrl.replace(/\/+$/, "")}/${encodeURIComponent(hostedAgentId)}/${subresource}`;
}

async function postHostedSubresource(
  hostedAgentId: string,
  subresource: string,
  body: unknown,
  { endpointUrl, fetchImpl = fetch }: HostedAgentClientDependencies,
  networkError: string,
  rejectedError: string
): Promise<{ ok: true; payload: unknown } | { ok: false; error: string }> {
  let response: Response;

  try {
    response = await fetchImpl(buildHostedSubresourceUrl(endpointUrl, hostedAgentId, subresource), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  } catch {
    return {
      ok: false,
      error: networkError
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: (await readErrorMessage(response)) ?? rejectedError
    };
  }

  return {
    ok: true,
    payload: await readJsonPayload(response)
  };
}

async function readErrorMessage(response: Response): Promise<string | undefined> {
  const payload = await readJsonPayload(response);
  return readStringField(payload, "error") ?? readStringField(payload, "message");
}

async function readJsonPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return undefined;
  }

  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function readStringField(payload: unknown, field: string): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const value = (payload as Record<string, unknown>)[field];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readNumberField(payload: unknown, field: string): number | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const value = (payload as Record<string, unknown>)[field];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBooleanField(payload: unknown, field: string): boolean | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const value = (payload as Record<string, unknown>)[field];
  return typeof value === "boolean" ? value : undefined;
}

function readUnknownField(payload: unknown, field: string): unknown {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  return (payload as Record<string, unknown>)[field];
}

function readStringArrayField(payload: unknown, field: string): string[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const value = (payload as Record<string, unknown>)[field];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function readRecordField(payload: unknown, field: string): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const value = (payload as Record<string, unknown>)[field];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseHostedReviewPayload(payload: unknown): HostedAgentReviewResult | undefined {
  const hostedAgentId = readStringField(payload, "hostedAgentId");
  const fingerprintRecord = readRecordField(payload, "fingerprint");
  const healthcheckRecord = readRecordField(payload, "healthcheck");
  const fingerprint = parseFingerprint(fingerprintRecord);
  const healthcheck = parseHealthcheck(healthcheckRecord);

  if (!hostedAgentId || !fingerprint || !healthcheck) {
    return undefined;
  }

  return {
    ok: true,
    hostedAgentId,
    status: readStringField(payload, "status") ?? "pending_review",
    submittedAt: readStringField(payload, "submittedAt"),
    fingerprint,
    healthcheck,
    notes: readStringArrayField(payload, "notes")
  };
}

function parseApproval(payload: unknown): HostedAgentApprovalPayload | undefined {
  const approvedAt = readStringField(payload, "approvedAt");
  if (!approvedAt) return undefined;

  return {
    approvedAt,
    ...(readStringField(payload, "reviewer") ? { reviewer: readStringField(payload, "reviewer") } : {}),
    ...(readStringField(payload, "note") ? { note: readStringField(payload, "note") } : {})
  };
}

function parseLease(payload: unknown): HostedAgentLeasePayload | undefined {
  const leaseId = readStringField(payload, "leaseId");
  const hostedAgentId = readStringField(payload, "hostedAgentId");
  const userId = readStringField(payload, "userId");
  const accessToken = readStringField(payload, "accessToken");
  const createdAt = readStringField(payload, "createdAt");
  const expiresAt = readStringField(payload, "expiresAt");
  const maxRequests = readNumberField(payload, "maxRequests");
  const maxRequestsPerMinute = readNumberField(payload, "maxRequestsPerMinute");
  const requestCount = readNumberField(payload, "requestCount");

  if (
    !leaseId ||
    !hostedAgentId ||
    !userId ||
    !accessToken ||
    !createdAt ||
    !expiresAt ||
    maxRequests === undefined ||
    maxRequestsPerMinute === undefined ||
    requestCount === undefined
  ) {
    return undefined;
  }

  return {
    leaseId,
    hostedAgentId,
    userId,
    accessToken,
    createdAt,
    expiresAt,
    maxRequests,
    maxRequestsPerMinute,
    requestCount
  };
}

function parseGatewaySummary(payload: unknown): HostedAgentGatewaySummaryPayload | undefined {
  const secretConfigured = readBooleanField(payload, "secretConfigured");
  const activeLeaseCount = readNumberField(payload, "activeLeaseCount");
  const totalRequestCount = readNumberField(payload, "totalRequestCount");
  const failedRequestCount = readNumberField(payload, "failedRequestCount");

  if (
    secretConfigured === undefined ||
    activeLeaseCount === undefined ||
    totalRequestCount === undefined ||
    failedRequestCount === undefined
  ) {
    return undefined;
  }

  return {
    secretConfigured,
    activeLeaseCount,
    totalRequestCount,
    failedRequestCount,
    latestRequestAt: readStringField(payload, "latestRequestAt")
  };
}

function parseFingerprint(payload: unknown): HostedAgentFingerprintPayload | undefined {
  const subject = readRecordField(payload, "subject");
  const agentName = readStringField(subject, "agentName");
  const endpointHost = readStringField(subject, "endpointHost");
  const schemaHost = readStringField(subject, "schemaHost");
  const algorithm = readStringField(payload, "algorithm");
  const scope = readStringField(payload, "scope");
  const value = readStringField(payload, "value");
  const createdAt = readStringField(payload, "createdAt");

  if (!algorithm || !scope || !value || !createdAt || !agentName || !endpointHost || !schemaHost) {
    return undefined;
  }

  return {
    algorithm,
    scope,
    value,
    createdAt,
    subject: {
      agentName,
      endpointHost,
      schemaHost,
      ...(readStringField(subject, "developerAddress")
        ? { developerAddress: readStringField(subject, "developerAddress") }
        : {})
    }
  };
}

function parseHealthcheck(payload: unknown): HostedAgentHealthcheckPayload | undefined {
  const status = readStringField(payload, "status");
  const checkedAt = readStringField(payload, "checkedAt");

  if (!isHostedHealthcheckStatus(status) || !checkedAt) {
    return undefined;
  }

  return {
    status,
    checkedAt,
    ...(readStringField(payload, "url") ? { url: readStringField(payload, "url") } : {}),
    ...(readNumberField(payload, "httpStatus") !== undefined
      ? { httpStatus: readNumberField(payload, "httpStatus") }
      : {}),
    ...(readNumberField(payload, "latencyMs") !== undefined
      ? { latencyMs: readNumberField(payload, "latencyMs") }
      : {}),
    ...(readStringField(payload, "error") ? { error: readStringField(payload, "error") } : {})
  };
}

function isHostedHealthcheckStatus(value: string | undefined): value is HostedAgentHealthcheckStatus {
  return value === "not_configured" || value === "passed" || value === "failed";
}
