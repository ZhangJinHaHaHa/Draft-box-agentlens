import { describe, expect, it, vi } from "vitest";

import {
  approveHostedAgent,
  configureHostedAgentSecret,
  createHostedAgentLease,
  getHostedAgentGatewaySummary,
  invokeHostedAgent,
  listHostedAgents,
  submitHostedAgentDraft,
  submitHostedAgentForReview
} from "./hostedAgentClient";

describe("listHostedAgents", () => {
  it("loads hosted Agent drafts and keeps review evidence", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              hostedAgentId: "hst-001",
              status: "approved",
              createdAt: "2026-06-06T10:00:00.000Z",
              updatedAt: "2026-06-06T10:04:00.000Z",
              developerAddress: "0x3333333333333333333333333333333333333333",
              readme: {
                agentName: "research-agent",
                displayName: "Research Agent",
                summary: "Research assistant.",
                useCases: ["market research"],
                capabilities: ["summaries"],
                limitations: ["No investment advice."],
                integrationType: "API",
                docsUrl: "https://docs.example.com"
              },
              integration: {
                endpointUrl: "https://api.example.com/agent",
                schemaUrl: "https://api.example.com/openapi.json",
                healthcheckUrl: "https://api.example.com/health",
                authMethod: "Platform-held API key"
              },
              review: {
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
                    developerAddress: "0x3333333333333333333333333333333333333333"
                  }
                },
                healthcheck: {
                  status: "passed",
                  checkedAt: "2026-06-06T10:02:00.000Z",
                  httpStatus: 200,
                  latencyMs: 35
                },
                notes: ["Healthcheck passed."]
              },
              approval: {
                approvedAt: "2026-06-06T10:04:00.000Z",
                reviewer: "local-admin"
              }
            }
          ]
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    const result = await listHostedAgents({
      endpointUrl: "https://api.example.com/hosted-agents",
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledWith("https://api.example.com/hosted-agents", {
      method: "GET"
    });
    expect(result.ok).toBe(true);
    expect(result.ok ? result.items[0]?.hostedAgentId : undefined).toBe("hst-001");
    expect(result.ok ? result.items[0]?.review?.healthcheck.status : undefined).toBe("passed");
  });

  it("returns list API errors", async () => {
    const result = await listHostedAgents({
      endpointUrl: "https://api.example.com/hosted-agents",
      fetchImpl: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Hosted API unavailable." }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        })
      )
    });

    expect(result).toEqual({
      ok: false,
      error: "Hosted API unavailable."
    });
  });
});

describe("submitHostedAgentDraft", () => {
  it("posts hosted Agent draft payloads", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          hostedAgentId: "hst-001",
          status: "draft",
          createdAt: "2026-06-06T10:00:00.000Z"
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    const input = {
      readme: {
        agentName: "research-agent",
        summary: "Research assistant.",
        useCases: ["research"],
        capabilities: ["summaries"],
        limitations: [],
        integrationType: "API"
      },
      integration: {
        endpointUrl: "https://api.example.com/agent",
        schemaUrl: "https://api.example.com/openapi.json",
        authMethod: "Platform-held API key"
      },
      developerAddress: "0xdeveloper"
    };

    const result = await submitHostedAgentDraft(input, {
      endpointUrl: "https://api.example.com/hosted-agents",
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledWith("https://api.example.com/hosted-agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    expect(result).toEqual({
      ok: true,
      hostedAgentId: "hst-001",
      status: "draft",
      createdAt: "2026-06-06T10:00:00.000Z"
    });
  });

  it("returns API validation errors", async () => {
    const result = await submitHostedAgentDraft(
      {
        readme: {
          agentName: "bad-agent",
          summary: "Bad.",
          useCases: ["research"],
          capabilities: ["summaries"],
          limitations: [],
          integrationType: "API"
        },
        integration: {
          endpointUrl: "ftp://example.com",
          schemaUrl: "https://api.example.com/openapi.json",
          authMethod: "Platform-held API key"
        }
      },
      {
        endpointUrl: "https://api.example.com/hosted-agents",
        fetchImpl: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: "endpointUrl must be a valid http(s) URL." }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          })
        )
      }
    );

    expect(result).toEqual({
      ok: false,
      error: "endpointUrl must be a valid http(s) URL."
    });
  });
});

describe("submitHostedAgentForReview", () => {
  it("submits hosted Agent drafts for review and parses evidence", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          hostedAgentId: "hst-001",
          status: "pending_review",
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
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    const result = await submitHostedAgentForReview("hst-001", {
      endpointUrl: "https://api.example.com/hosted-agents/",
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.example.com/hosted-agents/hst-001/submit-review",
      { method: "POST" }
    );
    expect(result).toEqual({
      ok: true,
      hostedAgentId: "hst-001",
      status: "pending_review",
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
    });
  });

  it("returns review submission errors", async () => {
    const result = await submitHostedAgentForReview("hst-missing", {
      endpointUrl: "https://api.example.com/hosted-agents",
      fetchImpl: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Hosted Agent not found." }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        })
      )
    });

    expect(result).toEqual({
      ok: false,
      error: "Hosted Agent not found."
    });
  });
});

