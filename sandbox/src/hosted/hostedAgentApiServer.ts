import { createServer, type Server } from "node:http";

import type {
  HostedAgentApproval,
  HostedAgentCreateInput,
  HostedAgentDraft,
  HostedAgentIntegration,
  HostedAgentReadme,
  HostedAgentReviewSubmission
} from "./hostedAgentTypes";
import type {
  HostedAgentGatewayStore,
  HostedAgentLeaseInput,
  HostedAgentSecretInput,
  HostedAgentUsageLog
} from "./hostedAgentGatewayStore";
import { createHostedAgentFingerprint } from "./hostedAgentFingerprint";
import { runHostedAgentHealthcheck } from "./hostedAgentHealthcheck";

const MAX_JSON_BODY_BYTES = 1024 * 1024;

export interface HostedAgentStoreLike {
  createHostedAgent(input: HostedAgentCreateInput): Promise<HostedAgentDraft>;
  listHostedAgents(): Promise<HostedAgentDraft[]>;
  findHostedAgentById(hostedAgentId: string): Promise<HostedAgentDraft | undefined>;
  submitHostedAgentForReview(
    hostedAgentId: string,
    review: HostedAgentReviewSubmission
  ): Promise<HostedAgentDraft | undefined>;
  approveHostedAgent(
    hostedAgentId: string,
    approval: HostedAgentApproval
  ): Promise<HostedAgentDraft | undefined>;
}

export interface HostedAgentApiServerOptions {
  store: HostedAgentStoreLike;
  gatewayStore?: HostedAgentGatewayStore;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  healthcheckTimeoutMs?: number;
}

interface HostedAgentRequestLike extends AsyncIterable<Buffer | string> {
  method?: string;
  url?: string;
  headers?: {
    authorization?: string | string[];
    origin?: string | string[];
    [key: string]: string | string[] | undefined;
  };
}

interface HostedAgentResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

export function createHostedAgentApiServer(options: HostedAgentApiServerOptions): Server {
  return createServer((request, response) => {
    void handleHostedAgentApiRequest(request, response, options.store, options).catch((error) => {
      if (response.writableEnded) return;
      const message = error instanceof Error ? error.message : "Invalid hosted Agent request.";
      writeJson(response, 400, { error: message });
    });
  });
}

