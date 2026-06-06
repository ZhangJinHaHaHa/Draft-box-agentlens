import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";

import {
  handleHostedAgentApiRequest,
  type HostedAgentStoreLike
} from "../../src/hosted/hostedAgentApiServer";
import { createHostedAgentGatewayStore } from "../../src/hosted/hostedAgentGatewayStore";
import type { HostedAgentDraft } from "../../src/hosted/hostedAgentTypes";

function createStoreDouble(): {
  store: HostedAgentStoreLike;
  created: HostedAgentDraft[];
} {
  const created: HostedAgentDraft[] = [];

  return {
    created,
    store: {
      async createHostedAgent(input) {
        const draft: HostedAgentDraft = {
          hostedAgentId: "hst-001",
          status: "draft",
          createdAt: "2026-06-06T10:00:00.000Z",
          updatedAt: "2026-06-06T10:00:00.000Z",
          ...input
        };
        created.push(draft);
        return draft;
      },
      async listHostedAgents() {
        return created;
      },
      async findHostedAgentById(hostedAgentId) {
        return created.find((item) => item.hostedAgentId === hostedAgentId);
      },
      async submitHostedAgentForReview(hostedAgentId, review) {
        const index = created.findIndex((item) => item.hostedAgentId === hostedAgentId);
        if (index === -1) return undefined;
        created[index] = {
          ...created[index],
          status: "pending_review",
          updatedAt: "2026-06-06T10:01:00.000Z",
          review
        };
        return created[index];
      },
      async approveHostedAgent(hostedAgentId, approval) {
        const index = created.findIndex((item) => item.hostedAgentId === hostedAgentId);
        if (index === -1) return undefined;
        created[index] = {
          ...created[index],
          status: "approved",
          updatedAt: "2026-06-06T10:03:00.000Z",
          approval
        };
        return created[index];
      }
    }
  };
}

test("hosted Agent API accepts POST /api/hosted-agents", async () => {
  const { store, created } = createStoreDouble();
  const response = createResponseDouble();

  await handleHostedAgentApiRequest(
    createRequestDouble("POST", "/api/hosted-agents", {
      readme: {
        agentName: "research-agent",
        displayName: "Research Agent",
        summary: "Research assistant.",
        useCases: ["market research"],
        capabilities: ["summaries"],
        limitations: ["no trading"],
        example: "input -> output",
        integrationType: "API",
        docsUrl: "https://docs.example.com"
      },
      integration: {
        endpointUrl: "https://api.example.com/agent",
        schemaUrl: "https://api.example.com/openapi.json",
        healthcheckUrl: "https://api.example.com/health",
        authMethod: "Platform-held API key"
      },
      developerAddress: "0xdeveloper"
    }),
    response,
    store
  );

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.jsonBody, {
    hostedAgentId: "hst-001",
    status: "draft",
    createdAt: "2026-06-06T10:00:00.000Z"
  });
  assert.equal(created.length, 1);
  assert.equal(created[0].readme.agentName, "research-agent");
});

test("hosted Agent API rejects invalid endpoints", async () => {
  const { store } = createStoreDouble();
  const response = createResponseDouble();

  await handleHostedAgentApiRequest(
    createRequestDouble("POST", "/api/hosted-agents", {
      readme: {
        agentName: "research-agent",
        summary: "Research assistant.",
        useCases: ["market research"],
        capabilities: ["summaries"],
        integrationType: "API"
      },
      integration: {
        endpointUrl: "ftp://api.example.com/agent",
        schemaUrl: "https://api.example.com/openapi.json",
        authMethod: "Platform-held API key"
      }
    }),
    response,
    store
  );

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.jsonBody, {
    error: "endpointUrl must be a valid http(s) URL."
  });
});

test("hosted Agent API returns 400 for invalid JSON bodies", async () => {
  const { store } = createStoreDouble();
  const response = createResponseDouble();

  await handleHostedAgentApiRequest(
    createRawRequestDouble("POST", "/api/hosted-agents", "{"),
    response,
    store
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.jsonBody.error, /JSON/);
});

test("hosted Agent API returns 400 for oversized JSON bodies", async () => {
  const { store } = createStoreDouble();
  const response = createResponseDouble();

  await handleHostedAgentApiRequest(
    createRawRequestDouble("POST", "/api/hosted-agents", "x".repeat(1024 * 1024 + 1)),
    response,
    store
  );

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.jsonBody, {
    error: "JSON body must be 1MB or smaller."
  });
});

