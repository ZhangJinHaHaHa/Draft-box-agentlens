import { describe, expect, it } from "vitest";

import { validateAgentManifestInput } from "./manifestValidation";

describe("validateAgentManifestInput", () => {
  it("accepts the audit manifest shape used by the sandbox", () => {
    const result = validateAgentManifestInput({
      agentName: "hermes-agent",
      image: "registry.example.com/hermes-agent:1.0.0",
      allowedHosts: "api.hermes.io\napi.openai.com",
      allowedRpcEndpoints: "https://rpc.example.com",
      manifestUrl: "https://example.com/manifest.json"
    });

    expect(result.ok).toBe(true);
    expect(result.manifest).toEqual({
      agent_name: "hermes-agent",
      image: "registry.example.com/hermes-agent:1.0.0",
      allowed_hosts: ["api.hermes.io", "api.openai.com"],
      allowed_rpc_endpoints: ["https://rpc.example.com/"]
    });
  });

  it("rejects local hosts and invalid manifest urls", () => {
    const result = validateAgentManifestInput({
      agentName: "bad agent",
      image: "",
      allowedHosts: "localhost,*.example.com",
      allowedRpcEndpoints: "http://127.0.0.1:8545",
      manifestUrl: "ipfs://manifest"
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("agentName");
      expect(result.errors).toContain("allowedHostsPrivate");
      expect(result.errors).toContain("allowedHostsWildcard");
      expect(result.errors).toContain("manifestUrlProtocol");
    }
  });
});