export async function handleHostedAgentApiRequest(
  request: HostedAgentRequestLike,
  response: HostedAgentResponseLike,
  store: HostedAgentStoreLike,
  options: Omit<HostedAgentApiServerOptions, "store"> = {}
): Promise<void> {
  setCorsHeaders(response);

  const pathname = parseRequestPathname(request.url);

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end("");
    return;
  }

  if (request.method === "POST" && pathname === "/api/hosted-agents") {
    try {
      const payload = parseHostedAgentPayload(await readJsonBody(request));
      const created = await store.createHostedAgent(payload);
      writeJson(response, 201, {
        hostedAgentId: created.hostedAgentId,
        status: created.status,
        createdAt: created.createdAt
      });
    } catch (error) {
      writeJson(response, 400, {
        error: error instanceof Error ? error.message : "Invalid hosted Agent request."
      });
    }

    return;
  }

  if (request.method === "POST" && pathname.startsWith("/api/hosted-agents/")) {
    const hostedAgentId = parseHostedAgentSubresourceId(pathname, "approve");
    if (hostedAgentId) {
      await handleApproveHostedAgent(request, response, store, hostedAgentId, options);
      return;
    }
  }

  if (request.method === "POST" && pathname.startsWith("/api/hosted-agents/")) {
    const hostedAgentId = parseHostedAgentSubresourceId(pathname, "secret");
    if (hostedAgentId) {
      await handleConfigureHostedSecret(request, response, store, hostedAgentId, options);
      return;
    }
  }

  if (request.method === "POST" && pathname.startsWith("/api/hosted-agents/")) {
    const hostedAgentId = parseHostedAgentSubresourceId(pathname, "leases");
    if (hostedAgentId) {
      await handleCreateHostedLease(request, response, store, hostedAgentId, options);
      return;
    }
  }

  if (request.method === "POST" && pathname.startsWith("/api/hosted-agents/")) {
    const hostedAgentId = parseHostedAgentSubresourceId(pathname, "invoke");
    if (hostedAgentId) {
      await handleInvokeHostedAgent(request, response, store, hostedAgentId, options);
      return;
    }
  }

  if (request.method === "POST" && pathname.startsWith("/api/hosted-agents/")) {
    const hostedAgentId = parseHostedAgentReviewSubmissionId(pathname);
    if (!hostedAgentId) {
      writeJson(response, 404, { error: "not found" });
      return;
    }

    const item = await store.findHostedAgentById(hostedAgentId);
    if (!item) {
      writeJson(response, 404, { error: "Hosted Agent not found." });
      return;
    }

    const submittedAt = (options.now ?? (() => new Date()))().toISOString();
    const healthcheck = await runHostedAgentHealthcheck(item, {
      fetchImpl: options.fetchImpl,
      now: options.now,
      timeoutMs: options.healthcheckTimeoutMs
    });
    const review: HostedAgentReviewSubmission = {
      reviewKind: "hosted-api-black-box",
      submittedAt,
      fingerprint: createHostedAgentFingerprint(item, submittedAt),
      healthcheck,
      notes: buildReviewNotes(healthcheck.status)
    };

    const updated = await store.submitHostedAgentForReview(hostedAgentId, review);
    if (!updated) {
      writeJson(response, 404, { error: "Hosted Agent not found." });
      return;
    }

    writeJson(response, 200, {
      hostedAgentId: updated.hostedAgentId,
      status: updated.status,
      submittedAt,
      fingerprint: review.fingerprint,
      healthcheck: review.healthcheck,
      notes: review.notes
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/hosted-agents") {
    const items = await store.listHostedAgents();
    writeJson(response, 200, { items });
    return;
  }

  if (request.method === "GET" && pathname.startsWith("/api/hosted-agents/")) {
    const hostedAgentId = parseHostedAgentSubresourceId(pathname, "gateway");
    if (hostedAgentId) {
      await handleGetHostedGatewaySummary(response, store, hostedAgentId, options);
      return;
    }
  }

  if (request.method === "GET" && pathname.startsWith("/api/hosted-agents/")) {
    const hostedAgentId = parseHostedAgentId(pathname);
    const item = await store.findHostedAgentById(hostedAgentId);

    if (!item) {
      writeJson(response, 404, { error: "Hosted Agent not found." });
      return;
    }

    writeJson(response, 200, { item });
    return;
  }

  writeJson(response, 404, { error: "not found" });
}

async function readJsonBody(request: HostedAgentRequestLike): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw new Error("JSON body must be 1MB or smaller.");
    }
    chunks.push(buffer);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  if (rawBody.length === 0) {
    return {};
  }

  return JSON.parse(rawBody);
}

function writeJson(response: HostedAgentResponseLike, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(`${JSON.stringify(body)}\n`);
}

function setCorsHeaders(response: HostedAgentResponseLike): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function parseRequestPathname(url: string | undefined): string {
  if (!url) {
    return "/";
  }

  return new URL(url, "http://localhost").pathname;
}

function parseHostedAgentPayload(payload: unknown): HostedAgentCreateInput {
  if (!payload || typeof payload !== "object") {
    throw new Error("Hosted Agent payload must be a JSON object.");
  }

  const record = payload as Record<string, unknown>;
  return {
    readme: parseReadme(record.readme),
    integration: parseIntegration(record.integration),
    ...(readOptionalString(record.developerAddress) ? { developerAddress: readOptionalString(record.developerAddress) } : {})
  };
}

