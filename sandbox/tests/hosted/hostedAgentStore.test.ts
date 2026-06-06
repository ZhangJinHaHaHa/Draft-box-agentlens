import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createHostedAgentStore } from "../../src/hosted/hostedAgentStore";

test("hosted agent store saves and reloads drafts", async () => {
  const stateDir = await mkdtemp(join(tmpdir(), "hosted-agent-store-"));

  try {
    const store = createHostedAgentStore({
      stateDir,
      now: () => new Date("2026-06-06T10:00:00.000Z"),
      createHostedAgentId: () => "hst-001"
    });

    const created = await store.createHostedAgent({
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
      },
      developerAddress: "0xdeveloper"
    });

    assert.equal(created.hostedAgentId, "hst-001");
    assert.equal(created.status, "draft");

    const reloaded = createHostedAgentStore({ stateDir });
    const items = await reloaded.listHostedAgents();
    assert.equal(items.length, 1);
    assert.equal(items[0].hostedAgentId, "hst-001");
    assert.equal(items[0].readme.agentName, "research-agent");
    assert.equal(items[0].integration.endpointUrl, "https://api.example.com/agent");
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});