describe("hosted Agent gateway client", () => {
  it("approves hosted Agents", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          hostedAgentId: "hst-001",
          status: "approved",
          approval: {
            approvedAt: "2026-06-06T10:04:00.000Z",
            reviewer: "local-admin",
            note: "Local MVP approval."
          }
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    const result = await approveHostedAgent(
      "hst-001",
      { reviewer: "local-admin", note: "Local MVP approval." },
      {
        endpointUrl: "https://api.example.com/hosted-agents/",
        fetchImpl
      }
    );

    expect(fetchImpl).toHaveBeenCalledWith("https://api.example.com/hosted-agents/hst-001/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewer: "local-admin", note: "Local MVP approval." })
    });
    expect(result).toEqual({
      ok: true,
      hostedAgentId: "hst-001",
      status: "approved",
      approval: {
        approvedAt: "2026-06-06T10:04:00.000Z",
        reviewer: "local-admin",
        note: "Local MVP approval."
      }
    });
  });

  it("configures gateway secrets without returning the secret value", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          hostedAgentId: "hst-001",
          secretConfigured: true,
          authHeaderName: "X-Agent-Key",
          updatedAt: "2026-06-06T10:05:00.000Z"
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    const result = await configureHostedAgentSecret(
      "hst-001",
      { authHeaderName: "X-Agent-Key", authHeaderValue: "developer-secret" },
      {
        endpointUrl: "https://api.example.com/hosted-agents",
        fetchImpl
      }
    );

    expect(fetchImpl).toHaveBeenCalledWith("https://api.example.com/hosted-agents/hst-001/secret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authHeaderName: "X-Agent-Key", authHeaderValue: "developer-secret" })
    });
    expect(result).toEqual({
      ok: true,
      hostedAgentId: "hst-001",
      secretConfigured: true,
      authHeaderName: "X-Agent-Key",
      updatedAt: "2026-06-06T10:05:00.000Z"
    });
  });

  it("creates leases and parses one-time access tokens", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          hostedAgentId: "hst-001",
          lease: {
            leaseId: "hlease-001",
            hostedAgentId: "hst-001",
            userId: "user-001",
            accessToken: "agl_test_token",
            createdAt: "2026-06-06T10:05:00.000Z",
            expiresAt: "2026-06-06T11:05:00.000Z",
            maxRequests: 3,
            maxRequestsPerMinute: 1,
            requestCount: 0
          }
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    const result = await createHostedAgentLease(
      "hst-001",
      { userId: "user-001", durationHours: 1, maxRequests: 3, maxRequestsPerMinute: 1 },
      {
        endpointUrl: "https://api.example.com/hosted-agents",
        fetchImpl
      }
    );

    expect(fetchImpl).toHaveBeenCalledWith("https://api.example.com/hosted-agents/hst-001/leases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-001", durationHours: 1, maxRequests: 3, maxRequestsPerMinute: 1 })
    });
    expect(result).toEqual({
      ok: true,
      hostedAgentId: "hst-001",
      lease: {
        leaseId: "hlease-001",
        hostedAgentId: "hst-001",
        userId: "user-001",
        accessToken: "agl_test_token",
        createdAt: "2026-06-06T10:05:00.000Z",
        expiresAt: "2026-06-06T11:05:00.000Z",
        maxRequests: 3,
        maxRequestsPerMinute: 1,
        requestCount: 0
      }
    });
  });

  it("invokes hosted Agents through Bearer tokens", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          requestId: "hreq-001",
          hostedAgentId: "hst-001",
          leaseId: "hlease-001",
          downstreamStatus: 200,
          latencyMs: 8,
          response: { answer: "ok" }
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    const result = await invokeHostedAgent(
      "hst-001",
      "agl_test_token",
      { input: "hello" },
      {
        endpointUrl: "https://api.example.com/hosted-agents",
        fetchImpl
      }
    );

    expect(fetchImpl).toHaveBeenCalledWith("https://api.example.com/hosted-agents/hst-001/invoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer agl_test_token"
      },
      body: JSON.stringify({ input: "hello" })
    });
    expect(result).toEqual({
      ok: true,
      requestId: "hreq-001",
      hostedAgentId: "hst-001",
      leaseId: "hlease-001",
      downstreamStatus: 200,
      latencyMs: 8,
      response: { answer: "ok" }
    });
  });

  it("returns gateway invocation errors with request ids", async () => {
    const result = await invokeHostedAgent(
      "hst-001",
      "agl_test_token",
      { input: "hello" },
      {
        endpointUrl: "https://api.example.com/hosted-agents",
        fetchImpl: vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              requestId: "hreq-001",
              error: "Hosted Agent lease request quota exceeded."
            }),
            {
              status: 429,
              headers: { "Content-Type": "application/json" }
            }
          )
        )
      }
    );

    expect(result).toEqual({
      ok: false,
      error: "Hosted Agent lease request quota exceeded.",
      requestId: "hreq-001"
    });
  });

  it("loads gateway summaries", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          hostedAgentId: "hst-001",
          status: "approved",
          gateway: {
            secretConfigured: true,
            activeLeaseCount: 1,
            totalRequestCount: 3,
            failedRequestCount: 1,
            latestRequestAt: "2026-06-06T10:07:00.000Z"
          }
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    const result = await getHostedAgentGatewaySummary("hst-001", {
      endpointUrl: "https://api.example.com/hosted-agents",
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledWith("https://api.example.com/hosted-agents/hst-001/gateway", {
      method: "GET"
    });
    expect(result).toEqual({
      ok: true,
      hostedAgentId: "hst-001",
      status: "approved",
      gateway: {
        secretConfigured: true,
        activeLeaseCount: 1,
        totalRequestCount: 3,
        failedRequestCount: 1,
        latestRequestAt: "2026-06-06T10:07:00.000Z"
      }
    });
  });
});