test("hosted Agent API lists and reads drafts", async () => {
  const { store, created } = createStoreDouble();
  created.push({
    hostedAgentId: "hst-001",
    status: "draft",
    createdAt: "2026-06-06T10:00:00.000Z",
    updatedAt: "2026-06-06T10:00:00.000Z",
    readme: {
      agentName: "research-agent",
      summary: "Research assistant.",
      useCases: ["market research"],
      capabilities: ["summaries"],
      limitations: [],
      integrationType: "API"
    },
    integration: {
      endpointUrl: "https://api.example.com/agent",
      schemaUrl: "https://api.example.com/openapi.json",
      authMethod: "Platform-held API key"
    }
  });

  const listResponse = createResponseDouble();
  await handleHostedAgentApiRequest(
    createRequestDouble("GET", "/api/hosted-agents", undefined),
    listResponse,
    store
  );

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.jsonBody.items.length, 1);

  const readResponse = createResponseDouble();
  await handleHostedAgentApiRequest(
    createRequestDouble("GET", "/api/hosted-agents/hst-001", undefined),
    readResponse,
    store
  );

  assert.equal(readResponse.statusCode, 200);
  assert.equal(readResponse.jsonBody.item.hostedAgentId, "hst-001");
});

test("hosted Agent API submits drafts for black-box review", async () => {
  const { store, created } = createStoreDouble();
  created.push({
    hostedAgentId: "hst-001",
    status: "draft",
    createdAt: "2026-06-06T10:00:00.000Z",
    updatedAt: "2026-06-06T10:00:00.000Z",
    readme: {
      agentName: "research-agent",
      summary: "Research assistant.",
      useCases: ["market research"],
      capabilities: ["summaries"],
      limitations: [],
      integrationType: "API"
    },
    integration: {
      endpointUrl: "https://api.example.com/agent",
      schemaUrl: "https://api.example.com/openapi.json",
      healthcheckUrl: "https://api.example.com/health",
      authMethod: "Platform-held API key"
    },
    developerAddress: "0xdeveloper"
  });

  const response = createResponseDouble();
  await handleHostedAgentApiRequest(
    createRequestDouble("POST", "/api/hosted-agents/hst-001/submit-review", undefined),
    response,
    store,
    {
      now: () => new Date("2026-06-06T10:02:00.000Z"),
      fetchImpl: async () =>
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
    }
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.jsonBody.hostedAgentId, "hst-001");
  assert.equal(response.jsonBody.status, "pending_review");
  assert.equal(response.jsonBody.healthcheck.status, "passed");
  assert.equal(response.jsonBody.healthcheck.httpStatus, 200);
  assert.match(response.jsonBody.fingerprint.value, /^sha256:[a-f0-9]{64}$/);
  assert.equal(created[0].status, "pending_review");
  assert.equal(created[0].review?.fingerprint.subject.endpointHost, "api.example.com");
});

test("hosted Agent API records missing healthcheck without blocking review submission", async () => {
  const { store, created } = createStoreDouble();
  created.push({
    hostedAgentId: "hst-001",
    status: "draft",
    createdAt: "2026-06-06T10:00:00.000Z",
    updatedAt: "2026-06-06T10:00:00.000Z",
    readme: {
      agentName: "research-agent",
      summary: "Research assistant.",
      useCases: ["market research"],
      capabilities: ["summaries"],
      limitations: [],
      integrationType: "API"
    },
    integration: {
      endpointUrl: "https://api.example.com/agent",
      schemaUrl: "https://api.example.com/openapi.json",
      authMethod: "Platform-held API key"
    }
  });

  const response = createResponseDouble();
  await handleHostedAgentApiRequest(
    createRequestDouble("POST", "/api/hosted-agents/hst-001/submit-review", undefined),
    response,
    store,
    { now: () => new Date("2026-06-06T10:02:00.000Z") }
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.jsonBody.status, "pending_review");
  assert.equal(response.jsonBody.healthcheck.status, "not_configured");
  assert.equal(created[0].review?.notes.length, 2);
});

test("hosted Agent API requires review before approval", async () => {
  const { store, created } = createStoreDouble();
  created.push(createHostedAgentDraft());

  const response = createResponseDouble();
  await handleHostedAgentApiRequest(
    createRequestDouble("POST", "/api/hosted-agents/hst-001/approve", { reviewer: "local-admin" }),
    response,
    store,
    { now: () => new Date("2026-06-06T10:04:00.000Z") }
  );

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.jsonBody, {
    error: "Hosted Agent must be submitted for review before approval."
  });
});