function parseReadme(value: unknown): HostedAgentReadme {
  if (!value || typeof value !== "object") {
    throw new Error("readme must be a JSON object.");
  }

  const record = value as Record<string, unknown>;
  const agentName = readAgentName(record.agentName);
  const summary = readNonEmptyString(record.summary, "summary");
  const useCases = readStringArray(record.useCases, "useCases");
  const capabilities = readStringArray(record.capabilities, "capabilities");
  const limitations = readOptionalStringArray(record.limitations);
  const integrationType = readNonEmptyString(record.integrationType, "integrationType");

  return {
    agentName,
    ...(readOptionalString(record.displayName) ? { displayName: readOptionalString(record.displayName) } : {}),
    summary,
    useCases,
    capabilities,
    limitations,
    ...(readOptionalString(record.example) ? { example: readOptionalString(record.example) } : {}),
    integrationType,
    ...(readOptionalHttpUrl(record.docsUrl, "docsUrl") ? { docsUrl: readOptionalHttpUrl(record.docsUrl, "docsUrl") } : {}),
    ...(readOptionalHttpUrl(record.supportUrl, "supportUrl") ? { supportUrl: readOptionalHttpUrl(record.supportUrl, "supportUrl") } : {})
  };
}

function parseIntegration(value: unknown): HostedAgentIntegration {
  if (!value || typeof value !== "object") {
    throw new Error("integration must be a JSON object.");
  }

  const record = value as Record<string, unknown>;
  return {
    endpointUrl: readRequiredHttpUrl(record.endpointUrl, "endpointUrl"),
    schemaUrl: readRequiredHttpUrl(record.schemaUrl, "schemaUrl"),
    ...(readOptionalHttpUrl(record.healthcheckUrl, "healthcheckUrl")
      ? { healthcheckUrl: readOptionalHttpUrl(record.healthcheckUrl, "healthcheckUrl") }
      : {}),
    authMethod: readNonEmptyString(record.authMethod, "authMethod")
  };
}

function parseHostedAgentId(url: string): string {
  const match = /^\/api\/hosted-agents\/([^/]+)$/.exec(url);
  if (!match || match[1].trim().length === 0) {
    throw new Error("hostedAgentId is required.");
  }

  return decodeURIComponent(match[1]);
}

function parseHostedAgentReviewSubmissionId(url: string): string | undefined {
  const match = /^\/api\/hosted-agents\/([^/]+)\/submit-review$/.exec(url);
  if (!match || match[1].trim().length === 0) {
    return undefined;
  }

  return decodeURIComponent(match[1]);
}

