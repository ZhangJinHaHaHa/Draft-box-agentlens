import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createHostedAgentGatewayStore,
  hashAccessToken
} from "../../src/hosted/hostedAgentGatewayStore";

test("hosted Agent gateway store persists secrets, leases and hashed access tokens", async () => {
  const stateDir = await mkdtemp(join(tmpdir(), "hosted-agent-gateway-store-"));

  try {
    const store = createHostedAgentGatewayStore({
      stateDir,
      now: () => new Date("2026-06-06T10:05:00.000Z"),
      createLeaseId: () => "hlease-001",
      createAccessToken: () => "agl_secret_token",
      createRequestId: () => "hreq-001"
    });

    await store.upsertSecret("hst-001", {
      authHeaderName: "X-Agent-Key",
      authHeaderValue: "developer-secret"
    });

    const lease = await store.createLease({
      hostedAgentId: "hst-001",
      userId: "user-001",
      durationHours: 1,
      maxRequests: 2,
      maxRequestsPerMinute: 1
    });

    assert.equal(lease.leaseId, "hlease-001");
    assert.equal(lease.accessToken, "agl_secret_token");
    assert.equal("accessTokenHash" in lease, false);

    const reloaded = createHostedAgentGatewayStore({
      stateDir,
      now: () => new Date("2026-06-06T10:06:00.000Z")
    });
    const foundLease = await reloaded.findLeaseByToken("hst-001", "agl_secret_token");
    assert.equal(foundLease?.leaseId, "hlease-001");
    assert.equal(foundLease?.accessTokenHash, hashAccessToken("agl_secret_token"));

    await reloaded.recordUsage({
      requestId: "hreq-001",
      hostedAgentId: "hst-001",
      leaseId: "hlease-001",
      userId: "user-001",
      status: "succeeded",
      createdAt: "2026-06-06T10:06:00.000Z",
      latencyMs: 12,
      downstreamStatus: 200
    });

    assert.equal(
      await reloaded.countRecentUsage("hlease-001", new Date("2026-06-06T10:05:30.000Z")),
      1
    );
    assert.deepEqual(await reloaded.summarizeGateway("hst-001"), {
      secretConfigured: true,
      activeLeaseCount: 1,
      totalRequestCount: 1,
      failedRequestCount: 0,
      latestRequestAt: "2026-06-06T10:06:00.000Z"
    });

    const raw = await readFile(join(stateDir, "hosted-agent-gateway.json"), "utf8");
    assert.equal(raw.includes("agl_secret_token"), false);
    assert.equal(raw.includes(hashAccessToken("agl_secret_token")), true);
    assert.equal(raw.includes("developer-secret"), true);
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});