test("hosted Agent API approves reviewed hosted Agents", async () => {
  const { store, created } = createStoreDouble();
  created.push(createHostedAgentDraft({ status: "pending_review", review: createHostedReview() }));

  const response = createResponseDouble();
  await handleHostedAgentApiRequest(
    createRequestDouble("POST", "/api/hosted-agents/hst-001/approve", {
      reviewer: "local-admin",
      note: "Endpoint and schema reviewed for local MVP."
    }),
    response,
    store,
    { now: () => new Date("2026-06-06T10:04:00.000Z") }
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.jsonBody.hostedAgentId, "hst-001");
  assert.equal(response.jsonBody.status, "approved");
  assert.deepEqual(response.jsonBody.approval, {
    approvedAt: "2026-06-06T10:04:00.000Z",
    reviewer: "local-admin",
    note: "Endpoint and schema reviewed for local MVP."
  });
  assert.equal(created[0].status, "approved");
});

test("hosted Agent API does not approve hosted Agents outside pending review", async () => {
  const { store, created } = createStoreDouble();
  created.push(createHostedAgentDraft({ status: "approved", review: createHostedReview() }));

  const response = createResponseDouble();
  await handleHostedAgentApiRequest(
    createRequestDouble("POST", "/api/hosted-agents/hst-001/approve", { reviewer: "local-admin" }),
    response,
    store,
    { now: () => new Date("2026-06-06T10:04:00.000Z") }
  );

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.jsonBody, {
    error: "Hosted Agent must be pending review before approval."
  });
});

