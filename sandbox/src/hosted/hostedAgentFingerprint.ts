import { createHash } from "node:crypto";

import type {
  HostedAgentCreateInput,
  HostedAgentFingerprint
} from "./hostedAgentTypes";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nestedValue]) => nestedValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, canonicalize(nestedValue)])
    );
  }

  return value;
}

function hashCanonicalPayload(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

export function createHostedAgentFingerprint(
  input: HostedAgentCreateInput,
  createdAt: string
): HostedAgentFingerprint {
  const endpoint = new URL(input.integration.endpointUrl);
  const schema = new URL(input.integration.schemaUrl);
  const payload = {
    kind: "hosted-api",
    version: 1,
    readme: input.readme,
    integration: {
      endpointUrl: input.integration.endpointUrl,
      schemaUrl: input.integration.schemaUrl,
      healthcheckUrl: input.integration.healthcheckUrl ?? null,
      authMethod: input.integration.authMethod
    },
    developerAddress: input.developerAddress ?? null
  };

  return {
    algorithm: "sha256",
    scope: "hosted-api",
    value: `sha256:${hashCanonicalPayload(payload)}`,
    createdAt,
    subject: {
      agentName: input.readme.agentName,
      endpointHost: endpoint.host,
      schemaHost: schema.host,
      ...(input.developerAddress ? { developerAddress: input.developerAddress } : {})
    }
  };
}