function parseHostedAgentSubresourceId(url: string, subresource: string): string | undefined {
  const escaped = subresource.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^/api/hosted-agents/([^/]+)/${escaped}$`).exec(url);
  if (!match || match[1].trim().length === 0) {
    return undefined;
  }

  return decodeURIComponent(match[1]);
}

async function handleApproveHostedAgent(
  request: HostedAgentRequestLike,
  response: HostedAgentResponseLike,
  store: HostedAgentStoreLike,
  hostedAgentId: string,
  options: Omit<HostedAgentApiServerOptions, "store">
): Promise<void> {
  const item = await store.findHostedAgentById(hostedAgentId);
  if (!item) {
    writeJson(response, 404, { error: "Hosted Agent not found." });
    return;
  }
  if (!item.review) {
    writeJson(response, 409, { error: "Hosted Agent must be submitted for review before approval." });
    return;
  }
  if (item.status !== "pending_review") {
    writeJson(response, 409, { error: "Hosted Agent must be pending review before approval." });
    return;
  }

  const payload = await readJsonBody(request);
  const approval = parseApprovalPayload(payload, (options.now ?? (() => new Date()))().toISOString());
  const updated = await store.approveHostedAgent(hostedAgentId, approval);
  if (!updated) {
    writeJson(response, 404, { error: "Hosted Agent not found." });
    return;
  }

  writeJson(response, 200, {
    hostedAgentId: updated.hostedAgentId,
    status: updated.status,
    approval: updated.approval
  });
}

async function handleConfigureHostedSecret(
  request: HostedAgentRequestLike,
  response: HostedAgentResponseLike,
  store: HostedAgentStoreLike,
  hostedAgentId: string,
  options: Omit<HostedAgentApiServerOptions, "store">
): Promise<void> {
  const gatewayStore = options.gatewayStore;
  if (!gatewayStore) {
    writeJson(response, 503, { error: "Hosted Agent Gateway store is not configured." });
    return;
  }

  const item = await store.findHostedAgentById(hostedAgentId);
  if (!item) {
    writeJson(response, 404, { error: "Hosted Agent not found." });
    return;
  }
  if (item.status !== "approved") {
    writeJson(response, 409, { error: "Hosted Agent must be approved before configuring gateway secrets." });
    return;
  }

  try {
    const secret = parseSecretPayload(await readJsonBody(request));
    const stored = await gatewayStore.upsertSecret(hostedAgentId, secret);
    writeJson(response, 200, {
      hostedAgentId,
      secretConfigured: true,
      authHeaderName: stored.authHeaderName,
      updatedAt: stored.updatedAt
    });
  } catch (error) {
    writeJson(response, 400, {
      error: error instanceof Error ? error.message : "Invalid hosted Agent secret payload."
    });
  }
}

async function handleCreateHostedLease(
  request: HostedAgentRequestLike,
  response: HostedAgentResponseLike,
  store: HostedAgentStoreLike,
  hostedAgentId: string,
  options: Omit<HostedAgentApiServerOptions, "store">
): Promise<void> {
  const gatewayStore = options.gatewayStore;
  if (!gatewayStore) {
    writeJson(response, 503, { error: "Hosted Agent Gateway store is not configured." });
    return;
  }

  const item = await store.findHostedAgentById(hostedAgentId);
  if (!item) {
    writeJson(response, 404, { error: "Hosted Agent not found." });
    return;
  }
  if (item.status !== "approved") {
    writeJson(response, 409, { error: "Hosted Agent must be approved before leases can be created." });
    return;
  }
  if (!(await gatewayStore.findSecret(hostedAgentId))) {
    writeJson(response, 409, { error: "Hosted Agent gateway secret must be configured before leases can be created." });
    return;
  }

  try {
    const leaseInput = parseLeasePayload(await readJsonBody(request), hostedAgentId);
    const lease = await gatewayStore.createLease(leaseInput);
    writeJson(response, 201, {
      hostedAgentId,
      lease
    });
  } catch (error) {
    writeJson(response, 400, {
      error: error instanceof Error ? error.message : "Invalid hosted Agent lease payload."
    });
  }
}

async function handleInvokeHostedAgent(
  request: HostedAgentRequestLike,
  response: HostedAgentResponseLike,
  store: HostedAgentStoreLike,
  hostedAgentId: string,
  options: Omit<HostedAgentApiServerOptions, "store">
): Promise<void> {
  const gatewayStore = options.gatewayStore;
  if (!gatewayStore) {
    writeJson(response, 503, { error: "Hosted Agent Gateway store is not configured." });
    return;
  }

  const item = await store.findHostedAgentById(hostedAgentId);
  if (!item) {
    writeJson(response, 404, { error: "Hosted Agent not found." });
    return;
  }
  if (item.status !== "approved") {
    writeJson(response, 409, { error: "Hosted Agent must be approved before gateway invocation." });
    return;
  }

  const accessToken = readBearerToken(request.headers?.authorization);
  if (!accessToken) {
    writeJson(response, 401, { error: "Bearer access token is required." });
    return;
  }

  const lease = await gatewayStore.findLeaseByToken(hostedAgentId, accessToken);
  if (!lease) {
    writeJson(response, 403, { error: "Hosted Agent lease not found." });
    return;
  }

  const at = options.now ?? (() => new Date());
  const now = at();
  const requestId = gatewayStore.createRequestId();

  if (lease.revokedAt || new Date(lease.expiresAt).getTime() <= now.getTime()) {
    await recordGatewayUsage(gatewayStore, {
      requestId,
      hostedAgentId,
      leaseId: lease.leaseId,
      userId: lease.userId,
      status: "rejected",
      createdAt: now.toISOString(),
      latencyMs: 0,
      error: "LEASE_EXPIRED"
    });
    writeJson(response, 403, { error: "Hosted Agent lease is expired." });
    return;
  }

  const recentCount = await gatewayStore.countRecentUsage(
    lease.leaseId,
    new Date(now.getTime() - 60 * 1000)
  );
  if (recentCount >= lease.maxRequestsPerMinute) {
    await recordGatewayUsage(gatewayStore, {
      requestId,
      hostedAgentId,
      leaseId: lease.leaseId,
      userId: lease.userId,
      status: "rejected",
      createdAt: now.toISOString(),
      latencyMs: 0,
      error: "RATE_LIMITED"
    });
    writeJson(response, 429, { error: "Hosted Agent lease rate limit exceeded." });
    return;
  }

  const secret = await gatewayStore.findSecret(hostedAgentId);
  if (!secret) {
    writeJson(response, 409, { error: "Hosted Agent gateway secret is not configured." });
    return;
  }

  const invocationPayload = await readJsonBody(request);
  const startedAt = Date.now();
  const fetchImpl = options.fetchImpl ?? fetch;
  const consumed = await gatewayStore.consumeLeaseRequest(lease.leaseId);
  if (consumed.status !== "consumed") {
    await recordGatewayUsage(gatewayStore, {
      requestId,
      hostedAgentId,
      leaseId: lease.leaseId,
      userId: lease.userId,
      status: "rejected",
      createdAt: now.toISOString(),
      latencyMs: 0,
      error: consumed.status === "quota_exceeded" ? "REQUEST_QUOTA_EXCEEDED" : "LEASE_NOT_FOUND"
    });
    writeJson(
      response,
      consumed.status === "quota_exceeded" ? 429 : 403,
      {
        error:
          consumed.status === "quota_exceeded"
            ? "Hosted Agent lease request quota exceeded."
            : "Hosted Agent lease not found."
      }
    );
    return;
  }

  try {
    const downstream = await fetchImpl(item.integration.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [secret.authHeaderName]: secret.authHeaderValue
      },
      body: JSON.stringify(invocationPayload)
    });
    const responseBody = await readDownstreamResponse(downstream);
    const latencyMs = Date.now() - startedAt;
    const status: HostedAgentUsageLog["status"] = downstream.ok ? "succeeded" : "failed";
    await recordGatewayUsage(gatewayStore, {
      requestId,
      hostedAgentId,
      leaseId: lease.leaseId,
      userId: lease.userId,
      status,
      createdAt: now.toISOString(),
      latencyMs,
      downstreamStatus: downstream.status,
      ...(downstream.ok ? {} : { error: `DOWNSTREAM_${downstream.status}` })
    });
    writeJson(response, downstream.ok ? 200 : 502, {
      requestId,
      hostedAgentId,
      leaseId: lease.leaseId,
      downstreamStatus: downstream.status,
      latencyMs,
      response: responseBody
    });
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    await recordGatewayUsage(gatewayStore, {
      requestId,
      hostedAgentId,
      leaseId: lease.leaseId,
      userId: lease.userId,
      status: "failed",
      createdAt: now.toISOString(),
      latencyMs,
      error: error instanceof Error ? error.message : "DOWNSTREAM_FETCH_FAILED"
    });
    writeJson(response, 502, {
      requestId,
      error: "Hosted Agent downstream request failed."
    });
  }
}

async function handleGetHostedGatewaySummary(
  response: HostedAgentResponseLike,
  store: HostedAgentStoreLike,
  hostedAgentId: string,
  options: Omit<HostedAgentApiServerOptions, "store">
): Promise<void> {
  const gatewayStore = options.gatewayStore;
  if (!gatewayStore) {
    writeJson(response, 503, { error: "Hosted Agent Gateway store is not configured." });
    return;
  }

  const item = await store.findHostedAgentById(hostedAgentId);
  if (!item) {
    writeJson(response, 404, { error: "Hosted Agent not found." });
    return;
  }

  writeJson(response, 200, {
    hostedAgentId,
    status: item.status,
    gateway: await gatewayStore.summarizeGateway(hostedAgentId)
  });
}

async function readDownstreamResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.toLowerCase().includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  return response.text();
}

async function recordGatewayUsage(
  gatewayStore: HostedAgentGatewayStore,
  log: HostedAgentUsageLog
): Promise<void> {
  await gatewayStore.recordUsage(log);
}

function parseApprovalPayload(payload: unknown, approvedAt: string): HostedAgentApproval {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  return {
    approvedAt,
    ...(readOptionalString(record.reviewer) ? { reviewer: readOptionalString(record.reviewer) } : {}),
    ...(readOptionalString(record.note) ? { note: readOptionalString(record.note) } : {})
  };
}

function parseSecretPayload(payload: unknown): HostedAgentSecretInput {
  if (!payload || typeof payload !== "object") {
    throw new Error("secret payload must be a JSON object.");
  }

  const record = payload as Record<string, unknown>;
  const authHeaderName = readNonEmptyString(record.authHeaderName, "authHeaderName");
  const authHeaderValue = readNonEmptyString(record.authHeaderValue, "authHeaderValue");

  if (!/^[A-Za-z0-9-]{1,64}$/.test(authHeaderName)) {
    throw new Error("authHeaderName must be an HTTP header name.");
  }

  if (["host", "content-length", "transfer-encoding", "connection"].includes(authHeaderName.toLowerCase())) {
    throw new Error("authHeaderName cannot override hop-by-hop or transport headers.");
  }

  return {
    authHeaderName,
    authHeaderValue
  };
}

function parseLeasePayload(payload: unknown, hostedAgentId: string): HostedAgentLeaseInput {
  if (!payload || typeof payload !== "object") {
    throw new Error("lease payload must be a JSON object.");
  }

  const record = payload as Record<string, unknown>;
  const durationHours = readPositiveInteger(record.durationHours, "durationHours", 24 * 30);
  const maxRequests = readPositiveInteger(record.maxRequests, "maxRequests", 100_000);
  const maxRequestsPerMinute =
    record.maxRequestsPerMinute === undefined
      ? undefined
      : readPositiveInteger(record.maxRequestsPerMinute, "maxRequestsPerMinute", 1_000);

  return {
    hostedAgentId,
    userId: readNonEmptyString(record.userId, "userId"),
    durationHours,
    maxRequests,
    ...(maxRequestsPerMinute === undefined ? {} : { maxRequestsPerMinute })
  };
}

function readPositiveInteger(value: unknown, fieldName: string, maxValue: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0 || value > maxValue) {
    throw new Error(`${fieldName} must be an integer between 1 and ${maxValue}.`);
  }

  return value;
}

function readBearerToken(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match?.[1]?.trim() || undefined;
}

function buildReviewNotes(status: HostedAgentReviewSubmission["healthcheck"]["status"]): string[] {
  if (status === "passed") {
    return [
      "Healthcheck passed. Reviewer should validate schema, auth boundary, metering plan and abuse controls."
    ];
  }

  if (status === "failed") {
    return [
      "Healthcheck failed. Keep the Agent in pending review until the endpoint is reachable and stable.",
      "Because this path does not include a Docker image, reviewer should run black-box endpoint tests before approval."
    ];
  }

  return [
    "No healthcheck URL configured. Reviewer must validate endpoint and schema manually.",
    "Because this path does not include a Docker image, trust tier should remain below audited image submissions."
  ];
}

function readAgentName(value: unknown): string {
  const name = readNonEmptyString(value, "agentName");
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name)) {
    throw new Error("agentName must match ^[a-zA-Z0-9_-]{1,64}$.");
  }

  return name;
}

function readStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be a non-empty string array.`);
  }

  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  if (items.length === 0) {
    throw new Error(`${fieldName} must be a non-empty string array.`);
  }

  return items;
}

function readOptionalStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function readNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readRequiredHttpUrl(value: unknown, fieldName: string): string {
  const raw = readNonEmptyString(value, fieldName);
  assertHttpUrl(raw, fieldName);
  return raw;
}

function readOptionalHttpUrl(value: unknown, fieldName: string): string | undefined {
  const raw = readOptionalString(value);
  if (!raw) return undefined;
  assertHttpUrl(raw, fieldName);
  return raw;
}

function assertHttpUrl(value: string, fieldName: string): void {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${fieldName} must be a valid http(s) URL.`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${fieldName} must be a valid http(s) URL.`);
  }
}