test("hosted Agent gateway requires approval and configured secrets before leases", async () => {
  const stateDir = await mkdtemp(join(tmpdir(), "hosted-agent-gateway-api-"));

  try {
    const gatewayStore = createHostedAgentGatewayStore({
      stateDir,
      now: () => new Date("2026-06-06T10:05:00.000Z"),
      createLeaseId: () => "hlease-001",
      createAccessToken: () => "agl_test_token",
      createRequestId: () => "hreq-001"
    });
    const { store, created } = createStoreDouble();
    created.push(createHostedAgentDraft({ status: "pending_review", review: createHostedReview() }));

    const secretBeforeApprovalResponse = createResponseDouble();
    await handleHostedAgentApiRequest(
      createRequestDouble("POST", "/api/hosted-agents/hst-001/secret", {
        authHeaderName: "X-Agent-Key",
        authHeaderValue: "developer-secret"
      }),
      secretBeforeApprovalResponse,
      store,
      { gatewayStore }
    );

    assert.equal(secretBeforeApprovalResponse.statusCode, 409);
    assert.equal(
      secretBeforeApprovalResponse.jsonBody.error,
      "Hosted Agent must be approved before configuring gateway secrets."
    );

    const approveResponse = createResponseDouble();
    await handleHostedAgentApiRequest(
      createRequestDouble("POST", "/api/hosted-agents/hst-001/approve", { reviewer: "local-admin" }),
      approveResponse,
      store,
      { gatewayStore, now: () => new Date("2026-06-06T10:05:00.000Z") }
    );
    assert.equal(approveResponse.statusCode, 200);

    const leaseBeforeSecretResponse = createResponseDouble();
    await handleHostedAgentApiRequest(
      createRequestDouble("POST", "/api/hosted-agents/hst-001/leases", {
        userId: "user-001",
        durationHours: 1,
        maxRequests: 3
      }),
      leaseBeforeSecretResponse,
      store,
      { gatewayStore }
    );

    assert.equal(leaseBeforeSecretResponse.statusCode, 409);
    assert.equal(
      leaseBeforeSecretResponse.jsonBody.error,
      "Hosted Agent gateway secret must be configured before leases can be created."
    );

    const secretResponse = createResponseDouble();
    await handleHostedAgentApiRequest(
      createRequestDouble("POST", "/api/hosted-agents/hst-001/secret", {
        authHeaderName: "X-Agent-Key",
        authHeaderValue: "developer-secret"
      }),
      secretResponse,
      store,
      { gatewayStore }
    );

    assert.equal(secretResponse.statusCode, 200);
    assert.deepEqual(secretResponse.jsonBody, {
      hostedAgentId: "hst-001",
      secretConfigured: true,
      authHeaderName: "X-Agent-Key",
      updatedAt: "2026-06-06T10:05:00.000Z"
    });

    const gatewayResponse = createResponseDouble();
    await handleHostedAgentApiRequest(
      createRequestDouble("GET", "/api/hosted-agents/hst-001/gateway", undefined),
      gatewayResponse,
      store,
      { gatewayStore }
    );

    assert.equal(gatewayResponse.statusCode, 200);
    assert.deepEqual(gatewayResponse.jsonBody.gateway, {
      secretConfigured: true,
      activeLeaseCount: 0,
      totalRequestCount: 0,
      failedRequestCount: 0
    });
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("hosted Agent gateway creates leases and proxies invocations with platform-held secrets", async () => {
  const stateDir = await mkdtemp(join(tmpdir(), "hosted-agent-gateway-api-"));

  try {
    const gatewayStore = createHostedAgentGatewayStore({
      stateDir,
      now: () => new Date("2026-06-06T10:05:00.000Z"),
      createLeaseId: () => "hlease-001",
      createAccessToken: () => "agl_test_token",
      createRequestId: () => "hreq-001"
    });
    const { store, created } = createStoreDouble();
    created.push(createHostedAgentDraft({ status: "approved", review: createHostedReview() }));

    const secretResponse = createResponseDouble();
    await handleHostedAgentApiRequest(
      createRequestDouble("POST", "/api/hosted-agents/hst-001/secret", {
        authHeaderName: "X-Agent-Key",
        authHeaderValue: "developer-secret"
      }),
      secretResponse,
      store,
      { gatewayStore }
    );
    assert.equal(secretResponse.statusCode, 200);

    const leaseResponse = createResponseDouble();
    await handleHostedAgentApiRequest(
      createRequestDouble("POST", "/api/hosted-agents/hst-001/leases", {
        userId: "user-001",
        durationHours: 1,
        maxRequests: 2,
        maxRequestsPerMinute: 10
      }),
      leaseResponse,
      store,
      { gatewayStore }
    );

    assert.equal(leaseResponse.statusCode, 201);
    assert.equal(leaseResponse.jsonBody.lease.leaseId, "hlease-001");
    assert.equal(leaseResponse.jsonBody.lease.accessToken, "agl_test_token");
    assert.equal(leaseResponse.jsonBody.lease.requestCount, 0);
    assert.equal("accessTokenHash" in leaseResponse.jsonBody.lease, false);

    const unauthorizedResponse = createResponseDouble();
    await handleHostedAgentApiRequest(
      createRequestDouble("POST", "/api/hosted-agents/hst-001/invoke", { input: "hello" }),
      unauthorizedResponse,
      store,
      { gatewayStore }
    );
    assert.equal(unauthorizedResponse.statusCode, 401);

    let downstreamUrl: string | URL | Request | undefined;
    let downstreamInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (url, init) => {
      downstreamUrl = url;
      downstreamInit = init;
      return new Response(JSON.stringify({ answer: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    };

    const invokeResponse = createResponseDouble();
    await handleHostedAgentApiRequest(
      createRequestDouble(
        "POST",
        "/api/hosted-agents/hst-001/invoke",
        { input: "hello" },
        { authorization: "Bearer agl_test_token" }
      ),
      invokeResponse,
      store,
      { gatewayStore, fetchImpl, now: () => new Date("2026-06-06T10:06:00.000Z") }
    );

    assert.equal(invokeResponse.statusCode, 200);
    assert.equal(invokeResponse.jsonBody.requestId, "hreq-001");
    assert.equal(invokeResponse.jsonBody.downstreamStatus, 200);
    assert.deepEqual(invokeResponse.jsonBody.response, { answer: "ok" });
    assert.equal(String(downstreamUrl), "https://api.example.com/agent");
    assert.equal((downstreamInit?.headers as Record<string, string>)["X-Agent-Key"], "developer-secret");
    assert.equal(downstreamInit?.body, JSON.stringify({ input: "hello" }));

    const secondInvokeResponse = createResponseDouble();
    await handleHostedAgentApiRequest(
      createRequestDouble(
        "POST",
        "/api/hosted-agents/hst-001/invoke",
        { input: "again" },
        { authorization: "Bearer agl_test_token" }
      ),
      secondInvokeResponse,
      store,
      { gatewayStore, fetchImpl, now: () => new Date("2026-06-06T10:06:30.000Z") }
    );
    assert.equal(secondInvokeResponse.statusCode, 200);

    const quotaResponse = createResponseDouble();
    await handleHostedAgentApiRequest(
      createRequestDouble(
        "POST",
        "/api/hosted-agents/hst-001/invoke",
        { input: "third" },
        { authorization: "Bearer agl_test_token" }
      ),
      quotaResponse,
      store,
      { gatewayStore, fetchImpl, now: () => new Date("2026-06-06T10:07:00.000Z") }
    );
    assert.equal(quotaResponse.statusCode, 429);
    assert.equal(quotaResponse.jsonBody.error, "Hosted Agent lease request quota exceeded.");

    const gatewayResponse = createResponseDouble();
    await handleHostedAgentApiRequest(
      createRequestDouble("GET", "/api/hosted-agents/hst-001/gateway", undefined),
      gatewayResponse,
      store,
      { gatewayStore, now: () => new Date("2026-06-06T10:07:00.000Z") }
    );

    assert.equal(gatewayResponse.statusCode, 200);
    assert.deepEqual(gatewayResponse.jsonBody.gateway, {
      secretConfigured: true,
      activeLeaseCount: 1,
      totalRequestCount: 3,
      failedRequestCount: 1,
      latestRequestAt: "2026-06-06T10:07:00.000Z"
    });
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("hosted Agent gateway applies per-minute lease rate limits", async () => {
  const stateDir = await mkdtemp(join(tmpdir(), "hosted-agent-gateway-api-"));

  try {
    const gatewayStore = createHostedAgentGatewayStore({
      stateDir,
      now: () => new Date("2026-06-06T10:05:00.000Z"),
      createLeaseId: () => "hlease-001",
      createAccessToken: () => "agl_test_token",
      createRequestId: () => "hreq-001"
    });
    const { store, created } = createStoreDouble();
    created.push(createHostedAgentDraft({ status: "approved", review: createHostedReview() }));

    await handleHostedAgentApiRequest(
      createRequestDouble("POST", "/api/hosted-agents/hst-001/secret", {
        authHeaderName: "X-Agent-Key",
        authHeaderValue: "developer-secret"
      }),
      createResponseDouble(),
      store,
      { gatewayStore }
    );
    await handleHostedAgentApiRequest(
      createRequestDouble("POST", "/api/hosted-agents/hst-001/leases", {
        userId: "user-001",
        durationHours: 1,
        maxRequests: 10,
        maxRequestsPerMinute: 1
      }),
      createResponseDouble(),
      store,
      { gatewayStore }
    );

    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ answer: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });

    const firstResponse = createResponseDouble();
    await handleHostedAgentApiRequest(
      createRequestDouble(
        "POST",
        "/api/hosted-agents/hst-001/invoke",
        { input: "first" },
        { authorization: "Bearer agl_test_token" }
      ),
      firstResponse,
      store,
      { gatewayStore, fetchImpl, now: () => new Date("2026-06-06T10:06:00.000Z") }
    );
    assert.equal(firstResponse.statusCode, 200);

    const secondResponse = createResponseDouble();
    await handleHostedAgentApiRequest(
      createRequestDouble(
        "POST",
        "/api/hosted-agents/hst-001/invoke",
        { input: "second" },
        { authorization: "Bearer agl_test_token" }
      ),
      secondResponse,
      store,
      { gatewayStore, fetchImpl, now: () => new Date("2026-06-06T10:06:30.000Z") }
    );

    assert.equal(secondResponse.statusCode, 429);
    assert.equal(secondResponse.jsonBody.error, "Hosted Agent lease rate limit exceeded.");
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("hosted Agent gateway consumes quota atomically for concurrent invocations", async () => {
  const stateDir = await mkdtemp(join(tmpdir(), "hosted-agent-gateway-api-"));

  try {
    const gatewayStore = createHostedAgentGatewayStore({
      stateDir,
      now: () => new Date("2026-06-06T10:05:00.000Z"),
      createLeaseId: () => "hlease-001",
      createAccessToken: () => "agl_test_token",
      createRequestId: () => "hreq-001"
    });
    const { store, created } = createStoreDouble();
    created.push(createHostedAgentDraft({ status: "approved", review: createHostedReview() }));

    await handleHostedAgentApiRequest(
      createRequestDouble("POST", "/api/hosted-agents/hst-001/secret", {
        authHeaderName: "X-Agent-Key",
        authHeaderValue: "developer-secret"
      }),
      createResponseDouble(),
      store,
      { gatewayStore }
    );
    await handleHostedAgentApiRequest(
      createRequestDouble("POST", "/api/hosted-agents/hst-001/leases", {
        userId: "user-001",
        durationHours: 1,
        maxRequests: 1,
        maxRequestsPerMinute: 10
      }),
      createResponseDouble(),
      store,
      { gatewayStore }
    );

    const fetchImpl: typeof fetch = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Response(JSON.stringify({ answer: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    };
    const firstResponse = createResponseDouble();
    const secondResponse = createResponseDouble();

    await Promise.all([
      handleHostedAgentApiRequest(
        createRequestDouble(
          "POST",
          "/api/hosted-agents/hst-001/invoke",
          { input: "first" },
          { authorization: "Bearer agl_test_token" }
        ),
        firstResponse,
        store,
        { gatewayStore, fetchImpl, now: () => new Date("2026-06-06T10:06:00.000Z") }
      ),
      handleHostedAgentApiRequest(
        createRequestDouble(
          "POST",
          "/api/hosted-agents/hst-001/invoke",
          { input: "second" },
          { authorization: "Bearer agl_test_token" }
        ),
        secondResponse,
        store,
        { gatewayStore, fetchImpl, now: () => new Date("2026-06-06T10:06:00.000Z") }
      )
    ]);

    assert.deepEqual([firstResponse.statusCode, secondResponse.statusCode].sort(), [200, 429]);

    const gatewayResponse = createResponseDouble();
    await handleHostedAgentApiRequest(
      createRequestDouble("GET", "/api/hosted-agents/hst-001/gateway", undefined),
      gatewayResponse,
      store,
      { gatewayStore, now: () => new Date("2026-06-06T10:06:00.000Z") }
    );
    assert.equal(gatewayResponse.jsonBody.gateway.totalRequestCount, 2);
    assert.equal(gatewayResponse.jsonBody.gateway.failedRequestCount, 1);
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

function createRequestDouble(method: string, url: string, body: unknown): Readable & {
  method: string;
  url: string;
  headers: Record<string, string>;
};
function createRequestDouble(
  method: string,
  url: string,
  body: unknown,
  headers: Record<string, string>
): Readable & {
  method: string;
  url: string;
  headers: Record<string, string>;
};
function createRequestDouble(
  method: string,
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
): Readable & {
  method: string;
  url: string;
  headers: Record<string, string>;
} {
  const rawBody = body === undefined ? "" : JSON.stringify(body);
  const stream = Readable.from(rawBody.length > 0 ? [rawBody] : []);
  return Object.assign(stream, {
    method,
    url,
    headers
  });
}

function createRawRequestDouble(method: string, url: string, rawBody: string): Readable & {
  method: string;
  url: string;
  headers: Record<string, string>;
} {
  const stream = Readable.from(rawBody.length > 0 ? [rawBody] : []);
  return Object.assign(stream, {
    method,
    url,
    headers: {}
  });
}

function createResponseDouble(): {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  jsonBody: any;
  setHeader(name: string, value: string): void;
  end(body: string): void;
} {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    jsonBody: undefined,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body: string) {
      this.body = body;
      this.jsonBody = body.length > 0 ? JSON.parse(body) : undefined;
    }
  };
}

function createHostedAgentDraft(overrides: Partial<HostedAgentDraft> = {}): HostedAgentDraft {
  return {
    hostedAgentId: "hst-001",
    status: "draft",
    createdAt: "2026-06-06T10:00:00.000Z",
    updatedAt: "2026-06-06T10:00:00.000Z",
    readme: {
      agentName: "research-agent",
      summary: "Research assistant.",
      useCases: ["market research"],
      capabilities: ["summaries"],
      limitations: [],
      integrationType: "API"
    },
    integration: {
      endpointUrl: "https://api.example.com/agent",
      schemaUrl: "https://api.example.com/openapi.json",
      healthcheckUrl: "https://api.example.com/health",
      authMethod: "Platform-held API key"
    },
    developerAddress: "0xdeveloper",
    ...overrides
  };
}

function createHostedReview(): HostedAgentDraft["review"] {
  return {
    reviewKind: "hosted-api-black-box",
    submittedAt: "2026-06-06T10:02:00.000Z",
    fingerprint: {
      algorithm: "sha256",
      scope: "hosted-api",
      value: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      createdAt: "2026-06-06T10:02:00.000Z",
      subject: {
        agentName: "research-agent",
        endpointHost: "api.example.com",
        schemaHost: "api.example.com",
        developerAddress: "0xdeveloper"
      }
    },
    healthcheck: {
      status: "passed",
      checkedAt: "2026-06-06T10:02:00.000Z",
      url: "https://api.example.com/health",
      httpStatus: 200,
      latencyMs: 42
    },
    notes: ["Healthcheck passed."]
  };
}
